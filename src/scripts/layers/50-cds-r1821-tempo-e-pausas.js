
/* R18.21 · ACRÉSCIMOS, FIM DE JOGO E PAUSA DE BOLA PARADA
   -------------------------------------------------------------------------
   Três defeitos de regra encontrados pelo usuário jogando, todos confirmados
   por leitura do motor.

   1. ACRÉSCIMOS NÃO EXISTEM. O campo `this.stoppage` existe, é inicializado em
      zero (linha 4635) e zerado nas trocas de tempo (4894, 4910). É LIDO em
      três lugares — o fim do 1º tempo (4893), o `isOver()` (4918) e a
      interface (7991, que mostra `Math.ceil(this.stoppage)`). Mas NENHUMA
      linha do motor jamais atribui outro valor. O jogo sempre mostra "+0" e
      nunca dá um segundo a mais.

   2. A PARTIDA ACABA COM A BOLA ROLANDO. `isOver()` compara só o minuto; não
      olha se a bola está viva, viajando ou em reinício pendente. No futebol o
      árbitro espera a bola sair ou a jogada terminar.

   3. A COBRANÇA DE FALTA É A PAUSA MAIS CURTA DO JOGO — 0,45 s, contra 0,82 da
      falta comum, 0,60 do escanteio e 1,20 do gol. Justamente o lance que na
      vida real leva mais tempo: barreira, posicionamento, o juiz medindo.

   NOTA SOBRE `dead`: ele NÃO consome minuto de jogo, então estender a pausa
   não encurta a partida. Mas há registro no projeto de que janelas longas em
   REINÍCIO DE SAÍDA derrubaram gols 14,6%; por isso aqui só a bola parada de
   falta é estendida, e de forma moderada. */
(function installR1821TempoEPausas(root) {
'use strict';
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__CDS_R1821_TEMPO__) return;
const P = M.prototype;
Object.defineProperty(P, '__CDS_R1821_TEMPO__', { value: true });

const VERSION = '5.15.0-R18.21';
const finite = (v, d) => Number.isFinite(v) ? v : (d || 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Quanto cada parada custa, em minutos de acréscimo. Valores de futebol:
   um gol com comemoração custa perto de meio minuto; cartão e substituição,
   menos; lesão, mais. */
const CUSTO = {
  gol: 0.75,
  cartao: 0.35,
  vermelho: 0.70,
  substituicao: 0.40,
  lesao: 1.10,
  bolaParada: 0.06,   // faltas e escanteios somam pouco, mas somam
};
/* Base por tempo: mesmo num tempo sem gol nem cartão o árbitro dá algo, pelas
   paradas miúdas que nenhum evento registra. Medido sem base, o 2º tempo dava
   0,83 de média contra +3 a +5 do futebol real. */
const BASE_POR_TEMPO = { 1: 1.0, 2: 2.2, 3: 0.6, 4: 0.8 };
/* Teto por tempo, para não virar partida infinita. */
const TETO_ACRESCIMO = 7.0;

/* Depois do tempo esgotado, o árbitro espera a bola sair — mas não para
   sempre. Passado este limite, encerra de qualquer forma. */
const ESPERA_MAX_MIN = 2.5;

/* Pausa da cobrança de falta. O motor usa 0,45 s, a menor do jogo. */
const PAUSA_FALTA = 1.7;

function audit(sim) {
  if (!sim.__r1821tempo) {
    Object.defineProperty(sim, '__r1821tempo', {
      value: { version: VERSION, acrescimoPorTempo: {}, paradas: {},
               esperouBolaSair: 0, esperaMaxAtingida: 0, pausasEstendidas: 0 },
      enumerable: false, writable: true, configurable: true
    });
  }
  return sim.__r1821tempo;
}

/* A base entra uma vez por tempo, na primeira parada registrada — assim o
   acréscimo já nasce num patamar de futebol em vez de zero. */
function garantirBase(sim) {
  const tempo = finite(sim.half, 1);
  if (sim.__r1821BaseTempo === tempo) return;
  sim.__r1821BaseTempo = tempo;
  const base = BASE_POR_TEMPO[tempo] || 0;
  sim.stoppage = clamp(finite(sim.stoppage) + base, 0, TETO_ACRESCIMO);
}

function somar(sim, tipo) {
  try {
    const a = audit(sim);
    const custo = CUSTO[tipo] || 0;
    if (!custo) return;
    garantirBase(sim);
    const tempoAtual = finite(sim.half, 1);
    sim.stoppage = clamp(finite(sim.stoppage) + custo, 0, TETO_ACRESCIMO);
    a.paradas[tipo] = (a.paradas[tipo] || 0) + 1;
    a.acrescimoPorTempo[tempoAtual] = +finite(sim.stoppage).toFixed(2);
  } catch (_) {}
}

/* ── 1. acumular acréscimo a partir das paradas reais ─────────────────── */
const oldGoal = P._goal;
if (typeof oldGoal === 'function') {
  P._goal = function () { somar(this, 'gol'); return oldGoal.apply(this, arguments); };
}
const oldInjure = P._injure;
if (typeof oldInjure === 'function') {
  P._injure = function () { somar(this, 'lesao'); return oldInjure.apply(this, arguments); };
}
const oldSub = P.substitute;
if (typeof oldSub === 'function') {
  P.substitute = function () {
    const r = oldSub.apply(this, arguments);
    if (r) somar(this, 'substituicao');
    return r;
  };
}
/* cartões e bola parada vêm pelo evento, que é o ponto único por onde todos
   passam — evita embrulhar meia dúzia de métodos */
const oldEmit = P._emit;
if (typeof oldEmit === 'function') {
  P._emit = function (type) {
    try {
      if (type === 'yellow') somar(this, 'cartao');
      else if (type === 'red') somar(this, 'vermelho');
      else if (type === 'freekick' || type === 'corner' || type === 'penalty') somar(this, 'bolaParada');
    } catch (_) {}
    return oldEmit.apply(this, arguments);
  };
}

/* ── 2. o árbitro espera a bola sair ──────────────────────────────────── */
function bolaEmJogo(sim) {
  if (finite(sim.dead) > 0.05) return false;
  if (sim.waiting || sim.pendingRestart) return false;
  const b = sim.ball;
  if (!b) return false;
  return !!(b.owner || b.traveling);
}

const oldIsOver = P.isOver;
if (typeof oldIsOver === 'function') {
  P.isOver = function () {
    const acabouPeloRelogio = oldIsOver.apply(this, arguments);
    /* §R19.08 · TETO ABSOLUTO. O alvo `90 + stoppage` e movel: cada parada
       durante a espera empurra o fim para frente. Este limite e o que a
       propria camada declara -- acrescimo cheio mais a espera maxima. */
    const _r08lim = (finite(this.half) === 2) ? 90 + TETO_ACRESCIMO + ESPERA_MAX_MIN
                  : (finite(this.half) === 4) ? 120 + ESPERA_MAX_MIN : Infinity;
    if (finite(this.minute) >= _r08lim) return true;
    if (!acabouPeloRelogio) {
      /* §R19.08 · a ancora so morre quando MUDA O TEMPO. Zera-la aqui fazia a
         janela de 2,5 min recomecar a cada acrescimo novo -- medido, uma
         partida terminou 7,51 min depois do proprio teto. */
      if (this.__r1821EsperaTempo !== finite(this.half)) {
        this.__r1821EsperaDesde = null;
        this.__r1821EsperaTempo = finite(this.half);
      }
      return false;
    }
    try {
      const a = audit(this);
      if (bolaEmJogo(this)) {
        if (this.__r1821EsperaDesde == null) {
          this.__r1821EsperaDesde = finite(this.minute);
          a.esperouBolaSair++;
        }
        /* teto: se a jogada não terminar, encerra assim mesmo */
        if (finite(this.minute) - finite(this.__r1821EsperaDesde) < ESPERA_MAX_MIN) return false;
        a.esperaMaxAtingida++;
      }
    } catch (_) {}
    return true;
  };
}

/* ── 3. pausa de verdade para a cobrança de falta ──────────────────────── */
const oldFreeKick = P._freeKick;
if (typeof oldFreeKick === 'function') {
  P._freeKick = function () {
    const r = oldFreeKick.apply(this, arguments);
    try {
      if (finite(this.dead) > 0 && finite(this.dead) < PAUSA_FALTA) {
        this.dead = PAUSA_FALTA;
        audit(this).pausasEstendidas++;
      }
    } catch (_) {}
    return r;
  };
}

P.getTempoAudit = function () {
  const a = audit(this);
  return Object.assign({}, a, { stoppageAtual: finite(this.stoppage), tempo: finite(this.half) });
};

try {
  root.CDS_R1821_TEMPO = Object.freeze({
    version: VERSION, custo: CUSTO, tetoAcrescimo: TETO_ACRESCIMO,
    esperaMaxMin: ESPERA_MAX_MIN, pausaFalta: PAUSA_FALTA
  });
} catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
