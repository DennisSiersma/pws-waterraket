#!/usr/bin/env node
/*
  maak_browserdata.js  -  testdata als JS-bestand, zodat de browsercontrole
  zonder netwerkverzoek bij de vluchten kan.

  Een pagina op file:// mag geen bestanden inlezen met fetch of XMLHttpRequest.
  Dat is precies de reden dat de applicatie zelf ook geen enkel verzoek doet.
  Voor de controle in de browser worden de CSV-bestanden daarom als gewoon
  script ingeladen.

  Schrijft test/browsertest/testdata.js. Dat bestand is gegenereerd en hoort
  niet in de repository; het staat in .gitignore.
*/
'use strict';

const fs = require('fs');
const path = require('path');
const gen = require('./genereer_vlucht.js');

const DATA = path.join(__dirname, 'data');
const UIT = path.join(__dirname, 'browsertest');
fs.mkdirSync(UIT, { recursive: true });

const vluchten = {};
for (const naam of fs.readdirSync(DATA)) {
  if (naam.endsWith('.csv')) vluchten[naam] = fs.readFileSync(path.join(DATA, naam), 'utf8');
}

// tien vluchten van elk 1500 metingen voor de prestatiecontrole
const prestatie = [];
for (let i = 0; i < 10; i++) {
  const r = gen.genereer({ vluchtnummer: 200 + i, apogeum: 25 + i, stuwtijd: 0.24,
                           ruis: 0.15, zaad: 200 + i, nadraai: 26, maxRegels: 1500 });
  prestatie.push({ naam: 'prestatie_' + (200 + i) + '.csv', tekst: r.tekst,
                   metingen: r.monsters.length });
}

const verwacht = JSON.parse(fs.readFileSync(path.join(DATA, 'verwacht.json'), 'utf8'));

const inhoud =
  '/* gegenereerd door test/maak_browserdata.js, niet met de hand bijwerken */\n' +
  'window.TESTVLUCHTEN = ' + JSON.stringify(vluchten) + ';\n' +
  'window.TESTPRESTATIE = ' + JSON.stringify(prestatie) + ';\n' +
  'window.TESTVERWACHT = ' + JSON.stringify(verwacht) + ';\n';

fs.writeFileSync(path.join(UIT, 'testdata.js'), inhoud);
console.log('testdata.js geschreven: ' + Object.keys(vluchten).length + ' vluchten, ' +
            prestatie.length + ' prestatievluchten van ' + prestatie[0].metingen + ' metingen, ' +
            (inhoud.length / 1024).toFixed(0) + ' kB');
