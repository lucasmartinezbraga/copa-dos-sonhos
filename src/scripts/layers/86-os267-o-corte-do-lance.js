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

/* §OS-268 · O PONTAPE DEPOIS DO GOL TAMBEM PRECISA DE CORTE, e mais que a
   falta. Medido em ~165 pontapes (`tools/fisica/o-reinicio.js`): no instante em
   que a bola volta a rolar, o atleta esta a 9,7 m do posto na media e so 27%
   estao posicionados -- porque o POSTE anda 32,6 m durante a parada enquanto o
   corpo anda 24,3, e a caminhada persegue um alvo que foge.

   Quatro tentativas de consertar isso PELA POSICAO foram medidas e revertidas,
   todas pelo mesmo motivo: o alvo de caminhada e `__spTarget`, compartilhado
   com a falta, o escanteio, o lateral e o goleiro, e nao ha variante que nao
   contamine a cobranca (F2 de 0,97 m de pior caso para 16-20 m).

   O corte resolve por outro caminho: nao arruma nada, so nao MOSTRA a arrumacao.
   Zero escrita no motor.

   E o escuro aqui e ADAPTATIVO, nao cronometrado: ele dura enquanto ainda
   houver alguem com `__spTarget`, ou seja, enquanto o campo estiver se
   montando. Cronometro fixo erraria dos dois lados -- curto demais devolve a
   imagem com o time andando, longo demais deixa a tela preta com o campo ja
   pronto. Com teto duro, porque tela preta presa e pior que time desarrumado.

   §OS-268b · O TETO CAIU DE 1500 PARA 420 ms, e o motivo e que a PRIMEIRA
   versao media isto, em partida inteira a 3X:

       kickoff   dur 1835 ms   quadros pretos 91   alvos ao voltar 11
       kickoff   dur 1969 ms   quadros pretos 88   alvos ao voltar 11
       kickoff   dur 1933 ms   quadros pretos 91   alvos ao voltar 11

   Um segundo e meio de tela preta E a imagem voltando com onze jogadores ainda
   andando: o pior dos dois lados. O corte nao era longo demais por si -- ele
   era refem da caminhada, que levava ~1950 ms de parede porque a janela de
   cerimonia da OS-263 continuava valendo depois do pontape e mantinha tudo a
   1x. Com a §OS-263b encerrando a cerimonia no `_kickoff`, a mesma caminhada
   volta a ser burocracia (`_espera` 3,5x sobre o botao) e cabe em centenas de
   milissegundos. O teto so precisa cobrir isso, com folga.

   §OS-269b · O TETO ESCALA PELO BOTAO, e NAO tenta prever a caminhada.
   A primeira tentativa converteu os segundos de bola morta em milissegundos de
   parede pela conta do proprio laco de render, `parede = simulacao / (botao x
   ADIANTA_PARADA)`. Parece exata e erra na pratica, medido:

       dead 5,50 s   far 34,7 m   teto previsto 907 ms   caminhada real 569 ms
       dead 3,38 s   far 18,1 m   teto previsto 634 ms   caminhada real 634 ms

   A conta supoe `_espera` cheio a parada inteira, e basta um punhado de
   quadros em que ela nao valha para a parede esticar sem o teto esticar junto
   -- e ai o escuro para de se estender com o time ainda andando. Previsao
   errada e pior que teto generoso, porque quem DECIDE o fim do escuro nunca
   foi o teto: e a arrumacao terminar. O teto so existe para a tela nao ficar
   presa no preto se o campo nunca se montar.

   Entao ele escala pelo unico fator que escala o relogio de parede de forma
   conhecida -- o botao de velocidade -- e sobra de proposito. */
const ESCURO_BASE = 2400;             // ms de parede a 1X, dividido pelo botao
const ESCURO_MIN = 400;               // piso: abaixo disso o corte vira piscada
const ESCURO_MAX = 1800;              // teto duro: preto preso e pior que time torto

function tetoDoEscuro() {
  try {
    const vel = Number(root.__CDS_VELVIS);
    const botao = (vel > 0.05 && isFinite(vel)) ? vel : 1;
    return Math.max(ESCURO_MIN, Math.min(ESCURO_MAX, ESCURO_BASE / botao));
  } catch (_) { return 800; }
}

function aindaArrumando(sim) {
  try {
    const tms = (sim && sim.teams) || [];
    for (let i = 0; i < tms.length; i++) {
      const pl = tms[i].players || [];
      for (let j = 0; j < pl.length; j++) {
        const p = pl[j];
        if (p && !p.red && p.__spTarget) return true;
      }
    }
  } catch (_) { }
  return false;
}

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

/* O pontape depois do gol nao emite evento (`_kickoff(side, false)`), entao o
   gatilho e o proprio metodo. So LE o relogio e marca um estado de desenho --
   nao escreve nada no motor.

   O pontape de COMECO de partida (`start === true`) fica de fora: nao ha nada
   a esconder ali -- o dono acabou de mandar comecar e o campo ja esta montado
   na formacao. Cortar seria um piscar preto na primeira imagem do jogo. */
const oldKickoff = P._kickoff;
if (typeof oldKickoff === 'function') {
  P._kickoff = function (side, start) {
    const r = oldKickoff.apply(this, arguments);
    try {
      if (!start && (Number(this.t) || 0) > 0.5) {
        const t0 = agora();
        root.__CDS_CORTE = {
          tipo: 'kickoff', t0: t0, adaptativo: true,
          fimSaida: t0 + 200,
          fimEscuro: t0 + 200 + 180,
          fim: t0 + 200 + 180 + 300,
          /* `tetoEscuro` fica para a primeira consulta do render: a OS-269
             embrulha ESTE metodo, entao o `__CDS_PONTAPE_JANELA` deste lance
             so existe depois que este bloco terminou. Ler aqui pegaria a
             janela do pontape ANTERIOR. */
          tetoEscuro: null,
        };
      }
    } catch (_) { }
    return r;
  };
}

/* Consultada pelo laco de render, uma vez por quadro.
   Devolve { veu } — o alfa do preto, de 0 a 1. So isso: ver §OS-267b.

   O corte MORRE assim que a bola volta a rolar: se o motor reiniciou antes do
   previsto, nao ha nada a esconder e segurar a tela seria mentira.

   MAS SO ATE O ESCURO. Depois que a entrada comecou, a imagem ja esta voltando
   e matar o veu no meio dela troca um clareamento de 300 ms por um POP -- foi
   o que aconteceu nos tres pontapes medidos, em que a bola voltava a rolar aos
   ~600 ms e o corte era anulado ali, com a tela ainda meio preta. A entrada
   termina sempre: um fade sobre bola rolando e exatamente a cara de uma volta
   de transmissao. */
root.__cdsCorte = function (sim) {
  try {
    const C = root.__CDS_CORTE;
    if (!C) return null;
    const n = agora();
    if (n >= C.fim) { root.__CDS_CORTE = null; return null; }
    const morta = !!(sim && (Number(sim.dead) || 0) > 0);
    if (!morta && n > C.t0 && n < C.fimEscuro) { root.__CDS_CORTE = null; return null; }
    if (n < C.t0) return null;                       // ainda na camera lenta
    /* §OS-268 · o escuro ADAPTATIVO espera o campo se montar */
    if (C.adaptativo) {
      if (C.tetoEscuro == null) C.tetoEscuro = C.fimSaida + tetoDoEscuro();
      if (n >= C.fimSaida && n < C.tetoEscuro && aindaArrumando(sim)) {
        const desloca = C.fimEscuro - n;
        if (desloca < 16) { C.fimEscuro = n + 16; C.fim = C.fimEscuro + 300; }
      }
    }
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
root.CDS_OS268 = Object.freeze({
  versao: 'OS-268', instalado: true,
  feature: 'CUT_ALSO_COVERS_THE_KICKOFF_AFTER_A_GOAL',
  rngAdded: false, xgChange: false,
  escuroBase: ESCURO_BASE, escuroMin: ESCURO_MIN, escuroMax: ESCURO_MAX
});
root.CDS_BUILD_ID = 'R19.18'; root.CDS_VERSION = '5.80.5-R19.18';
try { document.title = 'Copa dos Sonhos — R19.18'; } catch (_) { }
})(typeof window !== 'undefined' ? window : globalThis);
