#!/usr/bin/env node
'use strict';
/* DE ONDE VEM CADA ESCANTEIO
   -------------------------------------------------------------------------
   `cornersPerMatch` mede 13,3 contra alvo de 8,0 (teto 11,5) -- o maior desvio
   de design que sobrou, e presente em toda partida. Antes de mexer em
   qualquer probabilidade, e preciso saber QUAL das cinco fontes domina.

   As cinco chamadas de `_setCorner` no motor, cada uma com um evento proprio
   imediatamente antes -- e por isso da para atribuir sem ler pilha:

     :1044  bloqueio de cruzamento   `blocked` {kind:'cross'}     chance(.42)
     :1274  corte afobado            `clear_behind`               chance(.16)
     :2090  espalmada do goleiro     `save` {kind:'deflect_corner'}
     :2818  bola na linha de fundo   (sem evento; via `_ballOut`)
     :2946  soco do goleiro          `gk_punch` {corner:true}     chance(.30)

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
    const S = window.__fe = { fontes: Object.create(null), total: 0 };
    const P = window.MatchSim.prototype;
    let ultimo = null;
    const oldEmit = P._emit;
    P._emit = function (type, data) {
      try {
        if (type === 'blocked' && data && data.kind === 'cross') ultimo = { f: 'bloqueio_de_cruzamento', t: this.t };
        else if (type === 'clear_behind') ultimo = { f: 'corte_afobado', t: this.t };
        else if (type === 'save' && data && data.kind === 'deflect_corner') ultimo = { f: 'espalmada_do_goleiro', t: this.t };
        else if (type === 'gk_punch' && data && data.corner) ultimo = { f: 'soco_do_goleiro', t: this.t };
      } catch (_) { }
      return oldEmit.apply(this, arguments);
    };
    const oldCorner = P._setCorner;
    P._setCorner = function () {
      try {
        S.total++;
        const perto = ultimo && Math.abs(Number(this.t) - Number(ultimo.t)) < 0.001;
        const f = perto ? ultimo.f : 'bola_na_linha_de_fundo';
        S.fontes[f] = (S.fontes[f] || 0) + 1;
        ultimo = null;
      } catch (_) { }
      return oldCorner.apply(this, arguments);
    };
  });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(Number(argv.segundos || 480) * 1000);
  const r = await pg.evaluate(() => ({ s: window.__fe, m: window.GAME._sim().minute }));
  await nav.close();

  const porPartida = r.m > 0 ? 90 / r.m : 1;
  console.log('\n=== FONTE DE CADA ESCANTEIO ===  minuto', r.m.toFixed(1), '\n');
  console.log('  total', r.s.total, ' -> ', (r.s.total * porPartida).toFixed(1), 'por partida (alvo 8,0 · teto 11,5)\n');
  const ks = Object.keys(r.s.fontes).sort((a, b) => r.s.fontes[b] - r.s.fontes[a]);
  for (const k of ks) {
    const n = r.s.fontes[k];
    console.log('  ' + k.padEnd(26), String(n).padStart(4),
                (100 * n / Math.max(1, r.s.total)).toFixed(1).padStart(6) + '%',
                ' -> ' + (n * porPartida).toFixed(1).padStart(5) + ' por partida');
  }
  process.exit(0);
})();
