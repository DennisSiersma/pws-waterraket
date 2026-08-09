/*
  Waterraket-vluchtcomputer met touch-UI  -  PWS natuurkunde
  ==============================================================
  Bord     : Waveshare ESP32-S3-Touch-LCD-1.69 (ESP32-S3, 240x280 ST7789V2,
             CST816 touch, QMI8658 IMU)
  Extra    : BMP388 barometer (los, via I2C bijgeprikt)  -> de HOOGTEMETING
  UI       : HOME-scherm met stats + START-knop  ->  live vlucht  ->
             RESULTAAT-scherm met stats + VERZEND-knop (opent wifi om te downloaden)

  ---- BENODIGDE LIBRARIES (Arduino IDE -> Bibliotheken beheren) ----
    - "GFX Library for Arduino"   (Arduino_GFX, door moononournation)  -> LCD
    - "SensorLib"                 (door lewisxhe)  -> QMI8658 IMU EN CST816 touch
    - "Adafruit BMP3XX Library"   (+ "Adafruit Unified Sensor" + "Adafruit BusIO")
    WiFi / WebServer / LittleFS / Wire zitten in de ESP32-Arduino board-package.

  ---- BOARD-INSTELLINGEN (Tools) ----
    Board: "ESP32S3 Dev Module" | PSRAM: "OPI PSRAM" | USB CDC On Boot: "Enabled"

  ---- LET OP: verifieer de pinnen/offsets met de Waveshare-wiki van jouw revisie ----
    Blijft het scherm zwart of staat het verschoven? Pas LCD_*-pinnen/offsets aan.
    Reageert de touch niet of gespiegeld? Pas TP_*-pinnen en TOUCH_FLIP_* aan.
    Fallback: de fysieke BOOT-knop (GPIO0) werkt altijd als START-knop.

  ---- ACCU (belangrijk) ----
    3,7V LiPo met MX1.25 (1,25 mm) stekker. CONTROLEER DE POLARITEIT tegen de
    markering op het bord VOORDAT je insteekt; omgekeerd kan het bord beschadigen.
    Laden via USB-C (ETA6098-lader op het bord).
    Op accu: sluit de accu aan, druk op de PWR-knop, daarna houdt de SYS_EN-latch
    hieronder de voeding vast.
*/

// ====================== CONFIG ======================
// --- I2C (BMP388 + onboard QMI8658 + CST816 touch delen deze bus) ---
#define I2C_SDA      11
#define I2C_SCL      10
#define BMP_ADDR     0x77      // BMP388: 0x77 of 0x76

// --- touch (CST816) ---
#define TP_RST       13        // CST816 reset  (schematic: TP_RST = GPIO13)
#define TP_INT       14        // CST816 interrupt (schematic: TP_INT = GPIO14)
#define TOUCH_FLIP_X 0
#define TOUCH_FLIP_Y 0

// --- LCD (ST7789V2 via SPI) ---
#define LCD_SCLK     6
#define LCD_MOSI     7
#define LCD_MISO    -1
#define LCD_CS       5
#define LCD_DC       4
#define LCD_RST      8
#define LCD_BL      15
#define LCD_W        240
#define LCD_H        280
#define LCD_OFFX     0
// 20 is juist voor dit paneel (met 0 loopt de titel van het scherm).
// De ~22 px afwijking zit in de TOUCH, niet in het beeld: die corrigeer je
// met het ijkscherm (INFO -> lang BOOT -> lang BOOT).
#define LCD_OFFY     20

// --- buzzer (optioneel; pin verifiëren) ---
#define USE_BUZZER   0
#define BUZZER_PIN   42   // onboard buzzer (officiele documentatie)

// --- fysieke knop als START-fallback ---
#define BOOT_BTN     0

// --- voedingslatch accu ---
// Het bord start NIET vanzelf op de accu: de PWR-knop geeft de accuvoeding
// kortstondig vrij, daarna moet de firmware SYS_EN hoog houden. Zonder deze
// latch valt de voeding weg zodra je PWR loslaat (op USB merk je hier niets van).
// Officiele Waveshare-documentatie voor dit bord (SKU 27350):
//   SYS_EN = GPIO41 (houdt de accuvoeding vast), SYS_OUT = GPIO40 (PWR-knop).
// Werkt de accuvoeding niet, probeer dan BOARD_ALT 1 (35/36).
#define BOARD_ALT    0
#if BOARD_ALT
  #define SYS_EN     35
  #define SYS_OUT    36
#else
  #define SYS_EN     41
  #define SYS_OUT    40
#endif

// --- gedrag ---
#define SAMPLE_HZ       50
#define LAUNCH_RISE_M   3.0
#define LAND_ALT_M      2.0
#define LAND_WINDOW_S   3
#define MAX_LOG_S       30

const char* AP_SSID = "Waterraket";
const char* AP_PASS = "raket1234";
const char* LOGPATH = "/flight.csv";
const uint32_t SAMPLE_US = 1000000UL / SAMPLE_HZ;

// ====================== INCLUDES ======================
#include <Wire.h>
#include <math.h>
#include <Adafruit_BMP3XX.h>
#include <Adafruit_BME680.h>   // voor de CJMCU-680 (BME680)
#include <SensorQMI8658.hpp>
#include <TouchDrv.hpp>        // (TouchDrvCSTXXX.hpp is deprecated)
#include <LittleFS.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Arduino_GFX_Library.h>

// --- kleuren (RGB565), eigen definities zodat ze niet van de library-versie afhangen ---
#define COL_BLACK     0x0000
#define COL_WHITE     0xFFFF
#define COL_CYAN      0x07FF
#define COL_GREEN     0x07E0
#define COL_BLUE      0x001F
#define COL_YELLOW    0xFFE0
#define COL_MAGENTA   0xF81F
#define COL_ORANGE    0xFD20
#define COL_DARKGREY  0x7BEF

// ====================== OBJECTEN ======================
Adafruit_BMP3XX bmp;
Adafruit_BME680  bme;
// welke druksensor is er gevonden?
enum BaroType { BARO_GEEN, BARO_BMP388, BARO_BME680 };
BaroType baro = BARO_GEEN;
uint8_t  baroAdr = 0;
SensorQMI8658   qmi;
TouchDrvCSTXXX  touch;
WebServer       server(80);
File            logFile;
bool touchOK = false;

Arduino_DataBus *bus = new Arduino_ESP32SPI(LCD_DC, LCD_CS, LCD_SCLK, LCD_MOSI, LCD_MISO);
Arduino_GFX *gfx = new Arduino_ST7789(bus, LCD_RST, 0, true, LCD_W, LCD_H,
                                      LCD_OFFX, LCD_OFFY, LCD_OFFX, LCD_OFFY);

// ====================== TOESTAND ======================
enum State { HOME, INFO, TOUCHTEST, CALIB, ARMED, LOGGING, RESULT, SENDING };
State state = HOME;
bool entered = false;            // is het huidige scherm al getekend?

float p0 = 1013.25;
float curAlt = 0, maxAlt = 0;
float ax = 0, ay = 0, az = 0, curG = 0, maxG = 0;
uint32_t tStart = 0, lastSample = 0, flightMs = 0;
uint32_t samples = 0;
int landCount = 0, uiCount = 0;
bool haveFlight = false;
bool touchWasDown = false, bootWasDown = false;
int  lastTx = -1, lastTy = -1;   // laatste aanraakcoordinaten (na correctie)
int  rawTx = -1, rawTy = -1;     // laatste RUWE aanraakcoordinaten
uint32_t tapCount = 0;           // hoeveel aanrakingen ooit gezien
// touch-kalibratie: scherm = a * ruw + b  (1,0 / 0 = ongecorrigeerd)
// Gemeten op dit bord: de touch rapporteert y ~22 px HOGER dan waar je tikt
// (kruis getekend op y=140 werd twee keer gemeld als 162). Dat is een vaste
// verschuiving, geen schaalfout, dus corrigeren we met -22 en schaal 1,0.
float calAx = 1.0, calBx = 0.0, calAy = 1.0, calBy = -22.0;
const char* CALPATH = "/touchcal2.txt";   // nieuwe naam: oude ijking vervalt

// ====================== KNOPPEN ======================
struct Btn { int x, y, w, h; const char* label; uint16_t col; };
// Knoppen blijven boven y=230: dat is het gebied dat de touch betrouwbaar haalt.
Btn BTN_START  = { 22, 146, 92, 52, "START",   COL_GREEN };
Btn BTN_INFO   = { 126, 146, 92, 52, "INFO",    COL_BLUE };
Btn BTN_CANCEL = { 30, 190, 180, 46, "ANNULEER", COL_DARKGREY };
Btn BTN_SEND   = { 24, 190, 92, 46, "VERZEND", COL_BLUE };
Btn BTN_NEW    = { 124, 190, 92, 46, "NIEUW",  COL_DARKGREY };
Btn BTN_BACK   = { 30, 190, 180, 46, "TERUG",   COL_DARKGREY };

void drawBtn(Btn b) {
  gfx->fillRoundRect(b.x, b.y, b.w, b.h, 10, b.col);
  gfx->setTextColor(b.col == COL_DARKGREY ? COL_WHITE : COL_BLACK);
  int sz = 3;                                   // kleiner als het niet past
  while (sz > 1 && (int)strlen(b.label) * 6 * sz > b.w - 10) sz--;
  int tw = (int)strlen(b.label) * 6 * sz;
  gfx->setTextSize(sz);
  gfx->setCursor(b.x + (b.w - tw) / 2, b.y + (b.h - 8 * sz) / 2);
  gfx->print(b.label);
}
bool hit(Btn b, int x, int y) { return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }

// nieuwe aanraking (opgaande flank); true + coords bij een verse tik
bool getTap(int &gx, int &gy) {
  bool tap = false;
  if (touchOK) {
    int16_t x[1], y[1];
    uint8_t n = touch.getPoint(x, y, 1);
    bool down = (n > 0);
    if (down && !touchWasDown) {
      gx = x[0]; gy = y[0];
#if TOUCH_FLIP_X
      gx = LCD_W - 1 - gx;
#endif
#if TOUCH_FLIP_Y
      gy = LCD_H - 1 - gy;
#endif
      tap = true;
      rawTx = gx; rawTy = gy;                       // ruw bewaren voor kalibratie
      gx = (int)(calAx * gx + calBx);               // kalibratie toepassen
      gy = (int)(calAy * gy + calBy);
      lastTx = gx; lastTy = gy; tapCount++;
      Serial.printf("touch: ruw x=%d y=%d -> scherm x=%d y=%d\n", rawTx, rawTy, gx, gy);
    }
    touchWasDown = down;
  }
  return tap;
}
// fysieke BOOT-knop als START-fallback
bool bootTap() {
  bool down = (digitalRead(BOOT_BTN) == LOW);
  bool tap = (down && !bootWasDown);
  bootWasDown = down;
  return tap;
}

// ====================== SENSOREN ======================
uint8_t leesReg(uint8_t adr, uint8_t reg) {
  Wire.beginTransmission(adr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return 0xFF;
  if (Wire.requestFrom(adr, (uint8_t)1) != 1) return 0xFF;
  return Wire.read();
}

float relAltitude(float pres_hPa) { return 44330.0 * (1.0 - pow(pres_hPa / p0, 0.1903)); }

bool readBaro(float &alt, float &pres, float &temp) {
  if (baro == BARO_BMP388) {
    if (!bmp.performReading()) return false;
    pres = bmp.pressure / 100.0; temp = bmp.temperature;
  } else if (baro == BARO_BME680) {
    if (!bme.performReading()) return false;
    pres = bme.pressure / 100.0; temp = bme.temperature;
  } else {
    return false;
  }
  alt = relAltitude(pres);
  return true;
}
const char* baroNaam() {
  return baro == BARO_BMP388 ? "BMP388" : (baro == BARO_BME680 ? "BME680" : "geen");
}
void readImu() {
  if (qmi.getDataReady()) {
    qmi.getAccelerometer(ax, ay, az);
    curG = sqrt(ax * ax + ay * ay + az * az);
    if (curG > maxG) maxG = curG;
  }
}
void beep(int ms) {
#if USE_BUZZER
  digitalWrite(BUZZER_PIN, HIGH); delay(ms); digitalWrite(BUZZER_PIN, LOW);
#endif
}

// ====================== SCHERMEN ======================
// Het glas heeft AFGERONDE HOEKEN: houd tekst en knoppen binnen deze marge,
// anders loopt er in de hoeken een stuk af.
#define SAFE_M       22

void title(const char* t, uint16_t col) {
  gfx->setTextColor(col); gfx->setTextSize(3); gfx->setCursor(SAFE_M, 26); gfx->print(t);
}
void stat(const char* label, String val, int y, uint16_t col) {
  gfx->setTextColor(COL_WHITE); gfx->setTextSize(2); gfx->setCursor(SAFE_M, y); gfx->print(label);
  gfx->setTextColor(col); gfx->setTextSize(3); gfx->setCursor(SAFE_M, y + 22); gfx->print(val);
}
String mORdash(float v) { return haveFlight ? String(v, 1) : String("--"); }

void screenHome() {
  gfx->fillScreen(COL_BLACK);
  title("WATERRAKET", COL_CYAN);
  // compacte stats, zodat ze niet onder de knoppen lopen
  gfx->setTextSize(1); gfx->setTextColor(COL_WHITE);
  gfx->setCursor(SAFE_M, 62); gfx->print("Apogeum (m)");
  gfx->setCursor(SAFE_M, 104); gfx->print("Max versn. (g)");
  gfx->setTextSize(3); gfx->setTextColor(COL_YELLOW);
  gfx->setCursor(SAFE_M, 74); gfx->print(mORdash(maxAlt));
  gfx->setTextColor(COL_ORANGE);
  gfx->setCursor(SAFE_M, 116); gfx->print(mORdash(maxG));
  drawBtn(BTN_START);
  drawBtn(BTN_INFO);
  // onderschrift, gecentreerd
  gfx->setTextSize(1); gfx->setTextColor(COL_DARKGREY);
  const char* r1 = "PWS CMP";
  const char* r2 = "Elde College 2026";
  gfx->setCursor((LCD_W - (int)strlen(r1) * 6) / 2, 214); gfx->print(r1);
  gfx->setCursor((LCD_W - (int)strlen(r2) * 6) / 2, 230); gfx->print(r2);
}

// Live sensordata zonder te lanceren
void screenInfo() {
  gfx->fillScreen(COL_BLACK);
  title("SENSOREN", COL_CYAN);
  gfx->setTextColor(COL_WHITE); gfx->setTextSize(1);
  gfx->setCursor(SAFE_M, 66);  gfx->print("Druk (hPa)");
  gfx->setCursor(SAFE_M, 92);  gfx->print("Hoogte (m)");
  gfx->setCursor(SAFE_M, 118); gfx->print("Temp (C)");
  gfx->setCursor(SAFE_M, 144); gfx->print("Versn. (g)");
  drawBtn(BTN_BACK);
}
void liveInfo() {
  float alt, pres, temp;
  bool ok = readBaro(alt, pres, temp);
  readImu();
  gfx->setTextSize(2);
  gfx->fillRect(120, 60, 100, 18, COL_BLACK);
  gfx->setTextColor(ok ? COL_GREEN : COL_ORANGE);
  gfx->setCursor(120, 60); gfx->print(ok ? String(pres, 1) : String("FOUT"));
  gfx->fillRect(120, 86, 100, 18, COL_BLACK);
  gfx->setTextColor(COL_CYAN);
  gfx->setCursor(120, 86); gfx->print(alt, 1);
  gfx->fillRect(120, 112, 100, 18, COL_BLACK);
  gfx->setTextColor(COL_YELLOW);
  gfx->setCursor(120, 112); gfx->print(temp, 1);
  gfx->fillRect(120, 138, 100, 18, COL_BLACK);
  gfx->setTextColor(COL_ORANGE);
  gfx->setCursor(120, 138); gfx->print(curG, 2);
  // touch-diagnose
  gfx->fillRect(SAFE_M, 246, 190, 12, COL_BLACK);
  gfx->setTextSize(1); gfx->setTextColor(touchOK ? COL_GREEN : COL_ORANGE);
  gfx->setCursor(SAFE_M, 248);
  gfx->print(touchOK ? "touch OK" : "touch FOUT");
  gfx->print(" "); gfx->print(baroNaam());
  gfx->print(" taps:"); gfx->print(tapCount);
  gfx->print(" x:"); gfx->print(lastTx); gfx->print(" y:"); gfx->print(lastTy);
}
// Raakpunttest: tekent een kruisje op de gerapporteerde coordinaten.
// Valt het kruisje onder je vinger, dan klopt de afbeelding en staan de
// knoppen goed. Ligt het ernaast, dan is dat precies de verschuiving.
void screenTouchTest() {
  gfx->fillScreen(COL_BLACK);
  title("RAAKTEST", COL_MAGENTA);
  gfx->setTextColor(COL_WHITE); gfx->setTextSize(1);
  gfx->setCursor(SAFE_M, 60); gfx->print("Tik: kruisje moet onder");
  gfx->setCursor(SAFE_M, 72); gfx->print("je vinger vallen.");
  gfx->setCursor(SAFE_M, 84); gfx->print("BOOT kort=terug lang=ijken");
  // veilig gebied (binnen de afgeronde hoeken) en middenkruis
  gfx->drawRoundRect(SAFE_M - 8, 34, LCD_W - 2 * (SAFE_M - 8), LCD_H - 60, 12, COL_DARKGREY);
  gfx->drawFastHLine(SAFE_M, LCD_H / 2, LCD_W - 2 * SAFE_M, COL_DARKGREY);
  gfx->drawFastVLine(LCD_W / 2, 40, LCD_H - 80, COL_DARKGREY);
}
void drawCross(int x, int y) {
  gfx->drawFastHLine(x - 10, y, 21, COL_GREEN);
  gfx->drawFastVLine(x, y - 10, 21, COL_GREEN);
  gfx->fillCircle(x, y, 3, COL_YELLOW);
  gfx->fillRect(SAFE_M, 96, 190, 12, COL_BLACK);
  gfx->setTextSize(1); gfx->setTextColor(COL_CYAN);
  gfx->setCursor(SAFE_M, 98); gfx->print("x="); gfx->print(x);
  gfx->print("  y="); gfx->print(y);
}

// ====================== TOUCH-KALIBRATIE ======================
void loadCal() {
  File f = LittleFS.open(CALPATH, "r");
  if (!f) { Serial.println("kalibratie: geen bestand, ongecorrigeerd"); return; }
  String s = f.readStringUntil('\n'); f.close();
  float a, b, c, d;
  if (sscanf(s.c_str(), "%f %f %f %f", &a, &b, &c, &d) == 4) {
    calAx = a; calBx = b; calAy = c; calBy = d;
    Serial.printf("kalibratie geladen: x=%.3f*r%+.1f  y=%.3f*r%+.1f\n", a, b, c, d);
  }
}
void saveCal() {
  File f = LittleFS.open(CALPATH, "w");
  if (!f) return;
  f.printf("%.5f %.3f %.5f %.3f\n", calAx, calBx, calAy, calBy);
  f.close();
  Serial.printf("kalibratie opgeslagen: x=%.3f*r%+.1f  y=%.3f*r%+.1f\n",
                calAx, calBx, calAy, calBy);
}
// twee ijkpunten, ruim van de randen af
const int CAL_X1 = 60,  CAL_Y1 = 70;
const int CAL_X2 = 180, CAL_Y2 = 210;

void drawTarget(int x, int y, const char* txt) {
  gfx->fillScreen(COL_BLACK);
  title("IJKEN", COL_MAGENTA);
  gfx->setTextSize(1); gfx->setTextColor(COL_WHITE);
  gfx->setCursor(SAFE_M, 110); gfx->print(txt);
  gfx->setCursor(SAFE_M, 124); gfx->print("Tik precies op het midden");
  gfx->setCursor(SAFE_M, 138); gfx->print("van de cirkel.");
  gfx->drawCircle(x, y, 12, COL_GREEN);
  gfx->drawCircle(x, y, 4, COL_GREEN);
  gfx->drawFastHLine(x - 18, y, 37, COL_GREEN);
  gfx->drawFastVLine(x, y - 18, 37, COL_GREEN);
}

void screenArmed() {
  gfx->fillScreen(COL_BLACK);
  title("GEREED", COL_GREEN);
  gfx->setTextColor(COL_WHITE); gfx->setTextSize(2); gfx->setCursor(SAFE_M, 80); gfx->print("Wacht op lancering");
  drawBtn(BTN_CANCEL);
}
void screenLogging() {
  gfx->fillScreen(COL_BLACK);
  title("VLUCHT", COL_ORANGE);
  gfx->setTextColor(COL_WHITE); gfx->setTextSize(2); gfx->setCursor(SAFE_M, 74); gfx->print("Hoogte (m)");
  gfx->setTextColor(COL_WHITE); gfx->setTextSize(2); gfx->setCursor(SAFE_M, 146); gfx->print("Versn. (g)");
}
void screenResult() {
  gfx->fillScreen(COL_BLACK);
  title("RESULTAAT", COL_MAGENTA);
  stat("Apogeum (m)", String(maxAlt, 1), 52, COL_YELLOW);
  stat("Max versn. (g)", String(maxG, 1), 102, COL_ORANGE);
  stat("Vluchttijd (s)", String(flightMs / 1000.0, 1), 152, COL_CYAN);
  drawBtn(BTN_SEND); drawBtn(BTN_NEW);
}
void screenSending() {
  gfx->fillScreen(COL_BLACK);
  title("VERZENDEN", COL_BLUE);
  gfx->setTextColor(COL_WHITE); gfx->setTextSize(2);
  gfx->setCursor(SAFE_M, 56);  gfx->print("WiFi-netwerk:");
  gfx->setTextColor(COL_GREEN); gfx->setCursor(SAFE_M, 78); gfx->print(AP_SSID);
  gfx->setTextColor(COL_WHITE); gfx->setCursor(SAFE_M, 104); gfx->print("Wachtwoord:");
  gfx->setTextColor(COL_GREEN); gfx->setCursor(SAFE_M, 126); gfx->print(AP_PASS);
  gfx->setTextColor(COL_WHITE); gfx->setCursor(SAFE_M, 152); gfx->print("Open in browser:");
  gfx->setTextColor(COL_CYAN);  gfx->setCursor(SAFE_M, 174); gfx->print(WiFi.softAPIP().toString());
  drawBtn(BTN_BACK);
}
// dynamische waarden bijwerken (alleen het getalvlak overtekenen)
void liveLogging() {
  gfx->fillRect(SAFE_M, 96, 224, 40, COL_BLACK);
  gfx->setTextColor(COL_CYAN); gfx->setTextSize(4); gfx->setCursor(SAFE_M, 100); gfx->print(curAlt, 1);
  gfx->fillRect(SAFE_M, 176, 224, 40, COL_BLACK);
  gfx->setTextColor(COL_ORANGE); gfx->setTextSize(4); gfx->setCursor(SAFE_M, 176); gfx->print(curG, 1);
}

// ====================== LOGGING / AP ======================
void calibrate() {
  float sum = 0; int n = 0; float a, pr, t;
  for (int i = 0; i < 50; i++) { if (readBaro(a, pr, t)) { sum += pr; n++; } delay(20); }
  p0 = sum / (n > 0 ? n : 1);
  maxAlt = 0; maxG = 0; samples = 0; curAlt = 0; landCount = 0;
  logFile = LittleFS.open(LOGPATH, "w");
  logFile.println("t_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g");
  logFile.close();
}
void startAP() {
  WiFi.mode(WIFI_AP); WiFi.softAP(AP_SSID, AP_PASS);
  server.on("/", []() {
    String h = "<h2>Waterraket - vluchtdata</h2>";
    h += "<p>Apogeum: " + String(maxAlt, 1) + " m &middot; Max g: " + String(maxG, 1)
       + " &middot; Tijd: " + String(flightMs / 1000.0, 1) + " s</p>";
    h += "<p><a href='/flight.csv'>Download CSV</a></p>";
    server.send(200, "text/html", h);
  });
  server.on("/flight.csv", []() {
    File f = LittleFS.open(LOGPATH, "r"); server.streamFile(f, "text/csv"); f.close();
  });
  server.begin();
}

// ====================== SETUP ======================
void setup() {
  // Accuvoeding vasthouden. MOET als allereerste, voor de trage init van
  // LCD/sensoren, anders valt het bord uit zodra je de PWR-knop loslaat.
  pinMode(SYS_EN, OUTPUT);
  digitalWrite(SYS_EN, HIGH);

  pinMode(BOOT_BTN, INPUT_PULLUP);
#if USE_BUZZER
  pinMode(BUZZER_PIN, OUTPUT); digitalWrite(BUZZER_PIN, LOW);
#endif
  pinMode(LCD_BL, OUTPUT); digitalWrite(LCD_BL, HIGH);
  gfx->begin(); gfx->fillScreen(COL_BLACK);

  // STARTMARKERING: bewijst dat DEZE firmware draait. Zie je dit niet, dan is
  // de oude sketch nog actief of blijft het oude beeld in het LCD staan.
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("=== Waterraket build " __DATE__ " " __TIME__ " ===");
  gfx->fillScreen(COL_BLUE);
  gfx->setTextColor(COL_WHITE); gfx->setTextSize(2);
  gfx->setCursor(SAFE_M, 40); gfx->print("BOOT OK");
  gfx->setCursor(SAFE_M, 70); gfx->print(__TIME__);
  delay(1200);
  gfx->fillScreen(COL_BLACK);

  Wire.begin(I2C_SDA, I2C_SCL);
  LittleFS.begin(true);
  loadCal();

  // I2C-scan: welke chips reageren er echt?
  Serial.print("I2C gevonden:");
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) { Serial.print(" 0x"); Serial.print(a, HEX); }
  }
  Serial.println("  (verwacht: 0x15 touch, 0x6B IMU, 0x76 of 0x77 BMP388)");

  // Welke druksensor zit erop? LET OP: het chip-ID staat NIET bij elke Bosch-
  // sensor in hetzelfde register. BMP388/BMP390: register 0x00 (0x50 / 0x60).
  // BME680, BME280, BMP280: register 0xD0 (0x61 / 0x60 / 0x58).
  for (uint8_t adr = 0x76; adr <= 0x77 && baro == BARO_GEEN; adr++) {
    uint8_t id00 = leesReg(adr, 0x00);
    uint8_t idD0 = leesReg(adr, 0xD0);
    Serial.printf("0x%02X: reg0x00=0x%02X  reg0xD0=0x%02X\n", adr, id00, idD0);
    if (id00 == 0x50 || id00 == 0x60)      { baro = BARO_BMP388; baroAdr = adr; }
    else if (idD0 == 0x61)                 { baro = BARO_BME680; baroAdr = adr; }
    else if (idD0 == 0x58 || idD0 == 0x60)
      Serial.println("  -> lijkt een BMP280/BME280, niet ondersteund");
  }

  if (baro == BARO_BMP388) {
    if (bmp.begin_I2C(baroAdr, &Wire)) {
      // oversampling en meetfrequentie moeten bij elkaar passen: 8x druk kost
      // ~27 ms en haalt 50 Hz (20 ms) niet. 4x past wel.
      bmp.setPressureOversampling(BMP3_OVERSAMPLING_4X);
      bmp.setTemperatureOversampling(BMP3_NO_OVERSAMPLING);
      bmp.setIIRFilterCoeff(BMP3_IIR_FILTER_COEFF_3);
      bmp.setOutputDataRate(BMP3_ODR_50_HZ);
    } else { baro = BARO_GEEN; }
  } else if (baro == BARO_BME680) {
    if (bme.begin(baroAdr, true)) {
      bme.setTemperatureOversampling(BME680_OS_1X);
      bme.setPressureOversampling(BME680_OS_4X);
      bme.setHumidityOversampling(BME680_OS_NONE);   // niet nodig, kost tijd
      bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
      bme.setGasHeater(0, 0);                        // gasmeting UIT: veel sneller
    } else { baro = BARO_GEEN; }
  }
  Serial.print("druksensor: "); Serial.print(baroNaam());
  if (baro != BARO_GEEN) Serial.printf(" op 0x%02X", baroAdr);
  Serial.println();
  float ta, tp, tt;
  Serial.print("eerste meting: ");
  Serial.println(readBaro(ta, tp, tt) ? String(tp, 1) + " hPa" : String("MISLUKT"));

  qmi.begin(Wire, QMI8658_L_SLAVE_ADDRESS, I2C_SDA, I2C_SCL);
  qmi.configAccelerometer(SensorQMI8658::ACC_RANGE_16G,
                          SensorQMI8658::ACC_ODR_1000Hz,
                          SensorQMI8658::LPF_MODE_0);
  qmi.enableAccelerometer();

  touch.setPins(TP_RST, TP_INT);
  touchOK = touch.begin(Wire, CST816_SLAVE_ADDRESS, I2C_SDA, I2C_SCL);
  Serial.print("touch init: "); Serial.println(touchOK ? "OK" : "MISLUKT");

  state = HOME; entered = false;
}

// ====================== LOOP ======================
void loop() {
  int gx = 0, gy = 0;
  float alt, pres, temp;

  switch (state) {

    case HOME: {
      if (!entered) { screenHome(); entered = true; }
      bool go = false, wantInfo = false;
      if (getTap(gx, gy)) {
        if (hit(BTN_START, gx, gy))     go = true;
        else if (hit(BTN_INFO, gx, gy)) wantInfo = true;
      }
      // BOOT-knop als touch niet werkt: kort = INFO, lang (>1,2 s) = START
      static uint32_t bootDown = 0;
      bool bd = (digitalRead(BOOT_BTN) == LOW);
      if (bd && bootDown == 0) bootDown = millis();
      if (!bd && bootDown) {
        uint32_t held = millis() - bootDown; bootDown = 0;
        if (held > 1200) go = true; else wantInfo = true;
      }
      if (wantInfo) { state = INFO; entered = false; }
      else if (go) {
        title("KALIBREREN...", COL_WHITE);          // even feedback
        calibrate(); beep(80);
        state = ARMED; entered = false;
      }
      delay(30);
    } break;

    case INFO: {
      if (!entered) { screenInfo(); entered = true; }
      liveInfo();
      if (getTap(gx, gy) && hit(BTN_BACK, gx, gy)) { state = HOME; entered = false; }
      // BOOT: kort = terug naar HOME, lang (>1,2 s) = raaktest
      static uint32_t bootDownI = 0;
      bool bdi = (digitalRead(BOOT_BTN) == LOW);
      if (bdi && bootDownI == 0) bootDownI = millis();
      if (!bdi && bootDownI) {
        uint32_t held = millis() - bootDownI; bootDownI = 0;
        state = (held > 1200) ? TOUCHTEST : HOME;
        entered = false;
      }
      delay(120);
    } break;

    case TOUCHTEST: {
      if (!entered) { screenTouchTest(); entered = true; }
      if (getTap(gx, gy)) drawCross(gx, gy);
      // BOOT: kort = terug, lang (>1,2 s) = ijken
      static uint32_t bootDownT = 0;
      bool bdt = (digitalRead(BOOT_BTN) == LOW);
      if (bdt && bootDownT == 0) bootDownT = millis();
      if (!bdt && bootDownT) {
        uint32_t held = millis() - bootDownT; bootDownT = 0;
        if (held > 4000) {                    // heel lang = kalibratie wissen
          calAx = 1.0; calBx = 0.0; calAy = 1.0; calBy = 0.0;
          LittleFS.remove(CALPATH);
          Serial.println("kalibratie gewist (ongecorrigeerd)");
          gfx->fillScreen(COL_BLACK); title("GEWIST", COL_ORANGE);
          delay(1200); entered = false;
        } else {
          state = (held > 1200) ? CALIB : HOME;
          entered = false;
        }
      }
      delay(30);
    } break;

    case CALIB: {
      static int step = 0;
      static int r1x = 0, r1y = 0;
      if (!entered) {
        step = 0;
        // tijdens het ijken ongecorrigeerd meten
        calAx = 1.0; calBx = 0.0; calAy = 1.0; calBy = 0.0;
        drawTarget(CAL_X1, CAL_Y1, "Punt 1 van 2");
        entered = true;
      }
      if (getTap(gx, gy)) {
        if (step == 0) {
          r1x = rawTx; r1y = rawTy; step = 1;
          delay(400);                      // dubbele tik voorkomen
          drawTarget(CAL_X2, CAL_Y2, "Punt 2 van 2");
        } else {
          int dxr = rawTx - r1x, dyr = rawTy - r1y;
          if (abs(dxr) > 20 && abs(dyr) > 20) {      // plausibel?
            calAx = (float)(CAL_X2 - CAL_X1) / dxr;
            calBx = CAL_X1 - calAx * r1x;
            calAy = (float)(CAL_Y2 - CAL_Y1) / dyr;
            calBy = CAL_Y1 - calAy * r1y;
            saveCal();
            gfx->fillScreen(COL_BLACK);
            title("GEIJKT", COL_GREEN);
            gfx->setTextSize(1); gfx->setTextColor(COL_WHITE);
            gfx->setCursor(SAFE_M, 120); gfx->print("Opgeslagen. Controleer met");
            gfx->setCursor(SAFE_M, 134); gfx->print("de raaktest.");
          } else {
            gfx->fillScreen(COL_BLACK);
            title("MISLUKT", COL_ORANGE);
            gfx->setTextSize(1); gfx->setTextColor(COL_WHITE);
            gfx->setCursor(SAFE_M, 120); gfx->print("Punten lagen te dicht bij");
            gfx->setCursor(SAFE_M, 134); gfx->print("elkaar. Probeer opnieuw.");
          }
          delay(2000);
          state = TOUCHTEST; entered = false;
        }
      }
      if (bootTap()) { state = HOME; entered = false; }
      delay(30);
    } break;

    case ARMED:
      if (!entered) { screenArmed(); entered = true; }
      if (readBaro(alt, pres, temp)) { curAlt = alt; if (alt > maxAlt) maxAlt = alt; }
      if (curAlt > LAUNCH_RISE_M) {              // lancering
        logFile = LittleFS.open(LOGPATH, "a");
        tStart = millis(); lastSample = micros(); maxAlt = curAlt; samples = 0;
        beep(60); state = LOGGING; entered = false; break;
      }
      if (getTap(gx, gy) && hit(BTN_CANCEL, gx, gy)) { state = HOME; entered = false; }
      delay(20);
      break;

    case LOGGING:
      if (!entered) { screenLogging(); entered = true; }
      if (micros() - lastSample >= SAMPLE_US) {
        lastSample += SAMPLE_US;
        if (readBaro(alt, pres, temp)) curAlt = alt;
        readImu();
        uint32_t t = millis() - tStart;
        logFile.printf("%lu,%.2f,%.2f,%.1f,%.2f,%.2f,%.2f\n", t, curAlt, pres, temp, ax, ay, az);
        samples++;
        if (curAlt > maxAlt) maxAlt = curAlt;
        if (curAlt < LAND_ALT_M && maxAlt > LAUNCH_RISE_M) landCount++; else landCount = 0;
        bool landed  = landCount > (LAND_WINDOW_S * SAMPLE_HZ);
        bool timeout = (millis() - tStart) > (MAX_LOG_S * 1000UL);
        if (landed || timeout) {
          logFile.close(); flightMs = millis() - tStart; haveFlight = true;
          beep(200); state = RESULT; entered = false; break;
        }
        if (++uiCount >= 10) { uiCount = 0; liveLogging(); }   // scherm ~5 Hz, log 50 Hz
      }
      break;

    case RESULT:
      if (!entered) { screenResult(); entered = true; }
      if (getTap(gx, gy)) {
        if (hit(BTN_SEND, gx, gy)) { startAP(); state = SENDING; entered = false; }
        else if (hit(BTN_NEW, gx, gy)) { state = HOME; entered = false; }
      }
      delay(30);
      break;

    case SENDING:
      if (!entered) { screenSending(); entered = true; }
      server.handleClient();
      if (getTap(gx, gy) && hit(BTN_BACK, gx, gy)) { state = RESULT; entered = false; }
      break;
  }
}
