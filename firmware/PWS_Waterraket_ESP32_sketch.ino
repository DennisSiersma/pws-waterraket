/*
  Waterraket-vluchtcomputer  -  PWS natuurkunde
  --------------------------------------------------------------
  Board    : Seeed XIAO ESP32-S3   (Arduino-ESP32 core)
  Sensoren : BMP280 barometer (niveau 1)
             + optioneel MPU6050 IMU (niveau 2, zet USE_IMU op 1)
  Werking  : 1) kalibreren op de grond (nuldruk bepalen)
             2) lancering detecteren (hoogte stijgt boven drempel)
             3) loggen op 50 Hz naar intern flashgeheugen (LittleFS)
             4) apogeum bepalen (hoogste gemeten hoogte)
             5) landing detecteren (laag + stabiel) of time-out
             6) wifi-accesspoint openen -> data als CSV downloaden

  Libraries (Arduino IDE -> Tools -> Bibliotheken beheren):
    - Adafruit BMP280 Library
    - Adafruit Unified Sensor
    - Adafruit MPU6050        (alleen bij niveau 2)
  De ESP32-, WiFi-, WebServer- en LittleFS-onderdelen zitten in de
  Arduino-ESP32 board-package.
*/

#include <Wire.h>
#include <Adafruit_BMP280.h>
#include <LittleFS.h>
#include <WiFi.h>
#include <WebServer.h>

// ----------------------- instellingen -----------------------
#define USE_IMU        0       // 0 = niveau 1 (alleen barometer), 1 = niveau 2 (+ MPU6050)
#define SAMPLE_HZ      50      // logfrequentie (Hz)
#define LAUNCH_RISE_M  3.0     // hoogtestijging (m) die een lancering aanduidt
#define LAND_ALT_M     2.0     // hoogte (m) waaronder de raket 'laag' is
#define LAND_WINDOW_S  3       // stabiele periode (s) die een landing aanduidt
#define MAX_LOG_S      30      // veiligheidslimiet: maximale logduur (s)

const char* AP_SSID = "Waterraket";   // naam wifi-netwerk na de vlucht
const char* AP_PASS = "raket1234";    // wachtwoord (minimaal 8 tekens)

const char* LOGPATH  = "/flight.csv";
const uint32_t SAMPLE_US = 1000000UL / SAMPLE_HZ;

// ----------------------- objecten -----------------------
Adafruit_BMP280 bmp;
#if USE_IMU
  #include <Adafruit_MPU6050.h>
  Adafruit_MPU6050 mpu;
#endif
WebServer server(80);
File logf;

// ----------------------- toestand -----------------------
enum State { ARMED, LOGGING, LANDED };
State state = ARMED;

float p0      = 1013.25;  // basisdruk op de grond (hPa), in calibrate() bepaald
float maxAlt  = 0;        // hoogste gemeten hoogte = apogeum (m)
uint32_t tStart    = 0;   // starttijd van de logging (ms)
uint32_t lastSample = 0;  // micros van de laatste sample
int landCount = 0;        // teller voor landingsdetectie

// hoogte t.o.v. de grond, uit de barometrische formule
float relAltitude(float pres_hPa) {
  return 44330.0 * (1.0 - pow(pres_hPa / p0, 0.1903));
}

// XIAO-LED is actief-laag: 0 = uit, 1 = aan
void led(int on) { digitalWrite(LED_BUILTIN, on ? LOW : HIGH); }

void calibrate() {
  float sum = 0;
  for (int i = 0; i < 50; i++) { sum += bmp.readPressure() / 100.0; delay(20); }
  p0 = sum / 50.0;        // gemiddelde gronddruk over ~1 s
  maxAlt = 0;
  // logbestand (her)aanmaken met kolomkoppen
  logf = LittleFS.open(LOGPATH, "w");
#if USE_IMU
  logf.println("t_ms,hoogte_m,druk_hPa,temp_C,ax_ms2,ay_ms2,az_ms2");
#else
  logf.println("t_ms,hoogte_m,druk_hPa,temp_C");
#endif
  logf.close();
}

void startAP() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  server.on("/", []() {
    String h = "<h2>Waterraket - vluchtdata</h2>";
    h += "<p>Apogeum: " + String(maxAlt, 1) + " m</p>";
    h += "<p><a href='/flight.csv'>Download CSV</a></p>";
    server.send(200, "text/html", h);
  });
  server.on("/flight.csv", []() {
    File f = LittleFS.open(LOGPATH, "r");
    server.streamFile(f, "text/csv");
    f.close();
  });
  server.begin();
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Wire.begin();                 // XIAO ESP32-S3: SDA = D4, SCL = D5
  LittleFS.begin(true);

  if (!bmp.begin(0x76)) bmp.begin(0x77);   // BMP280 op adres 0x76 of 0x77
  bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                  Adafruit_BMP280::SAMPLING_X2,
                  Adafruit_BMP280::SAMPLING_X16,
                  Adafruit_BMP280::FILTER_X4,
                  Adafruit_BMP280::STANDBY_MS_1);
#if USE_IMU
  mpu.begin();                              // MPU6050 op adres 0x68
  mpu.setAccelerometerRange(MPU6050_RANGE_16_G);
#endif

  calibrate();                  // bepaal nuldruk -> klaar om te lanceren (ARMED)
}

void loop() {
  switch (state) {

    case ARMED: {                                   // wachten op lancering
      float alt = relAltitude(bmp.readPressure() / 100.0);
      if (alt > LAUNCH_RISE_M) {
        logf = LittleFS.open(LOGPATH, "a");
        tStart = millis();
        lastSample = micros();
        maxAlt = alt;
        state = LOGGING;
      }
      led((millis() / 500) % 2);                    // langzaam knipperen = gereed
    } break;

    case LOGGING: {                                 // op vaste frequentie loggen
      if (micros() - lastSample >= SAMPLE_US) {
        lastSample += SAMPLE_US;
        float pres = bmp.readPressure() / 100.0;
        float alt  = relAltitude(pres);
        float temp = bmp.readTemperature();
        uint32_t t = millis() - tStart;
#if USE_IMU
        sensors_event_t a, g, te;
        mpu.getEvent(&a, &g, &te);
        logf.printf("%lu,%.2f,%.2f,%.1f,%.2f,%.2f,%.2f\n",
                    t, alt, pres, temp,
                    a.acceleration.x, a.acceleration.y, a.acceleration.z);
#else
        logf.printf("%lu,%.2f,%.2f,%.1f\n", t, alt, pres, temp);
#endif
        if (alt > maxAlt) maxAlt = alt;             // apogeum bijhouden

        // landingsdetectie: laag en stabiel gedurende LAND_WINDOW_S
        if (alt < LAND_ALT_M && maxAlt > LAUNCH_RISE_M) landCount++;
        else landCount = 0;
        bool landed  = landCount > (LAND_WINDOW_S * SAMPLE_HZ);
        bool timeout = (millis() - tStart) > (MAX_LOG_S * 1000UL);

        if (landed || timeout) {
          logf.close();
          startAP();
          state = LANDED;
        }
        led(1);                                     // continu aan = aan het loggen
      }
    } break;

    case LANDED:                                    // AP actief, data downloadbaar
      server.handleClient();
      led((millis() / 150) % 2);                    // snel knipperen = klaar
      break;
  }
}
