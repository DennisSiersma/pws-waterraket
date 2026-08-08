# PWS Waterraket

Profielwerkstuk natuurkunde (vwo) over de **waterraket**: welke factoren bepalen de prestatie (apogeumhoogte), met een strak testplan, een lanceerinstallatie, meet-logsheets en een in-flight datalogger op een ESP32.

## Gekozen hardware

De vluchtcomputer is de **Waveshare ESP32-S3-Touch-LCD-1.69** met een losse **BMP388** barometer. Dat is de route die daadwerkelijk gebouwd wordt.

| Onderdeel | Keuze | Toelichting |
|---|---|---|
| Microcontroller | Waveshare ESP32-S3-Touch-LCD-1.69 | ESP32-S3R8, 8MB PSRAM, 16MB flash |
| Scherm + bediening | 240x280 LCD met touch (onboard) | HOME / vlucht / resultaat via touch-UI |
| Hoogte | **BMP388** (los bijgeprikt op I2C) | het bord heeft zelf geen barometer |
| Versnelling | QMI8658 6-assig (onboard) | klipt bij +/-16 g tijdens de stuwfase |
| Voeding | 3,7V LiPo met **MX1.25**-stekker | laden via USB-C (ETA6098 onboard) |

> **Accu:** controleer de polariteit tegen de markering op het bord **voordat** je insteekt; omgekeerd kan het bord beschadigen. Het bord start niet vanzelf op de accu: sluit de accu aan, druk op de **PWR-knop**, daarna houdt de SYS_EN-latch in de firmware de voeding vast. Zet `BOARD_NEW` in de sketch goed (nieuw bord = bordmodel op de print gedrukt).

De eerdere **XIAO ESP32-S3 + BMP280**-opzet is *niet* gekozen. De bestanden daarvan blijven in de repo staan als lichter alternatief en ter verantwoording van de keuze, maar worden niet onderhouden.

## Inhoud

```
docs/
  PWS_Waterraket_Onderzoeksplan.docx                   Onderzoeksplan (theorie, testplan, BOM, bijlagen)
  PWS_Waterraket_Lanceerinstallatie.docx               Lanceerinstallatie: bouwtekening + onderdelenlijst + bronnen
  PWS_Waterraket_Bouwtekening_Launcher_Clark.svg       Detailtekening launcher (Clark cable-tie / Gardena, manometer + aftapventiel)
  PWS_Waterraket_Bouwtekening_Lanceerinstallatie.svg   Overzichtstekening lanceerinstallatie
  PWS_Waterraket_Bedradingsschema_S3-Touch.svg         Bedrading van de gekozen opstelling (BMP388 op I2C)
  PWS_Waterraket_Bedradingsschema_XIAO.svg             (alternatief, niet gebruikt) XIAO ESP32-S3 + BMP280
logsheets/
  PWS_Waterraket_Logsheets.xlsx                        Vluchtlog + automatische hoogte-/spreidingsberekening
firmware/
  PWS_Waterraket_ESP32-S3-Touch_sketch.ino            <- DEZE gebruiken: Waveshare + BMP388 + QMI8658 + touch-UI
  PWS_Waterraket_ESP32_sketch.ino                     (alternatief, niet gebruikt) XIAO ESP32-S3 + BMP280
hardware/
  PWS_Waterraket_Houder.stl                            3D-printbare payloadhouder (bord + BMP388 + accu)
  PWS_Waterraket_Houder.scad                           parametrisch bronbestand (maten bovenin aanpassen)
```

## Bedrading

Alleen de BMP388 wordt bijgeprikt; IMU, touch en accu-laden zitten al op het bord.

| BMP388 | Bord (randpad) |
|---|---|
| VCC | 3V3 (**niet** 5V) |
| GND | G |
| SDA | SDA (GPIO11) |
| SCL | SCL (GPIO10) |

Op de BMP388-module zelf: **CSB naar VCC** (dwingt I2C af) en **SDO naar GND of VCC** (adres 0x76 resp. 0x77, laat hem niet zweven).

## Firmware

Toestandsmachine: kalibreren -> lancering detecteren -> 50 Hz loggen naar intern flash (LittleFS) -> apogeum bepalen -> landing -> wifi-accesspoint openen om de data als CSV te downloaden. Live hoogte en apogeum verschijnen op het LCD; de BOOT-knop werkt altijd als START-fallback.

Benodigde libraries: **GFX Library for Arduino**, **SensorLib**, **Adafruit BMP3XX** (+ Unified Sensor + BusIO).
Board-instellingen: `ESP32S3 Dev Module`, PSRAM `OPI PSRAM`, `USB CDC On Boot: Enabled`, flash 16MB.
Upload lukt niet? Houd **BOOT** ingedrukt, tik **RST** aan, laat BOOT los (downloadmodus).

## Meetmethode

Primair: barometrische apogeumhoogte (BMP388), gevalideerd met de trigonometrische grondmeting (hoek + afstand). De QMI8658 geeft het versnellings- en stuwprofiel.

## Veiligheid

Alleen frisdrank-PET-flessen; begin laag (3-4 bar), niet boven ~7 bar; >= 10 m afstand, lanceren via een touw, veiligheidsbril; 3D-geprinte drukdelen eerst vol water achter een afscherming testen. LiPo's alleen onder toezicht laden.

## Bronnen

Volledige, gecategoriseerde bronnenlijst met URL's staat in het hoofdstuk "Bronnen" van het onderzoeksplan (`docs/...Onderzoeksplan.docx`).
