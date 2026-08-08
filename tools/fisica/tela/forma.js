#!/usr/bin/env node
'use strict';
/* FORMA DE EQUIPE — o que separa "22 pontos correndo" de futebol.
   Mede comprimento do bloco, largura, distancia do portador ao apoio mais
   proximo e quantos companheiros ele tem por perto. Ha referencia real
   publicada para todas: bloco 30-40 m de comprimento, 40-55 m de largura,
   apoio mais proximo tipicamente 10-15 m. */
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const segundos = Number(process.argv[3] || 60);

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1280, height: 820 } });
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1800);

  await pg.evaluate(() => {
    const P = window.MatchSim.prototype;
    window.__f = { am: [] };
    let cont = 0;
    const old = P.step;
    P.step = function () {
      const r = old.apply(this, arguments);
      if ((cont++ % 12) !== 0) return r;              // ~5 amostras por segundo
      const b = this.ball;
      if (!b || !b.owner || b.traveling || this.dead > 0) return r;
      const dono = b.owner;
      const meu = this.teams[dono.team], dele = this.teams[1 - dono.team];
      const linha = (tm) => (tm.players || []).filter(p => p && !p.red && !p.isGK);
      const A = linha(meu), B = linha(dele);
      if (A.length < 8 || B.length < 8) return r;
      const est = (L) => {
        const xs = L.map(p => p.x), ys = L.map(p => p.y);
        return { compr: Math.max(...xs) - Math.min(...xs), larg: Math.max(...ys) - Math.min(...ys) };
      };
      const dists = A.filter(p => p !== dono)
        .map(p => Math.hypot(p.x - dono.x, p.y - dono.y)).sort((x, y) => x - y);
      const eA = est(A), eB = est(B);
      window.__f.am.push([
        +eA.compr.toFixed(1), +eA.larg.toFixed(1), +eB.compr.toFixed(1), +eB.larg.toFixed(1),
        +dists[0].toFixed(1),                                     // apoio mais proximo
        dists.filter(d => d <= 20).length,                        // apoios ate 20 m
        +(B.map(p => Math.hypot(p.x - dono.x, p.y - dono.y)).sort((x, y) => x - y)[0]).toFixed(1), // marcador mais proximo
      ]);
      return r;
    };
  });

  await pg.evaluate(() => { window.__quickMatch(40, 120); window.G.speed = 6; });
  await pg.waitForTimeout(segundos * 1000);
  const d = await pg.evaluate(() => window.__f.am);
  await nav.close();

  const col = i => d.map(r => r[i]);
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  const m = a => a.reduce((x, y) => x + y, 0) / a.length;
  const linha = (nome, a, ref) =>
    console.log(`  ${nome.padEnd(34)} ${m(a).toFixed(1).padStart(6)}   p10 ${q(a, .1).toFixed(1).padStart(5)}  p90 ${q(a, .9).toFixed(1).padStart(5)}   ${ref}`);

  console.log(`${d.length} amostras com bola dominada\n`);
  console.log(`  ${'metrica'.padEnd(34)} ${'media'.padStart(6)}   ${'p10'.padStart(9)}  ${'p90'.padStart(9)}   referencia real`);
  console.log('  ' + '-'.repeat(94));
  linha('comprimento do bloco (com bola)', col(0), '30-40 m');
  linha('largura do bloco (com bola)', col(1), '40-55 m');
  linha('comprimento do bloco (sem bola)', col(2), '25-35 m');
  linha('largura do bloco (sem bola)', col(3), '30-45 m');
  linha('apoio mais proximo do portador', col(4), '8-15 m');
  linha('apoios ate 20 m', col(5), '3-5');
  linha('adversario mais proximo', col(6), '2-8 m');
})().catch(e => { console.error(e); process.exit(1); });
