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
const GATILHO = argv.gatilho ? String(argv.gatilho) : null;
const SO_NOVO = argv.sonovo === '1' || argv.sonovo === true;
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

  /* Espera o LANCE, em vez de um instante qualquer: um GIF de 30 quadros tem
     ~2 s de jogo, e cair de paraquedas quase nunca pega a falta. */
  if (GATILHO) {
    await pg.evaluate(g => {
      window.__gatilhoPronto = false;
      const P = window.MatchSim.prototype, old = P._emit;
      P._emit = function (t, d) {
        try {
          if ((g === 'falta' && (t === 'foul' || t === 'falta_cobrada')) ||
              (g === 'escanteio' && t === 'corner') ||
              (g === 'gol' && t === 'goal') ||
              (g === 'lateral' && t === 'throw_in')) window.__gatilhoPronto = true;
        } catch (_) { }
        return old.apply(this, arguments);
      };
    }, GATILHO);
    try {
      await pg.waitForFunction(() => window.__gatilhoPronto === true, null, { timeout: 180000 });
      console.log('gatilho "' + GATILHO + '" disparou; capturando');
    } catch (_) { console.log('gatilho nao veio a tempo; captura assim mesmo'); }
  }

  const b64 = await pg.evaluate(async (cfg) => {
    const cv = document.getElementById('fieldcv');
    if (!cv || !window.__cdsGif) return null;

    /* recorta o miolo do campo: o GIF fica menor e o atleta, maior na tela */
    const rw = Math.round(cv.width / cfg.recorte), rh = Math.round(cv.height / cfg.recorte);
    const ox = Math.round((cv.width - rw) / 2), oy = Math.round((cv.height - rh) / 2);

    const par = document.createElement('canvas');
    par.width = rw; par.height = cfg.soNovo ? rh : rh * 2 + 6;
    const pctx = par.getContext('2d');
    const quadros = [];

    function pinta(artic) {
      window.CDS_ARTIC = artic; window.CDS_PROP = artic;
      if (typeof window.paintField === 'function') { try { window.paintField(); } catch (_) { } }
    }
    const espera = () => new Promise(res => requestAnimationFrame(res));

    for (let i = 0; i < cfg.quadros; i++) {
      pctx.fillStyle = '#07130b'; pctx.fillRect(0, 0, par.width, par.height);
      if (cfg.soNovo) {
        pinta(true); await espera();
        pctx.drawImage(cv, ox, oy, rw, rh, 0, 0, rw, rh);
      } else {
        pinta(false); await espera();
        pctx.drawImage(cv, ox, oy, rw, rh, 0, 0, rw, rh);
        pinta(true); await espera();
        pctx.drawImage(cv, ox, oy, rw, rh, 0, rh + 6, rw, rh);
        pctx.font = "700 13px system-ui, sans-serif";
        pctx.fillStyle = '#ff9d9d'; pctx.fillText('ANTES', 10, 18);
        pctx.fillStyle = '#9dffb8'; pctx.fillText('DEPOIS', 10, rh + 24);
      }
      quadros.push(pctx.getImageData(0, 0, par.width, par.height));
      await espera();
    }
    window.CDS_ARTIC = undefined; window.CDS_PROP = undefined;

    /* Folha de contato: o GIF nao se inspeciona sem tocar, e uma grade de
       quadros deixa julgar o lance parado, quadro a quadro. */
    const COLS = 6, LIN = Math.ceil(quadros.length / COLS), ESC = 0.5;
    const fw = Math.round(par.width * ESC), fh = Math.round(par.height * ESC);
    const folha = document.createElement('canvas');
    folha.width = fw * COLS; folha.height = fh * LIN;
    const fctx = folha.getContext('2d');
    fctx.fillStyle = '#07130b'; fctx.fillRect(0, 0, folha.width, folha.height);
    const tmp = document.createElement('canvas');
    tmp.width = par.width; tmp.height = par.height;
    const tctx = tmp.getContext('2d');
    for (let i = 0; i < quadros.length; i++) {
      tctx.putImageData(quadros[i], 0, 0);
      fctx.drawImage(tmp, (i % COLS) * fw, Math.floor(i / COLS) * fh, fw, fh);
      fctx.fillStyle = 'rgba(255,255,255,.55)'; fctx.font = "600 11px system-ui, sans-serif";
      fctx.fillText('#' + (i + 1), (i % COLS) * fw + 6, Math.floor(i / COLS) * fh + 14);
    }
    const folhaUrl = folha.toDataURL('image/png');

    const bytes = window.__cdsGif(quadros, par.width, par.height, 6);
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return { gif: btoa(bin), folha: folhaUrl };
  }, { quadros: QUADROS, recorte: RECORTE, soNovo: SO_NOVO });

  await nav.close();
  if (!b64) { console.error('falhou: canvas ou codificador ausente'); process.exit(2); }
  const arq = path.join(SAIDA, 'jogo-' + NOME + '.gif');
  fs.writeFileSync(arq, Buffer.from(b64.gif, 'base64'));
  const arqF = path.join(SAIDA, 'folha-' + NOME + '.png');
  fs.writeFileSync(arqF, Buffer.from(b64.folha.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('folha escrita:', arqF);
  console.log('gif escrito:', arq, '(' + (fs.statSync(arq).size / 1024).toFixed(0) + ' KB,', QUADROS, 'quadros)');
  if (erros.length) { console.log('ERROS:'); [...new Set(erros)].slice(0, 4).forEach(e => console.log('  ', e.slice(0, 160))); }
  process.exit(0);
})();
