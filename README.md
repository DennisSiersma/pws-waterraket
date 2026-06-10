# PWS Waterraket

Profielwerkstuk natuurkunde (vwo) over de **waterraket**: welke factoren bepalen de prestatie (apogeumhoogte), met een strak testplan, een lanceerinstallatie, meet-logsheets en een optionele in-flight datalogger op een ESP32.

## Inhoud

```
docs/
  PWS_Waterraket_Onderzoeksplan.docx                   Onderzoeksplan (theorie, testplan, BOM, bijlagen)
  PWS_Waterraket_Lanceerinstallatie.docx               Lanceerinstallatie: bouwtekening + onderdelenlijst + bronnen
  PWS_Waterraket_Bouwtekening_Launcher_Clark.svg       Detailtekening launcher (Clark cable-tie / Gardena, manometer + aftapventiel)
  PWS_Waterraket_Bouwtekening_Lanceerinstallatie.svg   Overzichtstekening lanceerinstallatie
  PWS_Waterraket_Bedradingsschema_S3-Touch.svg         Bedrading: ESP32-S3-Touch-LCD-1.69 + BMP388
  PWS_Waterraket_Bedradingsschema_XIAO.svg             Bedrading: XIAO ESP32-S3 + BMP280 (+ optioneel MPU6050)
logsheets/
  PWS_Waterraket_Logsheets.xlsx                        Vluchtlog + automatische hoogte-/spreidingsberekening
firmware/
  PWS_Waterraket_ESP32-S3-Touch_sketch.ino            Waveshare ESP32-S3-Touch-LCD-1.69 + BMP388 + QMI8658 + touch-UI
  PWS_Waterraket_ESP32_sketch.ino                     Lichte variant: XIAO ESP32-S3 + BMP280 (+ optioneel MPU6050)
```

## Hardware (twee routes)

**Route A — lichtste vliegende logger:** Seeed XIAO ESP32-S3 + BMP280 (barometer) + 1S LiPo.
**Route B — geïntegreerd met scherm:** Waveshare ESP32-S3-Touch-LCD-1.69 (onboard QMI8658 IMU + LCD) + losse **BMP388** (barometer, want het bord heeft er geen) + 1S LiPo met **MX1.25**-stekker.

> **Accu (belangrijk):** gebruik bij route B een 3,7 V LiPo met **MX1.25 (1,25 mm)** stekker. **Controleer de polariteit** tegen de markering op het bord vóór het insteken — omgekeerde polariteit kan het bord beschadigen. Klopt de +/- niet, wissel dan de crimpcontacten in de connector om. Laden gaat via USB-C.

## Firmware – kort

Toestandsmachine: kalibreren → lancering detecteren → 50 Hz loggen naar intern flash (LittleFS) → apogeum bepalen → landing → wifi-accesspoint openen om de data als CSV te downloaden. Bij route B verschijnt de live hoogte en het apogeum ook op het LCD.

Benodigde Arduino-libraries staan boven in elke `.ino`. Board: ESP32-S3 (PSRAM aan). Controleer de bord-specifieke pinnen met de Waveshare-wiki.

## Meetmethode

Primair: barometrische apogeumhoogte (BMP280/BMP388), gevalideerd met de trigonometrische grondmeting (hoek + afstand). De QMI8658/MPU6050 geeft de versnelling/stuwfase (let op: klipt bij ±16 g).

## Veiligheid

Alleen frisdrank-PET-flessen; begin laag (3–4 bar), niet boven ~7 bar; ≥ 5–10 m afstand, lanceren via een touw, veiligheidsbril; 3D-geprinte drukdelen eerst vol water achter een afscherming testen. LiPo's alleen onder toezicht laden.

## Bronnen

Volledige, gecategoriseerde bronnenlijst met URL's staat in hoofdstuk "Bronnen" van het onderzoeksplan (`docs/…Onderzoeksplan.docx`).
