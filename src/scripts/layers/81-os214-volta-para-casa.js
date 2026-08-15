
(function (root) {
'use strict';
/* OS-214 · O TIME VOLTA PARA CASA ANTES DO PONTAPE
   ===========================================================================
   RELATO: "depois que rola o gol o jogo comeca do nada com os jogadores
   espalhados no campo".

   MEDIDO (tools/fisica/tela/validar-lances.js, 5 pontapes):
       G1  os dois times na propria metade     0 de 5
           pior invasao 31,5 m; 4,2 jogadores do lado errado, em media
       G2  time armado (<= 6 m do posto)       0 de 5
           distancia media ao posto 19,27 m; pior caso 69,1 m

   ------------------------------------------------------------------------
   A TENTATIVA ANTERIOR ERROU O ALVO, E O ERRO ENSINOU A RESPOSTA

   A OS-211 supos que faltava TEMPO: `_resetPositions` poe os 22 na formacao,
   a R15 converte isso em caminhada e fecha a janela em 2,2 s, e voltar da area
   adversaria sao 40-70 m. Abriu a janela na medida de quem estava mais longe.

   Reprovada duas vezes: a bateria caiu de 12/13 para 10/13 e -- decisivo --
   NAO CORRIGIU. G1 seguiu 0 de 4 e a distancia media ao posto foi de 19,27 m
   para 19,68 m. Mais tempo, mesmo resultado.

   Se dar tempo nao resolve, o que desfaz a volta para casa nao e o relogio: e
   o SISTEMA TATICO. Durante a bola morta ele roda a 100% (o `freeze` do nucleo
   e um degrau em `dead = 0.4`, e as camadas de espera o mantem desligado
   segurando `dead = 0.12`) e puxa cada jogador de volta para a bola, enquanto
   a maquina de bola parada o puxa para o posto. Os dois escrevem no mesmo
   quadro. E o mesmo cabo-de-guerra que a OS-207 diagnosticou na falta -- a
   "bugadinha" e o "time espalhado" sao o mesmo defeito visto de dois lugares.

   ------------------------------------------------------------------------
   A CORRECAO: UM ESCRITOR SO, EM VEZ DE MAIS TEMPO

   Nao se mexe no `freeze` — ja foi tentado, e mexer no passo de quem se
   posiciona muda placar. Em vez disso, esta camada e o ESCRITOR FINAL da volta
   para casa: sendo a ultima do documento, o passo que ela escreve e o que
   fica, e o alvo tatico deixa de disputar. E o mesmo desenho que a OS-77 ja
   usa para o batedor da falta comum, com o comentario dela dizendo por que:
   "assim alvos taticos tardios nao puxam o cobrador para longe da bola e nao
   ha movimento duplicado nem snap".

   Sem a disputa, a mesma janela rende o dobro de caminho. A janela cresce
   pouco (JANELA, 2,8 s contra os 2,2 s da R15) porque agora ela e usada de fato,
   e o folego fica CONGELADO enquanto ela dura: `deadBallRecovery` transformaria
   bola morta em descanso gratis, e foi assim que a OS-211 mexeu no placar sem
   mexer no futebol.

   So no pontape que pega o time espalhado (apos gol e apos intervalo). A saida
   que abre o tempo nasce com todo mundo em casa e passa direto.

   Nenhum sorteio novo, nenhuma decisao nova, nenhum xG.
   =========================================================================== */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__OS214__) return;
const P = M.prototype; P.__OS214__ = true;

const FLv = Number(root.FL) || 105, FWv = Number(root.FW) || 68;
const CAMINHA = 0.92;   // a mesma fracao de maxSpd da R15, da OS-77 e da OS-83
const JANELA  = 2.8;    /* s de fisica. Com escritor unico a janela rende o dobro,
                           entao ela nao precisa ser longa: 4,0 custava
                           blowoutRate 0,198 (teto 0,19). */
const CHEGOU  = 0.30;   // m

function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); }
function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }

/* O posto de cada um: o alvo que a R15 ja montou vale; sem ele, a casa da
   formacao, que e o que `_resetPositions` teria escrito. */
function posto(p) {
  if (p.__spTarget) return { x: num(p.__spTarget.x), y: num(p.__spTarget.y) };
  const hx = Number.isFinite(p.dhx) ? p.dhx : p.hx;
  const hy = Number.isFinite(p.dhy) ? p.dhy : p.hy;
  if (Number.isFinite(hx) && Number.isFinite(hy)) return { x: hx, y: hy };
  return null;
}

const oldKickoff = P._kickoff;
if (typeof oldKickoff === 'function') {
  P._kickoff = function (side, start) {
    const r = oldKickoff.apply(this, arguments);
    try {
      if (!start && num(this.t) > 0.5) {
        this.__os214Ate = num(this.t) + JANELA;
        this.__os214Batedor = this.ball && this.ball.owner;
      }
    } catch (_) { }
    return r;
  };
}

const oldStep = P.step;
P.step = function (dt) {
  const passo = Math.max(1 / 240, Math.min(0.15, num(dt, 1 / 30)));
  const ativa = num(this.__os214Ate) > num(this.t) && num(this.dead) > 0;

  /* posicao no fim do quadro anterior: a caminhada sai DAQUI, nao do que o
     alvo tatico fez no meio do passo */
  let antes = null, folego = null;
  if (ativa) {
    antes = new Map(); folego = [];
    const teams = this.teams || [];
    for (let i = 0; i < teams.length; i++) {
      const pl = teams[i].players || [];
      for (let j = 0; j < pl.length; j++) {
        const p = pl[j];
        if (!p || p.red) continue;
        antes.set(p, [num(p.x), num(p.y)]);
        folego.push([p, p.stamina]);
      }
    }
  }

  const r = oldStep.apply(this, arguments);

  try {
    if (antes) {
      /* a janela nao pode virar descanso: foi assim que a OS-211 mexeu no
         placar sem mexer no futebol */
      for (let k = 0; k < folego.length; k++) folego[k][0].stamina = folego[k][1];

      let faltando = 0;
      antes.forEach((p0, p) => {
        if (p === this.__os214Batedor) return;          // o batedor fica na bola
        const alvo = posto(p);
        if (!alvo) return;
        const dx = alvo.x - p0[0], dy = alvo.y - p0[1], L = Math.hypot(dx, dy);
        if (L <= CHEGOU) { p.vx = 0; p.vy = 0; return; }
        faltando++;
        const max = num(p.maxSpd, 7) * CAMINHA * passo;
        if (L <= max) {
          p.x = cl(alvo.x, 0, FLv); p.y = cl(alvo.y, 0, FWv); p.vx = 0; p.vy = 0;
        } else {
          p.x = cl(p0[0] + dx / L * max, 0, FLv);
          p.y = cl(p0[1] + dy / L * max, 0, FWv);
          p.vx = dx / L * max / passo; p.vy = dy / L * max / passo;
        }
      });
      /* chegaram todos: solta a bola antes do prazo */
      if (!faltando) this.__os214Ate = 0;
      else if (num(this.dead) <= 0.05) this.dead = 0.12;
    }
    if (!(num(this.dead) > 0)) { this.__os214Ate = 0; this.__os214Batedor = null; }
  } catch (_) { }
  return r;
};

root.CDS_OS214 = Object.freeze({
  versao: 'OS-214', instalado: true,
  feature: 'KICKOFF_SINGLE_WRITER_WALK_HOME',
  janela: JANELA, rngAdded: false, xgChange: false
});
root.CDS_BUILD_ID = 'R19.12'; root.CDS_VERSION = '5.80.3-R19.12';
try { document.title = 'Copa dos Sonhos — R19.12'; } catch (_) { }
})(typeof window !== 'undefined' ? window : globalThis);
