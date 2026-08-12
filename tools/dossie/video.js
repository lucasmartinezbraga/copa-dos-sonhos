#!/usr/bin/env node
'use strict';
/* VIDEO — a partida em movimento, que a foto nao consegue mostrar.
   ---------------------------------------------------------------
   O dossie tinha seis fotos e nenhum segundo de jogo rodando. Dois defeitos
   do catalogo sao sobre COMO O JOGO EVOLUI e por isso nao cabem num quadro:

     D19  a partida murcha — 21,4% dos gols ate 15', 12,7% depois dos 76'.
          Um quadro nao mostra decaimento; so a sequencia mostra.
     D20  o bloco nao compacta ao perder a bola (encurta 0,4 m; no futebol
          real, 8 a 10 m). O erro esta na TRANSICAO, nao na forma parada.

   Playwright grava webm nativamente por contexto. Nao ha montagem e nao ha
   dependencia externa: e a tela do jogo, do jeito que o jogador ve.

   CUIDADO, e custou uma rodada: `__quickMatch(iA,iB)` recebe INDICES DE
   ELENCO, nao (segundo, velocidade). As fotos do dossie foram capturadas
   passando segundos ali — o que so nao quebrou porque 25 e 55 tambem sao
   indices validos. Toda captura sai ~2 s apos o apito, nao no minuto que a
   legenda dizia. Aqui o minuto e LIDO do sim e escrito no indice.

   Uso: node tools/dossie/video.js [destino] [build.html] */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const DEST = path.resolve(process.argv[2] || 'reports/video');
const ALVO = path.resolve(process.argv[3] || 'dist/index.html');

const CLIPES = [
  { arq: 'jogo-rodando-turbo.webm', vp: [960, 540], vel: 'TURBO', teto: 460,
    ateOFim: true,
    titulo: 'O jogo rodando, do apito inicial, na velocidade TURBO',
    olhe: 'D19 · o ritmo ao longo dos 90 minutos. O jogo NAO cresce para o fim: '
        + '20,0% dos gols saem antes dos 15 minutos e 14,7% depois dos 76 — no futebol de '
        + 'elite e o inverso. E em quadro o tempo inteiro: a tarja preta acima e abaixo do '
        + 'gramado (D24). Confira `terminou` e `minutoDeJogoAoFim` no indice.json antes de '
        + 'citar este clipe como partida completa.' },
  { arq: 'transicao-perda-de-bola.webm', vp: [960, 540], vel: '1X', teto: 40,
    ateOFim: false,
    titulo: 'Os primeiros minutos, em velocidade 1X',
    olhe: 'D20 · acompanhe a forma do time no instante em que ele perde a bola. No '
        + 'futebol real o bloco encurta 8 a 10 m ao virar defensor. Aqui encurta 0,4 m '
        + '— medido por forma.js. O time troca de fase e nao troca de forma. Repare '
        + 'tambem na concentracao de jogadores em volta da bola.' },
];

const dorme = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(DEST, { recursive: true });
  const nav = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const indice = [];

  for (const c of CLIPES) {
    const ctx = await nav.newContext({
      viewport: { width: c.vp[0], height: c.vp[1] },
      recordVideo: { dir: DEST, size: { width: c.vp[0], height: c.vp[1] } },
    });
    const pg = await ctx.newPage();
    const gravacao = pg.video();          /* pegue o handle ANTES de fechar a pagina */
    const erros = [];
    pg.on('pageerror', e => erros.push(String(e).slice(0, 160)));
    await pg.goto(pathToFileURL(ALVO).href, { waitUntil: 'load', timeout: 120000 });
    await pg.waitForTimeout(2500);   /* menos que isto e strictAutoLineup nao achou os dados */

    const times = await pg.evaluate(() => typeof window.__quickMatch === 'function'
      ? window.__quickMatch() : null);
    await pg.waitForTimeout(1200);

    /* o rotulo do botao E o multiplicador (OS-202) */
    const trocou = await pg.evaluate(v => {
      const b = [...document.querySelectorAll('.spd')]
        .find(x => x.textContent.trim().toUpperCase() === v);
      if (!b) return false;
      b.click();
      return true;
    }, c.vel);

    /* legenda fixa, para o clipe nao virar enfeite */
    await pg.evaluate(({ titulo, olhe }) => {
      const d = document.createElement('div');
      d.setAttribute('style', [
        'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:99999',
        'background:linear-gradient(transparent,rgba(8,12,10,.96) 26%)',
        'padding:30px 20px 14px', 'font-family:Georgia,serif', 'color:#e8ece9',
        'pointer-events:none',
      ].join(';'));
      d.innerHTML =
        `<div style="font-size:15px;font-weight:700;margin-bottom:4px">${titulo}</div>` +
        `<div style="font-size:12px;line-height:1.4;color:#b8c2be;max-width:100ch">${olhe}</div>`;
      document.body.appendChild(d);
    }, { titulo: c.titulo, olhe: c.olhe });

    /* roda ate o fim da partida ou ate o teto de tempo de parede */
    const t0 = Date.now();
    let estado = null;
    while ((Date.now() - t0) / 1000 < c.teto) {
      await dorme(2000);
      estado = await pg.evaluate(() => {
        const s = window.GAME && window.GAME._sim && window.GAME._sim();
        if (!s) return null;
        /* O RELOGIO E `s.minute`. Nem `s.t / 60` nem `s.t * clockRate`:
           `minute` so avanca com a bola em jogo (`this.dead <= 0`), entao
           converter `t` conta bola parada como minuto e infla o numero. */
        return { t: s.t, minuto: s.minute,
                 over: typeof s.isOver === 'function' ? s.isOver() : null,
                 placar: s.teams ? s.teams.map(x => x.goals) : null };
      });
      if (c.ateOFim && estado && estado.over) break;
    }

    await pg.close();
    await ctx.close();                    /* so aqui o webm e finalizado */

    /* pelo handle, nao por varredura do diretorio: a varredura pegou um
       arquivo ainda nao liberado e gravou um clipe de 0 byte */
    const bruto = await gravacao.path();
    fs.renameSync(bruto, path.join(DEST, c.arq));
    const tam = fs.statSync(path.join(DEST, c.arq)).size;

    indice.push({
      arquivo: c.arq, titulo: c.titulo, olhe: c.olhe,
      viewport: c.vp.join('x'), velocidade: c.vel, trocouDeVelocidade: trocou,
      segundosDeParede: Math.round((Date.now() - t0) / 10) / 100,
      partida: times, minutoDeJogoAoFim: estado && estado.minuto != null
        ? Math.round(estado.minuto * 10) / 10 : null,
      segundoDeSimulacao: estado && estado.t != null ? Math.round(estado.t) : null,
      terminou: !!(estado && estado.over), placar: estado && estado.placar,
      bytes: tam, errosDePagina: erros.length,
    });
    console.log(`  ${c.arq}  ${(tam / 1048576).toFixed(1)} MB  ${times || 'SEM __quickMatch'}`
      + `  ${estado && estado.over ? 'partida terminou' : 'teto de tempo'}`);
  }

  await nav.close();
  fs.writeFileSync(path.join(DEST, 'indice.json'), JSON.stringify({
    /* RETRATACAO, 2026-08-12. Uma versao anterior deste arquivo publicou aqui
       um "achado nao procurado": isOver() continuaria falso ate o equivalente
       a ~102 minutos de jogo. ERA ERRO MEU, e o erro esta catalogado como
       armadilha C1.

       Eu calculava o minuto por `sim.t * clockRate`. O relogio do jogo e
       `sim.minute`, que so avanca com a bola em jogo (`this.dead <= 0`) —
       converter `t` conta bola parada como minuto e infla o numero.

       Medido de novo, lendo `sim.minute` a cada 15 s em Chromium headless:

           195 s de parede  ->  t = 632 s de simulacao,  minute = 45,4

       Metade de 90 em metade do tempo. A partida termina normalmente; o teto
       de 210 s e que era curto demais para chegar la. NAO HA anomalia de fim
       de jogo. O teto agora e 460 s.

       O que continua verdadeiro da observacao original: os botoes 3X e TURBO
       avancaram na MESMA taxa (~6,2 s de simulacao por segundo de parede).
       Isso tem explicacao benigna plausivel — o laco e preso ao
       requestAnimationFrame, que o headless limita — e NAO se deve concluir
       nada sobre a velocidade do jogo a partir de uma corrida headless. */
    retratacao: {
      quando: '2026-08-12',
      afirmacao_retirada: 'isOver() falso aos ~102 minutos de jogo',
      motivo: 'minuto calculado por sim.t * clockRate em vez de sim.minute (armadilha C1)',
      medicao_que_refuta: { segundos_de_parede: 195, t_simulacao: 632, sim_minute: 45.4 },
      o_que_sobra: 'os botoes 3X e TURBO avancam na mesma taxa em headless; '
                 + 'provavel limite de requestAnimationFrame, nao defeito do jogo',
    },
    clipes: indice,
  }, null, 1));
  console.log(`\n${indice.length} clipes em ${DEST}`);
})();
