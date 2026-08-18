#!/usr/bin/env node
'use strict';
/* GIF DO JOGO — antes e depois lado a lado, em movimento
   -------------------------------------------------------------------------
   Imagem parada julga silhueta; animacao so se julga em movimento. Como este
   ambiente nao tem ffmpeg, ImageMagick, PIL nem sharp, o GIF e codificado no
   proprio Chromium por `gif-encoder.js`.

   O par de quadros e capturado do MESMO instante de partida: para cada quadro
   o laco pinta com o desenho antigo, copia, pinta com o novo, copia, e cola os
   dois lado a lado. Assim o GIF nao compara duas partidas -- compara dois
   desenhos do mesmo lance.

   Uso: node tools/fisica/tela/gif-de-jogo.js [bundle.html]
        [--espera=N] [--quadros=N] [--recorte=1] [--nome=x]
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
const QUADROS = Number(argv.quadros || 40);
const RECORTE = Number(argv.recorte || 1);
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
  await pg.addScriptTag({ content: fs.readFileSync(path.resolve('tools/fisica/tela/gif-encoder.js'), 'utf8') });
  await pg.waitForTimeout(1000);
  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(ESPERA * 1000);

  const b64 = await pg.evaluate(async (cfg) => {
    const cv = document.getElementById('fieldcv');
    if (!cv || !window.__cdsGif) return null;

    /* recorta o miolo do campo: o GIF fica menor e o atleta, maior na tela */
    const rw = Math.round(cv.width / cfg.recorte), rh = Math.round(cv.height / cfg.recorte);
    const ox = Math.round((cv.width - rw) / 2), oy = Math.round((cv.height - rh) / 2);

    const par = document.createElement('canvas');
    par.width = rw; par.height = rh * 2 + 6;
    const pctx = par.getContext('2d');
    const quadros = [];

    function pinta(artic) {
      window.CDS_ARTIC = artic; window.CDS_PROP = artic;
      if (typeof window.paintField === 'function') { try { window.paintField(); } catch (_) { } }
    }
    const espera = () => new Promise(res => requestAnimationFrame(res));

    for (let i = 0; i < cfg.quadros; i++) {
      pinta(false); await espera();
      pctx.fillStyle = '#07130b'; pctx.fillRect(0, 0, par.width, par.height);
      pctx.drawImage(cv, ox, oy, rw, rh, 0, 0, rw, rh);
      pinta(true); await espera();
      pctx.drawImage(cv, ox, oy, rw, rh, 0, rh + 6, rw, rh);
      pctx.font = "700 13px system-ui, sans-serif";
      pctx.fillStyle = '#ff9d9d'; pctx.fillText('ANTES', 10, 18);
      pctx.fillStyle = '#9dffb8'; pctx.fillText('DEPOIS', 10, rh + 24);
      quadros.push(pctx.getImageData(0, 0, par.width, par.height));
      await espera();
    }
    window.CDS_ARTIC = undefined; window.CDS_PROP = undefined;

    const bytes = window.__cdsGif(quadros, par.width, par.height, 6);
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return btoa(bin);
  }, { quadros: QUADROS, recorte: RECORTE });

  await nav.close();
  if (!b64) { console.error('falhou: canvas ou codificador ausente'); process.exit(2); }
  const arq = path.join(SAIDA, 'jogo-' + NOME + '.gif');
  fs.writeFileSync(arq, Buffer.from(b64, 'base64'));
  console.log('gif escrito:', arq, '(' + (fs.statSync(arq).size / 1024).toFixed(0) + ' KB,', QUADROS, 'quadros)');
  if (erros.length) { console.log('ERROS:'); [...new Set(erros)].slice(0, 4).forEach(e => console.log('  ', e.slice(0, 160))); }
  process.exit(0);
})();
