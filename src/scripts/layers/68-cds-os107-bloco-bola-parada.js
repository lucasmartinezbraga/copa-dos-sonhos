
(function(root){
'use strict';
/* §OS-107 · o time vai para o lance -- e fica la ate a cobranca.

   MEDIDO (diag_os107, 12 partidas, R18.96):
     escanteio ... 100% dos postos sao ALCANCADOS, 28,8% ainda estao ocupados
                   no reinicio. A coreografia existe e e desfeita pela IA
                   tatica normal nos ~3 s que sobram de bola morta, porque
                   :18287 limpa `__spTarget` no snap de chegada.
     falta cruzada . os tres alvos sao TELEPORTADOS (247 saltos acima de 3 m,
                   maximo 70,40 m): a R15 envolve _setCorner mas nao _freeKick.
                   E o time que defende nao recebe posto nenhum -- 0,095
                   defensor dentro da propria area no apito.

   Esta camada nao escreve posicao durante o jogo: ela transforma escrita em
   alvo caminhado (mesmo desenho da R15, :18190) e mantem o alvo ativo enquanto
   a bola esta morta (mesmo desenho do pino da OS-100, :21556). */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__OS107__) return;
const P = M.prototype; P.__OS107__ = true;
const FLv = Number(root.FL) || 105, FWv = Number(root.FW) || 68;

const WALK = 0.92;        // mesma fracao de maxSpd da R15
const VEL  = 6.5;         // mesma referencia de velocidade da R15
const TETO_FALTA = 5.00;   // mesmo teto que :21556 ja usa no escanteio
const MIN_MOVE = 0.6;     /* §R18.99 · acompanha a R15: ver :18181 */
const FOLGA = 0.9;        // raio em que ele pode se mexer a vontade
const SOLTO = 3.0;        // alem disto foi deslocado de verdade: volta andando
const VEL_ESPERA = 1.2;   // m/s -- abaixo do limiar de `moving` (:4910)
const SOLTA_EM = 0.40;   // s de `dead` em que a contencao SOLTA
const QUADROS_MAX = 600;  // guarda A2
const DEFENSORES_NA_AREA = 5;

function num(v, d) { return (typeof v === "number" && isFinite(v)) ? v : (d || 0); }
function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }
function dd(a, b, c, d) { return Math.hypot(a - c, b - d); }

function foto(sim) {
  const m = new Map(), teams = sim.teams || [];
  for (let i = 0; i < teams.length; i++) {
    const pl = teams[i].players || [];
    for (let j = 0; j < pl.length; j++) {
      const p = pl[j];
      if (p && !p.red) m.set(p, [num(p.x), num(p.y)]);
    }
  }
  return m;
}

/* E2 · converte escrita direta de posicao em alvo a ser percorrido, e alonga
   `dead` na medida de quem ficou mais longe. Copia deliberada de :18190 -- a
   R15 faz isto para o escanteio e nunca foi estendida a falta. */
function adiar(sim, snap, teto) {
  let longe = 0;
  snap.forEach(function (xy, p) {
    if (!p || p.red) return;
    const tx = num(p.x), ty = num(p.y);
    const d = dd(tx, ty, xy[0], xy[1]);
    if (d <= MIN_MOVE) return;
    p.__spTarget = { x: tx, y: ty };
    p.x = xy[0]; p.y = xy[1];
    p.vx = 0; p.vy = 0;
    if (d > longe) longe = d;
  });
  if (longe > 0) {
    const preciso = 0.6 + longe / (VEL * WALK);
    sim.dead = Math.max(num(sim.dead), Math.min(teto, preciso));
  }
  return longe;
}

/* E1 · registra os postos vivos para o pino. O cobrador fica de fora
   (armadilha A3): ele tem a propria maquina em :21556. */
function fixar(sim) {
  const postos = [], teams = sim.teams || [];
  for (let i = 0; i < teams.length; i++) {
    const pl = teams[i].players || [];
    for (let j = 0; j < pl.length; j++) {
      const p = pl[j];
      if (!p || p.red || !p.__spTarget) continue;
      if (p._setPieceRole === "taker") continue;
      postos.push({ p: p, x: num(p.__spTarget.x), y: num(p.__spTarget.y) });
    }
  }
  sim.__os107 = postos.length ? { postos: postos, quadros: 0 } : null;
}

/* E3 · a defesa vai para a area na falta cruzada. Cinco postos entre 5,0 e
   11,4 m do proprio gol, abertos ate 11,5 m em y -- todos dentro da grande
   area. Cinco e o numero que o escanteio ja poe la (medido: 5,078), entao a
   falta cruzada passa a ter a MESMA populacao de area de um lance que ja
   passou pelos gates. Escreve posicao de proposito: `adiar` roda logo depois
   e transforma tudo isto em caminhada. */
function montarDefesa(sim, timeQueAtaca) {
  if (DEFENSORES_NA_AREA <= 0) return;
  const dt = sim.teams && sim.teams[1 - timeQueAtaca];
  if (!dt || !dt.players) return;
  const g = dt.goal;
  if (!g || !isFinite(num(g.x, NaN))) return;
  const dir = num(dt.attackDir, 1) >= 0 ? 1 : -1;
  const livres = dt.players.filter(function (p) {
    return p && !p.red && !p.isGK && !p._setPieceRole;
  }).sort(function (a, b) {
    return dd(a.x, a.y, g.x, g.y) - dd(b.x, b.y, g.x, g.y);
  });
  const n = Math.min(DEFENSORES_NA_AREA, livres.length);
  const marcados = [];
  for (let i = 0; i < n; i++) {
    const p = livres[i];
    const lado = (i % 2) ? 1 : -1;
    const faixa = 2.5 + Math.floor(i / 2) * 4.5;
    p.x = cl(num(g.x) + dir * (5.0 + i * 1.6), 2, FLv - 2);
    p.y = cl(num(g.y) + lado * faixa, 3, FWv - 3);
    p.vx = 0; p.vy = 0;
    p._setPieceRole = "zone";
    marcados.push(p);
  }
  /* O papel PRECISA ser devolvido no reinicio. Medido (diag_os109): sem isto
     ele sobrevive 4,433 s de mediana e ate 183,1 s de tempo vivo, porque
     `clearCorner13` (:17074) so roda em gol/erro/trave, tiro de meta e na
     expiracao da CADEIA DE ESCANTEIO -- e falta cruzada nao abre cadeia
     nenhuma. Enquanto ele fica pendurado, :21841 e :21867 pulam esses cinco
     jogadores, que somem das camadas de movimento e ataque no jogo corrido.
     O nucleo nao marca ninguem na falta cruzada; devolver no reinicio e o
     comportamento mais proximo da base. */
  sim.__os107Zona = marcados;
}

/* ---------------------------------------------------------------- escanteio */
const oldCorner = P._setCorner;
if (typeof oldCorner === "function") {
  P._setCorner = function () {
    const r = oldCorner.apply(this, arguments);
    try { fixar(this); } catch (_) {}
    return r;
  };
}

/* ------------------------------------------------------------ falta cruzada */
const oldFK = P._freeKick;
if (true && typeof oldFK === "function") {
  P._freeKick = function (team, x, y, input) {
    const s = this.stats && this.stats[team];
    const antes = s ? (s.freeKickCrossed | 0) : null;
    const snap = (team === 0 || team === 1) ? foto(this) : null;
    const r = oldFK.apply(this, arguments);
    try {
      if (snap && s && antes !== null && (s.freeKickCrossed | 0) > antes) {
        montarDefesa(this, team);      // E3
        adiar(this, snap, TETO_FALTA); // E2
        fixar(this);                   // E1
      }
    } catch (_) {}
    return r;
  };
}

/* ------------------------------------------------------------------- o pino */
/* Roda no fim do passo, depois da caminhada da R15 (:18270) e depois do
   movimento tatico: enquanto a bola estiver morta, quem foi armado continua
   sendo puxado para o posto. Sem isto ele chega e vai embora -- medido, 100%
   chegam e 28,8% ainda estao la na cobranca. */
const oldStep = P.step;
const PINO_LIGADO = true;
P.step = function (dt) {
  const r = oldStep.apply(this, arguments);
  const step = Math.max(1 / 240, Math.min(0.15, num(dt, 1 / 30)));
  try {
    /* devolve o papel de zona no instante em que a bola volta a rolar */
    if (this.__os107Zona && !(num(this.dead) > 0)) {
      const z = this.__os107Zona;
      for (let i = 0; i < z.length; i++) {
        if (z[i] && z[i]._setPieceRole === "zone") z[i]._setPieceRole = null;
      }
      this.__os107Zona = null;
    }
    const st = PINO_LIGADO ? this.__os107 : null;
    if (st) {
      st.quadros++;
      if (!(num(this.dead) > 0) || st.quadros > QUADROS_MAX) {
        this.__os107 = null;
      } else {
        for (let i = 0; i < st.postos.length; i++) {
          const q = st.postos[i], p = q.p;
          if (!p || p.red) continue;
          const d = dd(p.x, p.y, q.x, q.y);
          /* §OS-111b · nos ultimos SOLTA_EM segundos ninguem e contido: o time
             entra no lance com velocidade de verdade. */
          if (num(this.dead) <= SOLTA_EM) continue;
          if (d > SOLTO) {
            /* deslocado de verdade: volta caminhando, com a maquina da R15 */
            if (!p.__spTarget) p.__spTarget = { x: q.x, y: q.y };
            continue;
          }
          /* §OS-111 · ele esta NO posto, entao ele ESPERA. Nada de correr de
             volta a 6 m/s por causa de 45 cm -- isso e o tremor que o dono viu.
             Aqui ele so nao consegue escapar da folga, e a velocidade exibida
             fica abaixo do limiar de `moving` para ele ler como parado. */
          if (d > FOLGA) {
            /* §OS-115 · TELEPORTE MEU. A primeira contencao fazia
                 p.x = q.x + (p.x - q.x) * (FOLGA / d)
               que SNAPA o jogador de ate SOLTO (3,0 m) para FOLGA (0,9 m) num
               unico quadro -- salto de ate 2,1 m. Medido: saltos acima de
               1,5 m por partida passaram de 64,67 para 173,17. A correcao
               anda de volta com velocidade limitada, em vez de saltar. */
            const passo = Math.min(d - FOLGA, VEL_ESPERA * step);
            p.x -= (p.x - q.x) / d * passo;
            p.y -= (p.y - q.y) / d * passo;
          }
          const v = Math.hypot(num(p.vx), num(p.vy));
          if (v > VEL_ESPERA) {
            p.vx = num(p.vx) / v * VEL_ESPERA;
            p.vy = num(p.vy) / v * VEL_ESPERA;
          }
        }
      }
    }
  } catch (_) {}
  return r;
};

root.CDS_OS107 = Object.freeze({ version: "OS-107", feature: "SET_PIECE_BLOCK_WALKS_AND_HOLDS" });
})(typeof window!=='undefined'?window:globalThis);
