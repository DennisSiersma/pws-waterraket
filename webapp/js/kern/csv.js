/*
  csv.js  -  inlezen en controleren van een vluchtlog

  Verwacht het formaat dat de vluchtcomputer schrijft:

      # vlucht 4, gestart 2026-08-09 14:07
      t_ms,hoogte_m,druk_hPa,temp_C,ax_g,ay_g,az_g
      0,0.12,1013.40,21.3,0.02,-0.01,1.00

  De firmware schrijft de kopregel met println (CRLF) en de meetregels met
  printf (LF). Het bestand heeft dus gemengde regeleindes. De parser aanvaardt
  CRLF, LF en losse CR, een BOM aan het begin, een puntkomma in plaats van een
  komma, ontbrekende kolommen en rommelige regels. Niets gooit een uitzondering:
  wat niet klopt komt terug als waarschuwing of fout.
*/
(function (root) {
  'use strict';

  var C = {};

  var STANDAARD_KOLOMMEN = ['t_ms', 'hoogte_m', 'druk_hPa', 'temp_C', 'ax_g', 'ay_g', 'az_g'];
  var VELD = {
    t_ms: 't', hoogte_m: 'hoogte', druk_hpa: 'druk', temp_c: 'temp',
    ax_g: 'ax', ay_g: 'ay', az_g: 'az'
  };

  function melding(code, tekst, ernst) {
    return { code: code, tekst: tekst, ernst: ernst || 'waarschuwing' };
  }

  function mediaan(lijst) {
    if (!lijst.length) return NaN;
    var s = lijst.slice().sort(function (a, b) { return a - b; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]);
  }

  function kiesScheiding(regel) {
    var telling = [[',', 0], [';', 0], ['\t', 0]];
    for (var i = 0; i < telling.length; i++) {
      telling[i][1] = regel.split(telling[i][0]).length - 1;
    }
    telling.sort(function (a, b) { return b[1] - a[1]; });
    return telling[0][1] > 0 ? telling[0][0] : ',';
  }

  function leesGetal(tekst, scheiding) {
    if (tekst === undefined) return NaN;
    var s = String(tekst).trim();
    if (s === '') return NaN;
    if (scheiding !== ',' && s.indexOf(',') >= 0) s = s.replace(',', '.');   // decimale komma
    var x = parseFloat(s);
    return isFinite(x) ? x : NaN;
  }

  /*
    parse(tekst, naam, params) -> vluchtobject

    Altijd aanwezig: naam, geldig, fouten, waarschuwingen.
    Bij geldig === true ook: aantal, t (s), hoogte, druk, temp, ax, ay, az,
    frequentie_hz, dt_mediaan_s, duplicaten, gaten, ontbrekende_monsters.
  */
  C.parse = function (tekst, naam, params) {
    var p = (root.WR && root.WR.parameters)
      ? root.WR.parameters.valideer(params) : { gat_drempel: 3, verwachte_frequentie_hz: 50 };

    var uit = {
      naam: naam || 'onbekend',
      vluchtnummer: null,
      gestart: null,
      geldig: false,
      fouten: [],
      waarschuwingen: [],
      kolommen: [],
      ontbrekende_kolommen: [],
      aantal: 0,
      regels_totaal: 0,
      regels_overgeslagen: 0,
      commentaar: []
    };

    if (typeof tekst !== 'string' || tekst.length === 0) {
      uit.fouten.push(melding('leeg', 'Het bestand is leeg.', 'fout'));
      return uit;
    }
    if (tekst.charCodeAt(0) === 0xFEFF) tekst = tekst.slice(1);              // BOM

    var regels = tekst.split(/\r\n|\n|\r/);
    var inhoud = [];
    for (var i = 0; i < regels.length; i++) {
      var r = regels[i].trim();
      if (r === '') continue;
      if (r.charAt(0) === '#') {
        uit.commentaar.push(r);
        var m = r.match(/vlucht\s+(\d+)/i);
        if (m) uit.vluchtnummer = parseInt(m[1], 10);
        var g = r.match(/gestart\s+([0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}(?::[0-9]{2})?)/i);
        if (g) uit.gestart = g[1];
        continue;
      }
      inhoud.push(r);
    }
    uit.regels_totaal = inhoud.length;

    if (inhoud.length === 0) {
      uit.fouten.push(melding('geen_data',
        'Er staan geen meetregels in het bestand' +
        (uit.commentaar.length ? ', alleen een commentaarregel.' : '.'), 'fout'));
      return uit;
    }

    // kopregel herkennen: bevat letters op de plek van een getal
    var scheiding = kiesScheiding(inhoud[0]);
    var eersteVelden = inhoud[0].split(scheiding);
    var heeftKop = eersteVelden.some(function (v) { return /[a-zA-Z_]/.test(v); });

    var kolomIndex = {};
    var dataVanaf = 0;
    if (heeftKop) {
      dataVanaf = 1;
      for (var k = 0; k < eersteVelden.length; k++) {
        var sleutel = eersteVelden[k].trim().toLowerCase();
        uit.kolommen.push(eersteVelden[k].trim());
        if (VELD[sleutel]) kolomIndex[VELD[sleutel]] = k;
      }
    } else {
      uit.waarschuwingen.push(melding('geen_kopregel',
        'Er staat geen kopregel in het bestand. De kolommen worden aangenomen in de ' +
        'standaardvolgorde ' + STANDAARD_KOLOMMEN.join(', ') + '.'));
      for (var q = 0; q < STANDAARD_KOLOMMEN.length; q++) {
        uit.kolommen.push(STANDAARD_KOLOMMEN[q]);
        kolomIndex[VELD[STANDAARD_KOLOMMEN[q].toLowerCase()]] = q;
      }
    }

    if (kolomIndex.t === undefined || kolomIndex.hoogte === undefined) {
      uit.fouten.push(melding('kolommen_ontbreken',
        'De kolommen t_ms en hoogte_m zijn allebei nodig. Gevonden kolommen: ' +
        (uit.kolommen.join(', ') || 'geen') + '.', 'fout'));
      return uit;
    }
    ['druk', 'temp', 'ax', 'ay', 'az'].forEach(function (v) {
      if (kolomIndex[v] === undefined) {
        uit.ontbrekende_kolommen.push(v);
      }
    });
    if (uit.ontbrekende_kolommen.length) {
      uit.waarschuwingen.push(melding('kolom_ontbreekt',
        'Deze kolommen ontbreken en blijven leeg: ' + uit.ontbrekende_kolommen.join(', ') +
        '. De grootheden die ze nodig hebben worden niet berekend.'));
    }

    // meetregels lezen
    var rij = [];
    var nietNumeriek = 0;
    var scheveRegels = 0;
    var verwachtVelden = uit.kolommen.length;
    for (var n = dataVanaf; n < inhoud.length; n++) {
      var velden = inhoud[n].split(scheiding);
      if (velden.length < 2) { uit.regels_overgeslagen++; continue; }
      // een regel met een afwijkend aantal velden wordt wel gelezen, want de
      // kolommen die er wel staan zijn bruikbaar, maar hij wordt wel gemeld
      if (velden.length !== verwachtVelden) scheveRegels++;
      var t = leesGetal(velden[kolomIndex.t], scheiding);
      if (!isFinite(t)) { uit.regels_overgeslagen++; continue; }
      var h = leesGetal(velden[kolomIndex.hoogte], scheiding);
      if (!isFinite(h)) nietNumeriek++;
      rij.push({
        t: t / 1000,
        hoogte: h,
        druk: kolomIndex.druk === undefined ? NaN : leesGetal(velden[kolomIndex.druk], scheiding),
        temp: kolomIndex.temp === undefined ? NaN : leesGetal(velden[kolomIndex.temp], scheiding),
        ax: kolomIndex.ax === undefined ? NaN : leesGetal(velden[kolomIndex.ax], scheiding),
        ay: kolomIndex.ay === undefined ? NaN : leesGetal(velden[kolomIndex.ay], scheiding),
        az: kolomIndex.az === undefined ? NaN : leesGetal(velden[kolomIndex.az], scheiding)
      });
    }

    if (scheveRegels > 0) {
      uit.waarschuwingen.push(melding('scheve_regels',
        scheveRegels + ' regel(s) hebben niet ' + verwachtVelden + ' velden zoals de kopregel. ' +
        'De kolommen die er wel in staan zijn gebruikt, de rest is leeg gebleven.'));
    }
    if (uit.regels_overgeslagen > 0) {
      uit.waarschuwingen.push(melding('regels_overgeslagen',
        uit.regels_overgeslagen + ' regel(s) zijn overgeslagen omdat er geen leesbare ' +
        'tijdstempel in stond.'));
    }
    if (nietNumeriek > 0) {
      uit.waarschuwingen.push(melding('hoogte_ontbreekt',
        'Bij ' + nietNumeriek + ' meting(en) ontbreekt de hoogte. Die punten blijven leeg; ' +
        'ze worden niet ingevuld of geraden.'));
    }
    if (rij.length === 0) {
      uit.fouten.push(melding('geen_metingen',
        'Er zijn geen bruikbare meetregels gevonden. Controleer of dit een vluchtlog van de ' +
        'vluchtcomputer is.', 'fout'));
      return uit;
    }

    // tijdvolgorde, duplicaten
    var opVolgorde = true;
    for (var v2 = 1; v2 < rij.length; v2++) if (rij[v2].t < rij[v2 - 1].t) { opVolgorde = false; break; }
    if (!opVolgorde) {
      uit.waarschuwingen.push(melding('volgorde',
        'De tijdstempels stonden niet op volgorde. De metingen zijn op tijd gesorteerd.'));
      rij.sort(function (a, b) { return a.t - b.t; });
    }

    var duplicaten = 0;
    var uniek = [];
    for (var d = 0; d < rij.length; d++) {
      if (d > 0 && Math.abs(rij[d].t - rij[d - 1].t) < 1e-12) { duplicaten++; continue; }
      uniek.push(rij[d]);
    }
    if (duplicaten > 0) {
      uit.waarschuwingen.push(melding('duplicaten',
        duplicaten + ' dubbele tijdstempel(s) gevonden. Van elk paar is de eerste meting ' +
        'aangehouden en de tweede weggelaten.'));
    }

    uit.aantal = uniek.length;
    uit.duplicaten = duplicaten;

    // arrays
    var N = uniek.length;
    uit.t = new Float64Array(N);
    uit.hoogte = new Float64Array(N);
    uit.druk = new Float64Array(N);
    uit.temp = new Float64Array(N);
    uit.ax = new Float64Array(N);
    uit.ay = new Float64Array(N);
    uit.az = new Float64Array(N);
    for (var a = 0; a < N; a++) {
      uit.t[a] = uniek[a].t;
      uit.hoogte[a] = uniek[a].hoogte;
      uit.druk[a] = uniek[a].druk;
      uit.temp[a] = uniek[a].temp;
      uit.ax[a] = uniek[a].ax;
      uit.ay[a] = uniek[a].ay;
      uit.az[a] = uniek[a].az;
    }

    // bemonsteringsfrequentie en gaten
    var dts = [];
    for (var b = 1; b < N; b++) dts.push(uit.t[b] - uit.t[b - 1]);
    var dtMed = mediaan(dts);
    uit.dt_mediaan_s = dtMed;
    uit.frequentie_hz = (isFinite(dtMed) && dtMed > 0) ? 1 / dtMed : NaN;
    uit.duur_s = N > 1 ? uit.t[N - 1] - uit.t[0] : 0;

    var gaten = [];
    var ontbrekend = 0;
    if (isFinite(dtMed) && dtMed > 0) {
      for (var c = 0; c < dts.length; c++) {
        var gemist = Math.round(dts[c] / dtMed) - 1;
        if (gemist > 0) ontbrekend += gemist;
        if (gemist > p.gat_drempel) {
          gaten.push({ index: c, t_voor: uit.t[c], t_na: uit.t[c + 1], gemiste_monsters: gemist });
        }
      }
    }
    uit.gaten = gaten;
    uit.ontbrekende_monsters = ontbrekend;
    if (gaten.length) {
      uit.waarschuwingen.push(melding('gaten',
        gaten.length + ' gat(en) van meer dan ' + p.gat_drempel + ' monsters. Het grootste gat ' +
        'loopt van ' + gaten[0].t_voor.toFixed(2).replace('.', ',') + ' s tot ' +
        gaten[0].t_na.toFixed(2).replace('.', ',') + ' s.'));
    } else if (ontbrekend > 0) {
      uit.waarschuwingen.push(melding('ontbrekende_monsters',
        ontbrekend + ' ontbrekende monster(s), geen ervan groter dan ' + p.gat_drempel +
        ' achter elkaar.'));
    }

    if (isFinite(uit.frequentie_hz) && p.verwachte_frequentie_hz > 0) {
      var afw = Math.abs(uit.frequentie_hz - p.verwachte_frequentie_hz) / p.verwachte_frequentie_hz;
      if (afw > 0.10) {
        uit.waarschuwingen.push(melding('frequentie',
          'De gemeten bemonsteringsfrequentie is ' + uit.frequentie_hz.toFixed(1).replace('.', ',') +
          ' Hz, terwijl ' + p.verwachte_frequentie_hz + ' Hz werd verwacht.'));
      }
    }

    // te weinig metingen voor een zinnige analyse
    if (N < 5) {
      uit.waarschuwingen.push(melding('te_kort',
        'Er staan maar ' + N + ' meting(en) in het bestand. Dat is te weinig om een vlucht uit ' +
        'te rekenen; alleen de ruwe punten worden getoond.'));
    }

    // afgebroken log: de hoogste meting ligt aan het eind, dus de top is niet gehaald
    var iTop = 0;
    for (var e = 1; e < N; e++) if (uit.hoogte[e] > uit.hoogte[iTop]) iTop = e;
    uit.index_max_ruw = iTop;
    if (N >= 3 && iTop >= N - 3) {
      uit.waarschuwingen.push(melding('afgebroken',
        'De hoogste meting (' + uit.hoogte[iTop].toFixed(2).replace('.', ',') + ' m op ' +
        uit.t[iTop].toFixed(2).replace('.', ',') + ' s) is een van de laatste metingen. ' +
        'Het log is waarschijnlijk midden in de vlucht afgebroken, dus het apogeum staat er niet ' +
        'in. De getoonde waarden gelden alleen voor het stuk dat wel is opgenomen.'));
      uit.afgebroken = true;
    } else {
      uit.afgebroken = false;
    }

    uit.geldig = true;
    return uit;
  };

  /* korte samenvatting voor in de vluchtlijst */
  C.samenvatting = function (v) {
    if (!v.geldig) return v.fouten.length ? v.fouten[0].tekst : 'onbruikbaar bestand';
    var g = root.WR.getal;
    return v.aantal + ' metingen, ' + g.nl(v.frequentie_hz, 1) + ' Hz, ' +
           g.nl(v.duur_s, 2) + ' s, ' + v.duplicaten + ' dubbel, ' +
           v.ontbrekende_monsters + ' ontbrekend, ' + v.gaten.length + ' gat(en)';
  };

  root.WR = root.WR || {};
  root.WR.csv = C;
})(typeof globalThis !== 'undefined' ? globalThis : this);
