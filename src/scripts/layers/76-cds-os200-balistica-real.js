
/* ════════════════════════════════════════════════════════════════════════════
   OS-200 · BALISTICA REAL E GEOMETRIA DA META
   ════════════════════════════════════════════════════════════════════════════

   O QUE ESTAVA ERRADO
   -------------------
   O motor tinha um integrador de verdade em `_ballTravel` (40-match-engine,
   "Fisica continua da bola"): gravidade, restituicao 0,4, atrito. Ele nunca
   rodava. Desde a camada 581 todo chute, passe e desvio grava `_physicsPlan`,
   e o `_ballTravel` daquela camada troca a integracao por reproducao de uma
   curva pre-assada:

       z = lerp(z0, targetZ, p) + 4*arc*p*(1-p)

   Isso e uma parabola no PROGRESSO, nao no tempo. As consequencias medidas na
   bateria de 48 partidas do R19.08:

     - aceleracao vertical implicita de -4,84 m/s^2, e nem constante;
     - lancamento de 40 m com apice 2,35 m e passe rasteiro de 40 m levavam
       exatamente o mesmo tempo (1,818 s): a duracao era d/v, indiferente ao
       arco;
     - `quiques: 2` em 48 partidas — a bola nao quicava;
     - `passaramPorCimaDoTravessao: 0`, com `zMaximoNaLinha: 1,794` contra um
       travessao de 2,44 m.

   O teto de altura era duplo: `_physicalTargetZ` travava qualquer alvo em
   2,35 m e um chute sem z explicito em 1,74 m. A OS-104 ja tinha medido isso e
   documentado que "o motor era fisicamente incapaz de mandar por cima do gol",
   mas a correcao ficou desligada porque ligar derrubava o piso de gols.

   POR QUE DERRUBAVA, E POR QUE ISTO VEM JUNTO
   -------------------------------------------
   Porque o desfecho era sorteado ANTES da bola sair do pe:

       if (chance(pGoal)) _startTravel(..., () => this._goal(o))

   A trajetoria era fabricada para chegar num resultado ja escolhido. Mexer na
   trajetoria mexia no placar, porque trajetoria e desfecho eram o mesmo objeto.
   Tirar o teto sem inverter a causalidade produziria o absurdo oposto: chutes
   marcados como GOL passando por cima do travessao.

   Por isso balistica e inversao entram na MESMA mudanca. Este arquivo cuida da
   fisica e da geometria; a inversao do desfecho esta em `_shoot`
   (40-match-engine-and-manager-ai.js), que passa a mirar em 3D e a perguntar a
   este modulo onde a bola realmente foi parar.

   O QUE ESTE ARQUIVO SUBSTITUI
   ----------------------------
   `_planPhysicalSegment` e `_trajectoryPoint` sao REESCRITOS, nao encadeados:
   a geracao de trajetoria inteira passa a ser integracao numerica. O contrato
   do segmento (samples uniformes no tempo, duration, origin, target, speed)
   e preservado byte a byte na forma, entao todo o consumidor a jusante —
   reproducao em `_ballTravel`, timeline visual, replays, solucionadores de
   interceptacao — continua funcionando sem saber que a fonte mudou.

   ATENCAO A UM CONTRATO NAO OBVIO: `segmentPoint` indexa as amostras por
   `t/duration * (n-1)`, ou seja, ASSUME espacamento uniforme no tempo. O
   integrador roda com passo fixo e reamostra uniformemente por causa disso.
   ════════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  const M = root && root.MatchSim;
  if (!M || !M.prototype || M.prototype.__OS200__) return;
  const P = M.prototype;
  P.__OS200__ = true;

  const VERSAO = 'OS-200';

  /* ---------------------------------------------------------------- campo */
  const FL = Number(root.FL) || 105, FW = Number(root.FW) || 68;
  const POSTE = 3.66;      // meia-largura interna da meta (7,32 m de boca)
  const TRAVESSAO = 2.44;  // altura da meta
  const RAIO_TRAVE = 0.06; // espessura do poste/travessao, para o ramo "na trave"

  /* ------------------------------------------------------------- constantes
     Bola oficial: m = 0,43 kg, r = 0,11 m, A = 0,0380 m^2. Com rho = 1,225 e
     Cd = 0,25 (regime turbulento, que e onde vive um chute forte):

         k = 0,5 * rho * Cd * A / m = 0,5 * 1,225 * 0,25 * 0,0380 / 0,43
           ~= 0,0135 1/m

     A aceleracao de arrasto e k*v^2, oposta a velocidade. */
  const G = 9.81;
  const K_ARRASTO = 0.0135;
  const RESTITUICAO = 0.55;    // quique vertical na grama
  const ATRITO_QUIQUE = 0.78;  // perda horizontal em cada quique
  const ATRITO_ROLAGEM = 0.62; // m/s^2 de desaceleracao com a bola rolando
  const LIMIAR_ROLAGEM = 0.35; // |vz| abaixo disto, junto ao chao, e rolagem
  const PASSO = 1 / 240;       // passo interno da integracao
  const MAX_PASSOS = 1800;     // 7,5 s de voo: teto de seguranca

  const EPS = 1e-6;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finito = (v, d) => Number.isFinite(v) ? v : (d === undefined ? 0 : d);
  const dist2d = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

  /* Ligacoes com os utilitarios do motor. Sao declaracoes de topo de outro
     <script>, entao existem no escopo lexical global e sao alcancaveis por
     identificador nu — mas resolvemos uma vez aqui, no carregamento (que ja e
     depois do core), para nao pagar o typeof em laco nem quebrar caso alguma
     delas mude de casa. */
  const _facet = (typeof facet === 'function') ? facet : () => 65;
  const _chance = (typeof chance === 'function') ? chance : p => Math.random() < p;
  const _R = (typeof R === 'function') ? R : (a, b) => {
    const u = Math.random();
    return a === undefined ? u : b === undefined ? u * a : a + u * (b - a);
  };

  /* `CAL` e uma const do escopo do modulo do motor, entao NAO chega ate aqui —
     a camada OS-39 ja tinha esbarrado nisso e resolveu chumbando o numero. A
     tabela de calibracao em si e global sob outro nome, entao lemos dela e o
     valor continua vindo de uma fonte so. */
  const _CAL = (typeof ENGINE_CALIBRATION !== 'undefined' && ENGINE_CALIBRATION) || {};
  const calRestart = (nome, padrao) =>
    (_CAL.restarts && Number.isFinite(_CAL.restarts[nome])) ? _CAL.restarts[nome] : padrao;

  /* ─── constantes de calibracao ────────────────────────────────────────────
     Estes numeros governam quantos chutes acabam em gol, e por isso precisam
     ser medidos, nao escolhidos. `CDS_OS200_TUNE` existe para a bateria poder
     varrer valores sem reconstruir o bundle a cada tentativa; em producao ele
     nao esta definido e valem os padroes abaixo, que sao os calibrados. */
  const T = (root && root.CDS_OS200_TUNE) || {};
  const num = (v, padrao) => Number.isFinite(v) ? v : padrao;

  /* Valores promovidos pela grade (reports/calib-06.json, 60 partidas por
     configuracao, semente base 4200000), ja com cabeceio e finalizacao de
     cruzamento passando pela geometria: 1,97 gol/partida e 38,0% de
     finalizacoes no alvo, contra 1,88 e 36,8% do R19.08 na mesma amostra.

     A resposta e INGREME: entre erroBase 15,0 e 16,5 os gols caem de 2,18 para
     1,45, porque a boca do gol e uma janela fixa e a fracao que entra despenca
     assim que a dispersao passa da meia-largura. Mexer nestes numeros exige
     rodar a grade, nao estimar. */
  const ERRO_BASE = num(T.erroBase, 15.3);         // dispersao lateral de referencia
  const ERRO_VERTICAL = num(T.erroVertical, 0.30); // erro vertical relativo ao lateral
  const VIES_ALTO = num(T.viesAlto, 0.16);         // chute errado sobe mais do que afunda
  const DEFESA_BASE = num(T.defesaBase, 0.80);     // chance de defesa com folga zero
  const DEFESA_POR_METRO = num(T.defesaPorMetro, 0.30);
  const BLOQUEIO_RAIO = num(T.bloqueioRaio, 0.85);
  const BLOQUEIO_AVANCO = num(T.bloqueioAvanco, 3.2);
  /* A formula de forca herdada do motor entrega 34-50 m/s. Isso nunca importou
     porque a velocidade so mexia em `duration = d/v`; agora ela decide quanto
     tempo o goleiro tem, e 40 m/s (144 km/h) em chute comum nao existe: a media
     real fica perto de 25 m/s. A escala corrige a faixa sem jogar fora o
     ordenamento por atributo que a formula original produz. */
  const FORCA_ESCALA = num(T.forcaEscala, 0.62);
  /* Compensar o arrasto na bola rasteira para o tempo de chegada bater com o
     que o motor assumiu. Desligavel para medir os dois mundos. */
  const TEMPO_RASTEIRO = T.tempoRasteiro === undefined ? true : !!T.tempoRasteiro;

  /* xG REGISTRADO x xG REALIZADO.
     `pGoal` deixou de ser a probabilidade de gol e virou entrada de pontaria,
     entao ele nao serve mais como xG cru: medido em 60 partidas, o motor
     registrava 2,41 de xG para 1,68 gol, e a tela diria "azarado" toda
     partida. A escala abaixo e a razao medida entre gol realizado e pGoal
     acumulado, para a coluna de xG voltar a significar gols esperados.
     Refaça a medicao se mexer em ERRO_BASE, DEFESA_BASE ou FORCA_ESCALA. */
  /* A2 · RE-DERIVADA depois que o modelo de defesa mudou, como o parágrafo
     acima manda. Com o goleiro escolhendo a melhor folga em vez da primeira,
     a razão gol/pGoal caiu: 300 partidas davam xG 3,15 para 2,93 gols, e a
     coluna passou a superestimar de novo. 0,70 × 2,93/3,15 = 0,651. */
  const XG_ESCALA = num(T.xgEscala, 0.651);
  P._os200EscalaXg = function () { return XG_ESCALA; };

  /* Ruido em forma de sino, somando dois uniformes. E limitado em [-1,1], o
     que importa: uma normal de verdade produz caudas que colocariam a bola na
     arquibancada de vez em quando. */
  const sino = () => (_R() + _R() - 1);

  /* ═══════════════════════════════════════════════════════ 1. INTEGRADOR ═══ */

  /* Avanca um estado {x,y,z,vx,vy,vz} por dt com gravidade, arrasto quadratico,
     quique e rolagem. Muta o estado — e chamado centenas de milhares de vezes
     por partida e alocar aqui custaria caro. */
  function avancar(s, dt) {
    const v = Math.hypot(s.vx, s.vy, s.vz);
    const kd = K_ARRASTO * v;
    let ax = -kd * s.vx, ay = -kd * s.vy, az = -kd * s.vz - G;

    const rolando = s.z <= 1e-4 && Math.abs(s.vz) < LIMIAR_ROLAGEM;
    if (rolando) {
      /* No chao a normal cancela a gravidade. O arrasto do ar continua valendo
         — numa bola rolando a 20 m/s ele ainda domina — e some-se a ele a
         resistencia de rolagem, que age contra a direcao do movimento e nao
         contra v^2. */
      s.z = 0; s.vz = 0; az = 0;
      const vh = Math.hypot(s.vx, s.vy);
      if (vh > EPS) {
        const perda = Math.min(vh / dt, ATRITO_ROLAGEM);
        ax -= s.vx / vh * perda;
        ay -= s.vy / vh * perda;
      }
    }

    s.vx += ax * dt; s.vy += ay * dt; s.vz += az * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;

    if (s.z < 0) {
      /* Quique: espelha a penetracao para a bola nao afundar no gramado e
         devolve parte da energia.

         O atrito horizontal e proporcional a VIOLENCIA do impacto. Aplicar a
         perda cheia em todo toque no chao fazia a bola morrer em metros: um
         passe rasteiro sai com vz de poucos centimetros por segundo e roca o
         gramado dezenas de vezes: com 22% de perda fixa por toque nao sobra
         nada. Uma bola que so encosta praticamente nao perde velocidade; uma
         que desce de 20 m perde muito. */
      const impacto = Math.min(1, Math.abs(s.vz) / 4);
      const atrito = 1 - (1 - ATRITO_QUIQUE) * impacto;
      s.z = -s.z * RESTITUICAO;
      s.vz = -s.vz * RESTITUICAO;
      s.vx *= atrito; s.vy *= atrito;
      if (impacto > 0.08) s.quiques = (s.quiques || 0) + 1;
      if (Math.abs(s.vz) < LIMIAR_ROLAGEM) { s.z = 0; s.vz = 0; }
    }
  }

  function estado(o, vx, vy, vz) {
    return { x: finito(o.x), y: finito(o.y), z: Math.max(0, finito(o.z)), vx, vy, vz, quiques: 0 };
  }

  /* ═════════════════════════════════════════════ 2. SOLUCIONADOR DE SAIDA ═══

     Dado origem, alvo 3D e velocidade de saida, acha o angulo de elevacao cuja
     trajetoria passa pelo alvo. A altura no alvo NAO e monotonica no angulo:
     ela sobe ate um angulo de melhor alcance e depois cai. Entao primeiro
     localizamos esse maximo por busca ternaria e so depois bisectamos no ramo
     escolhido — tenso (rasteiro) ou lobbed (por cima). */

  const ELEV_MIN = -0.12, ELEV_MAX = 1.35;

  /* Integra ate cruzar a distancia horizontal `alvoD` e devolve a altura, a
     velocidade e o instante da chegada. `z` vem -Infinity se a bola morre
     antes de chegar. */
  function chegadaEm(o, ux, uy, alvoD, vel, theta) {
    const vh = vel * Math.cos(theta);
    const s = estado(o, ux * vh, uy * vh, vel * Math.sin(theta));
    let percorrido = 0, t = 0;
    for (let i = 0; i < MAX_PASSOS; i++) {
      const xAnt = s.x, yAnt = s.y, zAnt = s.z;
      avancar(s, PASSO);
      t += PASSO;
      const d = dist2d(xAnt, yAnt, s.x, s.y);
      if (percorrido + d >= alvoD) {
        const f = d > EPS ? (alvoD - percorrido) / d : 0;
        return { z: zAnt + (s.z - zAnt) * f, v: Math.hypot(s.vx, s.vy), t };
      }
      percorrido += d;
      /* parou de progredir (rolando ate a inercia acabar) */
      if (d < 1e-5) break;
    }
    return { z: -Infinity, v: 0, t: Infinity };
  }

  const alturaEm = (o, ux, uy, alvoD, vel, theta) => chegadaEm(o, ux, uy, alvoD, vel, theta).z;

  /* Usado pelo regime tenso (chute): a forca e do jogador, entao a incognita e
     o angulo. `alto` escolhe o ramo lobbed, mantido porque `_trajectoryPoint`
     pode pedir qualquer um dos dois. */
  function resolverElevacao(o, alvo, vel, alto) {
    const dx = alvo.x - o.x, dy = alvo.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-3) return { theta: 0, ux: 1, uy: 0, d: 1e-3 };
    const ux = dx / d, uy = dy / d;
    const zAlvo = Math.max(0, finito(alvo.z));

    /* busca ternaria pelo angulo de maior altura no alvo */
    let lo = ELEV_MIN, hi = ELEV_MAX;
    for (let i = 0; i < 22; i++) {
      const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3;
      if (alturaEm(o, ux, uy, d, vel, a) < alturaEm(o, ux, uy, d, vel, b)) lo = a; else hi = b;
    }
    const thetaPico = (lo + hi) / 2;
    const zPico = alturaEm(o, ux, uy, d, vel, thetaPico);

    /* Velocidade insuficiente para chegar na altura pedida: entrega o melhor
       angulo possivel. Quem chamou decide se aumenta a forca. */
    if (!(zPico >= zAlvo)) return { theta: thetaPico, ux, uy, d, insuficiente: true };

    let a, b;
    if (alto) { a = thetaPico; b = ELEV_MAX; }
    else { a = ELEV_MIN; b = thetaPico; }
    for (let i = 0; i < 26; i++) {
      const m = (a + b) / 2;
      const z = alturaEm(o, ux, uy, d, vel, m);
      /* No ramo baixo a altura cresce com o angulo; no alto, decresce. */
      const acima = alto ? (z > zAlvo) : (z < zAlvo);
      if (acima) a = m; else b = m;
    }
    return { theta: (a + b) / 2, ux, uy, d };
  }

  /* ─── bola alta ────────────────────────────────────────────────────────────
     Aqui a incognita e a FORCA, nao o angulo. Resolver o ramo alto na
     velocidade que o motor pediu produzia bola de lua: para cobrir 40 m a
     22 m/s o ramo alto exige 63 graus de saida, o que da 13,7 m de apice e
     5,7 s de voo. Ninguem lanca assim. Um lancamento de verdade sai perto de
     30 graus e a forca e que se ajusta a distancia — entao fixamos um angulo
     plausivel por tipo de bola e procuramos a velocidade que pousa no alvo.
     A altura no alvo cresce de forma monotonica com a velocidade em angulo
     fixo, o que torna a bisecao segura. */
  function anguloDe(kind, passKind) {
    const pk = passKind || kind;
    /* §OS-219 · OS ANGULOS ESTAVAM RASOS E O ARCO NAO EXISTIA.
       Relato do dono: "o arco do cruzamento, lancamento, escanteio, bola
       aerea ainda ta irreal". 27 graus e trajetoria de chute tenso, nao de
       bola alcada -- ela sai reta, cruza o campo esticada e nao cai. No
       futebol a bola alcada sai entre 35 e 45 graus, justamente para SUBIR,
       parar no ar e DESCER sobre a cabeca de alguem.
       O escanteio entra por aqui tambem: `_setCorner` cobra por `_cross`. */
    if (pk === 'throw') return 0.72;   // ~41 graus: arremesso lateral
    if (pk === 'cross') return 0.66;   // ~38 graus: cruzamento que cai na area
    return 0.68;                       // ~39 graus: lancamento
  }

  function resolverAlta(o, alvo, theta) {
    const dx = alvo.x - o.x, dy = alvo.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-3) return { vel: 12, sol: { theta: 0, ux: 1, uy: 0, d: 1e-3 } };
    const ux = dx / d, uy = dy / d;
    const zAlvo = Math.max(0, finito(alvo.z));
    let lo = 6, hi = 46;
    if (alturaEm(o, ux, uy, d, hi, theta) < zAlvo) return { vel: hi, sol: { theta, ux, uy, d } };
    for (let i = 0; i < 26; i++) {
      const m = (lo + hi) / 2;
      if (alturaEm(o, ux, uy, d, m, theta) < zAlvo) lo = m; else hi = m;
    }
    return { vel: (lo + hi) / 2, sol: { theta, ux, uy, d } };
  }

  /* ─── bola rasteira ────────────────────────────────────────────────────────
     Um passe no chao NAO e um projetil que precisa pousar no alvo. Tratar como
     projetil obriga um lob: para cair a 40 m com 22 m/s a fisica exige sair a
     27 graus, e o "passe rasteiro" viraria bola aerea de 3 m de altura. O que
     um passe rasteiro e, de fato, e uma bola batida quase rente ao gramado que
     ROLA ate o companheiro. Entao aqui a incognita nao e o angulo — e a forca:
     mantemos a saida rasteira e procuramos a velocidade que faz a bola chegar.
     Se a pedida nao chega (o arrasto e a rolagem comem muito numa bola batida
     longe), ela sobe, que e exatamente o que um jogador faz. */
  /* OS-203 · A BOLA RASTEIRA NAO DECOLA.
     A versao anterior saia a 0,03 rad (~1,7 graus) "rente, nao colada". Com
     integracao real isso e um LANCAMENTO, nao um passe: medido numa partida de
     verdade, todo passe rasteiro fazia um salto de 14 cm, quicava em 4 cm,
     quicava em 1 cm — a razao entre os saltos e exatamente RESTITUICAO^2 =
     0,3025, e o traco de tela mostrava o par (0,141 m / 0,043 m) se repetindo a
     cada passe. Sao 54 subidas por minuto de jogo, 92% delas abaixo de 30 cm:
     a bola atravessava o campo saltitando como pedra ricocheteando na agua.

     Zero e o valor certo, nao um valor pequeno: com theta = 0 e z = 0 o
     integrador entra no ramo de rolagem no primeiro passo e a bola nunca deixa
     o gramado — ela rola, perde velocidade para o arrasto e para a resistencia
     de rolagem, e chega viva do outro lado. Que e o que um passe rasteiro e. */
  const ELEV_RASTEIRA = 0;
  const CHEGADA_MINIMA = num(T.chegadaMinima, 7.5); // m/s de bola viva na chegada

  function resolverRasteira(o, alvo, vel) {
    const dx = alvo.x - o.x, dy = alvo.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-3) return { vel, sol: { theta: 0, ux: 1, uy: 0, d: 1e-3 } };
    const ux = dx / d, uy = dy / d;
    /* O `speed` que o motor passa foi calibrado num mundo SEM desaceleracao,
       onde `duration = d/v` era exato. Ele nao e a velocidade de saida do pe:
       e a velocidade MEDIA que o motor assumiu para o passe chegar na hora
       certa — e toda a camada tatica (interceptacoes, corridas de recepcao,
       linha de impedimento) foi calibrada nesse tempo de chegada.

       Traduzir isso com honestidade nao e ignorar o arrasto: e bater mais
       forte, que e o que um jogador faz. Procuramos a velocidade de SAIDA cujo
       tempo de chegada bate com o que o motor assumiu. A bola desacelera de
       verdade no caminho — so que agora ela sai com o peso certo.

       Isto vale so para bola rasteira. Lancamento e cruzamento continuam
       levando o tempo que a fisica manda: uma bola alta demorar mais que uma
       rasteira e justamente o que esta camada veio consertar. */
    const alvoT = TEMPO_RASTEIRO ? d / vel : Infinity;
    let v = vel;
    if (Number.isFinite(alvoT)) {
      let lo = vel, hi = vel * 3.2;
      /* o tempo de chegada cai de forma monotonica com a velocidade de saida */
      if (chegadaEm(o, ux, uy, d, hi, ELEV_RASTEIRA).t > alvoT) v = hi;
      else {
        for (let i = 0; i < 20; i++) {
          const m = (lo + hi) / 2;
          if (chegadaEm(o, ux, uy, d, m, ELEV_RASTEIRA).t > alvoT) lo = m; else hi = m;
        }
        v = (lo + hi) / 2;
      }
    }
    /* Piso: a bola ainda precisa chegar viva. Uma que chega rastejando levou
       tempo demais e o companheiro ja saiu dali. */
    for (let i = 0; i < 14; i++) {
      const c = chegadaEm(o, ux, uy, d, v, ELEV_RASTEIRA);
      if (Number.isFinite(c.z) && c.v >= CHEGADA_MINIMA) break;
      v *= 1.14;
    }
    return { vel: v, sol: { theta: ELEV_RASTEIRA, ux, uy, d } };
  }

  /* ═══════════════════════════════════════════════ 3. GERACAO DO SEGMENTO ═══ */

  /* Integra a trajetoria inteira e reamostra uniformemente no tempo, que e o
     que `segmentPoint` assume. `duracao` e o instante em que a bola chega ao
     alvo — nao mais d/v, e sim o tempo que a fisica levou. */
  function trajetoria(o, vel, sol, alvo) {
    const vh = vel * Math.cos(sol.theta);
    const s = estado(o, sol.ux * vh, sol.uy * vh, vel * Math.sin(sol.theta));
    const bruto = [{ t: 0, x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz }];
    let percorrido = 0, t = 0, duracao = null;
    for (let i = 0; i < MAX_PASSOS; i++) {
      const xAnt = s.x, yAnt = s.y;
      avancar(s, PASSO);
      t += PASSO;
      percorrido += dist2d(xAnt, yAnt, s.x, s.y);
      bruto.push({ t, x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz });
      if (duracao == null && percorrido >= sol.d) duracao = t;
      /* segue um pouco alem do alvo para o ramo que precisa ver a bola passar
         da linha (chute que sai, bola que quica adiante) */
      if (duracao != null && t >= duracao + 0.35) break;
      if (duracao == null && i > 3 && Math.hypot(s.vx, s.vy, s.vz) < 0.05) { duracao = t; break; }
    }
    if (duracao == null) duracao = t;
    duracao = Math.max(1 / 60, duracao);

    /* reamostragem uniforme */
    const n = Math.max(8, Math.min(420, Math.ceil(duracao * 120)));
    const amostras = [];
    for (let i = 0; i <= n; i++) {
      const tt = duracao * i / n;
      const u = clamp(tt / PASSO, 0, bruto.length - 1);
      const k = Math.floor(u), f = u - k;
      const a = bruto[k], b = bruto[Math.min(bruto.length - 1, k + 1)];
      amostras.push({
        t: tt,
        x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: Math.max(0, a.z + (b.z - a.z) * f),
        vx: a.vx + (b.vx - a.vx) * f, vy: a.vy + (b.vy - a.vy) * f, vz: a.vz + (b.vz - a.vz) * f,
      });
    }
    return { amostras, duracao, bruto, quiques: s.quiques || 0 };
  }

  /* Altura de mira por tipo de bola, agora SEM teto artificial. O unico limite
     e o do proprio lance: um passe rasteiro nao sobe porque a mira dele e o pe
     do companheiro, nao porque uma constante o proibia. */
  P._physicalTargetZ = function (actor, target, kind, passKind, meta) {
    if (target && Number.isFinite(target.z)) return clamp(target.z, 0, 8);
    if (meta && Number.isFinite(meta.targetZ)) return clamp(meta.targetZ, 0, 8);
    const pk = passKind || kind;
    /* §OS-219 · O CRUZAMENTO NAO TINHA ALTURA DE CHEGADA, E ERA ESSA A RAIZ.
       `cross` nao estava nesta tabela: caia no `return 0.05` do fim, entao a
       bisecao de `resolverAlta` procurava a velocidade que faz a bola pousar a
       CINCO CENTIMETROS do gramado. Um cruzamento resolvido para o chao nao
       tem arco nenhum por construcao -- ele e um passe forte rasteiro com
       nome de cruzamento, e nenhum ajuste de angulo consertaria isso sozinho.
       Cruzamento e escanteio chegam na cabeca: 2,05 m e a altura de cabeceio
       de um atleta de 1,80 m saltando pouco. O lancamento sobe de 0,35 para
       1,25 -- ele tambem e bola alcada, e pousar no pe do receptor a 35 cm
       obrigava trajetoria rasa. */
    if (pk === 'throw') return 1.05;
    /* §OS-230 · 2,05 m era a cabeca de um atleta de 1,80 saltando pouco, e o
       arco ficou certo -- mas a bola chegando mais alta e mais disputada no
       ar, e disputa aerea que o defensor ganha vira escanteio. Medido: os
       escanteios foram de ~10,5 para 13,30 por partida (teto 11,5). 1,85 m
       ainda e altura de cabeceio e devolve parte do volume. */
    if (pk === 'cross') return 1.85;
    if (pk === 'launch') return 1.25;
    if (pk === 'through') return 0.05;
    if (kind === 'shot') return 0.9;
    return 0.05;
  };

  /* Mantido por compatibilidade: varias camadas leem `seg.arc` e algumas
     passam `meta.arc`. Com integracao real o arco e consequencia do angulo de
     saida, entao aqui ele so informa a preferencia por bola alta. */
  P._physicalArc = function (kind, passKind, origin, target, targetZ, meta) {
    if (meta && Number.isFinite(meta.arc)) return meta.arc;
    const pk = passKind || kind;
    return (pk === 'launch' || pk === 'throw') ? 1 : 0;
  };

  /* Tres regimes de bola, porque um solucionador so nao serve para os tres:
       RASTEIRA — passe/enfiada no chao: sai rente e rola ate o destino;
       ALTA     — lancamento, cruzamento, lateral: projetil que pousa no alvo;
       TENSA    — chute: sai forte e o que importa e a ALTURA AO CRUZAR o plano
                  do gol, nao onde pousaria. */
  const RASTEIRA = 'rasteira', ALTA = 'alta', TENSA = 'tensa';

  function regimeDe(kind, passKind, meta, alvoZ) {
    if (kind === 'shot') return TENSA;
    if (meta && meta.arcoAlto) return ALTA;
    const pk = passKind || kind;
    if (pk === 'launch' || pk === 'throw' || pk === 'cross') return ALTA;
    return alvoZ > 0.5 ? ALTA : RASTEIRA;
  }

  P._planPhysicalSegment = function (origin, target, kind, passKind, speed, meta) {
    const o = {
      x: finito(origin && origin.x), y: finito(origin && origin.y),
      z: Math.max(0, finito(origin && origin.z, 0.1)),
    };
    const alvoZ = this._physicalTargetZ(
      (meta && meta.actor) || (this.ball && this.ball.lastTouch),
      target, kind, passKind, meta
    );
    const alvo = {
      x: finito(target && target.x, o.x),
      y: finito(target && target.y, o.y),
      z: alvoZ,
    };
    const regime = regimeDe(kind, passKind, meta, alvoZ);
    /* OS-203 · a origem do passe rasteiro e o gramado, e nao a altura decorativa
       que o core deixa em `ball.z`. O core faz `b.z = 0,12` logo antes de nos
       chamar (40-match-engine, "ARCO baixo no passe rasteiro"), um numero da
       epoca em que `z` so servia para desenhar. Lido como altura de saida real,
       ele e uma queda de 12 cm: sozinho responde por 0,12 dos 0,141 m de apice
       medidos, e e ele que faz a bola quicar em todo passe. Um passe no chao
       comeca no chao. Chute e bola alta continuam saindo da altura que o motor
       informou — la os 12 cm sao a bola no pe, e a calibracao da mira depende
       disso. */
    if (regime === RASTEIRA) o.z = 0;
    const pedida = Math.max(8, finito(speed, 28));
    /* No chute a forca e do jogador e nao se negocia: se ele nao tem perna
       para pousar a bola onde mirou, ela cruza mais baixo do que ele queria —
       que e o que acontece num chute fraco de longe. Por isso o regime tenso
       usa a velocidade pedida e aceita o melhor angulo possivel. */
    const r = regime === RASTEIRA ? resolverRasteira(o, alvo, pedida)
      : regime === ALTA ? resolverAlta(o, alvo, anguloDe(kind, passKind))
      : { vel: pedida, sol: resolverElevacao(o, alvo, pedida, false) };
    const vel = r.vel, sol = r.sol;
    const tr = trajetoria(o, vel, sol, alvo);

    this._physicsSegmentSeq = (this._physicsSegmentSeq || 0) + 1;
    return {
      id: 'seg_' + this._physicsSegmentSeq,
      kind, passKind: passKind || kind,
      duration: tr.duracao,
      origin: o,
      target: { x: alvo.x, y: alvo.y, z: alvo.z },
      arc: this._physicalArc(kind, passKind, o, alvo, alvoZ, meta),
      speed: vel,
      regime,
      elevacao: sol.theta,
      quiques: tr.quiques,
      samples: tr.amostras,
      __os200: true,
    };
  };

  /* `_trajectoryPoint` e chamado em laco pelos solucionadores de interceptacao
     (~110 vezes por chute, com a mesma origem/alvo/velocidade e p variando).
     Sem memoria isso multiplicaria por 110 o custo da integracao, entao o
     ultimo segmento resolvido fica em cache. */
  let cacheChave = '', cacheSeg = null;

  P._trajectoryPoint = function (origin, target, speed, p, kind, passKind, targetZ, arc) {
    const chave = [
      Math.round(finito(origin && origin.x) * 100), Math.round(finito(origin && origin.y) * 100),
      Math.round(finito(origin && origin.z) * 100), Math.round(finito(target && target.x) * 100),
      Math.round(finito(target && target.y) * 100), Math.round(finito(targetZ) * 100),
      Math.round(finito(speed) * 10), kind, passKind,
    ].join('|');
    if (chave !== cacheChave || !cacheSeg) {
      cacheSeg = this._planPhysicalSegment(
        origin,
        { x: finito(target && target.x), y: finito(target && target.y), z: finito(targetZ) },
        kind, passKind, speed, { targetZ: finito(targetZ) }
      );
      cacheChave = chave;
    }
    const seg = cacheSeg, ss = seg.samples;
    const u = clamp(finito(p), 0, 1) * (ss.length - 1);
    const i = Math.floor(u), f = u - i;
    const a = ss[i], b = ss[Math.min(ss.length - 1, i + 1)];
    return {
      x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: Math.max(0, a.z + (b.z - a.z) * f),
      t: seg.duration * clamp(finito(p), 0, 1), duration: seg.duration,
    };
  };

  /* ═════════════════════════════════════════════ 4. GEOMETRIA DA META ═══════

     Le de um segmento onde a bola cruza o plano do gol e classifica o que
     aconteceu ali. E daqui que sai o desfecho de um chute — nao de um sorteio.
     `dir` e o sentido do ataque: +1 mira o gol em x = FL, -1 o gol em x = 0. */
  function cruzarPlano(samples, gx, dir) {
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i];
      const da = (a.x - gx) * dir, db = (b.x - gx) * dir;
      if (da < 0 && db >= 0) {
        const f = (db - da) !== 0 ? (0 - da) / (db - da) : 0;
        return {
          y: a.y + (b.y - a.y) * f,
          z: Math.max(0, a.z + (b.z - a.z) * f),
          t: a.t + (b.t - a.t) * f,
          vx: a.vx, vy: a.vy, vz: a.vz,
        };
      }
    }
    return null;
  }

  /* Classifica o cruzamento: 'dentro' | 'trave' | 'travessao' | 'fora' | 'curto'.
     A faixa de trave tem a espessura real do poste, entao "na trave" deixa de
     ser um sorteio e passa a ser o que e: uma bola que passou a 6 cm de
     entrar. */
  P._os200Desfecho = function (seg, gol, dir) {
    const c = cruzarPlano(seg.samples, gol.x, dir);
    if (!c) return { tipo: 'curto', cruzamento: null };
    const dy = Math.abs(c.y - gol.y);
    const dentroLateral = dy <= POSTE - RAIO_TRAVE;
    const naTrave = dy > POSTE - RAIO_TRAVE && dy <= POSTE + RAIO_TRAVE;
    const abaixo = c.z <= TRAVESSAO - RAIO_TRAVE;
    const noTravessao = c.z > TRAVESSAO - RAIO_TRAVE && c.z <= TRAVESSAO + RAIO_TRAVE;

    if (dentroLateral && abaixo) return { tipo: 'dentro', cruzamento: c };
    if (naTrave && c.z <= TRAVESSAO + RAIO_TRAVE) return { tipo: 'trave', cruzamento: c };
    if (dentroLateral && noTravessao) return { tipo: 'travessao', cruzamento: c };
    return { tipo: 'fora', cruzamento: c, porCima: c.z > TRAVESSAO, larga: dy > POSTE };
  };

  /* ─── rebote na trave e no travessao ──────────────────────────────────────
     O ramo antigo sorteava tudo: `chance(postCorner)` decidia se a bola saia,
     e o rebote ia para um ponto aleatorio num raio de 3 a 9 m. Com a geometria
     no lugar, nada disso precisa de sorteio — a bola bate num cilindro de aco
     e volta pelo angulo com que chegou.

     A normal do contato NAO e puramente lateral: a bola chega de frente, entao
     ela toca a face dianteira do poste. Procuramos na trajetoria a amostra mais
     proxima do eixo do cilindro e usamos o vetor eixo->bola, que carrega a
     componente x de volta para o campo. */
  const REST_TRAVE = 0.68;  // aco: devolve bem mais energia que o gramado

  function contatoNaTrave(seg, gol, tipo, cruz) {
    const py = gol.y + (cruz.y >= gol.y ? 1 : -1) * POSTE;
    const ss = seg.samples;
    let melhor = null, melhorD = Infinity;
    for (const s of ss) {
      /* poste: cilindro vertical em (gol.x, py)  ->  distancia no plano x-y
         travessao: cilindro ao longo de y em (gol.x, TRAVESSAO) -> plano x-z */
      const d = tipo === 'travessao'
        ? Math.hypot(s.x - gol.x, s.z - TRAVESSAO)
        : Math.hypot(s.x - gol.x, s.y - py);
      if (d < melhorD) { melhorD = d; melhor = s; }
    }
    if (!melhor) return null;
    let nx, ny, nz;
    if (tipo === 'travessao') {
      nx = melhor.x - gol.x; ny = 0; nz = melhor.z - TRAVESSAO;
    } else {
      nx = melhor.x - gol.x; ny = melhor.y - py; nz = 0;
    }
    const L = Math.hypot(nx, ny, nz);
    if (!(L > EPS)) return null;
    return { ponto: melhor, n: { x: nx / L, y: ny / L, z: nz / L } };
  }

  /* Reflete a velocidade incidente na normal e integra o rebote ate a bola
     sair do campo ou parar. Devolve para onde ela foi — e nao um sorteio. */
  P._os200Rebote = function (seg, gol, dir, tipo, cruz) {
    const c = contatoNaTrave(seg, gol, tipo, cruz);
    if (!c) return null;
    const v = { x: finito(cruz.vx), y: finito(cruz.vy), z: finito(cruz.vz) };
    const dot = v.x * c.n.x + v.y * c.n.y + v.z * c.n.z;
    const r = {
      x: (v.x - 2 * dot * c.n.x) * REST_TRAVE,
      y: (v.y - 2 * dot * c.n.y) * REST_TRAVE,
      z: (v.z - 2 * dot * c.n.z) * REST_TRAVE,
    };
    /* Se a reflexao ainda aponta para dentro do gol, a bola raspou o poste por
       tras; empurramos de volta ao campo para nao atravessar a rede. */
    if (r.x * dir > 0) r.x = -r.x;

    const s = estado({ x: c.ponto.x, y: c.ponto.y, z: c.ponto.z }, r.x, r.y, r.z);
    let saiu = false, voltou = false;
    for (let i = 0; i < MAX_PASSOS; i++) {
      avancar(s, PASSO);
      /* O contato acontece EM CIMA da linha de fundo, entao testar a saida
         desde o primeiro passo declarava "saiu" antes de a bola se mexer —
         media 4 de 5 traves saindo. So vale a partir do momento em que ela
         voltou ao campo de verdade. */
      if (!voltou && (gol.x - s.x) * dir > 0.3) voltou = true;
      if (s.x < 0 || s.x > FL || s.y < 0 || s.y > FW) { saiu = true; break; }
      if (voltou && (s.x - gol.x) * dir > 0) { saiu = true; break; }
      if (s.z <= 0.02 && Math.hypot(s.vx, s.vy) < 3.5) break;  // morreu no gramado
    }
    return {
      ponto: c.ponto,
      saiu,
      pouso: { x: clamp(s.x, 1, FL - 1), y: clamp(s.y, 1, FW - 1) },
      velocidade: Math.hypot(r.x, r.y),
    };
  };

  /* ═══════════════════════════════════════════════════ 5. ALCANCE DO GOLEIRO ═

     O goleiro e avaliado sobre a trajetoria QUE EXISTE, nao sobre um ponto de
     contato fabricado. O modelo e deliberadamente simples e legivel: tempo de
     reacao, deslocamento maximo no tempo disponivel e envergadura. A defesa
     nao e deterministica — passar por pouco continua sendo possivel, senao
     todo chute no canto viraria gol garantido e todo chute no meio, defesa
     garantida. */
  function qualidadeGk(gk) {
    return clamp(finito(_facet(gk, 'gk'), 65) / 100, .25, 1);
  }

  P._os200Defesa = function (gk, seg, cruz) {
    if (!gk || gk.red || !cruz) return { defendeu: false, motivo: 'sem_goleiro' };
    const q = qualidadeGk(gk);
    const reacao = 0.16 + (1 - q) * 0.14;   // 0,16 s a 0,30 s
    const vMergulho = 4.1 + q * 2.3;        // m/s de deslocamento com mergulho
    /* ENVERGADURA — alcance da ponta dos dedos ao centro de massa, mergulhando.
       Estava em 1,05 a 1,60 m e isso e menos do que um goleiro alcanca parado:
       a envergadura de braços de um profissional passa de 1,85 m, ou seja ~0,93 m
       de cada lado do tronco, e o mergulho estende bem mais que isso.

       Medido com 1,05-1,60: de 1.805 chutes que entraram na boca do gol, 613
       (34%) ficaram FORA DE ALCANCE — gol sem o goleiro encostar. E dos que ele
       alcancava, a folga media era de 0,24 m, ou seja ele chegava raspando.
       A cobertura total (mergulho x tempo + envergadura) dava 3,76 m contra
       3,66 m de meia-boca: nao fechava o canto. */
    const envergadura = num(T.envergaduraBase, 1.05) + q * num(T.envergaduraQ, 0.55);

    /* Interceptacao ao longo da trajetoria, e nao so no plano do gol. A versao
       anterior media a distancia do goleiro ate o ponto onde a bola CRUZA a
       linha, o que castigava injustamente o goleiro adiantado: medido nesta
       build, ele fica em media a 9,9 m da propria linha, e um goleiro que sai
       intercepta a bola ONDE ELE ESTA, bem antes dela chegar na meta.
       Procuramos entao o primeiro instante do voo em que ele alcanca a bola —
       tanto no plano do gramado quanto na altura. */
    const ss = seg.samples;
    let achado = null;
    for (let i = 1; i < ss.length; i++) {
      const s = ss[i];
      if (s.t > cruz.t + 1e-6) break;       // depois da linha nao adianta mais
      const disponivel = s.t - reacao;
      if (disponivel < 0) continue;
      /* alcance vertical: em pe ele cobre pouco mais de 2 m; com tempo, salta */
      const alcanceZ = 0.95 + q * 0.85 + Math.min(0.95, disponivel * 1.6);
      if (s.z > alcanceZ) continue;
      const preciso = Math.max(0, dist2d(gk.x, gk.y, s.x, s.y) - envergadura);
      const folga = vMergulho * disponivel - preciso;
      /* A MELHOR CHANCE, NAO A PRIMEIRA.
         O laco parava no PRIMEIRO instante teoricamente alcancavel — e esse
         instante tem folga proxima de zero por construcao, porque e exatamente
         onde o alcance passa a existir. Com `p = DEFESA_BASE + folga*...`, todo
         chute era resolvido no pior ponto possivel da defesa.

         O sintoma que denunciou isso: aumentar a envergadura de 1,05 para 1,45
         PIOROU o jogo (gols 3,27 -> 3,40). Mais alcance antecipava o encontro
         para um ponto ainda mais apertado, em vez de dar conforto ao goleiro.
         Um goleiro nao mergulha no primeiro milissegundo em que poderia
         encostar: ele escolhe onde chega melhor. */
      if (folga >= 0 && (!achado || folga > achado.folga)) achado = { ponto: s, folga, disponivel };
    }

    const d = this.__os200Diag || (this.__os200Diag = {});
    d.defTentativas = (d.defTentativas || 0) + 1;
    d.defSomaTempoBola = (d.defSomaTempoBola || 0) + cruz.t;
    d.defSomaDistLinha = (d.defSomaDistLinha || 0)
      + Math.min(Math.abs(finito(gk.x)), Math.abs(finito(gk.x) - FL));

    if (!achado) {
      d.defForaDeAlcance = (d.defForaDeAlcance || 0) + 1;
      return { defendeu: false, motivo: 'fora_de_alcance' };
    }
    d.defSomaFolga = (d.defSomaFolga || 0) + achado.folga;

    /* Alcancar nao e defender: bola no angulo com o goleiro esticado ainda
       entra. Quanto maior a folga, mais confortavel a defesa. */
    const p = clamp(DEFESA_BASE + achado.folga * DEFESA_POR_METRO, 0, 0.94) * (0.72 + q * 0.28);
    const sorte = _chance(p);
    d.defSomaP = (d.defSomaP || 0) + p;
    return { defendeu: !!sorte, motivo: sorte ? 'defendeu' : 'nao_alcancou',
             folga: achado.folga, p, ponto: achado.ponto };
  };

  /* ═══════════════════════════════════════ 6. O CHUTE, RESOLVIDO PELA BOLA ══

     Aqui mora a inversao. O motor continua calculando pGoal exatamente como
     antes — ele e um bom modelo de xG e nao ha razao para joga-lo fora. O que
     muda e o PAPEL dele: pGoal deixa de sortear o placar e passa a calibrar a
     PONTARIA. Um chute com pGoal alto e um chute que sai perto de onde o
     jogador mirou; um com pGoal baixo espalha. Depois disso a bola voa, e
     quem decide gol/trave/fora/defesa e a geometria da meta.

     Consequencia direta e desejada: agora existe erro alto. Um chute pode sair
     por cima do travessao porque a bola subiu demais, nao porque um ramo
     sorteou "fora". Era isso que a OS-104 tentava produzir por fora e nao
     conseguia sem derrubar o placar. */

  /* Onde o jogador PRETENDE colocar a bola, antes do erro. */
  function alvoPretendido(o, g, dir, finishPlan, oneOnOne) {
    if (finishPlan && finishPlan.type === 'placed') {
      /* colocado: canto oposto ao corpo, rasteiro */
      const lado = finito(o.y) < g.y ? 1 : -1;
      return { y: g.y + lado * POSTE * 0.74, z: 0.42 };
    }
    if (finishPlan && finishPlan.type === 'chip') {
      /* cavadinha: por cima do goleiro, mas por baixo do travessao */
      return { y: g.y + sino() * POSTE * 0.30, z: 1.72 };
    }
    if (oneOnOne) return { y: g.y + sino() * POSTE * 0.60, z: 0.38 };
    return { y: g.y + sino() * POSTE * 0.50, z: 0.72 };
  }

  P._os200Mira = function (o, g, dir, ctx) {
    const q = clamp(finito(ctx.atk, 65) / 100, .25, 1);
    const disp = finito(ctx.finishPlan && ctx.finishPlan.dispersionMul, 1);
    /* Erro cai com a qualidade do finalizador e com a qualidade da chance. */
    const erro = ERRO_BASE * (1.30 - q * 0.62) * disp * (1.25 - clamp(finito(ctx.pGoal), 0, .72));
    const alvo = alvoPretendido(o, g, dir, ctx.finishPlan, ctx.oneOnOne);
    return {
      x: g.x + dir * 0.6,
      y: alvo.y + sino() * erro,
      /* O piso de 0,03 impede mira subterranea; o erro vertical e assimetrico
         para cima porque bola chutada por baixo do centro sobe mais facil do
         que afunda. */
      z: Math.max(0.03, alvo.z + sino() * erro * ERRO_VERTICAL + VIES_ALTO),
      __erro: erro,
    };
  };

  /* Bloqueio: um defensor no caminho, alcancando a bola na ALTURA em que ela
     passa. Bola por cima da cabeca nao e bloqueada — coisa que a versao por
     sorteio nao sabia checar. */
  function acharBloqueio(sim, o, seg, g, dir) {
    const defs = (sim.teams[1 - o.team].players || []).filter(p => p && !p.red && !p.isGK);
    if (!defs.length) return null;
    const ss = seg.samples;
    for (let i = 1; i < ss.length; i++) {
      const s = ss[i];
      if ((s.x - g.x) * dir > 0) break;      // ja cruzou a linha
      if (s.t > 0.75) break;                 // bloqueio e coisa de instante
      for (const d of defs) {
        const q = clamp(finito(_facet(d, 'duel'), 60) / 100, .3, 1);
        const reacao = 0.05 + (1 - q) * 0.09;
        if (s.t < reacao) continue;
        const raio = BLOQUEIO_RAIO + q * 0.45 + BLOQUEIO_AVANCO * (s.t - reacao);
        if (dist2d(d.x, d.y, s.x, s.y) > raio) continue;
        if (s.z > 1.95 + q * 0.55) continue; // passou por cima dele
        return { def: d, ponto: { x: s.x, y: s.y, z: s.z }, t: s.t };
      }
    }
    return null;
  }

  /* Ponto da trajetoria em que o goleiro encosta: a amostra mais proxima dele
     antes da linha. E daqui que sai o alvo do deslocamento do goleiro, entao
     ele passa a mergulhar para onde a bola de fato vai. */
  function pontoDeContato(seg, gk, g, dir) {
    const ss = seg.samples;
    let melhor = null, melhorD = Infinity;
    for (let i = 1; i < ss.length; i++) {
      const s = ss[i];
      if ((s.x - g.x) * dir > 0.05) break;
      const d = dist2d(gk.x, gk.y, s.x, s.y);
      if (d < melhorD) { melhorD = d; melhor = s; }
    }
    return melhor ? { x: melhor.x, y: melhor.y, z: melhor.z, t: melhor.t } : null;
  }

  P._os200ResolverChute = function (o, ctx) {
    const g = ctx.g, tm = ctx.tm, gk = ctx.gk;
    const dir = finito(tm.attackDir, g.x > FL / 2 ? 1 : -1) || (g.x > FL / 2 ? 1 : -1);
    /* Cabeceio e finalizacao de primeira nao saem com a forca de um chute
       armado; quem chama informa a faixa. Sem isso um cabeceio viajaria a
       31 m/s e nenhum goleiro teria tempo. */
    const forca = Number.isFinite(ctx.forca) ? ctx.forca
      : clamp((34 + finito(_facet(o, 'shot'), 65) / 100 * 16)
          * finito(ctx.finishPlan && ctx.finishPlan.speedMul, 1), 26, 59) * FORCA_ESCALA;

    const mira = this._os200Mira(o, g, dir, ctx);
    const origem = {
      x: finito(this.ball.x, o.x), y: finito(this.ball.y, o.y),
      z: Math.max(0.05, finito(this.ball.z, 0.11)),
    };
    const seg = this._planPhysicalSegment(origem, mira, 'shot', 'shot', forca,
      { actor: o, targetZ: mira.z });
    const desf = this._os200Desfecho(seg, g, dir);

    const diag = this.__os200Diag || (this.__os200Diag = {
      chutes: 0, gols: 0, defesas: 0, traves: 0, fora: 0, porCima: 0, bloqueios: 0, curtos: 0,
    });
    diag.chutes++;
    diag.somaForca = (diag.somaForca || 0) + forca;

    /* 1. alguem na frente? */
    const bloq = acharBloqueio(this, o, seg, g, dir);
    if (bloq) {
      diag.bloqueios++;
      this._startTravel(o, bloq.ponto, 'shot', () => {
        this._recordVisualContact('block', bloq.def, this.ball.x, this.ball.y,
          { z: this.ball.z, distance: dist2d(bloq.def.x, bloq.def.y, this.ball.x, this.ball.y) });
        this._emit('blocked', { by: bloq.def, contact: { x: this.ball.x, y: this.ball.y } });
        if (_chance(calRestart("shotBlockCorner", .66))) this._setCorner(o.team);
        else this._looseBall(this.ball.x, this.ball.y);
      }, null, 'shot', { outcome: 'block', actor: bloq.def, contactRadius: 2.05 });
      return;
    }

    /* 2. a bola nem chegou na linha */
    if (desf.tipo === 'curto') {
      diag.curtos++;
      this._startTravel(o, mira, 'shot', () => {
        this._emit('miss', { by: o, reason: 'sem_forca' });
        this._looseBall(this.ball.x, this.ball.y);
      }, null, 'shot', { outcome: 'miss' });
      return;
    }

    /* 3. na trave ou no travessao — rebote calculado, nao sorteado */
    if (desf.tipo === 'trave' || desf.tipo === 'travessao') {
      diag.traves++;
      const rebote = this._os200Rebote(seg, g, dir, desf.tipo, desf.cruzamento);
      if (rebote && rebote.saiu) diag.travesQueSairam = (diag.travesQueSairam || 0) + 1;
      this._startTravel(o, mira, 'shot', () => {
        this._recordVisualContact('post', null, this.ball.x, this.ball.y, { shooterId: o.idx == null ? null : o.idx });
        this._emit('post', { by: o, contact: { x: this.ball.x, y: this.ball.y }, parte: desf.tipo });
        /* Sair ou continuar viva deixa de ser sorteio: depende de para onde a
           reflexao mandou a bola. Sem rebote calculado (caso degenerado da
           busca do contato), caimos na regra de calibracao antiga. */
        if (!rebote) {
          if (_chance(calRestart('postCorner', .5))) this._goalKickOrRestart(1 - o.team);
          else this._looseBall(this.ball.x, this.ball.y);
          return;
        }
        if (rebote.saiu) this._goalKickOrRestart(1 - o.team);
        else this._deflectTo(rebote.pouso.x, rebote.pouso.y, Math.max(6, rebote.velocidade));
      }, null, 'shot', { outcome: 'post' });
      return;
    }

    /* 4. fora: larga, por cima, ou as duas */
    if (desf.tipo === 'fora') {
      diag.fora++;
      if (desf.porCima) diag.porCima++;
      this._startTravel(o, mira, 'shot', () => {
        this._emit('miss', { by: o, porCima: !!desf.porCima, larga: !!desf.larga });
        this._goalKickOrRestart(1 - o.team);
      }, null, 'shot', { outcome: 'miss' });
      o.rating -= 0.08;
      return;
    }

    /* 5. no gol: o goleiro tenta alcancar a bola que existe */
    const defesa = this._os200Defesa(gk, seg, desf.cruzamento);
    if (defesa.defendeu) {
      diag.defesas++;
      const contato = pontoDeContato(seg, gk, g, dir) || desf.cruzamento;
      this._startTravel(o, contato, 'shot',
        () => this._gkResolveSave(gk, o, {
          atk: ctx.atk, oneOnOne: ctx.oneOnOne,
          saveTarget: Object.assign({}, contato, { t: contato.t }), g, tm,
        }),
        null, 'shot', { outcome: 'save', actor: gk, contactRadius: 1.9, interceptT: contato.t });
      return;
    }

    diag.gols++;
    this._startTravel(o, mira, 'shot',
      () => this._goal(o, !!ctx.longshot || finito(_facet(o, 'shot'), 0) > 90),
      null, 'shot');
  };

  /* ══════════════════════════════════════════════════════════ 7. DIAGNOSTICO */
  P.getOS200Report = function () {
    return Object.assign({ versao: VERSAO }, this.__os200Diag || {});
  };

  /* ─── identidade do build ──────────────────────────────────────────────────
     Esta e a ultima camada do bundle, entao e a que tem a palavra final sobre
     `document.title`. Antes disso, 36 arquivos escreviam o titulo com o numero
     da propria release e o resultado dependia da ordem de carga; o titulo
     estatico do HTML tinha ficado em "R18.40A" enquanto o jogo era R19.08.
     Trocar a versao do jogo passa a ser mexer nesta linha. */
  const VERSAO_JOGO = 'R19.09';
  try {
    root.CDS_BUILD_ID = VERSAO_JOGO;
    root.CDS_VERSION = VERSAO_JOGO;
    if (root.document) root.document.title = 'Copa dos Sonhos — ' + VERSAO_JOGO;
  } catch (_) { /* sem DOM (bateria em Node): nada a fazer */ }

  root.CDS_OS200 = Object.freeze({
    versao: VERSAO,
    instalado: true,
    constantes: { G, K_ARRASTO, RESTITUICAO, ATRITO_QUIQUE, ATRITO_ROLAGEM, POSTE, TRAVESSAO },
    principios: ['integracao_real', 'sem_teto_de_altura', 'geometria_decide_o_desfecho'],
  });
})(typeof window !== 'undefined' ? window : globalThis);
