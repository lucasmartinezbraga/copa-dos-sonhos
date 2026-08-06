
(function(root){
'use strict';
/* §R18.99 · ANTI-TELEPORTE E LEI DO REINICIO
   ==========================================
   Quatro defeitos, todos medidos, todos com a mesma forma: alguem precisa
   estar num lugar e o motor o poe la de graca, em vez de faze-lo ir.

   T3  ORCAMENTO DE PASSO. Na bola morta rodam TRES sistemas de movimento no
       mesmo quadro -- o tatico (:16897, teto 0,395 m), a caminhada de bola
       parada (:18290, 0,215 m) e a barreira da OS-36 (:25029, 0,233 m) -- e
       nenhum sabe do outro. Somados dao 0,84 m por quadro, 25 m/s. Medidos
       262 quadros assim em 6 partidas. A correcao reimpoe, no fim do passo, o
       MESMO teto que o movimento tatico ja usa.

   T4  O PINO DO BATEDOR. __cdsTakerWait (:21558) ja sabe quem cobra e onde;
       o que faltava era manter o alvo vivo, porque :18287 limpa __spTarget
       no snap de chegada e a IA tatica leva o batedor embora. Sem o pino,
       snapTakerBeforeRestart (:21642) o cravava no ponto no quadro do
       reinicio: p90 de 8,62 m no escanteio, 7,84 m na falta, maximo 12,12 m.
       E a mesma lei que a OS-100 ja aplica no lateral, onde o salto e 0,36 m.

   T5  TIRO DE META. _goalKickOrRestart (:7221) nunca poe a bola na pequena
       area: ela fica onde saiu e _giveBall a cola no pe do goleiro no
       quadro do reinicio. Medido: 11,3 por partida, a bola saltando 11,18 m
       de mediana e 18,79 m no pior caso.

   T6  SAIDA DE BOLA. _kickoff (:4789) elege o batedor pela CASA dele
       ("o dhx mais perto do meio"), nao por onde ele esta. Depois de um gol
       ele pode estar a 50 m do circulo -- e a bola voava ate la: mediana
       7,84 m, maximo 53,89 m. Passa a bater quem esta mais perto do circulo,
       e ele CAMINHA ate a bola.

   B1  O PAPEL QUE NAO MORRE. _setPieceRole e portao em :21841 e :21867:
       quem o carrega some das camadas de corrida na area. clearCorner13
       (:17072) so roda na cadeia do escanteio, entao o ramo crossed da
       falta (:6951) o deixa pendurado. Medido: 91 de 120 papeis sobrevivem ao
       reinicio; na falta a mediana e 8,4 s e o maximo 57,6 s de bola rolando.

   Nada aqui sorteia. Nenhum consumo de RNG novo, nenhuma alteracao de xG. */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__R1899__) return;
const P = M.prototype; P.__R1899__ = true;
const FLv = Number(root.FL) || 105, FWv = Number(root.FW) || 68;

const WALK = 0.92;            // fracao de maxSpd na caminhada (mesma da R15)
const RAIO_ENTREGA = 1.60;    // m -- ja esta na bola?
const RAIO_PINO = 0.30;       // m -- abaixo disto nao vale re-armar
const PAPEL_VIVO = 2.50;      // s de bola rolando ate o papel morrer
const FOLGA_PASSO = 0.02;     // m de tolerancia no orcamento
const SALTO_ADMIN = 2.50;     // acima disto e recolocacao administrativa
const TETO_META = 3.00;       // s de espera do tiro de meta
const TETO_SAIDA = 3.20;      // s de espera da saida de bola

function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); }
function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }
function dd(a, b, c, d) { return Math.hypot(a - c, b - d); }

function pinar(sim, taker, x, y, teto, exigeRestart) {
  if (!taker) return;
  sim.__r99Pino = { taker: taker, x: x, y: y, ate: num(sim.t) + teto, exige: !!exigeRestart, pr: null };
}

/* ------------------------------------------------------ T5 · tiro de meta */
const oldGoalKick = P._goalKickOrRestart;
if (typeof oldGoalKick === 'function') {
  P._goalKickOrRestart = function (team) {
    const r = oldGoalKick.apply(this, arguments);
    try {
      const tm = this.teams && this.teams[team], g = tm && tm.goal, b = this.ball;
      if (!tm || !g || !b || typeof this.pendingRestart !== 'function') return r;
      const gk = (tm.players || []).find(function (p) { return p && p.isGK && !p.red; })
              || (tm.players || []).filter(function (p) { return p && !p.red; })[0];
      if (!gk) return r;
      /* tm.goal e o gol PROPRIO; attackDir aponta para o campo de ataque.
         O ponto do tiro de meta e dentro da pequena area, no lado por onde a
         bola saiu -- e nao o pe de quem estiver mais perto. */
      const dir = num(tm.attackDir, 1) >= 0 ? 1 : -1;
      const saiuPor = num(b.y, FWv / 2) < FWv / 2 ? -1 : 1;
      const spotX = cl(num(g.x) + dir * 5.5, 1, FLv - 1);
      const spotY = cl(FWv / 2 + saiuPor * 3.66, 3, FWv - 3);
      b.owner = null; b.traveling = false; b.target = null; b.receiver = null;
      b.x = spotX; b.y = spotY; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0;
      const d = dd(num(gk.x), num(gk.y), spotX, spotY);
      gk.__spTarget = { x: spotX, y: spotY };
      this.dead = Math.max(num(this.dead), Math.min(TETO_META, .45 + d / (num(gk.maxSpd, 7) * WALK)));
      pinar(this, gk, spotX, spotY, TETO_META + .4, true);
      const orig = this.pendingRestart, sim = this;
      this.pendingRestart = function () {
        sim.__r99Pino = null;
        try {
          if (gk && !gk.red && dd(num(gk.x), num(gk.y), spotX, spotY) <= RAIO_ENTREGA) {
            gk.__spTarget = null;
            const bb = sim.ball;
            bb.owner = null; bb.traveling = false;
            bb.x = spotX; bb.y = spotY; bb.z = 0; bb.vx = 0; bb.vy = 0; bb.vz = 0;
            sim._giveBall(gk); if (sim.ball.owner) sim.ball.owner.settle = .3;
            return;
          }
        } catch (_) {}
        return orig.call(sim);
      };
      /* Se outra rotina trocar o reinicio depois desta -- o caso real e a
         expulsao do portador em :6887, que chama o tiro de meta e so depois a
         R18.35 monta a falta por cima --, o pino do goleiro perde o objeto e
         precisa sair de cena, senao ele segura a bola morta caminhando para um
         ponto que ninguem mais vai cobrar. */
      if (this.__r99Pino) this.__r99Pino.pr = this.pendingRestart;
    } catch (_) {}
    return r;
  };
}

/* --------------------------------------------------- T6 · saida de bola */
const oldKickoff = P._kickoff;
if (typeof oldKickoff === 'function') {
  P._kickoff = function (side, start) {
    const r = oldKickoff.apply(this, arguments);
    try {
      const tm = this.teams && this.teams[side], b = this.ball;
      if (!tm || !b) return r;
      const cx = FLv / 2, cy = FWv / 2;
      let taker = null, md = Infinity;
      for (const p of (tm.players || [])) {
        if (!p || p.red || p.isGK) continue;
        const d = dd(num(p.x), num(p.y), cx, cy);
        if (d < md) { md = d; taker = p; }
      }
      if (!taker) return r;
      /* quem o nucleo tinha eleito volta a caminhar para casa */
      const antigo = b.owner;
      if (antigo && antigo !== taker && antigo.__spTarget) {
        antigo.__spTarget = { x: cl(num(antigo.dhx, antigo.hx), 1, FLv - 1),
                              y: cl(num(antigo.dhy, antigo.hy), 1, FWv - 1) };
      }
      b.owner = taker; b.lastTouch = taker;
      b.traveling = false; b.target = null; b.receiver = null;
      b.x = cx; b.y = cy; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0;
      taker.__spTarget = { x: cx, y: cy };
      this.dead = Math.max(num(this.dead), Math.min(TETO_SAIDA, .5 + md / (num(taker.maxSpd, 7) * WALK)));
      pinar(this, taker, cx, cy, TETO_SAIDA + .4, false);
    } catch (_) {}
    return r;
  };
}

/* ------------------------------------------------------------- os passos */
function pinoDoPasso(sim) {
  const pin = sim.__r99Pino;
  if (!pin) return;
  const t = pin.taker, dead = num(sim.dead);
  if (!t || t.red || num(sim.t) > pin.ate || dead <= 0 ||
      (pin.exige && !sim.pendingRestart) ||
      (pin.pr && sim.pendingRestart !== pin.pr)) { sim.__r99Pino = null; return; }
  const d = dd(num(t.x), num(t.y), pin.x, pin.y);
  if (d > RAIO_PINO) t.__spTarget = { x: pin.x, y: pin.y };
  /* dead cai ate <= 0,05 e no quadro seguinte o reinicio dispara. Enquanto
     o batedor nao chegou, devolve a pausa -- mesma tecnica de :21610. */
  if (dead <= .05 && d > RAIO_ENTREGA) sim.dead = .12;
}

/* T4 · o pino do batedor de bola parada, sobre a marca que a R18.35 ja cria */
function pinoDaBolaParada(sim) {
  const w = sim.__cdsTakerWait;
  if (!w || !w.taker || w.taker.red || !(num(sim.dead) > 0)) return;
  if (dd(num(w.taker.x), num(w.taker.y), num(w.x), num(w.y)) > RAIO_PINO) {
    w.taker.__spTarget = { x: num(w.x), y: num(w.y) };
  }
}

/* B1 · o papel de bola parada morre com o lance */
function papelDoPasso(sim, dt) {
  if (num(sim.dead) > 0) { sim.__r99Rolando = 0; return; }
  sim.__r99Rolando = num(sim.__r99Rolando) + num(dt, 1 / 30);
  if (sim.__r99Rolando < PAPEL_VIVO) return;
  const teams = sim.teams || [];
  for (let i = 0; i < teams.length; i++) {
    const pl = teams[i].players || [];
    for (let j = 0; j < pl.length; j++) {
      const p = pl[j];
      if (!p || !p._setPieceRole) continue;
      if (num(p._setPieceDeliveryUntil) > num(sim.t)) continue;   // ainda entregando
      p._setPieceRole = null;
    }
  }
}

/* T3 · o orcamento de passo. So na bola morta, so quando o excesso e pequeno:
   acima de SALTO_ADMIN e recolocacao administrativa (troca de campo, formacao
   inicial), que tem dono e nao se toca aqui. */
function orcamento(sim, snap, dt) {
  const passo = Math.max(1 / 240, Math.min(.15, num(dt, 1 / 30)));
  for (let i = 0; i < snap.length; i++) {
    const p = snap[i][0], x0 = snap[i][1], y0 = snap[i][2];
    if (!p || p.red) continue;
    let dx = num(p.x) - x0, dy = num(p.y) - y0, d = Math.hypot(dx, dy);
    const teto = Math.max(.20, num(p.maxSpd, 7) * passo * 1.18 + .12);

    /* T7 · A VELOCIDADE PRECISA CONTAR A MESMA HISTORIA QUE A POSICAO.
       Varias camadas de bola parada escrevem x/y e nao tocam em vx/vy. O motor
       le moving por (vx^2+vy^2) > 4 (:4909) e a apresentacao desenha o
       jogador PARADO enquanto ele desliza pelo gramado -- o "meio bugadinho"
       que se ve na hora da falta. Medidos 3.215 quadros assim em 6 partidas,
       ate 14 jogadores ao mesmo tempo, com erro de ate 15,01 m/s.
       A regra e a MESMA que commitMovement (:16897) ja usa: a velocidade e o
       deslocamento dividido pelo passo, saturada no teto do jogador (:16902). */
    if (d > teto + FOLGA_PASSO && d <= SALTO_ADMIN) {
      const q = teto / d;
      p.x = x0 + dx * q; p.y = y0 + dy * q;
      dx *= q; dy *= q; d = teto;
    } else if (d > SALTO_ADMIN) {
      continue;                       // recolocacao administrativa: nao se toca
    }
    const vAtual = Math.hypot(num(p.vx), num(p.vy)), vReal = d / passo;
    if (Math.abs(vAtual - vReal) <= .5) continue;
    /* A velocidade derivada tem a mesma armadilha que a R18.40 achou em
       :16898: a folga aditiva do teto (+0,12 m) dividida por dt vira 3,6 m/s
       de brinde, e um jogador de 7 m/s aparecia a 11,9. Satura no teto dele,
       exatamente como :16902 ja faz. */
    let vx = (p.x - x0) / passo, vy = (p.y - y0) / passo;
    const vt = num(p.maxSpd, 7) * 1.05, vm = Math.hypot(vx, vy);
    if (vm > vt && vm > 0) { vx = vx / vm * vt; vy = vy / vm * vt; }
    p.vx = vx; p.vy = vy;
  }
}

const oldStep = P.step;
P.step = function (dt) {
  const snap = [], teams = this.teams || [];
  for (let i = 0; i < teams.length; i++) {
    const pl = teams[i].players || [];
    for (let j = 0; j < pl.length; j++) {
      const p = pl[j];
      if (p && !p.red) snap.push([p, num(p.x), num(p.y)]);
    }
  }
  const deadAntes = num(this.dead) > 0;
  const r = oldStep.apply(this, arguments);
  try { pinoDoPasso(this); } catch (_) {}
  try { pinoDaBolaParada(this); } catch (_) {}
  try { papelDoPasso(this, dt); } catch (_) {}
  try { if (deadAntes && num(this.dead) > 0) orcamento(this, snap, dt); } catch (_) {}
  return r;
};

root.CDS_R1899 = Object.freeze({ version: 'R18.99', baseline: 'R18.99-CANDIDATA-v3',
  feature: 'ANTI_TELEPORT_AND_RESTART_LAW',
  fixes: Object.freeze(['T1_WALL_WALKS', 'T2_WALK_THRESHOLD', 'T3_STEP_BUDGET',
                        'T4_TAKER_PIN', 'T5_GOAL_KICK_SPOT', 'T6_KICKOFF_TAKER',
                        'B1_SET_PIECE_ROLE_EXPIRY']),
  rngAdded: false, xgChange: false });
root.CDS_BUILD_ID = 'R19.00'; root.CDS_VERSION = '5.80.0-R19.00';
try { document.title = 'Copa dos Sonhos — R19.00'; } catch (_) {}
})(typeof window!=='undefined'?window:globalThis);
