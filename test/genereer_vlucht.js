#!/usr/bin/env node
/*
  genereer_vlucht.js  -  synthetische waterraketvluchten met bekende uitkomst

  Doel: een meetlat voor de analyse-webapplicatie. De generator simuleert een
  vlucht met RK4, zoekt met bisectie de stuwkracht die precies de opgegeven
  apogeumhoogte oplevert, en schrijft die vlucht weg in exact het CSV-formaat
  van de vluchtcomputer (firmware/PWS_Waterraket_ESP32-S3-Touch_sketch.ino).

  Let op: het stuwprofiel is een fenomenologische vorm, geen fysisch
  waterraketmodel. De generator hoort de werkelijkheid niet te voorspellen,
  hij hoort een trajectorie te leveren waarvan de uitkomst exact bekend is.
  Het fysische waterraketmodel zit in webapp/js/kern/theorie.js en is
  bewust onafhankelijk van deze generator.

  Naast elk CSV-bestand komt test/data/verwacht.json met de werkelijke
  waarden, zodat de gauntlet nergens hoeft te gokken.

  Gebruik:
    node test/genereer_vlucht.js --alles
    node test/genereer_vlucht.js --uit test/data/eigen.csv --apogeum 45 --ruis 0.2
*/

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// natuurconstanten en vaste keuzes van de generator
// ---------------------------------------------------------------------------
const G          = 9.80665;    // m/s^2   valversnelling
const L_LAPSE    = 0.0065;     // K/m     temperatuurgradient standaardatmosfeer
const EXP_BARO   = 5.25588;    // -       g*M/(R*L) voor de barometrische formule
const KLIP_G     = 16.0;       // g       meetbereik van de QMI8658
const DT_SIM     = 1e-4;       // s       integratiestap RK4
const F_MONSTER  = 50;         // Hz      bemonsteringsfrequentie van de firmware

// ---------------------------------------------------------------------------
// reproduceerbare toevalsgetallen (mulberry32 + Box-Muller)
// ---------------------------------------------------------------------------
function maakRng(zaad) {
  let a = zaad >>> 0;
  let reserve = null;
  function uniform() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function normaal() {
    if (reserve !== null) { const r = reserve; reserve = null; return r; }
    let u = 0, v = 0;
    while (u === 0) u = uniform();
    while (v === 0) v = uniform();
    const r = Math.sqrt(-2 * Math.log(u));
    reserve = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }
  return { uniform, normaal };
}

// ---------------------------------------------------------------------------
// stuwprofiel: snelle opbouw, afgeronde piek, snelle terugval.
// vorm(tau) = tau^0.35 * (1-tau)^0.45, genormeerd op piek 1.
// ---------------------------------------------------------------------------
function stuwVorm(tau) {
  if (tau <= 0 || tau >= 1) return 0;
  return Math.pow(tau, 0.35) * Math.pow(1 - tau, 0.45);
}
const STUW_PIEK = (function () {
  let m = 0;
  for (let i = 1; i < 10000; i++) m = Math.max(m, stuwVorm(i / 10000));
  return m;
})();

// ---------------------------------------------------------------------------
// bewegingsvergelijking
//   dv/dt = a_stuw(t) - g - sign(v) * k(v) * v^2
// met aparte weerstandsconstante voor stijgen (op de neus) en dalen (tuimelend).
// Zolang de raket nog op de lanceerinstallatie staat en de stuwkracht het
// gewicht niet overwint, draagt de installatie de raket: a = 0.
// ---------------------------------------------------------------------------
function versnelling(t, v, opt, h) {
  let stuw = 0;
  if (t >= 0 && t < opt.stuwtijd) {
    stuw = opt.aPiek * stuwVorm(t / opt.stuwtijd) / STUW_PIEK;
  }
  if (h !== undefined && h <= 0 && v <= 0 && stuw <= G) return 0;   // steunt op de installatie
  const k = v >= 0 ? opt.kOp : opt.kNeer;
  return stuw - G - Math.sign(v) * k * v * v;
}

// RK4 over hoogte en snelheid; levert de volledige trajectorie op simulatieraster
function simuleer(opt) {
  const dt = DT_SIM;
  let t = 0, h = 0, v = 0;
  const rij = [{ t: 0, h: 0, v: 0, a: versnelling(0, 0, opt, 0) }];
  const tMax = opt.maxDuur;
  let geland = false;
  let tLanding = null;

  while (t < tMax) {
    const k1v = versnelling(t, v, opt, h),              k1h = v;
    const k2v = versnelling(t + dt / 2, v + dt / 2 * k1v, opt, h + dt / 2 * v), k2h = v + dt / 2 * k1v;
    const k3v = versnelling(t + dt / 2, v + dt / 2 * k2v, opt, h + dt / 2 * k2h), k3h = v + dt / 2 * k2v;
    const k4v = versnelling(t + dt, v + dt * k3v, opt, h + dt * k3h),  k4h = v + dt * k3v;

    const vN = v + dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
    const hN = h + dt / 6 * (k1h + 2 * k2h + 2 * k3h + k4h);
    const tN = t + dt;

    if (hN <= 0 && tN > opt.stuwtijd) {
      // landingsmoment lineair interpoleren en daarna stilliggen
      const f = h / (h - hN);
      tLanding = t + f * dt;
      geland = true;
      t = tLanding; h = 0; v = 0;
      rij.push({ t, h: 0, v: 0, a: 0 });
      break;
    }
    t = tN; h = hN; v = vN;
    rij.push({ t, h, v, a: versnelling(t, v, opt, h) });
  }
  return { rij, geland, tLanding };
}

// apogeum uit de simulatie halen: exacte top via de parabool door drie punten
function apogeumVan(rij) {
  let iTop = 0;
  for (let i = 1; i < rij.length; i++) if (rij[i].h > rij[iTop].h) iTop = i;
  if (iTop === 0 || iTop === rij.length - 1) return { hoogte: rij[iTop].h, tijd: rij[iTop].t };
  const y0 = rij[iTop - 1].h, y1 = rij[iTop].h, y2 = rij[iTop + 1].h;
  const noemer = y0 - 2 * y1 + y2;
  const d = noemer === 0 ? 0 : 0.5 * (y0 - y2) / noemer;
  const dt = rij[iTop + 1].t - rij[iTop].t;
  return { hoogte: y1 - 0.25 * (y0 - y2) * d, tijd: rij[iTop].t + d * dt };
}

// bisectie op de piekstuwversnelling tot het apogeum de doelwaarde raakt
function zoekStuw(opt, doel) {
  let lo = 1, hi = 4000, res = null;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    res = simuleer(Object.assign({}, opt, { aPiek: mid }));
    const top = apogeumVan(res.rij);
    if (Math.abs(top.hoogte - doel) < 1e-7) return { aPiek: mid, sim: res, top };
    if (top.hoogte < doel) lo = mid; else hi = mid;
  }
  const sim = simuleer(Object.assign({}, opt, { aPiek: 0.5 * (lo + hi) }));
  return { aPiek: 0.5 * (lo + hi), sim, top: apogeumVan(sim.rij) };
}

// ---------------------------------------------------------------------------
// bemonsteren op 50 Hz en wegschrijven in het firmwareformaat
// ---------------------------------------------------------------------------
function interpoleer(rij, t) {
  if (t <= rij[0].t) return rij[0];
  const laatste = rij[rij.length - 1];
  if (t >= laatste.t) return laatste;
  let lo = 0, hi = rij.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (rij[mid].t <= t) lo = mid; else hi = mid;
  }
  const f = (t - rij[lo].t) / (rij[hi].t - rij[lo].t);
  return {
    t,
    h: rij[lo].h + f * (rij[hi].h - rij[lo].h),
    v: rij[lo].v + f * (rij[hi].v - rij[lo].v),
    a: rij[lo].a + f * (rij[hi].a - rij[lo].a)
  };
}

function drukBij(hoogte, tempGrond, p0) {
  const T0 = tempGrond + 273.15;
  return p0 * Math.pow(1 - (L_LAPSE * hoogte) / T0, EXP_BARO);
}

function klip(x) { return Math.max(-KLIP_G, Math.min(KLIP_G, x)); }

function genereer(opties) {
  const opt = Object.assign({
    vluchtnummer: 1,
    gestart: '2026-08-09 14:07',
    apogeum: 30.0,
    stuwtijd: 0.25,
    ruis: 0.05,          // m, standaardafwijking van de hoogtemeting
    ruisAccel: 0.02,     // g, standaardafwijking per as
    zaad: 1,
    voorloop: 0.6,       // s rust voor de lancering (negatieve t_ms, pre-triggerbuffer)
    nadraai: 3.0,        // s doorloggen na de landing (firmware: 3 s onder 2 m)
    landingsschok: true,
    tempGrond: 21.3,
    drukGrond: 1013.40,
    kOp: 0.0066,         // 1/m, 0.5*rho*Cw*A/m tijdens het stijgen
    kNeer: 0.030,        // 1/m, tuimelend dalen ligt hoger
    maxDuur: 30.0,       // s, MAX_LOG_S van de firmware
    maxRegels: null,     // niet-null: log hier afkappen (randgeval)
    crlfKop: true        // firmware schrijft de kopregel met println (CRLF)
  }, opties);

  const gevonden = zoekStuw(opt, opt.apogeum);
  const rij = gevonden.sim.rij;
  const top = gevonden.top;
  const tEind = rij[rij.length - 1].t;
  const tLanding = gevonden.sim.geland ? gevonden.sim.tLanding : null;

  const rng = maakRng(opt.zaad);
  const dt = 1 / F_MONSTER;
  const monsters = [];

  const tStart = -opt.voorloop;
  const tStop = (tLanding !== null ? tLanding + opt.nadraai : tEind);

  for (let t = tStart; t <= tStop + 1e-9; t += dt) {
    const tAfg = Math.round(t * 1000) / 1000;
    let h, v, aKin;
    if (tAfg < 0) { h = 0; v = 0; aKin = 0; }
    else if (tLanding !== null && tAfg > tLanding) { h = 0; v = 0; aKin = 0; }
    else { const s = interpoleer(rij, tAfg); h = s.h; v = s.v; aKin = s.a; }

    const hRuis = h + opt.ruis * rng.normaal();
    // specifieke kracht: wat een versnellingsmeter meet. In rust 1 g, in vrije val 0.
    let az = (aKin + G) / G + opt.ruisAccel * rng.normaal();
    let ax = opt.ruisAccel * rng.normaal();
    let ay = opt.ruisAccel * rng.normaal();
    if (tAfg >= 0 && tAfg < opt.stuwtijd) {          // lichte zijdelingse trilling in de stuwfase
      ax += 0.35 * Math.sin(2 * Math.PI * 37 * tAfg);
      ay += 0.30 * Math.cos(2 * Math.PI * 41 * tAfg);
    }
    if (opt.landingsschok && tLanding !== null &&
        tAfg > tLanding && tAfg <= tLanding + 2 * dt) {
      az += 40;                                       // inslag, klipt op 16 g
    }

    const temp = opt.tempGrond - L_LAPSE * Math.max(h, 0) + 0.05 * rng.normaal();
    const druk = drukBij(hRuis, opt.tempGrond, opt.drukGrond);

    monsters.push({
      t_ms: Math.round(tAfg * 1000),
      hoogte: hRuis,
      druk,
      temp,
      ax: klip(ax), ay: klip(ay), az: klip(az),
      hWaar: h, vWaar: v
    });
  }

  const gebruikt = opt.maxRegels === null ? monsters : monsters.slice(0, opt.maxRegels);

  const nl = '\n';
  let tekst = '# vlucht ' + opt.vluchtnummer + ', gestart ' + opt.gestart + nl;
  tekst += 't_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g' + (opt.crlfKop ? '\r\n' : nl);
  for (const m of gebruikt) {
    tekst += m.t_ms + ',' + m.hoogte.toFixed(2) + ',' + m.druk.toFixed(2) + ',' +
             m.temp.toFixed(1) + ',' + m.ax.toFixed(2) + ',' + m.ay.toFixed(2) + ',' +
             m.az.toFixed(2) + nl;
  }

  return { tekst, monsters: gebruikt, opt, waar: waarheid(gebruikt, rij, top, opt, tLanding) };
}

// ---------------------------------------------------------------------------
// de werkelijke waarden, uit de ruisvrije simulatie
// ---------------------------------------------------------------------------
function waarheid(monsters, rij, top, opt, tLanding) {
  const drempelStuwG = 3.0;      // dezelfde standaarddrempel als de applicatie
  const drempelHoogte = 3.0;     // LAUNCH_RISE_M van de firmware
  // alleen het deel van de simulatie dat ook echt in het bestand staat telt mee
  const tEindBestand = monsters.length ? monsters[monsters.length - 1].t_ms / 1000 : 0;

  // maximale stijgsnelheid uit de ruisvrije simulatie
  let vMax = 0, tvMax = 0;
  for (const p of rij) if (p.t <= tEindBestand && p.v > vMax) { vMax = p.v; tvMax = p.t; }

  // specifieke kracht zonder ruis, om de stuwtijd boven de drempel te bepalen
  let stuwStart = null, stuwEind = null, aMaxStuw = 0;
  for (const p of rij) {
    if (p.t > tEindBestand) break;
    const sf = (p.a + G) / G;
    if (p.t >= 0 && p.t < opt.stuwtijd) aMaxStuw = Math.max(aMaxStuw, Math.min(sf, KLIP_G));
    if (sf > drempelStuwG) {
      if (stuwStart === null) stuwStart = p.t;
      if (stuwEind === null || p.t - stuwEind < 5 * DT_SIM) stuwEind = p.t;
    }
  }

  // vluchttijd: eerste tot laatste ruisvrije monster boven de hoogtedrempel
  let tEerst = null, tLaatst = null;
  for (const m of monsters) {
    if (m.hWaar > drempelHoogte) {
      if (tEerst === null) tEerst = m.t_ms / 1000;
      tLaatst = m.t_ms / 1000;
    }
  }

  // daalsnelheid over de laatste 30 % van de daling (apogeum tot drempelpassage)
  let daal = null;
  if (tEerst !== null && tLaatst !== null && tLaatst > top.tijd) {
    const t1 = top.tijd + 0.70 * (tLaatst - top.tijd);
    const a = interpoleer(rij, t1), b = interpoleer(rij, tLaatst);
    daal = (b.h - a.h) / (b.t - a.t);
  }

  // wat er werkelijk in het bestand staat: bij een afgekapt log is dat niet de
  // top van de simulatie maar de hoogste ruisvrije waarde die nog geschreven is
  const tLaatsteRegel = monsters.length ? monsters[monsters.length - 1].t_ms / 1000 : null;
  const afgekapt = tLanding !== null && tLaatsteRegel !== null &&
                   tLaatsteRegel < tLanding - 1e-9;
  let hoogsteInBestand = null, tHoogsteInBestand = null;
  for (const m of monsters) {
    if (hoogsteInBestand === null || m.hWaar > hoogsteInBestand) {
      hoogsteInBestand = m.hWaar; tHoogsteInBestand = m.t_ms / 1000;
    }
  }

  return {
    afgekapt,
    apogeum_m: afgekapt ? hoogsteInBestand : top.hoogte,
    t_apogeum_s: afgekapt ? tHoogsteInBestand : top.tijd,
    apogeum_simulatie_m: top.hoogte,
    v_max_ms: vMax,
    t_v_max_s: tvMax,
    a_max_stuw_g: aMaxStuw,
    stuwtijd_nominaal_s: opt.stuwtijd,
    stuwtijd_boven_drempel_s: (stuwStart !== null && stuwEind !== null) ? stuwEind - stuwStart : null,
    stuw_drempel_g: drempelStuwG,
    vluchttijd_s: (tEerst !== null && tLaatst !== null) ? tLaatst - tEerst : null,
    hoogte_drempel_m: drempelHoogte,
    daalsnelheid_ms: daal,
    t_landing_s: tLanding,
    ruis_sd_m: opt.ruis,
    aantal_regels: monsters.length,
    voorloop_s: opt.voorloop
  };
}

// ---------------------------------------------------------------------------
// standaardset
// ---------------------------------------------------------------------------
const SET = [
  { bestand: 'vlucht_schoon.csv',     omschrijving: 'schone vlucht, apogeum 30,0 m, ruis 0,05 m',
    opt: { vluchtnummer: 1, gestart: '2026-08-09 14:07', apogeum: 30.0, stuwtijd: 0.25, ruis: 0.05, zaad: 1 } },
  { bestand: 'vlucht_ruisig.csv',     omschrijving: 'ruisige vlucht, apogeum 30,0 m, ruis 0,40 m',
    opt: { vluchtnummer: 2, gestart: '2026-08-09 14:31', apogeum: 30.0, stuwtijd: 0.25, ruis: 0.40, zaad: 2 } },
  { bestand: 'vlucht_afgebroken.csv', omschrijving: 'randgeval: log breekt af na 12 regels',
    opt: { vluchtnummer: 3, gestart: '2026-08-09 14:52', apogeum: 30.0, stuwtijd: 0.25, ruis: 0.05, zaad: 3,
           voorloop: 0.1, maxRegels: 12 } },
  { bestand: 'vlucht_zonder_rust.csv', omschrijving: 'log begint pas bij de lanceerdetectie, geen rustperiode',
    opt: { vluchtnummer: 4, gestart: '2026-08-09 15:10', apogeum: 26.0, stuwtijd: 0.28, ruis: 0.12, zaad: 4,
           voorloop: 0 } },
  { bestand: 'vlucht_klipt.csv',      omschrijving: 'korte harde stuwfase, versnelling klipt op 16 g',
    opt: { vluchtnummer: 5, gestart: '2026-08-09 15:28', apogeum: 42.0, stuwtijd: 0.14, ruis: 0.08, zaad: 5 } },
  { bestand: 'vlucht_laag.csv',       omschrijving: 'randgeval: komt nooit boven de hoogtedrempel',
    opt: { vluchtnummer: 6, gestart: '2026-08-09 15:44', apogeum: 1.2, stuwtijd: 0.20, ruis: 0.05, zaad: 6 } }
];

function schrijfSet(map) {
  fs.mkdirSync(map, { recursive: true });
  const index = {};
  for (const item of SET) {
    const r = genereer(item.opt);
    const pad = path.join(map, item.bestand);
    fs.writeFileSync(pad, r.tekst);
    index[item.bestand] = Object.assign({ omschrijving: item.omschrijving }, r.waar);
    console.log(item.bestand.padEnd(24) + r.monsters.length.toString().padStart(5) + ' regels   ' +
                'apogeum ' + r.waar.apogeum_m.toFixed(3) + ' m');
  }
  fs.writeFileSync(path.join(map, 'verwacht.json'), JSON.stringify(index, null, 2) + '\n');
  console.log('\nverwachte waarden weggeschreven naar ' + path.join(map, 'verwacht.json'));
}

// ---------------------------------------------------------------------------
// opdrachtregel
// ---------------------------------------------------------------------------
function main(argv) {
  const arg = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const sleutel = argv[i].slice(2);
      const volgend = argv[i + 1];
      if (volgend === undefined || volgend.startsWith('--')) arg[sleutel] = true;
      else { arg[sleutel] = volgend; i++; }
    }
  }
  if (arg.help) {
    console.log('gebruik: node test/genereer_vlucht.js --alles');
    console.log('         node test/genereer_vlucht.js --uit <pad> [--apogeum 30] [--stuwtijd 0.25]');
    console.log('                                      [--ruis 0.05] [--zaad 1] [--voorloop 0.6]');
    console.log('                                      [--nummer 1] [--regels N]');
    return;
  }
  if (arg.alles || Object.keys(arg).length === 0) {
    schrijfSet(path.join(__dirname, 'data'));
    return;
  }
  const opt = {};
  if (arg.apogeum)  opt.apogeum = parseFloat(arg.apogeum);
  if (arg.stuwtijd) opt.stuwtijd = parseFloat(arg.stuwtijd);
  if (arg.ruis)     opt.ruis = parseFloat(arg.ruis);
  if (arg.zaad)     opt.zaad = parseInt(arg.zaad, 10);
  if (arg.voorloop !== undefined) opt.voorloop = parseFloat(arg.voorloop);
  if (arg.nummer)   opt.vluchtnummer = parseInt(arg.nummer, 10);
  if (arg.regels)   opt.maxRegels = parseInt(arg.regels, 10);
  const r = genereer(opt);
  const uit = arg.uit || 'vlucht.csv';
  fs.writeFileSync(uit, r.tekst);
  console.log(uit + ': ' + r.monsters.length + ' regels, apogeum ' + r.waar.apogeum_m.toFixed(3) + ' m');
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { genereer, simuleer, maakRng, SET, schrijfSet };
