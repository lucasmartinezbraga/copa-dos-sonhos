#!/usr/bin/env node
'use strict';
/* A FAMILIA DO DRIBLE — o que o motor emite contra o que a tela recebe
   =========================================================================
   Sete estados de drible (`dribble_prepare`, `body_feint`, `outside_cut`,
   `burst_touch`, `protect_turn`, `dribble_success`, `dribble_failure`) estao
   declarados, tem desenho em `body()` para varios deles, e nunca aparecem.

   Antes de fiar qualquer coisa: **o motor emite os eventos?** Esta sonda
   intercepta `_emit` e conta a familia inteira do duelo de drible, separando
   quem e `by` (autor do evento) de quem e `on` (a vitima) — porque a fiacao da
   OS-46 le SEMPRE `data.by`, e em desfecho defensivo o `by` e o DEFENSOR.

   Tambem tabula os `move` que o motor escolhe, para dizer quais das poses
   mapeadas sao inalcancaveis na pratica por causa do corte de atributo.

   Uso: node tools/fisica/tela/drible.js [build.html] [segundos]
*/
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const SEG = Number(process.argv[3] || 90);

const ARMAR = () => {
  const sim = window.__CDS_ACTIVE_SIM;
  if (!sim || window.__drb) return !!window.__drb;
  window.__drb = { ev: Object.create(null), moves: Object.create(null), min: 0 };
  const P = Object.getPrototypeOf(sim), velho = P._emit;
  const ALVO = { dribble: 1, tackle: 1, tackle_missed: 1, loose_duel: 1,
                 containment: 1, tackle_attempt: 1, pressure: 1, bad_pass: 1,
                 miscontrol_out: 1, intercept: 1 };
  P._emit = function (tipo, data) {
    try {
      if (ALVO[tipo]) {
        const S = window.__drb;
        const chave = tipo + (data && data.source ? ':' + data.source : '');
        if (!S.ev[chave]) S.ev[chave] = { n: 0, temBy: 0, temOn: 0 };
        S.ev[chave].n++;
        if (data && data.by) S.ev[chave].temBy++;
        if (data && data.on) S.ev[chave].temOn++;
        if (tipo === 'dribble' && data && data.move) {
          S.moves[data.move] = (S.moves[data.move] || 0) + 1;
        }
        S.min = Number(this.minute) || S.min;
      }
    } catch (_) {}
    return velho.apply(this, arguments);
  };
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

  const S = await pg.evaluate(() => window.__drb);
  const audit = await pg.evaluate(() => {
    const sim = window.__CDS_ACTIVE_SIM;
    return (sim && sim.getOS46Audit) ? sim.getOS46Audit() : null;
  });
  await nav.close();

  console.log('evento                          n    tem by   tem on');
  console.log('-----------------------------  ----  ------  -------');
  for (const k of Object.keys(S.ev).sort((a, b) => S.ev[b].n - S.ev[a].n)) {
    const e = S.ev[k];
    console.log(`${k.padEnd(29)}  ${String(e.n).padStart(4)}  ${String(e.temBy).padStart(6)}  ${String(e.temOn).padStart(7)}`);
  }

  const totM = Object.values(S.moves).reduce((a, b) => a + b, 0);
  console.log(`\nmove escolhido pelo motor (${totM} dribles bem-sucedidos):`);
  for (const k of Object.keys(S.moves).sort((a, b) => S.moves[b] - S.moves[a])) {
    console.log(`  ${k.padEnd(20)} ${String(S.moves[k]).padStart(4)}  ${(100 * S.moves[k] / (totM || 1)).toFixed(1)}%`);
  }

  if (audit) {
    console.log(`\nfiacao OS-46: ${audit.pedidos} pedidos de pose`);
    const fam = ['dribble_prepare', 'body_feint', 'inside_cut', 'outside_cut',
                 'turn_dribble', 'burst_touch', 'protect_turn',
                 'dribble_success', 'dribble_failure'];
    for (const e of fam) {
      const n = audit.porEstado[e] || 0;
      console.log(`  ${e.padEnd(18)} ${String(n).padStart(4)}${n ? '' : '   <== nunca pedido'}`);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
