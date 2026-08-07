
(function(root){
'use strict';
/* §OS-100 · o lateral e cobrado por quem caminhou ate a bola.

   MEDIDO, quadro a quadro, na build base sem patch: em 44 de 44 laterais um
   jogador recebe `__spTarget`, caminha em media 21,56 m e CHEGA ao ponto. A
   maquina de bola parada ja funciona.

   O defeito esta em :7180: `pendingRestart` ignora quem caminhou, re-elege
   pelo criterio de proximidade em `y` -- que nem e a distancia ao ponto -- e
   CRAVA esse outro jogador na bola. Medido: salto mediano de 4,475 m no quadro
   do reinicio, maximo 12,465 m, em 59% dos laterais. Um anda ate a bola, outro
   e teleportado para cima dela e a leva.

   A correcao nao cria selecao nova -- foi assim que a OS-93 falhou, criando uma
   terceira em competicao com as duas existentes. Ela apenas ENTREGA A BOLA A
   QUEM A MAQUINA JA ESCOLHEU. */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__OS100__) return;
const P = M.prototype; P.__OS100__ = true;
const FLv = Number(root.FL) || 105, FWv = Number(root.FW) || 68;
const RAIO = 2.0;   // ja esta no ponto?
function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }
function dd(a, b, c, d) { return Math.hypot(a - c, b - d); }

const oldOut = P._ballOut;
if (typeof oldOut !== "function") return;
P._ballOut = function () {
  const b = this.ball;
  const ehLateral = !(b.x <= 0 || b.x >= FLv);
  const sx = cl(Number(b.x), 1, FLv - 1), sy = cl(Number(b.y), 1, FWv - 1);
  const r = oldOut.apply(this, arguments);
  try {
    if (!ehLateral || typeof this.pendingRestart !== "function") return r;
    /* Quem a maquina de bola parada acabou de armar. `__spTarget` e limpo na
       chegada (:18259), entao ele PRECISA ser guardado agora. */
    let cobrador = null, melhor = Infinity;
    for (const tm of this.teams) {
      for (const p of tm.players) {
        if (!p || p.red || !p.__spTarget) continue;
        const d = dd(p.__spTarget.x, p.__spTarget.y, sx, sy);
        if (d < melhor) { melhor = d; cobrador = p; }
      }
    }
    if (!cobrador || melhor > 2.5) return r;   // ninguem foi armado para este ponto
    /* ELE CHEGA E VAI EMBORA. `__spTarget` e limpo no snap de chegada (:18259)
       e a partir dai a IA de movimento normal o puxa de volta para a posicao
       tatica: medido, no instante do reinicio ele esta a 5,04 m do ponto
       (mediana, p90 7,94), e so 18 de 64 estariam perto o bastante para receber.
       Re-armar o alvo a cada quadro de bola morta o mantem na bola. */
    this.__os100Pin = { taker: cobrador, x: sx, y: sy, until: Number(this.t) + 8 };
    const orig = this.pendingRestart, sim = this;
    this.pendingRestart = function () {
      try {
        if (cobrador && !cobrador.red && dd(cobrador.x, cobrador.y, sx, sy) <= RAIO) {
          const bb = sim.ball;
          bb.owner = null; bb.traveling = false;
          bb.x = sx; bb.y = sy; bb.z = 0; bb.vx = 0; bb.vy = 0; bb.vz = 0;
          cobrador.__spTarget = null; cobrador._setPieceRole = null;
          sim.__os100Pin = null;
          sim._giveBall(cobrador);
          if (sim.ball.owner) sim.ball.owner.settle = 0.5;
          return;
        }
      } catch (_) {}
      /* ninguem chegou: comportamento antigo, nenhum lance fica sem reinicio */
      sim.__os100Pin = null;
      return orig.call(sim);
    };
  } catch (_) {}
  return r;
};

/* O PINO. Roda depois do movimento coletivo, no fim do passo: enquanto a bola
   estiver morta, o cobrador continua sendo puxado para o ponto pela mesma
   maquina de bola parada que ja existe. Sem isto ele chega e vai embora. */
const oldStep = P.step;
P.step = function (dt) {
  const r = oldStep.apply(this, arguments);
  try {
    const pin = this.__os100Pin;
    if (pin) {
      const t = pin.taker;
      if (!t || t.red || !(this.dead > 0) || Number(this.t) > pin.until) this.__os100Pin = null;
      else if (dd(t.x, t.y, pin.x, pin.y) > 0.35) t.__spTarget = { x: pin.x, y: pin.y };
    }
  } catch (_) {}
  return r;
};
root.CDS_OS100 = Object.freeze({ version: "OS-100", feature: "THROWIN_DELIVERED_TO_WALKER" });
})(typeof window!=='undefined'?window:globalThis);
