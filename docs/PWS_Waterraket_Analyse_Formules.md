# Formules en aannames van de vluchtanalyse

Bijlage bij het profielwerkstuk. Beschrijft precies hoe `webapp/index.html` uit
de meetreeks van de vluchtcomputer de getallen berekent die in het verslag
komen. Elke formule hieronder staat ook in de applicatie zelf, achter het
vraagteken bij de betreffende grootheid.

De applicatie draait volledig in de browser. Er is geen server, geen bouwstap
en geen internetverbinding nodig: open `webapp/index.html` en laad de
CSV-bestanden in.

---

## 1. Het meetbestand

De vluchtcomputer schrijft per vlucht een bestand van deze vorm:

```
# vlucht 4, gestart 2026-08-09 14:07
t_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g
0,0.12,1013.40,21.3,0.02,-0.01,1.00
20,0.31,1013.38,21.3,0.05,0.02,1.02
```

| Kolom | Betekenis |
|---|---|
| `t_ms` | tijd in ms vanaf de lanceerdetectie |
| `hoogte_m` | barometrische hoogte boven het lanceerpunt |
| `druk_hPa` | absolute luchtdruk |
| `temp_C` | temperatuur |
| `ax_g, ay_g, az_g` | specifieke kracht per as, in eenheden g, bereik 16 g |

Twee eigenschappen van de firmware zijn belangrijk bij het lezen van de
uitkomsten:

1. De kopregel wordt met `println` geschreven en eindigt op CRLF, de meetregels
   met `printf` en eindigen op LF. Het bestand heeft dus gemengde regeleindes.
   De parser gaat om met CRLF, LF en losse CR.
2. Het log begint pas als de barometer meer dan `LAUNCH_RISE_M` = 3,0 m
   aanwijst. Bij een echte vlucht ontbreekt dus zowel het begin van de stuwfase
   als de rustige periode voor de lancering. De applicatie meldt dat en schakelt
   over op een andere ruisschatting (zie hoofdstuk 4).

De versnellingsmeter meet de **specifieke kracht**, niet de versnelling van de
raket. In rust leest hij 1 g, in vrije val 0 g. Dat is de meest gemaakte
denkfout bij het aflezen van zo'n grafiek.

---

## 2. Filtering

De hoogtereeks wordt gefilterd met een **Savitzky-Golay filter**. In een venster
van `w` monsters (standaard 21, dat is 0,42 s bij 50 Hz) wordt met kleinste
kwadraten een polynoom van graad `d` (standaard 2) gepast, en de gefilterde
waarde is die polynoom in het midden van het venster:

```
h_f(i) = som_j c_j h(i + j),   j = -(w-1)/2 .. +(w-1)/2
```

met `c` de rij van de pseudo-inverse `(X^T X)^-1 X^T` die bij het middelpunt
hoort. Aan de randen wordt de polynoom van het eerste of laatste volledige
venster op de werkelijke positie geevalueerd, zodat de reeks even lang blijft.

Waarom dit filter en niet een voortschrijdend gemiddelde: rond het apogeum is de
baan parabolisch, en een polynoom van graad 2 volgt een parabool exact. Een
voortschrijdend gemiddelde zou de top afvlakken en het apogeum systematisch te
laag maken.

Ontbrekende metingen worden **niet** ingevuld. Zit er een NaN in de invoer, dan
blijft die op die plek staan en breekt de lijn in de grafiek af.

---

## 3. De grootheden

| Grootheid | Formule |
|---|---|
| Apogeum | `h = a0 + a1 (t - t0) + a2 (t - t0)^2`, top: `H = a0 - a1^2 / (4 a2)` |
| Tijd tot apogeum | `t_top = t0 - a1 / (2 a2)` |
| Snelheid | `v(i) = (h_f(i+m) - h_f(i-m)) / (t(i+m) - t(i-m))` |
| Maximale snelheid | `v_max = max v(i)` |
| Versnelling | `abs(a) = sqrt(ax^2 + ay^2 + az^2)` |
| Maximale versnelling | `a_max = max abs(a)`, in m/s2 maal 9,80665 |
| Stuwtijd | `t_stuw = t_eind - t_begin`, de eerste aaneengesloten periode met `abs(a) > drempel` |
| Vluchttijd | `t_vlucht = t_laatste - t_eerste` met `h_f > drempel` |
| Daalsnelheid | helling `b` van `h = a + b t` over het laatste deel van de daling |

### 3.1 Apogeum

Het hoogste punt van het gefilterde signaal wijst de top aan. Rond dat punt
wordt over `± 0,40 s` (instelbaar) een parabool gepast door de **ongefilterde**
metingen, met gewone kleinste kwadraten. De top van die parabool is het
apogeum.

Twee redenen om de fit op de ruwe metingen te doen en niet op de gefilterde:

* De kleinste-kwadratentheorie geeft dan meteen de standaardfout van de
  tophoogte, want de meetfouten zijn dan nog ongecorreleerd.
* Vlak bij het apogeum is de snelheid nul, dus ook de luchtweerstand. De baan is
  daar zuiver parabolisch en een parabool over 0,8 s past bijna perfect.

De top ligt tussen twee metingen in; met de fit is hij nauwkeuriger dan het
hoogste meetpunt zelf.

### 3.2 Snelheid

De snelheid is het gecentreerde verschil van de gefilterde hoogte, met halve
stap `m` (standaard 1). Belangrijke kanttekening: een breed filtervenster maakt
de **snelheidspiek** lager dan hij werkelijk was, want die piek duurt maar kort.
Het apogeum heeft daar nauwelijks last van, de maximale snelheid wel. Op de
schone testvlucht kost het standaardvenster van 21 monsters ongeveer 0,2 m/s op
een piek van 25 m/s. Wie de piek scherper wil, kan het venster in de interface
verkleinen; het apogeum verandert daar nauwelijks van.

### 3.3 Stuwtijd

De eerste aaneengesloten periode waarin `abs(a)` boven de drempel (standaard
3 g) blijft. Begin en eind worden lineair geinterpoleerd tussen de twee metingen
rond de drempelpassage, zodat de uitkomst niet aan het meetraster van 20 ms
vastzit. Een latere piek, bijvoorbeeld de klap bij de landing, telt niet mee.
Valt de grootste versnelling van het hele log na het apogeum, dan meldt de
applicatie dat expliciet.

### 3.4 Aftopping bij 16 g

De QMI8658 staat in de firmware op een bereik van 16 g. Metingen die die grens
raken zijn afgetopt: de werkelijke versnelling was hoger. De applicatie telt hoe
vaak dat gebeurt, tekent de grens als lijn in de grafiek en waarschuwt erbij.

---

## 4. Meetonzekerheid

### 4.1 De ruis op de hoogtemeting

Eerste keus is de **rustige periode voor de lancering**: de metingen tot het
moment dat de versnelling de stuwdrempel passeert. Daarvan wordt de
standaardafwijking genomen:

```
sigma_h = sqrt( som (h_i - h_gem)^2 / (n - 1) )
```

Staan er minder dan 10 metingen voor de lancering in het log, wat bij de huidige
firmware het geval is (zie hoofdstuk 1), dan valt de applicatie **zichtbaar**
terug op de spreiding van de metingen rond het gefilterde signaal:

```
sigma_h = sd(h - h_f) / sqrt(1 - c0)
```

met `c0` het centrale gewicht van het filter. Die correctie is nodig omdat het
filter zichzelf mee-past aan het meetpunt, waardoor de rest te klein uitvalt.
In de interface staat per vlucht welke van de twee methoden is gebruikt.

### 4.2 De onzekerheid op het apogeum

Twee bijdragen, kwadratisch opgeteld en vermenigvuldigd met de dekkingsfactor
`k` (standaard 2, ongeveer 95 procent):

```
u(H) = k * sqrt( (sigma_h * L)^2 + (H_parabool - H_filter)^2 )
```

* `sigma_h * L` is de meetruis, doorgerekend naar de top van de fit. De
  hefboomfactor komt uit de kleinste-kwadratentheorie:
  `L = sqrt( x_top^T (X^T X)^-1 x_top )` met `x_top = [1, dt_top, dt_top^2]`.
  Omdat de fit over ongeveer 41 metingen middelt, is `L` ongeveer 0,23: de
  onzekerheid van de top is dus veel kleiner dan de ruis op een losse meting.
* `H_parabool - H_filter` is het verschil tussen de twee methoden voor de
  tophoogte. Die term groeit vanzelf zodra de twee methoden uit elkaar lopen,
  bijvoorbeeld bij veel ruis of bij een afgebroken log.

Hoe goed deze band klopt is nagerekend met 200 gesimuleerde ruisige vluchten
(ruis 0,40 m, bekend apogeum 30,00 m):

| maat | uitkomst |
|---|---|
| aandeel vluchten waarbij de band de werkelijke waarde bevat | 97,0 % |
| systematische fout van de schatter | +0,016 m |
| gemiddelde absolute afwijking | 0,067 m |

Bij `k = 2` hoort ongeveer 95 procent, dus de band is eerder iets ruim dan te
krap. Herhalen met `node test/gauntlet.js --breed`.

---

## 5. Vergelijken en verbanden

Per groep (alle vluchten met dezelfde waarde van de gekozen instelvariabele):

```
gemiddelde  x_gem = (1/n) som x_i
spreiding   s     = sqrt( som (x_i - x_gem)^2 / (n - 1) )
standaardfout      s / sqrt(n)
```

Een spreiding heeft minstens twee herhalingen nodig. Bij een groep met een
enkele vlucht staat een streepje, geen nul.

De trendlijn is een kleinste-kwadratenfit door **alle losse vluchten**, niet
door de groepsgemiddelden, zodat een instelling met meer herhalingen ook
zwaarder meetelt. Kwaliteit van de fit:

```
R2   = 1 - SSR / SST        deel van de spreiding dat de lijn verklaart
RMSE = sqrt( SSR / n )      in meters, dus direct te vergelijken met u(H)
```

---

## 6. Het theoretische model

Twee fasen. Alle symbolen staan in de tabel in hoofdstuk 7.

### 6.1 Stuwfase

De samengeperste lucht in de fles zet uit en drukt het water door de nozzle naar
buiten. De uitzetting is adiabatisch:

```
p(V) = p0 * (V0 / V)^gamma
```

met `p0` de absolute begindruk (`manometerdruk + p_atm`) en `V0` het beginvolume
lucht, `V0 = (1 - f) * V_fles`.

De uitstroomsnelheid van het water volgt uit Bernoulli:

```
v_e = sqrt( 2 (p - p_atm) / rho_water )
```

Daaruit de volumestroom en de stuwkracht:

```
dV/dt = Cd * A_n * v_e
m_punt = rho_water * Cd * A_n * v_e
F      = m_punt * v_e = 2 * Cd * A_n * (p - p_atm)
```

De massa van de raket neemt af doordat het water eruit gaat:

```
m(t) = m_leeg + rho_water * (V_fles - V)
```

En de bewegingsvergelijking, met luchtweerstand:

```
m dv/dt = F - m g - 0,5 * rho_lucht * Cw * A * v * abs(v)
```

Zolang de raket nog op de installatie staat en de stuwkracht het gewicht niet
overwint, draagt de installatie de raket en is de versnelling nul.

De stuwfase eindigt als het water op is (`V = V_fles`) of als de druk in de fles
tot de buitenluchtdruk is gezakt. In dat tweede geval blijft er water in de
fles; dat gaat als dode massa mee omhoog en de applicatie meldt het.

### 6.2 Ballistische fase

```
m_leeg dv/dt = - m_leeg g - 0,5 * rho_lucht * Cw * A * v * abs(v)
```

tot `v = 0`. Die hoogte is het theoretische apogeum.

### 6.3 Wat het model gedraagt zoals verwacht

| variant | theoretisch apogeum |
|---|---|
| 3 bar, vulfractie 0,33, 120 g | 28,8 m |
| 5 bar, vulfractie 0,33, 120 g | 43,7 m |
| 7 bar, vulfractie 0,33, 120 g | 54,2 m |
| 5 bar, vulfractie 0,10, 120 g | 21,5 m |
| 5 bar, vulfractie 0,40, 120 g | 44,6 m |
| 5 bar, vulfractie 0,70, 120 g | 18,7 m |
| 5 bar, vulfractie 0,33, 300 g | 24,5 m |

Het optimum ligt rond een vulfractie van 0,35 tot 0,40, wat overeenkomt met wat
in de literatuur over waterraketten staat. Te weinig water geeft te weinig
massa om impuls aan mee te geven, te veel water laat de lucht niet genoeg
uitzetten.

---

## 7. Aannames

Alle onderstaande waarden staan in de applicatie in het paneel "Aannames en
instellingen" en zijn daar aan te passen. Verander je er een, dan rekent alles
meteen opnieuw en verschijnt de nieuwe waarde ook in de export en in het
rapport.

### 7.1 Verwerking van de meting

| Symbool | Standaard | Betekenis |
|---|---|---|
| `w` | 21 monsters | vensterbreedte Savitzky-Golay |
| `d` | 2 | polynoomgraad Savitzky-Golay |
| `m` | 1 monster | halve stap van het gecentreerde verschil |
| venster paraboolfit | 0,40 s | halve breedte rond de top |
| stuwdrempel | 3,0 g | grens waarboven de stuwfase telt |
| hoogtedrempel | 3,0 m | grens voor de vluchttijd, gelijk aan `LAUNCH_RISE_M` |
| deel van de daling | 0,30 | laatste deel waarover de daalsnelheid wordt bepaald |
| bereik versnellingsmeter | 16 g | `ACC_RANGE_16G` in de firmware |
| gatdrempel | 3 monsters | vanaf hier heet een sprong een gat |
| `k` | 2 | dekkingsfactor van de onzekerheid |

### 7.2 Theoretisch model

| Symbool | Standaard | Betekenis |
|---|---|---|
| `gamma` | 1,4 | adiabatische exponent van lucht |
| `Cd` | 0,97 | uitstroomcoefficient van de nozzle |
| `Cw` | 0,45 | weerstandscoefficient van de raket |
| `V_fles` | 1,5 L | binnenvolume van de drukfles |
| `d_fles` | 88 mm | diameter, geeft `A = pi d^2 / 4` |
| `rho_water` | 998 kg/m3 | dichtheid van water |
| `rho_lucht` | 1,225 kg/m3 | dichtheid van de buitenlucht |
| `p_atm` | 1013,25 hPa | luchtdruk ter plaatse |
| `g` | 9,81 m/s2 | valversnelling in het model |

De applicatie laat er per vlucht bij zien welke luchtdruk, temperatuur en
luchtdichtheid uit het logbestand zelf volgen, met `rho = p / (R T)` en
`R = 287,05 J/(kg K)`, zodat je kunt zien of de ingestelde waarden redelijk zijn.

### 7.3 Wat het model bewust niet meeneemt

* De perslucht die na het water nog uitstroomt levert in het model geen stuw
  meer. Daardoor valt de berekende hoogte iets aan de lage kant.
* De raket vliegt recht omhoog. Wind, een scheve start en tuimelen zitten er
  niet in.
* `Cw` en de frontale oppervlakte zijn constant over de hele vlucht.
* De massa van de lucht in de fles telt niet mee.
* Bij het omrekenen van g naar m/s2 wordt de standaardvalversnelling
  9,80665 m/s2 gebruikt, ook als `g` in het model op een andere waarde staat.

---

## 8. Getallen en export

* **Weergave**: decimale komma, en een vast aantal decimalen per grootheid dat
  bij de meetonzekerheid past.
* **Export**: decimale punt, komma als veldscheidingsteken, UTF-8 met byte order
  mark zodat een rekenblad de tekst goed leest. De tekstvelden met
  waarschuwingen blijven gewoon Nederlands en houden daar hun komma's.
* Boven het CSV-bestand staan commentaarregels met alle instellingen waarmee
  gerekend is, zodat elke rij later terug te rekenen is.
* Grafieken worden als PNG bewaard op tweemaal de schermresolutie.
* Het rapport is te printen op A4 staand; grafieken worden nooit over twee
  bladzijden verdeeld.

---

## 9. Hoe je dit zelf nacontroleert

De testdata is synthetisch en heeft een **exact bekende** uitkomst. De generator
simuleert een vlucht met RK4 en zoekt met bisectie de stuwkracht die precies het
opgegeven apogeum oplevert.

```bash
node test/genereer_vlucht.js --alles
```

Dat schrijft zes CSV-bestanden in `test/data/` plus `verwacht.json` met de
werkelijke waarden. Daarna:

```bash
node test/gauntlet.js
```

Dat draait de volledige controlereeks: exitcriteria per fase, de numerieke
vergelijking met de bekende waarden, zestien randgevallen, de controle op
netwerkverzoeken, eenheden, herleidbaarheid, prestaties en de zichtbaarheid van
de aannames. Met `--breed` komt daar de Monte-Carlo dekkingsproef van hoofdstuk
4 bij.

Voor de dingen die alleen in een browser te controleren zijn (tekenen, acht
vluchten over elkaar, de PNG-export, opslag die het herladen overleeft):

```bash
node test/maak_browserdata.js
```

en open daarna `test/browsertest/index.html`.

Op de schone testvlucht van 30,00 m komt de applicatie uit op 29,99 m, op de
ruisige vlucht van 30,00 m op 30,09 m.
