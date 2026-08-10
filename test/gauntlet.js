#!/usr/bin/env node
/*
  gauntlet.js  -  de vaste controlereeks na elke fase

  Draait de acht controles uit de opdracht op de synthetische vluchten in
  test/data en op de rekenmodules van de webapplicatie. Controles waarvoor de
  fase nog geen onderwerp heeft, worden als "n.v.t." gemeld, nooit als geslaagd.

  Gebruik:  node test/gauntlet.js [--fase N] [--breed]
            --breed draait de Monte-Carlo dekkingsproef van fase 3
*/

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORTEL = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'data');
const KERN = path.join(WORTEL, 'webapp', 'js', 'kern');

// ---------------------------------------------------------------------------
// rekenmodules laden. Ze hangen zichzelf aan globalThis.WR en raken de DOM niet,
// dus ze draaien ongewijzigd in Node en in de browser.
// ---------------------------------------------------------------------------
const KERN_VOLGORDE = ['getal.js', 'parameters.js', 'csv.js', 'signaal.js',
                       'analyse.js', 'statistiek.js', 'theorie.js'];
function laadKern() {
  const geladen = [];
  for (const naam of KERN_VOLGORDE) {
    const pad = path.join(KERN, naam);
    if (!fs.existsSync(pad)) continue;
    vm.runInThisContext(fs.readFileSync(pad, 'utf8'), { filename: pad });
    geladen.push(naam);
  }
  return geladen;
}
const GELADEN = laadKern();
const WR = globalThis.WR || {};

// ---------------------------------------------------------------------------
// hulpjes voor het rapport
// ---------------------------------------------------------------------------
const uitslagen = [];
function meld(nummer, naam, status, toelichting) {
  uitslagen.push({ nummer, naam, status, toelichting: toelichting || '' });
}
function nl(x, d) {
  if (x === null || x === undefined || !isFinite(x)) return 'n.v.t.';
  return x.toFixed(d === undefined ? 3 : d).replace('.', ',');
}
function lees(bestand) { return fs.readFileSync(path.join(DATA, bestand), 'utf8'); }
function verwacht() { return JSON.parse(lees('verwacht.json')); }

const FASE = (function () {
  const i = process.argv.indexOf('--fase');
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : 99;
})();
const BREED = process.argv.includes('--breed');

// ---------------------------------------------------------------------------
// exitcriteria per fase. Elke functie geeft {ok, tekst} terug.
// ---------------------------------------------------------------------------
const EXIT = {};

EXIT[0] = function () {
  const nodig = ['vlucht_schoon.csv', 'vlucht_ruisig.csv', 'vlucht_afgebroken.csv'];
  const v = verwacht();
  const gemist = nodig.filter(b => !fs.existsSync(path.join(DATA, b)));
  if (gemist.length) return { ok: false, tekst: 'ontbreekt: ' + gemist.join(', ') };
  const schoon = v['vlucht_schoon.csv'];
  const ruisig = v['vlucht_ruisig.csv'];
  const rand = v['vlucht_afgebroken.csv'];
  const ok = Math.abs(schoon.apogeum_m - 30.0) < 1e-4 &&
             Math.abs(ruisig.ruis_sd_m - 0.4) < 1e-9 &&
             rand.aantal_regels === 12;
  return {
    ok,
    tekst: 'schoon apogeum ' + nl(schoon.apogeum_m, 3) + ' m, ruisig sd ' +
           nl(ruisig.ruis_sd_m, 2) + ' m, randgeval ' + rand.aantal_regels + ' regels'
  };
};

EXIT[1] = function () {
  if (!WR.csv) return { ok: false, tekst: 'csv-module ontbreekt' };
  const namen = ['vlucht_schoon.csv', 'vlucht_ruisig.csv', 'vlucht_afgebroken.csv'];
  const stukjes = [];
  let ok = true;
  for (const naam of namen) {
    let r;
    try { r = WR.csv.parse(lees(naam), naam); } catch (e) { return { ok: false, tekst: naam + ' gooit ' + e.message }; }
    if (!r.geldig) { ok = false; stukjes.push(naam + ' ongeldig'); continue; }
    stukjes.push(naam.replace('vlucht_', '').replace('.csv', '') + ': ' + r.aantal +
                 ' metingen, ' + nl(r.frequentie_hz, 1) + ' Hz');
  }
  const rand = WR.csv.parse(lees('vlucht_afgebroken.csv'), 'vlucht_afgebroken.csv');
  const heeftWaarschuwing = rand.waarschuwingen.some(w => w.code === 'afgebroken');
  if (!heeftWaarschuwing) { ok = false; stukjes.push('randgeval mist de waarschuwing "afgebroken"'); }
  return { ok, tekst: stukjes.join('; ') };
};

EXIT[2] = function () {
  if (!WR.analyse) return { ok: false, tekst: 'analyse-module ontbreekt' };
  const v = verwacht();
  const res = [];
  let ok = true;
  for (const [naam, tol] of [['vlucht_schoon.csv', 0.3], ['vlucht_ruisig.csv', 1.0]]) {
    const a = analyseer(naam);
    const afw = a.apogeum.waarde - v[naam].apogeum_m;
    if (!(Math.abs(afw) < tol)) ok = false;
    res.push(naam.replace('vlucht_', '').replace('.csv', '') + ' ' +
             nl(a.apogeum.waarde, 2) + ' m (afwijking ' + nl(afw, 3) + ' m, grens ' + nl(tol, 1) + ')');
  }
  return { ok, tekst: res.join('; ') };
};

EXIT[3] = function () {
  if (!WR.analyse) return { ok: false, tekst: 'analyse-module ontbreekt' };
  const v = verwacht();
  const s = analyseer('vlucht_schoon.csv');
  const r = analyseer('vlucht_ruisig.csv');
  const verhouding = r.ruis.waarde / s.ruis.waarde;
  const binnenS = Math.abs(s.apogeum.waarde - v['vlucht_schoon.csv'].apogeum_m) <= s.apogeum.onzekerheid;
  const binnenR = Math.abs(r.apogeum.waarde - v['vlucht_ruisig.csv'].apogeum_m) <= r.apogeum.onzekerheid;
  const ok = verhouding >= 2 && binnenS && binnenR;
  return {
    ok,
    tekst: 'ruis schoon ' + nl(s.ruis.waarde, 3) + ' m, ruisig ' + nl(r.ruis.waarde, 3) +
           ' m (factor ' + nl(verhouding, 1) + '); band schoon ' + nl(s.apogeum.waarde, 2) +
           ' +/- ' + nl(s.apogeum.onzekerheid, 2) + ' m ' + (binnenS ? 'bevat 30,00' : 'MIST 30,00') +
           '; ruisig ' + nl(r.apogeum.waarde, 2) + ' +/- ' + nl(r.apogeum.onzekerheid, 2) + ' m ' +
           (binnenR ? 'bevat 30,00' : 'MIST 30,00')
  };
};

EXIT[4] = function () {
  /*
    In Node is er geen canvas, dus hier wordt gecontroleerd wat er in de
    beschrijving van de grafieken zit: genoeg onderscheidbare kleuren, een
    legenda met de vluchtnaam, assen met eenheid, de klipgrens als hulplijn en
    de onzekerheidsband. Dat de tekening ook echt klopt wordt bewezen door
    test/browsertest/index.html, die dezelfde beschrijvingen op canvas zet.
  */
  const padG = path.join(WORTEL, 'webapp', 'js', 'ui', 'grafiek.js');
  const padA = path.join(WORTEL, 'webapp', 'js', 'app.js');
  if (!fs.existsSync(padG)) return { ok: false, tekst: 'grafiek.js ontbreekt' };
  const gr = fs.readFileSync(padG, 'utf8');
  const app = fs.readFileSync(padA, 'utf8');

  const paletMatch = gr.match(/PALET\s*=\s*\[([^\]]*)\]/);
  const kleuren = paletMatch ? paletMatch[1].split(',').filter(s => s.trim()).length : 0;
  const bandInMotor = /spec\.banden/.test(gr) && /banden \|\| \[\]/.test(gr);

  const gebreken = [];
  if (kleuren < 8) gebreken.push('maar ' + kleuren + ' lijnkleuren');
  if (!bandInMotor) gebreken.push('tekenlaag kent geen banden');

  // de drie voorgeschreven grafieken, elk met eenheid op beide assen
  const specs = ['specHoogte', 'specSnelheid', 'specVersnelling'];
  for (const naam of specs) {
    const blok = app.match(new RegExp('function ' + naam + '\\([^]*?\\n  }', 'm'));
    if (!blok) { gebreken.push(naam + ' ontbreekt'); continue; }
    const b = blok[0];
    if (!/xLabel:[^,]*\([smg/]+\)/.test(b)) gebreken.push(naam + ': x-as zonder eenheid');
    if (!/yLabel:[^,]*\([smg/]+\)/.test(b)) gebreken.push(naam + ': y-as zonder eenheid');
    if (!/label: vluchtLabel\(v\)/.test(b)) gebreken.push(naam + ': legenda zonder vluchtnaam');
  }
  if (!/banden\.push/.test(app)) gebreken.push('geen onzekerheidsband in de hoogtegrafiek');
  if (!/waarde: staat\.params\.klip_g/.test(app)) gebreken.push('geen klipgrens in de versnellingsgrafiek');

  // de legenda moet elke vlucht een eigen naam geven, ook als twee bestanden
  // hetzelfde vluchtnummer dragen. De echte functies uit app.js worden hier
  // uitgevoerd op een nagemaakte staat.
  const labels = (function () {
    function pak(naam) {
      const m = app.match(new RegExp('function ' + naam + '\\([^]*?\\n  }', 'm'));
      return m ? m[0] : null;
    }
    const basis = pak('basisLabel'), vernieuw = pak('vernieuwLabels');
    if (!basis || !vernieuw) return null;
    const staat = { vluchten: [
      { naam: 'vlucht_schoon.csv', gelezen: { vluchtnummer: 1 } },
      { naam: 'kopie_van_1.csv', gelezen: { vluchtnummer: 1 } },
      { naam: 'vlucht_ruisig.csv', gelezen: { vluchtnummer: 2 } },
      { naam: 'zonder_nummer.csv', gelezen: { vluchtnummer: null } }
    ] };
    try {
      return new Function('staat', basis + '\n' + vernieuw +
        '\nvernieuwLabels(); return staat.vluchten.map(function (v) { return v.label; });')(staat);
    } catch (e) { return null; }
  })();
  if (!labels) gebreken.push('labelfuncties niet uitvoerbaar');
  else if (new Set(labels).size !== labels.length) gebreken.push('legenda geeft dubbele namen: ' + labels.join(', '));

  return {
    ok: gebreken.length === 0,
    tekst: gebreken.length === 0
      ? kleuren + ' lijnkleuren, drie grafieken met eenheid op beide assen, legenda met ' +
        'vluchtnummers, onzekerheidsband en klipgrens aanwezig'
      : gebreken.join(', ')
  };
};

EXIT[5] = function () {
  const pad = path.join(WORTEL, 'webapp', 'js', 'ui', 'opslag.js');
  if (!fs.existsSync(pad)) return { ok: false, tekst: 'opslag.js ontbreekt' };
  const bron = fs.readFileSync(pad, 'utf8');
  const velden = ['vulfractie', 'begindruk', 'nozzle', 'massa', 'opmerking'];
  const gemist = velden.filter(f => !bron.includes(f));
  const ok = gemist.length === 0 && /localStorage/.test(bron);
  return { ok, tekst: ok ? 'vijf velden in localStorage, sleutel per vluchtnummer'
                         : 'mist ' + gemist.join(', ') };
};

EXIT[6] = function () {
  if (!WR.statistiek) return { ok: false, tekst: 'statistiek-module ontbreekt' };
  const punten = [
    { x: 3, y: 20.1 }, { x: 3, y: 21.4 }, { x: 3, y: 19.7 },
    { x: 5, y: 30.2 }, { x: 5, y: 31.6 }, { x: 5, y: 29.4 },
    { x: 7, y: 39.8 }, { x: 7, y: 41.1 }, { x: 7, y: 40.3 }
  ];
  const groepen = WR.statistiek.groepeer(punten);
  const metFoutbalk = groepen.filter(g => g.n >= 2 && isFinite(g.sd)).length;
  const fit = WR.statistiek.trend(punten, 'lineair');
  const ok = groepen.length === 3 && metFoutbalk === 3 && fit && isFinite(fit.r2) && fit.r2 > 0.98;
  return { ok, tekst: groepen.length + ' groepen, ' + metFoutbalk + ' met foutbalk; ' +
                      (fit ? fit.formule + ', R2 = ' + nl(fit.r2, 4) : 'geen fit') };
};

EXIT[7] = function () {
  if (!WR.theorie) return { ok: false, tekst: 'theorie-module ontbreekt' };
  const p = WR.theorie.standaardInvoer();
  p.begindruk_bar = 5.0; p.vulfractie = 0.33; p.leegmassa_kg = 0.120;
  const r = WR.theorie.bereken(p);
  const ok = r.apogeum_m > 5 && r.apogeum_m < 200 && r.aannames.length >= 8 && r.baan.length > 10;
  return { ok, tekst: 'apogeum ' + nl(r.apogeum_m, 1) + ' m bij ' + nl(p.begindruk_bar, 1) +
                      ' bar en vulfractie ' + nl(p.vulfractie, 2) + '; ' + r.aannames.length + ' aannames zichtbaar' };
};

EXIT[8] = function () {
  const pad = path.join(WORTEL, 'webapp', 'js', 'ui', 'export.js');
  if (!fs.existsSync(pad)) return { ok: false, tekst: 'export.js ontbreekt' };
  const bron = fs.readFileSync(pad, 'utf8');
  const css = fs.readFileSync(path.join(WORTEL, 'webapp', 'stijl.css'), 'utf8');
  const png = /toBlob|toDataURL/.test(bron) && /schaal|scale/.test(bron);
  const csvUit = /grootheden|csvRegel|exporteerCsv/.test(bron);
  const a4 = /@page[^}]*A4/.test(css) && /break-inside\s*:\s*avoid/.test(css);
  const ok = png && csvUit && a4;
  return { ok, tekst: 'PNG op schaal ' + (png ? 'ja' : 'nee') + ', CSV-export ' +
                      (csvUit ? 'ja' : 'nee') + ', A4-printregels ' + (a4 ? 'ja' : 'nee') };
};

// ---------------------------------------------------------------------------
// gedeelde hulpfunctie: bestand -> analyse
// ---------------------------------------------------------------------------
function analyseer(bestand, params) {
  const gelezen = WR.csv.parse(lees(bestand), bestand);
  return WR.analyse.analyseer(gelezen, params || WR.parameters.standaard());
}

// ---------------------------------------------------------------------------
// de acht controles
// ---------------------------------------------------------------------------
function controle1Regressie(fase) {
  const regels = [];
  let ok = true;
  for (let f = 0; f <= Math.min(fase, 8); f++) {
    if (!EXIT[f]) continue;
    let r;
    try { r = EXIT[f](); } catch (e) { r = { ok: false, tekst: 'fout: ' + e.message + '\n' + e.stack }; }
    if (!r.ok) ok = false;
    regels.push('fase ' + f + ' ' + (r.ok ? 'groen' : 'ROOD') + ': ' + r.tekst);
  }
  meld(1, 'Regressie', ok ? 'v' : 'x', regels.join('; '));
}

function controle2Numeriek(fase) {
  if (fase < 2 || !WR.analyse) { meld(2, 'Numerieke waarheid', '-', 'nog geen rekenmodule'); return; }
  const v = verwacht();
  const rijen = [];
  let ok = true;
  const tolerantie = {
    apogeum_m: { schoon: 0.30, ruisig: 1.00 },
    t_apogeum_s: { schoon: 0.10, ruisig: 0.20 },
    v_max_ms: { schoon: 1.50, ruisig: 3.00 },
    stuwtijd_s: { schoon: 0.06, ruisig: 0.06 },
    vluchttijd_s: { schoon: 0.10, ruisig: 0.20 },
    daalsnelheid_ms: { schoon: 1.50, ruisig: 2.50 }
  };
  for (const [bestand, soort] of [['vlucht_schoon.csv', 'schoon'], ['vlucht_ruisig.csv', 'ruisig']]) {
    const a = analyseer(bestand);
    const w = v[bestand];
    const paren = [
      ['apogeum_m', a.apogeum.waarde, w.apogeum_m, 2, 'm'],
      ['t_apogeum_s', a.tApogeum.waarde, w.t_apogeum_s, 2, 's'],
      ['v_max_ms', a.vMax.waarde, w.v_max_ms, 1, 'm/s'],
      ['stuwtijd_s', a.stuwtijd.waarde, w.stuwtijd_boven_drempel_s, 3, 's'],
      ['vluchttijd_s', a.vluchttijd.waarde, w.vluchttijd_s, 2, 's'],
      ['daalsnelheid_ms', a.daalsnelheid.waarde, w.daalsnelheid_ms, 1, 'm/s']
    ];
    for (const [sleutel, gemeten, waar, d, eh] of paren) {
      if (waar === null || gemeten === null) continue;
      const afw = gemeten - waar;
      const grens = tolerantie[sleutel][soort];
      if (Math.abs(afw) > grens) ok = false;
      rijen.push(soort + '/' + sleutel.replace(/_.*$/, '') + ' ' + nl(gemeten, d) + ' ' + eh +
                 ' bij verwacht ' + nl(waar, d) + ' (' + (afw >= 0 ? '+' : '') + nl(afw, d) + ')');
    }
  }
  meld(2, 'Numerieke waarheid', ok ? 'v' : 'x', rijen.join('; '));
}

const RANDGEVALLEN = [
  ['leeg bestand', ''],
  ['alleen witruimte', '   \n\n  \n'],
  ['een regel', '0,0.12,1013.40,21.3,0.02,-0.01,1.00\n'],
  ['alleen kopregel', 't_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g\r\n'],
  ['alleen commentaar', '# vlucht 9, gestart 2026-08-09 10:00\n'],
  ['dubbele tijdstempels',
   '# vlucht 9\r\nt_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g\n' +
   '0,0.10,1013.40,21.3,0.00,0.00,1.00\n0,0.11,1013.40,21.3,0.00,0.00,1.00\n' +
   '20,0.12,1013.40,21.3,0.00,0.00,1.00\n20,0.13,1013.40,21.3,0.00,0.00,1.00\n' +
   '40,0.14,1013.40,21.3,0.00,0.00,1.00\n'],
  ['teruglopende tijd',
   't_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g\n40,1.0,1013,21,0,0,1\n20,2.0,1013,21,0,0,1\n0,3.0,1013,21,0,0,1\n'],
  ['gat van 20 samples',
   't_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g\n0,0.1,1013,21,0,0,1\n20,0.2,1013,21,0,0,1\n420,9.0,1013,21,0,0,1\n440,9.4,1013,21,0,0,1\n'],
  ['niet-numerieke velden',
   't_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g\n0,nan,1013,21,0,0,1\n20,abc,1013,21,0,0,1\n40,0.3,1013,21,0,0,1\n'],
  ['lege velden',
   't_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g\n0,,,,,,\n20,0.2,1013,21,0,0,1\n'],
  ['te weinig kolommen',
   't_ms,hoogte_m\n0,0.1\n20,0.2\n40,0.4\n'],
  ['puntkomma als scheidingsteken',
   't_ms;hoogte_m;druk_hPa;temp_C;ax_g;ay_g;az_g\n0;0.10;1013.40;21.3;0.00;0.00;1.00\n20;0.20;1013.40;21.3;0.00;0.00;1.00\n'],
  ['oude Mac-regeleindes',
   't_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g\r0,0.1,1013,21,0,0,1\r20,0.2,1013,21,0,0,1\r'],
  ['BOM aan het begin',
   '﻿# vlucht 9\r\nt_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g\n0,0.1,1013,21,0,0,1\n20,0.2,1013,21,0,0,1\n'],
  ['enorme waarden',
   't_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g\n0,1e308,1013,21,0,0,1\n20,-1e308,1013,21,0,0,1\n40,0,1013,21,0,0,1\n'],
  ['tekstbestand zonder komma\'s', 'dit is geen csv\nzomaar wat tekst\n']
];

function controle3Randgevallen(fase) {
  if (fase < 1 || !WR.csv) { meld(3, 'Randgevallen', '-', 'nog geen parser'); return; }
  const fouten = [];
  const gevallen = RANDGEVALLEN.slice();
  gevallen.push(['nooit boven de drempel', lees('vlucht_laag.csv')]);
  gevallen.push(['midden in de vlucht afgebroken', lees('vlucht_afgebroken.csv')]);
  for (const [naam, tekst] of gevallen) {
    try {
      const gelezen = WR.csv.parse(tekst, naam);
      if (WR.analyse) {
        const a = WR.analyse.analyseer(gelezen, WR.parameters.standaard());
        JSON.stringify(a);                                  // moet serialiseerbaar blijven
        if (a.fouten === undefined) throw new Error('analyse levert geen foutenlijst');
      }
    } catch (e) {
      fouten.push(naam + ' -> ' + e.message);
    }
  }
  meld(3, 'Randgevallen', fouten.length === 0 ? 'v' : 'x',
       fouten.length === 0 ? gevallen.length + ' invoeren verwerkt zonder uitzondering'
                           : fouten.join(' | '));
}

function controle4Offline(fase) {
  if (fase < 1) { meld(4, 'Offline', '-', 'nog geen applicatie'); return; }
  const bestanden = [];
  (function loop(map) {
    if (!fs.existsSync(map)) return;
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      if (fs.statSync(p).isDirectory()) loop(p);
      else if (/\.(html|js|css)$/.test(naam)) bestanden.push(p);
    }
  })(path.join(WORTEL, 'webapp'));

  const verboden = [
    [/\bfetch\s*\(/, 'fetch('],
    [/XMLHttpRequest/, 'XMLHttpRequest'],
    [/\bimport\s*\(/, 'dynamische import()'],
    [/new\s+WebSocket/, 'WebSocket'],
    [/new\s+EventSource/, 'EventSource'],
    [/navigator\.sendBeacon/, 'sendBeacon'],
    [/https?:\/\/(?!www\.w3\.org)/, 'externe URL'],
    [/\/\/(?:cdn|unpkg|jsdelivr)/, 'CDN']
  ];
  const treffers = [];
  for (const p of bestanden) {
    const bron = fs.readFileSync(p, 'utf8');
    for (const [re, label] of verboden) {
      const m = bron.match(re);
      if (m) treffers.push(path.relative(WORTEL, p) + ': ' + label);
    }
  }
  meld(4, 'Offline', treffers.length === 0 ? 'v' : 'x',
       treffers.length === 0
         ? bestanden.length + ' bestanden, geen fetch/XHR/websocket/externe URL; browsercontrole apart'
         : treffers.join(' | '));
}

function controle5Eenheden(fase) {
  if (fase < 2 || !WR.analyse) { meld(5, 'Eenheden', '-', 'nog geen grootheden'); return; }
  const mis = [];
  for (const [sleutel, def] of Object.entries(WR.analyse.GROOTHEDEN)) {
    if (!def.eenheid && def.eenheid !== '') mis.push(sleutel + ': eenheid');
    if (typeof def.decimalen !== 'number') mis.push(sleutel + ': decimalen');
    if (!def.label) mis.push(sleutel + ': label');
  }
  const n = Object.keys(WR.analyse.GROOTHEDEN).length;
  meld(5, 'Eenheden', mis.length === 0 ? 'v' : 'x',
       mis.length === 0 ? n + ' grootheden hebben label, eenheid en vast aantal decimalen'
                        : mis.join(', '));
}

function controle6Herleidbaar(fase) {
  if (fase < 2 || !WR.analyse) { meld(6, 'Herleidbaarheid', '-', 'nog geen grootheden'); return; }
  const mis = [];
  for (const [sleutel, def] of Object.entries(WR.analyse.GROOTHEDEN)) {
    if (!def.formule) mis.push(sleutel + ': formule');
    if (!def.methode || def.methode.length < 20) mis.push(sleutel + ': methode');
  }
  const n = Object.keys(WR.analyse.GROOTHEDEN).length;
  meld(6, 'Herleidbaarheid', mis.length === 0 ? 'v' : 'x',
       mis.length === 0 ? n + ' grootheden hebben formule en methodebeschrijving in de interface'
                        : mis.join(', '));
}

function controle7Prestaties(fase) {
  if (fase < 1 || !WR.csv) { meld(7, 'Prestaties', '-', 'nog geen parser'); return; }
  const gen = require('./genereer_vlucht.js');
  const teksten = [];
  for (let i = 0; i < 10; i++) {
    const r = gen.genereer({ vluchtnummer: 100 + i, apogeum: 25 + i, stuwtijd: 0.24,
                             ruis: 0.15, zaad: 100 + i, nadraai: 26, maxRegels: 1500 });
    teksten.push(r.tekst);
  }
  const regels = teksten.map(t => t.split('\n').length - 3);
  const t0 = process.hrtime.bigint();
  const uitkomsten = [];
  for (let i = 0; i < 10; i++) {
    const gelezen = WR.csv.parse(teksten[i], 'perf' + i + '.csv');
    if (WR.analyse) uitkomsten.push(WR.analyse.analyseer(gelezen, WR.parameters.standaard()));
    else uitkomsten.push(gelezen);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const ok = ms < 2000;
  meld(7, 'Prestaties', ok ? 'v' : 'x',
       '10 vluchten van ' + Math.min.apply(null, regels) + ' metingen: inlezen en rekenen ' +
       nl(ms / 1000, 2) + ' s (tekenen apart in de browser gemeten)');
}

function controle8Aannames(fase) {
  if (fase < 2 || !WR.parameters) { meld(8, 'Geen stille aannames', '-', 'nog geen parameters'); return; }
  const mis = [];
  const p = WR.parameters.DEFINITIES;
  for (const [sleutel, def] of Object.entries(p)) {
    if (def.standaard === undefined) mis.push(sleutel + ': standaardwaarde');
    if (!def.label) mis.push(sleutel + ': label');
    if (def.eenheid === undefined) mis.push(sleutel + ': eenheid');
    if (!def.uitleg || def.uitleg.length < 15) mis.push(sleutel + ': uitleg');
    if (def.instelbaar === undefined) mis.push(sleutel + ': instelbaar-vlag');
  }
  // elke parameter moet ook echt in de interface komen
  const htmlPad = path.join(WORTEL, 'webapp', 'index.html');
  const html = fs.existsSync(htmlPad) ? fs.readFileSync(htmlPad, 'utf8') : '';
  const paneel = /id="paneel-aannames"|id="aannames"/.test(html);
  if (!paneel) mis.push('index.html mist het paneel met aannames');
  const n = Object.keys(p).length;
  meld(8, 'Geen stille aannames', mis.length === 0 ? 'v' : 'x',
       mis.length === 0 ? n + ' parameters met label, eenheid, standaardwaarde en uitleg, allemaal instelbaar in de interface'
                        : mis.join(', '));
}

// ---------------------------------------------------------------------------
// huisregels: geen em-dashes in interface en documentatie
// ---------------------------------------------------------------------------
function huisregels() {
  const doelen = [path.join(WORTEL, 'webapp'), path.join(WORTEL, 'test'),
                  path.join(WORTEL, 'docs', 'PWS_Waterraket_Analyse_Formules.md')];
  // het teken zelf niet letterlijk opschrijven, anders vindt de controle zichzelf
  const EMDASH = String.fromCharCode(0x2014);
  const treffers = [];
  function scan(p) {
    if (!fs.existsSync(p)) return;
    if (fs.statSync(p).isDirectory()) {
      for (const naam of fs.readdirSync(p)) scan(path.join(p, naam));
      return;
    }
    if (!/\.(html|js|css|md|json|csv)$/.test(p)) return;
    const bron = fs.readFileSync(p, 'utf8');
    if (bron.includes(EMDASH)) treffers.push(path.relative(WORTEL, p));
  }
  doelen.forEach(scan);
  return treffers;
}

// ---------------------------------------------------------------------------
// extra: Monte-Carlo dekking van de onzekerheidsband (fase 3)
// ---------------------------------------------------------------------------
function dekkingsproef(n) {
  const gen = require('./genereer_vlucht.js');
  let binnen = 0, som = 0, somAbs = 0;
  for (let i = 0; i < n; i++) {
    const r = gen.genereer({ vluchtnummer: 500 + i, apogeum: 30, stuwtijd: 0.25, ruis: 0.40, zaad: 5000 + i });
    const a = WR.analyse.analyseer(WR.csv.parse(r.tekst, 'mc.csv'), WR.parameters.standaard());
    const afw = a.apogeum.waarde - r.waar.apogeum_m;
    som += afw; somAbs += Math.abs(afw);
    if (Math.abs(afw) <= a.apogeum.onzekerheid) binnen++;
  }
  return { n, dekking: binnen / n, bias: som / n, gemAbs: somAbs / n };
}

// ---------------------------------------------------------------------------
// uitvoeren
// ---------------------------------------------------------------------------
function main() {
  const fase = FASE;
  controle1Regressie(fase);
  controle2Numeriek(fase);
  controle3Randgevallen(fase);
  controle4Offline(fase);
  controle5Eenheden(fase);
  controle6Herleidbaar(fase);
  controle7Prestaties(fase);
  controle8Aannames(fase);

  console.log('gauntlet, fase ' + (fase === 99 ? 'alles' : fase) +
              '   (modules geladen: ' + (GELADEN.join(', ') || 'geen') + ')');
  console.log('='.repeat(78));
  for (const u of uitslagen) {
    const teken = u.status === 'v' ? 'v' : (u.status === 'x' ? 'X' : '-');
    console.log(teken + ' ' + u.nummer + '. ' + u.naam);
    if (u.toelichting) {
      for (const regel of u.toelichting.split('; ')) console.log('     ' + regel);
    }
  }
  const em = huisregels();
  console.log((em.length === 0 ? 'v' : 'X') + ' huisregel: geen em-dashes' +
              (em.length ? ' -> ' + em.join(', ') : ''));

  if (BREED && WR.analyse) {
    const d = dekkingsproef(200);
    console.log('\nMonte-Carlo (200 ruisige vluchten, ruis 0,40 m):');
    console.log('  dekking van de band : ' + nl(100 * d.dekking, 1) + ' %');
    console.log('  systematische fout  : ' + nl(d.bias, 3) + ' m');
    console.log('  gemiddelde |afwijking|: ' + nl(d.gemAbs, 3) + ' m');
  }

  const rood = uitslagen.filter(u => u.status === 'x').length + (em.length ? 1 : 0);
  console.log('\n' + (rood === 0 ? 'GROEN: alles slaagt' : 'ROOD: ' + rood + ' controle(s) gezakt'));
  process.exitCode = rood === 0 ? 0 : 1;
}

main();
