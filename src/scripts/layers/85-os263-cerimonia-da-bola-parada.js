(function (root) {
'use strict';
/* OS-263 · A CERIMONIA DA BOLA PARADA — a falta tem de PARAR o jogo
   ===========================================================================
   RELATO do dono, textual:

     "A falta esta acontecendo do nada, o jogador perde a bola quando eh falta
      do nada, e nao tem uma pausa pro batedor bater a falta e voce sentir que
      o lance parou, eh como se tudo acontecesse de forma continua."

   Ele descreve o sintoma com precisao: *continuo*. E era literal.

   MEDIDO, assistindo a partida inteira pela primeira vez
   (tools/fisica/tela/a-partida-inteira.js, Belgica 0x3 Inglaterra, 94 minutos,
   64 reinicios, no 3X que e o padrao):

       reinicio      n     pausa mediana
       falta        44          300 ms
       escanteio     7          517 ms
       gol           4          733 ms
       impedimento   4          217 ms
       intervalo     1         2800 ms

   Trezentos milissegundos. Dezoito quadros. Nao ha olho que registre isso como
   parada -- e por isso o jogo "acontece de forma continua".

   E a hipotese obvia estava ERRADA, o que so a partida inteira mostrou: zero
   teleportes em 64 reinicios. A maquina de caminhada da R14/OS-229 funciona.
   O defeito nao e o que acontece na parada, e o TEMPO que ela dura.

   A CAUSA. `70-game-runtime-and-rendering.js`:

       const ADIANTA_PARADA = 3.5;
       ...
       const _espera = (sim && sim.dead > 0 && !slowmo) ? ADIANTA_PARADA : 1;

   Toda bola parada e adiantada 3,5 vezes, EM CIMA do multiplicador do botao.
   No padrao de 3X isso da 10,5 vezes o tempo real. Os mesmos 300 ms de falta,
   rodados a 1X, seriam 3,1 segundos -- que e uma pausa de futebol.

   A intencao da OS-203 estava certa e a aplicacao era larga demais. Ela mediu
   que 12,2% da partida e bola parada e chamou isso de "espera, nao futebol".
   Verdade para a BUROCRACIA -- tiro de meta, arrumacao de lateral, recolocar
   a bola. Mentira para a CERIMONIA -- a falta, o cartao, o penalti, o gol.
   Esses sao exatamente os momentos em que uma transmissao DEMORA: o apito, o
   jogador reclamando, o batedor andando ate a bola. Adiantar a cerimonia e
   cortar justamente a parte que faz o lance existir.

   O QUE ESTA CAMADA FAZ. Marca uma JANELA DE CERIMONIA em relogio de PAREDE
   quando o motor emite um evento de cerimonia. Enquanto a janela vale, o laco
   de render nao adianta a bola parada e nao aplica o multiplicador do botao:
   a pausa acontece em tempo real, seja o jogo em 1X ou em 6X.

   Relogio de parede, e nao de simulacao, de proposito -- e a mesma licao da
   OS-260: uma duracao que existe para o OLHO tem de ser contada no relogio do
   olho, senao o botao de velocidade a divide.

   APRESENTACAO PURA. Nao toca `dead`, nao toca `pendingRestart`, nao toca
   posicao nem RNG. O simulador recebe exatamente os mesmos passos, na mesma
   ordem, com os mesmos resultados -- muda so quantos segundos de parede levam
   para serem desenhados. A bateria nem ve esta camada.
   =========================================================================== */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__OS263__) return;
const P = M.prototype; P.__OS263__ = true;

/* Quanto tempo de PAREDE cada cerimonia merece. Os numeros saem do que uma
   transmissao gasta, e nao de gosto: o apito e a reclamacao de uma falta comum
   duram uns segundos; um cartao vermelho para o jogo de verdade. */
const CERIMONIA = {
  foul:     1900,
  freekick: 1400,
  penalty:  2600,
  red:      3000,
  yellow:   1500,
  offside:  1500,
  goal:     2600,
  injury:   2600,
};

/* Teto de seguranca: se por qualquer motivo a bola nao voltar a rolar, a
   janela expira sozinha e o jogo volta ao ritmo normal. */
const TETO = 6000;

function agora() {
  try { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  catch (_) { return Date.now(); }
}

const oldEmit = P._emit;
P._emit = function (t, d) {
  try {
    const ms = CERIMONIA[t];
    if (ms) {
      const ate = agora() + Math.min(TETO, ms);
      const C = root.__CDS_CERIMONIA;
      /* eventos encadeados (falta -> cartao -> cobranca) nao encurtam a
         janela: fica sempre a mais longa das duas */
      if (!C || ate > C.ate) root.__CDS_CERIMONIA = { tipo: t, ate: ate };
    }
  } catch (_) { }
  return oldEmit.apply(this, arguments);
};

/* §OS-263b · A CERIMONIA ACABA QUANDO A BOLA VAI PARA O MEIO.
   Medido em partida inteira a 3X (`scratchpad/linha-do-corte.js`, 3 gols):

       goal      t = 268634
       _kickoff  t = 269801   dead = 2,2 s   22 alvos de caminhada
       arrumado  t = 271785   -> 1984 ms de PAREDE andando de volta

   A comemoracao dura do apito ate a bola ser colocada no circulo central: 1,2 s
   aqui, que e o `dead` do gol. O que vem DEPOIS do `_kickoff` e a caminhada de
   volta a formacao -- burocracia pura, ninguem transmite isso. E a janela de
   2600 ms da cerimonia ainda estava valendo, segurando `_espera` em 1 e o
   multiplicador do botao em 1: os 2,2 s de simulacao da caminhada viravam 2 s
   de parede em vez dos ~210 ms que a burocracia normal levaria a 3X.

   Encerrar a janela no pontape devolve a caminhada ao ritmo de burocracia sem
   encurtar um milissegundo da comemoracao. Nao toca `dead` nem posicao: so
   apaga um estado de APRESENTACAO que ja cumpriu o que tinha para cumprir. */
const oldKickoffCer = P._kickoff;
if (typeof oldKickoffCer === 'function') {
  P._kickoff = function () {
    const r = oldKickoffCer.apply(this, arguments);
    try { root.__CDS_CERIMONIA = null; } catch (_) { }
    return r;
  };
}

/* Consultada pelo laco de render. Devolve `true` enquanto a cerimonia vale E a
   bola ainda esta morta -- assim que o jogo volta a rolar, a janela nao segura
   nada, mesmo que ainda houvesse tempo nela. */
root.__cdsCerimoniaAtiva = function (sim) {
  try {
    const C = root.__CDS_CERIMONIA;
    if (!C) return false;
    if (agora() >= C.ate) { root.__CDS_CERIMONIA = null; return false; }
    return !!(sim && (Number(sim.dead) || 0) > 0);
  } catch (_) { return false; }
};

/* OS-264 — A CORRECAO FUNCIONA E MESMO ASSIM NAO EMBARCA
   ---------------------------------------------------------------------------
   RELATO: "quando rola um gol o jogo comeca do nada sem os jogadores se
   organizarem". A PAUSA esta resolvida pela OS-263 acima (733 ms -> 3,7 s de
   parede). A ORGANIZACAO tem correcao encontrada, medida, e REVERTIDA -- e o
   motivo de reverter e mais util que a correcao.

   O DIAGNOSTICO, esse esta fechado. `tools/fisica/o-reinicio.js` mede sem
   navegador, 34 partidas, ~165 pontapes (a sonda de tela pega 2 a 5 por
   partida, e com essa amostra eu propus DUAS correcoes apoiadas em ruido):

       R1 distancia MEDIA ao posto      9,7 m
       R4 quanto o POSTE andou         32,6 m   <- o alvo foge
       R5 quanto o CORPO andou         24,3 m
       R3 ja posicionados (<= 3 m)        27%

   O POSTE anda 32,6 m. Os atletas nunca se dispersaram: eles PERSEGUEM UM
   ALVO QUE FOGE, porque `_kickoff` fotografa `hx`/`hy` num `__spTarget`
   congelado e a camada tatica passa os segundos seguintes recalculando esses
   postos.

   Quatro hipoteses cairam antes (teleporte: zero em 64 reinicios; janela
   curta: piora; pino no alvo: nada; congelar o poste: R1 de 9,7 para 21,2 m e
   R3 para ZERO). A quinta funcionou: RE-MIRAR no poste vivo quadro a quadro,
   com a janela fechando pela convergencia da MEDIA e nao do pior atleta --
   gatear no maximo faz um unico atrasado segurar os outros vinte e um.

       R1  9,7 m -> 3,2 m      R3  27% -> 68%      R2  25,7 m -> 14,7 m

   E na partida inteira o veredito virou: "no reinicio, os atletas CHEGARAM ao
   posto? 4,4 m".

   POR QUE MESMO ASSIM NAO EMBARCA. `tools/fisica/tela/validar-lances.js`, a
   mesma sonda e a mesma janela de 460 s, contra o build anterior:

       build sem OS-264   F2 bola no ponto da falta   17/17  100%   pior  0,97 m
       com OS-264 (v1)                                84,6%         pior 16,43 m
       com posse por identidade do alvo               95,8%         pior 17,35 m
       com guarda de `pendingRestart`                 90,9%         pior 19,81 m

   Nao e amostra: o pior caso do build sem a OS-264 e UM metro, e o dela e
   DEZESSETE, em toda variante. `__spTarget` e `dead` sao compartilhados com a
   falta, o escanteio, o lateral e o goleiro, e nao consegui isolar a janela do
   pontape a ponto de nao contaminar a cobranca. Falta acontece 22 vezes por
   partida; pontape apos gol, duas ou tres.

   O QUE FALTA PARA EMBARCAR: um alvo de caminhada PROPRIO desta camada, que
   nao seja `__spTarget`, com a camada 18 ensinada a respeita-lo. Isso e
   mudanca na camada 18, nao aqui -- e nao se faz no fim de uma rodada. */

root.CDS_OS263 = Object.freeze({
  versao: 'OS-263', instalado: true,
  feature: 'CEREMONY_RUNS_IN_WALL_CLOCK',
  rngAdded: false, xgChange: false, cerimonias: CERIMONIA
});
root.CDS_OS264 = Object.freeze({
  versao: 'OS-264', instalado: false,
  feature: 'KICKOFF_WALK — diagnosticada e corrigida, revertida por contaminar a falta',
  rngAdded: false, xgChange: false
});
root.CDS_BUILD_ID = 'R19.16'; root.CDS_VERSION = '5.80.5-R19.16';
try { document.title = 'Copa dos Sonhos — R19.16'; } catch (_) { }
})(typeof window !== 'undefined' ? window : globalThis);
