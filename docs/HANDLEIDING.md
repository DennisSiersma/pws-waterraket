# Handleiding vluchtcomputer waterraket

Praktische bouw-, gebruik- en probleemoplossingsgids voor de vluchtcomputer.
Alle hier genoemde instellingen staan bovenin `firmware/PWS_Waterraket_ESP32-S3-Touch_sketch.ino`.

## 1. Hardware

| Onderdeel | Keuze | Opmerking |
|---|---|---|
| Microcontroller | Waveshare ESP32-S3-Touch-LCD-1.69 | ESP32-S3R8, 240x280 LCD, CST816 touch |
| Versnelling | QMI8658 (onboard, 0x6B) | klipt bij +/-16 g tijdens de stuwfase |
| Hoogte | BMP388, BMP390(L) of BME680 (0x76/0x77) | firmware herkent ze automatisch |
| Voeding | 3,7 V LiPo, MX1.25-stekker | laden via USB-C |
| Fles | Fernandes Cherry Bouquet 1,5 L | volledig cilindrisch, diameter 88,5 mm |

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

Maten volgens de officiele maatschets van Waveshare:

| Maat | Waarde |
|---|---|
| Buitenmaat module (incl. zwarte rand) | 41,13 x 33,13 mm |
| Kale print | 38,48 x 31,07 mm |
| Totale dikte | 6,60 mm (scherm 3,82 +/- 0,2) |
| Schermglas | 32,63 x 27,97 mm |

De zwarte rand steekt ongeveer 1,3 mm per zijde buiten de print uit; die
buitenmaat bepaalt de pasvorm. De clips pakken 2 mm over die rand, ruim binnen
de ~4,2 mm brede rand, dus ze komen niet op het glas.

## 10. Keuze van de lanceerinstallatie

Gebouwd wordt de **split-collar cable-tie launcher**: kabelbinders rondom de
flessenhals, gehouden door een kraag die in twee helften is gezaagd en met een
zelfklemtang wordt dichtgehouden. Het trekkoord zit aan het ontgrendellipje van
die tang.

Waarom niet de twee bekendere varianten:

- **Gardena-koppeling**: beperkt de nozzlediameter (ook met een 3D-geprinte
  nozzle niet boven ~9 mm), is lastig te combineren met een launch tube en de
  plastic koppelingen zijn niet gemaakt voor hoge druk. Omdat nozzlediameter een
  van de onderzoeksvariabelen is, valt deze af.
- **Klassieke Clark met schuifkraag**: goed principe, maar de kracht om te
  ontgrendelen loopt op met de flesdruk. Bij hogere druk kan het trekkoord breken
  of de installatie kantelen, en dat verandert de lanceerhoek per meting. Precies
  de spreiding die je in een meetreeks niet wilt.

Bij de gedeelde kraag klap je hem open in plaats van hem tegen de wrijving in weg
te schuiven, dus de benodigde kracht is nagenoeg onafhankelijk van de druk.

Let op voor het verslag: de **launch tube** is zelf een variabele. Hij geeft extra
hoogte en meer consistentie, maar alleen als je lengte en diameter over alle
metingen gelijk houdt. Noteer ze.

## 11. Druksensor: welke past?

De firmware leest bij het opstarten het chip-ID uit en stelt zichzelf in:

| Chip-ID | Sensor | Register |
|---|---|---|
| 0x50 | BMP388 | 0x00 |
| 0x60 | BMP390 / BMP390L (o.a. DFRobot) | 0x00 |
| 0x61 | BME680 | 0xD0 |

BMP388 en BMP390 delen dezelfde library (Adafruit BMP3XX) en dezelfde aansturing;
de DFRobot-library is niet nodig. De BMP390L is de industriele opvolger van de
BMP388: betere temperatuurstabiliteit, lagere drift en minder ruis, dus voor
apogeummeting de beste van de drie.

Aansluiten is voor alle drie gelijk: VCC naar 3V3, GND naar G, SDA naar GPIO11,
SCL naar GPIO10.

Bij **kale breakout-printjes** (Fermion-type) moet je zelf CSB/CS naar VCC leggen
om I2C af te dwingen, en SDO vastzetten: naar GND is adres 0x76, naar VCC 0x77.
Bij **Gravity-modules** van DFRobot is dat al op de print geregeld (standaard
0x77) en volstaan de vier draden.

## 12. Neuskegel met payloadruimte

Twee geprinte delen, te maken met `hardware/genereer_neuskegel.py`:

| Deel | Bestand | Massa (PLA) |
|---|---|---|
| Romp met payloadruimte | `PWS_Waterraket_Neuskegel_Bay.stl` | ~38 g |
| Ogief-punt | `PWS_Waterraket_Neuskegel_Tip.stl` | ~20 g |

De fles staat neck-down, dus de kegel zit op de **bodem** van de fles. De romp
schuift 32 mm over de fles en heeft daarboven 92 mm vrije ruimte.

**De houder staat rechtop**, met het platte vlak evenwijdig aan de raketas, tussen
vier ribben. Dat is bewust: liggend zou de houder (71,4 x 81,7 mm) een diameter van
108 mm vragen en dat past niet in een fles van circa 88 mm. Rechtop hoeft alleen de
breedte van 71,4 mm in de doorsnede te passen.

**Statische poorten**: vier gaten van 3 mm, 55 mm boven het tussenschot, precies
waarvoor ze bedoeld zijn: de barometer meet zo de omgevingsdruk en niet de
dynamische druk van de langsstromende lucht. Zorg dat de sensor op ongeveer die
hoogte in de houder zit.

Door het tussenschot zitten twee gaten van 4 mm voor een schokkoord of
parachutelijn.

**Standaardfles: Fernandes Cherry Bouquet 1,5 L.** Volledig cilindrisch, wat
beter is dan een getailleerde fles: manchet en neuskegel liggen overal aan. De
diameter is bepaald uit de omtrek (278 mm / pi = 88,5 mm); dat is op een ronde
vorm nauwkeuriger dan een schuifmaat. `FLES_D` staat op 88,5. Kies je ooit een
andere fles, pas de waarde bovenin het script aan en draai opnieuw:

```
cd hardware && ../../.venv/bin/python genereer_neuskegel.py
```

**Printen**: beide delen staand, zonder supports. De wand is 1,6 mm, dus twee
perimeters volstaan. PETG is taaier dan PLA en breekt minder snel bij de landing.
De punt is hol; print hem met weinig infill.

**Massa telt mee.** Samen circa 58 g in de neus. Dat helpt de stabiliteit (het
zwaartepunt schuift naar voren, weg van het drukpunt), maar kost hoogte. Houd de
massa over alle metingen gelijk en noteer hem, anders zit dat verschil in je
resultaten.

**Vinnen** komen niet uit dit project: gebruik de set van Marimo Labs op
Printables (`printables.com/model/86434`). Die is ontworpen met vrije ruimte voor
de klemmen van een cable-tie launcher en heeft drie vinmaten, wat handig is als je
vinoppervlak later als variabele wilt gebruiken.

## 13. Vinnen (fin can)

`hardware/genereer_vinnen.py` maakt een manchet met drie vinnen die om de fles
klemt. Geen lijm nodig: een tiewrap in de groef onderaan houdt hem vast. Onderaan
blijft 12 mm vrij voor de klemmen van de split-collar launcher.

Kant-en-klare modellen van internet passen vaak niet: veel populaire sets zijn
gemaakt voor Amerikaanse flesmaten (1L Polar Seltzer, 2L US-flessen). Deze
manchet gebruikt dezelfde `FLES_D` als de neuskegel, dus alles past op jouw fles.

Drie maten met **bekend vinoppervlak**, zodat je vinoppervlak als gecontroleerde
variabele kunt gebruiken:

| Maat | Spanwijdte | Per vin | Totaal (3 vinnen) | Massa |
|---|---|---|---|---|
| klein | 45 mm | 19,4 cm2 | 58,1 cm2 | ~42 g |
| midden | 58 mm | 29,0 cm2 | 87,0 cm2 | ~51 g |
| groot | 72 mm | 41,8 cm2 | 125,3 cm2 | ~63 g |

De vinwortel loopt door de hele manchetwand, en de manchet is altijd hoger dan de
wortel, zodat er geen losse flap boven uitsteekt. Alle drie zijn gecontroleerd op
waterdichtheid en op samenhang (een geheel, geen losse delen).

**Printen**: manchet rechtop, geen supports. PETG of TPU is taaier dan PLA, dat
bij een harde landing breekt.

**Conische zitting.** De fles is nergens exact cilindrisch: hij loopt over de
hele lengte licht taps. Bij de vinnen (halszijde) gaat de omtrek over ~30 mm van
264 naar 276 mm, oftewel diameter 84,0 naar 87,9 mm. De binnenboring van de
manchet heeft diezelfde conus, met 0,4 mm speling.

Let op het verschil met de andere delen: neuskegel en recovery-romp schuiven over
de **flesbodem** en houden 88,5 mm aan; alleen de vinnen gebruiken 87,9 mm. Voordelen boven een cilindrische manchet met een gelijmde opvulring:

- geen lijm op PET (dat hecht slecht, en juist daar grijpen de krachten aan)
- de manchet wigt zichzelf vast en staat daardoor altijd recht
- hij kan niet naar de hals zakken: de conus loopt dicht
- de axiale positie is reproduceerbaar, wat scheelt in de meetspreiding

**Monteren**: schuif de manchet van bovenaf over de fles en duw hem omlaag tot
hij klemt op de conus. Zet daarna de tiewrap in de groef vast. Zit hij te vroeg
klem, verhoog `FLES_SPEL` naar 0,6; zakt hij te ver door, verlaag naar 0,25.

Meet je een andere fles op, pas dan `FLES_D`, `FLES_D2` en `FLES_TAPS` aan.

Wil je vier vinnen in plaats van drie, zet `VIN_N` op 4: stabieler, maar meer
weerstand en meer massa.

## 14. Recovery: verkende route (vervallen)

We hebben eerst geprobeerd het Raketfued Phoenix 3D d78m-systeem te gebruiken via
een zelfgemaakte adapter (fles 88,5 mm naar hun 1L-flesvorm). Die combinatie
werkte in de praktijk niet prettig; de adapter is uit de repo verwijderd. Het
Phoenix-principe zelf, een vlakke zijdeur in een unibody-romp, is overgenomen in
het eigen ontwerp hieronder.

## 15. Recovery: eigen zijdeur-systeem

Zoals in hoofdstuk 14 beschreven bouwt
`hardware/genereer_recovery.py` het zijdeur-principe van Phoenix na in onze eigen
parametrische pijplijn, met een belangrijk verschil: **de vluchtcomputer opent de
deur op het gemeten apogeum** in plaats van een mechanische opwindtimer.

Opbouw (een romp, van onder naar boven): schuifrand over de fles, elektronica-
ruimte met rails en statische poorten (identiek aan de neuskegel), parachutekamer
110 mm met vlakke zijdeur, en bovenaan de insteekrand waar de bestaande
ogief-punt (`PWS_Waterraket_Neuskegel_Tip.stl`) op past.

De deur ligt vlak in de wand (geen randen die de uitworp hinderen), is getrapt
(dunne flens rust op een kozijnrand van 2,5 mm, dikke kern valt in de opening),
scharniert onderaan op een stukje 1,75 mm filament en heeft bovenaan een lip die
door een sleuf naar binnen steekt. Een **SG90-servo** op het plankje boven de
deur is de grendel: de hoorn valt in het gat van de lip. Bij het apogeum draait
de servo weg en trekt een elastiekje (van een haakje op de deur naar de romp,
over het scharnier) de deur open.

Aansluiting servo: signaal op **GPIO18** (randpad "18"), voeding op de 5V- en
G-pads. De firmware-aansturing volgt nog.

Numeriek gecontroleerd: romp en deur waterdicht; overlap deur-romp, houder-romp
en tip-romp alle exact 0; scharniergaten coaxiaal na plaatsing.

Nog te doen bij assemblage (niet blind te printen): de servohoorn op lengte
maken zodat hij het lipgat haalt, en de elastiekspanning afstellen. Reken op een
bankproef voor de eerste vlucht.

De fles schuift **50 mm** diep in de schuifrand; die verbinding vangt de
parachuteklap op. Vastzetten met PU-lijm of epoxy rondom, of met drie zelftappers
door rand en fleswand als je de romp verwisselbaar wilt houden.

**Materiaal: PETG.** PLA wordt boven ~55 graden zacht (een raket in de zomerzon
of in de auto haalt dat) en breekt bros bij de landing; PETG is taaier, blijft
vormvast tot ~75 graden en hecht laag-op-laag beter, wat telt voor de
scharnierogen en de kozijnrand. ABS/ASA voegt hier niets toe en kromtrekt bij
lange smalle prints; TPU is te slap voor een dragende romp (wel goed voor de
vinnen). Gebruik PLA hooguit voor een snelle pasproef.

Printen: romp staand zonder supports, 15-20% infill (~65 g in PETG), deur plat op
de rug (~7 g). Zet de **koeling hoog en brugsnelheid laag** voor de overspanning
boven de deuropening: dat is een gebogen brug van 58 mm, en PETG zakt daar
sneller door dan PLA. Een pontje eronder uit de slicer mag ook; dat breekt er na
het printen zo uit.

## 16. Parachute-uitworp in de firmware

De servo hangt aan **GPIO18** (randpad "18"), aangestuurd via LEDC-hardware-PWM
(50 Hz), zonder servo-library.

**Wanneer gaat de deur open?** Tijdens het loggen wordt elke meting getoetst:

```
open als   maxAlt > 8 m  EN  curAlt < maxAlt - 1,5 m      (voorbij het apogeum)
of als     vluchttijd > 12 s                              (noodklok)
```

De eerste voorwaarde is de echte: pas als de hoogte 1,5 m onder het maximum is
gezakt, is de raket aantoonbaar over de top. Dat is bewust niet "hoogte daalt",
want een enkele ruispiek zou de deur dan al openen. De eis van 8 m voorkomt
uitworp bij een mislukte lancering. De noodklok is het vangnet: gaat de detectie
om welke reden dan ook mis, dan opent de deur sowieso na 12 s.

Instelbaar bovenin de sketch: `SERVO_DICHT` / `SERVO_OPEN` (hoeken),
`DEPLOY_DROP_M`, `DEPLOY_MIN_M`, `DEPLOY_MAX_S`.

**Bankproef zonder te vliegen**: INFO-scherm, BOOT ingedrukt houden tussen 1,2 en
3 s. De deur gaat open, 3 s later grendelt hij weer. (Langer dan 3 s indrukken
opent nog steeds de raaktest.) Bij het scherpstellen (START) grendelt de deur
automatisch voor de nieuwe vlucht.

De servo wordt 4 s na elk commando **stroomloos** gezet: dat scheelt stroom en
voorkomt het typische servogebrom. De grendel houdt mechanisch, niet door
motorkracht.

**Servo: MG90S** (metalen tandwielen; de plastic SG90 strippen op den duur).
Oranje draad naar pad 18, bruin naar G. Meet eerst of het 5V-pad ook op accu
spanning geeft; zo niet, voed de servo dan rechtstreeks van de accu (BAT).
Sluit hem **niet** op 3V3 aan: de piekstroom laat het bord resetten.

## 17. Testneus (TPU, zonder parachute)

`hardware/genereer_testneus.py` maakt een eenvoudige neus uit een deel, bedoeld
voor de eerste testvluchten: werkt de lancering, vliegt de raket recht, kloppen
de vinnen. Geen parachutekamer, geen elektronica.

**Ontworpen voor hard TPU (95A/98A).** Zonder parachute is de landing een klap;
TPU vervormt en veert terug waar PLA en PETG breken. Dat maakt vrij lanceren
mogelijk zonder na elke vlucht te lijmen.

De maten zijn daarop aangepast, anders dan bij de harde onderdelen:

| Maat | Waarde | Waarom |
|---|---|---|
| Speling op de fles | 1,4 mm | TPU grijpt sterk; met 1,0 krijg je hem er niet meer af |
| Wanddikte | 2,0 mm | 4 banen van 0,5 mm; dunner wordt slap |
| Schuifrand | 45 mm | de wrijving van TPU doet hier het klemwerk, geen lijm nodig |
| Tipradius | 3 mm afgerond | een scherpe punt scheurt in TPU en is bovendien gevaarlijk |

Verder: drie ontluchtingsgaten in de schuifrand en een in het tussenschot, zodat
de lucht bij het opschuiven weg kan. De punt is massief (de holte stopt waar de
wand te dun zou worden); daardoor zit 65% van het materiaal in de onderste helft
en ligt het zwaartepunt op 66 mm, wat gunstig is voor de stabiliteit.

Afmetingen 93,9 x 93,9 x 158 mm, ongeveer 65 g in TPU bij 20% infill.

**Printinstellingen TPU**: 20-25 mm/s, retractie zo goed als uit, direct drive bij
voorkeur, geen supports (de vorm heeft nergens een overhang die dat vraagt).
Print langzaam op de eerste lagen van de schuifrand.

Let op: deze neus weegt anders dan de recovery-romp. Houd testvluchten en
meetvluchten dus gescheiden, of noteer per vlucht welke neus erop zat.

## 18. Nozzles: twee ontwerpen

De nozzle bepaalt hoe snel het water eruit gaat en is een onderzoeksvariabele.
Voorwaarde: hij moet KAARSRECHT op de fles staan, anders staat de stuwkracht
scheef en vliegt de raket niet zuiver.

**Waarom geprinte doppen scheef gaan staan.** De PCO1881-hals heeft vier losse
draadsegmenten, bedoeld om een dop aan te trekken, niet om iets haaks te
positioneren. Een geprinte draad heeft laaglijnen en een naadlijn en loopt
daardoor ergens vroeg aan. Hij richt zich dan uit op de draad in plaats van op
de flesmond.

Er staan nu twee oplossingen in de repo. Print ze allebei en vergelijk ze; dat
levert meteen een mooie paragraaf voor het verslag op.

### A. Insteek in een geboorde originele dop (`genereer_nozzles.py`)

Maten 4 tot en met 10 mm. Een originele dop is spuitgegoten en zit altijd haaks;
wij printen alleen het gekalibreerde gaatje. Boor 16,0 mm in de dop, duw de
nozzle er van BINNENUIT in (flens aan de waterkant, dan drukt de druk hem
vanzelf tegen de dop) en dicht af met wat siliconenkit of PTFE-tape. Er steekt
15 mm geleiding in de flesmond.

### B. Volledig geprinte dop met schroefdraad (`genereer_nozzledoppen.py`)

Maten 4, 6, 8 en 10 mm. Draad volgens ISBT PCO 1881: spoed 2,7 mm, een
draadgang, draad 27,43 / kern 24,94 / halsboring 21,74 mm. Drie maatregelen
tegen scheefstaan: een geleidingsbossing van 12 mm in de flesmond (dit is de
belangrijkste), een vlakke zitting op de flesrand met O-ringgroef (23 x 2 mm),
en vrijloop boven de draad zodat hij niet op de draad kan bottomen.

Print met de DICHTE KANT OP HET BED, opening naar boven: de draad zit dan
binnen en print als flauwe overhang, zonder supports. Reken op een proefprint
voor de pasvorm: te strak of te los stel je bij met `DRAAD_SPEL`, in stappen van
0,1 mm. De spoed van 2,7 mm blijft ongewijzigd.

### Controle op haaksheid

Zet de fles met nozzle op zijn kop op een vlakke tafel en draai de fles rond.
Blijft de nozzle op zijn plek, dan staat hij recht. Wandelt hij, dan zit er
speling. Doe dit voor beide varianten en noteer het verschil.
