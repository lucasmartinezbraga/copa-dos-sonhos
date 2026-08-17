
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
/* §OS-232 · A JANELA NUNCA PAGOU A VOLTA, E A REPROVACAO DE 4,0 s ERA RUIDO.
   ===========================================================================
   O escritor unico estava certo e resolveu o cabo-de-guerra -- mas o defeito
   que o dono relatou continuou de pe, porque sobrou o outro gargalo. Medido
   com tools/fisica/tela/volta-para-casa.js:

       precisava     media 19,7 m   pior 59,7 m
       ficou         media 13,3 m   pior 37,0 m
       fora de casa  11 de 22 no instante do pontape
       janela        2,85 s

   A 6,44 m/s, 2,8 s pagam 18 m. Voltar da area adversaria sao 60. Nao ha
   dissolucao de disputa que faca um corpo andar 60 m em 18 m de orcamento:
   e o MESMO gargalo da OS-231 no escanteio, visto no pontape.

   E o motivo de a janela nunca ter crescido: 4,0 s foi reprovada por
   `blowoutRate 0,198` contra teto de 0,19 -- medido a 96 partidas. Só que o
   PROPRIO CONTROLE, sem alteracao nenhuma, mede `blowoutRate` 0,156 a 96
   partidas e **0,198 a 288**. A reprovacao era o ruido da amostra pequena
   (briefing, armadilha 9). O numero que barrou a correcao era o numero da
   linha de base.

   Entao as duas pontas cedem, como no escanteio:
     · quem volta CORRE (VOLTA), em vez de andar -- um time que acabou de
       sofrer gol trota de volta, nao passeia;
     · a janela e dimensionada pela volta mais longa, com teto.

   O folego continua congelado enquanto ela dura, entao mais janela nao vira
   descanso de graca -- que foi como a OS-211 mexeu no placar sem mexer no
   futebol. E `dead` nao avanca `sim.minute`: a pausa maior nao tira futebol
   nenhum da partida, so da tempo de o time chegar. */
const CAMINHA = 0.92;   // a mesma fracao de maxSpd da R15, da OS-77 e da OS-83
const VOLTA   = 1.38;   /* fracao de maxSpd na volta para casa: 1,5x a caminhada.
                           Teto de seguranca: a sanidade acusa acima de 1,6x. */
const JANELA  = 2.8;    // s -- piso da janela, o que a OS-214 ja usava
const TETO    = 7.0;    // s -- teto: 60 m a 9,66 m/s sao 6,2 s
const BASE    = 0.5;    // s -- respiro antes de a bola rolar
const CHEGOU  = 0.30;   // m

function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); }
function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }

/* O posto de cada um: o alvo que a R15 ja montou vale; sem ele, a casa da
   formacao, que e o que `_resetPositions` teria escrito. */
function posto(p, voltarParaCasa) {
  /* §OS-232b · NO PONTAPE, A CASA GANHA DE `__spTarget`.
     Preferir `__spTarget` esta certo na bola parada, onde ele e o posto do
     lance. No pontape depois do gol ele e LIXO DO LANCE ANTERIOR: a barreira
     da falta, o poste do escanteio, o apoio do lateral. Quem carrega um alvo
     velho era levado para ele em vez de para casa, e ficava plantado la o
     resto da partida.

     Medido, com a janela ja dimensionada: nos pontapes em que o alvo mais
     longe era a CASA, a volta funcionou -- ficou 3,4 m de media, 2 de 22 fora
     de posicao. Nos que tinham `__spTarget` velho, a janela pedida caiu para
     2,8-3,6 s (porque media a distancia ao alvo ERRADO, que era perto) e 11
     de 22 comecaram a partida espalhados. Mesmo pontape, dois resultados,
     e a diferenca era de que alvo se estava falando. */
  if (voltarParaCasa) {
    const hx0 = Number.isFinite(p.dhx) ? p.dhx : p.hx;
    const hy0 = Number.isFinite(p.dhy) ? p.dhy : p.hy;
    if (Number.isFinite(hx0) && Number.isFinite(hy0)) return { x: hx0, y: hy0 };
  }
  if (p.__spTarget) return { x: num(p.__spTarget.x), y: num(p.__spTarget.y) };
  /* §OS-225 · A QUEDA PARA A FORMACAO SO VALE NO PONTAPE.
     Ela existe porque `_resetPositions` manda todo mundo para casa depois do
     gol. Numa FALTA nao: ali cada um tem posto de bola parada, e quem nao tem
     alvo simplesmente nao esta sendo reposicionado -- arrasta-lo para a casa
     da formacao inventa uma corrida que o futebol nao pediu.
     Foi o que a primeira versao desta extensao fez, e a sonda mediu na hora:
     o tremor de desenho subiu de 4,88% para 8,53% e o salto de ~35% para
     66,5%. O numero apareceu porque 22 jogadores passaram a atravessar o campo
     em toda falta. */
  if (!voltarParaCasa) return null;
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
        this.__os214Batedor = this.ball && this.ball.owner;
        this.__os214Casa = true;      // pontape: a formacao inteira volta
        /* a janela e do time, entao quem manda e a volta mais longa */
        let pior = 0, corre = 7 * VOLTA;
        const teams = this.teams || [];
        for (let i = 0; i < teams.length; i++) {
          const pl = teams[i].players || [];
          for (let j = 0; j < pl.length; j++) {
            const p = pl[j];
            if (!p || p.red || p === this.__os214Batedor) continue;
            const a = posto(p, true);
            if (!a) continue;
            const d = Math.hypot(a.x - num(p.x), a.y - num(p.y));
            if (d > pior) { pior = d; corre = num(p.maxSpd, 7) * VOLTA; }
          }
        }
        this.__os214Ate = num(this.t) +
          Math.max(JANELA, Math.min(TETO, BASE + pior / (corre || 9.66)));
      }
    } catch (_) { }
    return r;
  };
}

/* §OS-225 · TENTATIVA REVERTIDA, E O NUMERO ESTA AQUI PARA NAO SE REPETIR.
   Relato: "na hora da falta continua dando uma bugada maxima". Verdade -- a
   OS-207 corrigiu o que a ANIMACAO via, e o cabo-de-guerra da POSICAO ficou
   de pe. Como o escritor unico resolveu o pontape sem custar metrica, tentei
   estende-lo a toda cerimonia de bola parada.

   NAO FUNCIONA AQUI, e a sonda de desenho mediu duas vezes:

     primeira versao, com queda para a formacao   tremor 4,88% -> 8,53%
                                                  salto  ~35%  -> 66,5%
     com a queda limitada ao pontape              tremor        -> 5,42%
                                                  salto         -> 50,7%

   Ou seja: mesmo corrigido o erro obvio (arrastar 22 jogadores para a
   formacao em toda falta), o escritor unico PIORA a falta em vez de melhorar.
   A diferenca para o pontape e que ali existe um destino unico e legitimo para
   todo mundo -- a formacao -- e aqui nao: durante a falta cada um tem dono
   diferente (OS-107 contem o bloco, OS-36 arma a barreira, a R15 caminha quem
   foi reposicionado), e acrescentar mais um escritor final e trocar um
   cabo-de-guerra por outro, nao dissolve-lo.

   O que a falta pede e ARBITRAGEM entre os escritores que ja existem, nao um
   escritor a mais. Isso e rodada propria, com a bateria junto. */

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
      const _w = this.__cdsTakerWait, _bat = _w && _w.taker;
      const _g36 = this.__os36Guard, _muro = (_g36 && _g36.wall) || null;
      antes.forEach((p0, p) => {
        if (p === this.__os214Batedor) return;          // o batedor fica na bola
        /* §OS-225 · quem ja tem escritor final proprio nao entra aqui */
        if (p === _bat) return;                          // batedor: OS-77/OS-83/R18.15
        if (_muro && _muro.indexOf(p) >= 0) return;      // barreira: OS-36
        if (p === (this.ball && this.ball.owner)) return;
        const alvo = posto(p, this.__os214Casa);
        if (!alvo) return;
        const dx = alvo.x - p0[0], dy = alvo.y - p0[1], L = Math.hypot(dx, dy);
        if (L <= CHEGOU) { p.vx = 0; p.vy = 0; return; }
        faltando++;
        const max = num(p.maxSpd, 7) * VOLTA * passo;
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
    if (!(num(this.dead) > 0)) { this.__os214Ate = 0; this.__os214Batedor = null; this.__os214Casa = false; }
  } catch (_) { }
  return r;
};

root.CDS_OS214 = Object.freeze({
  versao: 'OS-214', instalado: true,
  feature: 'KICKOFF_SINGLE_WRITER_WALK_HOME',
  janela: JANELA, rngAdded: false, xgChange: false
});
root.CDS_BUILD_ID = "R19.12"; root.CDS_VERSION = "5.80.3-R19.12";
try { document.title = 'Copa dos Sonhos — R19.12'; } catch (_) { }
})(typeof window !== 'undefined' ? window : globalThis);
