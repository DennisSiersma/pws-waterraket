/*
  theorie.js  -  het theoretische model naast de meting

  Twee fasen:

  1. Stuwfase. De samengeperste lucht in de fles zet uit en drukt het water door
     de nozzle naar buiten. De druk volgt uit de expansie van de lucht,
     p * V^gamma = constant. De uitstroomsnelheid volgt uit Bernoulli,
     v_e = sqrt(2 (p - p_atm) / rho_water), en de stuwkracht is de
     impulsstroom van dat water: F = m_punt * v_e = 2 Cd A_n (p - p_atm).
     De massa van de raket neemt af doordat het water eruit gaat.

  2. Ballistische fase. Zodra het water op is houdt de stuw op. Daarna geldt
     alleen de zwaartekracht en de luchtweerstand, tot de snelheid nul is.
     Dat punt is het theoretische apogeum.

  Elke aanname die hierin zit komt terug in de lijst die de interface toont.
  Het model is bewust onafhankelijk van de generator in test/, zodat de
  vergelijking tussen theorie en meting iets betekent.
*/
(function (root) {
  'use strict';

  var T = {};
  var R_LUCHT = 287.05;         // J/(kg K), specifieke gasconstante van droge lucht

  T.standaardInvoer = function () {
    var p = root.WR.parameters ? root.WR.parameters.standaard() : {};
    return {
      begindruk_bar: 5.0,                                  // overdruk op de manometer
      vulfractie: 0.33,                                    // deel van het flesvolume met water
      nozzle_mm: 9.0,
      leegmassa_kg: 0.120,
      flesvolume_l: p.theorie_flesvolume_l !== undefined ? p.theorie_flesvolume_l : 1.5,
      flesdiameter_mm: p.theorie_flesdiameter_mm !== undefined ? p.theorie_flesdiameter_mm : 88,
      gamma: p.theorie_gamma !== undefined ? p.theorie_gamma : 1.4,
      cd_nozzle: p.theorie_cd_nozzle !== undefined ? p.theorie_cd_nozzle : 0.97,
      cw: p.theorie_cw !== undefined ? p.theorie_cw : 0.45,
      rho_water: p.theorie_rho_water !== undefined ? p.theorie_rho_water : 998,
      rho_lucht: p.theorie_rho_lucht !== undefined ? p.theorie_rho_lucht : 1.225,
      patm_hpa: p.theorie_patm_hpa !== undefined ? p.theorie_patm_hpa : 1013.25,
      g: p.theorie_g !== undefined ? p.theorie_g : 9.81,
      dt_stuw: 2e-5,
      dt_val: 1e-3
    };
  };

  // luchtdichtheid uit de gemeten omgevingswaarden, rho = p / (R T)
  T.luchtdichtheid = function (druk_hpa, temp_c) {
    if (!isFinite(druk_hpa) || !isFinite(temp_c)) return NaN;
    return (druk_hpa * 100) / (R_LUCHT * (temp_c + 273.15));
  };

  function aannameLijst(inv, uit) {
    return [
      { tekst: 'De lucht in de fles zet ' +
          (inv.gamma > 1.05 ? 'adiabatisch' : 'isotherm') + ' uit: p V^gamma is constant.',
        waarde: 'gamma = ' + nl(inv.gamma, 2) },
      { tekst: 'Het water is onsamendrukbaar en heeft een vaste dichtheid.',
        waarde: 'rho_water = ' + nl(inv.rho_water, 0) + ' kg/m3' },
      { tekst: 'De uitstroomsnelheid volgt uit Bernoulli, v_e = sqrt(2 (p - p_atm) / rho_water). ' +
          'De doorsnede van de fles is verwaarloosd ten opzichte van die van de nozzle.',
        waarde: 'A_nozzle = ' + nl(uit.nozzle_oppervlak_mm2, 1) + ' mm2' },
      { tekst: 'Een uitstroomcoefficient verrekent de vernauwing van de straal in de nozzle.',
        waarde: 'Cd = ' + nl(inv.cd_nozzle, 2) },
      { tekst: 'De stuwkracht is de impulsstroom van het uitstromende water, F = 2 Cd A_n (p - p_atm).',
        waarde: 'F bij de start = ' + nl(uit.stuwkracht_start_n, 1) + ' N' },
      { tekst: 'Zodra het water op is houdt de stuw op. De perslucht die dan nog uitstroomt levert ' +
          'in dit model geen stuw meer. Daardoor valt de berekende hoogte iets aan de lage kant.',
        waarde: 'stuwtijd = ' + nl(uit.stuwtijd_s, 3) + ' s' },
      { tekst: 'De luchtweerstand is 0,5 rho_lucht Cw A v^2 met een vaste weerstandscoefficient en ' +
          'een vaste frontale oppervlakte, gelijk aan de dwarsdoorsnede van de fles.',
        waarde: 'Cw = ' + nl(inv.cw, 2) + ', A = ' + nl(uit.frontaal_cm2, 1) + ' cm2' },
      { tekst: 'De dichtheid van de buitenlucht is constant over de hele vlucht.',
        waarde: 'rho_lucht = ' + nl(inv.rho_lucht, 3) + ' kg/m3' },
      { tekst: 'De raket vliegt recht omhoog. Er is geen wind en geen hoek met de verticaal, ' +
          'en de raket tuimelt niet tijdens het stijgen.',
        waarde: '-' },
      { tekst: 'De massa van de lucht in de fles telt niet mee in de massa van de raket.',
        waarde: 'leegmassa = ' + nl(inv.leegmassa_kg * 1000, 0) + ' g' },
      { tekst: 'De valversnelling is constant.',
        waarde: 'g = ' + nl(inv.g, 2) + ' m/s2' },
      { tekst: 'De begindruk op de manometer is de overdruk boven de luchtdruk ter plaatse.',
        waarde: 'p0 = ' + nl(inv.begindruk_bar, 2) + ' bar over ' + nl(inv.patm_hpa, 1) + ' hPa' }
    ];
  }

  function nl(x, d) {
    if (x === null || x === undefined || !isFinite(x)) return '?';
    return x.toFixed(d).replace('.', ',');
  }

  /*
    bereken(inv) -> {apogeum_m, t_apogeum_s, baan, aannames, ...}

    Ontbreekt er iets belangrijks, dan komt er een resultaat terug met
    apogeum_m === null en een uitleg in fouten. Er wordt niets ingevuld.
  */
  T.bereken = function (invoer) {
    var inv = {};
    var basis = T.standaardInvoer();
    for (var k in basis) if (Object.prototype.hasOwnProperty.call(basis, k)) inv[k] = basis[k];
    if (invoer) for (var k2 in invoer) if (Object.prototype.hasOwnProperty.call(invoer, k2)) inv[k2] = invoer[k2];

    var uit = { fouten: [], waarschuwingen: [], invoer: inv, apogeum_m: null, baan: [], aannames: [] };

    var nodig = [['begindruk_bar', 'begindruk'], ['vulfractie', 'vulfractie'],
                 ['nozzle_mm', 'nozzlediameter'], ['leegmassa_kg', 'massa']];
    for (var i = 0; i < nodig.length; i++) {
      var w = inv[nodig[i][0]];
      if (typeof w !== 'number' || !isFinite(w)) {
        uit.fouten.push('De ' + nodig[i][1] + ' ontbreekt, dus de theoretische hoogte is niet ' +
                        'te berekenen.');
      }
    }
    if (uit.fouten.length) { uit.aannames = []; return uit; }

    var patm = inv.patm_hpa * 100;
    var p0 = inv.begindruk_bar * 1e5 + patm;
    var Vfles = inv.flesvolume_l / 1000;
    var Vlucht0 = (1 - inv.vulfractie) * Vfles;
    var An = Math.PI * Math.pow(inv.nozzle_mm / 1000, 2) / 4;
    var Afront = Math.PI * Math.pow(inv.flesdiameter_mm / 1000, 2) / 4;

    uit.nozzle_oppervlak_mm2 = An * 1e6;
    uit.frontaal_cm2 = Afront * 1e4;
    uit.stuwkracht_start_n = 2 * inv.cd_nozzle * An * (p0 - patm);

    if (inv.vulfractie <= 0) {
      uit.fouten.push('Zonder water is er in dit model geen stuwfase. Vul een vulfractie groter ' +
                      'dan nul in.');
    }
    if (inv.vulfractie >= 1) {
      uit.fouten.push('Met de fles helemaal vol water kan de lucht niet uitzetten en is er geen ' +
                      'stuwkracht.');
    }
    if (p0 <= patm) {
      uit.fouten.push('De begindruk is niet hoger dan de luchtdruk, dus er stroomt geen water uit.');
    }
    if (uit.fouten.length) { uit.aannames = aannameLijst(inv, uit); return uit; }

    // ---- stuwfase --------------------------------------------------------
    var Vl = Vlucht0, v = 0, h = 0, t = 0;
    var dt = inv.dt_stuw;
    var baan = [{ t: 0, h: 0, v: 0, fase: 'stuw' }];
    var hMax = 0;
    var stappen = 0, maxStappen = 4000000;

    function massaBij(Vlucht) {
      var Vwater = Math.max(0, Vfles - Vlucht);
      return inv.leegmassa_kg + inv.rho_water * Vwater;
    }
    function drukBij(Vlucht) {
      return p0 * Math.pow(Vlucht0 / Vlucht, inv.gamma);
    }
    function stuwBij(Vlucht) {
      var dp = drukBij(Vlucht) - patm;
      if (dp <= 0) return { F: 0, dV: 0, dp: 0 };
      var ve = Math.sqrt(2 * dp / inv.rho_water);
      var dV = inv.cd_nozzle * An * ve;
      return { F: inv.rho_water * dV * ve, dV: dV, dp: dp, ve: ve };
    }
    function weerstand(snelheid) {
      return 0.5 * inv.rho_lucht * inv.cw * Afront * snelheid * Math.abs(snelheid);
    }

    var drukOp = false;
    while (Vl < Vfles && stappen++ < maxStappen) {
      var st = stuwBij(Vl);
      if (st.dp <= 0) { drukOp = true; break; }
      var m = massaBij(Vl);
      var a = (st.F - m * inv.g - weerstand(v)) / m;
      // zolang de raket op de lanceerinstallatie staat draagt die het gewicht:
      // de stuw moet het gewicht eerst overwinnen voor er iets beweegt
      if (h <= 0 && v <= 0 && a < 0) { a = 0; v = 0; }
      // expliciete stap; dt is klein genoeg dat RK4 hier niets toevoegt
      v += a * dt;
      h += v * dt;
      if (h < 0) { h = 0; v = 0; }
      if (h > hMax) hMax = h;
      Vl += st.dV * dt;
      t += dt;
      if (Vl > Vfles) {
        // laatste stap terugschalen naar het moment dat het water op is
        Vl = Vfles;
      }
      if (baan.length === 0 || t - baan[baan.length - 1].t >= 0.005) {
        baan.push({ t: t, h: h, v: v, fase: 'stuw' });
      }
    }
    uit.stuwtijd_s = t;
    uit.v_burnout_ms = v;
    uit.h_burnout_m = h;
    uit.massa_start_kg = massaBij(Vlucht0);
    uit.water_over_l = Math.max(0, Vfles - Vl) * 1000;
    if (drukOp && uit.water_over_l > 1e-3) {
      uit.waarschuwingen.push('De druk in de fles zakt tot de buitenluchtdruk terwijl er nog ' +
        nl(uit.water_over_l, 2) + ' L water in zit. Dat water gaat als dode massa mee omhoog. ' +
        'Met minder water of een hogere begindruk komt de raket hoger.');
      uit.leegmassa_effectief_kg = inv.leegmassa_kg + inv.rho_water * (Vfles - Vl);
    }

    if (v <= 0) {
      uit.waarschuwingen.push('Aan het eind van de stuwfase is de snelheid niet meer positief: ' +
        'bij deze begindruk, nozzle en massa komt de raket ' +
        (hMax > 0.05 ? 'niet verder dan ' + nl(hMax, 2) + ' m' : 'niet los van de installatie') +
        '. Controleer de invoer.');
      uit.apogeum_m = hMax;
      uit.t_apogeum_s = t;
      uit.baan = baan;
      uit.aannames = aannameLijst(inv, uit);
      return uit;
    }

    // ---- ballistische fase ------------------------------------------------
    dt = inv.dt_val;
    // blijft er water in de fles, dan gaat dat als dode massa mee omhoog
    var mLeeg = uit.leegmassa_effectief_kg || inv.leegmassa_kg;
    stappen = 0;
    while (v > 0 && stappen++ < 200000) {
      var a2 = -inv.g - weerstand(v) / mLeeg;
      var vN = v + a2 * dt;
      var hN = h + v * dt;
      if (vN <= 0) {
        // top lineair interpoleren in de snelheid
        var f = v / (v - vN);
        t += f * dt;
        h += v * f * dt - 0.5 * inv.g * Math.pow(f * dt, 2);
        v = 0;
        break;
      }
      v = vN; h = hN; t += dt;
      if (t - baan[baan.length - 1].t >= 0.02) baan.push({ t: t, h: h, v: v, fase: 'val' });
    }
    baan.push({ t: t, h: h, v: 0, fase: 'top' });

    uit.apogeum_m = h;
    uit.t_apogeum_s = t;
    uit.baan = baan;
    uit.aannames = aannameLijst(inv, uit);
    return uit;
  };

  /* verschil tussen theorie en meting, absoluut en procentueel */
  T.vergelijk = function (theoretisch, gemeten) {
    if (theoretisch === null || gemeten === null ||
        !isFinite(theoretisch) || !isFinite(gemeten)) return null;
    var verschil = gemeten - theoretisch;
    return {
      theorie: theoretisch,
      meting: gemeten,
      verschil_m: verschil,
      verschil_pct: theoretisch !== 0 ? 100 * verschil / theoretisch : null
    };
  };

  root.WR = root.WR || {};
  root.WR.theorie = T;
})(typeof globalThis !== 'undefined' ? globalThis : this);
