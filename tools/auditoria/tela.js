#!/usr/bin/env node
'use strict';
/* SONDA DE TELA — nivel N5: ritmo, pausa e fluidez, em RELOGIO DE PAREDE
   =========================================================================
   Por que existe um nivel so para isto.

   A auditoria em Node (auditoria.js) mede o JOGO: regra, fisica, contador.
   Ela nao consegue medir a EXPERIENCIA, porque tudo que decide experiencia
   mora no laco de render — o multiplicador do botao, o adianto de bola parada
   (ADIANTA_PARADA), a janela de cerimonia da OS-263, a comemoracao, a camera
   lenta. Nada disso existe fora do navegador.

   E a experiencia se mede em SEGUNDOS DE PAREDE, nunca em segundos de
   simulacao: a pausa que o olho sente e a que o relogio do olho conta. Uma
   falta de 1,7 s de simulacao pode virar 0,3 s de tela (se algo a adianta) ou
   5 s (se algo a segura). Sao bugs opostos e o mesmo numero de simulacao.

   O que a sonda devolve:
     · custo de tela: quantos segundos de parede custa 1 s de simulacao, e a
       projecao de quanto dura a partida inteira em cada velocidade;
     · pausa por tipo de reinicio, em ms de parede (falta, escanteio, gol...);
     · orcamento do tempo de tela: quanto e futebol rolando, quanto e espera;
     · fluidez: quadros desenhados sem nenhum passo de simulacao (imagem
       congelada) e quadros com 2+ passos (salto), que e a assinatura de
       quantizacao do laco de passo fixo.

   Uso:
     node tools/auditoria/tela.js --build=dist/index.html --segundos=180
     node tools/auditoria/tela.js --build=... --velocidade=1 --segundos=120 --out=x.json
*/

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

function carregarPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(c); } catch (_) {}
  }
  console.error('playwright nao encontrado — sonda de tela pulada');
  process.exit(0);
}

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));

const { chromium } = carregarPlaywright();
const alvo = path.resolve(argv.build || 'dist/index.html');
const SEGUNDOS = Number(argv.segundos || 150);
const VEL = argv.velocidade ? Number(argv.velocidade) : null;   // null = o padrao do jogo

(async () => {
  const navegador = await chromium.launch({ headless: true,
    ...(process.env.CDS_CHROMIUM ? { executablePath: process.env.CDS_CHROMIUM } : {}),
    args: ['--no-sandbox', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  const pagina = await navegador.newPage({ viewport: { width: 1366, height: 768 } });
  const erros = [], consoleErros = [];
  pagina.on('pageerror', e => erros.push(String(e)));
  pagina.on('console', m => { if (m.type() === 'error') consoleErros.push(m.text().slice(0, 300)); });

  await pagina.goto(pathToFileURL(alvo).href, { waitUntil: 'load', timeout: 120000 });
  await pagina.waitForTimeout(2500);

  /* A sonda vive DENTRO da pagina: precisa do mesmo relogio de parede que o
     laco de render usa. Medir de fora, por CDP, mediria a latencia do
     protocolo junto. */
  const iniciou = await pagina.evaluate((vel) => {
    if (typeof window.__quickMatch !== 'function') return { erro: '__quickMatch ausente' };
    const nome = window.__quickMatch(40, 120);
    const sim = window.GAME && window.GAME._sim && window.GAME._sim();
    if (!sim) return { erro: 'sim nao criado' };
    if (vel && window.G) window.G.speed = vel;

    const S = window.__CDS_SONDA_TELA = {
      t0: performance.now(),
      amostras: 0, quadros: 0, semPasso: 0, doisOuMais: 0, passos: 0,
      somaQuadroMs: 0, maxQuadroMs: 0,
      eventos: [],          // { tipo, parede, simT, minuto }
      pausas: [],           // { tipo, paredeMs, simS, minuto }
      paredeMorta: 0, paredeViva: 0,
      simMorta: 0, simViva: 0,
      velocidade: window.G ? window.G.speed : null,
      cerimoniaAtivaMs: 0,
      /* FLUIDEZ MEDIDA NO QUE E DESENHADO, nao no que e simulado.
         `__CDS_SCREEN.p` (OS-64) publica a posicao de TELA de cada atleta no
         quadro. Contar passo de simulacao por quadro mede a VELOCIDADE do
         botao; contar reversao de deslocamento DESENHADO mede o que o olho
         chama de tremor. Sao coisas diferentes e so a segunda e fluidez. */
      desl: [], tremor: 0, saltos: 0, amostrasDesenho: 0,
      fim: null,
    };

    /* eventos com carimbo de parede */
    const emitOriginal = sim._emit;
    sim._emit = function (t, d) {
      try { S.eventos.push({ tipo: t, parede: performance.now(), simT: sim.t, minuto: sim.minute }); }
      catch (_) {}
      return emitOriginal.apply(this, arguments);
    };

    /* passos de simulacao por quadro desenhado */
    const stepOriginal = sim.step;
    sim.step = function (dt) { S.passos++; return stepOriginal.apply(this, arguments); };

    let ultimoParede = performance.now(), ultimoPassos = 0, ultimoSimT = sim.t;
    let pausaAberta = null;
    let telaAnt = null, deltaAnt = null;
    const laco = () => {
      const agora = performance.now();
      const dtMs = agora - ultimoParede;
      const novos = S.passos - ultimoPassos;
      const dSim = sim.t - ultimoSimT;
      S.quadros++; S.amostras++;
      S.somaQuadroMs += dtMs;
      if (dtMs > S.maxQuadroMs) S.maxQuadroMs = dtMs;
      if (novos === 0) S.semPasso++;
      else if (novos >= 2) S.doisOuMais++;

      const morta = (Number(sim.dead) || 0) > 0;
      if (morta) { S.paredeMorta += dtMs; S.simMorta += dSim; }
      else { S.paredeViva += dtMs; S.simViva += dSim; }
      try { if (window.__cdsCerimoniaAtiva && window.__cdsCerimoniaAtiva(sim)) S.cerimoniaAtivaMs += dtMs; } catch (_) {}

      /* janelas de bola parada, em parede */
      if (morta && !pausaAberta) {
        const recentes = S.eventos.filter(e => agora - e.parede <= 900).map(e => e.tipo);
        pausaAberta = { inicio: agora, simInicio: sim.t, minuto: sim.minute, eventos: recentes.slice(-6) };
      } else if (!morta && pausaAberta) {
        const PRIOR = ['goal', 'penalty', 'red', 'injury', 'yellow', 'foul', 'freekick',
          'offside', 'corner', 'throw_in', 'goal_kick', 'halftime', 'kickoff'];
        let tipo = 'sem_evento';
        for (const p of PRIOR) if (pausaAberta.eventos.indexOf(p) !== -1) { tipo = p; break; }
        S.pausas.push({ tipo, paredeMs: Math.round(agora - pausaAberta.inicio),
          simS: +(sim.t - pausaAberta.simInicio).toFixed(2), minuto: +pausaAberta.minuto.toFixed(1) });
        pausaAberta = null;
      }

      /* tremor e salto do DESENHO */
      try {
        const sc = window.__CDS_SCREEN && window.__CDS_SCREEN.p;
        if (sc) {
          const atual = Object.create(null);
          for (const k in sc) { const v = sc[k]; if (v) atual[k] = [v.x, v.y]; }
          if (telaAnt) {
            const delta = Object.create(null);
            for (const k in atual) {
              const a = telaAnt[k]; if (!a) continue;
              const dx = atual[k][0] - a[0], dy = atual[k][1] - a[1];
              delta[k] = [dx, dy];
              const m = Math.hypot(dx, dy);
              if (m > 0.01) { S.desl.push(m); if (S.desl.length > 20000) S.desl.shift(); }
              S.amostrasDesenho++;
              if (deltaAnt && deltaAnt[k]) {
                const b2 = deltaAnt[k];
                const mb = Math.hypot(b2[0], b2[1]);
                /* reversao com as duas passadas acima do ruido de subpixel */
                if (m > 0.35 && mb > 0.35 && (dx * b2[0] + dy * b2[1]) < 0) S.tremor++;
              }
            }
            deltaAnt = delta;
          }
          telaAnt = atual;
        }
      } catch (_) {}

      ultimoParede = agora; ultimoPassos = S.passos; ultimoSimT = sim.t;
      if (S.eventos.length > 4000) S.eventos.splice(0, 2000);
      requestAnimationFrame(laco);
    };
    requestAnimationFrame(laco);
    return { ok: true, partida: nome, velocidade: window.G ? window.G.speed : null };
  }, VEL);

  if (iniciou.erro) {
    console.error('FALHA: ' + iniciou.erro);
    await navegador.close();
    process.exit(2);
  }

  await pagina.waitForTimeout(SEGUNDOS * 1000);

  const S = await pagina.evaluate(() => {
    const S = window.__CDS_SONDA_TELA;
    const sim = window.GAME._sim();
    S.fim = { simT: sim.t, minuto: sim.minute, placar: sim.score.slice(),
      paredeS: (performance.now() - S.t0) / 1000, velocidade: window.G ? window.G.speed : null };
    const contagem = {};
    for (const e of S.eventos) contagem[e.tipo] = (contagem[e.tipo] || 0) + 1;
    S.eventosContagem = contagem;
    S.eventos = S.eventos.slice(-50);
    return S;
  });

  await navegador.close();

  /* ------------------------------------------------------------- analise */
  const parede = S.fim.paredeS;
  const sim = S.fim.simT;
  const custo = sim > 0 ? parede / sim : null;        // s de parede por s de simulacao
  const SIM_PARTIDA = 1366;                            // s de simulacao de uma partida cheia
  const porTipo = {};
  for (const p of S.pausas) {
    const a = porTipo[p.tipo] = porTipo[p.tipo] || { n: 0, parede: [], sim: [] };
    a.n++; a.parede.push(p.paredeMs); a.sim.push(p.simS);
  }
  const p50 = v => { if (!v.length) return null; const s = v.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const p90 = v => { if (!v.length) return null; const s = v.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))]; };
  const pausas = {};
  for (const k of Object.keys(porTipo).sort()) {
    const a = porTipo[k];
    pausas[k] = { n: a.n, paredeMsP50: p50(a.parede), paredeMsP90: p90(a.parede),
      paredeMsMax: Math.max.apply(null, a.parede), simSP50: p50(a.sim) };
  }
  const paredeTotal = S.paredeMorta + S.paredeViva;
  const saida = {
    ferramenta: 'tools/auditoria/tela.js',
    geradoEm: new Date().toISOString(),
    build: path.basename(alvo),
    janelaS: +parede.toFixed(1),
    velocidadeBotao: S.fim.velocidade,
    partida: { simulados: +sim.toFixed(1), minuto: +S.fim.minuto.toFixed(1), placar: S.fim.placar },
    custoDeTela: {
      paredePorSimulacao: custo == null ? null : +custo.toFixed(4),
      partidaInteiraMin: custo == null ? null : +(SIM_PARTIDA * custo / 60).toFixed(1),
      obs: 'partidaInteiraMin projeta 1.366 s de simulacao no custo medido nesta janela',
    },
    orcamentoDeTela: {
      fracaoParedeBolaMorta: paredeTotal ? +(S.paredeMorta / paredeTotal).toFixed(4) : null,
      fracaoSimBolaMorta: (S.simMorta + S.simViva) ? +(S.simMorta / (S.simMorta + S.simViva)).toFixed(4) : null,
      cerimoniaS: +(S.cerimoniaAtivaMs / 1000).toFixed(1),
      obs: 'se a fracao de PAREDE morta e muito maior que a de SIMULACAO morta, a espera esta sendo esticada na tela',
    },
    pausas,
    fluidez: {
      quadros: S.quadros,
      fpsMedio: +(S.quadros / parede).toFixed(1),
      quadroMsMedio: +(S.somaQuadroMs / Math.max(1, S.quadros)).toFixed(2),
      quadroMsPior: +S.maxQuadroMs.toFixed(1),
      passosDeSimulacao: S.passos,
      fracaoQuadrosSemPasso: +(S.semPasso / Math.max(1, S.quadros)).toFixed(4),
      fracaoQuadrosCom2OuMais: +(S.doisOuMais / Math.max(1, S.quadros)).toFixed(4),
      obs: 'passos por quadro medem a VELOCIDADE escolhida, nao a fluidez: no 3X e normal desenhar ~2 passos por quadro.',
      desenho: (function () {
        const d = S.desl || [];
        if (!d.length) return { disponivel: false, obs: '__CDS_SCREEN ausente' };
        const s2 = d.slice().sort((a, b) => a - b);
        const med = s2[Math.floor(s2.length / 2)];
        const saltos = d.filter(v => v > med * 4).length;
        return {
          disponivel: true,
          amostras: S.amostrasDesenho,
          deslocamentoMedianoPx: +med.toFixed(3),
          fracaoTremor: +(S.tremor / Math.max(1, S.amostrasDesenho)).toFixed(4),
          fracaoSalto: +(saltos / Math.max(1, d.length)).toFixed(4),
          obs: 'tremor = deslocamento desenhado que inverte de direcao entre quadros; salto = passada 4x acima da mediana. Esta e a medida de fluidez.',
        };
      })(),
    },
    eventosContagem: S.eventosContagem,
    erros: { pageerror: erros.slice(0, 5), consoleError: consoleErros.slice(0, 5) },
  };

  if (argv.out) {
    fs.mkdirSync(path.dirname(argv.out), { recursive: true });
    fs.writeFileSync(argv.out, JSON.stringify(saida, null, 2));
  }
  console.log(legivel(saida));
  if (argv.out) console.log(`\njson -> ${argv.out}`);
})().catch(e => { console.error(e); process.exit(1); });

function legivel(s) {
  const L = [];
  L.push('');
  L.push('=== SONDA DE TELA ===');
  L.push(`build ${s.build}  janela ${s.janelaS}s  botao ${s.velocidadeBotao}X`);
  L.push(`simulou ${s.partida.simulados}s de jogo (ate ${s.partida.minuto}')  placar ${s.partida.placar.join('x')}`);
  L.push('');
  L.push(`custo de tela: ${s.custoDeTela.paredePorSimulacao} s de parede por s de simulacao`);
  L.push(`               partida inteira projetada: ${s.custoDeTela.partidaInteiraMin} min`);
  L.push('');
  L.push(`bola morta: ${(s.orcamentoDeTela.fracaoParedeBolaMorta * 100).toFixed(1)}% do TEMPO DE TELA  ` +
    `(${(s.orcamentoDeTela.fracaoSimBolaMorta * 100).toFixed(1)}% da simulacao)`);
  L.push('');
  L.push('pausa por tipo de reinicio (ms de parede):');
  L.push('  tipo              n     p50      p90      max    (sim p50)');
  for (const k of Object.keys(s.pausas)) {
    const p = s.pausas[k];
    L.push(`  ${k.padEnd(16)} ${String(p.n).padStart(3)}  ${String(p.paredeMsP50).padStart(6)}  ` +
      `${String(p.paredeMsP90).padStart(6)}  ${String(p.paredeMsMax).padStart(6)}    ${p.simSP50}s`);
  }
  L.push('');
  L.push(`fluidez: ${s.fluidez.fpsMedio} fps  quadro medio ${s.fluidez.quadroMsMedio} ms  pior ${s.fluidez.quadroMsPior} ms`);
  L.push(`         ${(s.fluidez.fracaoQuadrosSemPasso * 100).toFixed(1)}% dos quadros sem passo de simulacao ` +
    `| ${(s.fluidez.fracaoQuadrosCom2OuMais * 100).toFixed(1)}% com 2+ passos`);
  const D = s.fluidez.desenho;
  if (D && D.disponivel) {
    L.push(`         DESENHO: passada mediana ${D.deslocamentoMedianoPx} px  ` +
      `tremor ${(D.fracaoTremor * 100).toFixed(2)}%  salto ${(D.fracaoSalto * 100).toFixed(2)}%`);
  }
  if (s.erros.pageerror.length) L.push(`\nERROS DE PAGINA: ${s.erros.pageerror.join(' | ')}`);
  return L.join('\n');
}
