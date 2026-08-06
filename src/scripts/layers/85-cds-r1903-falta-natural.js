
(function(root){
'use strict';
/* §R19.03 · O RISCO DE FALTA, EM UM LUGAR SO.
   As duas rotinas de desafio (:16949 drible e :16954 pressao) chamam esta
   funcao. Todas as grandezas ja eram calculadas pelo motor; nenhuma delas era
   usada para decidir a falta.

     contato  portao MULTIPLICATIVO -- a 2,30 m vale zero e nao ha falta
     impacto  o quanto o defensor estava FECHANDO sobre o portador
     atraso   timingIQ da R18.13 (no drible, a diferenca do duelo)
     costas   o defensor vem por tras de quem corre com a bola
     descomp  compostura do defensor

   Medido na populacao de desafios (6 partidas): distancia mediana 1,32 m,
   fechamento mediano 1,39 m/s, 28% vindo por tras, velocidade do defensor
   4,51 m/s. */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__R1903__) return;
const P = M.prototype; P.__R1903__ = true;

const ESCALA   = 1.300;
const R_CONTATO = 2.30;   // m -- alem disto nao ha corpo a corpo
const R_CHEIO   = 0.70;   // m -- daqui para dentro o contato e total
const V_IMPACTO = 6.00;   // m/s de fechamento que satura o impacto
const TETO_FORA = 0.75, TETO_AREA = 0.22, AMORTECE_AREA = 0.45;

function num(v, d) { return (typeof v === "number" && isFinite(v)) ? v : (d || 0); }
function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }

P._r19FoulRisk = function (def, atk, nd, timingIQ, ownBox, gapDuelo) {
  try {
    if (!def || !atk) return null;
    const d = num(nd, Math.hypot(num(atk.x) - num(def.x), num(atk.y) - num(def.y)));
    const contato = cl((R_CONTATO - d) / (R_CONTATO - R_CHEIO), 0, 1);
    if (contato <= 0) return { p: 0, risco: 0, contato: 0 };

    /* impacto: componente da velocidade RELATIVA apontando para o portador */
    const dx = num(atk.x) - num(def.x), dy = num(atk.y) - num(def.y);
    const L = Math.max(0.01, Math.hypot(dx, dy));
    const fech = ((num(def.vx) - num(atk.vx)) * dx + (num(def.vy) - num(atk.vy)) * dy) / L;
    const impacto = cl(fech / V_IMPACTO, 0, 1);

    /* pelas costas: so conta se o portador esta de fato correndo */
    const ov = Math.hypot(num(atk.vx), num(atk.vy));
    const costas = ov > 1.0 && ((-dx) * num(atk.vx) + (-dy) * num(atk.vy)) / (L * ov) > 0.55 ? 1 : 0;

    /* atraso: no desarme vem do timingIQ; no drible, da diferenca do duelo */
    const atraso = (typeof gapDuelo === "number" && isFinite(gapDuelo))
      ? cl(gapDuelo, 0, 1)
      : cl((76 - num(timingIQ, 66)) / 26, 0, 1);

    const comp = (typeof root.getAttr === "function") ? num(root.getAttr(def, "compostura"), 70) : 70;
    const descomp = cl((98 - comp) / 46, 0, 1);

    const risco = contato * (0.34 * impacto + 0.26 * atraso + 0.22 * costas + 0.18 * descomp);
    const p = cl(ESCALA * risco * (ownBox ? AMORTECE_AREA : 1), 0, ownBox ? TETO_AREA : TETO_FORA);
    return { p: p, risco: risco, contato: contato, impacto: impacto, costas: costas, atraso: atraso };
  } catch (_) { return null; }
};

root.CDS_R1903 = Object.freeze({ version: "R19.03", feature: "NATURAL_FOUL_FROM_CONTACT",
  escala: ESCALA, raioContato: R_CONTATO });
root.CDS_BUILD_ID = 'R19.03'; root.CDS_VERSION = '5.83.0-R19.03';
try { document.title = 'Copa dos Sonhos — R19.03'; } catch (_) {}
})(typeof window!=='undefined'?window:globalThis);
