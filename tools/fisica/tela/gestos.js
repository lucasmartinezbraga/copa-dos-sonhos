#!/usr/bin/env node
'use strict';
/* COBERTURA DE GESTOS — quais estados de animacao chegam a ser DESENHADOS
   -------------------------------------------------------------------------
   O projeto ja mediu isto antes (§D42: "32 dos 62 estados declarados nunca
   chegaram a ser desenhados"), mas a ferramenta nao ficou no repositorio.
   Sem ela, cada rodada de fiacao de animacao vira palpite.

   Intercepta `CDS_F25D.body` — por onde todo atleta desenhado passa — e conta
   os estados que a maquina de animacao entregou ao desenho, com o tempo de
   tela de cada um. Estado declarado que nunca aparece aqui e desenho morto:
   existe no codigo, custa manutencao e o jogador nunca ve.

   Uso: node tools/fisica/tela/gestos.js [bundle.html] [--segundos=N]
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
    /* CDS_F25D e congelado: troca-se o objeto, nao o metodo */
    const F = Object.assign({}, window.CDS_F25D);
    window.__gestos = { amostras: 0, porEstado: Object.create(null), semEstado: 0 };
    const G = window.__gestos;
    const orig = F.body;
    F.body = function (ctx, o) {
      try {
        const A = window.__CDS_ANIM_BY_KEY && window.__CDS_ANIM_BY_KEY[o.key];
        G.amostras++;
        if (A && A.state) G.porEstado[A.state] = (G.porEstado[A.state] || 0) + 1;
        else G.semEstado++;
      } catch (_) { }
      return orig.apply(this, arguments);
    };
    window.CDS_F25D = F;
  });

  const nome = await pagina.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await navegador.close(); process.exit(2); }
  await pagina.waitForTimeout(SEGUNDOS * 1000);

  const r = await pagina.evaluate(() => {
    /* a lista de estados DECLARADOS sai do proprio jogo, nao de uma copia
       desatualizada aqui: qualquer estado novo entra na conta sozinho */
    let declarados = [];
    try { declarados = Object.keys(window.CDS_ANIM.STATES || {}); } catch (_) { }
    return { g: window.__gestos, declarados, minuto: window.GAME._sim().minute };
  });
  await navegador.close();

  const g = r.g;
  const vistos = Object.keys(g.porEstado).sort((a, b) => g.porEstado[b] - g.porEstado[a]);
  console.log('\n=== COBERTURA DE GESTOS ===\n');
  console.log('bundle:', alvo);
  console.log('minuto de jogo alcancado:', r.minuto.toFixed(1));
  console.log('amostras (atleta x quadro desenhado):', g.amostras, '| sem estado:', g.semEstado);
  console.log('estados vistos:', vistos.length,
              r.declarados.length ? '| declarados: ' + r.declarados.length : '');
  console.log('');
  for (const s of vistos) {
    const pc = (100 * g.porEstado[s] / g.amostras);
    console.log('  ' + s.padEnd(22), String(g.porEstado[s]).padStart(8),
                (pc < 0.01 ? '<0.01' : pc.toFixed(2)) + '%');
  }
  if (r.declarados.length) {
    const mudos = r.declarados.filter(s => !g.porEstado[s]);
    console.log('\nDECLARADOS E NUNCA DESENHADOS (' + mudos.length + '):');
    console.log('  ' + (mudos.join(', ') || '—'));
  }
  console.log('');
  if (erros.length) { console.log('ERROS DE PAGINA:'); erros.slice(0, 5).forEach(e => console.log('  ', e)); }
  process.exit(0);
})();
