
(function(root){
'use strict';
/* §R19.04 · O CORTE QUE SAI.
   Mesmo desenho da falta natural: causas visiveis, portao multiplicativo.
     perto   distancia do defensor a PROPRIA linha de fundo (portao)
     press   distancia do adversario mais proximo
     tipo    cabeceio e o mais descontrolado; bote vem depois
   A bola SAI VOANDO por `_deflectTo`, que nao faz clamp; a checagem de linha
   de `:17148` chama `_ballOut` sozinha quando ela cruza. `lastTouch` fica no
   defensor, entao o proprio motor marca ESCANTEIO. */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__R1904__) return;
const P = M.prototype; P.__R1904__ = true;

const ESCALA = 1.050;
const ALCANCE = 26.0;   // m da propria linha em que o corte ainda pode sair
const R_PRESS = 4.5;    // m -- alem disto nao ha pressao
const PESO = { header: 1.00, poke: 0.85, clear: 0.55 };

function num(v, d) { return (typeof v === "number" && isFinite(v)) ? v : (d || 0); }
function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }

P._r19ClearOut = function (def, tipo) {
  try {
    if (!def || def.red || !this.teams) return false;
    const tm = this.teams[def.team];
    const g = tm && tm.goal, og = tm && tm.oppGoal;
    if (!g || !og || !this.ball) return false;
    /* FL/FW nao existem fora do escopo do motor: derivam dos dois gols */
    const FLv = Math.max(num(g.x), num(og.x)), FWv = num(g.y) * 2;
    if (!(FLv > 50) || !(FWv > 30)) return false;

    const dFundo = Math.abs(num(def.x) - num(g.x));
    const perto = cl((ALCANCE - dFundo) / ALCANCE, 0, 1);
    if (perto <= 0) return false;

    let dAdv = 1e9;
    const adv = this.teams[1 - def.team];
    for (const p of (adv && adv.players) || []) {
      if (!p || p.red) continue;
      const d = Math.hypot(num(p.x) - num(def.x), num(p.y) - num(def.y));
      if (d < dAdv) dAdv = d;
    }
    const press = cl((R_PRESS - dAdv) / R_PRESS, 0, 1);

    const peso = PESO[tipo] || 0.6;
    const p = cl(ESCALA * peso * perto * (0.42 + 0.58 * press), 0, 0.80);
    if (!(typeof root.chance === "function" ? root.chance(p) : Math.random() < p)) return false;

    /* por onde ela sai: a linha mais perto, com vies para a de fundo quando o
       defensor esta dentro da area. */
    const dirFora = num(g.x) < FLv / 2 ? -1 : 1;
    const dLado = Math.min(num(def.y), FWv - num(def.y));
    const naArea = dFundo <= 17 && Math.abs(num(def.y) - FWv / 2) <= 21;
    const R = typeof root.R === "function" ? root.R : function (a, b) { return (a + b) / 2; };
    let alvoX, alvoY;
    if (naArea || dFundo <= dLado) {
      alvoX = num(g.x) + dirFora * 2.8;
      alvoY = cl(num(def.y) + R(-6, 6), 1.5, FWv - 1.5);
    } else {
      alvoY = num(def.y) < FWv / 2 ? -2.6 : FWv + 2.6;
      alvoX = cl(num(def.x) + dirFora * R(0, 4), 2, FLv - 2);
    }
    const b = this.ball;
    b.owner = null; b.lastTouch = def;
    if (typeof this._deflectTo !== "function") return false;
    this._deflectTo(alvoX, alvoY, 10.5);
    this.__r1904 = (this.__r1904 || 0) + 1;
    if (typeof this._emit === "function") this._emit("clear_out", { by: def, tipo: tipo, p: p });
    return true;
  } catch (_) { return false; }
};

P.getR1904 = function () { return { cortesQueSairam: num(this.__r1904) }; };
root.CDS_R1904 = Object.freeze({ version: "R19.04", feature: "DEFENSIVE_CLEARANCE_GOES_OUT",
  escala: ESCALA, alcance: ALCANCE });
root.CDS_BUILD_ID = 'R19.04'; root.CDS_VERSION = '5.84.0-R19.04';
try { document.title = 'Copa dos Sonhos — R19.04'; } catch (_) {}
})(typeof window!=='undefined'?window:globalThis);
