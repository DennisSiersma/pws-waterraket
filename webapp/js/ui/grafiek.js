/*
  grafiek.js  -  tekenen op canvas, zonder bibliotheek van buiten

  Een eigen tekenlaag omdat de applicatie offline moet werken en zonder
  bouwstap. Alles wat getekend wordt komt uit een beschrijving (spec), zodat
  dezelfde grafiek op het scherm en op dubbele resolutie voor de PNG-export
  op precies dezelfde manier ontstaat.
*/
(function (root) {
  'use strict';

  var Gr = {};
  var getal = root.WR.getal;

  /*
    Lijnkleuren. Gekozen op onderling contrast en op onderscheid bij de meest
    voorkomende vormen van kleurenblindheid (naar het palet van Okabe en Ito),
    aangevuld tot tien zodat acht vluchten over elkaar leesbaar blijven.
  */
  Gr.PALET = ['#0072b2', '#d55e00', '#009e73', '#cc79a7', '#e69f00',
              '#56b4e9', '#6a3d9a', '#a3241c', '#4d4d4d', '#0e7c7b'];

  var KLEUR = {
    as: '#55606d',
    raster: '#e6eaf0',
    rasterZacht: '#f1f4f8',
    tekst: '#17202a',
    zachteTekst: '#55606d',
    vlak: '#ffffff'
  };

  // ------------------------------------------------------------- schaalhulp

  function tickStap(bereik, doelAantal) {
    if (!(bereik > 0)) return 1;
    var ruw = bereik / Math.max(1, doelAantal);
    var macht = Math.pow(10, Math.floor(Math.log(ruw) / Math.LN10));
    var g = ruw / macht;
    var stap = (g <= 1) ? 1 : (g <= 2) ? 2 : (g <= 5) ? 5 : 10;
    return stap * macht;
  }

  function decimalenVoor(stap) {
    if (!(stap > 0)) return 0;
    var d = Math.ceil(-Math.log(stap) / Math.LN10);
    return Math.max(0, Math.min(4, d));
  }

  function grenzen(spec) {
    var xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    function neem(x, y) {
      if (isFinite(x)) { if (x < xMin) xMin = x; if (x > xMax) xMax = x; }
      if (isFinite(y)) { if (y < yMin) yMin = y; if (y > yMax) yMax = y; }
    }
    (spec.series || []).forEach(function (s) {
      for (var i = 0; i < s.x.length; i++) neem(s.x[i], s.y[i]);
    });
    (spec.banden || []).forEach(function (b) {
      for (var i = 0; i < b.x.length; i++) { neem(b.x[i], b.laag[i]); neem(b.x[i], b.hoog[i]); }
    });
    (spec.markers || []).forEach(function (m) { neem(m.x, m.y); });
    (spec.lijnen || []).forEach(function (l) {
      if (l.as === 'y' && isFinite(l.waarde)) { if (l.waarde < yMin) yMin = l.waarde; if (l.waarde > yMax) yMax = l.waarde; }
      if (l.as === 'x' && isFinite(l.waarde)) { if (l.waarde < xMin) xMin = l.waarde; if (l.waarde > xMax) xMax = l.waarde; }
    });
    if (!isFinite(xMin)) { xMin = 0; xMax = 1; }
    if (!isFinite(yMin)) { yMin = 0; yMax = 1; }
    if (xMax === xMin) { xMax = xMin + 1; }
    if (yMax === yMin) { yMax = yMin + 1; }

    var marge = 0.06 * (yMax - yMin);
    yMin -= marge; yMax += marge;

    if (spec.xMin !== undefined && spec.xMin !== null) xMin = spec.xMin;
    if (spec.xMax !== undefined && spec.xMax !== null) xMax = spec.xMax;
    if (spec.yMin !== undefined && spec.yMin !== null) yMin = spec.yMin;
    if (spec.yMax !== undefined && spec.yMax !== null) yMax = spec.yMax;
    return { xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax };
  }

  // --------------------------------------------------------------- tekenen

  /*
    teken(canvas, spec, opties)

    spec = {
      titel, xLabel, yLabel,            // assen krijgen altijd hun eenheid mee
      series: [{label, kleur, x, y, breedte, stippel, punten}],
      banden: [{label, kleur, x, laag, hoog}],
      lijnen: [{as:'y'|'x', waarde, label, kleur, stippel}],
      markers:[{x, y, label, kleur}],
      xMin, xMax, yMin, yMax
    }
    opties = { breedte, hoogte, schaal }   schaal 2 geeft dubbele resolutie
  */
  Gr.teken = function (canvas, spec, opties) {
    var o = opties || {};
    var dpr = o.schaal || (root.devicePixelRatio || 1);
    var b = o.breedte || canvas.clientWidth || 720;
    var h = o.hoogte || 320;

    canvas.width = Math.round(b * dpr);
    canvas.height = Math.round(h * dpr);
    // alleen de breedte in CSS vastleggen; de hoogte volgt uit de verhouding van
    // het beeld. Zo krimpt de grafiek netjes mee op een smal scherm en op A4.
    canvas.style.width = b + 'px';
    canvas.style.height = 'auto';

    var c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = KLEUR.vlak;
    c.fillRect(0, 0, b, h);
    c.textBaseline = 'middle';

    var lettertype = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

    // legenda bovenaan, kan over meerdere regels lopen
    var legendaItems = [];
    (spec.series || []).forEach(function (s) { if (s.label) legendaItems.push({ label: s.label, kleur: s.kleur, stippel: s.stippel }); });
    (spec.lijnen || []).forEach(function (l) { if (l.label) legendaItems.push({ label: l.label, kleur: l.kleur || KLEUR.as, stippel: l.stippel || [5, 4] }); });
    (spec.banden || []).forEach(function (bd) { if (bd.label) legendaItems.push({ label: bd.label, kleur: bd.kleur, vlak: true }); });

    var titelHoogte = spec.titel ? 22 : 4;
    c.font = '12px ' + lettertype;
    var legendaRegels = 1, xCursor = 0, legendaBreedte = b - 16;
    var posities = [];
    legendaItems.forEach(function (item) {
      var w = 16 + c.measureText(item.label).width + 16;
      if (xCursor + w > legendaBreedte && xCursor > 0) { legendaRegels++; xCursor = 0; }
      posities.push({ regel: legendaRegels - 1, x: xCursor, item: item, w: w });
      xCursor += w;
    });
    var legendaHoogte = legendaItems.length ? legendaRegels * 16 + 6 : 0;

    var marge = {
      links: 58, rechts: 14,
      boven: titelHoogte + legendaHoogte + 8,
      onder: 44
    };
    var pl = marge.links, pt = marge.boven;
    var pb = b - marge.links - marge.rechts;
    var ph = h - marge.boven - marge.onder;
    if (pb < 40 || ph < 40) return;

    var gr = grenzen(spec);
    function X(x) { return pl + (x - gr.xMin) / (gr.xMax - gr.xMin) * pb; }
    function Y(y) { return pt + ph - (y - gr.yMin) / (gr.yMax - gr.yMin) * ph; }

    // titel
    if (spec.titel) {
      c.fillStyle = KLEUR.tekst;
      c.font = '600 13px ' + lettertype;
      c.textAlign = 'left';
      c.fillText(spec.titel, 4, 11);
    }

    // legenda
    c.font = '12px ' + lettertype;
    posities.forEach(function (p) {
      var y = titelHoogte + 8 + p.regel * 16;
      c.fillStyle = p.item.kleur;
      if (p.item.vlak) {
        c.globalAlpha = 0.35; c.fillRect(p.x + 4, y - 4, 11, 9); c.globalAlpha = 1;
        c.strokeStyle = p.item.kleur; c.lineWidth = 1;
        c.strokeRect(p.x + 4.5, y - 4.5, 11, 9);
      } else {
        c.strokeStyle = p.item.kleur;
        c.lineWidth = 2.2;
        c.setLineDash(p.item.stippel || []);
        c.beginPath(); c.moveTo(p.x + 2, y); c.lineTo(p.x + 15, y); c.stroke();
        c.setLineDash([]);
      }
      c.fillStyle = KLEUR.tekst;
      c.textAlign = 'left';
      c.fillText(p.item.label, p.x + 20, y);
    });

    // raster en assen
    var stapX = tickStap(gr.xMax - gr.xMin, Math.max(2, Math.round(pb / 78)));
    var stapY = tickStap(gr.yMax - gr.yMin, Math.max(2, Math.round(ph / 46)));
    var dx = decimalenVoor(stapX), dy = decimalenVoor(stapY);

    c.lineWidth = 1;
    c.font = '11px ' + lettertype;
    var eersteX = Math.ceil(gr.xMin / stapX) * stapX;
    for (var xv = eersteX; xv <= gr.xMax + 1e-9; xv += stapX) {
      var px = X(xv);
      c.strokeStyle = KLEUR.raster;
      c.beginPath(); c.moveTo(Math.round(px) + 0.5, pt); c.lineTo(Math.round(px) + 0.5, pt + ph); c.stroke();
      c.fillStyle = KLEUR.zachteTekst;
      c.textAlign = 'center';
      c.fillText(getal.nl(xv, dx), px, pt + ph + 14);
    }
    var eersteY = Math.ceil(gr.yMin / stapY) * stapY;
    for (var yv = eersteY; yv <= gr.yMax + 1e-9; yv += stapY) {
      var py = Y(yv);
      c.strokeStyle = KLEUR.raster;
      c.beginPath(); c.moveTo(pl, Math.round(py) + 0.5); c.lineTo(pl + pb, Math.round(py) + 0.5); c.stroke();
      c.fillStyle = KLEUR.zachteTekst;
      c.textAlign = 'right';
      c.fillText(getal.nl(yv, dy), pl - 7, py);
    }

    // banden onder de lijnen
    (spec.banden || []).forEach(function (bd) {
      c.fillStyle = bd.kleur;
      c.globalAlpha = bd.doorzicht === undefined ? 0.20 : bd.doorzicht;
      c.beginPath();
      var begonnen = false, i;
      for (i = 0; i < bd.x.length; i++) {
        if (!isFinite(bd.x[i]) || !isFinite(bd.hoog[i])) continue;
        if (!begonnen) { c.moveTo(X(bd.x[i]), Y(bd.hoog[i])); begonnen = true; }
        else c.lineTo(X(bd.x[i]), Y(bd.hoog[i]));
      }
      for (i = bd.x.length - 1; i >= 0; i--) {
        if (!isFinite(bd.x[i]) || !isFinite(bd.laag[i])) continue;
        c.lineTo(X(bd.x[i]), Y(bd.laag[i]));
      }
      c.closePath(); c.fill();
      c.globalAlpha = 1;
    });

    // hulplijnen
    (spec.lijnen || []).forEach(function (l) {
      if (!isFinite(l.waarde)) return;
      c.strokeStyle = l.kleur || KLEUR.as;
      c.lineWidth = 1.4;
      c.setLineDash(l.stippel || [6, 4]);
      c.beginPath();
      if (l.as === 'y') { c.moveTo(pl, Y(l.waarde)); c.lineTo(pl + pb, Y(l.waarde)); }
      else { c.moveTo(X(l.waarde), pt); c.lineTo(X(l.waarde), pt + ph); }
      c.stroke();
      c.setLineDash([]);
    });

    // meetreeksen; NaN breekt de lijn af, zo blijft een gat een gat
    c.lineJoin = 'round'; c.lineCap = 'round';
    (spec.series || []).forEach(function (s) {
      c.strokeStyle = s.kleur;
      c.lineWidth = s.breedte || 1.6;
      c.setLineDash(s.stippel || []);
      if (s.punten) {
        c.fillStyle = s.kleur;
        for (var i = 0; i < s.x.length; i++) {
          if (!isFinite(s.x[i]) || !isFinite(s.y[i])) continue;
          c.beginPath();
          c.arc(X(s.x[i]), Y(s.y[i]), s.puntgrootte || 3, 0, 2 * Math.PI);
          c.fill();
        }
      } else {
        c.beginPath();
        var open = false;
        for (var j = 0; j < s.x.length; j++) {
          if (!isFinite(s.x[j]) || !isFinite(s.y[j])) { open = false; continue; }
          var px2 = X(s.x[j]), py2 = Y(s.y[j]);
          if (!open) { c.moveTo(px2, py2); open = true; } else c.lineTo(px2, py2);
        }
        c.stroke();
      }
      c.setLineDash([]);
    });

    // foutbalken
    (spec.foutbalken || []).forEach(function (f) {
      c.strokeStyle = f.kleur;
      c.lineWidth = 1.3;
      for (var i = 0; i < f.x.length; i++) {
        if (!isFinite(f.x[i]) || !isFinite(f.y[i]) || !isFinite(f.fout[i])) continue;
        var px3 = X(f.x[i]);
        var y1 = Y(f.y[i] - f.fout[i]), y2 = Y(f.y[i] + f.fout[i]);
        c.beginPath();
        c.moveTo(px3, y1); c.lineTo(px3, y2);
        c.moveTo(px3 - 4, y1); c.lineTo(px3 + 4, y1);
        c.moveTo(px3 - 4, y2); c.lineTo(px3 + 4, y2);
        c.stroke();
      }
    });

    // markeringen, bijvoorbeeld het apogeum
    (spec.markers || []).forEach(function (m) {
      if (!isFinite(m.x) || !isFinite(m.y)) return;
      var px4 = X(m.x), py4 = Y(m.y);
      c.strokeStyle = m.kleur; c.fillStyle = m.kleur; c.lineWidth = 1.6;
      c.beginPath(); c.arc(px4, py4, 4, 0, 2 * Math.PI); c.stroke();
      c.beginPath(); c.arc(px4, py4, 1.6, 0, 2 * Math.PI); c.fill();
      if (m.label) {
        c.font = '11px ' + lettertype;
        var breedteTekst = c.measureText(m.label).width;
        var lx = px4 + 8, ly = py4 - 10;
        if (lx + breedteTekst > pl + pb) lx = px4 - 8 - breedteTekst;
        if (ly < pt + 8) ly = py4 + 12;
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.fillRect(lx - 2, ly - 7, breedteTekst + 4, 14);
        c.fillStyle = m.kleur;
        c.textAlign = 'left';
        c.fillText(m.label, lx, ly);
      }
    });

    // asrand
    c.strokeStyle = KLEUR.as; c.lineWidth = 1;
    c.strokeRect(pl + 0.5, pt + 0.5, pb, ph);

    // astitels met eenheid
    c.fillStyle = KLEUR.tekst;
    c.font = '12px ' + lettertype;
    c.textAlign = 'center';
    if (spec.xLabel) c.fillText(spec.xLabel, pl + pb / 2, h - 10);
    if (spec.yLabel) {
      c.save();
      c.translate(12, pt + ph / 2);
      c.rotate(-Math.PI / 2);
      c.fillText(spec.yLabel, 0, 0);
      c.restore();
    }
  };

  /*
    Dezelfde grafiek nog eens tekenen op een losse canvas met een hogere
    schaal, voor de PNG-export. schaal 2 betekent tweemaal de schermresolutie.
  */
  Gr.naarCanvas = function (spec, breedte, hoogte, schaal) {
    var c = document.createElement('canvas');
    Gr.teken(c, spec, { breedte: breedte, hoogte: hoogte, schaal: schaal || 2 });
    return c;
  };

  root.WR = root.WR || {};
  root.WR.grafiek = Gr;
})(typeof globalThis !== 'undefined' ? globalThis : this);
