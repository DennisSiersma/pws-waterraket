# Handleiding vluchtcomputer waterraket

Praktische bouw-, gebruik- en probleemoplossingsgids voor de vluchtcomputer.
Alle hier genoemde instellingen staan bovenin `firmware/PWS_Waterraket_ESP32-S3-Touch_sketch.ino`.

## 1. Hardware

| Onderdeel | Keuze | Opmerking |
|---|---|---|
| Microcontroller | Waveshare ESP32-S3-Touch-LCD-1.69 | ESP32-S3R8, 240x280 LCD, CST816 touch |
| Versnelling | QMI8658 (onboard, 0x6B) | klipt bij +/-16 g tijdens de stuwfase |
| Hoogte | BMP388 (0x76/0x77) **of** BME680 | firmware herkent beide automatisch |
| Voeding | 3,7 V LiPo, MX1.25-stekker | laden via USB-C |

De BMP388 is de betere keuze voor de vluchten (sneller, lagere ruis, gemaakt voor
hoogtemeting). De BME680 werkt ook, maar is trager omdat hij meer grootheden meet.

## 2. Solderen

Slechts vier draden tussen sensor en bord; de rest zit al op het bord.

| Sensor | Bord (randpad) |
|---|---|
| VCC | 3V3 (**niet** 5V) |
| GND | G |
| SDA | SDA (GPIO11) |
| SCL | SCL (GPIO10) |

Twee jumpers op de sensormodule zelf, en die zijn niet optioneel:

- **CSB (BMP388) / CS (BME680) naar VCC** - dwingt I2C af. Zwevend laten betekent
  dat de chip in SPI-modus blijft: hij geeft dan wel een acknowledge op de bus,
  maar levert alleen nullen (chip-ID 0x00). Dit heeft ons een sensor gekost die we
  ten onrechte voor defect hielden.
- **SDO naar GND (adres 0x76) of naar VCC (0x77)** - niet laten zweven.

Trek-ontlasting: een druppel hete lijm of een tiewrap over de draadbundel bij het
bord. Soldeerverbindingen op castellated pads breken anders bij de lanceerklap.

## 3. Flashen

Arduino IDE, board `ESP32S3 Dev Module`, PSRAM `OPI PSRAM`, `USB CDC On Boot:
Enabled`, flash 16MB.

Libraries: GFX Library for Arduino, SensorLib, Adafruit BMP3XX, Adafruit BME680
(+ Adafruit Unified Sensor en BusIO).

**Kies de juiste poort.** Dit bord heeft geen USB-serieel-chip: USB-C gaat
rechtstreeks naar de native USB van de ESP32-S3. Het meldt zich daarom als
*USB JTAG/serial debug unit*, bij ons `/dev/cu.usbmodem101`. Hangt er nog een
ander bord aan de Mac (met CH340/CH9102), dan verschijnt dat als *USB Single
Serial* en gaat de upload dáárheen: de upload slaagt, maar je raket-bord blijft
zijn oude firmware draaien. Bij twijfel het andere bord loskoppelen.

Blijft "Hard resetting via RTS pin..." staan: dat is normaal bij native USB (er is
geen RTS-lijn). Lukt de upload niet, houd dan **BOOT** ingedrukt, tik **RST** aan,
laat BOOT los.

## 4. Bediening

Bij het opstarten verschijnt kort een blauw **BOOT OK**-scherm met het
compileertijdstip. Zo weet je zeker dat de nieuwe firmware draait.

| Scherm | Touch | BOOT kort | BOOT lang (>1,2 s) |
|---|---|---|---|
| HOME | START / INFO | INFO | START (kalibreren + scherp) |
| INFO | TERUG | terug | raaktest |
| Raaktest | kruisje tekenen | terug | ijken (>4 s: ijking wissen) |

Vluchtverloop: START kalibreert (50 drukmetingen op de grond) en gaat naar GEREED.
Stijgt de hoogte boven 3 m, dan begint het loggen op 50 Hz naar intern flash.
Na de landing (of na 30 s) volgt het RESULTAAT-scherm met apogeum, maximale
versnelling en vluchttijd. Via VERZEND opent het bord een wifi-netwerk
(`Waterraket` / `raket1234`); daarop het getoonde IP-adres openen geeft de CSV.

## 5. Accu

Het bord start **niet** vanzelf op de accu. Sluit de accu aan en druk op de
**PWR-knop**; daarna houdt de firmware de voeding vast via SYS_EN (GPIO35 volgens
het schema; met `BOARD_ALT 1` schakel je naar GPIO41). Controleer de polariteit van
de MX1.25-stekker tegen de markering op het bord vóór het insteken.

## 6. Scherm en touch

- Het glas heeft **afgeronde hoeken**: houd tekst en knoppen binnen `SAFE_M` (22 px).
- `LCD_OFFY` hoort **20** te zijn. Met 0 loopt de titel van het scherm.
- De touch rapporteert y ongeveer **22 px hoger** dan waar je tikt. Dat is een vaste
  verschuiving en staat als standaard in de code (`calBy = -22`), geen schaalfout.
- De touch komt niet hoger dan ruw y=278, dus de onderste ~24 px zijn onbereikbaar.
  Alle knoppen staan daarom boven die grens.

## 7. Instellingen die bij elkaar moeten passen

Oversampling en meetfrequentie van de druksensor zijn gekoppeld. 8x oversampling
kost ongeveer 27 ms per meting en haalt 50 Hz (20 ms) niet: de sensor geeft dan een
configuratiefout en levert géén metingen. Daarom staat de druk op 4x en de
temperatuur op 1x.

## 8. Meetkundige aandachtspunten

- De hoogte op het INFO-scherm is gerekend tegen de standaarddruk van 1013,25 hPa
  en is dus **geen** hoogte boven de grond. Pas na kalibreren (START) is de hoogte
  relatief ten opzichte van het lanceerpunt.
- Kalibreer **vlak voor elke lancering**: de luchtdruk verandert gedurende de dag.
- Boor een klein **statisch gat** in de neuskegel ter hoogte van de sensor, zodat hij
  de omgevingsdruk meet en niet de dynamische druk van de luchtstroom.
- De versnellingsmeter klipt bij 16 g. Voor het apogeum maakt dat niet uit (daar is
  v ongeveer 0); voor het stuwprofiel is het een bekende beperking.

## 9. Payloadhouder (3D-print)

`hardware/PWS_Waterraket_Houder.stl` is direct te slicen. Print met de bodem op
het bed; supports zijn niet nodig. PETG is voor buitengebruik beter dan PLA.

Het sensorvak is bewust ruim (17 x 23 x 7,5 mm) zodat zowel de BMP388 als de
BME680 erin past; zet de module vast met schuim of dubbelzijdige tape. Een
barometer hoeft niet strak te klemmen, hij moet juist lucht kunnen zien - daarom
zitten er twee ventilatieopeningen in dat vak.

Maten aanpassen (bijvoorbeeld na het meten van je eigen bord of accu): pas de
waarden bovenin `hardware/genereer_houder.py` aan en draai:

```
python3 -m venv .venv
./.venv/bin/pip install trimesh manifold3d numpy
./.venv/bin/python hardware/genereer_houder.py
```

De bordmaat (38 x 38 mm) is een schatting: Waveshare publiceert de maatschets
alleen als afbeelding. Er zit 0,8 mm speling omheen, maar meet het na als het
bord te los of te strak zit.
