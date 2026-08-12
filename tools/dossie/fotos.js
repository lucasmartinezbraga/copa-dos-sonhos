#!/usr/bin/env node
'use strict';
/* FOTOS — capturas reais do jogo, anotadas com o defeito que cada uma mostra.
   -------------------------------------------------------------------------
   O dossie tinha graficos e nenhuma foto do jogo rodando. Um defeito de tela
   (D24) e um de forma de equipe (D20) sao mais convincentes vistos do que
   descritos — e a bateria nao ve a tela.

   Cada captura sai com uma faixa embaixo dizendo o que olhar e qual defeito
   esta em quadro, para a imagem nao virar enfeite.

   CORRIGIDO EM 2026-08-12 — e a correcao virou a armadilha C3:
   `__quickMatch(iA, iB)` recebe INDICES DE ELENCO, nao (segundo, velocidade).
   Este arquivo passava `seg` ali. Nao quebrou porque 25, 55 e 80 tambem sao
   indices validos — entao TODAS as capturas saiam ~2 s apos o apito, e nao no
   minuto que a legenda dizia. O campo `seg` foi removido: as legendas nao
   afirmam mais um minuto que a captura nao tem.

   Uso: node tools/dossie/fotos.js [destino] [build.html] */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const DEST = path.resolve(process.argv[2] || 'reports/fotos');
const ALVO = path.resolve(process.argv[3] || 'dist/index.html');

const CENAS = [
  { arq: '01-partida-em-andamento.png', vp: [1440, 900],
    titulo: 'Uma partida em andamento',
    nota: 'O estado normal do jogo, em 1440×900. A faixa escura ACIMA e ABAIXO do gramado é o defeito D24 — medida em 28,4% da caixa do canvas nesta resolução.' },
  { arq: '02-tarja-preta-1920.png', vp: [1920, 1080],
    titulo: 'D24 · a tarja preta em 1920×1080',
    nota: 'Medido pela sonda caixa.js: 19,2% da caixa do canvas vazia. O canvas tem aspect-ratio 1024/500 com object-fit: contain, e o contêiner é mais alto que essa proporção — sobra em cima e embaixo, não nas laterais. Esta é a MELHOR das quatro resoluções testadas.' },
  { arq: '03-tarja-preta-1024.png', vp: [1024, 768],
    titulo: 'D24 · a mesma tela em 1024×768',
    nota: 'A PIOR das quatro: 42,7% da caixa vazia. Quanto mais quadrada a janela, mais o object-fit: contain sobra. O campo usa 310 px de 540 disponíveis.' },
  { arq: '04-bloco-defensivo.png', vp: [1440, 900],
    titulo: 'D20 · a forma do time sem a bola',
    nota: 'Medido com forma.js em 90 partidas, nao nesta captura: o bloco encurta 0,4 m ao perder a bola. No futebol real encurta 8 a 10 m. Com a bola a forma está correta — o time simplesmente não muda de forma quando muda de fase.' },
  { arq: '05-aglomeracao.png', vp: [1440, 900],
    titulo: 'Concentração de jogadores em torno da bola',
    nota: 'Lido pela narração (Volume IX) sobre partidas inteiras, nao nesta captura: três jogadores concentram 25% das ações identificadas. Não aparece em métrica nenhuma — passes, chutes e gols saem todos na faixa.' },
  { arq: '06-celular.png', vp: [412, 892],
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
    /* sem argumentos: __quickMatch escolhe os elencos padrao. Passar numero
       aqui seleciona OUTRO time, nao outro instante — ver o cabecalho. */
    const ok = await pg.evaluate(() => {
      if (typeof window.__quickMatch !== 'function') return false;
      window.__quickMatch();
      return true;
    });
    await pg.waitForTimeout(2500);

    /* o minuto e LIDO do sim e escrito na legenda — nao afirmado */
    const minuto = await pg.evaluate(() => {
      const s = window.GAME && window.GAME._sim && window.GAME._sim();
      return s && s.minute != null ? Math.round(s.minute * 10) / 10 : null;
    });

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
    }, { titulo: c.titulo, nota: c.nota + (minuto != null
           ? ` <em style="color:#8b9490">Captura no minuto ${minuto} de jogo.</em>` : '') });

    await pg.screenshot({ path: path.join(DEST, c.arq) });
    indice.push({ arquivo: c.arq, titulo: c.titulo, nota: c.nota,
                  viewport: c.vp.join('x'), minutoDeJogo: minuto,
                  partidaSubiu: ok, errosDePagina: erros.length });
    console.log(`  ${c.arq}  ${c.vp.join('x')}  ${ok ? 'partida ok' : 'SEM __quickMatch'}${erros.length ? '  ERROS:' + erros.length : ''}`);
    await pg.close();
  }

  await nav.close();
  fs.writeFileSync(path.join(DEST, 'indice.json'), JSON.stringify(indice, null, 1));
  console.log(`\n${indice.length} fotos em ${DEST}`);
})();
