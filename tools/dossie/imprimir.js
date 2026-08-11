#!/usr/bin/env node
'use strict';
/* Imprime reports/pdf/investigacao.html em PDF via Chromium.
   Nao ha pandoc nem weasyprint neste ambiente; o Chromium ja esta instalado
   para as sondas de tela e da controle total de quebra de pagina e numeracao. */
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const entrada = path.resolve(process.argv[2] || 'reports/pdf/investigacao.html');
const saida = path.resolve(process.argv[3] || 'reports/pdf/COPA-DOS-SONHOS-investigacao.pdf');

const rodape = `
<div style="width:100%;font-size:7pt;font-family:Georgia,serif;color:#77817d;
     padding:0 17mm;display:flex;justify-content:space-between;">
  <span>Copa dos Sonhos · investigação dos defeitos · build ff808761f5797656</span>
  <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`;

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage();
  await pg.goto(pathToFileURL(entrada).href, { waitUntil: 'load', timeout: 180000 });
  await pg.emulateMedia({ media: 'print' });
  await pg.waitForTimeout(1200);
  await pg.pdf({
    path: saida, format: 'A4', printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: rodape,
    margin: { top: '18mm', bottom: '18mm', left: '17mm', right: '17mm' },
  });
  await nav.close();
  const { statSync } = require('fs');
  console.log(`pdf: ${saida}  (${(statSync(saida).size / 1048576).toFixed(1)} MB)`);
})();
