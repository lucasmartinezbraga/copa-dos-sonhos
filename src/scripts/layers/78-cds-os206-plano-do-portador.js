

/* ════════════════════════════════════════════════════════════════════════════
   OS-206 · O PORTADOR PASSA A TER UM PLANO
   ════════════════════════════════════════════════════════════════════════════

   O QUE ESTAVA ERRADO, MEDIDO LENDO A PARTIDA
   -------------------------------------------
   `tools/fisica/narrar.js` mediu quanto tempo cada jogador fica com a bola no
   pe, em 4 partidas:

     posses individuais por partida   702
     mediana                          0,43 s
     73% das posses                   abaixo de meio segundo
     MAXIMA DA PARTIDA INTEIRA        4,4 s      (futebol real: ~1,1 s de media)

   E a bola passa 1,08 s VIAJANDO para cada 0,56 s num pe — o inverso do
   futebol. Ela e batata quente.

   A curva de sobrevivencia mostra que o problema nao e velocidade, e FORMA:

     ja com a bola ha 0,28s  ->  segue com ela em 26%   <- 74% morrem aqui
     ja com a bola ha 0,84s  ->  segue com ela em 67%
     ja com a bola ha 1,68s  ->  segue com ela em 82%

   Ha dois estados e nada entre eles: solta imediato, ou entra numa arrancada e
   nao larga mais. Falta o regime do meio, que e onde o futebol de verdade
   vive: recebe, da um toque, levanta a cabeca, espera o apoio, entao passa.

   A ARITMETICA DO ORCAMENTO
   -------------------------
   A posse inteira do motor e `settle` + um `decideT`:

     CAL.possession.firstTouchMin/Max   0,10 a 0,34 s   (controle da recepcao)
     CAL.timing.decisionInterval        0,28 s          (intervalo de decisao)

   0,2 + 0,28 = 0,48, que e a mediana medida de 0,43. Ou seja: nao existe
   estado nenhum de "estou com a bola e vou fazer algo por dois segundos". O
   jogador recebe, controla, e na PRIMEIRA decisao quase sempre passa.

   POR QUE NAO BASTA SUBIR `decisionInterval`
   ------------------------------------------
   Porque 0,28 -> 0,60 da batata quente mais lenta, nao futebol: todo mundo
   segura mais, inclusive quem esta com dois marcadores em cima. O que falta e
   INTENCAO QUE DURA e que depende da situacao — e que a marcacao chegando
   INTERROMPE, que e o que faz o jogador soltar de primeira quando tem de
   soltar de primeira.

   ONDE ISTO PODE MORAR (e por que nao no `decideT`)
   -------------------------------------------------
   O portao da decisao esta no core:

       if (!ball.traveling && ball.owner && ball.owner.settle <= 0
           && this.decideT <= 0) { ...decide... }

   Sao duas travas. `decideT` NAO serve: a camada R13 reescreve ele todo quadro
   por fase de jogo (`Math.min(sim.decideT, .20/.31/.44)`) e so o abaixa —
   qualquer valor que eu escrevesse seria derrubado, e eu teria mais uma edicao
   silenciosamente morta como as tres que ja custaram rodada de medicao neste
   projeto.

   `settle` ninguem mais toca depois da recepcao, e semanticamente e exatamente
   o que eu quero dizer: "este jogador ainda esta resolvendo o que fazer". Ele
   continua correndo e a bola continua colada nele (`_ballGlue`), entao o que
   se ve e um jogador conduzindo — que e o objetivo.

   CUIDADO REGISTRADO: `settle > 0 && settle < 0,45` e lido em dois lugares do
   core como "finalizacao de primeira" (volley/firstTime). Por isso o plano
   nunca escreve valores DENTRO dessa janela — usa 0,60, acima dela — senao um
   passe normal viraria voleio.
   ════════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  const M = root && root.MatchSim;
  if (!M || !M.prototype || M.prototype.__OS206__) return;
  const P = M.prototype;
  P.__OS206__ = true;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finito = (v, d) => Number.isFinite(v) ? v : (d === undefined ? 0 : d);
  const _getAttr = (typeof getAttr === 'function') ? getAttr : () => 60;
  const FL = Number(root.FL) || 105, FW = Number(root.FW) || 68;

  const T = (root && root.CDS_OS206_TUNE) || {};
  const num = (v, padrao) => Number.isFinite(v) ? v : padrao;

  /* Acima da janela de voleio (0,45) para nao transformar passe em finalizacao
     de primeira. Ver o cuidado registrado no cabecalho. */
  const SEGURA = 0.60;

  /* Quanto tempo o plano dura, em segundos de simulacao. A mediana atual e
     0,43 s e o alvo e a media do futebol real, ~1,1 s. */
  const BASE_LIVRE = num(T.baseLivre, 1.30);   // sem ninguem por perto
  const BASE_APERTO = num(T.baseAperto, 0.05); // com marcador colado
  const RAIO_APERTO = num(T.raioAperto, 2.2);  // marcador a esta distancia: solta
  const RAIO_LIVRE = num(T.raioLivre, 9.0);    // acima disto, espaco de sobra
  const TETO = num(T.teto, 3.2);               // nenhum plano passa disto

  /* ATE ONDE O PLANO VALE — medido, nao escolhido.
     Segurar a bola em TODO o campo custou 20% dos chutes e 20% dos gols
     (11/13 -> 6/13 no placar de design, e a varredura de duracao nao
     recuperou: mesmo com plano curto os chutes ficaram em 18,2 contra 21,2).
     O motivo e estrutural e vale registrar: este motor so gera chance com
     CIRCULACAO RAPIDA. Ele nao tem construcao de jogada com posse — tirar
     velocidade de circulacao no ultimo terco desmonta o ataque inteiro.

     Entao o plano vale onde ele conserta a aparencia sem tocar na maquina de
     criar chance: saida de bola e meio-campo. Do ultimo terco em diante o
     motor volta a ser o que era.

     Varrido em 120 partidas: com o plano valendo ate 62% do campo o jogo perde
     chute (19,5, abaixo do minimo de 20). Valendo so ate a METADE do campo,
     sobe para 22,1 e o placar de design vai a 12/13 — melhor que os 11/13 de
     antes da camada, porque as faltas entram na faixa de brinde. */
  const LIMITE_AVANCO = num(T.limiteAvanco, 0.50);

  /* DEPOIS DE PASSAR PELO MARCADOR, CONDUZ.
     A narracao acusou "drible parado": o mesmo jogador driblando 3 e 4 vezes
     no mesmo pedaco de campo. A causa e que o drible bem-sucedido escreve um
     destino 7 m adiante (`o._tx/_ty` no core) e a decisao seguinte chega em
     0,28 s — antes de ele ter andado esses 7 m. Ele "supera" tres marcadores
     no mesmo lugar em menos de um segundo.

     Aqui o drible ganho estende o plano: ele conduz para o espaco que acabou
     de abrir em vez de driblar de novo. E durante essa conducao a marcacao NAO
     interrompe o plano — ele ja passou pelo homem, e quem ficou para tras
     estar a dois metros e consequencia do drible, nao pressao nova. */
  const CARREGA = num(T.carrega, 0.70);

  /* Distancia do adversario de campo mais proximo do portador. */
  function aperto(sim, o) {
    const rivais = sim.teams[1 - o.team].players || [];
    let d = Infinity;
    for (const r of rivais) {
      if (!r || r.red || r.isGK) continue;
      const dd = Math.hypot(r.x - o.x, r.y - o.y);
      if (dd < d) d = dd;
    }
    return d;
  }

  /* Quanto este jogador, nesta situacao, seguraria a bola.
     Nao ha alvo numerico aqui: a forma e que importa — colado solta, livre
     conduz, e quem tem tecnica e frieza segura mais que quem nao tem. */
  function duracaoDoPlano(sim, o) {
    const ap = aperto(sim, o);
    /* 0 colado, 1 livre */
    const folga = clamp((ap - RAIO_APERTO) / (RAIO_LIVRE - RAIO_APERTO), 0, 1);
    let t = BASE_APERTO + (BASE_LIVRE - BASE_APERTO) * folga;

    /* atributo: tecnica e frieza compram tempo; 60 e o jogador medio */
    const tec = (finito(_getAttr(o, 'tecnica'), 60) + finito(_getAttr(o, 'frieza'), 60)) / 2;
    t *= 0.75 + clamp(tec, 20, 99) / 100 * 0.55;

    /* zona: saindo de tras se joga mais devagar. Do ultimo terco em diante o
       plano nao vale (ver LIMITE_AVANCO) e o motor volta ao ritmo original. */
    const dir = finito(sim.teams[o.team] && sim.teams[o.team].attackDir, 1) || 1;
    const avanco = dir > 0 ? o.x : (FL - o.x);
    if (avanco > FL * LIMITE_AVANCO) return 0;
    if (avanco < FL * 0.33) t *= 1.25;                       // saida de bola

    /* cansado pensa mais devagar, mas tambem aguenta menos a marcacao */
    const st = clamp(finito(o.stamina, 100), 20, 100);
    t *= 0.85 + st / 100 * 0.20;

    return clamp(t, 0.05, TETO);
  }

  const oldStep = P.step;
  P.step = function (dt) {
    const b = this.ball;
    const o = b && b.owner;

    if (o && !b.traveling && this.dead <= 0) {
      /* comecou uma posse nova: escolhe o plano uma vez */
      if (o.__os206Dono !== b) {
        o.__os206Dono = b;
        o.__os206Ate = finito(this.t) + duracaoDoPlano(this, o);
      }
      const conduzindo = finito(this.t) < finito(o.__os206Carrega);
      if (finito(this.t) < finito(o.__os206Ate) || conduzindo) {
        /* A MARCACAO INTERROMPE O PLANO. Sem isto o jogador seguraria a bola
           com dois em cima, que e o oposto do que se quer: e justamente a
           chegada da pressao que produz o passe de primeira.
           Excecao: logo depois de um drible ganho ele esta conduzindo para o
           espaco que abriu — ver CARREGA. */
        if (!conduzindo && aperto(this, o) <= RAIO_APERTO) o.__os206Ate = 0;
        else if (finito(o.settle) <= 0) o.settle = SEGURA;
      }
    } else if (o && b && b.traveling) {
      o.__os206Dono = null;
    }

    return oldStep.apply(this, arguments);
  };

  /* Solta a marca quando a posse acaba, para o proximo dono comecar limpo. */
  const oldGive = P._giveBall;
  if (typeof oldGive === 'function') {
    P._giveBall = function (m) {
      if (m) { m.__os206Dono = null; m.__os206Ate = 0; m.__os206Carrega = 0; }
      return oldGive.apply(this, arguments);
    };
  }

  /* O drible ganho vira conducao. Esta camada e a ultima, entao ve o evento
     antes de todas as outras — e so precisa marcar o tempo. */
  const oldEmit = P._emit;
  P._emit = function (tipo, d) {
    if (tipo === 'dribble' && d && d.ok && d.by) {
      d.by.__os206Carrega = finito(this.t) + CARREGA;
    }
    return oldEmit.apply(this, arguments);
  };

  root.CDS_OS206 = Object.freeze({
    versao: 'OS-206', instalado: true,
    baseLivre: BASE_LIVRE, baseAperto: BASE_APERTO, teto: TETO,
  });
})(typeof window !== 'undefined' ? window : globalThis);
