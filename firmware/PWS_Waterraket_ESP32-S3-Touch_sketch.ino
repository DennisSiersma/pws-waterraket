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
*/

// ====================== CONFIG ======================
// --- I2C (BMP388 + onboard QMI8658 + CST816 touch delen deze bus) ---
#define I2C_SDA      11
#define I2C_SCL      10
#define BMP_ADDR     0x77      // BMP388: 0x77 of 0x76

// --- touch (CST816) ---
#define TP_RST       -1        // reset-pin (zet op juiste GPIO als touch niet reageert)
#define TP_INT       -1        // interrupt-pin (mag -1 = polling)
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
#include <TouchDrvCSTXXX.hpp>
#include <LittleFS.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Arduino_GFX_Library.h>

// ====================== OBJECTEN ======================
Adafruit_BMP3XX bmp;
SensorQMI8658   qmi;
TouchDrvCSTXXX  touch;
WebServer       server(80);
File            logf;
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
Btn BTN_START  = { 30, 206, 180, 58, "START",   GREEN };
Btn BTN_CANCEL = { 30, 206, 180, 58, "ANNULEER", DARKGREY };
Btn BTN_SEND   = { 16, 206, 100, 58, "VERZEND", BLUE };
Btn BTN_NEW    = { 124, 206, 100, 58, "NIEUW",  DARKGREY };
Btn BTN_BACK   = { 30, 206, 180, 58, "TERUG",   DARKGREY };

void drawBtn(Btn b) {
  gfx->fillRoundRect(b.x, b.y, b.w, b.h, 10, b.col);
  gfx->setTextColor(b.col == DARKGREY ? WHITE : BLACK);
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
  gfx->setTextColor(WHITE); gfx->setTextSize(2); gfx->setCursor(14, y); gfx->print(label);
  gfx->setTextColor(col); gfx->setTextSize(3); gfx->setCursor(14, y + 22); gfx->print(val);
}
String mORdash(float v) { return haveFlight ? String(v, 1) : String("--"); }

void screenHome() {
  gfx->fillScreen(BLACK);
  title("WATERRAKET", CYAN);
  gfx->setTextColor(WHITE); gfx->setTextSize(2); gfx->setCursor(14, 52); gfx->print("Laatste vlucht:");
  stat("Apogeum (m)", mORdash(maxAlt), 80, YELLOW);
  stat("Max versn. (g)", mORdash(maxG), 130, ORANGE);
  drawBtn(BTN_START);
}
void screenArmed() {
  gfx->fillScreen(BLACK);
  title("GEREED", GREEN);
  gfx->setTextColor(WHITE); gfx->setTextSize(2); gfx->setCursor(14, 60); gfx->print("Wacht op lancering");
  drawBtn(BTN_CANCEL);
}
void screenLogging() {
  gfx->fillScreen(BLACK);
  title("VLUCHT", ORANGE);
  gfx->setTextColor(WHITE); gfx->setTextSize(2); gfx->setCursor(14, 70); gfx->print("Hoogte (m)");
  gfx->setTextColor(WHITE); gfx->setTextSize(2); gfx->setCursor(14, 150); gfx->print("Versn. (g)");
}
void screenResult() {
  gfx->fillScreen(BLACK);
  title("RESULTAAT", MAGENTA);
  stat("Apogeum (m)", String(maxAlt, 1), 52, YELLOW);
  stat("Max versn. (g)", String(maxG, 1), 102, ORANGE);
  stat("Vluchttijd (s)", String(flightMs / 1000.0, 1), 152, CYAN);
  drawBtn(BTN_SEND); drawBtn(BTN_NEW);
}
void screenSending() {
  gfx->fillScreen(BLACK);
  title("VERZENDEN", BLUE);
  gfx->setTextColor(WHITE); gfx->setTextSize(2);
  gfx->setCursor(14, 56);  gfx->print("WiFi-netwerk:");
  gfx->setTextColor(GREEN); gfx->setCursor(14, 78); gfx->print(AP_SSID);
  gfx->setTextColor(WHITE); gfx->setCursor(14, 104); gfx->print("Wachtwoord:");
  gfx->setTextColor(GREEN); gfx->setCursor(14, 126); gfx->print(AP_PASS);
  gfx->setTextColor(WHITE); gfx->setCursor(14, 152); gfx->print("Open in browser:");
  gfx->setTextColor(CYAN);  gfx->setCursor(14, 174); gfx->print(WiFi.softAPIP().toString());
  drawBtn(BTN_BACK);
}
// dynamische waarden bijwerken (alleen het getalvlak overtekenen)
void liveLogging() {
  gfx->fillRect(14, 96, 224, 40, BLACK);
  gfx->setTextColor(CYAN); gfx->setTextSize(4); gfx->setCursor(14, 100); gfx->print(curAlt, 1);
  gfx->fillRect(14, 176, 224, 40, BLACK);
  gfx->setTextColor(ORANGE); gfx->setTextSize(4); gfx->setCursor(14, 176); gfx->print(curG, 1);
}

// ====================== LOGGING / AP ======================
void calibrate() {
  float sum = 0; int n = 0; float a, pr, t;
  for (int i = 0; i < 50; i++) { if (readBaro(a, pr, t)) { sum += pr; n++; } delay(20); }
  p0 = sum / max(n, 1);
  maxAlt = 0; maxG = 0; samples = 0; curAlt = 0; landCount = 0;
  logf = LittleFS.open(LOGPATH, "w");
  logf.println("t_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g");
  logf.close();
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
  pinMode(BOOT_BTN, INPUT_PULLUP);
#if USE_BUZZER
  pinMode(BUZZER_PIN, OUTPUT); digitalWrite(BUZZER_PIN, LOW);
#endif
  pinMode(LCD_BL, OUTPUT); digitalWrite(LCD_BL, HIGH);
  gfx->begin(); gfx->fillScreen(BLACK);

  Wire.begin(I2C_SDA, I2C_SCL);
  LittleFS.begin(true);

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
        title("KALIBREREN...", WHITE);          // even feedback
        calibrate(); beep(80);
        state = ARMED; entered = false;
      }
      delay(30);
      break;

    case ARMED:
      if (!entered) { screenArmed(); entered = true; }
      if (readBaro(alt, pres, temp)) { curAlt = alt; if (alt > maxAlt) maxAlt = alt; }
      if (curAlt > LAUNCH_RISE_M) {              // lancering
        logf = LittleFS.open(LOGPATH, "a");
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
        logf.printf("%lu,%.2f,%.2f,%.1f,%.2f,%.2f,%.2f\n", t, curAlt, pres, temp, ax, ay, az);
        samples++;
        if (curAlt > maxAlt) maxAlt = curAlt;
        if (curAlt < LAND_ALT_M && maxAlt > LAUNCH_RISE_M) landCount++; else landCount = 0;
        bool landed  = landCount > (LAND_WINDOW_S * SAMPLE_HZ);
        bool timeout = (millis() - tStart) > (MAX_LOG_S * 1000UL);
        if (landed || timeout) {
          logf.close(); flightMs = millis() - tStart; haveFlight = true;
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
