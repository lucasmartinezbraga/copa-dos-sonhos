#!/usr/bin/env node
'use strict';
/* PRINT DO JOGO DE VERDADE — o mesmo quadro, desenho antigo e novo
   -------------------------------------------------------------------------
   As tiras de comparacao desenham o atleta isolado, o que e otimo para julgar
   a silhueta e pessimo para julgar o JOGO: no gramado ele aparece a 13 px de
   raio, no meio de 21 outros, com camera, sombra e bola competindo pela
   atencao.

   Esta ferramenta congela o laco de desenho num quadro real de partida e
   REPINTA o mesmo quadro duas vezes, alternando `CDS_ARTIC`/`CDS_PROP`. Como o
   estado do jogo nao anda entre as duas pinturas, a unica diferenca possivel
   entre as imagens e o desenho do atleta.

   Uso: node tools/fisica/tela/print-de-jogo.js [bundle.html] [--espera=N] [--zoom=2]
*/
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
function carregarPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(c); } catch (_) { }
  }
  console.error('playwright nao encontrado; ferramenta pulada'); process.exit(0);
}
const { chromium } = carregarPlaywright();
const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const alvo = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || 'dist/index.html');
const ESPERA = Number(argv.espera || 25);
const NOME = String(argv.nome || 'jogo');
const SAIDA = path.resolve('reports/imagens');

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
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
  await pg.waitForTimeout(ESPERA * 1000);

  const r = await pg.evaluate(async () => {
    const cv = document.getElementById('fieldcv');
    if (!cv) return { erro: 'canvas nao encontrado' };
    /* NAO se congela o jogo com `G.speed = 0`: a placa de nome do atleta e
       CONDICIONAL (`G.speed <= 0.61 || perto da bola`), entao congelar acende
       as 22 placas de uma vez e a imagem passa a mostrar uma tela que ninguem
       ve jogando. A primeira versao desta ferramenta caiu nisso e quase me fez
       "corrigir" uma poluicao visual que so existia na sonda.
       Em vez disso, as duas pinturas saem em quadros de rAF consecutivos: o
       jogo anda ~16 ms entre elas, o que move um atleta por menos de meio
       pixel -- irrelevante para julgar o desenho, e honesto quanto ao resto. */

    function captura() {
      const c = document.createElement('canvas');
      c.width = cv.width; c.height = cv.height;
      c.getContext('2d').drawImage(cv, 0, 0);
      return c;
    }
    /* forca UM repaint com a configuracao pedida */
    async function pintarCom(artic) {
      window.CDS_ARTIC = artic; window.CDS_PROP = artic;
      if (typeof window.paintField === 'function') { try { window.paintField(); } catch (_) { } }
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      return captura();
    }
    const a = await pintarCom(false);
    const b = await pintarCom(true);
    window.CDS_ARTIC = undefined; window.CDS_PROP = undefined;

    const out = document.createElement('canvas');
    out.width = a.width; out.height = a.height * 2 + 40;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#07130b'; ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(a, 0, 0);
    ctx.drawImage(b, 0, a.height + 8);
    ctx.font = "700 16px system-ui, sans-serif";
    ctx.fillStyle = '#ff9d9d'; ctx.fillText('ANTES', 14, 24);
    ctx.fillStyle = '#9dffb8'; ctx.fillText('DEPOIS', 14, a.height + 32);
    ctx.fillStyle = '#dfe9e2'; ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillText('quadros consecutivos da MESMA partida (~16 ms de diferenca) · muda so o desenho do atleta',
                 14, out.height - 12);
    return { url: out.toDataURL('image/png'), w: a.width, h: a.height };
  });

  await nav.close();
  if (r.erro) { console.error(r.erro); process.exit(2); }
  const arq = path.join(SAIDA, 'print-' + NOME + '.png');
  fs.writeFileSync(arq, Buffer.from(r.url.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('print escrito:', arq, '| quadro', r.w + 'x' + r.h);
  if (erros.length) { console.log('ERROS:'); [...new Set(erros)].slice(0, 4).forEach(e => console.log('  ', e.slice(0, 160))); }
  process.exit(0);
})();
