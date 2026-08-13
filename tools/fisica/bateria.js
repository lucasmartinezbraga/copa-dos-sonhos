#!/usr/bin/env node
'use strict';
/* BATERIA DE FISICA — compativel em semente com tools/r1840/bateria.js
   -------------------------------------------------------------------------
   Mesma semente base (4200000), mesmo incremento (7919), mesma varredura de
   formacoes e estilos, mesmo dt, mesma construcao de time. Os agregados sao
   diretamente comparaveis com as baterias historicas.

   O que este arquivo acrescenta:
     - execucao em paralelo por fatias de partida (--workers), porque a
       calibracao da fisica exige rodar muitas bases e 5 s/partida em serie
       inviabiliza o ciclo;
     - SONDAS DE FISICA: apice de voo, altura na linha de gol, bolas por cima
       do travessao, quiques, tempo de voo. Sem elas nao da para saber se uma
       mudanca de trajetoria fez efeito ou so mexeu no placar.

   Uso:
     node tools/fisica/bateria.js --build=dist/index.html --matches=60
     node tools/fisica/bateria.js --build=... --matches=60 --workers=6 --out=r.json
*/

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { fork } = require('child_process');

const argv = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v];
}));

const SEMENTE = Number(argv.semente || 4200000);
const INCREMENTO = 7919;
const DT = 1 / 30;
const CHAVES = ['shots', 'onTarget', 'goals', 'xg', 'corners', 'fouls', 'yellow', 'red',
  'passes', 'passOk', 'tackles', 'offsides', 'throwIns', 'goalKicks'];

/* ---------------------------------------------------------------- ambiente */
function noop() {}
function define(n, v) {
  try { Object.defineProperty(global, n, { value: v, writable: true, configurable: true }); }
  catch (_) { global[n] = v; }
}
function instalarAmbiente() {
  define('window', global); define('self', global);
  define('navigator', { userAgent: 'cds-bateria', language: 'pt-BR' });
  define('location', { href: 'runner://bateria', search: '', hash: '' });
  define('performance', { now: () => 0 }); define('crypto', crypto.webcrypto);
  define('requestAnimationFrame', () => 0); define('cancelAnimationFrame', noop);
  define('addEventListener', noop); define('removeEventListener', noop);
  define('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop }));
  define('alert', noop); define('confirm', () => true); define('prompt', () => null);
  define('localStorage', { getItem: () => null, setItem: noop, removeItem: noop, clear: noop });
  define('sessionStorage', global.localStorage);
  define('CanvasRenderingContext2D', undefined);
  define('HTMLElement', function HTMLElement() {});
  define('HTMLCanvasElement', function HTMLCanvasElement() {});
  define('Image', function Image() {});
  define('Audio', function Audio() { return { play: () => Promise.resolve(), pause: noop }; });
  define('__showBootError', noop); define('__cdsDebugWarn', noop); define('CDS_DEBUG', false);
}

/* Blocos que dependem de DOM real ou abrem timers da Copa. Mesma lista da
   bateria R18.40, para a carga medida continuar sendo a mesma. */
const SKIP = new Set(['cds-2_5d-gate-a-contracts-v02', 'cds-pre25d-runtime-auditor-v04',
  'cds-r109-async-cup', 'cds-mobile-boot-bridge', 'cds-ux-boot']);
const EXIGIDOS = ['MatchSim', 'autoLineup', 'buildDB', 'DATA', 'FORMATIONS', 'srand', 'R',
  'chance', 'facet', 'clamp', 'D', 'FL', 'FW'];

function carregar(buildPath) {
  const html = fs.readFileSync(buildPath, 'utf8');
  const sha = crypto.createHash('sha256').update(html).digest('hex');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let mt, idx = 0, ok = 0, erro = 0;
  const excecoes = [];
  while ((mt = re.exec(html))) {
    const id = (mt[1].match(/id="([^"]+)"/) || [])[1] || `script-${idx}`; idx++;
    if (SKIP.has(id)) continue;
    try { vm.runInThisContext(mt[2], { filename: `${id}.js` }); ok++; }
    catch (e) {
      erro++;
      excecoes.push({ bloco: id, mensagem: String(e && e.message || e) });
    }
  }
  const faltando = EXIGIDOS.filter(n => typeof global[n] === 'undefined');
  if (faltando.length) {
    console.error('ABORTA: simbolos do motor ausentes -> ' + faltando.join(', '));
    process.exit(2);
  }
  return { sha, ok, erro, excecoes };
}

/* ------------------------------------------------------------ sondas de fisica
   O apice e a altura na linha sao lidos da propria bola, amostrados a cada
   passo. Nada aqui altera o jogo: so observa. */
const TRAVESSAO = 2.44, POSTE_M = 3.66;

function instrumentar(sim, sonda) {
  const alvoX = [sim.teams[0].oppGoal.x, sim.teams[1].oppGoal.x];
  const alvoY = [sim.teams[0].oppGoal.y, sim.teams[1].oppGoal.y];
  let voando = false, apice = 0, xAnt = null, zAnt = 0, quiqueAnt = 0, tVoo = 0;

  const passo = sim.step.bind(sim);
  sim.step = function (dt) {
    const r = passo(dt);
    const b = this.ball;
    if (!b) return r;
    const z = Number.isFinite(b.z) ? b.z : 0;

    /* O cruzamento da linha e medido FORA do teste de `traveling`.
       Motivo: o passo em que a bola atravessa a linha e, quase sempre, o mesmo
       passo em que o voo termina — `_ballTravel` zera `traveling` e cola a bola
       na ultima amostra dentro do mesmo `step`. Checando so enquanto
       `traveling` era verdadeiro, a sonda perdia exatamente o quadro que
       interessa e reportava `passaramPorCimaDoTravessao: 0` mesmo com a camada
       de fisica contando dezenas deles. */
    if (b.kind === 'shot' && xAnt != null && Math.abs(b.x - xAnt) > 1e-9) {
      for (let lado = 0; lado < 2; lado++) {
        const gx = alvoX[lado], dir = Math.sign(gx - 52.5);
        const antes = (xAnt - gx) * dir, agora = (b.x - gx) * dir;
        if (antes < 0 && agora >= 0) {
          const f = (agora - antes) !== 0 ? (0 - antes) / (agora - antes) : 0;
          const zc = zAnt + (z - zAnt) * f;
          const yc = b.y;
          sonda.cruzamentos++;
          sonda.somaZLinha += zc;
          if (zc > sonda.maxZLinha) sonda.maxZLinha = zc;
          if (zc > TRAVESSAO) {
            sonda.porCimaDoTravessao++;
            if (Math.abs(yc - alvoY[lado]) <= POSTE_M) sonda.porCimaEntreOsPostes++;
          }
        }
      }
    }
    xAnt = b.x;

    if (b.traveling) {
      if (!voando) { voando = true; apice = 0; tVoo = 0; }
      tVoo += dt;
      if (z > apice) apice = z;
      /* quique: a bola tocou o chao e voltou a subir */
      if (zAnt <= 0.02 && z > 0.05 && quiqueAnt > 0.05) sonda.quiques++;
      if (zAnt > 0.02 && z <= 0.02) quiqueAnt = zAnt;
    } else if (voando) {
      voando = false;
      sonda.voos++;
      sonda.somaApice += apice;
      if (apice > sonda.maxApice) sonda.maxApice = apice;
      if (apice > TRAVESSAO) sonda.voosAcimaDoTravessao++;
      sonda.somaTempoVoo += tVoo;
      quiqueAnt = 0;
    }
    zAnt = z;
    return r;
  };
}

/* RITMO POR FAIXA DE 15 MINUTOS.
   O futebol real cresce ate o fim: ~10% dos gols saem antes dos 15 minutos e
   ~24% dos 76 em diante. Medido aqui, o jogo faz o contrario — 20% na primeira
   faixa e 12% na ultima. Ha duas explicacoes possiveis e elas pedem consertos
   opostos: ou o fim de jogo recebe MENOS TEMPO DE SIMULACAO por minuto de
   relogio (bug de relogio), ou recebe o mesmo tempo e produz MENOS ACAO
   (modelo de fadiga). Sem separar as duas nao da para consertar, entao a
   bateria passa a contar as duas coisas por faixa. */
const FAIXAS = 6;                    // 0-15, 16-30, 31-45, 46-60, 61-75, 76+
const faixaDe = (min) => Math.max(0, Math.min(FAIXAS - 1, Math.floor((+min || 0) / 15)));

function sondaVazia() {
  return { voos: 0, somaApice: 0, maxApice: 0, voosAcimaDoTravessao: 0, somaTempoVoo: 0,
    cruzamentos: 0, somaZLinha: 0, maxZLinha: 0, porCimaDoTravessao: 0,
    porCimaEntreOsPostes: 0, quiques: 0, somaSegundosSimulados: 0, partidasMedidas: 0, os200: {},
    /* por faixa de 15 min de relogio de jogo */
    segPorFaixa: new Array(FAIXAS).fill(0),
    /* MINUTOS DE JOGO por faixa — nao e 15 para todas, e por isso este campo
       existe. Medido em 96 partidas: 0-15, 16-30, 31-45 e 61-75 dao 15,00;
       o 46-60 da 18,70 porque os ACRESCIMOS DO PRIMEIRO TEMPO caem nele
       (minuto 45,0-48,7 tem indice de faixa 3); o 76+ da 21,14 por ser aberto.
       Sem isto, comparar percentuais brutos entre faixas mede o tamanho da
       faixa junto com o ritmo do jogo — inventa um pico no 46-60 e disfarca a
       queda do 76+. */
    minutosPorFaixa: new Array(FAIXAS).fill(0),
    chutesPorFaixa: new Array(FAIXAS).fill(0),
    golsPorFaixa: new Array(FAIXAS).fill(0),
    passesPorFaixa: new Array(FAIXAS).fill(0),
    somaStaminaPorFaixa: new Array(FAIXAS).fill(0),
    amostrasStaminaPorFaixa: new Array(FAIXAS).fill(0) };
}

/* Varredura de clockRate — SONDA, nao mudanca de jogo.
   `ENGINE_CALIBRATION` e congelado, entao nao da para trocar o numero. O motor
   avanca o relogio num lugar so (`if (this.dead <= 0) this.minute += dt *
   clockRate`), entao reescalar o incremento por quadro reproduz exatamente
   outro clockRate. O guarda de 0,1 evita reescalar os SALTOS de relogio
   (intervalo, acrescimos), que nao sao incremento continuo. */
const CLOCK_PADRAO = 0.13;
function aplicarClock(taxa) {
  if (!taxa || !Number.isFinite(taxa) || taxa === CLOCK_PADRAO) return;
  const fator = taxa / CLOCK_PADRAO;
  const P = MatchSim.prototype, passoOriginal = P.step;
  P.step = function (dt) {
    const antes = this.minute;
    const r = passoOriginal.apply(this, arguments);
    const d = this.minute - antes;
    if (d > 0 && d < 0.1) this.minute = antes + d * fator;
    return r;
  };
}

/* --------------------------------------------------------------- populacao */
function montarPopulacao() {
  const db = buildDB(DATA);
  const FORMS = Object.keys(FORMATIONS);
  const STYLES = (typeof STYLE_KEYS !== 'undefined' && Array.isArray(STYLE_KEYS))
    ? STYLE_KEYS.slice() : ['balanced', 'tiki', 'direct', 'press', 'counter', 'wings', 'park'];
  const squad = db.squads.find(s => s.c === 'Brasil' && Number(s.y) === 1970) || db.squads[0];
  const mk = (f, st, home) => {
    const p = autoLineup(squad, f, 0);
    return { squad, name: squad.c, flag: squad.f, color: home ? '#2e9bff' : '#ff3d7f',
      lineup: p.lineup, bench: p.bench, formKey: f, style: st };
  };
  return { FORMS, STYLES, mk };
}

function rodarFatia(indices) {
  const { FORMS, STYLES, mk } = montarPopulacao();
  const partidas = [];
  const sonda = sondaVazia();
  for (const i of indices) {
    const seed = SEMENTE + i * INCREMENTO;
    const fh = FORMS[i % FORMS.length], fa = FORMS[(i * 3 + 1) % FORMS.length];
    const sh = STYLES[i % STYLES.length], sa = STYLES[(i * 5 + 2) % STYLES.length];
    srand(seed);
    const sim = new MatchSim(mk(fh, sh, true), mk(fa, sa, false), { neutral: true, labMode: true });
    sim.teams[0].formKey = fh; sim.teams[1].formKey = fa;
    const ev = Object.create(null);
    /* SEQUENCIA DE GOLS — para medir bola de neve.
       Se o motor for justo e os dois times sao o MESMO elenco, a chance de o
       proximo gol sair de quem ja esta na frente tem de ficar em ~50%. Acima
       disso existe efeito acumulativo, e e ele que produz goleada. */
    const golsSeq = [];
    const oEmit = sim._emit;
    sim._emit = function (t, d) {
      ev[t] = (ev[t] || 0) + 1;
      if (t === 'goal' && d && d.by) golsSeq.push({ time: d.by.team, minuto: Math.floor(sim.minute) });
      return oEmit.apply(this, arguments);
    };
    instrumentar(sim, sonda);
    /* laco com contagem por faixa: tempo, chutes, gols e passes sao lidos como
       DELTA dos contadores do proprio motor, entao nao ha risco de contar
       diferente do agregado. */
    let s = 0;
    let cShots = 0, cGoals = 0, cPasses = 0, amostraStamina = 0;
    const soma = (k) => (+sim.stats[0][k] || 0) + (+sim.stats[1][k] || 0);
    while (!sim.isOver() && s++ < 500000) {
      const f = faixaDe(sim.minute);
      const _minAntes = sim.minute;
      sim.step(DT);
      sonda.segPorFaixa[f] += DT;
      const _dm = sim.minute - _minAntes;
      if (_dm > 0 && _dm < 0.5) sonda.minutosPorFaixa[f] += _dm;
      const nShots = soma('shots'), nGoals = soma('goals'), nPasses = soma('passes');
      sonda.chutesPorFaixa[f] += nShots - cShots; cShots = nShots;
      sonda.golsPorFaixa[f] += nGoals - cGoals; cGoals = nGoals;
      sonda.passesPorFaixa[f] += nPasses - cPasses; cPasses = nPasses;
      /* stamina custa um laco de 22, entao amostra a cada ~4 s de simulacao */
      if (++amostraStamina % 120 === 0) {
        let soma2 = 0, n2 = 0;
        for (const tm of sim.teams) for (const p of tm.players) if (p && !p.red) { soma2 += (+p.stamina || 0); n2++; }
        if (n2) { sonda.somaStaminaPorFaixa[f] += soma2 / n2; sonda.amostrasStaminaPorFaixa[f]++; }
      }
    }
    sonda.somaSegundosSimulados = (sonda.somaSegundosSimulados || 0) + s * DT;
    sonda.partidasMedidas = (sonda.partidasMedidas || 0) + 1;
    /* Contadores da propria camada de fisica: dizem por qual ramo geometrico
       cada chute saiu, que e o que a sonda externa nao consegue ver. */
    if (typeof sim.getOS200Report === 'function') {
      const rel = sim.getOS200Report();
      sonda.os200 = sonda.os200 || {};
      for (const k of Object.keys(rel)) {
        if (typeof rel[k] === 'number') sonda.os200[k] = (sonda.os200[k] || 0) + rel[k];
      }
    }
    const linha = { i, seed, formacoes: [fh, fa], estilos: [sh, sa], placar: sim.score.slice() };
    /* stamina final media dos jogadores em campo — o alvo de design
       `averageEndingStamina` depende diretamente de quanto tempo de simulacao a
       partida dura, entao e a metrica que mais sente o clockRate */
    try {
      const vivos = [];
      for (const tm of sim.teams) for (const p of tm.players) if (p && !p.red) vivos.push(+p.stamina || 0);
      linha.staminaFinal = vivos.length ? vivos.reduce((a, b) => a + b, 0) / vivos.length : null;
    } catch (_) { linha.staminaFinal = null; }
    for (const k of CHAVES) linha[k] = (+sim.stats[0][k] || 0) + (+sim.stats[1][k] || 0);
    linha.eventos = ev;
    linha.golsSeq = golsSeq;
    partidas.push(linha);
  }
  return { partidas, sonda };
}

/* ----------------------------------------------------------------- agregacao */
function agregar(partidas, sonda, extra) {
  const N = partidas.length;
  const agregado = {};
  for (const k of CHAVES) {
    const v = partidas.map(p => p[k]).sort((a, b) => a - b);
    const media = v.reduce((a, b) => a + b, 0) / N;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / N);
    agregado[k] = { media: +media.toFixed(3), desvio: +sd.toFixed(3), min: v[0], max: v[N - 1] };
  }
  const eventosTotais = {};
  for (const p of partidas) for (const k of Object.keys(p.eventos)) eventosTotais[k] = (eventosTotais[k] || 0) + p.eventos[k];
  const eventosPorPartida = {};
  for (const k of Object.keys(eventosTotais).sort()) eventosPorPartida[k] = +(eventosTotais[k] / N).toFixed(3);

  const fisica = {
    voos: sonda.voos,
    apiceMedio: sonda.voos ? +(sonda.somaApice / sonda.voos).toFixed(3) : 0,
    apiceMaximo: +sonda.maxApice.toFixed(3),
    voosAcimaDoTravessao: sonda.voosAcimaDoTravessao,
    tempoVooMedio: sonda.voos ? +(sonda.somaTempoVoo / sonda.voos).toFixed(3) : 0,
    cruzamentosDaLinha: sonda.cruzamentos,
    zMedioNaLinha: sonda.cruzamentos ? +(sonda.somaZLinha / sonda.cruzamentos).toFixed(3) : 0,
    zMaximoNaLinha: +sonda.maxZLinha.toFixed(3),
    passaramPorCimaDoTravessao: sonda.porCimaDoTravessao,
    porCimaEntreOsPostes: sonda.porCimaEntreOsPostes,
    quiques: sonda.quiques,
    quiquesPorPartida: +(sonda.quiques / N).toFixed(3),
    segundosSimuladosPorPartida: +((sonda.somaSegundosSimulados || 0) / Math.max(1, sonda.partidasMedidas || N)).toFixed(1),
    ramos: sonda.os200 || {},
  };

  /* ritmo por faixa de 15 min: separa "menos tempo simulado" de "menos acao" */
  const seg = sonda.segPorFaixa || [];
  if (seg.length) {
    const tot = seg.reduce((a, b) => a + b, 0) || 1;
    fisica.ritmoPorFaixa = seg.map((s, i) => ({
      faixa: i < 5 ? `${i * 15 + (i ? 1 : 0)}-${i * 15 + 15}` : '76+',
      segundosPorPartida: +(s / N).toFixed(1),
      fracaoDoTempo: +(s / tot).toFixed(4),
      minutosDeJogoPorPartida: +((sonda.minutosPorFaixa[i] || 0) / N).toFixed(2),
      chutes: +((sonda.chutesPorFaixa[i] || 0) / N).toFixed(2),
      gols: +((sonda.golsPorFaixa[i] || 0) / N).toFixed(3),
      passes: +((sonda.passesPorFaixa[i] || 0) / N).toFixed(1),
      /* as duas taxas que interessam: por MINUTO DE JOGO, nao por partida */
      chutesPorMinutoDeJogo: +((sonda.chutesPorFaixa[i] || 0) / N / 15).toFixed(3),
      golsPorMinutoDeJogo: +((sonda.golsPorFaixa[i] || 0) / N / 15).toFixed(4),
      staminaMedia: sonda.amostrasStaminaPorFaixa[i]
        ? +(sonda.somaStaminaPorFaixa[i] / sonda.amostrasStaminaPorFaixa[i]).toFixed(1) : null,
    }));
  }
  return Object.assign({ partidas: N, sementeBase: SEMENTE, incremento: INCREMENTO,
    agregado, eventosPorPartida, fisica,
    porPartida: partidas.map(p => ({ placar: p.placar, staminaFinal: p.staminaFinal, golsSeq: p.golsSeq })) }, extra || {});
}

/* -------------------------------------------------------------------- modos */
if (process.env.CDS_FATIA) {
  /* processo filho: roda uma fatia e devolve o bruto */
  instalarAmbiente();
  const realConsole = console;
  global.console = { log: noop, warn: noop, error: realConsole.error };
  process.on('message', msg => {
    /* knobs de calibracao ANTES da carga: a camada le CDS_OS200_TUNE no
       momento em que e instalada */
    if (msg.tune) define('CDS_OS200_TUNE', msg.tune);
    if (msg.tune206) define('CDS_OS206_TUNE', msg.tune206);
    if (msg.tuneD35) define('CDS_D35_TUNE', msg.tuneD35);
    carregar(msg.build);
    aplicarClock(msg.clockRate);
    const r = rodarFatia(msg.indices);
    process.send({ partidas: r.partidas, sonda: r.sonda });
    process.exit(0);
  });
} else {
  const build = String(argv.build || 'dist/index.html');
  const N = Number(argv.matches || 60);
  const W = Math.max(1, Number(argv.workers || 1));
  const indices = Array.from({ length: N }, (_, i) => i);
  const TUNE = argv.tune ? JSON.parse(String(argv.tune)) : null;
  const TUNE206 = argv.tune206 ? JSON.parse(String(argv.tune206)) : null;
  const TUNED35 = argv.tuneD35 ? JSON.parse(String(argv.tuneD35)) : null;
  const CLOCK = argv.clockRate ? Number(argv.clockRate) : null;

  if (W === 1) {
    instalarAmbiente();
    if (TUNE) define('CDS_OS200_TUNE', TUNE);
    if (TUNE206) define('CDS_OS206_TUNE', TUNE206);
    if (TUNED35) define('CDS_D35_TUNE', TUNED35);
    const realConsole = console;
    global.console = { log: noop, warn: noop, error: realConsole.error };
    const carga = carregar(build);
    aplicarClock(CLOCK);
    const r = rodarFatia(indices);
    const out = agregar(r.partidas, r.sonda, { build: path.basename(build), sha256: carga.sha,
      scriptsCarregados: carga.ok, scriptsComErro: carga.erro, excecoes: carga.excecoes });
    realConsole.log(JSON.stringify(out, null, 2));
    if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(out, null, 2));
  } else {
    /* fatias intercaladas, para cada worker pegar uma amostra representativa
       de formacoes e estilos em vez de um bloco contiguo */
    const fatias = Array.from({ length: W }, () => []);
    indices.forEach((i, k) => fatias[k % W].push(i));
    const todas = [];
    const sondaTotal = sondaVazia();
    let vivos = W;
    const t0 = Date.now();
    for (const fatia of fatias) {
      const filho = fork(__filename, [], { env: Object.assign({}, process.env, { CDS_FATIA: '1' }) });
      filho.on('message', m => {
        todas.push(...m.partidas);
        for (const k of Object.keys(sondaTotal)) {
          if (k === 'os200') {
            for (const j of Object.keys(m.sonda.os200 || {})) {
              sondaTotal.os200[j] = (sondaTotal.os200[j] || 0) + m.sonda.os200[j];
            }
          } else if (Array.isArray(sondaTotal[k])) {
            /* contadores por faixa: soma termo a termo. `+=` em array produz
               concatenacao de string ("0,0" + "1,2"), silenciosa e fatal. */
            const v = m.sonda[k] || [];
            for (let j = 0; j < sondaTotal[k].length; j++) sondaTotal[k][j] += (+v[j] || 0);
          } else if (k.startsWith('max')) sondaTotal[k] = Math.max(sondaTotal[k], m.sonda[k]);
          else sondaTotal[k] += m.sonda[k];
        }
      });
      filho.on('exit', () => {
        if (--vivos === 0) {
          todas.sort((a, b) => a.i - b.i);
          const out = agregar(todas, sondaTotal, { build: path.basename(build),
            segundos: +((Date.now() - t0) / 1000).toFixed(1), workers: W });
          console.log(JSON.stringify(out, null, 2));
          if (argv.out) fs.writeFileSync(argv.out, JSON.stringify(out, null, 2));
        }
      });
      filho.send({ build: path.resolve(build), indices: fatia, tune: TUNE, tune206: TUNE206, tuneD35: TUNED35, clockRate: CLOCK });
    }
  }
}
