/* D35 · PAR OBRIGATORIO — O CENTROAVANTE JOGA NO OMBRO DO ULTIMO DEFENSOR
   ===========================================================================
   Esta camada NAO existe sozinha. Ela e a metade legitima de um par: a outra e
   o conserto da marca de arrancada na camada 17. Separadas, as duas reprovam.

   O QUE ACONTECEU
   ---------------
   A camada 17 armava o cobrador do lateral com `_breaking = {throwInDuty:true}`,
   sem `t` e sem `dir`. O motor apaga a marca por `t -= dt; if (t <= 0)`, e
   `undefined - dt` e NaN — `NaN <= 0` e FALSO. A marca nunca saia. Seis dos
   vinte jogadores de linha terminavam a partida marcados.

   Entre os oito efeitos permanentes disso, um sustentava o placar inteiro:

       // _attackTarget:3346
       if (!p._breaking && !(p._burst && p._burst.kind === 'tabela') &&
           (line === 'FWD' || p === tm._thirdMan)) {
         const onsideCap = Math.max(ballProg - 0.25, this._offsideLine(tm.side) - 0.25);
         tProg = Math.min(tProg, onsideCap);
       }

   `!p._breaking` — os envenenados ficavam ISENTOS do teto de impedimento, para
   sempre. Eram eles que atacavam as costas da linha, e era dai que saiam os
   impedimentos, os chutes, os escanteios e os gols.

   Consertar so a marca (300 partidas pareadas, reports/d35-tentativa-reprovada.json):

       offsides      5,167 -> 1,043      shots    23,710 -> 19,990
       goals         2,877 -> 2,380      corners  11,337 ->  9,287
       zeroZeroRate  0,080 -> 0,167 (4,03 SE)     design 12/13 -> 9/13

   O jogo saiu de "certo por acidente" para "errado com o codigo limpo": 1,04
   impedimento por partida, contra 4 a 8 do futebol de elite.

   POR QUE A ARRANCADA QUE JA EXISTE NAO BASTOU
   --------------------------------------------
   `tools/fisica/ramo-d35b.js`, 16 partidas sobre o build ja consertado:

       arrancadas de ruptura (`run_break`) ....... 32,94 por partida
       atacante ATRAS da linha de impedimento .... 91,1% do tempo com a bola
       folga media ate a linha ................... -12,69 m

   A maquina legitima de `:3191` dispara 33 vezes por partida — ela nao esta
   morta. Ela e INUTIL: a arrancada dura 1,4 s e levanta o teto, mas o
   centroavante esta a 12,69 m da linha. A 7 m/s ele cobre 10 m e nao chega.
   **A arrancada nao falha por frequencia, falha por distancia inicial.**

   O QUE ESTA CAMADA FAZ
   ---------------------
   Com a bola no pe do time e no campo de ataque, o homem de referencia
   posiciona-se no OMBRO do penultimo defensor em vez de 12,7 m atras dele. E o
   movimento mais elementar do centroavante, e o motor nao o tinha: o unico modo
   de um atacante deixar de ficar preso ao teto era estar envenenado.

   Ela nao poe ninguem em impedimento. A margem MINIMA e 0,9 m AQUEM da linha —
   quem cruza e a arrancada de `:3191`, ou a linha que sobe. O impedimento volta
   a ser consequencia de um duelo de tempo entre o atacante e a defesa, que e o
   que ele e no futebol.

   Quem tem `movimentacao` melhor cola mais na linha. Quem tem menos fica mais
   longe e perde menos bolas para o bandeira.

   NAO CONSOME RNG. A bateria e pareada por semente; um `chance()` novo aqui
   desalinharia todas as partidas e a comparacao deixaria de ser pareada
   (armadilha B6).

   ORDEM: 91, a ultima. Ela precisa da palavra final sobre `_attackTarget` —
   as camadas 17, 36, 43 e 60 tambem o sobrescrevem e todas estao VIVAS. */
(function (root) {
  'use strict';
  var M = root && root.MatchSim;
  if (!M || !M.prototype || M.prototype.__D35_OMBRO__) return;
  if (typeof M.prototype._attackTarget !== 'function') return;
  var P = M.prototype;
  P.__D35_OMBRO__ = true;

  var VERSION = '5.85.0-D35par';
  var _FL = (typeof FL === 'number' && FL > 0) ? FL : 105;

  /* Somente o homem de referencia. Alargar isto para LW/RW/CAM foi tentado e
     nao entra nesta camada sem medicao propria: sao papeis com largura e
     profundidade diferentes, e o teto de impedimento nao e o que os prende. */
  var PONTA = { ST: 1, CF: 1 };

  /* varredura sem reconstruir o bundle — tools/fisica/calibrar.py */
  var T = (root && root.CDS_D35_TUNE) || {};
  var num = function (v, d) { return Number.isFinite(v) ? v : d; };

  var SUAVE = num(T.suave, 0.55);          // fracao do que falta, por quadro
  var MARGEM_RUIM = num(T.margemRuim, 4.2); // m aquem da linha, movimentacao 0
  var MARGEM_BOA = num(T.margemBoa, 1.1);  // m aquem da linha, movimentacao 100
  var PROG_MIN = num(T.progMin, 0.50);     // so a partir do meio-campo

  function fin(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var A = { chamadas: 0, elevados: 0, ganhoSoma: 0, ganhoN: 0, colados: 0 };

  var oldAtk = P._attackTarget;
  P._attackTarget = function (tm, p, b) {
    var out = oldAtk.apply(this, arguments);
    try {
      if (!out || !tm || !p || p.red || p.isGK) return out;
      if (!PONTA[p.slotPos] || p._setPieceRole) return out;
      /* so com a bola: sem posse o homem de referencia volta ao bloco, e quem
         manda nisso e `_defendTarget`, que esta camada nao toca */
      if (this.poss !== tm.side) return out;
      if (fin(this.dead, 0) > 0.04 || this.pendingRestart || this.waiting) return out;
      if (b && b.owner === p) return out;   // quem conduz nao corre nas costas
      /* uma arrancada em curso ja tem isencao do teto — nao interferir nela */
      if (p._breaking || (p._burst && p._burst.kind === 'tabela')) return out;

      var dir = tm.attackDir;
      var ballProg = dir > 0 ? fin(b && b.x, _FL / 2) : _FL - fin(b && b.x, _FL / 2);
      if (ballProg < _FL * PROG_MIN) return out;

      /* `_offsideLine` JA devolve PROGRESSO — ele mesmo aplica o attackDir.
         Converter de novo inverte a linha de um dos times; foi assim que a
         primeira passada da sonda mediu 46,8% alem da linha em vez de 1,4%. */
      var linha = _FL - 2;
      if (typeof this._offsideLine === 'function') linha = fin(this._offsideLine(tm.side), _FL - 2);

      var mov = 60;
      if (typeof root.facet === 'function') mov = fin(root.facet(p, 'offball'), 60);
      else if (typeof root.getAttr === 'function') mov = fin(root.getAttr(p, 'movimentacao'), 60);
      var margem = MARGEM_RUIM - cl(mov, 0, 100) / 100 * (MARGEM_RUIM - MARGEM_BOA);

      /* nunca alem da linha: quem cruza e a arrancada, ou a defesa subindo */
      var alvo = Math.min(linha - margem, _FL - 3.5);
      var atual = dir > 0 ? fin(out[0], p.x) : _FL - fin(out[0], p.x);
      A.chamadas++;
      if (!(alvo > atual)) return out;      // ADITIVO: so levanta, nunca recua

      var novo = atual + (alvo - atual) * SUAVE;
      A.elevados++; A.ganhoSoma += (novo - atual); A.ganhoN++;
      if (linha - novo <= margem + 0.6) A.colados++;
      return [dir > 0 ? novo : _FL - novo, out[1]];
    } catch (_) { return out; }
  };

  P.getD35OmbroAudit = function () {
    return { version: VERSION, chamadas: A.chamadas, elevados: A.elevados,
      coladosNaLinha: A.colados,
      ganhoMedio_m: A.ganhoN ? A.ganhoSoma / A.ganhoN : 0,
      parametros: { suave: SUAVE, margemRuim: MARGEM_RUIM, margemBoa: MARGEM_BOA, progMin: PROG_MIN } };
  };

  try {
    root.CDS_D35_PAR = Object.freeze({ version: VERSION,
      label: 'OMBRO DO ULTIMO DEFENSOR',
      par: 'camada 17 — conserto da marca de arrancada',
      note: 'O centroavante ficava a 12,69 m da linha de impedimento e a arrancada de 1,4 s nao cobria a distancia. Sem isto, consertar a marca derruba offsides de 5,167 para 1,043 e o placar de design de 12/13 para 9/13.',
      rngUsed: false, teleport: false, aditivo: true });
    root.CDS_BUILD_ID = 'D35.PAR'; root.CDS_VERSION = VERSION;
    if (root.document) root.document.title = 'Copa dos Sonhos — D35 par';
  } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
