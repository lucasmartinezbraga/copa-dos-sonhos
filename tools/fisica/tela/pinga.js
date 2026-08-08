#!/usr/bin/env node
'use strict';
/* Sonda de "bola pingando": registra a altura da bola a cada passo de simulacao
   numa partida de verdade no navegador, e classifica o que o olho ve. */
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const segundos = Number(process.argv[3] || 60);
const vel = Number(process.argv[4] || 3);

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1280, height: 820 } });
  const erros = [];
  pg.on('pageerror', e => erros.push(String(e).slice(0, 200)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1800);

  await pg.evaluate(() => {
    const P = window.MatchSim.prototype;
    window.__pg = { a: [], t: 0, seg: [] };
    const oldStep = P.step;
    P.step = function (dt) {
      const r = oldStep.apply(this, arguments);
      const b = this.ball;
      window.__pg.t += (+dt || 0);
      if (b) window.__pg.a.push([
        +window.__pg.t.toFixed(4), +(+b.x || 0).toFixed(2), +(+b.y || 0).toFixed(2),
        +(+b.z || 0).toFixed(3), b.traveling ? 1 : 0, b.owner ? 1 : 0,
      ]);
      return r;
    };
    /* de onde vem cada segmento: regime, duracao, quiques */
    const oldPlan = P._planPhysicalSegment;
    P._planPhysicalSegment = function () {
      const s = oldPlan.apply(this, arguments);
      if (s && s.__os200 && !this.__planNested) {
        window.__pg.seg.push([s.kind, s.passKind, s.regime, +s.duration.toFixed(3),
          s.quiques | 0, +(+s.speed).toFixed(1)]);
      }
      return s;
    };
  });

  await pg.evaluate(v => { window.__quickMatch(40, 120); window.G.speed = v; }, vel);
  await pg.waitForTimeout(segundos * 1000);

  const d = await pg.evaluate(() => ({
    a: window.__pg.a, seg: window.__pg.seg,
    versao: window.CDS_BUILD_ID,
  }));
  await nav.close();

  const A = d.a;
  if (!A.length) { console.log('sem amostras', erros); process.exit(1); }

  const NO_CHAO = 0.02;
  const z = A.map(r => r[3]);
  const T = A.map(r => r[0]);

  /* eventos de subida: a bola sai do chao e volta */
  const picos = [];
  let dentro = false, pico = 0, t0 = 0;
  for (let i = 0; i < A.length; i++) {
    if (z[i] > NO_CHAO) {
      if (!dentro) { dentro = true; pico = 0; t0 = T[i]; }
      if (z[i] > pico) pico = z[i];
    } else if (dentro) {
      dentro = false;
      picos.push({ p: +pico.toFixed(3), d: +(T[i] - t0).toFixed(3) });
    }
  }

  const qt = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; };
  const dur = T[T.length - 1] - T[0];
  const noChao = z.filter(v => v <= NO_CHAO).length;
  const faixa = (lo, hi) => picos.filter(p => p.p > lo && p.p <= hi).length;
  const minutos = dur / 60;

  console.log(`build ${d.versao}   ${A.length} passos, ${dur.toFixed(0)} s de jogo (${minutos.toFixed(1)} min)`);
  if (erros.length) console.log('ERROS DE PAGINA:', erros.slice(0, 4));
  console.log('');
  console.log('ALTURA DA BOLA');
  console.log(`  fracao do tempo no chao   ${(noChao / A.length * 100).toFixed(1)}%`);
  console.log(`  mediana                   ${qt(z, .5).toFixed(3)} m`);
  console.log(`  p90                       ${qt(z, .9).toFixed(3)} m`);
  console.log(`  maxima                    ${Math.max(...z).toFixed(2)} m`);
  console.log('');
  console.log('SUBIDAS (bola deixa o chao e volta)');
  console.log(`  total                     ${picos.length}`);
  console.log(`  por minuto de jogo        ${(picos.length / minutos).toFixed(1)}`);
  console.log(`  pico mediano              ${qt(picos.map(p => p.p), .5).toFixed(3)} m`);
  console.log(`  duracao mediana           ${qt(picos.map(p => p.d), .5).toFixed(2)} s`);
  console.log('');
  console.log('  ate 10 cm                 ' + faixa(0, .1) + `   <- ping quase colado no chao`);
  console.log('  10 a 30 cm                ' + faixa(.1, .3));
  console.log('  30 a 60 cm                ' + faixa(.3, .6));
  console.log('  60 cm a 1,5 m             ' + faixa(.6, 1.5));
  console.log('  acima de 1,5 m            ' + faixa(1.5, 99));
  console.log('');
  const seg = d.seg;
  const porReg = {};
  for (const s of seg) { const k = s[2]; (porReg[k] = porReg[k] || { n: 0, q: 0, dur: 0 }); porReg[k].n++; porReg[k].q += s[4]; porReg[k].dur += s[3]; }
  console.log(`SEGMENTOS PLANEJADOS  (${seg.length})`);
  for (const k in porReg) {
    const v = porReg[k];
    console.log(`  ${k.padEnd(9)} n=${String(v.n).padStart(4)}  quiques/seg ${(v.q / v.n).toFixed(2)}  duracao media ${(v.dur / v.n).toFixed(2)} s`);
  }
  console.log('');
  console.log('primeiras 25 subidas:', JSON.stringify(picos.slice(0, 25)));
})().catch(e => { console.error(e); process.exit(1); });
