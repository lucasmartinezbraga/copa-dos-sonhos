/* D08 · A LARGURA DO FLANCO — o time ocupa a linha lateral
   ===========================================================================
   O QUE ESTA CAMADA CONSERTA

   Medido em 24 partidas pareadas (reports/D08-a-bola-nao-vai-na-linha.md):

       tempo de bola viva a mais de 17 m de qualquer lateral ...... 73,8%
       distancia media da BOLA ate a lateral mais proxima ........ 22,48 m
       distancia media dos JOGADORES de linha .................... 23,87 m
       o MAIS ABERTO dos 20 num quadro qualquer ..................  8,00 m
       laterais por partida ...................... 15,79  (futebol real 33-48)

   No futebol de elite ha quase sempre alguem colado na linha. Aqui o jogador
   mais aberto de TODO o campo esta a 8 m dela, e o campo tem duas faixas
   mortas — da para ver nas fotos de tools/fisica/tela/olhar.

   POR QUE MEXER NO ALVO, E NAO NO CAMINHO

   `tools/fisica/ramo-d08c.js` decompos a cadeia do y em 668.493 amostras dos
   oito papeis de flanco:

       alvo que o _attackTarget pede ......... 10,43 m da lateral
       alvo que chega ao _integrate .......... 10,53 m   (+0,10)
       posicao depois do quadro .............. 13,02 m
       andou no quadro .......................  0,06 m

   A suavizacao de reacao e a separacao mexem 0,39 m em media, com puxao
   liquido para o miolo de ~0,1 m: a cadeia e TRANSPARENTE. O corpo assenta
   ~2,5 m mais para dentro do que o alvo porque persegue um alvo que se move
   todo quadro — atraso, nao desvio.

   Conclusao: nao ha nada no caminho para consertar. **O alvo ja nasce em
   10,43 m**, e e ele o teto. Para o corpo assentar a 7-8 m da linha, o alvo
   precisa pedir ~5 m.

   O QUE ELA FAZ

   Com a bola no pe do time e no campo de ataque, o alvo lateral dos papeis de
   flanco e puxado em direcao a SUA PROPRIA lateral. Aditiva e unidirecional:
   so abre, nunca fecha. Quem ja esta mais aberto que o alvo desta camada nao e
   tocado.

   NAO CONSOME RNG — a bateria e pareada por semente (armadilha B6).

   ORDEM: a ultima. Precisa da palavra final sobre `_attackTarget`; as camadas
   17, 36, 43 e 60 tambem o sobrescrevem e todas estao VIVAS.

   CUIDADO PARA QUEM FOR MEXER: a camada 91 do par do D35 (o "ombro", que foi
   revertida) valia so para ST/CF e mexia em X. Ela nunca testou largura. Este
   e o primeiro teste da alavanca do D08. */
(function (root) {
  'use strict';
  var M = root && root.MatchSim;
  if (!M || !M.prototype || M.prototype.__D08_LARGURA__) return;
  if (typeof M.prototype._attackTarget !== 'function') return;
  var P = M.prototype;
  P.__D08_LARGURA__ = true;

  var VERSION = '5.86.0-D08';
  var _FL = (typeof FL === 'number' && FL > 0) ? FL : 105;
  var _FW = (typeof FW === 'number' && FW > 0) ? FW : 68;

  var T = (root && root.CDS_D08_TUNE) || {};
  var num = function (v, d) { return Number.isFinite(v) ? v : d; };

  /* Papeis que devem dar largura. LB/RB/LWB/RWB sobem pela linha; LW/RW/LM/RM
     seguram a faixa. CB, CM, CDM, CAM e ST ficam de fora por construcao. */
  var FLANCO = {};
  String(T.papeis || 'LW,RW,LM,RM,LWB,RWB,LB,RB').split(',').forEach(function (k) {
    k = k.trim(); if (k) FLANCO[k] = 1;
  });

  var MARGEM = num(T.margem, 5.0);   // m da lateral que o ALVO passa a pedir
  var SUAVE = num(T.suave, 0.60);    // fracao do que falta, por quadro
  var PROG_MIN = num(T.progMin, 0.45);
  var LADO_MIN = num(T.ladoMin, 3.0); // quem esta a menos disto do meio nao tem lado

  function fin(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  var A = { chamadas: 0, abertos: 0, ganhoSoma: 0, ganhoN: 0 };

  var oldAtk = P._attackTarget;
  P._attackTarget = function (tm, p, b) {
    var out = oldAtk.apply(this, arguments);
    try {
      if (!out || !tm || !p || p.red || p.isGK) return out;
      if (!FLANCO[p.slotPos] || p._setPieceRole) return out;
      if (this.poss !== tm.side) return out;
      if (fin(this.dead, 0) > 0.04 || this.pendingRestart || this.waiting) return out;
      if (b && b.owner === p) return out;          // quem conduz nao e puxado
      if (p._breaking || p._burst) return out;      // corrida propria manda

      var dir = tm.attackDir;
      var ballProg = dir > 0 ? fin(b && b.x, _FL / 2) : _FL - fin(b && b.x, _FL / 2);
      if (ballProg < _FL * PROG_MIN) return out;

      /* O lado e o da CASA do jogador, nao o da posicao do momento: senao um
         ponta que cortou para dentro seria empurrado para a lateral errada. */
      var hy = fin(p.hy, fin(p.dhy, _FW / 2));
      if (Math.abs(hy - _FW / 2) < LADO_MIN) return out;
      var paraCima = hy < _FW / 2;
      var alvoY = paraCima ? MARGEM : _FW - MARGEM;

      var ty = fin(out[1], p.y);
      A.chamadas++;
      /* ADITIVA E UNIDIRECIONAL: so abre. Quem ja esta mais aberto que o alvo
         desta camada segue intocado. */
      if (paraCima ? (ty <= alvoY) : (ty >= alvoY)) return out;

      var novo = ty + (alvoY - ty) * SUAVE;
      A.abertos++; A.ganhoSoma += Math.abs(novo - ty); A.ganhoN++;
      return [out[0], novo];
    } catch (_) { return out; }
  };

  P.getD08Audit = function () {
    return { version: VERSION, chamadas: A.chamadas, abertos: A.abertos,
      ganhoMedio_m: A.ganhoN ? A.ganhoSoma / A.ganhoN : 0,
      parametros: { margem: MARGEM, suave: SUAVE, progMin: PROG_MIN,
        ladoMin: LADO_MIN, papeis: Object.keys(FLANCO) } };
  };

  try {
    root.CDS_D08 = Object.freeze({ version: VERSION, label: 'LARGURA DO FLANCO',
      note: 'O alvo lateral dos papeis de flanco nascia em 10,43 m da linha e o corpo assentava em 13,02. A cadeia do y e transparente (0,39 m): o teto e o ALVO.',
      rngUsed: false, teleport: false, aditivo: true, unidirecional: 'so abre' });
    root.CDS_BUILD_ID = 'D08'; root.CDS_VERSION = VERSION;
    if (root.document) root.document.title = 'Copa dos Sonhos — D08';
  } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
