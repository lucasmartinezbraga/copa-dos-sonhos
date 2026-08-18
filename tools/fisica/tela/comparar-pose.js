#!/usr/bin/env node
'use strict';
/* COMPARADOR VISUAL DA POSE — o MESMO gesto, com e sem mistura
   -------------------------------------------------------------------------
   Relato do dono: "o problema principal e a qualidade das animacoes" — o pulo,
   o desarme, a falta. Varias animacoes, a mesma sensacao.

   A OS-235 sustenta que nao sao varias: ate ela, o desenho lia `POSE[st]`
   direto, entao TODA troca de gesto trocava os seis parametros da silhueta no
   mesmo quadro.

   Esta ferramenta desenha o MESMO roteiro de estados duas vezes, chamando o
   desenhista de verdade (`CDS_F25D.body`) quadro a quadro em relogio de
   PAREDE -- que e a unidade em que a mistura acontece -- e monta as duas
   tiras uma sobre a outra. O que muda entre elas e so `CDS_MIX_T`.

   Saida: reports/imagens/pose-<gesto>.png

   Uso: node tools/fisica/tela/comparar-pose.js [bundle.html] [--gesto=standing_tackle]
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
const GESTO = String(argv.gesto || 'standing_tackle');
const SAIDA = path.resolve('reports/imagens');

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const nav = await chromium.launch({
    headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'],
  });
  const pg = await nav.newPage({ viewport: { width: 1366, height: 768 } });
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1200);
  const nome = await pg.evaluate(() => window.__quickMatch(40, 120));
  if (!/ x /.test(String(nome))) { console.error('partida nao subiu:', nome); await nav.close(); process.exit(2); }
  await pg.waitForTimeout(3000);

  const r = await pg.evaluate(async (GESTO) => {
    const N = 16, TILE_W = 120, TILE_H = 190, DT = 34;
    const A = window.CDS_ANIM;
    const temGesto = !!(A && A.STATES && A.STATES[GESTO]);
    const loco = (A && A.STATES && (A.STATES.run ? 'run' : Object.keys(A.STATES)[0])) || 'run';
    const depois = (A && A.STATES && A.STATES.recover) ? 'recover' : loco;

    /* roteiro: corre -> gesto -> recompoe. E na FRONTEIRA entre eles que o
       corte acontecia. */
    function roteiro(i) {
      if (i < 4) return { state: loco, phase: (i / 4) };
      if (i < 11) return { state: temGesto ? GESTO : loco, phase: (i - 4) / 7 };
      return { state: depois, phase: (i - 11) / 5 };
    }

    async function tira(mixT, rotulo, cor) {
      window.CDS_MIX_T = mixT;
      const cv = document.createElement('canvas');
      cv.width = TILE_W * N; cv.height = TILE_H;
      const ctx = cv.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, TILE_H);
      g.addColorStop(0, '#16321f'); g.addColorStop(1, '#0b2113');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      const chave = 'cmp:' + mixT;
      for (let i = 0; i < N; i++) {
        const q = roteiro(i);
        window.__CDS_ANIM_BY_KEY = window.__CDS_ANIM_BY_KEY || Object.create(null);
        window.__CDS_ANIM_BY_KEY[chave] = { state: q.state, phase: q.phase, tier: 3 };
        ctx.save();
        ctx.beginPath();
        ctx.rect(i * TILE_W, 0, TILE_W, TILE_H);
        ctx.clip();
        window.CDS_F25D.body(ctx, {
          x: i * TILE_W + TILE_W / 2, y: TILE_H * 0.58, r: 30,
          pc: '#3ea1ff', gkC: '#ffd166', isGK: false, divePose: null,
          hasBall: false, key: chave, act: '', pose: '', wave: 0, ballX: null
        });
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.08)';
        ctx.beginPath(); ctx.moveTo(i * TILE_W, 0); ctx.lineTo(i * TILE_W, TILE_H); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.40)'; ctx.font = "600 10px system-ui, sans-serif";
        ctx.fillText(q.state.slice(0, 15), i * TILE_W + 5, TILE_H - 7);
        ctx.restore();
        await new Promise(res => setTimeout(res, DT));
      }
      ctx.fillStyle = cor; ctx.font = "700 15px system-ui, sans-serif";
      ctx.fillText(rotulo, 8, 20);
      return cv;
    }

    const t1 = await tira(0, 'SEM MISTURA  ·  a silhueta troca de valor num quadro so', '#ff9d9d');
    const t2 = await tira(0.11, 'COM MISTURA (OS-235)  ·  a silhueta persegue a nova pose', '#9dffb8');
    window.CDS_MIX_T = undefined;

    const cv = document.createElement('canvas');
    cv.width = t1.width; cv.height = t1.height * 2 + 34;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#07130b'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(t1, 0, 0);
    ctx.drawImage(t2, 0, t1.height + 8);
    ctx.fillStyle = '#dfe9e2'; ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillText('mesmo roteiro de estados (' + GESTO + '), mesmo intervalo de 34 ms por quadro · muda so a mistura de pose',
                 10, cv.height - 10);
    return { url: cv.toDataURL('image/png'), temGesto: temGesto, loco: loco, depois: depois };
  }, GESTO);

  await nav.close();
  fs.writeFileSync(path.join(SAIDA, 'pose-' + GESTO + '.png'),
                   Buffer.from(r.url.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log('imagem escrita: reports/imagens/pose-' + GESTO + '.png',
              '| gesto existe:', r.temGesto, '| loco:', r.loco, '| depois:', r.depois);
  process.exit(0);
})();
