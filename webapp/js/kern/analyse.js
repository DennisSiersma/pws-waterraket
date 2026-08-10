/*
  analyse.js  -  de kerngrootheden per vlucht

  Elke grootheid staat in GROOTHEDEN met haar eenheid, het aantal decimalen,
  de formule en een beschrijving van de methode. De interface haalt die tekst
  rechtstreeks op, zodat er in het verslag niets valt uit te leggen wat de
  applicatie zelf niet toont.

  De barometer is de hoofdbron voor de hoogte. De versnellingsmeter meet de
  specifieke kracht: in rust leest hij 1 g, in vrije val 0 g. Dat staat ook zo
  in de methodebeschrijving, want het is de meest gemaakte denkfout bij het
  aflezen van een versnellingsprofiel.
*/
(function (root) {
  'use strict';

  var A = {};
  var G_VAL = 9.80665;         // m/s^2, om g om te rekenen naar m/s^2

  // -------------------------------------------------------------- register

  A.GROOTHEDEN = {
    apogeum: {
      label: 'Apogeum', eenheid: 'm', decimalen: 2, groep: 'hoofd',
      formule: 'h(t) = a0 + a1 (t - t0) + a2 (t - t0)^2  ->  H = a0 - a1^2 / (4 a2)',
      methode: 'De hoogste waarde van de gefilterde hoogte wijst de top aan. Rond dat punt ' +
        'wordt over een halve venstertijd een parabool door de ongefilterde metingen gepast ' +
        'met kleinste kwadraten. Vlak bij het apogeum is de baan bijna zuiver parabolisch, ' +
        'want daar is de snelheid nul en dus ook de luchtweerstand. De top van die parabool ' +
        'ligt tussen twee metingen in en is nauwkeuriger dan het hoogste meetpunt zelf.'
    },
    tApogeum: {
      label: 'Tijd tot apogeum', eenheid: 's', decimalen: 2, groep: 'hoofd',
      formule: 't_top = t0 - a1 / (2 a2)',
      methode: 'Het tijdstip waarop de gepaste parabool haar top heeft, gerekend vanaf de ' +
        'lanceerdetectie (t = 0 in het logbestand).'
    },
    vMax: {
      label: 'Maximale stijgsnelheid', eenheid: 'm/s', decimalen: 1, groep: 'hoofd',
      formule: 'v(i) = ( h_f(i+m) - h_f(i-m) ) / ( t(i+m) - t(i-m) ),  v_max = max v(i)',
      methode: 'De snelheid is het gecentreerde verschil van de gefilterde hoogte, met halve ' +
        'stap m uit de instellingen. Let op: een breed filtervenster maakt de snelheidspiek ' +
        'lager dan hij werkelijk was, omdat de piek maar kort duurt. De vensterbreedte staat ' +
        'daarom in het paneel met aannames en is aan te passen.'
    },
    tVMax: {
      label: 'Tijd van de maximale snelheid', eenheid: 's', decimalen: 2, groep: 'hoofd',
      formule: 't bij max v(i)',
      methode: 'Het tijdstip van de hoogste stijgsnelheid. Bij een waterraket valt dat samen ' +
        'met het einde van de stuwfase.'
    },
    aMax: {
      label: 'Maximale versnelling', eenheid: 'g', decimalen: 2, groep: 'hoofd',
      formule: '|a| = sqrt(ax^2 + ay^2 + az^2),  a_max = max |a|',
      methode: 'De norm van de drie gemeten versnellingscomponenten. Dit is de specifieke ' +
        'kracht: in rust meet de sensor 1 g, in vrije val 0 g. De netto versnelling van de ' +
        'raket is dus niet gelijk aan deze waarde. Het bereik van de QMI8658 is 16 g; raakt ' +
        'de meting die grens, dan was de werkelijke versnelling hoger.'
    },
    aMaxMS2: {
      label: 'Maximale versnelling, omgerekend', eenheid: 'm/s2', decimalen: 1, groep: 'hoofd',
      formule: 'a_max [m/s2] = a_max [g] * 9,80665',
      methode: 'Dezelfde waarde als hierboven, omgerekend met de standaardvalversnelling ' +
        '9,80665 m/s2.'
    },
    tAMax: {
      label: 'Tijd van de maximale versnelling', eenheid: 's', decimalen: 2, groep: 'hoofd',
      formule: 't bij max |a|',
      methode: 'Het tijdstip van de grootste gemeten versnelling. Ligt dat na het apogeum, ' +
        'dan gaat het vrijwel zeker om de klap bij de landing en niet om de stuwfase.'
    },
    stuwtijd: {
      label: 'Stuwtijd', eenheid: 's', decimalen: 3, groep: 'hoofd',
      formule: 't_stuw = t_eind - t_begin  met |a| > drempel',
      methode: 'De eerste aaneengesloten periode waarin de norm van de versnelling boven de ' +
        'ingestelde drempel blijft. Begin en eind worden lineair geinterpoleerd tussen de twee ' +
        'metingen rond de drempelpassage, zodat de uitkomst niet aan het meetraster van 20 ms ' +
        'vastzit. Een latere piek, zoals de landing, telt niet mee.'
    },
    vluchttijd: {
      label: 'Vluchttijd', eenheid: 's', decimalen: 2, groep: 'hoofd',
      formule: 't_vlucht = t_laatste - t_eerste  met h_f > drempel',
      methode: 'Van de eerste tot de laatste meting waarvan de gefilterde hoogte boven de ' +
        'hoogtedrempel ligt. Het stuk dat de vluchtcomputer na de landing nog doorlogt valt ' +
        'daarmee vanzelf buiten de vluchttijd.'
    },
    daalsnelheid: {
      label: 'Daalsnelheid', eenheid: 'm/s', decimalen: 1, groep: 'hoofd',
      formule: 'h = a + b t  over het laatste deel van de daling,  v_daal = b',
      methode: 'Over het laatste deel van de daling, gerekend van het apogeum tot de laatste ' +
        'meting boven de hoogtedrempel, wordt een rechte door de gefilterde hoogte gepast. De ' +
        'helling van die rechte is per definitie de gemiddelde afgeleide over dat stuk. De ' +
        'waarde is negatief, want de raket daalt.'
    },
    maxRuw: {
      label: 'Hoogste ongefilterde meting', eenheid: 'm', decimalen: 2, groep: 'controle',
      formule: 'max h(i)',
      methode: 'De hoogste ruwe meting, zonder filter en zonder fit. Staat erbij als controle: ' +
        'ligt het berekende apogeum er ver vandaan, dan klopt er iets niet met het filter of ' +
        'met het venster van de paraboolfit.'
    },
    maxGefilterd: {
      label: 'Hoogste gefilterde meting', eenheid: 'm', decimalen: 2, groep: 'controle',
      formule: 'max h_f(i)',
      methode: 'De hoogste waarde van het Savitzky-Golay filter. Dit punt wijst het venster ' +
        'voor de paraboolfit aan.'
    },
    ruis: {
      label: 'Ruis op de hoogtemeting', eenheid: 'm', decimalen: 3, groep: 'onzekerheid',
      formule: 'sigma_h = sqrt( som (h_i - h_gem)^2 / (n - 1) )  over de rustperiode',
      methode: 'De standaardafwijking van de hoogte over de rustige periode voor de lancering. ' +
        'Staat die periode niet in het log, dan valt de schatting zichtbaar terug op de ' +
        'spreiding van de metingen rond het gefilterde signaal, gedeeld door sqrt(1 - c0) met ' +
        'c0 het centrale gewicht van het filter.'
    },
    onzekerheidApogeum: {
      label: 'Onzekerheid op het apogeum', eenheid: 'm', decimalen: 3, groep: 'onzekerheid',
      formule: 'u(H) = k * sqrt( (sigma_h * L)^2 + (H_parabool - H_filter)^2 )',
      methode: 'Twee bijdragen. De eerste is de meetruis, doorgerekend naar de top van de ' +
        'paraboolfit met de hefboomfactor L uit de kleinste-kwadratentheorie: ' +
        'L = sqrt( x_top^T (X^T X)^-1 x_top ). De tweede is het verschil tussen de twee ' +
        'methoden voor de tophoogte, de paraboolfit en het hoogste gefilterde punt. Samen ' +
        'kwadratisch opgeteld en vermenigvuldigd met de dekkingsfactor k.'
    },
    klipmonsters: {
      label: 'Afgetopte versnellingsmetingen', eenheid: 'monsters', decimalen: 0, groep: 'controle',
      formule: 'aantal i met max(|ax|,|ay|,|az|) >= bereik',
      methode: 'Aantal metingen waarbij minstens een as het meetbereik van de versnellingsmeter ' +
        'raakt. Die metingen zijn afgetopt: de werkelijke versnelling was hoger dan wat er staat.'
    }
  };

  // ---------------------------------------------------------------- hulpjes

  function grootheid(waarde, extra) {
    var o = { waarde: (waarde === undefined || waarde === null || !isFinite(waarde)) ? null : waarde };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  }

  function melding(code, tekst, ernst) {
    return { code: code, tekst: tekst, ernst: ernst || 'waarschuwing' };
  }

  // --------------------------------------------------------------- analyse

  /*
    analyseer(gelezen, params) -> resultaatobject

    gelezen is de uitvoer van WR.csv.parse. Bij een onbruikbaar bestand komt er
    een resultaat terug waarin alle grootheden null zijn en fouten uitleggen
    waarom. Er wordt nooit een waarde verzonnen.
  */
  A.analyseer = function (gelezen, params) {
    var S = root.WR.signaal;
    var p = root.WR.parameters.valideer(params);

    var uit = {
      naam: gelezen ? gelezen.naam : 'onbekend',
      vluchtnummer: gelezen ? gelezen.vluchtnummer : null,
      gestart: gelezen ? gelezen.gestart : null,
      bruikbaar: false,
      fouten: [],
      waarschuwingen: [],
      params: p,
      reeksen: null
    };
    var sleutels = Object.keys(A.GROOTHEDEN);
    for (var s = 0; s < sleutels.length; s++) uit[sleutels[s]] = grootheid(null);

    if (!gelezen || !gelezen.geldig) {
      uit.fouten.push(melding('onbruikbaar',
        'Dit bestand levert geen bruikbare meetreeks op, dus er zijn geen grootheden berekend.',
        'fout'));
      return uit;
    }

    var n = gelezen.aantal;
    var t = gelezen.t, h = gelezen.hoogte;

    if (n < 5) {
      uit.fouten.push(melding('te_weinig',
        'Met ' + n + ' meting(en) valt er geen apogeum of snelheid te bepalen. Alleen de ruwe ' +
        'metingen worden getoond.', 'fout'));
      return uit;
    }

    // ---- filteren ---------------------------------------------------------
    var venster = Math.min(p.sg_venster, (n % 2) ? n : n - 1);
    if (venster < p.sg_venster) {
      uit.waarschuwingen.push(melding('venster_verkleind',
        'Het filtervenster is teruggebracht van ' + p.sg_venster + ' naar ' + venster +
        ' monsters, want er zijn maar ' + n + ' metingen.'));
    }
    var hf = S.sgFilter(h, venster, p.sg_graad);
    var v = S.gecentreerdVerschil(t, hf, p.afgeleide_stap);

    // versnellingsnorm
    var aNorm = new Float64Array(n);
    var heeftAccel = gelezen.ontbrekende_kolommen.indexOf('az') < 0;
    var klip = 0, i;
    for (i = 0; i < n; i++) {
      var ax = gelezen.ax[i], ay = gelezen.ay[i], az = gelezen.az[i];
      if (!isFinite(ax) || !isFinite(ay) || !isFinite(az)) { aNorm[i] = NaN; continue; }
      aNorm[i] = Math.sqrt(ax * ax + ay * ay + az * az);
      if (Math.max(Math.abs(ax), Math.abs(ay), Math.abs(az)) >= p.klip_g - 0.01) klip++;
    }

    uit.reeksen = { t: t, hoogte: h, hoogte_f: hf, snelheid: v, aNorm: aNorm };
    uit.venster_gebruikt = venster;
    uit.venster_s = venster * (gelezen.dt_mediaan_s || 0);

    // ---- rustperiode en ruis ---------------------------------------------
    var rust = bepaalRust(t, h, hf, aNorm, heeftAccel, p, S);
    uit.rust = rust;
    uit.ruis = grootheid(rust.sd, { methode: rust.methode, monsters: rust.monsters });
    if (rust.methode === 'restspreiding') {
      uit.waarschuwingen.push(melding('geen_rustperiode',
        'Er staan minder dan ' + p.rust_min_monsters + ' metingen voor de lancering in dit log, ' +
        'dus de ruis is niet uit een rustperiode te bepalen. In plaats daarvan is de spreiding ' +
        'van de metingen rond het gefilterde signaal gebruikt.'));
    }

    // ---- apogeum ----------------------------------------------------------
    var iTop = 0;
    for (i = 1; i < n; i++) if (isFinite(hf[i]) && (!isFinite(hf[iTop]) || hf[i] > hf[iTop])) iTop = i;
    var maxGef = hf[iTop];

    var iRuw = 0;
    for (i = 1; i < n; i++) if (isFinite(h[i]) && (!isFinite(h[iRuw]) || h[i] > h[iRuw])) iRuw = i;
    uit.maxRuw = grootheid(h[iRuw], { tijd: t[iRuw] });
    uit.maxGefilterd = grootheid(maxGef, { tijd: t[iTop] });

    var i0 = iTop, i1 = iTop;
    while (i0 > 0 && t[iTop] - t[i0 - 1] <= p.top_venster_s) i0--;
    while (i1 < n - 1 && t[i1 + 1] - t[iTop] <= p.top_venster_s) i1++;
    var fit = S.paraboolFit(t, h, i0, i1);

    var H, tH, uRuis = NaN, uMethode = NaN;
    if (fit && fit.t_top >= t[i0] && fit.t_top <= t[i1]) {
      H = fit.h_top; tH = fit.t_top;
      uRuis = isFinite(rust.sd) ? rust.sd * fit.hefboom : fit.se_top;
      uMethode = Math.abs(fit.h_top - maxGef);
    } else {
      H = maxGef; tH = t[iTop];
      uRuis = isFinite(rust.sd) ? rust.sd : NaN;
      uMethode = Math.abs(maxGef - h[iRuw]);
      uit.waarschuwingen.push(melding('geen_paraboolfit',
        'De paraboolfit rond de top leverde geen bruikbaar maximum op. Het apogeum is nu het ' +
        'hoogste punt van het gefilterde signaal, wat minder nauwkeurig is.'));
    }
    var u = null;
    if (isFinite(uRuis)) {
      u = p.dekkingsfactor * Math.sqrt(uRuis * uRuis + (isFinite(uMethode) ? uMethode * uMethode : 0));
    }
    uit.apogeum = grootheid(H, {
      onzekerheid: u,
      u_ruis: isFinite(uRuis) ? uRuis : null,
      u_methode: isFinite(uMethode) ? uMethode : null,
      fit: fit ? { n: fit.n, r2: fit.r2, hefboom: fit.hefboom, residu_sd: fit.residu_sd,
                   venster_s: p.top_venster_s, t_van: t[i0], t_tot: t[i1] } : null
    });
    uit.tApogeum = grootheid(tH, { onzekerheid: null });
    uit.onzekerheidApogeum = grootheid(u);

    if (gelezen.afgebroken) {
      uit.waarschuwingen.push(melding('afgebroken_analyse',
        'Het log breekt af terwijl de raket nog stijgt. Het getoonde apogeum is niet de top van ' +
        'de vlucht maar de hoogste opgenomen meting; de werkelijke top lag hoger.'));
    }

    // ---- snelheid ---------------------------------------------------------
    var iV = -1;
    for (i = 0; i < n; i++) if (isFinite(v[i]) && (iV < 0 || v[i] > v[iV])) iV = i;
    if (iV >= 0) {
      uit.vMax = grootheid(v[iV]);
      uit.tVMax = grootheid(t[iV]);
    }

    // ---- versnelling ------------------------------------------------------
    if (heeftAccel) {
      var iA = -1;
      for (i = 0; i < n; i++) if (isFinite(aNorm[i]) && (iA < 0 || aNorm[i] > aNorm[iA])) iA = i;
      if (iA >= 0) {
        uit.aMax = grootheid(aNorm[iA]);
        uit.aMaxMS2 = grootheid(aNorm[iA] * G_VAL);
        uit.tAMax = grootheid(t[iA]);
        if (isFinite(tH) && t[iA] > tH) {
          uit.waarschuwingen.push(melding('piek_na_apogeum',
            'De grootste versnelling (' + aNorm[iA].toFixed(2).replace('.', ',') + ' g op ' +
            t[iA].toFixed(2).replace('.', ',') + ' s) valt na het apogeum. Dat is vrijwel zeker ' +
            'de klap bij de landing en niet de stuwfase.'));
        }
      }
      uit.klipmonsters = grootheid(klip);
      if (klip > 0) {
        uit.waarschuwingen.push(melding('geklipt',
          klip + ' meting(en) raken het bereik van ' + p.klip_g + ' g. Die waarden zijn afgetopt, ' +
          'dus de werkelijke piekversnelling was hoger dan wat de grafiek laat zien.'));
      }

      // stuwtijd: eerste aaneengesloten periode boven de drempel
      var start = -1, eind = -1;
      for (i = 0; i < n; i++) {
        if (isFinite(aNorm[i]) && aNorm[i] > p.stuw_drempel_g) { start = i; break; }
      }
      if (start >= 0) {
        eind = start;
        for (i = start + 1; i < n; i++) {
          if (isFinite(aNorm[i]) && aNorm[i] > p.stuw_drempel_g) eind = i; else break;
        }
        var tBegin = start > 0 ? S.kruising(t, aNorm, start - 1, p.stuw_drempel_g) : t[start];
        var tEind = eind < n - 1 ? S.kruising(t, aNorm, eind, p.stuw_drempel_g) : t[eind];
        uit.stuwtijd = grootheid(tEind - tBegin, {
          t_begin: tBegin, t_eind: tEind, monsters: eind - start + 1
        });
      } else {
        uit.waarschuwingen.push(melding('geen_stuwfase',
          'De versnelling komt nergens boven de drempel van ' +
          String(p.stuw_drempel_g).replace('.', ',') + ' g, dus er is geen stuwtijd bepaald.'));
      }
    } else {
      uit.waarschuwingen.push(melding('geen_versnelling',
        'Dit bestand bevat geen versnellingskolommen. De maximale versnelling en de stuwtijd ' +
        'blijven daarom leeg.'));
    }

    // ---- vluchttijd en daalsnelheid --------------------------------------
    var iEerst = -1, iLaatst = -1;
    for (i = 0; i < n; i++) {
      if (isFinite(hf[i]) && hf[i] > p.hoogte_drempel_m) {
        if (iEerst < 0) iEerst = i;
        iLaatst = i;
      }
    }
    if (iEerst >= 0 && iLaatst > iEerst) {
      uit.vluchttijd = grootheid(t[iLaatst] - t[iEerst], { t_van: t[iEerst], t_tot: t[iLaatst] });

      if (isFinite(tH) && t[iLaatst] > tH) {
        var tStart = tH + (1 - p.daal_deel) * (t[iLaatst] - tH);
        var j0 = iLaatst;
        while (j0 > 0 && t[j0 - 1] >= tStart) j0--;
        if (iLaatst - j0 >= 2) {
          var lijn = S.lijnFit(t, hf, j0, iLaatst);
          if (lijn) {
            uit.daalsnelheid = grootheid(lijn.b, {
              onzekerheid: isFinite(lijn.se_b) ? p.dekkingsfactor * lijn.se_b : null,
              t_van: t[j0], t_tot: t[iLaatst], n: lijn.n, r2: lijn.r2
            });
          }
        } else {
          uit.waarschuwingen.push(melding('daling_te_kort',
            'Het laatste deel van de daling bevat te weinig metingen om een daalsnelheid te ' +
            'bepalen.'));
        }
      }
    } else {
      uit.waarschuwingen.push(melding('nooit_boven_drempel',
        'De hoogte komt nergens boven de drempel van ' +
        String(p.hoogte_drempel_m).replace('.', ',') + ' m. Vluchttijd en daalsnelheid blijven ' +
        'leeg. Controleer de drempel of het bestand.'));
    }

    uit.bruikbaar = uit.apogeum.waarde !== null;
    return uit;
  };

  // ------------------------------------------------------- rustperiode

  function bepaalRust(t, h, hf, aNorm, heeftAccel, p, S) {
    var n = t.length, i;
    var iLift = -1;

    if (heeftAccel) {
      for (i = 0; i < n; i++) {
        if (isFinite(aNorm[i]) && aNorm[i] > p.stuw_drempel_g) { iLift = i; break; }
      }
    }
    if (iLift < 0) {
      // zonder versnellingsdata: het eerste monster waarop de gefilterde hoogte
      // duidelijk boven het beginniveau uitkomt
      var basis = S.mediaan(Array.prototype.slice.call(hf, 0, Math.min(n, 10)));
      for (i = 0; i < n; i++) {
        if (isFinite(hf[i]) && hf[i] > basis + Math.max(0.5, p.hoogte_drempel_m * 0.2)) { iLift = i; break; }
      }
    }
    if (iLift < 0) iLift = 0;

    var monsters = iLift;
    if (monsters >= p.rust_min_monsters) {
      return {
        methode: 'rustperiode',
        monsters: monsters,
        t_tot: t[iLift],
        sd: S.sd(h, 0, iLift)
      };
    }

    // terugval: spreiding rond het gefilterde signaal, gecorrigeerd voor het filter
    var rest = new Float64Array(n);
    for (i = 0; i < n; i++) rest[i] = (isFinite(h[i]) && isFinite(hf[i])) ? h[i] - hf[i] : NaN;
    var venster = Math.min(p.sg_venster, (n % 2) ? n : n - 1);
    var c0 = S.sgCentraalGewicht(venster, p.sg_graad);
    var correctie = (c0 < 1) ? Math.sqrt(1 - c0) : 1;
    var sdRest = S.sd(rest);
    return {
      methode: 'restspreiding',
      monsters: monsters,
      t_tot: iLift > 0 ? t[iLift] : null,
      c0: c0,
      sd: isFinite(sdRest) ? sdRest / correctie : NaN
    };
  }

  root.WR = root.WR || {};
  root.WR.analyse = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
