#!/usr/bin/env node
'use strict';
/* De onde vem o pulo do passe rasteiro: altura de saida ou angulo de saida? */
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1280, height: 820 } });
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1800);

  await pg.evaluate(() => {
    const P = window.MatchSim.prototype;
    window.__r = [];
    const old = P._planPhysicalSegment;
    P._planPhysicalSegment = function (origin, target, kind, passKind, speed, meta) {
      const s = old.apply(this, arguments);
      if (s && s.regime === 'rasteira' && window.__r.length < 400) {
        let apice = 0;
        for (const a of s.samples) if (a.z > apice) apice = a.z;
        window.__r.push({
          oz: +(+s.origin.z).toFixed(3),
          elev: +(+s.elevacao).toFixed(4),
          vPedida: +(+speed || 0).toFixed(1),
          vSaida: +(+s.speed).toFixed(1),
          dist: +Math.hypot(s.target.x - s.origin.x, s.target.y - s.origin.y).toFixed(1),
          apice: +apice.toFixed(3),
          quiques: s.quiques | 0,
          dur: +(+s.duration).toFixed(2),
        });
      }
      return s;
    };
  });

  await pg.evaluate(() => { window.__quickMatch(40, 120); window.G.speed = 6; });
  await pg.waitForTimeout(35000);
  const r = await pg.evaluate(() => window.__r);
  await nav.close();

  const med = (k) => { const s = r.map(x => x[k]).sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  console.log(`${r.length} passes rasteiros`);
  console.log('  z de saida (mediana)      ' + med('oz') + ' m');
  console.log('  elevacao (mediana)        ' + med('elev') + ' rad  = ' + (med('elev') * 57.3).toFixed(1) + ' graus');
  console.log('  velocidade pedida         ' + med('vPedida') + ' m/s');
  console.log('  velocidade de saida       ' + med('vSaida') + ' m/s');
  console.log('  distancia                 ' + med('dist') + ' m');
  console.log('  APICE (mediana)           ' + med('apice') + ' m');
  console.log('  quiques por passe         ' + med('quiques'));
  console.log('');
  console.log('  z de saida = 0 em          ' + r.filter(x => x.oz <= 0.001).length + ' de ' + r.length);
  console.log('  apice > 5 cm em            ' + r.filter(x => x.apice > 0.05).length + ' de ' + r.length);
  console.log('');
  console.log('decomposicao do apice esperado (z0 + vz^2/2g):');
  for (const x of r.slice(0, 8)) {
    const vz = x.vSaida * Math.sin(x.elev);
    console.log(`   z0=${x.oz}  v=${x.vSaida}  vz=${vz.toFixed(2)}  z0+vz^2/2g=${(x.oz + vz * vz / 19.62).toFixed(3)}  medido=${x.apice}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
