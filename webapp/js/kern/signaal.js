/*
  signaal.js  -  filteren, afgeleiden en kleinste-kwadratenfits

  Alles wat hier staat is gewone lineaire algebra op de meetreeks. Geen enkele
  functie vult ontbrekende metingen aan: een NaN in de invoer blijft een NaN in
  de uitvoer, zodat een gat in het log ook een gat in de grafiek blijft.
*/
(function (root) {
  'use strict';

  var S = {};

  // ---------------------------------------------------------------- algebra

  // stelsel A x = b oplossen met Gauss-Jordan en spilkeuze; null bij singulier
  function los(A, b) {
    var n = b.length, i, j, k;
    var M = [];
    for (i = 0; i < n; i++) M.push(A[i].slice().concat([b[i]]));
    for (i = 0; i < n; i++) {
      var spil = i;
      for (k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[spil][i])) spil = k;
      if (Math.abs(M[spil][i]) < 1e-14) return null;
      var tmp = M[i]; M[i] = M[spil]; M[spil] = tmp;
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

  // inverse van een kleine symmetrische matrix
  function inverteer(A) {
    var n = A.length, uit = [], i;
    for (i = 0; i < n; i++) {
      var e = new Array(n);
      for (var j = 0; j < n; j++) e[j] = (i === j) ? 1 : 0;
      var kol = los(A, e);
      if (!kol) return null;
      uit.push(kol);
    }
    // uit[i] is kolom i van de inverse; transponeren naar rijen
    var inv = [];
    for (i = 0; i < n; i++) {
      var rij = new Array(n);
      for (var m = 0; m < n; m++) rij[m] = uit[m][i];
      inv.push(rij);
    }
    return inv;
  }

  S.mediaan = function (lijst) {
    var s = [];
    for (var i = 0; i < lijst.length; i++) if (isFinite(lijst[i])) s.push(lijst[i]);
    if (!s.length) return NaN;
    s.sort(function (a, b) { return a - b; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]);
  };

  // steekproefstandaardafwijking (noemer n-1)
  S.sd = function (lijst, vanaf, tot) {
    var a = (vanaf === undefined) ? 0 : vanaf;
    var b = (tot === undefined) ? lijst.length : tot;
    var n = 0, som = 0, i;
    for (i = a; i < b; i++) if (isFinite(lijst[i])) { som += lijst[i]; n++; }
    if (n < 2) return NaN;
    var gem = som / n, kw = 0;
    for (i = a; i < b; i++) if (isFinite(lijst[i])) kw += (lijst[i] - gem) * (lijst[i] - gem);
    return Math.sqrt(kw / (n - 1));
  };

  S.gemiddelde = function (lijst, vanaf, tot) {
    var a = (vanaf === undefined) ? 0 : vanaf;
    var b = (tot === undefined) ? lijst.length : tot;
    var n = 0, som = 0;
    for (var i = a; i < b; i++) if (isFinite(lijst[i])) { som += lijst[i]; n++; }
    return n ? som / n : NaN;
  };

  // ------------------------------------------------- Savitzky-Golay filter

  /*
    Coefficienten van het Savitzky-Golay filter.

    In een venster van w = 2h+1 monsters wordt met kleinste kwadraten een
    polynoom van graad d gepast in de genormeerde positie u = z/h, z = -h..h.
    De gefilterde waarde op positie z is dan de polynoom, geevalueerd in u.
    Voor de randen wordt de polynoom van het eerste of laatste volledige
    venster op de werkelijke positie geevalueerd, zodat er geen monsters
    wegvallen en de reeks even lang blijft.

    Levert een matrix C[rij z+h][kolom i] met de gewichten, zodat
    gefilterd(z) = som_i C[z+h][i] * y[i].
  */
  S.sgMatrix = function (venster, graad) {
    var h = (venster - 1) / 2;
    var d = Math.min(graad, venster - 1);
    var i, j, k, z, u;

    // normaalvergelijkingen A^T A met u = z/h
    var ATA = [], ATrij = [];
    for (j = 0; j <= d; j++) {
      var rij = [];
      for (k = 0; k <= d; k++) {
        var som = 0;
        for (z = -h; z <= h; z++) { u = z / h; som += Math.pow(u, j) * Math.pow(u, k); }
        rij.push(som);
      }
      ATA.push(rij);
    }
    var inv = inverteer(ATA);
    if (!inv) return null;

    // M[j][i] = som_k inv[j][k] * u_i^k   (de pseudo-inverse)
    var M = [];
    for (j = 0; j <= d; j++) {
      var mr = new Float64Array(venster);
      for (i = 0; i < venster; i++) {
        u = (i - h) / h;
        var s2 = 0;
        for (k = 0; k <= d; k++) s2 += inv[j][k] * Math.pow(u, k);
        mr[i] = s2;
      }
      M.push(mr);
    }

    // C[p][i] = som_j u_p^j * M[j][i]
    var C = [];
    for (var p = 0; p < venster; p++) {
      var cr = new Float64Array(venster);
      var up = (p - h) / h;
      for (i = 0; i < venster; i++) {
        var s3 = 0;
        for (j = 0; j <= d; j++) s3 += Math.pow(up, j) * M[j][i];
        cr[i] = s3;
      }
      C.push(cr);
    }
    C.centraal = C[h];
    return C;
  };

  // gewogen fit in een venster waar monsters ontbreken
  function fitVenster(y, begin, venster, graad, positie) {
    var d = graad, i, j, k;
    var geldig = [];
    for (i = 0; i < venster; i++) if (isFinite(y[begin + i])) geldig.push(i);
    if (geldig.length < d + 1) return NaN;
    var h = (venster - 1) / 2;
    var ATA = [], ATb = [];
    for (j = 0; j <= d; j++) {
      var rij = [];
      for (k = 0; k <= d; k++) {
        var s = 0;
        for (var g = 0; g < geldig.length; g++) {
          var u = (geldig[g] - h) / h;
          s += Math.pow(u, j) * Math.pow(u, k);
        }
        rij.push(s);
      }
      ATA.push(rij);
      var sb = 0;
      for (var g2 = 0; g2 < geldig.length; g2++) {
        var u2 = (geldig[g2] - h) / h;
        sb += Math.pow(u2, j) * y[begin + geldig[g2]];
      }
      ATb.push(sb);
    }
    var c = los(ATA, ATb);
    if (!c) return NaN;
    var up = (positie - h) / h, uit = 0;
    for (j = 0; j <= d; j++) uit += c[j] * Math.pow(up, j);
    return uit;
  }

  /*
    sgFilter(y, venster, graad) -> Float64Array van dezelfde lengte

    Waar de ruwe meting ontbreekt blijft de uitvoer NaN. Ontbreken er binnen
    een venster losse monsters, dan wordt de polynoom over de overgebleven
    monsters gepast.
  */
  S.sgFilter = function (y, venster, graad) {
    var n = y.length;
    var uit = new Float64Array(n);
    if (n === 0) return uit;
    var w = Math.min(venster, n % 2 ? n : n - 1);
    if (w < 3 || w < graad + 2) {                 // te kort om te filteren
      for (var q = 0; q < n; q++) uit[q] = y[q];
      return uit;
    }
    var h = (w - 1) / 2;
    var C = S.sgMatrix(w, graad);
    if (!C) { for (var q2 = 0; q2 < n; q2++) uit[q2] = y[q2]; return uit; }

    for (var i = 0; i < n; i++) {
      if (!isFinite(y[i])) { uit[i] = NaN; continue; }
      var begin, positie;
      if (i < h) { begin = 0; positie = i; }
      else if (i > n - 1 - h) { begin = n - w; positie = i - (n - w); }
      else { begin = i - h; positie = h; }

      var compleet = true;
      for (var k = 0; k < w; k++) if (!isFinite(y[begin + k])) { compleet = false; break; }
      if (compleet) {
        var c = C[positie], som = 0;
        for (var m = 0; m < w; m++) som += c[m] * y[begin + m];
        uit[i] = som;
      } else {
        uit[i] = fitVenster(y, begin, w, graad, positie);
      }
    }
    return uit;
  };

  // het centrale gewicht van het filter: nodig om de restspreiding te corrigeren
  S.sgCentraalGewicht = function (venster, graad) {
    var C = S.sgMatrix(venster, graad);
    if (!C) return 0;
    return C.centraal[(venster - 1) / 2];
  };

  // ------------------------------------------------------------- afgeleide

  /*
    Gecentreerd verschil met halve stap m:
        v(i) = ( y(i+m) - y(i-m) ) / ( t(i+m) - t(i-m) )
    Aan de randen is er geen gecentreerd verschil; daar blijft de waarde leeg.
  */
  S.gecentreerdVerschil = function (t, y, m) {
    var n = y.length;
    var uit = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var a = i - m, b = i + m;
      if (a < 0 || b >= n) { uit[i] = NaN; continue; }
      var dt = t[b] - t[a];
      if (!(dt > 0) || !isFinite(y[a]) || !isFinite(y[b])) { uit[i] = NaN; continue; }
      uit[i] = (y[b] - y[a]) / dt;
    }
    return uit;
  };

  // ------------------------------------------------- kleinste-kwadratenfits

  /*
    Paraboolfit y = a0 + a1*(t-t0) + a2*(t-t0)^2 over de indices [i0, i1].

    Levert de top (waar de afgeleide nul is), de standaardfout van de tophoogte
    volgens de gewone kleinste-kwadratentheorie, en de hefboomfactor. Met die
    hefboomfactor kan de onzekerheid ook uit een losse ruisschatting volgen:
        u(H) = sigma_h * hefboom
  */
  S.paraboolFit = function (t, y, i0, i1) {
    var i, n = 0;
    var t0 = t[Math.floor((i0 + i1) / 2)];
    var X = [], Y = [];
    for (i = i0; i <= i1; i++) {
      if (!isFinite(y[i]) || !isFinite(t[i])) continue;
      var dt = t[i] - t0;
      X.push([1, dt, dt * dt]);
      Y.push(y[i]);
      n++;
    }
    if (n < 4) return null;

    var ATA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], ATb = [0, 0, 0];
    for (i = 0; i < n; i++) {
      for (var j = 0; j < 3; j++) {
        ATb[j] += X[i][j] * Y[i];
        for (var k = 0; k < 3; k++) ATA[j][k] += X[i][j] * X[i][k];
      }
    }
    var a = los(ATA, ATb);
    if (!a) return null;
    var inv = inverteer(ATA);
    if (!inv) return null;

    // restspreiding
    var ssr = 0, sst = 0, gem = 0;
    for (i = 0; i < n; i++) gem += Y[i];
    gem /= n;
    for (i = 0; i < n; i++) {
      var voorspeld = a[0] + a[1] * X[i][1] + a[2] * X[i][2];
      ssr += (Y[i] - voorspeld) * (Y[i] - voorspeld);
      sst += (Y[i] - gem) * (Y[i] - gem);
    }
    var s2 = (n > 3) ? ssr / (n - 3) : NaN;

    if (!(a[2] < 0)) return null;                 // geen maximum in deze fit
    var dTop = -a[1] / (2 * a[2]);
    var hTop = a[0] + a[1] * dTop + a[2] * dTop * dTop;

    var xv = [1, dTop, dTop * dTop];
    var hef2 = 0;
    for (i = 0; i < 3; i++) for (var m = 0; m < 3; m++) hef2 += xv[i] * inv[i][m] * xv[m];
    var hefboom = Math.sqrt(Math.max(hef2, 0));

    return {
      n: n,
      t_top: t0 + dTop,
      h_top: hTop,
      coef: a,
      t0: t0,
      hefboom: hefboom,                           // u(H) = sigma_h * hefboom
      residu_sd: isFinite(s2) ? Math.sqrt(s2) : NaN,
      se_top: isFinite(s2) ? Math.sqrt(s2) * hefboom : NaN,
      r2: sst > 0 ? 1 - ssr / sst : NaN,
      versnelling: 2 * a[2]                       // tweede afgeleide van de fit
    };
  };

  /*
    Rechte y = a + b*x met kleinste kwadraten over de indices [i0, i1].
    De helling b is per definitie de gemiddelde afgeleide over dat stuk.
  */
  S.lijnFit = function (x, y, i0, i1) {
    var n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, i;
    for (i = i0; i <= i1; i++) {
      if (!isFinite(x[i]) || !isFinite(y[i])) continue;
      n++; sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i];
    }
    if (n < 2) return null;
    var noemer = n * sxx - sx * sx;
    if (Math.abs(noemer) < 1e-15) return null;
    var b = (n * sxy - sx * sy) / noemer;
    var a = (sy - b * sx) / n;
    var ssr = 0, sst = 0, gem = sy / n;
    for (i = i0; i <= i1; i++) {
      if (!isFinite(x[i]) || !isFinite(y[i])) continue;
      var v = a + b * x[i];
      ssr += (y[i] - v) * (y[i] - v);
      sst += (y[i] - gem) * (y[i] - gem);
    }
    var s2 = (n > 2) ? ssr / (n - 2) : NaN;
    return {
      n: n, a: a, b: b,
      se_b: isFinite(s2) ? Math.sqrt(s2 * n / noemer) : NaN,
      residu_sd: isFinite(s2) ? Math.sqrt(s2) : NaN,
      r2: sst > 0 ? 1 - ssr / sst : NaN
    };
  };

  // lineaire interpolatie van het moment waarop y de drempel passeert
  S.kruising = function (t, y, i, drempel) {
    var y0 = y[i], y1 = y[i + 1];
    if (!isFinite(y0) || !isFinite(y1) || y1 === y0) return t[i];
    var f = (drempel - y0) / (y1 - y0);
    if (f < 0) f = 0; else if (f > 1) f = 1;
    return t[i] + f * (t[i + 1] - t[i]);
  };

  root.WR = root.WR || {};
  root.WR.signaal = S;
})(typeof globalThis !== 'undefined' ? globalThis : this);
