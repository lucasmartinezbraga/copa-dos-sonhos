#!/usr/bin/env node
'use strict';
/* O SOLAVANCO DA POSE — controle e tratamento na MESMA partida
   -------------------------------------------------------------------------
   Relato do dono: "o problema principal e a qualidade das animacoes" — o pulo,
   o desarme, a falta, a bola. Varias animacoes, a mesma sensacao.

   A hipotese da OS-235 e que nao sao varias: ate ela, o desenho lia `POSE[st]`
   direto, entao TODA troca de gesto trocava os seis parametros da silhueta no
   mesmo quadro. Esta sonda mede exatamente essa grandeza: o salto da silhueta
   desenhada de um quadro para o outro, somado nos seis parametros.

   O truque que faz a medicao valer: `CDS_MIX_T` liga e desliga a mistura em
   tempo de execucao. Com 0 o desenho volta a ser EXATAMENTE o de antes, entao
   controle e tratamento saem da MESMA partida, com os mesmos lances -- e nao
   de dois builds com partidas diferentes, que foi o erro que ja custou uma
   rodada nesta sessao.

   Uso: node tools/fisica/tela/solavanco-da-pose.js [bundle.html] [--janela=N]
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
const JANELA = Number(argv.janela || 150);

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

  const temMix = await pg.evaluate(() => !!window.CDS_ANIM_MIX);
  if (!temMix) { console.error('CDS_ANIM_MIX ausente: a camada de mistura nao carregou'); await nav.close(); process.exit(2); }

  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(8000);

  async function medir(t, rotulo) {
    await pg.evaluate(v => { window.CDS_MIX_T = v; window.CDS_ANIM_MIX.zerar(); }, t);
    await pg.waitForTimeout(JANELA * 1000);
    const a = await pg.evaluate(() => Object.assign({}, window.CDS_ANIM_MIX.auditoria));
    const medio = a.quadros ? a.soma / a.quadros : 0;
    return { rotulo, t, medio, pico: a.pico, quadros: a.quadros, trocas: a.trocas };
  }

  /* alternado, e nao um depois do outro, para que uma fase da partida com mais
     gesto que a outra nao seja confundida com efeito */
  const r = [];
  r.push(await medir(0, 'sem mistura (como era)'));
  r.push(await medir(0.11, 'com mistura 0,11 s'));
  r.push(await medir(0, 'sem mistura (2a vez)'));
  r.push(await medir(0.11, 'com mistura (2a vez)'));
  await pg.evaluate(() => { window.CDS_MIX_T = undefined; });
  await nav.close();

  console.log('\n=== SOLAVANCO DA SILHUETA DESENHADA ===\n');
  console.log('  janela de', JANELA, 's cada, alternando na mesma partida\n');
  console.log('  fase                        salto medio   pico    quadros   trocas');
  for (const x of r) {
    console.log('  ' + x.rotulo.padEnd(26),
      x.medio.toFixed(4).padStart(10),
      x.pico.toFixed(2).padStart(7),
      String(x.quadros).padStart(9), String(x.trocas).padStart(8));
  }
  const sem = r.filter(x => x.t === 0), com = r.filter(x => x.t > 0);
  const m = a => a.reduce((p, q) => p + q.medio, 0) / a.length;
  const pk = a => Math.max(...a.map(q => q.pico));
  console.log('\n  MEDIA  sem mistura', m(sem).toFixed(4), '| com mistura', m(com).toFixed(4),
              ' -> queda de', (100 * (1 - m(com) / (m(sem) || 1))).toFixed(1) + '%');
  console.log('  PICO   sem mistura', pk(sem).toFixed(2), '| com mistura', pk(com).toFixed(2));
  console.log('');
  if (erros.length) { console.log('ERROS DE PAGINA:'); [...new Set(erros)].slice(0, 5).forEach(e => console.log('  ', e.slice(0, 160))); }
  else console.log('nenhum erro de pagina.');
  process.exit(0);
})();
