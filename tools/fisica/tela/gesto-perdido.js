#!/usr/bin/env node
'use strict';
/* ONDE O GESTO SE PERDE — diagnostico do caminho pedido -> entrada -> desenho
   -------------------------------------------------------------------------
   `gestos.js` diz QUAIS estados nunca chegam ao desenho. Nao diz POR QUE, e
   sem isso a correcao vira palpite — foi assim que eu supus "atropelado pelo
   tier" para tres estados sem ter olhado.

   Sao tres pontos distintos onde um gesto morre, e cada um pede uma correcao
   diferente:

     PEDIDO    ninguem chama `request` com esse nome  -> falta fiacao
     RECUSADO  `request` chamado e devolveu false     -> tier o barrou
     ENTROU    entrou e nunca foi desenhado           -> sobrescrito antes do quadro
     DESENHADO chegou a tela

   O `Controller` e exportado por `CDS_ANIM`, entao da para instrumentar os
   tres pontos de fora, sem tocar no jogo.

   Uso: node tools/fisica/tela/gesto-perdido.js [bundle.html] [--segundos=N]
*/

const path = require('path');
const { pathToFileURL } = require('url');

function carregarPlaywright() {
  for (const cand of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(cand); } catch (_) { /* tenta o proximo */ }
  }
  console.error('playwright nao encontrado; sonda pulada');
  process.exit(0);
}

const { chromium } = carregarPlaywright();
const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const alvo = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html');
const SEGUNDOS = Number(argv.segundos || 120);

(async () => {
  const navegador = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const pagina = await navegador.newPage({ viewport: { width: 1366, height: 768 } });
  const erros = [];
  pagina.on('pageerror', e => erros.push(String(e)));
  await pagina.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pagina.waitForTimeout(1500);

  await pagina.evaluate(() => {
    const D = window.__diag = {
      pedido: Object.create(null), recusado: Object.create(null),
      entrou: Object.create(null), desenhado: Object.create(null),
      recusadoPor: Object.create(null),   // estado -> {tierDe, tierPara} amostrado
    };
    const C = window.CDS_ANIM.Controller.prototype;
    const S = window.CDS_ANIM.STATES;

    const req = C.request;
    C.request = function (state, now, opts) {
      D.pedido[state] = (D.pedido[state] || 0) + 1;
      const antes = this.state, tierAntes = this.tier, tinhaSeq = !!this.seq;
      const ok = req.apply(this, arguments);
      if (!ok) {
        D.recusado[state] = (D.recusado[state] || 0) + 1;
        if (!D.recusadoPor[state]) {
          D.recusadoPor[state] = { de: antes, tierDe: tierAntes, tierPara: (S[state] || {}).tier,
                                   comSeq: tinhaSeq, force: !!(opts && opts.force) };
        }
      }
      return ok;
    };

    const ent = C._enter;
    C._enter = function (state, dur, now) {
      const ok = ent.apply(this, arguments);
      if (ok !== false) D.entrou[state] = (D.entrou[state] || 0) + 1;
      return ok;
    };

    /* CDS_F25D e congelado: troca-se o objeto inteiro */
    const F = Object.assign({}, window.CDS_F25D);
    const orig = F.body;
    F.body = function (ctx, o) {
      try {
        const A = window.__CDS_ANIM_BY_KEY && window.__CDS_ANIM_BY_KEY[o.key];
        if (A && A.state) D.desenhado[A.state] = (D.desenhado[A.state] || 0) + 1;
      } catch (_) { }
      return orig.apply(this, arguments);
    };
    window.CDS_F25D = F;
  });

  const nome = await pagina.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await navegador.close(); process.exit(2); }
  await pagina.waitForTimeout(SEGUNDOS * 1000);

  const r = await pagina.evaluate(() => ({
    d: window.__diag,
    declarados: Object.keys(window.CDS_ANIM.STATES),
    minuto: window.GAME._sim().minute,
  }));
  await navegador.close();

  const d = r.d;
  console.log('\n=== ONDE O GESTO SE PERDE ===\n');
  console.log('bundle:', alvo, '| minuto:', r.minuto.toFixed(1));
  console.log('');
  console.log('estado'.padEnd(22), 'pedido'.padStart(8), 'recusado'.padStart(9),
              'entrou'.padStart(8), 'desenhado'.padStart(10), '  diagnostico');
  const TIER = ['LOCO', 'BALL', 'DEF', 'ACTION', 'GK'];
  for (const s of r.declarados) {
    const ped = d.pedido[s] || 0, rec = d.recusado[s] || 0;
    const ent = d.entrou[s] || 0, des = d.desenhado[s] || 0;
    if (des > 0) continue;                       // esse chegou: nao interessa aqui
    let diag;
    if (ped === 0) diag = 'MUDO: ninguem pede';
    else if (ent === 0) {
      const p = d.recusadoPor[s] || {};
      diag = 'RECUSADO no tier (de ' + (p.de || '?') + ' tier ' + (TIER[p.tierDe] || p.tierDe) +
             ' para tier ' + (TIER[p.tierPara] || p.tierPara) + (p.comSeq ? ', com seq' : '') +
             (p.force ? ', COM force' : ', sem force') + ')';
    } else diag = 'ENTROU ' + ent + 'x e nunca virou quadro: sobrescrito antes do desenho';
    console.log('  ' + s.padEnd(20), String(ped).padStart(8), String(rec).padStart(9),
                String(ent).padStart(8), String(des).padStart(10), '  ' + diag);
  }
  console.log('');
  if (erros.length) { console.log('ERROS DE PAGINA:'); erros.slice(0, 5).forEach(e => console.log('  ', e)); }
  process.exit(0);
})();
