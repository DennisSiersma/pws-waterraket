/*
  app.js  -  de interface aan elkaar knopen

  Houdt de ingeladen vluchten bij, laat de parameters instellen en tekent de
  onderdelen opnieuw zodra er iets verandert. Alle rekenwerk zit in js/kern,
  alle tekenwerk in js/ui. Hier staat alleen de bediening.
*/
(function () {
  'use strict';

  var G = WR.getal;
  var P = WR.parameters;

  var staat = {
    vluchten: [],          // {id, naam, gelezen, analyse, kleur}
    params: P.standaard(),
    volgnummer: 0
  };

  // ------------------------------------------------------------------ hulpjes
  function el(id) { return document.getElementById(id); }

  function maak(tag, klasse, tekst) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (tekst !== undefined && tekst !== null) e.textContent = tekst;
    return e;
  }

  function leeg(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function meldingNode(m) {
    var d = maak('div', 'melding ' + (m.ernst === 'fout' ? 'fout' : 'waarschuwing'));
    d.appendChild(maak('strong', null, m.ernst === 'fout' ? 'Fout: ' : 'Let op: '));
    d.appendChild(document.createTextNode(m.tekst));
    return d;
  }

  // ------------------------------------------------------- vluchten inladen
  function volgendeKleur(i) {
    var palet = (window.WR.grafiek && WR.grafiek.PALET) ? WR.grafiek.PALET : ['#1f5fa9'];
    return palet[i % palet.length];
  }

  function voegBestandToe(naam, tekst) {
    var gelezen = WR.csv.parse(tekst, naam, staat.params);
    var id = 'v' + (++staat.volgnummer);
    var vlucht = {
      id: id,
      naam: naam,
      tekst: tekst,
      gelezen: gelezen,
      kleur: volgendeKleur(staat.vluchten.length),
      zichtbaar: true
    };
    staat.vluchten.push(vlucht);
    return vlucht;
  }

  function herbereken() {
    for (var i = 0; i < staat.vluchten.length; i++) {
      var v = staat.vluchten[i];
      v.gelezen = WR.csv.parse(v.tekst, v.naam, staat.params);
      if (WR.analyse) v.analyse = WR.analyse.analyseer(v.gelezen, staat.params);
    }
  }

  function tekenAlles() {
    vernieuwLabels();
    tekenVluchtenlijst();
    tekenInleesrapport();
    tekenGrootheden();
    tekenGrafieken();
    tekenProefopzet();
    tekenVergelijken();
    tekenTheorie();
    tekenRapport();
  }

  // ------------------------------------------------------------- zijbalk
  function tekenVluchtenlijst() {
    var lijst = el('vluchtenlijst');
    leeg(lijst);
    el('geen-vluchten').style.display = staat.vluchten.length ? 'none' : '';

    staat.vluchten.forEach(function (v) {
      var li = maak('li');
      var bal = maak('span', 'kleurbal');
      bal.style.background = v.kleur;
      li.appendChild(bal);

      var rest = maak('div', 'rest');
      rest.appendChild(maak('div', 'naam', vluchtLabel(v)));
      rest.appendChild(maak('div', 'detail', v.naam));
      rest.appendChild(maak('div', 'detail', WR.csv.samenvatting(v.gelezen)));
      if (v.gelezen.gestart) rest.appendChild(maak('div', 'detail', 'gestart ' + v.gelezen.gestart));
      li.appendChild(rest);

      var weg = maak('button', 'weg', '×');
      weg.title = 'Deze vlucht verwijderen';
      weg.addEventListener('click', function () {
        staat.vluchten = staat.vluchten.filter(function (x) { return x.id !== v.id; });
        tekenAlles();
      });
      li.appendChild(weg);
      lijst.appendChild(li);
    });
  }

  // -------------------------------------------------------- inleesrapport
  function kerncijfer(waarde, naam) {
    var d = maak('div', 'kerncijfer');
    d.appendChild(maak('div', 'waarde', waarde));
    d.appendChild(maak('div', 'naam', naam));
    return d;
  }

  function tekenInleesrapport() {
    var doel = el('inleesrapport');
    leeg(doel);
    if (!staat.vluchten.length) {
      doel.appendChild(maak('p', 'leeg', 'Nog geen bestanden ingeladen.'));
      return;
    }

    staat.vluchten.forEach(function (v) {
      var g = v.gelezen;
      var blok = maak('div', 'bestandblok');
      var titel = g.vluchtnummer !== null ? 'Vlucht ' + g.vluchtnummer : v.naam;
      blok.appendChild(maak('h3', null, titel + '  (' + v.naam + ')'));

      if (g.gestart) blok.appendChild(maak('p', 'uitleg', 'Gestart op ' + g.gestart + '.'));

      if (g.geldig) {
        var cijfers = maak('div', 'kerncijfers');
        cijfers.appendChild(kerncijfer(String(g.aantal), 'metingen'));
        cijfers.appendChild(kerncijfer(G.metEenheid(g.frequentie_hz, 1, 'Hz'), 'werkelijke frequentie'));
        cijfers.appendChild(kerncijfer(G.metEenheid(g.duur_s, 2, 's'), 'lengte van het log'));
        cijfers.appendChild(kerncijfer(String(g.duplicaten), 'dubbele tijdstempels'));
        cijfers.appendChild(kerncijfer(String(g.ontbrekende_monsters), 'ontbrekende monsters'));
        cijfers.appendChild(kerncijfer(String(g.gaten.length),
          'gaten groter dan ' + staat.params.gat_drempel + ' monsters'));
        blok.appendChild(cijfers);

        if (g.gaten.length) {
          var tab = maak('table', 'data');
          var thead = maak('thead');
          var tr = maak('tr');
          ['Gat', 'van (s)', 'tot (s)', 'ontbrekende monsters'].forEach(function (h, i) {
            var th = maak('th', i ? 'getal' : null, h); tr.appendChild(th);
          });
          thead.appendChild(tr); tab.appendChild(thead);
          var tb = maak('tbody');
          g.gaten.forEach(function (gat, i) {
            var r = maak('tr');
            r.appendChild(maak('td', null, String(i + 1)));
            r.appendChild(maak('td', 'getal', G.nl(gat.t_voor, 2)));
            r.appendChild(maak('td', 'getal', G.nl(gat.t_na, 2)));
            r.appendChild(maak('td', 'getal', String(gat.gemiste_monsters)));
            tb.appendChild(r);
          });
          tab.appendChild(tb);
          blok.appendChild(tab);
        }
      }

      g.fouten.forEach(function (m) { blok.appendChild(meldingNode(m)); });
      g.waarschuwingen.forEach(function (m) { blok.appendChild(meldingNode(m)); });
      if (g.geldig && !g.waarschuwingen.length && !g.fouten.length) {
        var ok = maak('div', 'melding goed');
        ok.appendChild(maak('strong', null, 'In orde: '));
        ok.appendChild(document.createTextNode(
          'geen ontbrekende of dubbele tijdstempels en geen gaten.'));
        blok.appendChild(ok);
      }

      doel.appendChild(blok);
    });
  }

  // ---------------------------------------------------------- grootheden
  var RIJVOLGORDE = [
    'apogeum', 'tApogeum', 'vMax', 'tVMax', 'aMax', 'aMaxMS2', 'tAMax',
    'stuwtijd', 'vluchttijd', 'daalsnelheid',
    'ruis', 'onzekerheidApogeum',
    'maxRuw', 'maxGefilterd', 'klipmonsters'
  ];

  /*
    De naam waaronder een vlucht in de legenda en de tabellen staat. Twee
    bestanden kunnen hetzelfde vluchtnummer dragen, bijvoorbeeld na het wissen
    van de flash. In dat geval komt de bestandsnaam erbij, want een legenda met
    twee keer dezelfde naam is niet te lezen.
  */
  function basisLabel(v) {
    return v.gelezen.vluchtnummer !== null ? 'Vlucht ' + v.gelezen.vluchtnummer
                                           : v.naam.replace(/\.csv$/i, '');
  }
  function vernieuwLabels() {
    var telling = {};
    staat.vluchten.forEach(function (v) {
      var b = basisLabel(v);
      telling[b] = (telling[b] || 0) + 1;
    });
    staat.vluchten.forEach(function (v) {
      var b = basisLabel(v);
      v.label = (telling[b] > 1) ? b + ' (' + v.naam.replace(/\.csv$/i, '') + ')' : b;
    });
  }
  function vluchtLabel(v) { return v.label || basisLabel(v); }

  // de waarde zoals hij in de tabel komt: altijd met een vast aantal decimalen,
  // en bij het apogeum met de onzekerheid erachter
  function waardeTekst(sleutel, def, gr) {
    if (!gr || gr.waarde === null) return '-';
    if (sleutel === 'apogeum' && gr.onzekerheid !== null && gr.onzekerheid !== undefined) {
      return G.nl(gr.waarde, def.decimalen) + ' ± ' + G.nl(gr.onzekerheid, def.decimalen);
    }
    if (sleutel === 'daalsnelheid' && gr.onzekerheid) {
      return G.nl(gr.waarde, def.decimalen) + ' ± ' + G.nl(gr.onzekerheid, def.decimalen);
    }
    return G.nl(gr.waarde, def.decimalen);
  }

  function tekenGrootheden() {
    var doel = el('groothedentabel');
    var filterregel = el('filterregel');
    leeg(doel); leeg(filterregel);

    var bruikbaar = staat.vluchten.filter(function (v) { return v.analyse; });
    if (!bruikbaar.length) {
      doel.appendChild(maak('p', 'leeg', 'Nog geen vluchten ingeladen.'));
      return;
    }

    var dt = bruikbaar[0].gelezen.dt_mediaan_s;
    filterregel.appendChild(maak('span', null,
      'Filter: Savitzky-Golay, venster ' + staat.params.sg_venster + ' monsters' +
      (isFinite(dt) ? ' (' + G.nl(staat.params.sg_venster * dt, 2) + ' s)' : '') +
      ', polynoomgraad ' + staat.params.sg_graad +
      '. Afgeleide: gecentreerd verschil met halve stap ' + staat.params.afgeleide_stap +
      '. Paraboolfit rond de top: ± ' + G.nl(staat.params.top_venster_s, 2) + ' s.'));

    var tab = maak('table', 'data grootheden');
    var thead = maak('thead');
    var kop = maak('tr');
    kop.appendChild(maak('th', null, 'Grootheid'));
    kop.appendChild(maak('th', null, 'Eenheid'));
    bruikbaar.forEach(function (v) {
      var th = maak('th', 'getal', vluchtLabel(v));
      th.style.borderBottom = '3px solid ' + v.kleur;
      kop.appendChild(th);
    });
    thead.appendChild(kop);
    tab.appendChild(thead);

    var tb = maak('tbody');
    RIJVOLGORDE.forEach(function (sleutel) {
      var def = WR.analyse.GROOTHEDEN[sleutel];
      if (!def) return;
      var tr = maak('tr');

      var tdNaam = maak('td');
      tdNaam.appendChild(document.createTextNode(def.label + ' '));
      var vraag = maak('button', 'vraagteken', '?');
      vraag.title = 'formule en methode tonen';
      tdNaam.appendChild(vraag);
      tr.appendChild(tdNaam);
      tr.appendChild(maak('td', null, def.eenheid || '-'));

      bruikbaar.forEach(function (v) {
        tr.appendChild(maak('td', 'getal', waardeTekst(sleutel, def, v.analyse[sleutel])));
      });
      tb.appendChild(tr);

      var uitleg = maak('tr', 'toelichting');
      uitleg.style.display = 'none';
      var td = maak('td');
      td.colSpan = 2 + bruikbaar.length;
      var fm = maak('div', 'formule', def.formule);
      td.appendChild(fm);
      td.appendChild(maak('p', 'uitleg', def.methode));
      uitleg.appendChild(td);
      tb.appendChild(uitleg);

      vraag.addEventListener('click', function () {
        uitleg.style.display = (uitleg.style.display === 'none') ? '' : 'none';
      });
    });
    tab.appendChild(tb);
    doel.appendChild(tab);

    // ruisbron per vlucht, want dat bepaalt hoe de onzekerheid tot stand komt
    var bron = maak('p', 'uitleg');
    bron.appendChild(document.createTextNode('Bron van de ruisschatting: '));
    bron.appendChild(document.createTextNode(bruikbaar.map(function (v) {
      var r = v.analyse.rust;
      if (!r) return vluchtLabel(v) + ' onbekend';
      return vluchtLabel(v) + ' ' + (r.methode === 'rustperiode'
        ? 'rustperiode van ' + r.monsters + ' metingen'
        : 'restspreiding (geen rustperiode in het log)');
    }).join('; ') + '.'));
    doel.appendChild(bron);

    // waarschuwingen uit de analyse
    bruikbaar.forEach(function (v) {
      v.analyse.waarschuwingen.forEach(function (m) {
        var d = meldingNode(m);
        d.insertBefore(maak('strong', null, vluchtLabel(v) + '. '), d.firstChild);
        doel.appendChild(d);
      });
      v.analyse.fouten.forEach(function (m) {
        var d = meldingNode(m);
        d.insertBefore(maak('strong', null, vluchtLabel(v) + '. '), d.firstChild);
        doel.appendChild(d);
      });
    });
  }

  // ------------------------------------------------------------ grafieken
  function zichtbareVluchten() {
    return staat.vluchten.filter(function (v) { return v.analyse && v.analyse.bruikbaar; });
  }

  function reeksVanArray(arr) { return Array.prototype.slice.call(arr); }

  function specHoogte(vluchten, toonRuw, toonBand) {
    var series = [], banden = [], markers = [];
    var k = staat.params.dekkingsfactor;
    vluchten.forEach(function (v) {
      var a = v.analyse, r = a.reeksen;
      var t = reeksVanArray(r.t);
      if (toonRuw && vluchten.length <= 3) {
        series.push({ label: null, kleur: v.kleur, x: t, y: reeksVanArray(r.hoogte),
                      punten: true, puntgrootte: 1.1 });
      }
      series.push({ label: vluchtLabel(v), kleur: v.kleur, x: t, y: reeksVanArray(r.hoogte_f),
                    breedte: 1.7 });
      if (toonBand && isFinite(a.ruis.waarde)) {
        var laag = [], hoog = [];
        for (var i = 0; i < r.hoogte_f.length; i++) {
          laag.push(r.hoogte_f[i] - k * a.ruis.waarde);
          hoog.push(r.hoogte_f[i] + k * a.ruis.waarde);
        }
        banden.push({ label: vluchten.length === 1
                        ? 'onzekerheidsband, k = ' + k + ' maal de ruis' : null,
                      kleur: v.kleur, x: t, laag: laag, hoog: hoog });
      }
      if (a.apogeum.waarde !== null) {
        markers.push({
          x: a.tApogeum.waarde, y: a.apogeum.waarde, kleur: v.kleur,
          // bij veel vluchten zouden de bijschriften over elkaar vallen; dan
          // blijft alleen de markering staan en komen de waarden uit de tabel
          label: vluchten.length <= 3
            ? 'apogeum ' + G.metOnzekerheid(a.apogeum.waarde, a.apogeum.onzekerheid, 'm', 2)
            : null
        });
      }
    });
    return {
      titel: 'Hoogte tegen tijd',
      xLabel: 'tijd t (s), gerekend vanaf de lanceerdetectie',
      yLabel: 'hoogte h (m)',
      series: series, banden: banden, markers: markers
    };
  }

  function specSnelheid(vluchten) {
    var series = [], markers = [];
    vluchten.forEach(function (v) {
      var a = v.analyse, r = a.reeksen;
      series.push({ label: vluchtLabel(v), kleur: v.kleur,
                    x: reeksVanArray(r.t), y: reeksVanArray(r.snelheid), breedte: 1.5 });
      if (a.vMax.waarde !== null) {
        markers.push({ x: a.tVMax.waarde, y: a.vMax.waarde, kleur: v.kleur,
                       label: vluchten.length <= 3 ? G.metEenheid(a.vMax.waarde, 1, 'm/s') : null });
      }
    });
    return {
      titel: 'Snelheid tegen tijd (gecentreerd verschil van de gefilterde hoogte)',
      xLabel: 'tijd t (s)',
      yLabel: 'verticale snelheid v (m/s)',
      series: series, markers: markers,
      lijnen: [{ as: 'y', waarde: 0, kleur: '#9aa4b0', stippel: [3, 3] }]
    };
  }

  function specVersnelling(vluchten) {
    var series = [];
    vluchten.forEach(function (v) {
      var a = v.analyse, r = a.reeksen;
      series.push({ label: vluchtLabel(v), kleur: v.kleur,
                    x: reeksVanArray(r.t), y: reeksVanArray(r.aNorm), breedte: 1.4 });
    });
    return {
      titel: 'Versnelling tegen tijd (norm van ax, ay, az)',
      xLabel: 'tijd t (s)',
      yLabel: 'specifieke kracht |a| (g)',
      series: series,
      lijnen: [
        { as: 'y', waarde: staat.params.klip_g, kleur: '#a3241c', stippel: [7, 4],
          label: 'klipgrens ' + G.nl(staat.params.klip_g, 0) + ' g' },
        { as: 'y', waarde: staat.params.stuw_drempel_g, kleur: '#55606d', stippel: [3, 3],
          label: 'drempel stuwfase ' + G.nl(staat.params.stuw_drempel_g, 1) + ' g' },
        { as: 'y', waarde: 1, kleur: '#9aa4b0', stippel: [2, 4], label: '1 g, rustwaarde' }
      ]
    };
  }

  function voegGrafiekToe(doel, spec, sleutel) {
    var fig = maak('figure', 'grafiek');
    var canvas = document.createElement('canvas');
    fig.appendChild(canvas);
    doel.appendChild(fig);
    var breedte = Math.max(320, doel.clientWidth || 720);
    var hoogte = 320;
    // Op het scherm al op dubbele resolutie tekenen, zodat de afdruk scherp is
    // en de PNG-export precies hetzelfde beeld geeft.
    var schaal = Math.max(2, window.devicePixelRatio || 1);
    WR.grafiek.teken(canvas, spec, { breedte: breedte, hoogte: hoogte, schaal: schaal });

    var bijschrift = maak('figcaption');
    bijschrift.appendChild(maak('span', null, spec.titel || ''));
    var knop = maak('button', 'knop niet-printen', 'PNG bewaren');
    knop.addEventListener('click', function () {
      var r = WR.exporteer.grafiekAlsPng(spec, breedte, hoogte, 2,
        'waterraket_' + sleutel + '.png');
      knop.textContent = 'PNG bewaard (' + r.breedte + ' x ' + r.hoogte + ')';
      setTimeout(function () { knop.textContent = 'PNG bewaren'; }, 2500);
    });
    bijschrift.appendChild(knop);
    fig.appendChild(bijschrift);

    return fig;
  }

  function tekenGrafieken() {
    var doel = el('grafieken');
    leeg(doel);
    var vluchten = zichtbareVluchten();
    if (!vluchten.length) {
      doel.appendChild(maak('p', 'leeg',
        'Nog geen bruikbare vluchten. Zodra er een meetreeks is ingeladen verschijnen hier de ' +
        'grafieken van hoogte, snelheid en versnelling.'));
      return;
    }
    var toonRuw = el('toon-ruw').checked;
    var toonBand = el('toon-band').checked;

    voegGrafiekToe(doel, specHoogte(vluchten, toonRuw, toonBand), 'hoogte');
    voegGrafiekToe(doel, specSnelheid(vluchten), 'snelheid');
    voegGrafiekToe(doel, specVersnelling(vluchten), 'versnelling');

    var noot = maak('p', 'uitleg',
      'De onzekerheidsband is k maal de ruis op de hoogtemeting, met k = ' +
      staat.params.dekkingsfactor + '. De ruis komt uit de rustige periode voor de lancering; ' +
      'staat die niet in het log, dan uit de spreiding rond het gefilterde signaal. Bij het ' +
      'apogeum staat de onzekerheid van de paraboolfit, die kleiner is dan de ruis op een ' +
      'losse meting omdat de fit over veel metingen middelt.');
    doel.appendChild(noot);
  }

  // ----------------------------------------------------------- proefopzet
  // Wat er na een wijziging in de proefopzet opnieuw getekend moet worden.
  // De onderdelen die van de proefopzet afhangen melden zich hier aan.
  var naProefopzet = [];
  function naProefopzetWijziging() {
    for (var i = 0; i < naProefopzet.length; i++) naProefopzet[i]();
  }

  function proefopzetVan(v) {
    if (!v.proefopzet) {
      var sleutel = WR.opslag.sleutelVoor(v.gelezen);
      v.opslagsleutel = sleutel;
      v.proefopzet = WR.opslag.leesProefopzet(sleutel) || WR.opslag.leeg();
    }
    return v.proefopzet;
  }

  function tekenProefopzet() {
    var doel = el('proefopzet');
    leeg(doel);
    if (!staat.vluchten.length) {
      doel.appendChild(maak('p', 'leeg', 'Nog geen vluchten ingeladen.'));
      return;
    }
    if (!WR.opslag.beschikbaar) {
      var w = maak('div', 'melding waarschuwing');
      w.appendChild(maak('strong', null, 'Let op: '));
      w.appendChild(document.createTextNode(
        'deze browser laat geen gegevens bewaren, bijvoorbeeld omdat je in een privevenster ' +
        'werkt. De proefopzet blijft nu alleen in het geheugen staan en is weg zodra je de ' +
        'pagina sluit. Exporteer hem als CSV voordat je afsluit.'));
      doel.appendChild(w);
    }

    var velden = Object.keys(WR.opslag.VELDEN);
    var tab = maak('table', 'data proefopzet');
    var thead = maak('thead');
    var kop = maak('tr');
    kop.appendChild(maak('th', null, 'Vlucht'));
    velden.forEach(function (f) {
      var def = WR.opslag.VELDEN[f];
      var th = maak('th', def.tekst ? null : 'getal',
        def.label + (def.eenheid ? ' (' + def.eenheid + ')' : ''));
      th.title = def.uitleg;
      kop.appendChild(th);
    });
    thead.appendChild(kop);
    tab.appendChild(thead);

    var tb = maak('tbody');
    staat.vluchten.forEach(function (v) {
      var waarden = proefopzetVan(v);
      var tr = maak('tr');
      var tdNaam = maak('td');
      tdNaam.appendChild(maak('div', 'naam', vluchtLabel(v)));
      tdNaam.appendChild(maak('div', 'detail', 'sleutel: ' + v.opslagsleutel));
      tr.appendChild(tdNaam);

      velden.forEach(function (f) {
        var def = WR.opslag.VELDEN[f];
        var td = maak('td', def.tekst ? null : 'getal');
        var inp = document.createElement('input');
        if (def.tekst) {
          inp.type = 'text';
          inp.className = 'tekstveld';
          inp.value = waarden[f] || '';
        } else {
          inp.type = 'number';
          if (def.min !== undefined) inp.min = String(def.min);
          if (def.max !== undefined) inp.max = String(def.max);
          if (def.stap !== undefined) inp.step = String(def.stap);
          inp.value = (waarden[f] === null || waarden[f] === undefined) ? '' : String(waarden[f]);
        }
        inp.addEventListener('change', function () {
          waarden[f] = def.tekst ? inp.value : G.lees(inp.value);
          v.proefopzet = WR.opslag.bewaarProefopzet(v.opslagsleutel, waarden);
          naProefopzetWijziging();
        });
        td.appendChild(inp);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    tab.appendChild(tb);
    doel.appendChild(tab);

    var knoppen = maak('div', 'knoppenrij niet-printen');
    var wis = maak('button', 'knop', 'Bewaarde proefopzetten van deze vluchten wissen');
    wis.addEventListener('click', function () {
      staat.vluchten.forEach(function (v) {
        WR.opslag.wisProefopzet(WR.opslag.sleutelVoor(v.gelezen));
        v.proefopzet = null;
      });
      tekenAlles();
    });
    knoppen.appendChild(wis);
    doel.appendChild(knoppen);
  }

  // ---------------------------------------------------------- vergelijken
  function tekenVergelijken() {
    var doel = el('vergelijken');
    leeg(doel);

    var keuze = el('groepeer-op');
    if (!keuze.options.length) {
      Object.keys(WR.opslag.VELDEN).forEach(function (f) {
        var def = WR.opslag.VELDEN[f];
        if (def.tekst) return;
        var opt = document.createElement('option');
        opt.value = f;
        opt.textContent = def.label + ' (' + def.eenheid + ')';
        keuze.appendChild(opt);
      });
      keuze.value = 'begindruk';
    }
    var veld = keuze.value || 'begindruk';
    var def = WR.opslag.VELDEN[veld];

    var vluchten = zichtbareVluchten();
    var punten = [];
    var zonder = 0;
    vluchten.forEach(function (v) {
      var po = proefopzetVan(v);
      var x = po[veld];
      var y = v.analyse.apogeum.waarde;
      if (typeof x !== 'number' || !isFinite(x) || y === null) { zonder++; return; }
      punten.push({ x: x, y: y, label: vluchtLabel(v), kleur: v.kleur,
                    u: v.analyse.apogeum.onzekerheid });
    });

    if (punten.length < 2) {
      doel.appendChild(maak('p', 'leeg',
        'Vul bij minstens twee vluchten de ' + def.label.toLowerCase() + ' in bij de proefopzet, ' +
        'dan verschijnen hier de groepen en het spreidingsdiagram.' +
        (zonder ? ' Nu ontbreekt die waarde bij ' + zonder + ' vlucht(en).' : '')));
      return;
    }
    if (zonder) {
      var w = maak('div', 'melding waarschuwing');
      w.appendChild(maak('strong', null, 'Let op: '));
      w.appendChild(document.createTextNode(
        'bij ' + zonder + ' vlucht(en) is de ' + def.label.toLowerCase() + ' niet ingevuld. ' +
        'Die vluchten doen niet mee in de groepen en in de trendlijn.'));
      doel.appendChild(w);
    }

    var groepen = WR.statistiek.groepeer(punten);
    var foutSoort = el('foutbalksoort').value;

    // tabel per groep
    var tab = maak('table', 'data');
    var thead = maak('thead');
    var kop = maak('tr');
    [def.label + ' (' + def.eenheid + ')', 'aantal vluchten', 'gemiddeld apogeum (m)',
     'standaardafwijking (m)', 'standaardfout (m)', 'vluchten'].forEach(function (h, i) {
      kop.appendChild(maak('th', (i > 0 && i < 5) ? 'getal' : null, h));
    });
    thead.appendChild(kop);
    tab.appendChild(thead);
    var tb = maak('tbody');
    groepen.forEach(function (g) {
      var tr = maak('tr');
      tr.appendChild(maak('td', 'getal', G.nl(g.x, def.decimalen)));
      tr.appendChild(maak('td', 'getal', String(g.n)));
      tr.appendChild(maak('td', 'getal', G.nl(g.gemiddelde, 2)));
      tr.appendChild(maak('td', 'getal', g.n >= 2 ? G.nl(g.sd, 2) : '-'));
      tr.appendChild(maak('td', 'getal', g.n >= 2 ? G.nl(g.sem, 2) : '-'));
      tr.appendChild(maak('td', null, g.labels.join(', ')));
      tb.appendChild(tr);
    });
    tab.appendChild(tb);
    doel.appendChild(tab);

    var enkel = groepen.filter(function (g) { return g.n < 2; }).length;
    doel.appendChild(maak('p', 'uitleg',
      'Een standaardafwijking heeft minstens twee herhalingen nodig. ' +
      (enkel ? enkel + ' van de ' + groepen.length + ' groepen heeft er maar een; ' +
               'daar staat een streepje in plaats van een verzonnen nul.'
             : 'Alle ' + groepen.length + ' groepen hebben er genoeg.')));

    // spreidingsdiagram
    var soort = el('trendsoort').value;
    var fit = (soort === 'geen') ? null : WR.statistiek.trend(punten, soort);

    var series = [{
      label: 'losse vluchten', kleur: '#8f9aa6',
      x: punten.map(function (p) { return p.x; }),
      y: punten.map(function (p) { return p.y; }),
      punten: true, puntgrootte: 3
    }];
    var foutbalken = [{
      kleur: '#0072b2',
      x: groepen.map(function (g) { return g.x; }),
      y: groepen.map(function (g) { return g.gemiddelde; }),
      fout: groepen.map(function (g) {
        return g.n >= 2 ? (foutSoort === 'sem' ? g.sem : g.sd) : NaN;
      })
    }];
    series.push({
      label: 'groepsgemiddelde met ' + (foutSoort === 'sem' ? 'standaardfout' : 'standaardafwijking'),
      kleur: '#0072b2',
      x: groepen.map(function (g) { return g.x; }),
      y: groepen.map(function (g) { return g.gemiddelde; }),
      punten: true, puntgrootte: 4
    });

    if (fit) {
      var xMin = Math.min.apply(null, punten.map(function (p) { return p.x; }));
      var xMax = Math.max.apply(null, punten.map(function (p) { return p.x; }));
      var xs = [], ys = [];
      for (var i = 0; i <= 60; i++) {
        var x = xMin + (xMax - xMin) * i / 60;
        xs.push(x); ys.push(fit.voorspel(x));
      }
      series.push({
        label: 'trendlijn: ' + fit.formule.replace('y', 'H').replace('x', def.label.toLowerCase()),
        kleur: '#d55e00', x: xs, y: ys, breedte: 1.8, stippel: [7, 4]
      });
    }

    var spec = {
      titel: 'Apogeum tegen ' + def.label.toLowerCase(),
      xLabel: def.label + ' (' + def.eenheid + ')',
      yLabel: 'apogeum H (m)',
      series: series, foutbalken: foutbalken
    };
    voegGrafiekToe(doel, spec, 'vergelijking');

    if (fit) {
      var blok = maak('div', 'fitblok');
      blok.appendChild(maak('div', 'formule',
        fit.formule.replace(/^y/, 'H (m)').replace(/ x/, ' * ' + veld)));
      var maat = maak('p', 'uitleg');
      maat.appendChild(document.createTextNode(
        'Kwaliteit van de fit: R2 = ' + G.nl(fit.r2, 4) +
        ' en RMSE = ' + G.nl(fit.rmse, 2) + ' m, over ' + fit.n + ' vluchten. ' +
        'R2 is het deel van de spreiding in het apogeum dat de trendlijn verklaart; ' +
        'RMSE is de wortel uit de gemiddelde kwadratische afwijking, in meters, en is dus ' +
        'rechtstreeks te vergelijken met de meetonzekerheid. De fit gaat door alle losse ' +
        'vluchten, niet door de groepsgemiddelden.'));
      blok.appendChild(maat);
      doel.appendChild(blok);
    }
  }

  // --------------------------------------------------------------- theorie
  // De proefopzet van een vlucht vertalen naar de invoer van het model.
  function theorieInvoerVan(v) {
    var po = proefopzetVan(v);
    var p = staat.params;
    if (typeof po.begindruk !== 'number' || typeof po.vulfractie !== 'number' ||
        typeof po.nozzle !== 'number' || typeof po.massa !== 'number') return null;
    return {
      begindruk_bar: po.begindruk,
      vulfractie: po.vulfractie / 100,
      nozzle_mm: po.nozzle,
      leegmassa_kg: po.massa / 1000,
      flesvolume_l: p.theorie_flesvolume_l,
      flesdiameter_mm: p.theorie_flesdiameter_mm,
      gamma: p.theorie_gamma,
      cd_nozzle: p.theorie_cd_nozzle,
      cw: p.theorie_cw,
      rho_water: p.theorie_rho_water,
      rho_lucht: p.theorie_rho_lucht,
      patm_hpa: p.theorie_patm_hpa,
      g: p.theorie_g
    };
  }

  // gemeten omgevingswaarden aan de grond, uit de rustperiode of het begin van het log
  function grondwaarden(v) {
    var g2 = v.gelezen;
    if (!g2.geldig) return null;
    var eind = Math.min(g2.aantal, Math.max(5, (v.analyse && v.analyse.rust) ? v.analyse.rust.monsters : 5));
    var druk = WR.signaal.mediaan(Array.prototype.slice.call(g2.druk, 0, eind));
    var temp = WR.signaal.mediaan(Array.prototype.slice.call(g2.temp, 0, eind));
    return { druk_hpa: druk, temp_c: temp, rho: WR.theorie.luchtdichtheid(druk, temp) };
  }

  function tekenTheorie() {
    var doel = el('theorie');
    leeg(doel);
    var vluchten = zichtbareVluchten();
    if (!vluchten.length) {
      doel.appendChild(maak('p', 'leeg', 'Nog geen vluchten ingeladen.'));
      return;
    }

    var rijen = [], series = [], zonder = [];
    vluchten.forEach(function (v) {
      var inv = theorieInvoerVan(v);
      if (!inv) { zonder.push(vluchtLabel(v)); return; }
      var th = WR.theorie.bereken(inv);
      v.theorie = th;
      rijen.push({ v: v, th: th });

      var r = v.analyse.reeksen;
      series.push({ label: vluchtLabel(v) + ' gemeten', kleur: v.kleur,
                    x: reeksVanArray(r.t), y: reeksVanArray(r.hoogte_f), breedte: 1.7 });
      if (th.apogeum_m !== null && th.baan.length) {
        // de theoriebaan begint bij het loskomen; de meting begint bij de
        // lanceerdetectie. Het model wordt op dat moment gelegd.
        var t0 = (v.analyse.rust && isFinite(v.analyse.rust.t_tot)) ? v.analyse.rust.t_tot : 0;
        series.push({ label: vluchtLabel(v) + ' theorie', kleur: v.kleur, stippel: [6, 4],
                      breedte: 1.5,
                      x: th.baan.map(function (b) { return b.t + t0; }),
                      y: th.baan.map(function (b) { return b.h; }) });
      }
    });

    if (zonder.length) {
      var w = maak('div', 'melding waarschuwing');
      w.appendChild(maak('strong', null, 'Onvolledig: '));
      w.appendChild(document.createTextNode(
        'voor ' + zonder.join(', ') + ' ontbreekt een van de vier gegevens die het model nodig ' +
        'heeft (vulfractie, begindruk, nozzlediameter, massa). Voor die vluchten wordt geen ' +
        'theoretische hoogte berekend.'));
      doel.appendChild(w);
    }
    if (!rijen.length) return;

    // vergelijkingstabel
    var tab = maak('table', 'data');
    var thead = maak('thead');
    var kop = maak('tr');
    ['Vlucht', 'Theorie (m)', 'Meting (m)', 'Verschil (m)', 'Verschil (%)',
     'Theoretische stuwtijd (s)', 'Theoretische snelheid bij burnout (m/s)'].forEach(function (h, i) {
      kop.appendChild(maak('th', i ? 'getal' : null, h));
    });
    thead.appendChild(kop);
    tab.appendChild(thead);
    var tb = maak('tbody');
    rijen.forEach(function (r) {
      var verg = WR.theorie.vergelijk(r.th.apogeum_m, r.v.analyse.apogeum.waarde);
      var tr = maak('tr');
      tr.appendChild(maak('td', null, vluchtLabel(r.v)));
      tr.appendChild(maak('td', 'getal', G.nl(r.th.apogeum_m, 1)));
      tr.appendChild(maak('td', 'getal', G.metOnzekerheid(
        r.v.analyse.apogeum.waarde, r.v.analyse.apogeum.onzekerheid, '', 1)));
      tr.appendChild(maak('td', 'getal', verg ? G.nl(verg.verschil_m, 1) : '-'));
      tr.appendChild(maak('td', 'getal', verg && verg.verschil_pct !== null
        ? G.nl(verg.verschil_pct, 1) : '-'));
      tr.appendChild(maak('td', 'getal', G.nl(r.th.stuwtijd_s, 3)));
      tr.appendChild(maak('td', 'getal', G.nl(r.th.v_burnout_ms, 1)));
      tb.appendChild(tr);
    });
    tab.appendChild(tb);
    doel.appendChild(tab);
    doel.appendChild(maak('p', 'uitleg',
      'Het verschil is de meting min de theorie. Een negatief verschil betekent dat de raket ' +
      'lager kwam dan het model voorspelt, bijvoorbeeld door een scheve start, wind, of een ' +
      'weerstandscoefficient die hoger ligt dan de ingestelde waarde.'));

    // grafiek met theorie en meting naast elkaar
    voegGrafiekToe(doel, {
      titel: 'Theorie en meting in dezelfde grafiek',
      xLabel: 'tijd t (s)', yLabel: 'hoogte h (m)',
      series: series
    }, 'theorie');

    var eerste = rijen[0].v;
    var gw = grondwaarden(eerste);
    if (gw && isFinite(gw.rho)) {
      doel.appendChild(maak('p', 'uitleg',
        'Uit dit logbestand zelf: luchtdruk aan de grond ' + G.metEenheid(gw.druk_hpa, 1, 'hPa') +
        ' en temperatuur ' + G.metEenheid(gw.temp_c, 1, 'graden C') + '. Daaruit volgt een ' +
        'luchtdichtheid van ' + G.metEenheid(gw.rho, 3, 'kg/m3') + ' met rho = p / (R T). ' +
        'Het model rekent nu met ' + G.metEenheid(staat.params.theorie_rho_lucht, 3, 'kg/m3') +
        ' en een luchtdruk van ' + G.metEenheid(staat.params.theorie_patm_hpa, 1, 'hPa') +
        '; die twee zijn aan te passen in het paneel met aannames.'));
    }

    // zichtbare lijst met aannames
    var lijstBlok = maak('div', 'aannamelijst');
    lijstBlok.appendChild(maak('h3', null, 'Aannames in dit model'));
    var ol = document.createElement('ol');
    rijen[0].th.aannames.forEach(function (a) {
      var li = document.createElement('li');
      li.appendChild(document.createTextNode(a.tekst + ' '));
      var code = maak('span', 'aannamewaarde', a.waarde);
      li.appendChild(code);
      ol.appendChild(li);
    });
    lijstBlok.appendChild(ol);
    doel.appendChild(lijstBlok);

    rijen.forEach(function (r) {
      r.th.waarschuwingen.forEach(function (m) {
        var d = maak('div', 'melding waarschuwing');
        d.appendChild(maak('strong', null, vluchtLabel(r.v) + '. '));
        d.appendChild(document.createTextNode(m));
        doel.appendChild(d);
      });
      r.th.fouten.forEach(function (m) {
        var d = maak('div', 'melding fout');
        d.appendChild(maak('strong', null, vluchtLabel(r.v) + '. '));
        d.appendChild(document.createTextNode(m));
        doel.appendChild(d);
      });
    });
  }

  // ------------------------------------------------------------- aannames
  function tekenAannames() {
    var doel = el('aannames-inhoud');
    leeg(doel);
    P.GROEPEN.forEach(function (groep) {
      var sleutels = Object.keys(P.DEFINITIES).filter(function (s) {
        return P.DEFINITIES[s].groep === groep.sleutel;
      });
      if (!sleutels.length) return;
      var blok = maak('div', 'aannamegroep');
      blok.appendChild(maak('h4', null, groep.titel));
      sleutels.forEach(function (s) {
        var def = P.DEFINITIES[s];
        var rij = maak('div', 'aannamerij');

        var links = maak('div');
        var lab = maak('label', null, def.label);
        lab.setAttribute('for', 'par-' + s);
        links.appendChild(lab);
        links.appendChild(maak('p', 'uitleg', def.uitleg));
        rij.appendChild(links);

        var vak = maak('div', 'invoervak');
        var inp = document.createElement('input');
        inp.type = 'number';
        inp.id = 'par-' + s;
        inp.value = String(staat.params[s]);
        if (def.min !== undefined) inp.min = String(def.min);
        if (def.max !== undefined) inp.max = String(def.max);
        if (def.stap !== undefined) inp.step = String(def.stap);
        inp.disabled = !def.instelbaar;
        inp.addEventListener('change', function () {
          var x = G.lees(inp.value);
          var nieuw = {};
          for (var k in staat.params) nieuw[k] = staat.params[k];
          if (x !== null) nieuw[s] = x;
          staat.params = P.valideer(nieuw);
          inp.value = String(staat.params[s]);
          herbereken();
          tekenAlles();
        });
        vak.appendChild(inp);
        vak.appendChild(maak('span', 'eenheid', def.eenheid || ''));
        rij.appendChild(vak);

        blok.appendChild(rij);
      });
      doel.appendChild(blok);
    });
  }

  // ---------------------------------------------------------------- rapport
  function datumTekst() {
    var d = new Date();
    function tw(x) { return (x < 10 ? '0' : '') + x; }
    return d.getFullYear() + '-' + tw(d.getMonth() + 1) + '-' + tw(d.getDate()) +
           ' ' + tw(d.getHours()) + ':' + tw(d.getMinutes());
  }

  function exportRijen() {
    return staat.vluchten.filter(function (v) { return v.analyse; }).map(function (v) {
      return {
        naam: v.naam,
        gelezen: v.gelezen,
        analyse: v.analyse,
        proefopzet: proefopzetVan(v),
        theorie: v.theorie || null
      };
    });
  }

  function tekenRapport() {
    var doel = el('rapport-inhoud');
    leeg(doel);
    el('printkop-onder').textContent =
      'Gemaakt op ' + datumTekst() + '. ' + staat.vluchten.length + ' vlucht(en) ingeladen.';

    if (!staat.vluchten.length) {
      doel.appendChild(maak('p', 'leeg', 'Nog geen vluchten ingeladen.'));
      return;
    }

    // de gebruikte formules, zodat het rapport op zichzelf te lezen is
    doel.appendChild(maak('h3', null, 'Gebruikte formules en methoden'));
    var tabF = maak('table', 'data');
    var kopF = maak('tr');
    ['Grootheid', 'Eenheid', 'Formule', 'Methode'].forEach(function (h) {
      kopF.appendChild(maak('th', null, h));
    });
    var theadF = maak('thead'); theadF.appendChild(kopF); tabF.appendChild(theadF);
    var tbF = maak('tbody');
    RIJVOLGORDE.forEach(function (sleutel) {
      var def = WR.analyse.GROOTHEDEN[sleutel];
      if (!def) return;
      var tr = maak('tr');
      tr.appendChild(maak('td', null, def.label));
      tr.appendChild(maak('td', null, def.eenheid || '-'));
      var tdF = maak('td');
      tdF.appendChild(maak('code', null, def.formule));
      tr.appendChild(tdF);
      tr.appendChild(maak('td', null, def.methode));
      tbF.appendChild(tr);
    });
    tabF.appendChild(tbF);
    doel.appendChild(tabF);

    // de aannames met de waarden waarmee gerekend is
    doel.appendChild(maak('h3', null, 'Aannames en instellingen waarmee gerekend is'));
    var tabP = maak('table', 'data');
    var kopP = maak('tr');
    ['Instelling', 'Waarde', 'Eenheid', 'Toelichting'].forEach(function (h, i) {
      kopP.appendChild(maak('th', i === 1 ? 'getal' : null, h));
    });
    var theadP = maak('thead'); theadP.appendChild(kopP); tabP.appendChild(theadP);
    var tbP = maak('tbody');
    Object.keys(WR.parameters.DEFINITIES).forEach(function (s) {
      var def = WR.parameters.DEFINITIES[s];
      var tr = maak('tr');
      tr.appendChild(maak('td', null, def.label));
      tr.appendChild(maak('td', 'getal', G.nl(staat.params[s], def.geheel ? 0 : 3)));
      tr.appendChild(maak('td', null, def.eenheid || '-'));
      tr.appendChild(maak('td', null, def.uitleg));
      tbP.appendChild(tr);
    });
    tabP.appendChild(tbP);
    doel.appendChild(tabP);

    // meetonzekerheid per vlucht
    doel.appendChild(maak('h3', null, 'Meetonzekerheid per vlucht'));
    var tabU = maak('table', 'data');
    var kopU = maak('tr');
    ['Vlucht', 'Ruis sigma_h (m)', 'Bron van de ruis', 'Bijdrage ruis (m)',
     'Bijdrage methode (m)', 'Apogeum met onzekerheid (m)'].forEach(function (h, i) {
      kopU.appendChild(maak('th', (i > 0 && i !== 2) ? 'getal' : null, h));
    });
    var theadU = maak('thead'); theadU.appendChild(kopU); tabU.appendChild(theadU);
    var tbU = maak('tbody');
    staat.vluchten.forEach(function (v) {
      if (!v.analyse) return;
      var a = v.analyse;
      var tr = maak('tr');
      tr.appendChild(maak('td', null, vluchtLabel(v)));
      tr.appendChild(maak('td', 'getal', G.nl(a.ruis.waarde, 4)));
      tr.appendChild(maak('td', null, a.rust
        ? (a.rust.methode === 'rustperiode'
            ? 'rustperiode, ' + a.rust.monsters + ' metingen'
            : 'restspreiding rond het filter')
        : '-'));
      tr.appendChild(maak('td', 'getal', G.nl(a.apogeum.u_ruis, 4)));
      tr.appendChild(maak('td', 'getal', G.nl(a.apogeum.u_methode, 4)));
      tr.appendChild(maak('td', 'getal',
        G.metOnzekerheid(a.apogeum.waarde, a.apogeum.onzekerheid, '', 2)));
      tbU.appendChild(tr);
    });
    tabU.appendChild(tbU);
    doel.appendChild(tabU);
    doel.appendChild(maak('p', 'uitleg',
      'De onzekerheid op het apogeum is k maal de wortel uit de som van de kwadraten van twee ' +
      'bijdragen: de meetruis, doorgerekend naar de top van de paraboolfit, en het verschil ' +
      'tussen de twee methoden voor de tophoogte. Op dit moment is k = ' +
      staat.params.dekkingsfactor + '.'));
  }

  // -------------------------------------------------------------- bediening
  function lesBestanden(lijst) {
    var over = lijst.length;
    if (!over) return;
    Array.prototype.forEach.call(lijst, function (bestand) {
      var lezer = new FileReader();
      lezer.onload = function () {
        voegBestandToe(bestand.name, String(lezer.result));
        if (--over === 0) { herbereken(); tekenAlles(); }
      };
      lezer.onerror = function () {
        if (--over === 0) { herbereken(); tekenAlles(); }
      };
      lezer.readAsText(bestand);
    });
  }

  function koppelBediening() {
    el('bestanden').addEventListener('change', function (e) {
      lesBestanden(e.target.files);
      e.target.value = '';
    });
    el('knop-wis-vluchten').addEventListener('click', function () {
      staat.vluchten = [];
      tekenAlles();
    });
    el('toon-ruw').addEventListener('change', tekenGrafieken);
    el('toon-band').addEventListener('change', tekenGrafieken);
    ['groepeer-op', 'trendsoort', 'foutbalksoort'].forEach(function (id) {
      el(id).addEventListener('change', tekenVergelijken);
    });
    naProefopzet.push(tekenVergelijken);
    naProefopzet.push(tekenTheorie);
    naProefopzet.push(tekenRapport);

    el('knop-csv').addEventListener('click', function () {
      var rijen = exportRijen();
      if (!rijen.length) return;
      var tekst = WR.exporteer.csvGrootheden(rijen, staat.params, datumTekst());
      WR.exporteer.csvAlsBestand(tekst, 'waterraket_grootheden.csv');
    });
    el('knop-print').addEventListener('click', function () {
      WR.exporteer.afdrukken();
    });
    var hertekenTimer = null;
    window.addEventListener('resize', function () {
      if (hertekenTimer) clearTimeout(hertekenTimer);
      hertekenTimer = setTimeout(tekenGrafieken, 150);
    });
    el('knop-herstel-aannames').addEventListener('click', function () {
      staat.params = P.standaard();
      tekenAannames();
      herbereken();
      tekenAlles();
    });

    var sleep = el('sleepvlak');
    var teller = 0;
    window.addEventListener('dragenter', function (e) { e.preventDefault(); if (++teller === 1) sleep.classList.add('aan'); });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('dragleave', function () { if (--teller <= 0) { teller = 0; sleep.classList.remove('aan'); } });
    window.addEventListener('drop', function (e) {
      e.preventDefault(); teller = 0; sleep.classList.remove('aan');
      if (e.dataTransfer && e.dataTransfer.files) lesBestanden(e.dataTransfer.files);
    });
  }

  // haak voor de zelftest in de browser
  window.WR_APP = {
    staat: staat,
    voegTekstToe: function (naam, tekst) { voegBestandToe(naam, tekst); },
    herbereken: herbereken,
    tekenAlles: tekenAlles
  };

  document.addEventListener('DOMContentLoaded', function () {
    koppelBediening();
    tekenAannames();
    tekenAlles();
  });
})();
