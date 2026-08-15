
(function (root) {
'use strict';
/* ###########################################################################
   LIGADA. VARREDURA DE DOSE COMPLETA, COM CONTROLE PAREADO.
   Esta camada NAO esta no manifesto. Ela funciona, o diagnostico esta certo e
   o efeito e real; o que falta e a DOSE. Duas foram medidas em 48 partidas:

     A  hab 62, nota 1,05, "pressao OU curto"   48 part.   9/13
     B  hab 76, nota 2,20, "pressao E curto"    48 part.  11/13
     B  a mesma dose                            96 part.   9/13   <- nao era ruido
     C  B + devolucao do tempo adiantado        96 part.   9/13
     D  hab 82, nota 2,80, pressao 3,8          96 part.  11/13   <- esta
     -  CONTROLE, sem a camada                  96 part.  12/13

   O CONTROLE PAREADO mudou a leitura: a linha de base com 96 partidas tambem
   nao e perfeita (drawRate 0,167, abaixo do piso 0,2) e `onTargetRate` esta em
   0,344, a 0,004 do piso. A dose D TROCA quais metricas falham:

       entra na faixa   drawRate     0,167 -> 0,240
                        zeroZero     0,062 -> 0,073 (no alvo)
       sai da faixa     onTargetRate 0,344 -> 0,324
                        vermelhos    0,250 -> 0,344

   Pela regua do projeto e 12/13 -> 11/13, um a menos. O dono pediu a fluidez
   duas vezes depois de o custo ser apresentado, e a decisao e dele: o jogo e
   dele, e alvo de design e guia, nao lei.

   O CUSTO EM UMA LINHA: mais cartao vermelho (0,25 -> 0,34 por partida) e
   chute um pouco menos preciso, em troca de a bola andar de primeira.
   Para desligar: remover o bloco do manifesto e do template.
   ########################################################################### */
/* OS-212 · A BOLA VOLTA A ANDAR DE PRIMEIRA
   ===========================================================================
   PEDIDO: "quero sentir fluidez dos toques igual futebol".

   MEDIDO ANTES (tools/fisica/tela, 161 passes de partida real):

       tempo entre GANHAR a bola e SOLTA-LA
         p10  0,433 s      p25  0,467 s      p50  0,950 s
         abaixo de 0,35 s: 2 passes em 161  (1,2%)

   Ou seja: nao existe tabelinha. Toda bola para no pe, e so depois anda. E o
   que se ve na tela e um jogo de passes deliberados, um de cada vez, nunca a
   troca rapida em espaco curto que da a sensacao de futebol.

   NAO E ACIDENTE, E UM PORTAO. O nucleo so decide quando
   `owner.settle <= 0 && decideT <= 0` (40-match-engine:478). A recepcao
   atribui `settle` (0,10 a 0,34 dividido pela execucao do atleta) E
   `decideT = 0,28`. Enquanto os dois nao zeram, o portador nao pode fazer
   nada — nem o passe obvio de primeira.

   A PROVA DE QUE O MOTOR JA QUERIA ISTO: `_evaluateShotDecision` calcula
   `const firstTime = o.settle > 0 && o.settle < .45` (:954) e usa esse valor
   para decidir. So que ele so roda dentro de `_decide`, que so e chamado pelo
   portao acima — com `settle <= 0`. **`firstTime` e SEMPRE falso.** O conceito
   esta escrito, e lido, e nao pode acontecer. E o mesmo padrao dos gestos que
   entravam e nunca viravam quadro, um andar abaixo.

   O QUE ESTA CAMADA FAZ. Nao inventa passe nenhum e nao escreve decisao
   nenhuma: ela apenas ABRE O PORTAO MAIS CEDO quando o passe de primeira
   esta claramente disponivel. Quem escolhe continua sendo `_decide`, com a
   mesma logica, os mesmos pesos e o mesmo sorteio — a diferenca e o INSTANTE
   em que ele pode falar.

   As condicoes sao as do futebol, nao de conveniencia:

     · a bola tem de estar CHEGANDO ao fim do primeiro toque (a passada ja
       aconteceu), nao no instante do contato;
     · tem de haver um passe bom de verdade na mesa — o proprio `_bestPass`
       do motor decide isso, nao um criterio novo;
     · o atleta tem de saber jogar de primeira: passe e visao sao o filtro, e
       o piso e alto de proposito;
     · e ou ele esta sob pressao — que e QUANDO se joga de primeira, porque
       nao ha tempo de dominar — ou o passe e curto e limpo, que e a
       tabelinha.

   NAO CONSOME RNG NOVO. Nenhum sorteio e acrescentado: o unico efeito e
   zerar dois contadores que ja existem, e deixar o motor seguir o caminho
   dele. Sem isso a bateria nao seria comparavel.
   =========================================================================== */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__OS212__) return;
const P = M.prototype; P.__OS212__ = true;

/* DOSE. Comeca conservadora de proposito: o passe de primeira e um recurso,
   nao o padrao. Os numeros sao para serem varridos pela bateria, nao para
   serem defendidos. */
const JANELA_MIN   = 0.06;   // s de settle restante: abaixo disto o toque ja acabou
const PRESSAO      = 3.8;    // m -- adversario mais perto que isto e pressao
const CURTO        = 18.0;   // m -- ate aqui e tabelinha, nao lancamento
const HABILIDADE   = 82;     // piso de (passe+visao)/2 para tentar de primeira
const RISCO_MAX    = 0.20;   // eixo real medido: p50 -0,03, p90 0,66
const NOTA_MIN     = 2.40;   /* §OS-218 · mais um degrau de fluidez, a pedido */   // acima do p50 (1,63): so quando o passe e bom mesmo

function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); }

function atributo(p, k, padrao) {
  try {
    const q = p && p.ref ? p.ref : p;
    if (q && q.attributesV3 && Number.isFinite(q.attributesV3[k])) return q.attributesV3[k];
    const x = root.getAttr && root.getAttr(q, k);
    if (Number.isFinite(x)) return x;
  } catch (_) { }
  return padrao;
}

/* Vale a pena soltar de primeira? So le; nao escreve nada. */
function deprimeira(sim, o) {
  if (!o || o.isGK || o.red) return false;
  const b = sim.ball;
  if (!b || b.owner !== o || b.traveling) return false;
  if (num(sim.dead) > 0 || sim.pendingRestart || sim.waiting) return false;
  /* bola parada tem cerimonia propria; nao se cobra falta de primeira */
  if (o._setPieceRole || num(o._setPieceDeliveryUntil) > num(sim.t)) return false;

  /* o toque tem de estar TERMINANDO: soltar no instante do contato seria
     teletransporte de bola, nao tabelinha */
  const s = num(o.settle);
  if (!(s > 0) || s > JANELA_MIN) return false;

  /* sabe jogar de primeira? */
  const habil = (atributo(o, 'passe', 65) + atributo(o, 'visao', 65)) / 2;
  if (habil < HABILIDADE) return false;

  /* ha passe de verdade na mesa? quem responde e o motor */
  let best = null;
  try { best = typeof sim._bestPass === 'function' ? sim._bestPass(o) : null; } catch (_) { }
  /* A FORMA VEIO DA SONDA, NAO DO CHUTE. `_bestPass` devolve
     `{m, score, proj, dist, progressM, risk, intoBox, ...}` -- o companheiro e
     `m` e NAO existe `target`. A primeira versao desta camada testou
     `best.target` e rejeitou 100% das ocasioes em silencio: a bateria deu
     numeros identicos a linha de base e por um momento parecia "sem efeito
     colateral", quando na verdade era "sem efeito nenhum".
     Escala medida em partida real: score p10 0,46 / p50 1,63 / p90 3,05;
     risk p10 -0,08 / p50 -0,03 / p90 0,66. */
  if (!best || !best.m) return false;
  if (num(best.risk, 9) > RISCO_MAX) return false;
  if (num(best.score, 0) < NOTA_MIN) return false;

  /* pressao, ou tabelinha curta e limpa */
  let perto = 99;
  try {
    const n = typeof sim._nearestOpponent === 'function' ? sim._nearestOpponent(o) : null;
    if (n && Number.isFinite(n.dist)) perto = n.dist;
  } catch (_) { }
  const dPasse = num(best.dist, 99);
  /* DOSE, SEGUNDA TENTATIVA. A primeira liberava sob pressao OU em tabelinha
     curta, com piso de habilidade 62 e nota 1,05 (abaixo da mediana de 1,63).
     Resultado medido em 48 partidas: 12/13 metricas caem para 9/13 -- gols de
     2,92 para 3,31 (teto 3,2), vermelhos 0,208 para 0,354 (teto 0,3), goleadas
     0,271 (teto 0,19). A bola andando mais rapido cria jogo demais.
     Agora as duas condicoes valem JUNTAS, e e o caso que o futebol de fato
     produz: sob pressao, com a opcao curta e limpa na mesa. Quem tem tempo
     domina -- como sempre fez. */
  return perto < PRESSAO && dPasse <= CURTO;
}

const oldStep = P.step;
P.step = function (dt) {
  try {
    const o = this.ball && this.ball.owner;
    if (o && deprimeira(this, o)) {
      /* ANTECIPA, NAO ACRESCENTA — e este era o erro da dose B.
         `decideT` e do SIMULADOR, nao do jogador. Zera-lo nao liberava so
         este passe: enfiava uma decisao A MAIS na partida inteira, e o
         nucleo re-arma o intervalo depois de cada uma. Medido em 96
         partidas: faltas de 21,27 para 23,36 e vermelhos de 0,208 para 0,323
         -- mais acoes, mais contato, mais cartao. O jogo nao ficou fluido,
         ficou AGITADO, que e outra coisa.
         Agora o tempo poupado e DEVOLVIDO: o que se adianta aqui e cobrado
         do proximo intervalo de decisao. O passe sai de primeira e a partida
         segue com a mesma quantidade de decisoes que teria sem esta camada. */
      const poupado = Math.max(0, num(o.settle)) + Math.max(0, num(this.decideT));
      o.settle = 0;
      this.decideT = 0;
      this.__os212Devolver = num(this.__os212Devolver) + poupado;
      o.__os212Primeira = num(this.t);
      this.__os212Contagem = num(this.__os212Contagem) + 1;
    }
  } catch (_) { }
  const r = oldStep.apply(this, arguments);
  try {
    /* devolve o tempo adiantado ao proximo intervalo, uma vez so */
    const dev = num(this.__os212Devolver);
    if (dev > 0 && num(this.decideT) > 0) {
      this.decideT = num(this.decideT) + dev;
      this.__os212Devolver = 0;
    }
  } catch (_) { }
  return r;
};

P.getOS212Audit = function () {
  return { versao: 'OS-212', liberacoes: num(this.__os212Contagem) };
};

root.CDS_OS212 = Object.freeze({
  versao: 'OS-212', instalado: true,
  feature: 'FIRST_TIME_PASS_GATE',
  janelaMin: JANELA_MIN, pressao: PRESSAO, curto: CURTO, habilidade: HABILIDADE,
  rngAdded: false, decisionLogicChanged: false
});
root.CDS_BUILD_ID = 'R19.11'; root.CDS_VERSION = '5.80.2-R19.11';
try { document.title = 'Copa dos Sonhos — R19.11'; } catch (_) { }
})(typeof window !== 'undefined' ? window : globalThis);
