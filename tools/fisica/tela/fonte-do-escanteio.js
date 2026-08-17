#!/usr/bin/env node
'use strict';
/* DE ONDE VEM CADA ESCANTEIO — POR PILHA DE CHAMADA, NAO POR PROXIMIDADE
   -------------------------------------------------------------------------
   `cornersPerMatch` mede 13,0 contra alvo 8,0 (teto 11,5): o maior desvio de
   design que restou.

   A PRIMEIRA VERSAO DESTA SONDA ERRAVA, e o erro custou uma rodada inteira.
   Ela atribuia cada escanteio a "ultima acao emitida nos 4 s anteriores" e
   concluiu `blocked 54,5%`. Em 4 segundos de futebol acontece de tudo: aquilo
   media CORRELACAO, nao causa. Agindo sobre ela, escalei por 0,62 as oito
   constantes de escanteio da calibracao e `cornersPerMatch` foi de 13,29 para
   13,36 -- nao se moveu -- enquanto zeroZeroRate ia de 0,083 para 0,115.

   Agora a atribuicao e pela PILHA: `_setCorner` guarda o quadro de quem o
   chamou. Cada chamada no motor tem linha propria, entao o resultado e a fonte
   de verdade, sem janela de tempo nenhuma.

   Uso: node tools/fisica/tela/fonte-do-escanteio.js [bundle.html] [--segundos=N]
*/
const path = require('path');
const { pathToFileURL } = require('url');
function carregarPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(c); } catch (_) { }
  }
  console.error('playwright nao encontrado; sonda pulada'); process.exit(0);
}
const { chromium } = carregarPlaywright();
const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const alvo = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html');

(async () => {
  const nav = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const pg = await nav.newPage({ viewport: { width: 1366, height: 768 } });
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1200);

  await pg.evaluate(() => {
    const S = window.__fe = { pilhas: Object.create(null), total: 0,
                              viaBallOut: 0, direto: 0, saidaPor: Object.create(null) };
    const P = window.MatchSim.prototype;

    /* `_ballOut` e o unico caminho fisico: a bola cruzou a linha. Marca-se a
       janela dele para separar "escanteio porque a bola saiu" de "escanteio
       porque uma rotina decidiu". */
    let dentroBallOut = false, ultSaida = null;
    const oldOut = P._ballOut;
    if (typeof oldOut === 'function') {
      P._ballOut = function () {
        const b = this.ball;
        ultSaida = b ? { x: +b.x.toFixed(1), y: +b.y.toFixed(1),
                         v: +Math.hypot(b.vx || 0, b.vy || 0).toFixed(1),
                         z: +(b.z || 0).toFixed(1),
                         toque: b.lastTouch ? (b.lastTouch.isGK ? 'GK' : (b.lastTouch.pos || '?')) : '?',
                         viajando: !!b.traveling,
                         kind: (b.meta && (b.meta.outcome || b.meta.kind)) || b.passKind || '?' } : null;
        dentroBallOut = true;
        try { return oldOut.apply(this, arguments); } finally { dentroBallOut = false; }
      };
    }

    const oldCorner = P._setCorner;
    P._setCorner = function () {
      try {
        S.total++;
        /* a pilha: [0] Error, [1] este wrapper, [2] quem chamou de verdade.
           Pula quadros de wrapper de camada, que aparecem como a propria
           _setCorner reenvolvida. */
        const linhas = String(new Error().stack || '').split('\n').slice(2);
        const quadro = (linhas.find(l => !/_setCorner|<anonymous>:0/.test(l)) || linhas[0] || '?')
          .trim().replace(/^at\s+/, '').replace(/\s*\(.*?(\d+:\d+)\)\s*$/, ' @$1');
        S.pilhas[quadro] = (S.pilhas[quadro] || 0) + 1;
        if (dentroBallOut) {
          S.viaBallOut++;
          if (ultSaida) {
            const k = ultSaida.toque + ' | ' + (ultSaida.viajando ? 'em voo' : 'rolando') +
                      ' | ' + ultSaida.kind;
            S.saidaPor[k] = (S.saidaPor[k] || 0) + 1;
          }
        } else S.direto++;
      } catch (_) { }
      return oldCorner.apply(this, arguments);
    };
    /* pendingRestart do _ballOut dispara DEPOIS: reconta como fisico */
    const oldStep = P.step;
    P.step = function () {
      const pr = this.pendingRestart;
      if (pr && !pr.__fe) {
        const sim = this, orig = pr;
        const env = function () { dentroBallOut = true; try { return orig.apply(this, arguments); } finally { dentroBallOut = false; } };
        env.__fe = true; this.pendingRestart = env;
      }
      return oldStep.apply(this, arguments);
    };
  });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(Number(argv.segundos || 480) * 1000);
  const r = await pg.evaluate(() => ({ s: window.__fe, m: window.GAME._sim().minute }));
  await nav.close();

  const pp = r.m > 0 ? 90 / r.m : 1;
  console.log('\n=== FONTE DE CADA ESCANTEIO (por pilha) ===  minuto', r.m.toFixed(1), '\n');
  console.log('  total', r.s.total, '->', (r.s.total * pp).toFixed(1), 'por partida (alvo 8,0 · teto 11,5)');
  console.log('  a bola SAIU de campo:', r.s.viaBallOut, ' | rotina decidiu sem sair:', r.s.direto, '\n');
  const sec = (t, o) => {
    const ks = Object.keys(o).sort((a, b) => o[b] - o[a]);
    if (!ks.length) return;
    const tot = ks.reduce((n, q) => n + o[q], 0);
    console.log('  ' + t);
    for (const k of ks.slice(0, 12)) {
      console.log('    ' + k.slice(0, 62).padEnd(64), String(o[k]).padStart(3),
                  (100 * o[k] / tot).toFixed(1).padStart(6) + '%',
                  '->' + (o[k] * pp).toFixed(1).padStart(5) + '/partida');
    }
    console.log('');
  };
  sec('quem chamou _setCorner:', r.s.pilhas);
  sec('quando a bola saiu — ultimo toque | estado | tipo:', r.s.saidaPor);
  process.exit(0);
})();
