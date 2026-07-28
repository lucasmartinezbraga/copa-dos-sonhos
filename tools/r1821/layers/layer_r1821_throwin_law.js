/* R18.21 · LEI DO LATERAL — SEM GOL DIRETO
   -------------------------------------------------------------------------
   REGRESSÃO QUE EU CAUSEI, e que o usuário encontrou jogando.

   A regra que impede gol direto de lateral foi escrita na R18.18.3.1 mas vivia
   DENTRO do bloco `cds-r1819-tactical-authority`. Ao remover aquela camada — o
   que a medição justificou: ela custava 20% dos chutes, 26% das tentativas de
   desarme e reprovava os três gates de identidade de estilo — a lei do lateral
   foi junto. Na base R18.20 há 4 ocorrências de `untouchedSinceRestart`; na
   RC1 havia ZERO.

   Esta camada restaura SOMENTE a lei, sem trazer de volta a tática autoritativa.
   É a regra do futebol: da cobrança de lateral não se faz gol direto. Enquanto
   nenhum segundo jogador tocar na bola:
     · não pode existir chute nem gol;
     · se a bola cruzar a linha de fundo adversária, é tiro de meta;
     · se cruzar a própria linha de fundo, é escanteio contra;
     · lançamento para a área continua permitido — o que se proíbe é o GOL.

   Acréscimo meu sobre o original: expiração por tempo. O original limpava o
   estado só em `_giveBall` e `_ballOut`; se algum caminho não passasse por lá,
   a marca ficaria presa e bloquearia um gol legítimo depois. Quinze segundos de
   jogo é folgado para qualquer sequência de lateral e fecha esse risco. */
(function installR1821ThrowInLaw(root) {
'use strict';
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__CDS_R1821_THROWIN_LAW__) return;
const P = M.prototype;
Object.defineProperty(P, '__CDS_R1821_THROWIN_LAW__', { value: true });

const VERSION = '5.15.0-R18.21';
const FL = Number(root.FL) || 105;
const FW = Number(root.FW) || 68;
const finite = (v, d) => Number.isFinite(v) ? v : (d || 0);
const EXPIRA_S = 15;

function audit(sim) {
  if (!sim.__r1821throw) {
    Object.defineProperty(sim, '__r1821throw', {
      value: { version: VERSION, laterais: 0, segundosToques: 0,
               chutesBloqueados: 0, golsBloqueados: 0,
               resolvidos: { tiroDeMeta: 0, escanteio: 0 }, expirados: 0 },
      enumerable: false, writable: true, configurable: true
    });
  }
  return sim.__r1821throw;
}

/* Estado vivo? Também expira sozinho, para não prender um gol legítimo. */
function pendente(sim) {
  const q = sim.__r1821Restart;
  if (!q || !q.untouched || q.origin !== 'throwIn') return null;
  if (finite(sim.t) - finite(q.startedAt) > EXPIRA_S) {
    audit(sim).expirados++;
    limpar(sim);
    return null;
  }
  return q;
}

function limpar(sim) {
  sim.__r1821Restart = null;
  const b = sim.ball;
  if (b) { b.restartOrigin = null; b.untouchedSinceRestart = false; }
}

/* Bola do lateral que termina em linha de fundo: tiro de meta se foi na meta
   adversária, escanteio contra se voltou para a própria. Nunca gol. */
function resolver(sim, motivo) {
  const q = pendente(sim);
  if (!q) return false;
  const tm = sim.teams && sim.teams[q.team];
  if (!tm) { limpar(sim); return false; }
  const b = sim.ball || {};
  const x = finite(b.x);
  const golAdversario = finite(tm.oppGoal && tm.oppGoal.x, tm.attackDir > 0 ? FL : 0);
  const cruzouGolAdversario = Math.abs(x - golAdversario) <= 2.2 ||
    (tm.attackDir > 0 ? x >= FL : x <= 0);
  limpar(sim);
  const a = audit(sim);
  if (cruzouGolAdversario) {
    a.resolvidos.tiroDeMeta++;
    sim._emit('throwin_law', { rule: 'no_direct_goal', outcome: 'goal_kick', team: q.team, motivo });
    sim._goalKickOrRestart(1 - q.team);
  } else {
    a.resolvidos.escanteio++;
    sim._emit('throwin_law', { rule: 'no_direct_goal', outcome: 'corner', team: q.team, motivo });
    sim._setCorner(1 - q.team);
  }
  return true;
}

/* 1. marca a procedência na cobrança */
const oldStartTravel = P._startTravel;
if (typeof oldStartTravel === 'function') {
  P._startTravel = function (actor, target, kind, onArrive, receiver, travelKind, meta) {
    try {
      const isThrow = travelKind === 'throw' || kind === 'throw' || !!(meta && meta.throwIn);
      if (isThrow && actor) {
        this.__r1821Restart = { origin: 'throwIn', team: actor.team, taker: actor,
                                untouched: true, startedAt: finite(this.t) };
        if (this.ball) { this.ball.restartOrigin = 'throwIn'; this.ball.untouchedSinceRestart = true; }
        audit(this).laterais++;
      }
    } catch (_) {}
    return oldStartTravel.apply(this, arguments);
  };
}

/* 2. segundo toque libera a jogada */
const oldGiveBall = P._giveBall;
if (typeof oldGiveBall === 'function') {
  P._giveBall = function (player) {
    const result = oldGiveBall.apply(this, arguments);
    try {
      const q = this.__r1821Restart;
      if (q && q.untouched && player && player !== q.taker) {
        q.untouched = false;
        if (this.ball) this.ball.untouchedSinceRestart = false;
        audit(this).segundosToques++;
      }
    } catch (_) {}
    return result;
  };
}

/* 3. chute proibido antes do segundo toque */
const oldShoot = P._shoot;
if (typeof oldShoot === 'function') {
  P._shoot = function () {
    if (pendente(this)) { audit(this).chutesBloqueados++; resolver(this, 'chute'); return; }
    return oldShoot.apply(this, arguments);
  };
}

/* 4. gol proibido antes do segundo toque */
const oldGoal = P._goal;
if (typeof oldGoal === 'function') {
  P._goal = function () {
    if (pendente(this)) { audit(this).golsBloqueados++; resolver(this, 'gol'); return; }
    return oldGoal.apply(this, arguments);
  };
}

/* 5. bola fora: linha de fundo resolve pela lei; lateral só limpa o estado */
const oldBallOut = P._ballOut;
if (typeof oldBallOut === 'function') {
  P._ballOut = function () {
    try {
      const b = this.ball || {};
      const naLinhaDeFundo = finite(b.x) <= 0 || finite(b.x) >= FL;
      if (naLinhaDeFundo && pendente(this) && resolver(this, 'linha_de_fundo')) return;
    } catch (_) {}
    const result = oldBallOut.apply(this, arguments);
    try {
      const b = this.ball || {};
      if (this.__r1821Restart && (finite(b.y) < 0 || finite(b.y) > FW)) limpar(this);
    } catch (_) {}
    return result;
  };
}

/* 6. o evento de chute também não pode escapar */
const oldEmit = P._emit;
if (typeof oldEmit === 'function') {
  P._emit = function (type) {
    if (type === 'shot_taken' && pendente(this)) { audit(this).chutesBloqueados++; return; }
    return oldEmit.apply(this, arguments);
  };
}

P.getThrowInLawAudit = function () { return Object.assign({}, audit(this)); };

try {
  root.CDS_R1821_THROWIN_LAW = Object.freeze({
    version: VERSION, expiraSegundos: EXPIRA_S,
    restauraDe: 'R18.18.3.1 (perdida junto com cds-r1819-tactical-authority)'
  });
} catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
