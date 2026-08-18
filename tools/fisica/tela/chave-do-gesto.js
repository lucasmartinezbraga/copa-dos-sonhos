#!/usr/bin/env node
'use strict';
/* DIAGNOSTICO DA CHAVE DE GESTO — a sonda enxerga o estado de quantos atletas?
   -------------------------------------------------------------------------
   A varredura de fluidez contou 48417 trocas de gesto numa passada e 55 em
   outra. Diferenca de 800x nao e efeito de tratamento nenhum: e a sonda que
   esta cega, ou estava alucinando. Antes de concluir qualquer coisa sobre
   permanencia de estado, esta ferramenta responde uma pergunta so:

       quantos dos 22 atletas desenhados tem estado publicado em
       `__CDS_ANIM_BY_KEY`, e as chaves batem com as que o desenhista usa?

   Compara os dois conjuntos de chaves e mostra a diferenca literal.

   Uso: node tools/fisica/tela/chave-do-gesto.js [bundle.html]
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
const alvo = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html');

(async () => {
  const nav = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const pg = await nav.newPage({ viewport: { width: 1366, height: 768 } });
  const erros = [];
  pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1200);

  await pg.evaluate(() => {
    const S = window.__ck = { desenhos: 0, achou: 0, chavesDesenho: Object.create(null),
                              amostras: [], tamanhoMapa: [] };
    const F = Object.assign({}, window.CDS_F25D);
    const orig = F.body;
    F.body = function (ctx, o) {
      const k = o && o.key;
      if (k) {
        S.desenhos++;
        S.chavesDesenho[k] = (S.chavesDesenho[k] || 0) + 1;
        const M = window.__CDS_ANIM_BY_KEY;
        if (M && M[k]) S.achou++;
        if (S.amostras.length < 6 && S.desenhos > 200) {
          S.amostras.push({ desenho: k, temEstado: !!(M && M[k]),
                            mapa: M ? Object.keys(M).slice(0, 3) : null,
                            tamanho: M ? Object.keys(M).length : -1 });
        }
        if (S.tamanhoMapa.length < 4000) S.tamanhoMapa.push(window.__CDS_ANIM_BY_KEY ? Object.keys(window.__CDS_ANIM_BY_KEY).length : -1);
      }
      return orig.apply(this, arguments);
    };
    window.CDS_F25D = F;
  });

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(20000);

  const r = await pg.evaluate(() => {
    const S = window.__ck;
    const M = window.__CDS_ANIM_BY_KEY || {};
    const kd = Object.keys(S.chavesDesenho).sort();
    const km = Object.keys(M).sort();
    const tam = S.tamanhoMapa;
    const hist = Object.create(null);
    for (const t of tam) hist[t] = (hist[t] || 0) + 1;
    return {
      desenhos: S.desenhos, achou: S.achou,
      nDesenho: kd.length, nMapa: km.length,
      soDesenho: kd.filter(k => !(k in M)).slice(0, 8),
      soMapa: km.filter(k => !(k in S.chavesDesenho)).slice(0, 8),
      amostras: S.amostras,
      histTamanho: Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 8),
      exemploMapa: km.slice(0, 4),
      exemploDesenho: kd.slice(0, 4),
    };
  });
  await nav.close();

  console.log('\n=== CHAVE DE GESTO ===');
  console.log('desenhos de corpo:', r.desenhos, '| com estado publicado:', r.achou,
              '(' + (100 * r.achou / Math.max(1, r.desenhos)).toFixed(1) + '%)');
  console.log('chaves distintas vistas no desenho:', r.nDesenho, '| no mapa agora:', r.nMapa);
  console.log('tamanho do mapa no instante do desenho (mais frequentes):');
  for (const [t, n] of r.histTamanho) console.log('   ', String(n).padStart(6), 'quadros com', t, 'atletas no mapa');
  console.log('\nexemplo de chave do DESENHO:', JSON.stringify(r.exemploDesenho));
  console.log('exemplo de chave do MAPA   :', JSON.stringify(r.exemploMapa));
  console.log('\nso no desenho (sem estado):', JSON.stringify(r.soDesenho));
  console.log('so no mapa (nunca desenhado):', JSON.stringify(r.soMapa));
  console.log('\namostras:');
  for (const a of r.amostras) console.log('   ', JSON.stringify(a));
  if (erros.length) { console.log('\nERROS:'); [...new Set(erros)].slice(0, 4).forEach(e => console.log('  ', e.slice(0, 160))); }
  process.exit(0);
})();
