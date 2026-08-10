/*
  parameters.js  -  alle aannames op een rij

  Elke drempel, vensterbreedte en constante die de analyse gebruikt staat hier,
  met eenheid, standaardwaarde en uitleg. De interface bouwt het paneel
  "Aannames en instellingen" rechtstreeks uit deze lijst, zodat er geen
  getal in de code kan zitten dat de gebruiker niet ziet en niet kan wijzigen.
*/
(function (root) {
  'use strict';

  var P = {};

  P.GROEPEN = [
    { sleutel: 'inlezen',     titel: 'Inlezen en controleren' },
    { sleutel: 'filter',      titel: 'Filtering' },
    { sleutel: 'grootheden',  titel: 'Drempels en vensters' },
    { sleutel: 'onzekerheid', titel: 'Meetonzekerheid' },
    { sleutel: 'theorie',     titel: 'Theoretisch model' }
  ];

  P.DEFINITIES = {

    // ---- inlezen ----------------------------------------------------------
    gat_drempel: {
      groep: 'inlezen', label: 'Gat wordt apart gemeld vanaf', eenheid: 'monsters',
      standaard: 3, min: 1, max: 50, stap: 1, geheel: true, instelbaar: true,
      uitleg: 'Een sprong in de tijdstempels van meer dan dit aantal ontbrekende monsters ' +
              'geldt als gat en wordt per vlucht gemeld.'
    },
    verwachte_frequentie_hz: {
      groep: 'inlezen', label: 'Verwachte bemonsteringsfrequentie', eenheid: 'Hz',
      standaard: 50, min: 1, max: 1000, stap: 1, instelbaar: true,
      uitleg: 'De frequentie waarop de vluchtcomputer hoort te loggen (SAMPLE_HZ in de firmware). ' +
              'Wijkt de gemeten frequentie hier meer dan 10 procent van af, dan volgt een waarschuwing.'
    },

    // ---- filter -----------------------------------------------------------
    sg_venster: {
      groep: 'filter', label: 'Savitzky-Golay vensterbreedte', eenheid: 'monsters',
      standaard: 21, min: 5, max: 201, stap: 2, geheel: true, oneven: true, instelbaar: true,
      uitleg: 'Breedte van het glijdende venster van het Savitzky-Golay filter, altijd oneven. ' +
              'Bij 50 Hz komt 21 monsters overeen met 0,42 s. Dit filter past in elk venster een ' +
              'polynoom en vlakt daardoor de top van de hoogtekromme niet af, anders dan een ' +
              'gewoon voortschrijdend gemiddelde.'
    },
    sg_graad: {
      groep: 'filter', label: 'Savitzky-Golay polynoomgraad', eenheid: '',
      standaard: 2, min: 2, max: 5, stap: 1, geheel: true, instelbaar: true,
      uitleg: 'Graad van de polynoom die in elk venster wordt gepast. Graad 2 volgt de ' +
              'parabolische vorm rond het apogeum exact en houdt de piekhoogte dus in stand.'
    },

    // ---- drempels en vensters --------------------------------------------
    afgeleide_stap: {
      groep: 'grootheden', label: 'Halve stap gecentreerd verschil', eenheid: 'monsters',
      standaard: 1, min: 1, max: 25, stap: 1, geheel: true, instelbaar: true,
      uitleg: 'De snelheid volgt uit v(i) = (h(i+m) - h(i-m)) / (t(i+m) - t(i-m)) met m deze waarde. ' +
              'Bij m = 1 is dat het gewone gecentreerde verschil over twee monsters.'
    },
    top_venster_s: {
      groep: 'grootheden', label: 'Halve breedte paraboolfit rond de top', eenheid: 's',
      standaard: 0.40, min: 0.05, max: 2.0, stap: 0.05, instelbaar: true,
      uitleg: 'Rond de top van de gefilterde hoogte wordt over dit halve tijdvenster een parabool ' +
              'door de ongefilterde metingen gepast. Vlak bij het apogeum is de baan bijna zuiver ' +
              'parabolisch, dus een breed venster onderdrukt ruis zonder de top te verschuiven.'
    },
    stuw_drempel_g: {
      groep: 'grootheden', label: 'Drempel stuwfase', eenheid: 'g',
      standaard: 3.0, min: 1.1, max: 15, stap: 0.1, instelbaar: true,
      uitleg: 'De stuwtijd is de eerste aaneengesloten periode waarin de norm van de gemeten ' +
              'versnelling boven deze drempel blijft. In rust meet de versnellingsmeter 1 g, ' +
              'dus de drempel moet ruim boven 1 g liggen.'
    },
    hoogte_drempel_m: {
      groep: 'grootheden', label: 'Hoogtedrempel voor de vluchttijd', eenheid: 'm',
      standaard: 3.0, min: 0.1, max: 50, stap: 0.1, instelbaar: true,
      uitleg: 'De vluchttijd loopt van de eerste tot de laatste meting boven deze hoogte. ' +
              '3,0 m is dezelfde waarde als LAUNCH_RISE_M in de firmware, de hoogte waarbij ' +
              'de vluchtcomputer de lancering herkent.'
    },
    daal_deel: {
      groep: 'grootheden', label: 'Laatste deel van de daling', eenheid: 'fractie',
      standaard: 0.30, min: 0.05, max: 1.0, stap: 0.05, instelbaar: true,
      uitleg: 'De daalsnelheid is de gemiddelde afgeleide over dit laatste deel van de daling, ' +
              'gerekend van het apogeum tot de laatste meting boven de hoogtedrempel. Het stuk ' +
              'na de landing telt dus niet mee.'
    },
    klip_g: {
      groep: 'grootheden', label: 'Meetbereik versnellingsmeter', eenheid: 'g',
      standaard: 16.0, min: 2, max: 200, stap: 1, instelbaar: true,
      uitleg: 'Bereik van de QMI8658 zoals de firmware hem instelt (ACC_RANGE_16G). Metingen die ' +
              'deze waarde raken zijn afgetopt; de werkelijke versnelling was dan hoger.'
    },

    // ---- meetonzekerheid --------------------------------------------------
    rust_min_monsters: {
      groep: 'onzekerheid', label: 'Minimum aantal monsters in de rustperiode', eenheid: 'monsters',
      standaard: 10, min: 3, max: 500, stap: 1, geheel: true, instelbaar: true,
      uitleg: 'Zoveel monsters moeten er voor de lancering staan om de ruis uit de rustperiode te ' +
              'kunnen schatten. Zijn het er minder, dan valt de applicatie zichtbaar terug op de ' +
              'spreiding van de meting rond het gefilterde signaal.'
    },
    dekkingsfactor: {
      groep: 'onzekerheid', label: 'Dekkingsfactor k', eenheid: '',
      standaard: 2, min: 1, max: 3, stap: 1, geheel: true, instelbaar: true,
      uitleg: 'De gerapporteerde onzekerheid is k maal de standaardonzekerheid. k = 1 hoort bij ' +
              'ongeveer 68 procent kans, k = 2 bij ongeveer 95 procent.'
    },

    // ---- theoretisch model ------------------------------------------------
    theorie_gamma: {
      groep: 'theorie', label: 'Adiabatische exponent gamma', eenheid: '',
      standaard: 1.4, min: 1.0, max: 1.67, stap: 0.05, instelbaar: true,
      uitleg: 'De lucht in de fles zet uit volgens p V^gamma = constant. Voor lucht is gamma = 1,4 ' +
              'bij een snelle, adiabatische uitzetting. Zet hem op 1,0 om de uitzetting isotherm ' +
              'te rekenen; de berekende hoogte valt dan hoger uit.'
    },
    theorie_cd_nozzle: {
      groep: 'theorie', label: 'Uitstroomcoefficient nozzle Cd', eenheid: '',
      standaard: 0.97, min: 0.5, max: 1.0, stap: 0.01, instelbaar: true,
      uitleg: 'De straal water snoert in de nozzle iets in, waardoor er minder water per seconde ' +
              'uitstroomt dan de opening suggereert. Voor een gladde, korte opening ligt Cd rond ' +
              '0,95 tot 0,98.'
    },
    theorie_cw: {
      groep: 'theorie', label: 'Weerstandscoefficient Cw', eenheid: '',
      standaard: 0.45, min: 0.05, max: 1.5, stap: 0.05, instelbaar: true,
      uitleg: 'De luchtweerstand is 0,5 rho Cw A v^2. Voor een PET-fles met neuskegel ligt Cw ' +
              'rond 0,3 tot 0,5; zonder neuskegel hoger. Dit is de aanname die de berekende ' +
              'hoogte het sterkst beinvloedt.'
    },
    theorie_flesvolume_l: {
      groep: 'theorie', label: 'Flesvolume', eenheid: 'L',
      standaard: 1.5, min: 0.2, max: 10, stap: 0.1, instelbaar: true,
      uitleg: 'Het totale binnenvolume van de drukfles, water plus lucht.'
    },
    theorie_flesdiameter_mm: {
      groep: 'theorie', label: 'Flesdiameter', eenheid: 'mm',
      standaard: 88, min: 20, max: 400, stap: 1, instelbaar: true,
      uitleg: 'De buitendiameter van de fles. Daaruit volgt de frontale oppervlakte A = pi d^2 / 4 ' +
              'die in de luchtweerstand zit.'
    },
    theorie_rho_water: {
      groep: 'theorie', label: 'Dichtheid van water', eenheid: 'kg/m3',
      standaard: 998, min: 950, max: 1050, stap: 1, instelbaar: true,
      uitleg: 'Dichtheid van het water bij kamertemperatuur. Bepaalt de uitstroomsnelheid en de ' +
              'massa van de raket bij de start.'
    },
    theorie_rho_lucht: {
      groep: 'theorie', label: 'Dichtheid van de buitenlucht', eenheid: 'kg/m3',
      standaard: 1.225, min: 0.8, max: 1.5, stap: 0.005, instelbaar: true,
      uitleg: 'Standaardwaarde op zeeniveau bij 15 graden. Het theoriepaneel laat zien welke ' +
              'waarde uit de druk en de temperatuur van het logbestand zelf volgt, met ' +
              'rho = p / (R T) en R = 287,05 J/(kg K).'
    },
    theorie_patm_hpa: {
      groep: 'theorie', label: 'Luchtdruk ter plaatse', eenheid: 'hPa',
      standaard: 1013.25, min: 900, max: 1100, stap: 0.1, instelbaar: true,
      uitleg: 'De luchtdruk waartegen de fles leegloopt. De begindruk op de manometer is de ' +
              'overdruk boven deze waarde. Het theoriepaneel toont wat de barometer aan de grond ' +
              'gemeten heeft.'
    },
    theorie_g: {
      groep: 'theorie', label: 'Valversnelling g', eenheid: 'm/s2',
      standaard: 9.81, min: 9.7, max: 9.9, stap: 0.01, instelbaar: true,
      uitleg: 'De valversnelling in het model. Voor het omrekenen van g naar m/s2 bij de ' +
              'versnellingsmeter wordt de standaardwaarde 9,80665 m/s2 gebruikt.'
    }
  };

  // standaardwaarden als gewoon object
  P.standaard = function () {
    var v = {};
    for (var s in P.DEFINITIES) {
      if (Object.prototype.hasOwnProperty.call(P.DEFINITIES, s)) v[s] = P.DEFINITIES[s].standaard;
    }
    return v;
  };

  // waarden binnen de grenzen brengen; onbekende sleutels vallen weg
  P.valideer = function (invoer) {
    var v = P.standaard();
    if (!invoer) return v;
    for (var s in P.DEFINITIES) {
      if (!Object.prototype.hasOwnProperty.call(P.DEFINITIES, s)) continue;
      var def = P.DEFINITIES[s];
      var x = invoer[s];
      if (x === undefined || x === null || typeof x !== 'number' || !isFinite(x)) continue;
      if (def.min !== undefined) x = Math.max(def.min, x);
      if (def.max !== undefined) x = Math.min(def.max, x);
      if (def.geheel) x = Math.round(x);
      if (def.oneven && x % 2 === 0) x += 1;
      v[s] = x;
    }
    // het venster moet breder zijn dan de graad, anders is de fit niet bepaald
    if (v.sg_venster < v.sg_graad + 2) v.sg_venster = v.sg_graad + 2 + ((v.sg_graad % 2) ? 0 : 1);
    if (v.sg_venster % 2 === 0) v.sg_venster += 1;
    return v;
  };

  root.WR = root.WR || {};
  root.WR.parameters = P;
})(typeof globalThis !== 'undefined' ? globalThis : this);
