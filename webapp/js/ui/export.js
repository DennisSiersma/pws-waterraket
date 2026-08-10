/*
  export.js  -  grafieken als PNG, grootheden als CSV, rapport naar de printer

  Alles gebeurt in de pagina zelf. Een bestand ontstaat als Blob en gaat via een
  downloadkoppeling naar de schijf; er komt geen server aan te pas.

  Weergave gebruikt de decimale komma, de export de decimale punt. Dat is een
  bewuste keuze: het CSV-bestand moet zonder gedoe in een rekenblad of in
  Python te lezen zijn.
*/
(function (root) {
  'use strict';

  var E = {};
  var G = root.WR.getal;

  // ------------------------------------------------------------- downloaden
  function bewaar(blob, bestandsnaam) {
    var url = root.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = bestandsnaam;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    root.setTimeout(function () {
      document.body.removeChild(a);
      root.URL.revokeObjectURL(url);
    }, 500);
  }
  E.bewaar = bewaar;

  // ------------------------------------------------------------------- PNG
  /*
    Een grafiek opnieuw tekenen op de opgegeven schaal en als PNG bewaren.
    schaal 2 betekent tweemaal de schermresolutie; dat is het minimum uit de
    opdracht en scherp genoeg voor een afdruk.
  */
  E.grafiekAlsPng = function (spec, breedte, hoogte, schaal, bestandsnaam) {
    var s = schaal || 2;
    var canvas = root.WR.grafiek.naarCanvas(spec, breedte, hoogte, s);
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        if (blob) bewaar(blob, bestandsnaam);
      }, 'image/png');
    } else {
      // oudere browsers: via een data-URL
      var data = canvas.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = data; a.download = bestandsnaam; a.click();
    }
    return { breedte: canvas.width, hoogte: canvas.height, schaal: s };
  };

  // ------------------------------------------------------------------- CSV
  function veld(x) {
    if (x === null || x === undefined) return '';
    var s = String(x);
    if (s.indexOf('"') >= 0 || s.indexOf(',') >= 0 || s.indexOf('\n') >= 0) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }
  function getalVeld(x, decimalen) {
    return G.punt(x, decimalen);          // decimale punt, lege cel als de waarde ontbreekt
  }

  /*
    De kolommen van de export. Elke kolom weet zelf waar hij vandaan komt,
    zodat er niets kan wegvallen als er een grootheid bij komt.
  */
  E.KOLOMMEN = [
    { naam: 'vlucht', uit: function (r) { return r.gelezen.vluchtnummer; } },
    { naam: 'bestand', uit: function (r) { return r.naam; } },
    { naam: 'gestart', uit: function (r) { return r.gelezen.gestart; } },
    { naam: 'metingen', uit: function (r) { return r.gelezen.aantal; } },
    { naam: 'frequentie_hz', d: 2, uit: function (r) { return r.gelezen.frequentie_hz; } },
    { naam: 'duur_log_s', d: 3, uit: function (r) { return r.gelezen.duur_s; } },
    { naam: 'dubbele_tijdstempels', uit: function (r) { return r.gelezen.duplicaten; } },
    { naam: 'ontbrekende_monsters', uit: function (r) { return r.gelezen.ontbrekende_monsters; } },
    { naam: 'gaten', uit: function (r) { return r.gelezen.gaten.length; } },

    { naam: 'vulfractie_pct', d: 1, uit: function (r) { return r.proefopzet.vulfractie; } },
    { naam: 'begindruk_bar', d: 2, uit: function (r) { return r.proefopzet.begindruk; } },
    { naam: 'nozzle_mm', d: 2, uit: function (r) { return r.proefopzet.nozzle; } },
    { naam: 'massa_leeg_g', d: 1, uit: function (r) { return r.proefopzet.massa; } },
    { naam: 'opmerking', uit: function (r) { return r.proefopzet.opmerking; } },

    { naam: 'apogeum_m', d: 3, uit: function (r) { return w(r, 'apogeum'); } },
    { naam: 'u_apogeum_m', d: 3, uit: function (r) { return r.analyse.apogeum.onzekerheid; } },
    { naam: 'u_apogeum_ruis_m', d: 4, uit: function (r) { return r.analyse.apogeum.u_ruis; } },
    { naam: 'u_apogeum_methode_m', d: 4, uit: function (r) { return r.analyse.apogeum.u_methode; } },
    { naam: 't_apogeum_s', d: 3, uit: function (r) { return w(r, 'tApogeum'); } },
    { naam: 'v_max_ms', d: 2, uit: function (r) { return w(r, 'vMax'); } },
    { naam: 't_v_max_s', d: 3, uit: function (r) { return w(r, 'tVMax'); } },
    { naam: 'a_max_g', d: 3, uit: function (r) { return w(r, 'aMax'); } },
    { naam: 'a_max_ms2', d: 2, uit: function (r) { return w(r, 'aMaxMS2'); } },
    { naam: 't_a_max_s', d: 3, uit: function (r) { return w(r, 'tAMax'); } },
    { naam: 'stuwtijd_s', d: 4, uit: function (r) { return w(r, 'stuwtijd'); } },
    { naam: 'vluchttijd_s', d: 3, uit: function (r) { return w(r, 'vluchttijd'); } },
    { naam: 'daalsnelheid_ms', d: 3, uit: function (r) { return w(r, 'daalsnelheid'); } },
    { naam: 'u_daalsnelheid_ms', d: 3, uit: function (r) { return r.analyse.daalsnelheid.onzekerheid; } },
    { naam: 'ruis_hoogte_m', d: 4, uit: function (r) { return w(r, 'ruis'); } },
    { naam: 'ruis_methode', uit: function (r) { return r.analyse.rust ? r.analyse.rust.methode : ''; } },
    { naam: 'ruis_monsters', uit: function (r) { return r.analyse.rust ? r.analyse.rust.monsters : ''; } },
    { naam: 'max_ongefilterd_m', d: 3, uit: function (r) { return w(r, 'maxRuw'); } },
    { naam: 'max_gefilterd_m', d: 3, uit: function (r) { return w(r, 'maxGefilterd'); } },
    { naam: 'afgetopte_monsters', uit: function (r) { return w(r, 'klipmonsters'); } },

    { naam: 'theorie_apogeum_m', d: 2, uit: function (r) { return r.theorie ? r.theorie.apogeum_m : null; } },
    { naam: 'theorie_stuwtijd_s', d: 4, uit: function (r) { return r.theorie ? r.theorie.stuwtijd_s : null; } },
    { naam: 'theorie_v_burnout_ms', d: 2, uit: function (r) { return r.theorie ? r.theorie.v_burnout_ms : null; } },
    { naam: 'verschil_meting_min_theorie_m', d: 2, uit: function (r) {
        if (!r.theorie || r.theorie.apogeum_m === null || r.analyse.apogeum.waarde === null) return null;
        return r.analyse.apogeum.waarde - r.theorie.apogeum_m;
      } },
    { naam: 'verschil_pct', d: 2, uit: function (r) {
        if (!r.theorie || !r.theorie.apogeum_m || r.analyse.apogeum.waarde === null) return null;
        return 100 * (r.analyse.apogeum.waarde - r.theorie.apogeum_m) / r.theorie.apogeum_m;
      } },
    { naam: 'waarschuwingen', uit: function (r) {
        return r.gelezen.waarschuwingen.concat(r.analyse.waarschuwingen)
          .map(function (m) { return m.tekst; }).join(' | ');
      } }
  ];

  function w(r, sleutel) {
    var g = r.analyse[sleutel];
    return (g && g.waarde !== undefined) ? g.waarde : null;
  }

  /*
    csvGrootheden(vluchten, params, datum) -> tekst

    Boven het bestand staan commentaarregels met alle gebruikte parameters.
    Daardoor is elke rij later terug te rekenen, ook als de instellingen
    intussen zijn veranderd.
  */
  E.csvGrootheden = function (vluchten, params, datumTekst) {
    var P = root.WR.parameters;
    var regels = [];
    regels.push('# Waterraket vluchtanalyse, uitvoer van de afgeleide grootheden');
    if (datumTekst) regels.push('# gemaakt op ' + datumTekst);
    regels.push('# decimaal scheidingsteken: punt; veldscheidingsteken: komma');
    regels.push('# instellingen waarmee gerekend is:');
    Object.keys(P.DEFINITIES).forEach(function (s) {
      var def = P.DEFINITIES[s];
      regels.push('#   ' + s + ' = ' + G.punt(params[s]) + (def.eenheid ? ' ' + def.eenheid : '') +
                  '   (' + def.label + ')');
    });
    regels.push('#');
    regels.push(E.KOLOMMEN.map(function (k) { return k.naam; }).join(','));

    vluchten.forEach(function (r) {
      regels.push(E.KOLOMMEN.map(function (k) {
        var x = k.uit(r);
        if (k.d !== undefined) return getalVeld(typeof x === 'number' ? x : null, k.d);
        return veld(x);
      }).join(','));
    });
    return regels.join('\n') + '\n';
  };

  E.csvAlsBestand = function (tekst, bestandsnaam) {
    // met byte order mark, zodat een rekenblad de tekst als UTF-8 herkent
    var blob = new root.Blob(['﻿' + tekst], { type: 'text/csv;charset=utf-8' });
    bewaar(blob, bestandsnaam);
  };

  // ------------------------------------------------------------- afdrukken
  E.afdrukken = function () {
    root.print();
  };

  root.WR = root.WR || {};
  root.WR.exporteer = E;
})(typeof globalThis !== 'undefined' ? globalThis : this);
