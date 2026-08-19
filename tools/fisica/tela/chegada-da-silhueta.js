#!/usr/bin/env node
'use strict';
/* A CHEGADA DA SILHUETA — A/B do teto de mistura, na MESMA partida
   =========================================================================
   A pergunta que decide se animacao existe nao e "quantas vezes o gesto
   trocou" nem "quao suave foi a troca". E:

       a silhueta do estado chegou a ser DESENHADA, ou a proxima troca cortou
       a mistura no meio?

   `tools/fisica/tela/vida-do-gesto.js` mostrou por que isso importa: a maquina
   de animacao conta em segundos de SIMULACAO e a mistura de pose contava em
   segundos de PAREDE. No padrao de 3X (OS-202) todo gesto vale um terco e a
   mistura nao encolhe junto -- 67,3% das entradas de estado morriam antes dos
   110 ms que a mistura leva.

   A OS-260 amarrou a mistura ao estado. Esta sonda mede se adiantou, do jeito
   que a OS-246 se provou: janelas PAREADAS na MESMA partida, alternando
   `CDS_MIX_TETO` entre 1 (com teto) e 0 (comportamento de antes). Mesma
   semente, mesmos atletas, mesmo lance -- a unica diferenca e o teto.

   Duas medidas por janela:
     chegou %   fracao das trocas em que a pose completou antes da proxima
     parou em   quando cortou, em que fracao da pose o corpo ficou

   Uso: node tools/fisica/tela/chegada-da-silhueta.js [bundle.html]
          [--janela=10] [--ciclos=4] [--vel=3]
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
const JANELA = Number(argv.janela || 10);     // s por janela
const CICLOS = Number(argv.ciclos || 4);      // pares A/B
const VEL = argv.vel ? Number(argv.vel) : null;
const MIN_TROCAS = 200;                        // OS-247: sem amostra reprova

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
  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  if (VEL) await pg.evaluate(v => { try { window.G.speed = v; } catch (_) { } }, VEL);
  const vel = await pg.evaluate(() => { try { return window.G && window.G.speed; } catch (_) { return null; } });

  const temAud = await pg.evaluate(() =>
    !!(window.CDS_ANIM_MIX && window.CDS_ANIM_MIX.auditoria &&
       typeof window.CDS_ANIM_MIX.auditoria.chegou === 'number'));
  if (!temAud) {
    console.log('\n  SEM AUDITORIA de chegada em CDS_ANIM_MIX. REPROVA (OS-247: zero');
    console.log('  observacao nao e zero defeito).');
    await nav.close(); process.exit(1);
  }

  const janela = async (teto) => {
    await pg.evaluate(t => { window.CDS_MIX_TETO = t; window.CDS_ANIM_MIX.zerar(); }, teto);
    await pg.waitForTimeout(JANELA * 1000);
    return await pg.evaluate(() => {
      const A = window.CDS_ANIM_MIX.auditoria;
      return { chegou: A.chegou, cortou: A.cortou, somaK: A.somaK,
               pico: A.pico, soma: A.soma, quadros: A.quadros };
    });
  };

  const A = [], B = [];
  for (let i = 0; i < CICLOS; i++) {
    /* alterna a ordem a cada ciclo: se o jogo mudar de ritmo ao longo da
       partida, a ordem nao vira o resultado */
    if (i % 2 === 0) { B.push(await janela(0)); A.push(await janela(1)); }
    else { A.push(await janela(1)); B.push(await janela(0)); }
  }
  await nav.close();

  const junta = arr => arr.reduce((s, x) => ({
    chegou: s.chegou + x.chegou, cortou: s.cortou + x.cortou, somaK: s.somaK + x.somaK,
    pico: Math.max(s.pico, x.pico), soma: s.soma + x.soma, quadros: s.quadros + x.quadros,
  }), { chegou: 0, cortou: 0, somaK: 0, pico: 0, soma: 0, quadros: 0 });

  const a = junta(A), b = junta(B);
  const pct = o => 100 * o.chegou / Math.max(1, o.chegou + o.cortou);
  const parouEm = o => o.cortou ? 100 * o.somaK / o.cortou : 100;
  const salto = o => o.soma / Math.max(1, o.quadros);

  console.log('\n=== A CHEGADA DA SILHUETA ===  ' + CICLOS + ' pares de ' + JANELA +
              ' s | velocidade de exibicao ' + vel + 'X');
  console.log('    janelas pareadas na MESMA partida; so o teto de mistura muda\n');

  const totTrocas = a.chegou + a.cortou + b.chegou + b.cortou;
  if (totTrocas < MIN_TROCAS) {
    console.log('  SEM AMOSTRA: ' + totTrocas + ' trocas de pose. REPROVA (OS-247).');
    process.exit(1);
  }

  const linha = (rot, o) => console.log(
    '   ' + rot.padEnd(26) +
    (o.chegou + o.cortou + ' trocas').padStart(14) +
    ('  chegou ' + pct(o).toFixed(1) + '%').padStart(20) +
    ('  cortada parou em ' + parouEm(o).toFixed(0) + '%').padStart(26) +
    ('  salto medio ' + salto(o).toFixed(4)).padStart(24));
  linha('B  sem teto (antes)', b);
  linha('A  com teto (OS-260)', a);

  const d = pct(a) - pct(b);
  console.log('\n   DIFERENCA: ' + (d >= 0 ? '+' : '') + d.toFixed(1) +
              ' ponto' + (Math.abs(d) === 1 ? '' : 's') + ' percentuais de silhueta que chega.');
  /* piso de ruido: a maior diferenca entre janelas do MESMO lado */
  const disp = arr => {
    const v = arr.map(pct); return Math.max(...v) - Math.min(...v);
  };
  const ruido = Math.max(disp(A), disp(B));
  console.log('   PISO DE RUIDO entre janelas do mesmo lado: ' + ruido.toFixed(1) + ' pp');
  console.log('   ' + (Math.abs(d) > ruido
    ? 'A diferenca SUPERA o ruido.'
    : 'A diferenca NAO supera o ruido — inconclusivo, e inconclusivo nao e aprovado.'));
  if (erros.length) { console.log('\nERROS DE PAGINA:'); [...new Set(erros)].slice(0, 3).forEach(e => console.log('  ', e.slice(0, 160))); }
  process.exit(0);
})();
