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

/* OS-264 — INVESTIGADA E REPROVADA PELA PROPRIA MEDICAO, NAO EMBARCADA
   ---------------------------------------------------------------------------
   O relato "quando rola um gol o jogo comeca do nada sem os jogadores se
   organizarem" tem uma segunda metade que esta OS NAO resolve, e vale mais
   registrar o que se descobriu do que embarcar um remendo nao provado.

   HIPOTESE 1 — teleporte. ERRADA. A partida inteira mostrou ZERO teleportes em
   64 reinicios: a caminhada da R14/OS-229 funciona.

   HIPOTESE 2 — a janela de caminhada e curta demais. `deferPositions` (camada
   18) tem teto `DEAD_CAP = 2.2` s, que a 5,98 m/s cobre 13 m; depois de um gol
   a volta ao posto passa de 40 m. Implementei o alongamento e medi. A metrica
   direta ("a que distancia do posto o atleta esta quando a bola volta a
   rolar") REPROVOU: 16,5 m na media, pior a 43 m.

   O traco quadro a quadro mostrou o oposto do esperado:

       KICKOFF  dead 0 -> 3.48 | com __spTarget 22/22 | mais longe 17.2 m
          dead 3.48 | alvos 22 | ao posto: media   7.0 m
          dead 3.07 | alvos 21 | ao posto: media  18.5 m    <- AFASTANDO
          dead 2.27 | alvos 12 | ao posto: media  26.1 m    <- AFASTANDO
          dead -0.01 | alvos  0 | ao posto: media  16.5 m

   No instante do pontape eles estao a 7 m do posto e depois ANDAM PARA LONGE.
   Alongar `dead` PIORA: da mais tempo para se dispersarem.

   HIPOTESE 3 — quem chega ao posto e solto para a IA tatica (a camada 18 apaga
   `__spTarget` na chegada e a OS-229 so cede enquanto ele existe). Implementei
   um pino que reassina o alvo. `alvos` passou a ficar em 22/22 e a distancia
   CONTINUOU crescendo (8,4 -> 25,9 m). Ou seja: a hipotese tambem nao explica.

   O QUE FALTA DECIDIR, e por isso nada foi embarcado: nao esta separado se o
   ATLETA se afasta do posto ou se o POSTO (`hx`/`hy`, que a camada tatica
   recalcula) se move debaixo dele. A sonda mede distancia ao `hx` VIVO, entao
   os dois casos dao o mesmo numero. Ate isso ser separado, qualquer correcao
   aqui e chute -- e ja houve tres.

   A pausa depois do gol, essa sim, ficou: 733 ms -> 3048 ms, e vem inteira da
   OS-263 acima, que e apresentacao pura. */

root.CDS_OS263 = Object.freeze({
  versao: 'OS-263', instalado: true,
  feature: 'CEREMONY_RUNS_IN_WALL_CLOCK',
  rngAdded: false, xgChange: false, cerimonias: CERIMONIA
});
root.CDS_OS264 = Object.freeze({
  versao: 'OS-264', instalado: false,
  feature: 'KICKOFF_WALK — investigada, reprovada pela propria medicao, nao embarcada',
  rngAdded: false, xgChange: false
});
root.CDS_BUILD_ID = 'R19.16'; root.CDS_VERSION = '5.80.5-R19.16';
try { document.title = 'Copa dos Sonhos — R19.16'; } catch (_) { }
})(typeof window !== 'undefined' ? window : globalThis);
