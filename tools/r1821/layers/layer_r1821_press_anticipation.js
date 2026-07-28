/* R18.21 · PRESSÃO ANTECIPADA — CHEGAR JUNTO COM O PASSE
   -------------------------------------------------------------------------
   QUEIXA: "o meio-campo não sabe pressionar."

   CAUSA MEDIDA, em três etapas, com duas hipóteses eliminadas antes:
     · NÃO é autorização: o motor já designa quem está perto. Em 81,9% dos
       ticks NENHUM defensor está em distância de bote, e quando há um, é o
       presser em 98,4% das vezes. Liberar mais candidatos renderia ~0,9
       tentativa por partida.
     · NÃO é velocidade: o presser corre a 5,66 m/s contra 2,46 m/s do
       portador, vantagem de 3,20 m/s, e encolhe a distância em 83,8% dos
       ticks.
     · NÃO é a coleira do bloco: ele recebe a bola como alvo em 83% dos ticks;
       soltar o teto da R18.5 já foi testado e REGREDIU.

     É DISTÂNCIA INICIAL. Ele começa a ~8 m, fecha a 4,4 m/s, precisa de ~1,8 s
     — e o portador segura a bola cerca de 2 s antes de passar. Ele chega quando
     a bola já saiu, um novo presser é designado a 8 m do novo portador, e o
     ciclo recomeça. Com 217 passes por partida, isso é o tempo todo.

   O DEFEITO ESTRUTURAL. `_selectPresser` pontua por `D(p, b)` — a posição
   ATUAL da bola. Com a bola em voo, isso é o meio do caminho. E em
   `_defendTarget` a linha `if (p === presser) return [b.x, b.y]` vem ANTES do
   bloco de antecipação, então o pressionador é o único jogador do time que
   nunca antecipa: ele persegue a bola voando em vez de ir ao recebedor.

   O QUE ESTA CAMADA FAZ. Com a bola em voo para um recebedor conhecido:
     · `_selectPresser` passa a pontuar pela distância ao PONTO DE CHEGADA;
     · o presser passa a ir ao recebedor, goal-side, em vez de à bola.
   É assim que pressão funciona no futebol: você não corre atrás de quem tem a
   bola, você chega junto com o passe.

   O QUE ELA NÃO FAZ. Não mexe na geometria do bloco: o alvo novo é submetido
   ao MESMO teto que a R18.5 aplica hoje (meia line+15,2 m; zagueiro ±2,45 m),
   reaplicado aqui porque esta camada roda por fora dela. Sem teleporte, sem
   bônus de velocidade, sem consumo de RNG. */
(function installR1821PressAnticipation(root) {
'use strict';
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__CDS_R1821_PRESS_ANTICIPATION__) return;
const P = M.prototype;
Object.defineProperty(P, '__CDS_R1821_PRESS_ANTICIPATION__', { value: true });

const VERSION = '5.15.0-R18.21';
const FL = Number(root.FL) || 105;
const FW = Number(root.FW) || 68;
const finite = (v, d) => Number.isFinite(v) ? v : (d || 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(finite(ax) - finite(bx), finite(ay) - finite(by));
function ownProg(tm, x) { return tm && tm.goal && tm.goal.x < FL / 2 ? x : FL - x; }
const fromProg = ownProg;

function lineOf(p) {
  const pos = p && (p.oopPos || p.slotPos);
  if (!p || p.isGK || pos === 'GK') return 'GK';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'DEF';
  if (['CDM', 'DM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'MID';
  return 'FWD';
}

/* Mesmos limites que a R18.5 já aplica hoje. Reaplicados porque esta camada
   devolve o alvo depois dela. Nada de geometria muda. */
const MID_PRESSER_AHEAD = 15.2;
const DEF_BAND = 2.45;
const GOAL_SIDE_M = 1.15;   // fica entre o recebedor e o gol defendido

/* O ALVO SE MOVE CONTINUAMENTE. Medido: deixar o alvo saltar de golpe no
   instante em que o passe começa produzia 8 ticks por 8 partidas acima de
   11 m/s — velocidade irreal que a base NÃO tem (zero ticks). O integrador
   reage ao salto do alvo, não a nenhum bônus meu.
   Limitando o deslocamento do alvo a 0,8 m por tick (24 m/s de deriva, bem
   acima do que o jogador consegue seguir), a intenção do defensor passa a ser
   contínua: ele LÊ o passe e ajusta, em vez de teleportar a decisão. */
const ALVO_DERIVA_MAX_M = 0.8;

/* Ponto de chegada da bola: o recebedor se houver, senão o alvo do passe. */
function arrivalPoint(sim, defTeamSide) {
  const b = sim.ball;
  if (!b || !b.traveling) return null;
  const kind = b.kind;
  if (kind !== 'pass' && kind !== 'through' && kind !== 'launch') return null;
  const r = b.receiver;
  if (r && !r.red && r.team !== defTeamSide) {
    return { x: finite(r.x), y: finite(r.y), receiver: r };
  }
  if (b.target && Number.isFinite(b.target.x) && Number.isFinite(b.target.y)) {
    return { x: finite(b.target.x), y: finite(b.target.y), receiver: null };
  }
  return null;
}

function audit(sim) {
  if (!sim.__r1821antec) {
    Object.defineProperty(sim, '__r1821antec', {
      value: { version: VERSION, selectCalls: 0, selectAntecipados: 0,
               targetCalls: 0, targetAntecipados: 0, clampBound: 0,
               derivaLimitada: 0, ganhoDistanciaSoma: 0, ganhoN: 0 },
      enumerable: false, writable: true, configurable: true
    });
  }
  return sim.__r1821antec;
}

/* 1. ESCOLHA — quem consegue CHEGAR, não quem está perto da bola em voo. */
const oldSelect = P._selectPresser;
if (typeof oldSelect === 'function') {
  P._selectPresser = function (tm, b) {
    const a = audit(this);
    a.selectCalls++;
    const arrival = arrivalPoint(this, tm && tm.side);
    if (!arrival || !tm || !tm.players) return oldSelect.apply(this, arguments);

    // Reaproveita a pontuação original, mas medindo até o ponto de chegada.
    const available = tm.players.filter(p => p && !p.red && !p.isGK);
    if (!available.length) return oldSelect.apply(this, arguments);
    let pick = null, best = 1e9;
    for (const p of available) {
      const d = dist(p.x, p.y, arrival.x, arrival.y);
      const fatigue = (100 - finite(p.stamina, 100)) * 0.055;
      const score = d + fatigue;
      if (score < best) { best = score; pick = p; }
    }
    if (!pick) return oldSelect.apply(this, arguments);

    // Histerese igual à do motor: só troca se a troca compensa de verdade.
    const old = tm._presser;
    if (!old || old.red || old.isGK || !available.includes(old)) tm._presser = pick;
    else {
      const oldScore = dist(old.x, old.y, arrival.x, arrival.y) + (100 - finite(old.stamina, 100)) * 0.055;
      if (oldScore > 14 || best + 1.6 < oldScore) tm._presser = pick;
    }
    a.selectAntecipados++;
    return tm._presser;
  };
}

/* 2. ALVO — o presser vai ao recebedor, goal-side, e não à bola em voo. */
const oldDefendTarget = P._defendTarget;
if (typeof oldDefendTarget === 'function') {
  P._defendTarget = function (tm, p, b, presser) {
    const out = oldDefendTarget.apply(this, arguments);
    try {
      if (!out || !tm || !p || p.red || p.isGK || p !== presser) return out;
      const a = audit(this);
      a.targetCalls++;
      const arrival = arrivalPoint(this, tm.side);
      if (!arrival) return out;

      // goal-side: entre o ponto de chegada e o gol defendido
      const gx = finite(tm.goal && tm.goal.x, 0), gy = finite(tm.goal && tm.goal.y, FW / 2);
      const vx = gx - arrival.x, vy = gy - arrival.y;
      const L = Math.max(0.001, Math.hypot(vx, vy));
      let tx = arrival.x + (vx / L) * GOAL_SIDE_M;
      let ty = arrival.y + (vy / L) * GOAL_SIDE_M;

      // MESMO teto da R18.5. A forma do bloco não muda.
      const L2 = lineOf(p);
      if (L2 === 'MID' || L2 === 'DEF') {
        const line = finite(tm._r13LineDepth, ownProg(tm, finite(p.x)));
        let px = ownProg(tm, tx);
        const maxAhead = line + (L2 === 'MID' ? MID_PRESSER_AHEAD : DEF_BAND);
        const minDepth = line - (L2 === 'MID' ? 1.8 : DEF_BAND);
        if (px > maxAhead || px < minDepth) a.clampBound++;
        px = clamp(px, minDepth, maxAhead);
        tx = fromProg(tm, px);
      }

      /* Deriva limitada: o alvo caminha do ponto anterior até o novo, no máximo
         ALVO_DERIVA_MAX_M por avaliação. Remove a descontinuidade que gerava
         pico de velocidade. Guardado no próprio jogador, não-enumerável. */
      const prev = p.__r1821AntecTgt;
      if (prev) {
        const dx = tx - prev[0], dy = ty - prev[1];
        const d = Math.hypot(dx, dy);
        if (d > ALVO_DERIVA_MAX_M) {
          tx = prev[0] + (dx / d) * ALVO_DERIVA_MAX_M;
          ty = prev[1] + (dy / d) * ALVO_DERIVA_MAX_M;
          a.derivaLimitada++;
        }
      }
      try {
        Object.defineProperty(p, '__r1821AntecTgt', {
          value: [tx, ty], enumerable: false, writable: true, configurable: true
        });
      } catch (_) { p.__r1821AntecTgt = [tx, ty]; }

      a.targetAntecipados++;
      a.ganhoDistanciaSoma += dist(p.x, p.y, finite(b.x), finite(b.y)) - dist(p.x, p.y, tx, ty);
      a.ganhoN++;
      return [clamp(tx, 1, FL - 1), clamp(ty, 1, FW - 1)];
    } catch (_) {}
    return out;
  };
}

P.getPressAnticipationAudit = function () {
  const a = audit(this);
  return {
    version: VERSION,
    selecoesAntecipadas: a.selectAntecipados,
    taxaDeSelecaoAntecipada: a.selectCalls ? a.selectAntecipados / a.selectCalls : 0,
    alvosAntecipados: a.targetAntecipados,
    taxaDeAlvoAntecipado: a.targetCalls ? a.targetAntecipados / a.targetCalls : 0,
    clampSegurou: a.clampBound,
    ganhoMedioDeDistancia_m: a.ganhoN ? a.ganhoDistanciaSoma / a.ganhoN : 0
  };
};

try {
  root.CDS_R1821_PRESS_ANTICIPATION = Object.freeze({
    version: VERSION, midPresserAhead: MID_PRESSER_AHEAD, defBand: DEF_BAND,
    goalSideM: GOAL_SIDE_M, blockGeometryChanged: false,
    teleport: false, speedBonus: false, rngUsed: false
  });
} catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
