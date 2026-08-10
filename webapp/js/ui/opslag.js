/*
  opslag.js  -  de proefopzet per vlucht bewaren

  De instelvariabelen van een vlucht horen bij het vluchtnummer uit de
  commentaarregel van het logbestand. Ze worden bewaard in localStorage van de
  browser, dus ze staan er de volgende keer nog, ook zonder internet. Lukt dat
  niet, bijvoorbeeld in een privevenster, dan blijft de applicatie werken en
  komt er een zichtbare waarschuwing.
*/
(function (root) {
  'use strict';

  var O = {};
  var VOORVOEGSEL = 'waterraket.proefopzet.v1.';

  /*
    De velden van de proefopzet. Ook deze lijst stuurt de interface en de
    export aan, zodat er nergens een veld kan bestaan dat niet in het
    rapport terechtkomt.
  */
  O.VELDEN = {
    vulfractie: {
      label: 'Vulfractie', eenheid: '%', decimalen: 0, min: 0, max: 100, stap: 1,
      uitleg: 'Het deel van het flesvolume dat met water is gevuld.'
    },
    begindruk: {
      label: 'Begindruk', eenheid: 'bar', decimalen: 1, min: 0, max: 12, stap: 0.1,
      uitleg: 'De overdruk in de fles vlak voor de lancering, zoals afgelezen op de manometer.'
    },
    nozzle: {
      label: 'Nozzlediameter', eenheid: 'mm', decimalen: 1, min: 1, max: 40, stap: 0.5,
      uitleg: 'De binnendiameter van de opening waardoor het water naar buiten gaat.'
    },
    massa: {
      label: 'Massa leeg', eenheid: 'g', decimalen: 0, min: 1, max: 5000, stap: 1,
      uitleg: 'De massa van de raket zonder water, met vluchtcomputer en al.'
    },
    opmerking: {
      label: 'Opmerkingen', eenheid: '', tekst: true,
      uitleg: 'Wind, temperatuur, afwijkingen in de opstelling, alles wat de vlucht kan verklaren.'
    }
  };

  O.beschikbaar = (function () {
    try {
      var proef = VOORVOEGSEL + 'proef';
      root.localStorage.setItem(proef, '1');
      root.localStorage.removeItem(proef);
      return true;
    } catch (e) {
      return false;
    }
  })();

  var geheugen = {};                 // terugval wanneer localStorage niet mag

  /*
    De sleutel waaronder een vlucht wordt bewaard. Het vluchtnummer uit de
    commentaarregel gaat voor; staat dat er niet in, dan de bestandsnaam.
    De sleutel is zichtbaar in de interface, zodat duidelijk is waaraan een
    proefopzet vastzit.
  */
  O.sleutelVoor = function (gelezen) {
    if (gelezen && gelezen.vluchtnummer !== null && gelezen.vluchtnummer !== undefined) {
      return 'vlucht-' + gelezen.vluchtnummer;
    }
    return 'bestand-' + ((gelezen && gelezen.naam) ? gelezen.naam : 'onbekend');
  };

  O.leesProefopzet = function (sleutel) {
    var ruw = null;
    try {
      ruw = O.beschikbaar ? root.localStorage.getItem(VOORVOEGSEL + sleutel) : geheugen[sleutel];
    } catch (e) { ruw = geheugen[sleutel]; }
    if (!ruw) return null;
    try {
      var o = JSON.parse(ruw);
      return (o && typeof o === 'object') ? o : null;
    } catch (e) {
      return null;
    }
  };

  O.bewaarProefopzet = function (sleutel, waarden) {
    var schoon = {};
    for (var veld in O.VELDEN) {
      if (!Object.prototype.hasOwnProperty.call(O.VELDEN, veld)) continue;
      var def = O.VELDEN[veld];
      var x = waarden ? waarden[veld] : undefined;
      if (def.tekst) {
        schoon[veld] = (typeof x === 'string') ? x.slice(0, 500) : '';
      } else if (typeof x === 'number' && isFinite(x)) {
        if (def.min !== undefined) x = Math.max(def.min, x);
        if (def.max !== undefined) x = Math.min(def.max, x);
        schoon[veld] = x;
      } else {
        schoon[veld] = null;
      }
    }
    var tekst = JSON.stringify(schoon);
    try {
      if (O.beschikbaar) root.localStorage.setItem(VOORVOEGSEL + sleutel, tekst);
      else geheugen[sleutel] = tekst;
    } catch (e) {
      geheugen[sleutel] = tekst;
    }
    return schoon;
  };

  O.wisProefopzet = function (sleutel) {
    try {
      if (O.beschikbaar) root.localStorage.removeItem(VOORVOEGSEL + sleutel);
    } catch (e) { /* niets te doen */ }
    delete geheugen[sleutel];
  };

  O.leeg = function () {
    var o = {};
    for (var veld in O.VELDEN) {
      if (Object.prototype.hasOwnProperty.call(O.VELDEN, veld)) {
        o[veld] = O.VELDEN[veld].tekst ? '' : null;
      }
    }
    return o;
  };

  // alle bewaarde sleutels, handig om te tonen wat er nog in de browser staat
  O.alleSleutels = function () {
    var uit = [];
    try {
      if (O.beschikbaar) {
        for (var i = 0; i < root.localStorage.length; i++) {
          var s = root.localStorage.key(i);
          if (s && s.indexOf(VOORVOEGSEL) === 0) uit.push(s.slice(VOORVOEGSEL.length));
        }
      }
    } catch (e) { /* niets te doen */ }
    for (var g in geheugen) if (Object.prototype.hasOwnProperty.call(geheugen, g)) uit.push(g);
    return uit;
  };

  root.WR = root.WR || {};
  root.WR.opslag = O;
})(typeof globalThis !== 'undefined' ? globalThis : this);
