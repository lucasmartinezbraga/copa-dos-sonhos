(function (root) {
'use strict';
/* OS-269 · A JANELA DO PONTAPÉ — o motor desistia da caminhada no meio
   ===========================================================================
   RELATO do dono, o mesmo desde a OS-263: "quando rola um gol o jogo comeca do
   nada sem os jogadores se organizarem" e "os times as vezes tao ate mal
   comportado".

   A OS-263 deu a pausa e a OS-268 deu o corte que esconde a arrumacao. Ficou
   faltando a arrumacao ACONTECER, e o que sobrou aparece assim, medido pela
   sonda `tools/fisica/tela/o-corte-do-lance.js` em pontapes depois de gol:

       dur   900 ms   caminhando 22 ->  0   vales 0
       dur   603 ms   caminhando 21 -> 10   vales 0
       dur   543 ms   caminhando 22 -> 11   vales 0

   BIMODAL, e `vales 0` mata a hipotese de quadro perdido: ou os 22 chegam, ou
   metade do time congela no meio do caminho. Nao e o corte que volta cedo -- e
   a caminhada que ACABA, e o veu, corretamente, para de esconder o que ja nao
   esta acontecendo.

   A CAUSA esta na camada 18, e ela e deliberada:

       var DEAD_CAP = 2.2;   // s de fisica
       var need = 0.6 + far / (6.5 * WALK_SPEED);
       sim.dead = Math.max(num(sim.dead), Math.min(DEAD_CAP, need));

   2,2 s a ~6 m/s cobrem ~13 m, e o proprio comentario da camada 18 diz por que
   isso esta certo: "quem estiver alem disso chega com a bola ja rolando -- o
   que e futebol, nao teleporte: jogador atrasado para o escanteio existe".

   PARA O ESCANTEIO, perfeito. PARA O PONTAPE DEPOIS DE UM GOL, nao: os 22
   estao amontoados numa area, entao `far` passa dos 13 m quase sempre -- por
   isso o caso e bimodal e nao raro.

   O QUE ESTA CAMADA NAO FAZ, e vale escrever porque eu comecei a escrever o
   contrario. Medido em `tools/fisica/o-reinicio.js`, 34 partidas, 160 pontapes,
   contra o build sem ela:

       grandeza                            sem OS-269    com OS-269
       R1 distancia MEDIA ao posto            15,9 m        16,0 m
       R6 fracao na PROPRIA METADE             100%          100%
       R2 atleta mais longe, PIOR caso        56,0 m        45,3 m
       R7 maior invasao da metade, PIOR       13,3 m         5,4 m

   A regra da propria metade JA ERA CUMPRIDA -- eu ia justificar esta camada
   com uma violacao que a medicao nao mostra, e R6 100% nos dois lados derruba
   isso. E R1 nao melhora porque ela nao pode melhorar: o posto `hx/hy` anda
   32,5 m durante a parada (R4), entao o atleta chega no alvo que perseguia e o
   posto ja e outro. Isso continua sendo a OS-264, em aberto.

   O QUE ELA ENTREGA e a CAUDA e a apresentacao: o pior atleta deixa de terminar
   a 56 m do posto, a pior invasao cai de 13,3 para 5,4 m, e -- o motivo de ela
   existir -- a caminhada TERMINA em vez de ser abandonada no meio, que era o
   que fazia o veu da OS-268 devolver a imagem com dez ou onze atletas parados
   em lugares aleatorios.

   O QUE ESTA CAMADA FAZ. So no pontape que nao e de comeco de tempo, estica
   `dead` ate caber a caminhada mais longa que a camada 18 acabou de agendar.
   Le `__spTarget` e NAO escreve nele -- foi a escrita nesse alvo compartilhado
   que derrubou as cinco tentativas da OS-264 (F2 da falta ia de 0,97 m de pior
   caso para 16-20 m). Aqui o alvo continua sendo o da camada 18, com a mesma
   caminhada e o mesmo destino; muda so quanto tempo ela tem para terminar.

   O CUSTO EM TEMPO DE JOGO e desprezivel, e ele importa: a R15.4 mediu que
   levar `dead` de 2,2 para 6,0 s em TODA bola parada derrubava gols em 14,6%,
   porque injeta fisica com o jogo parado dentro dos mesmos 90 minutos. Aqui
   sao dois ou tres pontapes por partida, ~3 s extras em cada: ~9 s de simulacao
   contra os ~5400 s de uma partida. E `dead` nao move o relogio da partida.
   =========================================================================== */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__OS269__) return;
const P = M.prototype; P.__OS269__ = true;

/* Teto proprio, e mais largo que o da camada 18 porque a distancia a cobrir e
   outra: depois de um gol o time inteiro esta a 30-40 m do proprio posto.
   5,5 s a ~6 m/s cobrem ~33 m, que e a travessia de meio campo. */
const TETO_PONTAPE = 5.5;         // s de simulacao
const VEL_CAMINHADA = 6.5 * 0.92; // m/s: a mesma da camada 18, para o mesmo alvo
const PARTIDA_JA_COMECOU = 0.5;   // s: no t≈0 nao ha posicao anterior de onde vir

function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); }

/* A caminhada mais longa que ainda falta, em metros. Somente LEITURA. */
function faltaMaior(sim) {
  let far = 0;
  try {
    const tms = sim.teams || [];
    for (let i = 0; i < tms.length; i++) {
      const pl = tms[i].players || [];
      for (let j = 0; j < pl.length; j++) {
        const p = pl[j];
        if (!p || p.red || !p.__spTarget) continue;
        const d = Math.hypot(num(p.__spTarget.x) - num(p.x), num(p.__spTarget.y) - num(p.y));
        if (d > far) far = d;
      }
    }
  } catch (_) { }
  return far;
}

/* Roda DEPOIS da camada 18: os alvos ja existem e `dead` ja foi esticado ate o
   teto dela. Aqui so se ele nao bastar. */
const oldKickoff = P._kickoff;
if (typeof oldKickoff === 'function') {
  P._kickoff = function (side, start) {
    const r = oldKickoff.apply(this, arguments);
    try {
      if (!start && num(this.t) > PARTIDA_JA_COMECOU) {
        const far = faltaMaior(this);
        if (far > 0) {
          const precisa = 0.35 + far / VEL_CAMINHADA;
          const janela = Math.min(TETO_PONTAPE, precisa);
          if (janela > num(this.dead)) this.dead = janela;
        }
      }
    } catch (_) { }
    return r;
  };
}

root.CDS_OS269 = Object.freeze({
  versao: 'OS-269', instalado: true,
  feature: 'KICKOFF_DEAD_WINDOW_FITS_THE_LONGEST_WALK',
  rngAdded: false, xgChange: false,
  tetoPontape: TETO_PONTAPE, escreveSpTarget: false
});
root.CDS_BUILD_ID = 'R19.19'; root.CDS_VERSION = '5.80.5-R19.19';
try { document.title = 'Copa dos Sonhos — R19.19'; } catch (_) { }
})(typeof window !== 'undefined' ? window : globalThis);
