#!/usr/bin/env node
'use strict';
/* O GOLEIRO — 13 estados declarados, e o piso dele e uma CONSTANTE
   =========================================================================
   `Controller.update` resolve o goleiro com `ctx.isGK ? 'gk_ready'` — sempre,
   em qualquer velocidade, com ou sem bola. Ele esta em cena 100% do tempo e
   tem um estado so, a nao ser nos instantes de defesa.

   Esta sonda mede os dois lados antes de mexer:

   [1] EVENTOS: quais eventos de goleiro o motor emite, e com que frequencia.
       Sem isso nao da para saber se `gk_punch` nunca aparece porque nao esta
       fiado ou porque o motor nunca soca.

   [2] CINEMATICA: quanto o goleiro anda, a que velocidade, quanto tempo passa
       com a bola na mao, e quanto tempo a bola fica na area dele. Sao esses
       numeros que dizem se `gk_shift`, `gk_set`, `gk_throw` e `gk_kick` teriam
       o que desenhar.

   Uso: node tools/fisica/tela/goleiro.js [build.html] [segundos]
*/
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const SEG = Number(process.argv[3] || 90);

const ARMAR = () => {
  const sim = window.__CDS_ACTIVE_SIM;
  if (!sim || window.__gk) return !!window.__gk;
  window.__gk = { ev: Object.create(null), amostras: 0, comBola: 0,
                  vel: [], distLinha: [], bolaNaArea: 0, parado: 0 };
  const P = Object.getPrototypeOf(sim), velho = P._emit;
  P._emit = function (tipo, data) {
    try {
      if (data && (data.gk || /^gk_|^save$|^pen_/.test(tipo))) {
        const k = tipo + (data && data.kind ? ':' + data.kind : '');
        window.__gk.ev[k] = (window.__gk.ev[k] || 0) + 1;
      }
    } catch (_) {}
    return velho.apply(this, arguments);
  };
  /* amostragem de cinematica por quadro desenhado */
  const passo = () => {
    try {
      const s = window.__CDS_ACTIVE_SIM, S = window.__gk;
      if (s && s.teams) {
        const b = s.ball || {};
        for (const tm of s.teams) for (const p of tm.players) {
          if (!p || !p.isGK || p.red) continue;
          S.amostras++;
          const v = Math.hypot(+p.vx || 0, +p.vy || 0);
          S.vel.push(v);
          if (v < 0.3) S.parado++;
          if (b.owner === p) S.comBola++;
          const gx = (tm.goal && tm.goal.x) != null ? +tm.goal.x : (+p.x < 52 ? 0 : 105);
          S.distLinha.push(Math.abs((+p.x) - gx));
          const db = Math.hypot((+b.x || 0) - (+p.x), (+b.y || 0) - (+p.y));
          if (db < 18) S.bolaNaArea++;
        }
      }
    } catch (_) {}
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
  return true;
};

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on('pageerror', e => console.error('ERRO NA PAGINA:', String(e).slice(0, 200)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => { window.__quickMatch(40, 120); window.G.speed = 6; });
  await pg.waitForTimeout(1200);
  if (!await pg.evaluate(ARMAR)) { console.error('nao consegui armar'); process.exit(1); }

  process.stdout.write(`amostrando ${SEG}s a 6X`);
  for (let i = 0; i < SEG / 5; i++) { await pg.waitForTimeout(5000); process.stdout.write('.'); }
  console.log('\n');

  const S = await pg.evaluate(() => {
    const g = window.__gk;
    const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length * p)] || 0; };
    return { ev: g.ev, amostras: g.amostras, comBola: g.comBola, parado: g.parado,
             bolaNaArea: g.bolaNaArea,
             vMed: q(g.vel, .5), v90: q(g.vel, .9), v99: q(g.vel, .99),
             dMed: q(g.distLinha, .5), d90: q(g.distLinha, .9) };
  });
  const audit = await pg.evaluate(() => {
    const s = window.__CDS_ACTIVE_SIM;
    return (s && s.getOS46Audit) ? s.getOS46Audit() : null;
  });
  await nav.close();

  console.log('eventos de goleiro emitidos pelo motor:');
  const ks = Object.keys(S.ev).sort((a, b) => S.ev[b] - S.ev[a]);
  if (!ks.length) console.log('  (nenhum)');
  for (const k of ks) console.log(`  ${k.padEnd(28)} ${String(S.ev[k]).padStart(4)}`);

  const pc = n => `${(100 * n / (S.amostras || 1)).toFixed(1)}%`;
  console.log(`\ncinematica (${S.amostras} amostras de goleiro):`);
  console.log(`  parado (v < 0,3 m/s)      ${pc(S.parado)}`);
  console.log(`  com a bola na mao         ${pc(S.comBola)}`);
  console.log(`  bola a menos de 18 m      ${pc(S.bolaNaArea)}`);
  console.log(`  velocidade  mediana ${S.vMed.toFixed(2)}  p90 ${S.v90.toFixed(2)}  p99 ${S.v99.toFixed(2)} m/s`);
  console.log(`  distancia a propria linha  mediana ${S.dMed.toFixed(2)} m  p90 ${S.d90.toFixed(2)} m`);

  if (audit) {
    console.log('\nposes de goleiro pedidas pela fiacao OS-46:');
    for (const e of ['gk_ready','gk_shift','gk_set','gk_low_dive','gk_high_dive',
                     'gk_catch','gk_parry','gk_punch','gk_foot_save','gk_smother',
                     'gk_ground_recover','gk_throw','gk_kick']) {
      const n = audit.porEstado[e] || 0;
      console.log(`  ${e.padEnd(20)} ${String(n).padStart(4)}${n ? '' : '   <== nunca pedido'}`);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
