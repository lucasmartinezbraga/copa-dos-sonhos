#!/usr/bin/env node
'use strict';
/* Procura DESCONTINUIDADE: a bola (e o jogador) mudando de lugar mais do que a
   propria velocidade permite. Teletransporte e a coisa que mais le como
   "quebrado" na tela, e nenhuma metrica agregada enxerga isso. */
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const segundos = Number(process.argv[3] || 60);

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1280, height: 820 } });
  const erros = [];
  pg.on('pageerror', e => erros.push(String(e).slice(0, 200)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1800);

  await pg.evaluate(() => {
    const P = window.MatchSim.prototype;
    window.__s = { a: [], t: 0 };
    const old = P.step;
    P.step = function (dt) {
      const r = old.apply(this, arguments);
      const b = this.ball;
      window.__s.t += (+dt || 0);
      if (b) window.__s.a.push([+window.__s.t.toFixed(4),
        +(+b.x || 0).toFixed(3), +(+b.y || 0).toFixed(3), +(+b.z || 0).toFixed(3),
        b.traveling ? 1 : 0, b.owner ? 1 : 0, this.dead > 0 ? 1 : 0]);
      return r;
    };
  });

  await pg.evaluate(() => { window.__quickMatch(40, 120); window.G.speed = 6; });
  await pg.waitForTimeout(segundos * 1000);
  const A = await pg.evaluate(() => window.__s.a);
  await nav.close();

  if (erros.length) console.log('ERROS DE PAGINA:', erros.slice(0, 4));

  /* Um passo dura dt. Deslocamento plausivel: a bola mais rapida do jogo anda
     ~45 m/s. Acima disso e salto de estado, nao movimento. */
  const saltosXY = [], saltosZ = [], quedas = [];
  for (let i = 1; i < A.length; i++) {
    const dt = A[i][0] - A[i - 1][0];
    if (!(dt > 0) || dt > 0.5) continue;
    const dxy = Math.hypot(A[i][1] - A[i - 1][1], A[i][2] - A[i - 1][2]);
    const dz = A[i][3] - A[i - 1][3];
    const v = dxy / dt, vz = Math.abs(dz) / dt;
    if (v > 45) saltosXY.push({ t: +A[i][0].toFixed(2), d: +dxy.toFixed(2), v: +v.toFixed(0), viaj: A[i][4], morta: A[i][6] });
    if (vz > 25) saltosZ.push({ t: +A[i][0].toFixed(2), dz: +dz.toFixed(3), vz: +vz.toFixed(0), viaj: A[i][4] });
  }
  const dt0 = (A[A.length - 1][0] - A[0][0]);
  const mins = dt0 / 60;

  console.log(`${A.length} passos, ${dt0.toFixed(0)} s de jogo (${mins.toFixed(1)} min)\n`);
  console.log('DESCONTINUIDADES DA BOLA');
  console.log(`  saltos no gramado (>45 m/s)   ${saltosXY.length}   (${(saltosXY.length / mins).toFixed(1)}/min)`);
  console.log(`  saltos de altura (>25 m/s)    ${saltosZ.length}   (${(saltosZ.length / mins).toFixed(1)}/min)`);
  console.log('');
  const distr = {};
  for (const s of saltosXY) { const k = s.d < 2 ? '<2m' : s.d < 5 ? '2-5m' : s.d < 15 ? '5-15m' : '>15m'; distr[k] = (distr[k] || 0) + 1; }
  console.log('  tamanho dos saltos no gramado:', JSON.stringify(distr));
  console.log('  com bola morta:', saltosXY.filter(s => s.morta).length, '| em viagem:', saltosXY.filter(s => s.viaj).length);
  console.log('');
  console.log('  10 maiores saltos no gramado:');
  for (const s of [...saltosXY].sort((a, b) => b.d - a.d).slice(0, 10)) console.log('   ', JSON.stringify(s));
  console.log('');
  console.log('  10 maiores saltos de altura:');
  for (const s of [...saltosZ].sort((a, b) => Math.abs(b.dz) - Math.abs(a.dz)).slice(0, 10)) console.log('   ', JSON.stringify(s));
})().catch(e => { console.error(e); process.exit(1); });
