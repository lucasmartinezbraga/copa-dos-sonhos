
(function(root){
'use strict';
/* §OS-90 · o goleiro se posiciona para a falta.

   Medido na R18.90, 58 cobrancas diretas: em 53 delas (91,4%) o goleiro ficava
   do MESMO lado da barreira, cobrindo o angulo que ela ja cobria e deixando o
   lado longo aberto. Do lado correto: 1 em 58. E a 6,88 m da linha, quando numa
   falta o goleiro real fica a 1,5-3 m.

   A causa nao e bug: `_goalkeeperTarget` (:7190) e escrito para JOGO CORRIDO,
   onde deslocar-se na direcao da bola (:7197, :7226) e o certo -- cobre o poste
   mais proximo de quem chuta. Numa falta COM BARREIRA isso se inverte, porque a
   barreira ja tomou esse lado (a OS-36 a arma sobre a linha bola -> poste mais
   proximo, :24842).

   Aqui o alvo so e sobrescrito dentro da janela marcada por `__os36Guard` e
   ENQUANTO A BOLA NAO VOOU. No quadro em que ela parte, o ramo de :7236 assume
   e leva o goleiro ao ponto de interceptacao -- se este override sobrevivesse a
   esse instante, o goleiro ficaria parado na postura e o contato falharia por
   ausencia, que e o defeito que a R18.40 corrigiu. */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__OS90__) return;
const P = M.prototype; P.__OS90__ = true;
const POSTE = 3.66;
const PROF = 2.2;      // metros da linha de gol
const ABERTURA = 1.8;  // meio caminho entre o centro do gol e o poste distante

const oGkT = P._goalkeeperTarget;
if (typeof oGkT !== "function") return;
P._goalkeeperTarget = function (tm, p, b, dt) {
  try {
    const g = this.__os36Guard;
    if (g && p && p.isGK && tm && tm.side === (1 - g.team) && b && !b.traveling) {
      const goal = tm.goal;
      if (goal && Number.isFinite(goal.x) && Number.isFinite(goal.y)) {
        /* lado CURTO = o poste mais proximo da bola, que a barreira cobre.
           O goleiro fica no oposto. */
        const curto = g.y < goal.y ? -1 : 1;
        const ty = goal.y - curto * ABERTURA;
        const tx = goal.x + (tm.attackDir || (goal.x > 52.5 ? -1 : 1)) * PROF;
        if (Number.isFinite(tx) && Number.isFinite(ty)) {
          p._gkAI = { x: tx, y: ty, wait: 0.08 };
          return [tx, ty];
        }
      }
    }
  } catch (_) {}
  return oGkT.apply(this, arguments);
};
root.CDS_OS90 = Object.freeze({ version: "OS-90", feature: "GK_FREEKICK_STANCE",
                                profundidade: PROF, abertura: ABERTURA });
})(typeof window!=='undefined'?window:globalThis);
