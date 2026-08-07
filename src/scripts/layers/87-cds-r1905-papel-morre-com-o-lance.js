
(function(root){
'use strict';
/* §R19.05 · O PAPEL DE BOLA PARADA MORRE COM O LANCE.
   `_setPieceRole` e portao em :21841 e :21867: quem o carrega some das
   corridas na area e da progressao ofensiva. Medidos 8.058 jogador-quadros
   com ele pendurado enquanto a bola rola.
   Ele nao pode morrer no instante do reinicio -- a rotina de escanteio ainda
   usa os papeis durante o voo da bola. Morre quando a bola voltou a rolar E a
   janela do lance passou. */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__R1905__) return;
const P = M.prototype; P.__R1905__ = true;
const JANELA = 3.00;
function num(v, d) { return (typeof v === "number" && isFinite(v)) ? v : (d || 0); }

const oldStep = P.step;
P.step = function (dt) {
  const r = oldStep.apply(this, arguments);
  try {
    if (num(this.dead) > 0) { this.__r1905Vivo = null; return r; }
    /* a bola voltou a rolar: marca o instante e espera a janela do lance */
    if (this.__r1905Vivo == null) { this.__r1905Vivo = num(this.t); return r; }
    if (num(this.t) - this.__r1905Vivo < JANELA) return r;
    for (const tm of this.teams || []) {
      for (const p of (tm && tm.players) || []) {
        if (p && p._setPieceRole) { p._setPieceRole = null; this.__r1905N = num(this.__r1905N) + 1; }
      }
    }
  } catch (_) {}
  return r;
};

P.getR1905 = function () { return { papeisDevolvidos: num(this.__r1905N) }; };
root.CDS_R1905 = Object.freeze({ version: "R19.05", feature: "MANAGER_RUNS_AND_ROLE_DIES", janela: JANELA });
root.CDS_BUILD_ID = 'R19.08'; root.CDS_VERSION = '5.88.0-R19.08';
root.CDS_R1908 = Object.freeze({ version: 'R19.08', feature: 'FINAL_WHISTLE_HAS_A_LIMIT' });
root.CDS_R1907 = Object.freeze({ version: 'R19.07', feature: 'FATIGUE_ACTION_PER_PLAYER' });
root.CDS_R1906 = Object.freeze({ version: 'R19.06', feature: 'EXHAUSTED_PLAYER_COMES_OFF',
  pisoIndividual: 46, tetoDeSubs: 5, espacoMin: 7 });
try { document.title = 'Copa dos Sonhos — R19.08'; } catch (_) {}
})(typeof window!=='undefined'?window:globalThis);
