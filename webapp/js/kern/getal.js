/*
  getal.js  -  getalweergave

  Weergave: decimale komma (Nederlandse conventie).
  Export  : decimale punt, zodat rekenbladen en Python de bestanden lezen.
  Beide vormen staan hier bij elkaar, zodat er nergens anders in de applicatie
  met toFixed en punten wordt gerommeld.
*/
(function (root) {
  'use strict';

  var G = {};

  // ---- weergave -----------------------------------------------------------

  // 12.345 -> "12,35" ; niet-getallen -> een streepje, nooit een leeg vakje
  G.nl = function (x, decimalen) {
    if (x === null || x === undefined || typeof x !== 'number' || !isFinite(x)) return '-';
    var d = (decimalen === undefined) ? 2 : decimalen;
    return x.toFixed(d).replace('.', ',');
  };

  G.metEenheid = function (x, decimalen, eenheid) {
    var s = G.nl(x, decimalen);
    if (s === '-') return '-';
    return eenheid ? s + ' ' + eenheid : s;
  };

  // Aantal decimalen dat bij een onzekerheid past: de onzekerheid krijgt een
  // significant cijfer, twee als het eerste cijfer een 1 is (BIPM-gewoonte).
  G.decimalenBijOnzekerheid = function (u) {
    if (!isFinite(u) || u <= 0) return 2;
    var orde = Math.floor(Math.log(u) / Math.LN10);
    var eerste = Math.floor(u / Math.pow(10, orde));
    var sig = (eerste === 1) ? 2 : 1;
    return Math.max(0, Math.min(6, sig - 1 - orde));
  };

  // "29,91 +/- 0,11 m"
  G.metOnzekerheid = function (x, u, eenheid, minDecimalen) {
    if (x === null || x === undefined || !isFinite(x)) return '-';
    if (u === null || u === undefined || !isFinite(u) || u <= 0) {
      return G.metEenheid(x, minDecimalen === undefined ? 2 : minDecimalen, eenheid);
    }
    var d = G.decimalenBijOnzekerheid(u);
    if (minDecimalen !== undefined) d = Math.max(d, minDecimalen);
    var s = G.nl(x, d) + ' ± ' + G.nl(u, d);
    return eenheid ? s + ' ' + eenheid : s;
  };

  // ---- export -------------------------------------------------------------

  // decimale punt, geen duizendtalscheiding, lege waarde blijft leeg
  G.punt = function (x, decimalen) {
    if (x === null || x === undefined || typeof x !== 'number' || !isFinite(x)) return '';
    return decimalen === undefined ? String(x) : x.toFixed(decimalen);
  };

  // ---- invoer -------------------------------------------------------------

  // accepteert zowel "0,45" als "0.45"; lege invoer geeft null
  G.lees = function (tekst) {
    if (tekst === null || tekst === undefined) return null;
    var s = String(tekst).trim();
    if (s === '') return null;
    var x = parseFloat(s.replace(',', '.'));
    return isFinite(x) ? x : null;
  };

  root.WR = root.WR || {};
  root.WR.getal = G;
})(typeof globalThis !== 'undefined' ? globalThis : this);
