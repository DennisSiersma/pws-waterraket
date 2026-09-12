# Archief: niet gebruikte ontwerpen

Deze bestanden zijn NIET in gebruik. Ze staan hier bewaard omdat ze de
ontwerpstappen laten zien, en dat is verantwoording waard in het verslag.
Print hieruit niets; de werkende versies staan een map hoger.

## Nozzles: vier varianten die het niet werden

De eis was dat de nozzle kaarsrecht op de fles staat. Een scheve nozzle geeft
scheve stuwkracht en dus een raket die niet zuiver vliegt.

| Bestanden | Aanpak | Waarom afgevallen |
|---|---|---|
| `PWS_Waterraket_Nozzle_04..10mm.stl` | insteek in een geboorde originele dop | goede aanpak, maar past niet in onze Gardena-launcher |
| `PWS_Waterraket_Nozzledop_*.stl` | volledig geprinte dop met PCO1881-draad | de geprinte draad bepaalt de stand en die staat scheef |
| `PWS_Waterraket_NozzleGardena_*.stl` | Gardena-steel plus geleidingspen in de flesmond | de pen maakt een diepe sleuf waar support in moet dat je er niet uit krijgt |
| `PWS_Waterraket_NozzleGardenaDop_*.stl` | Gardena-steel in een geboorde originele dop | werkbaar alternatief, maar nooit getest; de steunring-versie was beter |

De gemene deler van de mislukkingen: telkens werd de schroefdraad meegeprint, en
de vier losse draadsegmenten van een PCO1881-hals zijn gemaakt om aan te trekken,
niet om iets haaks te positioneren.

**Wat het wel werd:** `PWS_Waterraket_NozzleSteunring_*.stl`, met een zitting op
de steunring van de fles (33,07 mm in plaats van 21,74 mm), waardoor de zitting
veel breder is en de geleidingspen overbodig werd.

## Ook vervallen

- De losse neuskegel (bay en tip) is vervangen door de recovery-romp met
  verwisselbare schroefneus.
- De adapter naar het Raketfued Phoenix 3D-systeem is vervallen; dat principe is
  nagebouwd in de eigen parametrische pijplijn.
