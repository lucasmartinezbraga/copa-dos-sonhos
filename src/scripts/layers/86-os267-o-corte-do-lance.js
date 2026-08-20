(function (root) {
'use strict';
/* OS-267 · O CORTE DO LANCE — a cobrança deixa de ser batida do nada
   ===========================================================================
   RELATO do dono, e ele traz junto a decisão de design:

     "eu digo que tipo ela eh batida do nada, os times as vezes tao ate mal
      comportado, qualquer coisa. Veja se eh melhor fazer um corte no lance e
      voltar com tudo ja reajustado ou reajustar ali mesmo."

   O sintoma nao e o apito (a OS-263 ja deu a pausa) nem o gesto (a OS-266 ja
   deu a batida lenta no contato). E o ESTADO DO CAMPO no instante da cobranca:
   a barreira ainda nao formou, o cobrador ainda nao chegou na bola, meio time
   esta onde a jogada morreu. A bola sai daquilo.

   AS DUAS SAIDAS, e a resposta e medida, nao de gosto.

   REAJUSTAR ALI MESMO foi tentado e reprovado, duas rodadas seguidas. A
   caminhada de reposicionamento escreve em `__spTarget`, que e COMPARTILHADO
   com a falta (camada 56, a barreira), o escanteio (18), o lateral (67/69) e o
   goleiro (72). Medido com `validar-lances.js`, mesma sonda e mesma janela:

       sem a caminhada nova   F2 bola no ponto da falta  17/17  100%  pior 0,97 m
       com ela, em tres variantes             84,6% / 95,8% / 90,9%  pior 16 a 20 m

   Um metro contra dezessete. Nao ha variante minha que nao contamine a
   cobranca -- e falta acontece 22 vezes por partida.

   O CORTE nao tem esse problema porque nao toca em nada do motor. Ele e o que
   a transmissao faz: sai da imagem, o reposicionamento acontece escondido e
   acelerado, e a imagem volta com o campo montado. Ninguem assiste vinte e dois
   jogadores caminhando; e ninguem ve o teleporte se a camera nao estiver la.

   E de graca em tempo: o reposicionamento ja acontece hoje, so que a olho nu e
   no ritmo errado. O corte custa ~700 ms de parede e devolve a cobranca pronta,
   contra ~3 s de gente andando.

   A COREOGRAFIA COMPLETA da falta fica assim, e cada peca ja existe:

       contato          camera lenta 0,40x por 650 ms   (OS-266)
       corte de saida   escurece em 240 ms              (aqui)
       corte de volta   clareia em 320 ms               (aqui)
       cerimonia        pausa em tempo real             (OS-263)
       cobranca

   APRESENTACAO PURA. Esta camada nao chama nada do motor: ela so LE `dead` e
   publica um estado que o laco de render consulta. Os mesmos `sim.step`
   acontecem, na mesma ordem, com os mesmos resultados.
   =========================================================================== */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__OS267__) return;
const P = M.prototype; P.__OS267__ = true;

/* Os eventos que merecem corte sao os que REPOSICIONAM o campo. Escanteio e
   lateral ficam de fora: a sonda de lances os mede em 100% ha rodadas, o
   reposicionamento deles e curto e local, e cortar a cada lateral seria
   epilepsia. */
const CORTA = {
  foul:    { espera: 700, saida: 240, escuro: 200, entrada: 320 },
  penalty: { espera: 700, saida: 260, escuro: 240, entrada: 360 },
  red:     { espera: 900, saida: 260, escuro: 260, entrada: 360 },
};

function agora() {
  try { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  catch (_) { return Date.now(); }
}

const oldEmit = P._emit;
P._emit = function (t, d) {
  try {
    const c = CORTA[t];
    if (c) {
      const t0 = agora() + c.espera;
      const C = root.__CDS_CORTE;
      /* eventos encadeados (falta -> cartao) nao remarcam o corte: fica o
         primeiro, senao a tela pisca duas vezes no mesmo lance */
      if (!C || t0 > C.fim) {
        root.__CDS_CORTE = {
          tipo: t, t0: t0,
          fimSaida: t0 + c.saida,
          fimEscuro: t0 + c.saida + c.escuro,
          fim: t0 + c.saida + c.escuro + c.entrada,
        };
      }
    }
  } catch (_) { }
  return oldEmit.apply(this, arguments);
};

/* Consultada pelo laco de render, uma vez por quadro.
   Devolve { veu } — o alfa do preto, de 0 a 1. So isso: ver §OS-267b.

   O corte MORRE assim que a bola volta a rolar: se o motor reiniciou antes do
   previsto, nao ha nada a esconder e segurar a tela seria mentira. */
root.__cdsCorte = function (sim) {
  try {
    const C = root.__CDS_CORTE;
    if (!C) return null;
    const n = agora();
    if (n >= C.fim) { root.__CDS_CORTE = null; return null; }
    const morta = !!(sim && (Number(sim.dead) || 0) > 0);
    if (!morta && n > C.t0) { root.__CDS_CORTE = null; return null; }
    if (n < C.t0) return null;                       // ainda na camera lenta
    let veu;
    if (n < C.fimSaida) veu = (n - C.t0) / (C.fimSaida - C.t0);
    else if (n < C.fimEscuro) veu = 1;
    else veu = 1 - (n - C.fimEscuro) / (C.fim - C.fimEscuro);
    /* §OS-267b · O CORTE E SO O VEU. A ACELERACAO FOI RETIRADA, E O PORQUE
       vale mais que ela.
       A ideia era adiantar a bola morta por baixo do escuro, para que a espera
       acontecesse onde ninguem esta olhando. Funciona no papel e destroi o
       lance na pratica, por uma razao estrutural: o laco de render e de passo
       FIXO e roda muitos `sim.step` por quadro desenhado. Com 9x sobre o 3X do
       botao, UM quadro come 0,45 s de simulacao -- e a cobranca saia dentro do
       laco, com a imagem voltando com a bola ja longe do ponto.
       Tres contencoes tentadas e medidas, todas insuficientes:
         margem de 0,55 s de `dead`      pior caso 22,3 -> 10,1 m
         margem de 1,20 s                pior caso  ~12 m
         guarda na condicao do laco      conserta a falta e CONGELA o jogo
                                         (`bola_parada_fora_do_campo` 48x)
         teto no orcamento de `acc`      volta a 90,5% com pior 18,9 m
       Referencia sem o corte: 36/36 com pior 1,31 m em duas passadas.
       O veu SOZINHO ja faz o trabalho -- ele esconde o reposicionamento, que e
       o pedido. A aceleracao era bonus, e bonus nao vale arriscar o lance nem
       o motor. Sem ela esta camada nao passa de um `fillRect` com alfa: nao
       pode afetar a simulacao nem por acidente. */
    return { veu: veu < 0 ? 0 : veu > 1 ? 1 : veu, tipo: C.tipo };
  } catch (_) { return null; }
};

root.CDS_OS267 = Object.freeze({
  versao: 'OS-267', instalado: true,
  feature: 'BROADCAST_CUT_HIDES_THE_RESTART_SETUP',
  rngAdded: false, xgChange: false, corta: CORTA
});
root.CDS_BUILD_ID = 'R19.17'; root.CDS_VERSION = '5.80.5-R19.17';
try { document.title = 'Copa dos Sonhos — R19.17'; } catch (_) { }
})(typeof window !== 'undefined' ? window : globalThis);
