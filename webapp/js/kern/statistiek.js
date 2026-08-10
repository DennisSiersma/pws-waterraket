/*
  statistiek.js  -  groepen, spreiding en trendlijnen

  Voor het vergelijken van vluchten: groepeer op de ingestelde variabele, geef
  per groep het gemiddelde en de standaardafwijking, en pas een trendlijn met
  kleinste kwadraten. Elke uitkomst komt met de formule waarmee hij te
  controleren is.
*/
(function (root) {
  'use strict';

  var St = {};

  St.gemiddelde = function (lijst) {
    var n = 0, som = 0;
    for (var i = 0; i < lijst.length; i++) if (isFinite(lijst[i])) { som += lijst[i]; n++; }
    return n ? som / n : NaN;
  };

  // steekproefstandaardafwijking, noemer n-1
  St.sd = function (lijst) {
    var geldig = [];
    for (var i = 0; i < lijst.length; i++) if (isFinite(lijst[i])) geldig.push(lijst[i]);
    if (geldig.length < 2) return NaN;
    var gem = St.gemiddelde(geldig), kw = 0;
    for (var j = 0; j < geldig.length; j++) kw += (geldig[j] - gem) * (geldig[j] - gem);
    return Math.sqrt(kw / (geldig.length - 1));
  };

  // standaardfout van het gemiddelde
  St.sem = function (lijst) {
    var n = 0;
    for (var i = 0; i < lijst.length; i++) if (isFinite(lijst[i])) n++;
    if (n < 2) return NaN;
    return St.sd(lijst) / Math.sqrt(n);
  };

  /*
    groepeer(punten) -> [{x, n, gemiddelde, sd, sem, waarden, labels}]

    punten: [{x, y, label}]. Punten met een ontbrekende x of y vallen weg; ze
    worden niet aangevuld en niet geraden. De groepen komen op x gesorteerd
    terug, zodat een spreidingsdiagram meteen klopt.
  */
  St.groepeer = function (punten) {
    var kaart = {};
    for (var i = 0; i < punten.length; i++) {
      var p = punten[i];
      if (p === null || p === undefined) continue;
      if (typeof p.x !== 'number' || !isFinite(p.x)) continue;
      if (typeof p.y !== 'number' || !isFinite(p.y)) continue;
      var sleutel = p.x.toFixed(9);
      if (!kaart[sleutel]) kaart[sleutel] = { x: p.x, waarden: [], labels: [] };
      kaart[sleutel].waarden.push(p.y);
      kaart[sleutel].labels.push(p.label === undefined ? '' : p.label);
    }
    var uit = [];
    for (var s in kaart) {
      if (!Object.prototype.hasOwnProperty.call(kaart, s)) continue;
      var g = kaart[s];
      uit.push({
        x: g.x,
        n: g.waarden.length,
        gemiddelde: St.gemiddelde(g.waarden),
        sd: St.sd(g.waarden),
        sem: St.sem(g.waarden),
        waarden: g.waarden,
        labels: g.labels
      });
    }
    uit.sort(function (a, b) { return a.x - b.x; });
    return uit;
  };

  // stelsel oplossen, klein en met spilkeuze
  function los(A, b) {
    var n = b.length, i, j, k;
    var M = [];
    for (i = 0; i < n; i++) M.push(A[i].slice().concat([b[i]]));
    for (i = 0; i < n; i++) {
      var spil = i;
      for (k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[spil][i])) spil = k;
      if (Math.abs(M[spil][i]) < 1e-14) return null;
      var t = M[i]; M[i] = M[spil]; M[spil] = t;
      var d = M[i][i];
      for (j = i; j <= n; j++) M[i][j] /= d;
      for (k = 0; k < n; k++) {
        if (k === i) continue;
        var f = M[k][i];
        if (f === 0) continue;
        for (j = i; j <= n; j++) M[k][j] -= f * M[i][j];
      }
    }
    var x = new Array(n);
    for (i = 0; i < n; i++) x[i] = M[i][n];
    return x;
  }

  function nlGetal(x, d) {
    if (!isFinite(x)) return '?';
    return x.toFixed(d).replace('.', ',');
  }

  /*
    trend(punten, soort) -> {soort, coef, formule, r2, rmse, n, voorspel}

    soort 'lineair'     : y = a x + b
    soort 'kwadratisch' : y = a x^2 + b x + c

    De fit gaat door alle losse metingen, niet door de groepsgemiddelden. Zo
    telt een instelling met meer herhalingen ook zwaarder mee, wat bij
    kleinste kwadraten hoort.

    R2 is de verklaarde variantie, RMSE de wortel uit de gemiddelde
    kwadratische afwijking in de eenheid van y.
  */
  St.trend = function (punten, soort) {
    var graad = (soort === 'kwadratisch') ? 2 : 1;
    var xs = [], ys = [], i, j, k;
    for (i = 0; i < punten.length; i++) {
      var p = punten[i];
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') continue;
      if (!isFinite(p.x) || !isFinite(p.y)) continue;
      xs.push(p.x); ys.push(p.y);
    }
    var n = xs.length;
    if (n < graad + 2) return null;

    var verschillend = {};
    for (i = 0; i < n; i++) verschillend[xs[i].toFixed(9)] = 1;
    if (Object.keys(verschillend).length < graad + 1) return null;

    var m = graad + 1;
    var ATA = [], ATb = [];
    for (j = 0; j < m; j++) {
      var rij = [];
      for (k = 0; k < m; k++) {
        var s = 0;
        for (i = 0; i < n; i++) s += Math.pow(xs[i], j) * Math.pow(xs[i], k);
        rij.push(s);
      }
      ATA.push(rij);
      var sb = 0;
      for (i = 0; i < n; i++) sb += Math.pow(xs[i], j) * ys[i];
      ATb.push(sb);
    }
    var c = los(ATA, ATb);
    if (!c) return null;

    function voorspel(x) {
      var y = 0;
      for (var q = 0; q < m; q++) y += c[q] * Math.pow(x, q);
      return y;
    }

    var gem = St.gemiddelde(ys), ssr = 0, sst = 0;
    for (i = 0; i < n; i++) {
      var d = ys[i] - voorspel(xs[i]);
      ssr += d * d;
      sst += (ys[i] - gem) * (ys[i] - gem);
    }
    var r2 = sst > 0 ? 1 - ssr / sst : NaN;
    var rmse = Math.sqrt(ssr / n);

    var formule;
    if (graad === 1) {
      formule = 'y = ' + nlGetal(c[1], 3) + ' x ' + (c[0] >= 0 ? '+ ' : '- ') + nlGetal(Math.abs(c[0]), 2);
    } else {
      formule = 'y = ' + nlGetal(c[2], 4) + ' x^2 ' + (c[1] >= 0 ? '+ ' : '- ') + nlGetal(Math.abs(c[1]), 3) +
                ' x ' + (c[0] >= 0 ? '+ ' : '- ') + nlGetal(Math.abs(c[0]), 2);
    }

    return {
      soort: graad === 1 ? 'lineair' : 'kwadratisch',
      coef: c, n: n, r2: r2, rmse: rmse,
      formule: formule,
      voorspel: voorspel
    };
  };

  root.WR = root.WR || {};
  root.WR.statistiek = St;
})(typeof globalThis !== 'undefined' ? globalThis : this);
