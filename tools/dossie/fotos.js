#!/usr/bin/env node
'use strict';
/* FOTOS — capturas reais do jogo, anotadas com o defeito que cada uma mostra.
   -------------------------------------------------------------------------
   O dossie tinha graficos e nenhuma foto do jogo rodando. Um defeito de tela
   (D24) e um de forma de equipe (D20) sao mais convincentes vistos do que
   descritos — e a bateria nao ve a tela.

   Cada captura sai com uma faixa embaixo dizendo o que olhar e qual defeito
   esta em quadro, para a imagem nao virar enfeite.

   Uso: node tools/dossie/fotos.js [destino] [build.html] */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const DEST = path.resolve(process.argv[2] || 'reports/fotos');
const ALVO = path.resolve(process.argv[3] || 'dist/index.html');

const CENAS = [
  { arq: '01-partida-em-andamento.png', vp: [1440, 900], seg: 25, vel: 3,
    titulo: 'Uma partida em andamento',
    nota: 'O estado normal do jogo, em 1440×900. A faixa escura ACIMA e ABAIXO do gramado é o defeito D24 — medida em 28,4% da caixa do canvas nesta resolução.' },
  { arq: '02-tarja-preta-1920.png', vp: [1920, 1080], seg: 18, vel: 3,
    titulo: 'D24 · a tarja preta em 1920×1080',
    nota: 'Medido pela sonda caixa.js: 19,2% da caixa do canvas vazia. O canvas tem aspect-ratio 1024/500 com object-fit: contain, e o contêiner é mais alto que essa proporção — sobra em cima e embaixo, não nas laterais. Esta é a MELHOR das quatro resoluções testadas.' },
  { arq: '03-tarja-preta-1024.png', vp: [1024, 768], seg: 18, vel: 3,
    titulo: 'D24 · a mesma tela em 1024×768',
    nota: 'A PIOR das quatro: 42,7% da caixa vazia. Quanto mais quadrada a janela, mais o object-fit: contain sobra. O campo usa 310 px de 540 disponíveis.' },
  { arq: '04-bloco-defensivo.png', vp: [1440, 900], seg: 55, vel: 3,
    titulo: 'D20 · a forma do time sem a bola',
    nota: 'Medido com forma.js: o bloco encurta 0,4 m ao perder a bola. No futebol real encurta 8 a 10 m. Com a bola a forma está correta — o time simplesmente não muda de forma quando muda de fase.' },
  { arq: '05-aglomeracao.png', vp: [1440, 900], seg: 80, vel: 3,
    titulo: 'Concentração de jogadores em torno da bola',
    nota: 'Lido pela narração (Volume IX): três jogadores concentram 25% das ações identificadas de uma partida. Não aparece em métrica nenhuma — passes, chutes e gols saem todos na faixa.' },
  { arq: '06-celular.png', vp: [412, 892], seg: 25, vel: 3,
    titulo: 'A mesma partida em tela de celular',
    nota: 'O layout responsivo troca de arranjo. Esta superfície não foi auditada por sonda nenhuma — é mancha cega declarada (seção 8.4).' },
];

(async () => {
  fs.mkdirSync(DEST, { recursive: true });
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const indice = [];

  for (const c of CENAS) {
    const pg = await nav.newPage({ viewport: { width: c.vp[0], height: c.vp[1] }, deviceScaleFactor: 2 });
    const erros = [];
    pg.on('pageerror', e => erros.push(String(e).slice(0, 160)));
    await pg.goto(pathToFileURL(ALVO).href, { waitUntil: 'load', timeout: 120000 });
    await pg.waitForTimeout(1500);

    /* sobe uma partida e avanca ate o instante pedido */
    const ok = await pg.evaluate(async ({ seg, vel }) => {
      if (typeof window.__quickMatch !== 'function') return false;
      window.__quickMatch(seg, vel * 60);
      return true;
    }, { seg: c.seg, vel: c.vel });
    await pg.waitForTimeout(2200);

    /* faixa de legenda desenhada por cima, para a foto nao virar enfeite */
    await pg.evaluate(({ titulo, nota }) => {
      const d = document.createElement('div');
      d.setAttribute('style', [
        'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:99999',
        'background:linear-gradient(transparent,rgba(8,12,10,.97) 22%)',
        'padding:26px 22px 16px', 'font-family:Georgia,serif', 'color:#e8ece9',
        'pointer-events:none',
      ].join(';'));
      d.innerHTML =
        `<div style="font-size:16px;font-weight:700;letter-spacing:-.01em;margin-bottom:5px">${titulo}</div>` +
        `<div style="font-size:12.5px;line-height:1.45;color:#b8c2be;max-width:92ch">${nota}</div>`;
      document.body.appendChild(d);
    }, { titulo: c.titulo, nota: c.nota });

    await pg.screenshot({ path: path.join(DEST, c.arq) });
    indice.push({ arquivo: c.arq, titulo: c.titulo, nota: c.nota,
                  viewport: c.vp.join('x'), segundo: c.seg,
                  partidaSubiu: ok, errosDePagina: erros.length });
    console.log(`  ${c.arq}  ${c.vp.join('x')}  ${ok ? 'partida ok' : 'SEM __quickMatch'}${erros.length ? '  ERROS:' + erros.length : ''}`);
    await pg.close();
  }

  await nav.close();
  fs.writeFileSync(path.join(DEST, 'indice.json'), JSON.stringify(indice, null, 1));
  console.log(`\n${indice.length} fotos em ${DEST}`);
})();
