
(function (root) {
'use strict';
/* OS-231 · O BATEDOR CORRE PARA A BOLA EM VEZ DE SALTAR ATE ELA
   ===========================================================================
   RELATO, desde a primeira mensagem: "a bugadinha na hora que o jogador vai
   bater falta, escanteio". A OS-207 corrigiu a animacao e a OS-229 dissolveu o
   cabo-de-guerra da posicao. Sobrou o salto no quadro em que a bola sai.

   ---------------------------------------------------------------------------
   TRES LEITURAS ERRADAS ANTES DA CERTA. Ficam registradas porque as tres
   pareciam obvias e as tres foram desmentidas por medicao.

   ERRO 1 · "a culpa e do snap". `snapTakerBeforeRestart` (:33/175) crava
   `taker.x = spotX` no quadro do reinicio. Escrevi uma camada que DESFAZIA o
   snap. Na tela funcionou (pior salto 14,36 -> 0,35 m) e na bateria reprovou:
   9/13 contra 11/13, com `redsPerMatch` 0,219 -> 0,354 e `averageEndingStamina`
   64,59 -> 63,80. E tratar sintoma: o batedor passa a chutar de longe da bola.

   ERRO 2 · "o orcamento e curto". `armTaker(..., 0.5, 1.8)` (:33/114) parece
   dizer que a falta so paga 8,45 m de caminhada. Estiquei o teto para 3,0 s e
   a auditoria devolveu `esticados: 0` — o 1,8 nao vale nada: a OS-77 ja
   reorca a falta para `clamp(0,82 + d/6,5 , 0,82 , 4,2)`, e `armTaker` tem
   QUATRO chamadas com tetos diferentes (falta 1,8 · lateral 3,2 · falta direta
   4,0 · escanteio 5,0). Ler uma e generalizar foi o erro.

   ERRO 3 · "entao estica a janela". Com teto de 10 s a bateria foi a 9/13 e —
   o numero que importa — `goalsPerMatch` subiu de 2,917 para 3,31, com
   `blowoutRate` 0,219. Faz sentido: quatro segundos a mais de bola morta sao
   quatro segundos em que o time inteiro termina de se armar na area, e o
   escanteio fica mais perigoso. Isso e REBALANCEAR o jogo, nao consertar um
   defeito — e a calibracao nao foi feita para esse escanteio.

   ---------------------------------------------------------------------------
   A MEDICAO QUE RESOLVEU (scratchpad/aproximacao.js, 48 lances, 90 min):
   distancia a percorrer, distancia andada, sobra para o snap e a JANELA.

       precisava  andou  snap   janela   quadros parado
          33,5     26,8   7,2    5,00        0%
          29,0     27,6   1,3    5,00        3%
          34,4     32,3   2,3    5,00        0%
          50,1     32,3  17,9    5,00        0%
          32,9     31,4   2,1    5,00        0%
          54,6     31,6  23,5    5,00        0%

       8 de 48 lances com snap > 1 m — e os OITO com janela de 5,00 s.
       media: precisava 41,4 m, andou 30,5 m, usou 5,03 s, 0% de quadros
       parado, velocidade efetiva 6,05 m/s.

   Janela de 5,00 s e a assinatura de uma chamada so: `armTaker(..., 0.8, 5.0)`
   em :33/237 — O ESCANTEIO. O batedor nao esta preso nem disputado: ele anda a
   passo cheio o tempo inteiro e a janela acaba. Com 13,3 escanteios por
   partida, 17% dao ~2 teleportes por partida — o defeito que se REPETE.

   E a falta? Nunca foi ela. O F6 da sonda lia `__cdsTakerWait` sem separar a
   rota, entao o salto do escanteio era contado contra a falta aberta pouco
   antes. O instrumento tambem estava errado (corrigido junto).

   ---------------------------------------------------------------------------
   A CORRECAO. Se o tempo nao pode crescer, a velocidade pode — e ela e que
   estava errada. Toda a maquina de bola parada move o atleta a
   `maxSpd * 0,92`: um passo de reposicionamento. Mas quem vai BATER um
   escanteio nao se reposiciona, ele corre; e a unica razao de ele andar era
   nao haver distincao entre "voltar para o posto" e "ir buscar a bola".

   Enquanto a bola esta morta e SO para o batedor, `maxSpd` e elevado pelo
   fator que falta para ele chegar, com teto de sprint. Nada mais no motor le
   `maxSpd` durante a bola morta a nao ser os proprios caminhadores e o
   orcamento de passo da R18.99 — que passa a permitir a passada maior, que e
   o que se quer. O valor e restaurado no mesmo passo, num `finally`.

   O tempo de bola morta NAO muda: mesma janela, mesmo tanto de organizacao na
   area, mesmo futebol. Muda so quem chega.

   Nada aqui sorteia, nao muda alvo, nao muda decisao, nao cria escritor novo
   de posicao — o unico escritor continua sendo a caminhada de bola parada.
   =========================================================================== */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__OS231__) return;
const P = M.prototype; P.__OS231__ = true;

/* §OS-231b · O TETO E FIXADO PELA SANIDADE, NAO PELO GOSTO.
   Com 1,55 a varredura de sanidade acusou 21 quadros de `jogador_rapido_demais`
   (11,5 m/s para um maxSpd de 7,08). Nao e falso positivo: o orcamento da
   R18.99 satura a velocidade em `maxSpd * 1,05` lendo o valor JA reforcado,
   e 7,08 x 1,55 x 1,05 = 11,52 — acima do teto de 1,6x que a sonda vigia.
   O teto seguro nao e questao de gosto: a saturacao usa 1,05 e a sonda vigia
   1,6, entao qualquer fator abaixo de 1,6/1,05 = 1,523 passa para QUALQUER
   atleta, seja qual for o maxSpd dele. 1,50 e o maior valor redondo abaixo
   disso, e paga 48,8 m de corrida na janela de 5 s do escanteio. */
const TETO_FATOR = 1.50;  // teto do reforco: e uma corrida, nao um foguete
const FOLGA      = 1.08;  // chega com uma folguinha, nao raspando
const PARA_QUE   = 1.20;  // so reforca quem esta atrasado mais de 20%

function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); }

/* --------------------------------------------------- o resto do escanteio
   Com a corrida, o batedor cobre 48,8 m na janela de 5 s — e resolve a falta
   por inteiro (pior salto 15,31 -> 0,39 m) e a maior parte do escanteio
   (E2 de 50% para 72,7%). O que sobra e so o escanteio, e por um motivo que
   nao esta na bola parada: o batedor e escolhido em :40/2731 por
   `facet(p,'setpiece')` — o melhor cobrador do time, ONDE QUER QUE ELE ESTEJA.
   A distancia nao entra na conta, e ja o vi ser chamado de 63,5 m.

   Trocar o escolhido resolveria a distancia e quebraria a medicao: a rotina do
   escanteio le `facet(taker,'setpiece') > 72 && chance(.38)`, entao outro
   batedor muda O CONSUMO do gerador seedado e a bateria pareada passa a medir
   caos em vez de efeito — exatamente o que o §OS-74 documenta em :40/2748.

   Entao o tempo cede, e SO no escanteio: 13,3 por partida contra 22 faltas,
   e apenas ~1 em 4 precisa. A janela cresce ate o que a corrida exige, com
   teto de 7,5 s. O escanteio e o unico lance em que isso e barato — e, no
   relogio real, o unico que leva mesmo esse tempo. */
const TETO_ESC = 7.50;   // s -- teto da janela do escanteio
const BASE_ESC = 0.80;   // s -- a mesma pausa base de :33/237

const oldCorner = P._setCorner;
if (typeof oldCorner === 'function') {
  P._setCorner = function () {
    const antes = this.__cdsTakerWait;
    const r = oldCorner.apply(this, arguments);
    try {
      const w = this.__cdsTakerWait;
      if (w && w !== antes && w.taker && !w.taker.red) {
        const d = Math.hypot(num(w.taker.x) - num(w.x), num(w.taker.y) - num(w.y));
        const corre = num(w.taker.maxSpd, 7) * 0.92 * TETO_FATOR;
        const ate = num(this.t) + Math.min(TETO_ESC, BASE_ESC + d * FOLGA / corre);
        /* so estica; :33/143 ja segura `dead` sozinho enquanto `t < until` */
        if (ate > num(w.until)) {
          w.until = ate;
          this.__os231Janelas = num(this.__os231Janelas) + 1;
        }
      }
    } catch (_) { }
    return r;
  };
}

const oldStep = P.step;
P.step = function (dt) {
  let alvo = null, salvo = 0;
  try {
    const w = this.__cdsTakerWait;
    if (w && w.taker && !w.taker.red && num(this.dead) > 0 && num(w.until) > num(this.t)) {
      const t = w.taker;
      const resta = Math.hypot(num(t.x) - num(w.x), num(t.y) - num(w.y));
      const sobra = num(w.until) - num(this.t);
      if (resta > 1.0 && sobra > 0.05) {
        /* de quanto ele precisa para chegar, contra o que a caminhada da */
        const precisa = resta * FOLGA / sobra;          // m/s exigidos
        const tem = num(t.maxSpd, 7) * 0.92;            // m/s da caminhada
        const fator = precisa / (tem || 1);
        if (fator > PARA_QUE) {
          alvo = t; salvo = num(t.maxSpd, 7);
          t.maxSpd = salvo * Math.min(TETO_FATOR, fator);
          this.__os231Reforcados = num(this.__os231Reforcados) + 1;
        }
      }
    }
  } catch (_) { }

  try {
    return oldStep.apply(this, arguments);
  } finally {
    /* devolve SEMPRE, inclusive se o passo lancar: um maxSpd inflado que
       vazasse para a bola rolando viraria um atleta correndo a 11 m/s. */
    if (alvo) { try { alvo.maxSpd = salvo; } catch (_) { } }
  }
};

P.getOS231Audit = function () {
  return { versao: 'OS-231', quadrosReforcados: num(this.__os231Reforcados),
           janelasDeEscanteio: num(this.__os231Janelas) };
};

root.CDS_OS231 = Object.freeze({
  versao: 'OS-231', instalado: true,
  feature: 'SET_PIECE_TAKER_RUNS_TO_THE_BALL',
  tetoFator: TETO_FATOR, rngAdded: false, xgChange: false
});
root.CDS_BUILD_ID = 'R19.15'; root.CDS_VERSION = '5.80.6-R19.15';
try { document.title = 'Copa dos Sonhos — R19.15'; } catch (_) { }
})(typeof window !== 'undefined' ? window : globalThis);
