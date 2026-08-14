#!/usr/bin/env node
'use strict';
/* FOLHA DE POSES — os 62 estados desenhados lado a lado, com nome
   =========================================================================
   Ate agora eu media se um estado tinha silhueta PROPRIA (`gestos.js`). Isso
   diz que ele e diferente da corrida; nao diz se ele esta BOM. Para julgar
   isso e preciso ver — e esperar em campo por um estado que acontece 2x por
   partida nao e viavel.

   Esta sonda desenha cada estado fora da partida: monta um
   `__CDS_ANIM_BY_KEY` falso com o estado desejado e chama `CDS_F25D.body`
   direto num canvas de celula.

   Duas armadilhas que o desenho impoe, e como esta sonda escapa das duas:

   [1] A passada depende de HISTORICO (`d.vms`, `d.gait` vivem no `dirCache`,
       indexado por `o.key`). Chamar `body` uma vez desenha um atleta parado,
       com amplitude zero — a folha inteira sairia em posicao de sentido. Cada
       celula recebe entao 48 quadros de aquecimento com deslocamento
       constante, calibrado para ~4,5 m/s.
   [2] Se o `x` avanca, o boneco sai da celula. O `ctx` e transladado de volta
       a cada quadro, entao `body` ve um atleta correndo e a celula ve um
       atleta centrado.

   Cada estado aparece em TRES fases porque gesto com duracao nao se julga por
   um instante: `estica` e `agacha` variam com a fase.

   Uso: node tools/fisica/tela/posesheet.js [build.html] [saida.png] [filtro]
*/
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const saida = path.resolve(process.argv[3] || '/tmp/poses.png');
const filtro = process.argv[4] || '';

const FASES = [0.15, 0.50, 0.85];
const CEL = 44;
const ZOOM = 3;

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1500, height: 1000 } });
  pg.on('pageerror', e => console.error('ERRO NA PAGINA:', String(e).slice(0, 200)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(2000);

  const info = await pg.evaluate(({ FASES, CEL, ZOOM, filtro }) => {
    const F = window.CDS_F25D, A = window.CDS_ANIM;
    if (!F || !A) return null;
    /* a cadencia divide por sqrt(G.speed): em 1X a conta da folha e direta */
    try { if (window.G) window.G.speed = 1; } catch (_) {}

    let estados = Object.keys(A.STATES);
    if (filtro) { const re = new RegExp(filtro); estados = estados.filter(s => re.test(s)); }

    const ROT = 190;
    const W = ROT + CEL * FASES.length * ZOOM + 10;
    const H = 34 + estados.length * (CEL * ZOOM + 4) + 8;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#101c14'; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9fd0ae'; ctx.font = '12px monospace';
    FASES.forEach((f, i) => ctx.fillText('fase ' + f.toFixed(2), ROT + i * CEL * ZOOM + 10, 17));

    const r = 15;
    /* px logicos por metro que a §D41 usa: (fW/FL)*(r/13) */
    const pxM = (1000 / 105) * (r / 13);
    const passo = 4.5 / 60 * pxM;            // ~4,5 m/s
    const guardado = window.__CDS_ANIM_BY_KEY;

    estados.forEach((st, li) => {
      const topo = 30 + li * (CEL * ZOOM + 4);
      ctx.fillStyle = '#9fd0ae'; ctx.font = '12px monospace';
      ctx.fillText(st, 8, topo + CEL * ZOOM / 2);

      FASES.forEach((ph, ci) => {
        const cell = document.createElement('canvas');
        cell.width = CEL; cell.height = CEL;
        const c2 = cell.getContext('2d');
        const fundo = (li % 2) ? '#1d3f27' : '#193821';
        const chave = 'SHEET|' + st + '|' + ci;
        window.__CDS_ANIM_BY_KEY = {};
        window.__CDS_ANIM_BY_KEY[chave] = { state: st, phase: ph, tier: 0, loop: false };

        const gk = st.indexOf('gk_') === 0;
        for (let k = 0; k <= 48; k++) {
          c2.fillStyle = fundo; c2.fillRect(0, 0, CEL, CEL);
          const x = CEL / 2 + k * passo;
          c2.save();
          c2.translate(CEL / 2 - x, 0);      // o atleta corre; a celula nao
          F.body(c2, { x: x, y: CEL * 0.56, r: r,
                       pc: '#e63946', gkC: '#f4c430', isGK: gk,
                       divePose: false, hasBall: false, key: chave,
                       act: '', pose: '', wave: 0 });
          c2.restore();
        }
        ctx.drawImage(cell, 0, 0, CEL, CEL, ROT + ci * CEL * ZOOM, topo, CEL * ZOOM, CEL * ZOOM);
        ctx.strokeStyle = 'rgba(255,255,255,.09)';
        ctx.strokeRect(ROT + ci * CEL * ZOOM + .5, topo + .5, CEL * ZOOM - 1, CEL * ZOOM - 1);
      });
    });
    window.__CDS_ANIM_BY_KEY = guardado;
    return { estados: estados.length, W, H };
  }, { FASES, CEL, ZOOM, filtro });

  if (!info) { console.error('bundle sem CDS_F25D/CDS_ANIM'); await nav.close(); process.exit(1); }
  const el = await pg.$('canvas[style*="99999"]');
  await el.screenshot({ path: saida });
  console.log(`${info.estados} estados (${info.W}x${info.H}) -> ${saida}`);
  await nav.close();
})().catch(e => { console.error(e); process.exit(1); });
