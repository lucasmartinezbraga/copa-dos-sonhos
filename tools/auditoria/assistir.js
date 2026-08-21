#!/usr/bin/env node
'use strict';
/* ASSISTIR — 90 minutos de jogo, com prints
   =========================================================================
   Isto nao mede nada. Isto OLHA.

   Toda a suite ate aqui responde perguntas que ja sabiamos fazer: um contador
   regrediu? a bola saiu do mundo? o alvo de calibracao esta na faixa? Nenhuma
   delas ve o que um jogador ve. E defeito de tela nao aparece em agregado --
   aparece quando alguem senta e assiste.

   O que este arquivo faz:
     · sobe o jogo no Chromium, comeca uma partida e assiste ate o apito final;
     · tira print a cada N minutos de JOGO, para ver o andamento;
     · e tira RAJADA de prints em cima de cada lance -- falta, escanteio, gol,
       cartao, impedimento, lateral: no instante do evento e depois dele, que e
       exatamente onde o olho reclama;
     · guarda, junto de cada print, o minuto, o placar, a narracao na tela e o
       estado da bola. O print sozinho nao diz de que lance ele e.

   Uso:
     node tools/auditoria/assistir.js --build=dist/index.html
     node tools/auditoria/assistir.js --build=... --velocidade=3 --ate=90 \
       --dir=reports/auditoria/jogo
*/
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

function carregarPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(c); } catch (_) {}
  }
  console.error('playwright nao encontrado');
  process.exit(1);
}
const { chromium } = carregarPlaywright();

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));
const alvo = path.resolve(argv.build || 'dist/index.html');
const VEL = Number(argv.velocidade || 3);
const ATE = Number(argv.ate || 90);
const DIR = argv.dir || 'reports/auditoria/jogo';
const PASSO_MIN = Number(argv['passo-min'] || 3);      // print de rotina a cada N min de jogo
const LARG = Number(argv.largura || 1280), ALT = Number(argv.altura || 800);
const GRAVAR = argv.gravar !== 'nao';

/* Lances que merecem rajada, e quantos ms depois do evento olhar de novo.
   Os atrasos sao de RELOGIO DE PAREDE porque e assim que o olho conta. */
const RAJADA = {
  goal:      [0, 700, 1600, 3200],
  penalty:   [0, 700, 1600, 3200],
  red:       [0, 700, 1800],
  foul:      [0, 500, 1200, 2200],
  freekick:  [0, 500, 1200, 2200],
  yellow:    [0, 800, 1800],
  corner:    [0, 600, 1400, 2600],
  offside:   [0, 700, 1600],
  throw_in:  [0, 500, 1200],
  goal_kick: [0, 600, 1400],
  kickoff:   [0, 900, 2000],
  halftime:  [0, 1500],
  injury:    [0, 900, 2000],
};
/* teto por tipo, para nao virar dez mil arquivos */
const TETO = { foul: 8, freekick: 6, throw_in: 4, goal_kick: 4, corner: 6, offside: 4,
  yellow: 4, goal: 8, penalty: 4, red: 3, kickoff: 3, halftime: 2, injury: 3 };

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  for (const f of fs.readdirSync(DIR)) { try { fs.unlinkSync(path.join(DIR, f)); } catch (_) {} }

  const navegador = await chromium.launch({ headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox'] });
  /* GRAVAR A PARTIDA INTEIRA. O print congela um instante; o video guarda o
     TEMPO, que e onde moram ritmo, pausa e fluidez. Os dois juntos: o video
     para assistir, os prints para apontar. */
  const contexto = await navegador.newContext({
    viewport: { width: LARG, height: ALT },
    recordVideo: GRAVAR ? { dir: DIR, size: { width: LARG, height: ALT } } : undefined,
  });
  const pagina = await contexto.newPage();
  const errosPagina = [];
  pagina.on('pageerror', e => errosPagina.push(String(e).slice(0, 200)));

  await pagina.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pagina.waitForTimeout(2500);

  const inicio = await pagina.evaluate((vel) => {
    if (typeof window.__quickMatch !== 'function') return { erro: '__quickMatch ausente' };
    const nome = window.__quickMatch(40, 120);
    const sim = window.GAME && window.GAME._sim && window.GAME._sim();
    if (!sim) return { erro: 'sim nao criado' };
    if (window.G) window.G.speed = vel;

    /* `conta` e separado de `eventos` de proposito: a lista e podada para nao
       estourar memoria numa partida inteira, e contar em cima dela subnotifica
       tudo que aconteceu no comeco do jogo. Ja reportei um "gol a menos" que
       era so isso. */
    const P = window.__CDS_ASSISTIR = { fila: [], eventos: [], conta: Object.create(null), ultimoEvento: null };
    const oEmit = sim._emit;
    sim._emit = function (t, d) {
      try {
        const reg = { tipo: t, minuto: sim.minute, parede: performance.now(),
          quem: (d && d.by && d.by.ref && d.by.ref.n) || (d && d.p && d.p.ref && d.p.ref.n) || null };
        P.conta[t] = (P.conta[t] || 0) + 1;
        P.eventos.push(reg);
        P.fila.push(reg);
        P.ultimoEvento = reg;
        if (P.eventos.length > 3000) P.eventos.splice(0, 1000);
      } catch (_) {}
      return oEmit.apply(this, arguments);
    };
    return { ok: true, partida: nome };
  }, VEL);

  if (inicio.erro) { console.error('FALHA: ' + inicio.erro); await navegador.close(); process.exit(2); }
  console.log(`assistindo: ${inicio.partida}  ${VEL}X  ate ${ATE}'`);

  const prints = [];
  const contaTipo = Object.create(null);
  let proximoRotina = 0;
  const pendentes = [];   // { arquivo, quando, rotulo }

  const estado = () => pagina.evaluate(() => {
    const sim = window.GAME._sim();
    const P = window.__CDS_ASSISTIR;
    const fila = P.fila.splice(0, P.fila.length);
    const feed = Array.from(document.querySelectorAll('.feed-line, .narr, .narration, [class*="narr"]'))
      .map(e => (e.textContent || '').trim()).filter(Boolean).slice(-1)[0] || '';
    const b = sim.ball || {};
    return { minuto: sim.minute, placar: sim.score.slice(), dead: sim.dead,
      bola: { x: +(b.x || 0).toFixed(1), y: +(b.y || 0).toFixed(1), z: +(b.z || 0).toFixed(2),
        viajando: !!b.traveling, dono: b.owner ? ((b.owner.ref && b.owner.ref.n) || '?') : null },
      fila, feed, over: sim.isOver(), parede: performance.now() };
  });

  const capturar = async (rotulo, st) => {
    const nome = `${String(Math.floor(st.minuto)).padStart(3, '0')}min-${rotulo}-${prints.length}.png`;
    const arq = path.join(DIR, nome);
    await pagina.screenshot({ path: arq });
    prints.push({ arquivo: nome, rotulo, minuto: +st.minuto.toFixed(2), placar: st.placar.slice(),
      dead: +Number(st.dead || 0).toFixed(2), bola: st.bola, narracao: st.feed });
    return nome;
  };

  const t0 = Date.now();
  let ultimoLog = 0;
  while (true) {
    const st = await estado();
    if (st.over || st.minuto >= ATE) { await capturar('fim', st); break; }
    if (Date.now() - t0 > 25 * 60 * 1000) { console.error('tempo maximo atingido'); break; }

    /* rajadas agendadas que ja venceram */
    const agora = st.parede;
    for (let i = pendentes.length - 1; i >= 0; i--) {
      if (agora >= pendentes[i].quando) {
        await capturar(pendentes[i].rotulo, st);
        pendentes.splice(i, 1);
      }
    }

    /* eventos novos: dispara a rajada */
    for (const e of st.fila) {
      const atrasos = RAJADA[e.tipo];
      if (!atrasos) continue;
      const n = (contaTipo[e.tipo] = (contaTipo[e.tipo] || 0) + 1);
      if (n > (TETO[e.tipo] || 4)) continue;
      for (const dms of atrasos) {
        if (dms === 0) await capturar(`${e.tipo}-t0`, st);
        else pendentes.push({ rotulo: `${e.tipo}-t${dms}`, quando: e.parede + dms });
      }
    }

    /* print de rotina */
    if (st.minuto >= proximoRotina) {
      await capturar('rotina', st);
      proximoRotina = Math.floor(st.minuto / PASSO_MIN) * PASSO_MIN + PASSO_MIN;
    }

    if (st.minuto - ultimoLog >= 10) {
      ultimoLog = st.minuto;
      console.log(`  ${st.minuto.toFixed(0)}'  ${st.placar.join('x')}  ${prints.length} prints  ` +
        `${((Date.now() - t0) / 1000).toFixed(0)}s de parede`);
    }
    await pagina.waitForTimeout(120);
  }

  const fim = await estado();
  const eventos = await pagina.evaluate(() => Object.assign({}, window.__CDS_ASSISTIR.conta));
  let video = null;
  try {
    if (GRAVAR) {
      const v = pagina.video();
      await pagina.close();
      await contexto.close();
      if (v) {
        const destino = path.join(DIR, 'partida-completa.webm');
        await v.saveAs(destino);
        video = destino;
      }
    } else { await contexto.close(); }
  } catch (e) { console.error('video: ' + e); }
  await navegador.close();

  const resumo = {
    ferramenta: 'tools/auditoria/assistir.js',
    geradoEm: new Date().toISOString(),
    build: path.basename(alvo), partida: inicio.partida,
    velocidade: VEL, viewport: `${LARG}x${ALT}`,
    minutoFinal: +fim.minuto.toFixed(1), placar: fim.placar,
    paredeS: +((Date.now() - t0) / 1000).toFixed(1),
    prints: prints.length, eventos, errosPagina, video,
    catalogo: prints,
  };
  fs.writeFileSync(path.join(DIR, 'catalogo.json'), JSON.stringify(resumo, null, 2));
  console.log('');
  console.log(`fim: ${resumo.minutoFinal}'  ${resumo.placar.join('x')}  ` +
    `${resumo.prints} prints em ${resumo.paredeS}s de parede`);
  console.log(`catalogo -> ${path.join(DIR, 'catalogo.json')}`);
})().catch(e => { console.error(e); process.exit(1); });
