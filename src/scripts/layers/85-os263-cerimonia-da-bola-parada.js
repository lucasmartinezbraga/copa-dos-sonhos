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

/* OS-264 — QUATRO HIPOTESES, QUATRO REPROVACOES, NADA EMBARCADO
   ---------------------------------------------------------------------------
   RELATO: "quando rola um gol o jogo comeca do nada sem os jogadores se
   organizarem". A PAUSA foi resolvida pela OS-263 acima (733 ms -> 3,3 s de
   parede). A ORGANIZACAO nao foi, e o registro do que se tentou vale mais que
   um remendo nao provado.

   A sonda que decide e `tools/fisica/o-reinicio.js`: sem navegador, 34
   partidas, 164 pontapes (contra 2 a 5 por partida na sonda de tela -- com
   aquela amostra eu ja tinha proposto DUAS correcoes apoiadas em diferencas
   que eram ruido).

   LINHA DE BASE, 164 pontapes:

       R1 distancia MEDIA ao posto no reinicio      9,7 m
       R2 atleta MAIS LONGE                        25,7 m
       R4 quanto o POSTO andou na parada           32,6 m
       R5 quanto o CORPO andou na parada           24,3 m
       R3 ja posicionados (<= 3 m)                    27%

   1) TELEPORTE. Errada: zero teleportes em 64 reinicios numa partida inteira.
      A caminhada da R14/OS-229 funciona.

   2) A JANELA E CURTA (`DEAD_CAP = 2,2` s cobre 13 m; a volta passa de 40 m).
      Alonguei. A metrica direta reprovou: 16,5 m de media. Alongar sozinho
      PIORA -- da mais tempo para o que vem depois.

   3) QUEM CHEGA E SOLTO PARA A IA TATICA. Pino reassinando o alvo: `alvos` foi
      a 22/22 e a distancia continuou crescendo.

   4) O ALVO FOGE (R4 = 32,6 m: o POSTO anda mais que o corpo). Re-mirei no
      posto vivo quadro a quadro -- 15,8 -> 12,3 m na sonda de tela, dentro do
      ruido de 2 gols por partida. Depois congelei o posto no instante do
      pontape, que e quando `hx`/`hy` ainda E a formacao de pontape inicial:
      R1 foi de 9,7 para 21,2 m e R3 de 27% para ZERO.

   POR QUE O 4 NAO CONCLUI, e e o ponto honesto: congelar leva os atletas a
   formacao de PONTAPE INICIAL, que e onde o futebol os quer -- mas a metrica
   R1 mede distancia ao `hx` VIVO, e o jogo move esse `hx` para a forma tatica
   assim que solta. Entao o comportamento provavelmente CERTO pontua pessimo, e
   a metrica nao sabe distinguir os dois casos.

   O QUE FALTA, e nao e codigo: decidir qual e a formacao correta no instante
   do pontape -- a de pontape inicial (congelada) ou a tatica (viva). Isso e
   decisao de design do dono, nao de medicao. Enquanto nao houver essa
   definicao, qualquer correcao aqui pontua contra si mesma. */

root.CDS_OS263 = Object.freeze({
  versao: 'OS-263', instalado: true,
  feature: 'CEREMONY_RUNS_IN_WALL_CLOCK',
  rngAdded: false, xgChange: false, cerimonias: CERIMONIA
});
root.CDS_OS264 = Object.freeze({
  versao: 'OS-264', instalado: false,
  feature: 'KICKOFF_ORGANISATION — quatro hipoteses medidas e reprovadas; ver o bloco acima',
  rngAdded: false, xgChange: false
});
root.CDS_BUILD_ID = 'R19.16'; root.CDS_VERSION = '5.80.5-R19.16';
try { document.title = 'Copa dos Sonhos — R19.16'; } catch (_) { }
})(typeof window !== 'undefined' ? window : globalThis);
