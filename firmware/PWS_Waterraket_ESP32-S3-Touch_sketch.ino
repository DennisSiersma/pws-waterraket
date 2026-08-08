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
#define LCD_OFFY     20

// --- buzzer (optioneel; pin verifiëren) ---
#define USE_BUZZER   0
#define BUZZER_PIN   33

// --- fysieke knop als START-fallback ---
#define BOOT_BTN     0

// --- voedingslatch accu ---
// Het bord start NIET vanzelf op de accu: de PWR-knop geeft de accuvoeding
// kortstondig vrij, daarna moet de firmware SYS_EN hoog houden. Zonder deze
// latch valt de voeding weg zodra je PWR loslaat (op USB merk je hier niets van).
// Volgens het officiele schema van dit bord: SYS_EN = GPIO35, SYS_OUT = GPIO36.
// Werkt de accuvoeding niet, probeer dan BOARD_ALT 1 (SYS_EN 41 / SYS_OUT 40).
#define BOARD_ALT    0
#if BOARD_ALT
  #define SYS_EN     41
  #define SYS_OUT    40
#else
  #define SYS_EN     35
  #define SYS_OUT    36
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
SensorQMI8658   qmi;
TouchDrvCSTXXX  touch;
WebServer       server(80);
File            logFile;
bool touchOK = false;

Arduino_DataBus *bus = new Arduino_ESP32SPI(LCD_DC, LCD_CS, LCD_SCLK, LCD_MOSI, LCD_MISO);
Arduino_GFX *gfx = new Arduino_ST7789(bus, LCD_RST, 0, true, LCD_W, LCD_H,
                                      LCD_OFFX, LCD_OFFY, LCD_OFFX, LCD_OFFY);

// ====================== TOESTAND ======================
enum State { HOME, ARMED, LOGGING, RESULT, SENDING };
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

// ====================== KNOPPEN ======================
struct Btn { int x, y, w, h; const char* label; uint16_t col; };
Btn BTN_START  = { 30, 206, 180, 58, "START",   COL_GREEN };
Btn BTN_CANCEL = { 30, 206, 180, 58, "ANNULEER", COL_DARKGREY };
Btn BTN_SEND   = { 16, 206, 100, 58, "VERZEND", COL_BLUE };
Btn BTN_NEW    = { 124, 206, 100, 58, "NIEUW",  COL_DARKGREY };
Btn BTN_BACK   = { 30, 206, 180, 58, "TERUG",   COL_DARKGREY };

void drawBtn(Btn b) {
  gfx->fillRoundRect(b.x, b.y, b.w, b.h, 10, b.col);
  gfx->setTextColor(b.col == COL_DARKGREY ? COL_WHITE : COL_BLACK);
  int sz = 3;
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
float relAltitude(float pres_hPa) { return 44330.0 * (1.0 - pow(pres_hPa / p0, 0.1903)); }

bool readBaro(float &alt, float &pres, float &temp) {
  if (!bmp.performReading()) return false;
  pres = bmp.pressure / 100.0; temp = bmp.temperature; alt = relAltitude(pres);
  return true;
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
void title(const char* t, uint16_t col) {
  gfx->setTextColor(col); gfx->setTextSize(3); gfx->setCursor(14, 14); gfx->print(t);
}
void stat(const char* label, String val, int y, uint16_t col) {
  gfx->setTextColor(COL_WHITE); gfx->setTextSize(2); gfx->setCursor(14, y); gfx->print(label);
  gfx->setTextColor(col); gfx->setTextSize(3); gfx->setCursor(14, y + 22); gfx->print(val);
}
String mORdash(float v) { return haveFlight ? String(v, 1) : String("--"); }

void screenHome() {
  gfx->fillScreen(COL_BLACK);
  title("WATERRAKET", COL_CYAN);
  gfx->setTextColor(COL_WHITE); gfx->setTextSize(2); gfx->setCursor(14, 52); gfx->print("Laatste vlucht:");
  stat("Apogeum (m)", mORdash(maxAlt), 80, COL_YELLOW);
  stat("Max versn. (g)", mORdash(maxG), 130, COL_ORANGE);
  drawBtn(BTN_START);
}
void screenArmed() {
  gfx->fillScreen(COL_BLACK);
  title("GEREED", COL_GREEN);
  gfx->setTextColor(COL_WHITE); gfx->setTextSize(2); gfx->setCursor(14, 60); gfx->print("Wacht op lancering");
  drawBtn(BTN_CANCEL);
}
void screenLogging() {
  gfx->fillScreen(COL_BLACK);
  title("VLUCHT", COL_ORANGE);
  gfx->setTextColor(COL_WHITE); gfx->setTextSize(2); gfx->setCursor(14, 70); gfx->print("Hoogte (m)");
  gfx->setTextColor(COL_WHITE); gfx->setTextSize(2); gfx->setCursor(14, 150); gfx->print("Versn. (g)");
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
  gfx->setCursor(14, 56);  gfx->print("WiFi-netwerk:");
  gfx->setTextColor(COL_GREEN); gfx->setCursor(14, 78); gfx->print(AP_SSID);
  gfx->setTextColor(COL_WHITE); gfx->setCursor(14, 104); gfx->print("Wachtwoord:");
  gfx->setTextColor(COL_GREEN); gfx->setCursor(14, 126); gfx->print(AP_PASS);
  gfx->setTextColor(COL_WHITE); gfx->setCursor(14, 152); gfx->print("Open in browser:");
  gfx->setTextColor(COL_CYAN);  gfx->setCursor(14, 174); gfx->print(WiFi.softAPIP().toString());
  drawBtn(BTN_BACK);
}
// dynamische waarden bijwerken (alleen het getalvlak overtekenen)
void liveLogging() {
  gfx->fillRect(14, 96, 224, 40, COL_BLACK);
  gfx->setTextColor(COL_CYAN); gfx->setTextSize(4); gfx->setCursor(14, 100); gfx->print(curAlt, 1);
  gfx->fillRect(14, 176, 224, 40, COL_BLACK);
  gfx->setTextColor(COL_ORANGE); gfx->setTextSize(4); gfx->setCursor(14, 176); gfx->print(curG, 1);
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
  gfx->setCursor(10, 40); gfx->print("BOOT OK");
  gfx->setCursor(10, 70); gfx->print(__TIME__);
  delay(1200);
  gfx->fillScreen(COL_BLACK);

  Wire.begin(I2C_SDA, I2C_SCL);
  LittleFS.begin(true);

  // I2C-scan: welke chips reageren er echt?
  Serial.print("I2C gevonden:");
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) { Serial.print(" 0x"); Serial.print(a, HEX); }
  }
  Serial.println("  (verwacht: 0x15 touch, 0x6B IMU, 0x76 of 0x77 BMP388)");

  if (!bmp.begin_I2C(BMP_ADDR, &Wire)) bmp.begin_I2C(0x76, &Wire);
  bmp.setPressureOversampling(BMP3_OVERSAMPLING_8X);
  bmp.setTemperatureOversampling(BMP3_OVERSAMPLING_2X);
  bmp.setIIRFilterCoeff(BMP3_IIR_FILTER_COEFF_3);
  bmp.setOutputDataRate(BMP3_ODR_50_HZ);

  qmi.begin(Wire, QMI8658_L_SLAVE_ADDRESS, I2C_SDA, I2C_SCL);
  qmi.configAccelerometer(SensorQMI8658::ACC_RANGE_16G,
                          SensorQMI8658::ACC_ODR_1000Hz,
                          SensorQMI8658::LPF_MODE_0);
  qmi.enableAccelerometer();

  touch.setPins(TP_RST, TP_INT);
  touchOK = touch.begin(Wire, CST816_SLAVE_ADDRESS, I2C_SDA, I2C_SCL);

  state = HOME; entered = false;
}

// ====================== LOOP ======================
void loop() {
  int gx = 0, gy = 0;
  float alt, pres, temp;

  switch (state) {

    case HOME:
      if (!entered) { screenHome(); entered = true; }
      if ((getTap(gx, gy) && hit(BTN_START, gx, gy)) || bootTap()) {
        title("KALIBREREN...", COL_WHITE);          // even feedback
        calibrate(); beep(80);
        state = ARMED; entered = false;
      }
      delay(30);
      break;

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
