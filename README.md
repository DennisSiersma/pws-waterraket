# PWS Waterraket

Profielwerkstuk natuurkunde (vwo): welke factoren bepalen de prestatie
(apogeumhoogte) van een waterraket? Met testplan, lanceerinstallatie,
meet-logsheets en een zelfgebouwde vluchtcomputer.

## Gekozen hardware (route B)

Vluchtcomputer: **Waveshare ESP32-S3-Touch-LCD-1.69** met een losse druksensor.
De eerdere XIAO-opzet is niet gekozen; die bestanden blijven staan als alternatief
en ter verantwoording van de keuze, maar worden niet onderhouden.

| Functie | Onderdeel | Adres |
|---|---|---|
| Microcontroller + scherm + touch | Waveshare ESP32-S3-Touch-LCD-1.69 | touch 0x15 |
| Versnelling (stuwprofiel) | QMI8658, onboard | 0x6B |
| Hoogte (apogeum) | BMP388 **of** BME680, los bijgeprikt | 0x76 / 0x77 |
| Voeding | 3,7 V LiPo met MX1.25-stekker | - |

De firmware herkent bij het opstarten zelf welke druksensor er zit en stelt zich
daarop in. De BMP388 is de betere keuze voor de vluchten; de BME680 werkt ook maar
is trager.

> **Bouw je dit na? Lees eerst [`docs/HANDLEIDING.md`](docs/HANDLEIDING.md).**
> Daarin staan de valkuilen die ons tijd hebben gekost: de CS/CSB-jumper op de
> sensor, de juiste USB-poort bij het flashen, de PWR-knop voor accuvoeding, en de
> koppeling tussen oversampling en meetfrequentie.

## Inhoud

```
docs/
  HANDLEIDING.md                                       Bouw, gebruik en probleemoplossing
  PWS_Waterraket_Onderzoeksplan.docx                   Onderzoeksplan (theorie, testplan, BOM)
  PWS_Waterraket_Lanceerinstallatie.docx               Launcher: tekening, onderdelen, bronnen
  PWS_Waterraket_Bouwtekening_Launcher_Clark.svg       Detailtekening launcher
  PWS_Waterraket_Bouwtekening_Lanceerinstallatie.svg   Overzichtstekening launcher
  PWS_Waterraket_Bedradingsschema_S3-Touch.svg         Bedrading van de gekozen opstelling
  PWS_Waterraket_Bedradingsschema_XIAO.svg             (alternatief, niet gebruikt)
firmware/
  PWS_Waterraket_ESP32-S3-Touch_sketch.ino             <- deze gebruiken
  PWS_Waterraket_ESP32_sketch.ino                      (alternatief, niet gebruikt)
hardware/
  PWS_Waterraket_Houder.stl / .scad                    Payloadhouder (bord + sensor + accu)
logsheets/
  PWS_Waterraket_Logsheets.xlsx                        Vluchtlog + hoogte-/spreidingsberekening
```

## Bediening in het kort

| Scherm | BOOT kort | BOOT lang |
|---|---|---|
| HOME | INFO | START (kalibreren + scherp) |
| INFO | terug | raaktest |
| Raaktest | terug | ijken (>4 s: ijking wissen) |

Na de vlucht opent VERZEND een wifi-netwerk (`Waterraket` / `raket1234`) waarop je
de meting als CSV downloadt. Het INFO-scherm toont live druk, hoogte, temperatuur
en versnelling, zodat je kunt testen zonder te lanceren.

## Meetmethode

Primair: barometrische apogeumhoogte, gevalideerd met de trigonometrische
grondmeting (hoek + afstand). De QMI8658 geeft het versnellings- en stuwprofiel.

## Veiligheid

Alleen frisdrank-PET-flessen; begin laag (3-4 bar), nooit boven ~7 bar; minimaal
10 m afstand, lanceren via een touw, veiligheidsbril. 3D-geprinte drukdelen eerst
vol water achter een afscherming testen. LiPo's alleen onder toezicht laden en de
polariteit controleren vóór het insteken.

## Bronnen

De volledige bronnenlijst staat in het hoofdstuk "Bronnen" van het onderzoeksplan.
