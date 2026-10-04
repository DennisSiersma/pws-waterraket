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

## 12. Neuskegel met payloadruimte (VERVALLEN)

Deze losse neuskegel is vervangen door de recovery-romp met verwisselbare
schroefneus (hoofdstuk 22). De bestanden zijn uit de repo verwijderd; de tekst
hieronder blijft staan als verantwoording van de ontwerpstappen.

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

### C. Gardena-nozzle die recht staat (`genereer_nozzles_gardena.py`)

**Dit is de versie voor onze launcher.** De Gardena-koppeling is bij ons ook het
vergrendelmechanisme, dus de nozzle moet een Gardena-steel hebben. De varianten A
en B hierboven gaan uit van een launcher die de fleshals klemt en passen dus niet.

Vastgesteld probleem bij de nozzles van Raketfued: **de dop raakt de flesrand
niet**. Hij hangt volledig aan de geprinte schroefdraad. De vier losse
draadsegmenten van een PCO1881-hals zijn gemaakt om aan te trekken, niet om iets
haaks te positioneren, en dat is met beter printen niet op te lossen. Bijkomend
nadeel: zonder contact op de rand is er ook geen vlakke afdichting.

Deze versie neemt hun Gardena-steel over (opgemeten uit hun `Nozzle_8mm.stl`,
per 0,4 mm hoogte; onze steel komt tot op 0,1 mm overeen) en zet er drie
maatregelen op:

| Maatregel | Maat | Effect |
|---|---|---|
| Geleidingsbossing | 21,3 mm, 12 mm lang | steekt in de flesmond (21,74) en dwingt hem recht |
| Vlakke zitting | landt wel op de flesrand | bepaalt de stand, niet de draad |
| O-ringgroef | 22,8 tot 26,8 mm | dicht af op een vlak; O-ring 23 x 2 mm |
| Draadvrijloop | boven de draad | kan niet op de draad bottomen |

Maten 4 tot en met 9 mm. **Negen is de bovengrens**: bij de O-ringgroef is de
Gardena-steel maar 11,4 mm dik, dus daarboven wordt de wand te dun. Dat is meteen
de bovengrens van het onderzoeksbereik zolang we een Gardena-launcher gebruiken.

Printen: staand, Gardena-kant op het bed, 0,15 mm laagjes, geen supports,
olifantenpoot-compensatie aan, PETG.

**Controleer bij de eerste print of de dop nu WEL op de flesrand landt.** Blijft
er een spleet, dan grijpt de draad te vroeg: verhoog `DRAAD_START` met 0,5 mm en
print opnieuw. Dat is de kern van de hele oplossing.

### D. Gardena-nozzle in een geboorde originele dop (`genereer_nozzles_gardenadop.py`)

**Dit is de werkende oplossing.** Variant C hierboven faalde alsnog: de
binnendraad en de geleidingsbossing vragen support op een plek waar je niet bij
kunt, en achtergebleven supportresten trekken de nozzle opnieuw scheef.

De rode draad door alle mislukkingen was hetzelfde: **de schroefdraad werd
meegeprint**. Hier doen we dat niet meer. Een originele flesdop is spuitgegoten,
zit altijd haaks op de flesmond en dicht al af met zijn eigen liner. Wij printen
alleen de Gardena-steel met de gekalibreerde doorlaat.

Waarom dit wel lukt:

- **Geen geprinte draad**, dus ook geen draad die de stand bepaalt.
- **Geen inwendig support.** Nagerekend: alle overhangen liggen op straal 5,8 tot
  7,8 mm, dus aan de buitenkant, en het zijn ringvormige richels van hooguit
  2 mm. De doorlaat zelf is een rechte boring zonder overhang. Zet er toch iets
  support, dan kun je er met je vingers bij.
- **Zelfdichtend.** De flens zit binnen in de dop, aan de waterkant. Hoe hoger de
  druk, hoe steviger de flens tegen de dop wordt gedrukt. Trekken aan het
  Gardena-koord kan hem er niet uittrekken.

Montage: boor 16,0 mm midden in een originele dop (dop vastklemmen, langzaam
boren, rand nawerken met een mesje), duw de nozzle er van BINNENUIT in zodat de
flens aan de waterkant blijft, dicht af met een dun laagje siliconenkit of
PTFE-tape, laten uitharden, dop op de fles.

Meet twee maten aan jouw dop na en pas ze zo nodig aan bovenin het script:
`DOP_T` (dikte van de bovenkant, staat op 2,2) en `DOP_BINNEN_D` (vrije
binnendiameter, staat op 25,0).

Maten 4 tot en met 9 mm; 9 blijft de bovengrens vanwege de Gardena-steel.

Printen: Gardena-kant op het bed, 0,15 mm laagjes, GEEN supports, PETG.

### E. Gardena-nozzle die rust op de STEUNRING (`genereer_nozzles_steunring.py`)

Idee van Dennis, en het beste van de vijf. Niet uitrichten op de flesrand of op
een pen in de flesmond, maar op de **steunring**: die brede kraag onder de
schroefdraad.

Waarom dat beter werkt:

- De ring is **33,07 mm** in doorsnede tegen 21,74 mm voor de flesmond. Een
  bredere zitting verzet zich veel sterker tegen kantelen, want de hefboom is
  anderhalf keer zo groot.
- De ring is spuitgegoten, dus vlak en haaks op de as.
- Er is **geen geleidingsbossing meer nodig**, en juist die maakte in variant C
  een diepe ringsleuf waar support in moest dat niet te verwijderen was. Het
  inwendige is nu gewoon een boring met draad.

Rolverdeling, elk onderdeel doet een ding:

| Functie | Waar |
|---|---|
| Positioneren | de rok landt op de steunring (hard en vlak) |
| Afdichten | O-ring op de flesrand, met 0,3 mm spleet zodat hij kan knijpen |
| Vasthouden | de schroefdraad, die verder nergens tegenaan loopt |

Gemeten aan de Fernandes-fles: steunring 33,07 mm, flesrand tot bovenkant
steunring 14,00 mm. Beide staan bovenin het script.

Nagerekend: zittingvlak van 28,8 tot 38,3 mm, dus contact op de ring over een
ring van ruim 2 mm breed; ruimte over de schroefdraad 28,8 mm (draad is 27,43);
draadruggen op 25,9 mm en netjes doorlopend rond de omtrek; alle steile
overhangen liggen buiten de boring.

**Printen: Gardena-kant op het bed, rok naar boven open.** De draad zit dan aan
de binnenkant met de overhang naar beneden onder circa 50 graden, en dat print
zonder support. Geen holte waar je niet bij kunt. 0,15 mm laagjes, PETG.

**Controle**: hij hoort te STOPPEN op de steunring, met een spleetje van 0,3 mm
tussen dop en flesrand dat de O-ring vult. Loopt hij door tot op de rand, dan is
`RING_AFST` te groot; stopt hij te vroeg, dan te klein. Meet en corrigeer.


## 19. Klemmende schuifrand (testneus en recovery-romp)

Bij de eerste pasproef viel de testneus er gewoon af zodra je de fles omdraaide.
Oorzaak: de fles is bij de BODEM smaller dan de 88,5 mm van de brede band, en
daar schuiven neus en romp overheen. Een vaste maat werkt daar dus niet.

Oplossing: dezelfde als bij de vinnen, namelijk klemmen in plaats van passen.

- vier zaagsneden van 5 mm in de schuifrand, zodat er vier lippen ontstaan
- een groef rondom voor een tiewrap
- klembereik ongeveer 6,4 mm in diameter (van 89,5 tot circa 83 mm)

Daarmee hoeft de exacte flesdiameter op die hoogte niet bekend te zijn. Schuif
het onderdeel op tot tegen het tussenschot, tiewrap in de groef, aantrekken tot
het niet meer draait.

Twee dingen die uit de controle kwamen en die in het ontwerp zitten:

- **Verdikte band onder de tiewrap-groef, bij allebei.** De wand is 1,6 mm
  (romp) en 2,0 mm (testneus); een groef van 1,3 mm diep zou daar 0,3 en 0,7 mm
  van overlaten en bij het aantrekken scheuren. Met de band blijft er 1,75 mm
  respectievelijk 2,15 mm over.
- **De sleuven van de recovery-romp staan 45 graden gedraaid**, zodat ze niet in
  lijn liggen met de deuropening.

De losse ontluchtingsgaten in de schuifrand van de testneus zijn vervallen: de
zaagsneden ontluchten al.

Wordt de fles later opgemeten (omtrek op 1 en 4 cm vanaf de bodem), dan kan
`FLES_SPEL` krapper en wordt de tiewrap een borging in plaats van de hoofdklem.


## 20. Printhoogte: kamer teruggebracht naar 85 mm

De romp was 271 mm hoog en past daarmee niet op een Bambu X1 (256 mm bouwhoogte).
In plaats van hem te splitsen is de parachutekamer teruggebracht van 110 naar
85 mm. Dat scheelt 24 mm en de romp is nu 246,8 mm: ruim 9 mm speling.

Splitsen met een insteekverbinding was het alternatief, maar dat introduceert een
naad precies op de plek waar de parachuteklap aangrijpt. Een kortere kamer is
eenvoudiger en sterker.

Past de parachute nog? De kamer is 85 x 89,5 mm, oftewel 535 cm3. Een opgevouwen
nylon chute van 60 cm is ruwweg 300 tot 400 cm3, dus dat past met ruimte over.
De deuropening (58 x 78 mm) is niet gewijzigd.

Heb je een printer met meer hoogte, dan kun je `KAMER_H` bovenin het script weer
op 110 zetten.


## 21. De punt op de recovery-romp (VERVALLEN, zie 22)

Bovenop komt `PWS_Waterraket_Neuskegel_Tip.stl`, het ogief van 119 mm dat ook op
de oude neuskegel paste. Die punt heeft ZELF een insteekrand aan de onderkant.

Bij een controle bleek de romp daar ook een uitstekende rand te hebben, en twee
uitstekende randen passen niet in elkaar: ze botsten over ruim 5 cm3. De romp is
bovenaan nu een gladde boring van 89,5 mm waar de punt met zijn eigen rand van
88,95 mm in schuift, met 0,55 mm speling.

Totale hoogte romp plus punt: 352 mm, waarvan 50 mm over de fles valt.

De punt hoeft niet los te kunnen: de parachute gaat door de zijdeur naar buiten.
Je kunt hem dus vastzetten met een druppel lijm of met twee kleine zelftappers
door de rompwand in de insteekrand. Wil je schroefgaten in het model, dan zijn
die zo toe te voegen.


## 22. Verwisselbare schroefneus en los schotje

De neus wordt in de romp GESCHROEFD, zodat je verschillende neusvormen kunt
proberen. Daarmee wordt neusvorm een onderzoeksvariabele in plaats van een vaste
keuze.

### De draad

Grof en meergangs: spoed 5 mm, drie gangen, 12 mm lang. Een kwartslag pakt al,
een halve slag zit hij vast. Fijne geprinte draad loopt snel vast door
laaglijnen; deze niet. Kern 87,2 mm, rug 88,8 mm, boring van de romp 89,5 mm.

Nagerekend met de neus daadwerkelijk ingedraaid (dus draaien en tegelijk zakken
langs de schroeflijn): resterende overlap 0,19 cm3, en dat is de meetstap.

### Drie neusvormen

| Bestand | Vorm | Hoogte | Massa |
|---|---|---|---|
| `PWS_Waterraket_Neus_Ogief.stl` | klassiek raketprofiel | 133 mm | ~34 g |
| `PWS_Waterraket_Neus_Kegel.stl` | rechte kegel | 133 mm | ~23 g |
| `PWS_Waterraket_Neus_Elliptisch.stl` | stomp en kort | 103 mm | ~26 g |

Let op bij het vergelijken: de massa verschilt, en massa in de neus beinvloedt de
stabiliteit en de hoogte. Wil je zuiver de VORM meten, voeg dan ballast toe zodat
alle drie even zwaar zijn, en noteer dat.

### Los schotje (belangrijk)

De elektronicaruimte zat tussen twee dichte vloeren, waardoor je de houder er
niet in kon krijgen. De kamervloer is nu een LOS schotje
(`PWS_Waterraket_Recovery_Schot.stl`, 89,1 mm, rust op een richel, 0,4 mm
speling) met twee koordgaten en een doorvoer voor de servodraad.

Volgorde bij het opbouwen: neus eraf, schotje eruit, houder op de rails schuiven,
schotje terug, parachute erin, neus erop.

### Wat er nog meer veranderde

Door de kamer van 110 naar 85 mm te brengen paste de deur niet meer: die was
78 mm hoog en begon 12 mm boven de kamervloer, samen 90 mm. De deuropening stak
daardoor boven de rompbuis uit. De deur is nu 58 x 56 mm en begint 8 mm boven de
vloer. De romp is 231,8 mm, ruim binnen de 256 mm van een X1.

## 23. Nozzle als opzetstuk over de originele dop (voorkeursroute)

Ook de steunring-variant (hoofdstuk 18E) kregen we in de praktijk niet recht op
de fles. De gemene deler bleef: er zat geprinte schroefdraad in.

Deze versie heeft helemaal geen geprinte draad meer:

1. Je draait een ORIGINELE dop op de fles. Spuitgegoten, dus haaks, en hij dicht
   af met zijn eigen liner.
2. In die dop boor je een gat van 10 mm.
3. Het geprinte opzetstuk valt OVER de dop en haakt met vier vingers onder de
   steunring. Daarmee kan de druk het er niet afduwen.
4. Onderaan zit de Gardena-steel voor de launcher.

Uitlijning komt van de steunring (33,07 mm, spuitgegoten en rond). Nagemeten:
rok binnen 33,70 mm (0,63 mm speling), lip binnen 31,47 mm (grijpt 0,8 mm per
zijde onder de ring), tiewrap-groef aanwezig, sleuven open.

**Afdichting op twee plekken**: de originele dop op de flesrand, en een O-ring
(16 x 2 mm) tussen het opzetstuk en de bovenkant van de dop. De druk duwt het
opzetstuk tegen de vingers, en die trekken de O-ring juist aan. Dat is gunstig:
meer druk is betere afdichting.

**Montage**: gat boren, O-ring plaatsen, dop op de fles, opzetstuk eroverheen
drukken tot de vingers klikken, tiewrap in de groef zodat ze niet kunnen
openwijken.

**Twee maten nameten** (bovenin het script):
- `DOP_HOOGTE`, van de bovenkant van de dop tot de bovenkant van de steunring;
  staat op 16,0 mm. Reken op de 14,0 mm van flesrand tot ring plus de dikte van
  de dopbovenkant.
- `RING_DIK`, de dikte van de steunring; staat op 1,8 mm.

Klopt de eerste niet, dan klikt hij niet of zit hij los.

Maten 4 tot en met 9 mm; 9 blijft de bovengrens door de Gardena-steel.

Printen: Gardena-kant op het bed, geen supports, PETG, 0,2 mm laagjes.

## 24. Nozzle om op de dop te LIJMEN

Variant op hoofdstuk 23, maar dan vastgelijmd in plaats van vastgeklikt. Geen
vingers, geen tiewrap, geen maat die precies moet kloppen.

Opbouw: Gardena-steel, een plaat op de bovenkant van de dop, en een rok die
9,5 mm over de dop valt. Die rok is het lijmvlak, circa 895 mm2.

**Belangrijk: lijm hecht slecht op doppen.** Flesdoppen zijn van HDPE of PP, en
die hebben een lage oppervlakte-energie. Gewone tweecomponentenlijm pakt daar
nauwelijks op aan, hoe goed je ook schuurt. Opties van sterk naar zwak:

1. Lijm die voor polyolefinen gemaakt is: 3M DP8010, of secondelijm met een
   primer zoals Loctite 770.
2. Gewone epoxy, maar dan schuren EN kort vlammen met een aansteker, en direct
   lijmen.
3. Gewone epoxy op een onbehandelde dop: dit laat los.

Daarom zitten er **drie schroefgaten** van 2,2 mm in de rok als achtervang.
Die gaan alleen door de rokwand, niet dwars door het hele deel: een doorlopend
gat zou binnenin tegen de fleshals komen. Zet er na het lijmen drie korte
zelftappers in, de dopwand in.

Rekensom ter geruststelling: bij 7 bar en een afdichting op 16 mm staat er circa
14 kg kracht op het deel. Over 895 mm2 lijmvlak is dat 0,13 N/mm2. Weinig, maar
op onbehandeld PP haal je zelfs dat niet.

Er zitten drie lijmgroeven in de rok, zodat de lijm ergens in kan blijven staan
in plaats van er bij het opdrukken helemaal uit te worden geperst.

**Montage**: 10 mm boren, dop ruw schuren en ontvetten, O-ring 16 x 2 mm in de
groef, lijmen, 24 uur uitharden (niet de snelle vijfminutenvariant), dan de drie
zelftappers, en pas daarna op de fles draaien.

**Nameten**: `DOP_D` (30,0) en `DOP_H` (11,5) bovenin het script. Te ruim is geen
probleem, want de lijm vult dat op; te krap gaat er niet overheen.

## 25. Drie printfouten hersteld (recovery-romp, deur, neus)

Uit de eerste print van de recovery-set kwamen drie problemen. Alle drie zaten
in het model, niet in de printer.

**De neus schroefde er niet in.** 0,35 mm speling is te weinig voor een geprinte
draad van 89 mm doorsnede: een PETG-binnendraad krimpt naar binnen en de
buitenlaag van de neus komt dikker uit dan getekend. De draad is nu 2,2 mm diep
(was 1,5) met 0,7 mm speling, en de romp heeft bovenaan een aanloopschuinte zodat
de neus makkelijk aanzet. Nagerekend met de neus ingedraaid langs de schroeflijn.

**De deurtabs kwamen los.** Het scharnieroog hing onder de onderrand van het
paneel en de grendellip raakte de buitenflens net niet. In het model waren het
dus losse stukjes, en zo printte de slicer ze ook. Dat had de controle moeten
vangen; die keek alleen naar de romp en niet naar de deur. Nu: oog en lip steken
in het paneel, de deur is aantoonbaar een geheel.

**De rails printten slecht.** Het waren vrije ribben van 82 mm hoog en 3 mm dik
die alleen op de bodem stonden. Die wiebelen bij het printen. Ze lopen nu door
tot in de rompwand en zijn daarmee wandribben.

De controle checkt voortaan bij alle delen of ze uit een stuk bestaan.

## 26. Tweede printronde: gat in de neus, gat in de draad

Twee fouten uit de tweede print, allebei in het model.

**Gat in de top van de neus.** Het ogiefprofiel was bij de top vrijwel vlak (op
1 mm onder de punt nog 11 mm straal). De holte binnenin eindigde daardoor in een
plat plafond van bijna 2 cm, en dat kan een printer alleen met support maken. Dat
support zit in een gesloten holte: bij het verwijderen prik je er doorheen.

Nu: een echt tangent-ogief (cirkelboog, rakend in de romp, eindigend in een
punt, afgeplat op 2,5 mm straal). De holte volgt de buitenvorm met vaste wand,
maar het plafond mag nergens vlakker worden dan 52 graden en de top is massief.
Het script zoekt per vorm het hoogste punt waar de holte veilig kan sluiten.
Gecontroleerd: top dicht, een geheel, binnenin alleen een kleine brug van 8 mm.

**Gat in de schroefdraad van de romp.** Met de kamer op 85 mm paste de stapel
niet: deur (56) plus servoplank en servovak (34) plus draad (16) is 106 mm. Het
servovak sneed dwars door de draadzone en de bovenrand. Twee wijzigingen:
de kamer is weer 100 mm (romp 246,8 mm, past op een X1), en de servo ligt nu
plat op een plankje boven de deur met zijn as tangentieel. Het lichaam is dan
maar 12,6 mm hoog en het vak blijft binnen straal 43, los van de wand.

De grendellip zit daardoor niet meer in het midden maar op y=16, aan de kant
waar de servo-as uitsteekt, met het gat in de lip evenwijdig aan die as.

**Nog twee kleinere dingen die de strengere controle vond:**
- het scharnierpengat was 200 mm lang en priemde ook door de wand aan de
  overkant; het is nu 16 mm, alleen door de blokjes en de wand aan de deurkant
- de romp werd na het wegschrijven lek (float32-afronding rond het pengat); de
  export heeft nu dezelfde opschoonstap als de andere delen, met controle na
  het inlezen

**Controles die voortaan bij elke run draaien:** elk deel een geheel; wand in de
draadzone rondom heel op 72 hoeken; servovak raakt de wand niet; deur valt vrij
in het kozijn; houder past; neus draait er langs de schroeflijn in; top van elke
neus massief; geen plat plafond in de holte.

## 27. Compact: van 302 naar 193 mm boven de fles

De hele constructie was groter dan de fles zelf. Drie ingrepen:

| Deel | Was | Nu | Hoe |
|---|---|---|---|
| Elektronicaruimte | 92 mm | 26 mm | bord, accu en sensor liggen PLAT in een rond bakje (`PWS_Waterraket_Tray.stl`, 13 mm) in plaats van rechtop in een houder |
| Parachutekamer | 100 mm | 80 mm | servo zit NAAST de deur op dezelfde hoogte, niet meer erboven |
| Neus | 105 mm | 80 mm | korter ogief; bij deze snelheden niet meetbaar |

Romp 160,8 mm (was 246,8), ogief 96,7 mm incl. draad (was 121). Boven de fles
nu 193 mm. Massa: romp ~58 g, tray ~45 g (slicer-infill maakt dat minder), deur
5 g, neus 19 g.

**De tray** vervangt de houder. Het scherm kijkt omhoog: neus eraf en je ziet
het. Alle vakken liggen binnen straal 42 (rand op 42,5), met vingergaten in de
bodem om de onderdelen eruit te tillen en twee kabelgoten naar het bord. Hij
ligt los op de vloer van de elektronicaruimte; het schotje erboven houdt hem op
zijn plek. De statische poorten zitten nu op 8 mm boven die vloer, op sensorhoogte.
De oude houder staat in het archief.

**De servo** ligt tangentieel op een plankje tegen de wand, op 53 graden naast
de deur, as naar de deur. De hoorn draait in het radiaal-verticale vlak vlak
naast de deurrand en pakt een lip aan de BINNENKANT van de deur (y=23, binnen
het kozijnvenster zodat hij bij het openen niet achter de rand blijft haken).

**Het scharnier bleek al vanaf het begin fout.** De blokjes stonden op y=21 waar
de ronde wand al naar binnen loopt, en staken daardoor 1,8 mm buiten de romp.
Belangrijker: het pengat liep radiaal, terwijl een scharnieras tangentieel moet
lopen door beide blokjes en het deuroog. Dat scharnier had nooit kunnen draaien.
Nu: as langs y op x=36, blokjes met de boring afgesneden zodat ze in de wand
versmelten, oog dieper naar binnen. Gecontroleerd: as over 60 mm vrij, materiaal
eromheen in beide blokjes en het oog, niets buiten de romp. Het stukje filament
steek je van buitenaf door de wand in.

## 28. Laatste controle voor het printen

Twee dingen gevonden bij een laatste ronde:

- **Het schotje botste met het scharnier.** Het schotje ligt op de richel
  (vloer tot vloer+3 mm); de scharnierblokjes begonnen 1 mm onder de vloer en
  het deuroog erboven. Dat zat erin sinds het schotje bestaat, maar schotje en
  deur waren nooit samen gecontroleerd. De deur begint nu 14 mm boven de vloer
  (was 8), de kamer is 86 mm, de romp 166,8 mm. Overlap schot-romp en
  schot-deur nu 0.
- **Het servoplankje zweefde.** Een horizontaal plateau van 27 mm vrij uit de
  wand print niet. Er zit nu een 45-gradenwig onder, in de wand geklemd.

De controle draait nu twaalf punten: alle delen een geheel; deur in kozijn;
schotje op de richel en vrij van de deur; tray in de romp en onder het schotje;
draadzone rondom heel; niets buiten de romp; scharnieras vrij door blokjes,
oog en beide wanden; platte plafonds binnenin verklaard; neus draait erin.

**Slicer-instelling voor de romp**: supports AAN, maar "alleen vanaf het
printbed" (Bambu: support on build plate only). De enige plek die support nodig
heeft is de vloer boven de fles: die overspant de volle boring en wordt van
onderaf geprint. Dat support staat in de open schuifrand en breekt er zo uit.
Binnenin de romp komt dan nergens support, en dat is precies de bedoeling.

Boven de fles nu 199 mm.

## 29. Waarom de neus er nooit in draaide: een rekenfout, geen printprobleem

De neus paste bij geen enkele print, ook niet met meer speling. Een proefstuk
(draadring plus drie neusstompjes met 0,7, 0,9 en 1,1 mm speling) legde het
bloot: de overlap werd GROTER bij meer speling. Dat kan alleen bij een fout in
de geometrie.

Die fout: de kern van de neusdraad lag op straal `R_IN - diepte + speling`, dus
BOVEN de ruggen van de romp (die tot `R_IN - diepte` naar binnen steken). De
rompruggen botsten daardoor over de hele lengte 0,7 mm in de neuskern. Elke
neus die tot nu toe geprint is, kon er op papier al niet in. De eerdere
controle gaf 0,37 cm3 overlap, en dat is ten onrechte als "aanrakende flanken"
weggeschreven in plaats van als botsing.

Correct: kern op `R_IN - diepte - speling`. Na de correctie: overlap 0,026 cm3
bij 0,7 mm, 0,007 bij 0,9 en 0,000 bij 1,1, netjes aflopend. De neuzen staan nu
op 0,9 mm.

**Proefstukken** staan in `genereer_test_draad.py`: `Test_Draadring` (de
bovenste 18 mm van de romp) en `Test_Neusstomp_07/09/11`. Print bij twijfel
eerst de ring (11 g) met een neus; past die, dan past de romp. Dat scheelt een
romp van 64 g per poging.

De romp hoeft NIET opnieuw: de rompdraad was goed, de fout zat alleen in de
neus.


## 30. Deur verbreed naar 70 mm

Na het compacter maken was de deur 54 x 50 mm geworden, te krap voor een
parachute van 60 cm. Nu 70 x 50 mm (deuropening), kozijnvenster 65 x 45 mm.

De servo is meegeschoven om de omtrek: hij staat nu op de deurhalfhoek plus 21
graden, dus altijd net voorbij de deurrand, ook als `DEUR_B` later verandert.
De grendellip zit op `DEUR_B/2 - 4`, binnen het kozijnvenster.

Gecontroleerd na de wijziging: deur een geheel en vrij in het kozijn, schotje
en tray vrij, draadzone heel, niets buiten de romp, scharnieras vrij, wand naast
de deur (buiten 51 graden) rondom heel, neus draait erin.


## 31. Schotje en tray in helften: wat er niet door de opening paste

Het schotje kreeg je er met geen mogelijkheid in. Terecht: het was 89 mm rond,
de schroefdraad laat 85 mm door en het deurvenster 65. Het paste in geen enkele
opening. En bij het nalopen bleek de tray (ook 89 mm) hetzelfde probleem te
hebben, plus een tweede: het servoplankje steekt 27 mm de boring in, dus zelfs
een kleinere ronde schijf komt er niet langs.

De regel die voortaan bij elke run gecontroleerd wordt: **elk los deel moet door
een opening van de romp passen.**

Oplossing voor allebei: twee helften.

**Schotje** (`Recovery_Schot_A/B`): twee halve schijven van 89 mm met een
overlapnaad van 8 mm in het midden. Elke helft is 48 mm breed en gaat zo door
de draad. Een halve schijf ligt stabiel op de richel: haar zwaartepunt ligt op
19 mm van de rechte kant, ruim binnen de steunboog. Koordgat in elke helft,
servodraadgat in A.

**Tray** (`Tray_A/B`): 82 mm, zodat hij ook plat door het richelgat (83,5) kan.
De naad ligt niet in het midden: het bord (41 x 33) past niet in een halve
schijf omdat zijn hoeken buiten de boog steken, dus het ligt over het midden
heen in de grote helft A (43,5 mm breed). Helft B (38,5 mm) draagt accu (een
kwartslag gedraaid) en sensor. Alle vakken hebben minstens 1,5 mm wand tot de
naad en 1,8 mm tot de rand.

**Inbrengen**: neus eraf. Eerst tray B, aan de kant tegenover het servoplankje
laten zakken en over de bayvloer naar zijn plek schuiven. Dan tray A, zelfde
kant, blijft daar liggen. Dan de schothelften op de richel, A met de lip boven.
Daarna parachute en neus. De oude ronde tray en het ronde schotje staan in het
archief.
