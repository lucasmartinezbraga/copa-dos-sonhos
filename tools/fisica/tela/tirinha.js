#!/usr/bin/env node
'use strict';
/* TIRINHA — quadros consecutivos de UM jogador correndo, lado a lado
   =========================================================================
   Uma foto nao mostra cadencia. Esta sonda escolhe um jogador que esta de
   fato correndo, recorta a volta dele em N quadros CONSECUTIVOS de desenho e
   cola os recortes numa tira unica, ampliada. Duas tiras (antes e depois)
   dizem em uma olhada o que a tabela diz em numero: a perna abre e fecha uma
   vez por passo, ou treme.

   O recorte usa `__CDS_SCREEN` (que o renderizador publica no OS-64) e a
   matriz do ctx, entao acompanha a camera de TV sem reconstruir projecao.

   Uso: node tools/fisica/tela/tirinha.js [build.html] [saida.png] [vel] [n]
*/
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const alvo = path.resolve(process.argv[2] || 'dist/index.html');
const saida = path.resolve(process.argv[3] || '/tmp/tirinha.png');
const VEL = Number(process.argv[4] || 3);
const N = Number(process.argv[5] || 10);
const ZOOM = 6;

(async () => {
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1400, height: 900 } });
  pg.on('pageerror', e => console.error('ERRO NA PAGINA:', String(e).slice(0, 200)));
  await pg.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForTimeout(1800);
  await pg.evaluate(v => { window.__quickMatch(40, 120); window.G.speed = v; }, VEL);
  await pg.waitForTimeout(2500);
  /* tenta ate aparecer alguem na faixa; sem isto a tira depende de sorte */
  let ok = null;

  const TIRAR = ({ n, zoom }) => new Promise(res => {
    const sim = window.__CDS_ACTIVE_SIM;
    const jogo = [...document.querySelectorAll('canvas')]
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!jogo || !window.__CDS_SCREEN) return res(null);

    /* escolhe quem esta correndo de verdade, com folga para nao sair do quadro */
    /* sem a bola: no dono, a bola desenhada e a placa de nome tapam as pernas,
       que sao justamente o que a tira precisa mostrar */
    /* FAIXA DE VELOCIDADE, nao "o mais rapido": duas tiras so se comparam se os
       dois atletas correrem parecido. A primeira versao pegou 7,02 m/s de um
       lado e 3,28 do outro, o que nao prova nada sobre a cadencia. */
    const VMIN = window.__tiraVMin || 5.5, VMAX = window.__tiraVMax || 7.5;
    let alvo = null, melhor = 0;
    for (const tm of sim.teams) for (const p of tm.players) {
      if (!p || p.red || p.isGK || p.hasBall) continue;
      const v = Math.hypot(+p.vx || 0, +p.vy || 0);
      if (v < VMIN || v > VMAX) continue;
      /* longe da bola: perto dela o desenho da bola tapa a perna do vizinho,
         nao so a do dono — o filtro `hasBall` sozinho nao bastou */
      const bb = sim.ball || {};
      if (Math.hypot((+p.x) - (+bb.x || 0), (+p.y) - (+bb.y || 0)) < 7) continue;
      if (v > melhor && +p.x > 12 && +p.x < 93 && +p.y > 8 && +p.y < 60) { melhor = v; alvo = p; }
    }
    if (!alvo) return res(null);
    const chave = (alvo.ref && alvo.ref.n) || alvo.n || ('#' + (alvo.num || 0));

    const S = window.__CDS_SCREEN.p[chave];
    if (!S) return res(null);
    const m = window.__CDS_SCREEN.m;
    /* o atleta e desenhado CENTRADO em groundY, com os pes em +0,98r: o recorte
       precisa de mais chao que ceu, senao a tira mostra ombro e corta a perna */
    const lado = Math.round(Math.max(24, S.r * m[0] * 2.35));

    const tira = document.createElement('canvas');
    tira.width = lado * n * zoom; tira.height = lado * zoom;
    tira.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#0b1220';
    document.body.appendChild(tira);
    const tc = tira.getContext('2d');
    tc.imageSmoothingEnabled = false;

    let k = 0;
    const passo = () => {
      const s = window.__CDS_SCREEN.p[chave], mm = window.__CDS_SCREEN.m;
      if (s) {
        const cx = mm[0] * s.x + mm[2] * s.y + mm[4];
        const cy = mm[1] * s.x + mm[3] * s.y + mm[5];
        tc.drawImage(jogo, Math.round(cx - lado / 2), Math.round(cy - lado * .40), lado, lado,
                     k * lado * zoom, 0, lado * zoom, lado * zoom);
        tc.strokeStyle = 'rgba(255,255,255,.18)'; tc.lineWidth = 1;
        tc.strokeRect(k * lado * zoom + .5, .5, lado * zoom - 1, lado * zoom - 1);
      }
      if (++k < n) requestAnimationFrame(passo);
      else res({ chave, vel: +melhor.toFixed(2), lado, largura: tira.width });
    };
    requestAnimationFrame(passo);
  });

  for (let tent = 0; tent < 40 && !ok; tent++) {
    ok = await pg.evaluate(TIRAR, { n: N, zoom: ZOOM });
    if (!ok) await pg.waitForTimeout(400);
  }
  if (!ok) { console.error('ninguem na faixa de velocidade pedida'); await nav.close(); process.exit(1); }
  const el = await pg.$('canvas[style*="99999"]');
  await el.screenshot({ path: saida });
  console.log(`${N} quadros de ${ok.chave} a ${ok.vel} m/s, ${VEL}X  ->  ${saida}`);
  await nav.close();
})().catch(e => { console.error(e); process.exit(1); });
