#!/usr/bin/env node
'use strict';
/* A ESCALA DE ALTURA QUE A BOLA REALMENTE USA
   =========================================================================
   A fisica classifica um chute como `travessao` a 2,44 m. O desenho poe a
   barra numa altura propria. Se as duas nao forem a MESMA altura, uma defesa
   embaixo da trave parece bola por cima — e nenhuma das tres tabelas de merito
   ve isso, porque nenhuma delas desenha.

   Como medir sem reimplementar a formula (armadilha D7): o bundle **ja expoe**
   um gancho de auditoria de altura, `window.__ballProbe(z, by, topY, s)`,
   chamado de dentro de `ball()` com o `by` que o desenho vai usar. Basta ouvir.

   Com pares (z, by, s) de uma partida de verdade, a escala sai por regressao:

       px por metro = (by(z=0) - by(z)) / (z * s)

   O travessao usa a MESMA funcao desde a §D50 (uma linha acima, no mesmo
   arquivo), entao validar a escala da bola valida os dois.

   Uso: node tools/fisica/tela/travessao.js [build.html] [segundos]
*/
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const SEG = Number(process.argv[3] || 25);
const R0S = [0.72, 0.62, 0.54, 0.46];

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on('pageerror', e => console.error('ERRO NA PAGINA:', String(e).slice(0, 200)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => { window.__quickMatch(40, 120); window.G.speed = 6; });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => {
    window.__alt = [];
    window.__ballProbe = function (z, by, topY, s) {
      /* `by` ja e a altura de tela final; guardamos junto o chao do mesmo
         quadro nao esta disponivel aqui, entao guardamos z, by e s e a
         regressao usa os pares com z ~ 0 como referencia movel */
      if (window.__alt.length < 60000) window.__alt.push([+z, +by, +s]);
    };
  });

  console.log('R0     grupos   px por metro (mediana)   travessao 2,44 m');
  console.log('-----  --------   ----------------------   ----------------');
  for (const R0 of R0S) {
    await pg.evaluate(v => { window.CDS_CAM_TUNE = { R0: v }; window.__alt.length = 0; }, R0);
    await pg.waitForTimeout(SEG * 1000 / R0S.length + 4000);
    const am = await pg.evaluate(() => window.__alt.slice());
    /* `by = chao(s) - altura(z)*pxM*s`, e o chao depende SO de `s` — a
       projecao manda `y` como funcao de `s` unicamente. Entao agrupar por `s`
       fixa o chao, e dentro do grupo a inclinacao de `by` contra `z` da
       exatamente `-pxM*s`. Diferenciar quadros consecutivos, como eu tinha
       feito, nao fixa nada: entre dois quadros a bola tambem ANDA. */
    const balde = new Map();
    for (const [z, y, sc] of am) {
      if (!(sc > 0.1) || !isFinite(y) || !(z >= 0) || z > 2.5) continue;   // faixa 1:1 da meta
      const k = sc.toFixed(4);
      if (!balde.has(k)) balde.set(k, []);
      balde.get(k).push([z, y, sc]);
    }
    const px = [];
    for (const [, arr] of balde) {
      if (arr.length < 6) continue;
      const zs = arr.map(a => a[0]);
      if (Math.max.apply(null, zs) - Math.min.apply(null, zs) < 0.5) continue;
      const n = arr.length;
      let sz = 0, sy = 0, szz = 0, szy = 0;
      for (const [z, y] of arr) { sz += z; sy += y; szz += z * z; szy += z * y; }
      const den = n * szz - sz * sz;
      if (Math.abs(den) < 1e-9) continue;
      const incl = (n * szy - sz * sy) / den;      // px de `by` por metro de z
      const v = -incl / arr[0][2];                 // divide pela escala do grupo
      if (isFinite(v) && v > 2 && v < 200) px.push(v);
    }
    if (!px.length) { console.log(`${R0.toFixed(2)}   (nenhum grupo com amostra suficiente)`); continue; }
    px.sort((a, b) => a - b);
    const med = px[Math.floor(px.length / 2)];
    console.log(`${R0.toFixed(2)}   ${String(px.length).padStart(8)}   ${med.toFixed(2).padStart(22)}   ` +
                `${(med * 2.44).toFixed(1)} px`);
  }
  console.log('\nesperado: 22,0 px/m em R0=0,72, crescendo com 0,72/R0');
  console.log('  0,62 -> 25,5   0,54 -> 29,3   0,46 -> 34,4');
  console.log('antes da §D50 a barra do gol era 30 px FIXOS = 1,36 m na escala da bola.');
  await nav.close();
})().catch(e => { console.error(e); process.exit(1); });
