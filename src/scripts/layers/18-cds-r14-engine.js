
/*
 * Copa dos Sonhos · R14 · CONTRATO DE AÇÃO (Fase 2)
 *
 * O problema: _startTravel faz `b.owner=null; b.traveling=true` no MESMO tick da
 * decisão. A bola parte no instante em que o motor escolhe passar/cruzar/chutar,
 * então NÃO EXISTE preparação — nenhuma pose de chute pode tocar a bola, porque
 * quando o evento chega ao render ela já saiu. É a origem literal de "bola saindo
 * antes do pé tocar" e "chute visual depois da bola já ter partido".
 *
 * A correção separa DECIDIR de EXECUTAR. A ação escolhida vira um contrato com
 * preparação → contato → continuidade → recuperação; a bola só sai no CONTATO.
 * Durante o preparo o portador continua com a bola e pode ser desarmado — o que
 * é futebol, e produz `interrupted` em vez de uma ação fantasma.
 *
 * O motor continua autoritativo: o contrato não escolhe desfecho nenhum, apenas
 * atrasa a execução da MESMA ação que o motor já havia decidido, e a descreve.
 */
(function installCDSR14ActionContract(root) {
  'use strict';
  const M = root && root.MatchSim;
  if (!M || !M.prototype || M.prototype.__CDS_R14_ACTION__) return;
  const P = M.prototype;
  P.__CDS_R14_ACTION__ = true;

  const VERSION = '5.9.4-R14.0';
  const finite = (v, d = 0) => (Number.isFinite(v) ? v : d);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* Ações que SOLTAM a bola. Condução e drible não entram: são movimento
     contínuo com a bola no pé, não um evento de contato pontual. */
  const RELEASE = { _pass: 'pass', _cross: 'cross', _shoot: 'shot' };

  /* preparação · continuidade · recuperação (segundos de jogo).
     Faixas curtas de propósito: o objetivo é dar ao render uma janela real de
     contato, não introduzir câmera lenta. */
  const PHASES = {
    pass:  { prep: [0.10, 0.19], follow: 0.10, recover: 0.12 },
    cross: { prep: [0.15, 0.26], follow: 0.16, recover: 0.18 },
    shot:  { prep: [0.17, 0.30], follow: 0.20, recover: 0.22 }
  };

  /* Estados administrativos: bola parada, reposição, intervalo. Cobranças são
     executadas na hora — atrasar um reinício arrisca prender o estado, que é
     exatamente a classe de defeito que a R14 acabou de eliminar. */
  const isAdmin = s => !!s.__p04AdminPermit || finite(s.dead) > 0 ||
                       !!s.pendingRestart || !!s.waiting || !!s.deadBall;

  /* Técnica melhor prepara mais rápido. a8[1] é o índice técnico do elenco;
     sem ele, assume mediano. Nunca inverte a ordem: só encurta. */
  function prepDur(o, type) {
    const ph = PHASES[type] || PHASES.pass;
    const a = (o && o.ref && o.ref.a8 && Number.isFinite(o.ref.a8[1])) ? o.ref.a8[1] : 70;
    const t = clamp((a - 55) / 45, 0, 1);
    return ph.prep[1] - (ph.prep[1] - ph.prep[0]) * t;
  }

  function footOf(o) {
    const pf = o && o.profileV3 || (o && o.ref && o.ref.profileV3);
    const f = pf && pf.dominantFoot;
    return f === 'L' || f === 'R' ? f : 'R';
  }

  const actorId = p => (p ? String((p.ref && p.ref.n) || p.id || p.idx) : null);

  let seqId = 0;

  function contractOf(sim, pend, outcome, interrupted) {
    const ph = PHASES[pend.type] || PHASES.pass;
    const contact = finite(sim.t);
    return {
      actionId: pend.actionId,
      actor: actorId(pend.actor),
      action: pend.type,
      target: actorId(pend.target),
      foot: pend.type === 'shot' && pend.header ? 'HEAD' : footOf(pend.actor),
      start: +pend.startTime.toFixed(3),
      contact: +contact.toFixed(3),
      end: +(contact + ph.follow + ph.recover).toFixed(3),
      prepareDuration: +(contact - pend.startTime).toFixed(3),
      followThroughDuration: ph.follow,
      recoveryDuration: ph.recover,
      contactPoint: { x: +finite(sim.ball && sim.ball.x).toFixed(2),
                      y: +finite(sim.ball && sim.ball.y).toFixed(2),
                      z: +finite(sim.ball && sim.ball.z).toFixed(2) },
      outcome: outcome,
      interrupted: !!interrupted,
      minute: +finite(sim.minute).toFixed(2)
    };
  }

  function record(sim, contract) {
    if (!sim.actionContracts) sim.actionContracts = [];
    sim.actionContracts.push(contract);
    if (sim.actionContracts.length > 240) sim.actionContracts.shift();
    if (!sim.actionAudit) {
      sim.actionAudit = { prepared: 0, contacted: 0, interrupted: 0, forced: 0, byType: {} };
    }
    const a = sim.actionAudit;
    if (contract.interrupted) a.interrupted++; else a.contacted++;
    a.byType[contract.action] = (a.byType[contract.action] || 0) + 1;
  }

  /* ── agendamento: a ação decidida vira contrato em preparo ────────────── */
  for (const fn of Object.keys(RELEASE)) {
    const orig = P[fn];
    if (typeof orig !== 'function') continue;
    P[fn] = function (o) {
      // execução real, disparada pelo contato
      if (this.__r14Firing) return orig.apply(this, arguments);
      // cobranças e reinícios saem na hora
      if (isAdmin(this)) return orig.apply(this, arguments);
      // só o portador prepara; sem dono não há contato a sincronizar
      if (!o || !this.ball || this.ball.owner !== o) return orig.apply(this, arguments);
      // uma ação por vez: a pendência é cancelada ou executada antes da próxima
      if (this.__r14Pending) return;

      const type = RELEASE[fn];
      const t = finite(this.t);
      const pend = {
        actionId: 'a' + (++seqId),
        actor: o, fn, type,
        args: Array.prototype.slice.call(arguments),
        target: (arguments[1] && arguments[1].m) || null,
        header: !!(arguments[3]),
        startTime: t,
        contactAt: t + prepDur(o, type)
      };
      this.__r14Pending = pend;
      if (!this.actionAudit) {
        this.actionAudit = { prepared: 0, contacted: 0, interrupted: 0, forced: 0, byType: {} };
      }
      this.actionAudit.prepared++;
      o._act = type === 'shot' ? 'shoot' : type;
      this._emit('action_prepare', {
        actionId: pend.actionId, by: o, action: type,
        prepareDuration: +(pend.contactAt - t).toFixed(3)
      });
    };
  }

  /* Enquanto a ação está em preparo o portador está comprometido: redecidir
     no meio do movimento é o que produzia troca de ação sem contato. */
  const oldDecide = P._decide;
  P._decide = function () {
    if (this.__r14Pending) return;
    return oldDecide.apply(this, arguments);
  };

  const oldStep = P.step;
  P.step = function (dt) {
    const pend = this.__r14Pending;
    if (pend) {
      const t = finite(this.t);
      const lostBall = !this.ball || this.ball.owner !== pend.actor || pend.actor.red;
      // Guarda dura: nenhuma ação pode ficar pendente para sempre. Se o relógio
      // passou muito do contato sem executar, força — e registra como forçada,
      // para que a falha apareça na auditoria em vez de virar uma trava nova.
      const overdue = t > pend.contactAt + 1.0;
      if (lostBall && !overdue) {
        this.__r14Pending = null;
        record(this, contractOf(this, pend, 'interrupted', true));
        this._emit('action_interrupted', { actionId: pend.actionId, by: pend.actor, action: pend.type });
      } else if (t >= pend.contactAt) {
        this.__r14Pending = null;
        if (overdue) this.actionAudit.forced++;
        this.__r14Firing = true;
        try {
          this[pend.fn].apply(this, pend.args);
        } finally {
          this.__r14Firing = false;
        }
        record(this, contractOf(this, pend, overdue ? 'forced' : 'contact', false));
        this._emit('action_contact', {
          actionId: pend.actionId, by: pend.actor, action: pend.type,
          contract: this.actionContracts[this.actionContracts.length - 1]
        });
      }
    }
    return oldStep.apply(this, arguments);
  };

  P.getR14ActionAudit = function () {
    return this.actionAudit ? JSON.parse(JSON.stringify(this.actionAudit)) : null;
  };

  root.CDS_R14 = { version: VERSION, phases: PHASES };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===========================================================================
   R15 · BOLA PARADA SEM TELEPORTE  (§17, §32, §36, §56)

   PROBLEMA MEDIDO. `tools/r15/teleport_profiler.js` atribuiu, em 6 partidas,
   1.296 saltos acima de 1,5 m aos seus escritores:

       _resetPositions      49,2%   médio 11,6 m   máx 87,9 m
       _goalKickOrRestart   20,7%   médio 20,8 m   máx 83,5 m
       _setCorner           13,1%   médio 21,0 m   máx 84,2 m
       _switchSides         10,2%   médio 50,0 m   máx 102,4 m   (legítimo)
       _emit                 6,8%   médio 42,9 m   máx 47,3 m

   `_goalKickOrRestart` não escreve posição: ele chama `oldSetCorner` por dentro
   da camada R12, e o perfilador atribuiu ao quadro externo. Somando as duas
   colunas, o ESCANTEIO responde por ~34% dos teleportes.

   `_setCorner` calcula os postos de 12 jogadores (cobrador, três alvos, rebote,
   duas coberturas, quatro marcadores, um de contra-ataque) e ESCREVE `p.x/p.y`
   direto. Depois dá `this.dead = .6` — a 6,5 m/s isso cobre 3,9 m, enquanto a
   rotina realoca gente pelo terço ofensivo inteiro. O §17 é explícito: a forma
   deve surgir da movimentação física, nunca de teletransporte.

   COMO ESTA CAMADA CORRIGE. Sem tocar no corpo de `_setCorner`, que é longo e
   contém toda a lógica de rotina e marcação:

     1. fotografa as posições antes;
     2. deixa o original rodar e calcular os destinos;
     3. devolve cada jogador para onde estava e guarda o destino como ALVO;
     4. alonga `dead` na medida de quem está mais longe;
     5. a cada passo, enquanto a bola está morta, caminha cada um até seu alvo
        respeitando `maxSpd`.

   A BOLA NÃO VOLTA. `_setCorner` a coloca na bandeirinha, e é lá que ela fica —
   quem anda até ela é o cobrador. É o mesmo desenho de `r14-throwin-walk`, que
   já fez isto para o arremesso lateral (dead .72 → até 4,5 s, com sprint).

   CUSTO. `dead` não consome minuto de jogo (10-base-bundle.js:2662): o relógio
   da partida só avança com `dead <= 0`. O gasto é tempo de física, não de jogo.

   TETO. 6 s. Se alguém estiver absurdamente longe, o reinício acontece com ele
   ainda a caminho — preferível a travar a partida.
   =========================================================================== */
(function (root) {
  'use strict';
  var M = root && root.MatchSim;
  if (!M || !M.prototype) return;
  var P = M.prototype;
  if (P.__r15SetPieceWalk) return;
  P.__r15SetPieceWalk = true;

  /* O teto de `dead` foi de 6,0 s para 2,2 s. Motivo, medido em 294 partidas
     com elencos reais (R15.2 → primeira R15.4): o teleporte caiu 54%, mas os
     gols caíram 14,6% enquanto chutes subiam 12% e escanteios 17%. Como `dead`
     NÃO move o relógio da partida (10-base-bundle.js:2662), alongá-lo até 6 s
     por bola parada injeta muito tempo de física com o jogo parado, deslocando
     a proporção entre jogo corrido e bola parada dentro dos mesmos 90 minutos.

     2,2 s a 6,0 m/s cobrem ~13 m, que é a distância típica de reposicionamento
     de escanteio. Quem estiver além disso chega com a bola já rolando — o que
     é futebol, não teleporte: jogador atrasado para o escanteio existe.

     `MIN_MOVE` sobe de 0,5 m para 3,0 m: reposicionamento curto não precisa de
     janela nenhuma e alongava `dead` sem necessidade. */
  var WALK_SPEED = 0.92;   // fração de maxSpd ao se reposicionar (não é sprint)
  var DEAD_CAP = 2.2;      // s de física
  var MIN_MOVE = 0.6;      /* §R18.99 · era 3,0 e deixava passar salto de ate
                              2,96 m num quadro (89 m/s): medidos ~148 em 6
                              partidas, no reinicio apos gol e no escanteio.
                              0,6 m e o dobro do passo fisico maximo. */

  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); }

  /* Converte a escrita direta de posição em alvo a ser percorrido. */
  function deferPositions(sim, snap) {
    var far = 0;
    snap.forEach(function (xy, p) {
      if (!p || p.red) return;
      var tx = num(p.x), ty = num(p.y);
      var d = Math.hypot(tx - xy[0], ty - xy[1]);
      if (d <= MIN_MOVE) return;
      p.__spTarget = { x: tx, y: ty };
      p.x = xy[0]; p.y = xy[1];
      p.vx = 0; p.vy = 0;
      if (d > far) far = d;
    });
    if (far > 0) {
      var need = 0.6 + far / (6.5 * WALK_SPEED);
      sim.dead = Math.max(num(sim.dead), Math.min(DEAD_CAP, need));
    }
    return far;
  }

  function snapshot(sim) {
    var m = new Map();
    var teams = sim.teams || [];
    for (var i = 0; i < teams.length; i++) {
      var pl = teams[i].players || [];
      for (var j = 0; j < pl.length; j++) {
        var p = pl[j];
        if (p && !p.red) m.set(p, [num(p.x), num(p.y)]);
      }
    }
    return m;
  }

  var oldSetCorner = P._setCorner;
  P._setCorner = function () {
    var snap = snapshot(this);
    var r = oldSetCorner.apply(this, arguments);
    deferPositions(this, snap);
    return r;
  };

  /* O escanteio também nasce por DENTRO de `_goalKickOrRestart`: a camada R12
     (29-r12-transactional-core.js:138) capturou `oldSetCorner` no carregamento,
     antes deste wrapper, e o invoca diretamente na rotina de "escanteio vindo de
     cruzamento". Envolver só `_setCorner` deixava esse caminho teleportando —
     medido: 25% dos saltos continuavam atribuídos a `_goalKickOrRestart` depois
     da primeira versão desta camada.

     Envolver a função inteira cobre o caminho sem precisar descobrir qual
     referência interna cada camada guardou. Quando nenhuma posição muda — que é
     o caso normal do tiro de meta — `deferPositions` não faz nada. */
  var oldGoalKick = P._goalKickOrRestart;
  P._goalKickOrRestart = function () {
    var snap = snapshot(this);
    var r = oldGoalKick.apply(this, arguments);
    deferPositions(this, snap);
    return r;
  };

  /* KICKOFF APÓS GOL. `_kickoff` chama `_resetPositions`, que snapa os 22 à
     formação — medido como 70% dos teleportes restantes na R15.5 (kickoff,
     intervalo e reinício após gol), com salto médio de 11,7 m e máximo de 75 m.
     Depois de um gol os jogadores estão espalhados perto de uma das metas;
     voltar à formação é caminhada real, não teletransporte.

     DUAS GUARDAS:
     · `this.t > 0.5` — no início da partida (t≈0) os jogadores estão sendo
       COLOCADOS pela primeira vez; não há posição anterior de onde caminhar, e
       animar isso seria inventar movimento. O reset inicial passa direto.
     · o cobrador do meio, que `_kickoff` posiciona no centro DEPOIS de
       `_resetPositions`, é reescrito para o centro pela própria `_kickoff` e
       fica lá — é onde o batedor deve estar. `deferPositions` roda antes dessa
       reescrita e captura o resto; a linha `mid.x=FL/2` sobrepõe o alvo dele. */
  var oldKickoff = P._kickoff;
  P._kickoff = function () {
    var snap = snapshot(this);
    var r = oldKickoff.apply(this, arguments);
    if (num(this.t) > 0.5) deferPositions(this, snap);
    return r;
  };

  /* Caminhada durante a bola morta. Roda DEPOIS do passo original para que o
     alvo de bola parada prevaleça sobre o alvo tático normal — sem isso,
     `_movePlayers` recalcularia o destino a cada quadro e o jogador nunca
     chegaria ao posto do escanteio. */
  var oldStep = P.step;
  P.step = function (dt) {
    var r = oldStep.apply(this, arguments);
    var teams = this.teams || [];
    var step = Math.max(1 / 240, Math.min(0.15, num(dt, 1 / 30)));
    var dead = num(this.dead) > 0;
    for (var i = 0; i < teams.length; i++) {
      var pl = teams[i].players || [];
      for (var j = 0; j < pl.length; j++) {
        var p = pl[j];
        if (!p || !p.__spTarget) continue;
        if (!dead || p.red) { p.__spTarget = null; continue; }
        var t = p.__spTarget;
        var dx = t.x - num(p.x), dy = t.y - num(p.y);
        var d = Math.hypot(dx, dy);
        var max = num(p.maxSpd, 7) * WALK_SPEED * step;
        if (d <= max || d < 1e-6) {
          p.x = t.x; p.y = t.y; p.__spTarget = null;
          p.vx = 0; p.vy = 0;
        } else {
          p.x += dx / d * max;
          p.y += dy / d * max;
          p.vx = dx / d * num(p.maxSpd, 7) * WALK_SPEED;
          p.vy = dy / d * num(p.maxSpd, 7) * WALK_SPEED;
        }
      }
    }
    return r;
  };
})(typeof window !== 'undefined' ? window : globalThis);

/*
 * Copa dos Sonhos · §18 · CONTRATO DE FUNÇÃO — passo 1 de 6
 *
 * O problema (medido, não suposto): a função de cada jogador é INFERIDA em
 * quatro lugares independentes, com quatro definições da mesma ideia —
 * `line13()` em `_assignDefRoles`, `laneOf()` em terços, o literal
 * `['LB','RB','LWB','RWB','LM','RM']` para flanco, e `p.dhy/p.hy` em
 * `_defendTarget`. Não existe fonte única do que um jogador É. É a causa-raiz
 * de `marking_coverage` travado em 0,54–0,56 e de 4 gates que não têm como ser
 * medidos (`role_observable`, `zone_discipline`, …).
 *
 * ESTE PASSO NÃO CORRIGE NADA. Ele apenas cria o objeto e o preenche, uma vez
 * por jogador por partida, a partir do que o motor JÁ calculou. Ninguém lê.
 *
 * É de propósito: o critério pré-registrado do §18
 * (`reports/r15/CRITERIO-POS-18-PRE-REGISTRADO.md`, item 0) exige paridade
 * determinística — 294/294 placares idênticos e métricas iguais até 1e-9 —
 * ANTES de qualquer leitura. Se a matriz mudar, o contrato vazou para o motor
 * antes da hora, e a regra é reverter, não ajustar.
 *
 * Duas precauções para que o vazamento seja impossível por construção:
 *
 *   1. `contract` é definido com `enumerable: false`. `Object.keys`, spread e
 *      `JSON.stringify` não o enxergam — nenhum snapshot, save ou serialização
 *      do observador pode captá-lo por acidente.
 *   2. Nada aqui escreve em campo nenhum que o motor leia. O módulo só LÊ
 *      `dhx/dhy/ahx/ahy/slotPos/role/idx`, que `_buildTeam` acabou de produzir.
 *
 * LINE_OF é redefinido aqui porque o original (`10-base-bundle.js:121`) é
 * `const` de escopo de script e não é exportado. `__contractAudit.slotsUnknown`
 * registra qualquer slot que este mapa não conheça, para que a divergência
 * apareça no passo 2 em vez de silenciar.
 */
(function installCDSRoleContract(root) {
  'use strict';
  const M = root && root.MatchSim;
  if (!M || !M.prototype || M.prototype.__CDS_R18_CONTRACT__) return;
  const P = M.prototype;
  P.__CDS_R18_CONTRACT__ = true;

  const VERSION = '5.9.4-R18.0-inerte';
  const FL = 105, FW = 68;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finite = (v, d = 0) => (Number.isFinite(v) ? v : d);

  const LINE_OF = {
    GK: 'GK',
    CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
    CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
    LW: 'FWD', RW: 'FWD', CF: 'FWD', ST: 'FWD'
  };

  /* Cinco corredores, não três. Terços misturam ala com zagueiro central, que é
     exatamente a confusão que o §18 existe para desfazer.
     y baixo = esquerda, coerente com `side` e com `mkHomes`. */
  const CORRIDORS = ['L', 'CL', 'C', 'CR', 'R'];

  /* O corredor vem do SLOT, não do y do momento. Medido na primeira versão
     desta sonda: derivando de `dhy`, 210 de 374 jogadores caíam em 'C' e só 9
     nas faixas L/R — porque no bloco defensivo o time inteiro está compacto.
     Um lateral-esquerdo é do corredor esquerdo mesmo encolhido para o miolo;
     é isso que "responsabilidade espacial persistente" significa. */
  const WIDE_LEFT = new Set(['LB', 'LWB', 'LM', 'LW']);
  const WIDE_RIGHT = new Set(['RB', 'RWB', 'RM', 'RW']);

  /* Progresso no campo próprio: 0 = linha de fundo própria, 1 = do adversário.
     Espelha `const P = v => side===0 ? v : FL-v` do `mkHomes` do motor. */
  const ownProg = (side, x) => clamp((side === 0 ? finite(x) : FL - finite(x)) / FL, 0, 1);

  /* Raio da zona permitida, por linha. Zagueiro tem menos licença que ponta —
     é isso que "responsabilidade espacial persistente" quer dizer. Elipse: mais
     larga em x (profundidade do bloco) do que em y (disciplina de corredor). */
  const ZONE = {
    GK:  { rx: 9.0,  ry: 7.0 },
    DEF: { rx: 11.0, ry: 8.5 },
    MID: { rx: 15.0, ry: 12.0 },
    FWD: { rx: 19.0, ry: 15.0 }
  };

  /* Quanto este slot persegue referência em vez de segurar zona. */
  const MARK_PRIORITY = { GK: 0.00, DEF: 0.85, MID: 0.55, FWD: 0.20 };

  /* Histerese declarada. NÃO é lida por ninguém neste passo — entra em vigor no
     passo 4, junto com `assignmentId`. Os valores estão aqui para serem
     revisados agora, não improvisados depois. */
  const HOLD = { GK: 0.0, DEF: 1.8, MID: 1.4, FWD: 0.9 };   // segundos
  const SWITCH_COST = { GK: 0, DEF: 4.5, MID: 3.0, FWD: 1.5 }; // no escore de atribuição
  const RISK = { GK: 0.10, DEF: 0.25, MID: 0.50, FWD: 0.75 };

  function buildContract(p, side, audit) {
    const slot = String(p.slotPos || (p.ref && p.ref.slot) || 'CM');
    const line = LINE_OF[slot] || (audit.slotsUnknown.push(slot), 'MID');
    const z = ZONE[line] || ZONE.MID;

    const dhx = finite(p.dhx, p.hx), dhy = finite(p.dhy, p.hy);
    const ahx = finite(p.ahx, p.hx), ahy = finite(p.ahy, p.hy);

    return {
      version: VERSION,
      id: `${side}:${p.idx}:${slot}`,
      idx: p.idx, team: side, slot, line,

      /* ── geometria de responsabilidade ─────────────────────────────────── */
      homeZone: {
        defend: { x: dhx, y: dhy, rx: z.rx, ry: z.ry },
        attack: { x: ahx, y: ahy, rx: z.rx, ry: z.ry }
      },
      /* preenchidos no segundo passe (`assignStructure`): dependem do time
         inteiro, não só deste jogador */
      corridor: null,
      corridorAttack: null,
      /* lado: -1 esquerda, 0 miolo, +1 direita — do ponto de vista do time */
      side: dhy < FW / 2 - 6 ? -1 : dhy > FW / 2 + 6 ? 1 : 0,
      height: ownProg(side, dhx),
      heightAttack: ownProg(side, ahx),
      width: clamp(Math.abs(dhy - FW / 2) / (FW / 2), 0, 1),

      /* ── função por fase (o motor já resolveu; aqui só fica declarado) ──── */
      onBall: p.ipRole || p.role || null,
      offBall: p.oopRole || null,
      focus: p.focus || 'bal',
      inTransitionA: line === 'DEF' ? 'hold' : line === 'MID' ? 'support' : 'break',
      inTransitionD: line === 'FWD' ? 'delay' : 'recover',

      /* ── responsabilidade defensiva (preenchida no segundo passe) ───────── */
      coverFor: [], coveredBy: [],
      markPriority: MARK_PRIORITY[line],

      /* ── histerese: declarada agora, aplicada no passo 4 ────────────────── */
      minHoldSeconds: HOLD[line],
      switchCost: SWITCH_COST[line],
      riskTolerance: RISK[line],
      leaveZoneWhen: line === 'DEF'
        ? ['markRef_entra_na_zona', 'sobrecarga_no_corredor', 'bola_no_proprio_terco']
        : ['pressing_trigger', 'apoio_ao_portador', 'transicao_ofensiva'],
      returnZoneWhen: ['referencia_transferida', 'bola_sai_do_setor', 'compensador_fora_de_posicao'],

      /* ── só auditoria; nenhum destes campos governa comportamento ───────── */
      preferredActions: [], forbiddenActions: []
    };
  }

  const ADJACENT = { GK: ['DEF'], DEF: ['MID', 'GK'], MID: ['DEF', 'FWD'], FWD: ['MID'] };

  /* Segundo passe: corredor e cobertura dependem do time inteiro, não do
     jogador isolado. */
  function assignStructure(players) {
    const byLine = {};
    for (const p of players) {
      if (!p.contract) continue;
      (byLine[p.contract.line] = byLine[p.contract.line] || []).push(p);
    }

    /* ── corredor ──────────────────────────────────────────────────────────
       Slots largos são L/R por definição. Os centrais se distribuem entre
       CL/C/CR pela ordem de y DENTRO da própria linha — é o que produz o
       "DCR/DCL" legível do FM em vez de quatro jogadores marcados 'C'. */
    for (const line of Object.keys(byLine)) {
      const row = byLine[line];
      const centrais = row.filter(p => !WIDE_LEFT.has(p.contract.slot) &&
                                       !WIDE_RIGHT.has(p.contract.slot));
      for (const p of row) {
        const s = p.contract.slot;
        if (WIDE_LEFT.has(s)) p.contract.corridor = 'L';
        else if (WIDE_RIGHT.has(s)) p.contract.corridor = 'R';
      }
      const ord = centrais.slice().sort(
        (a, b) => a.contract.homeZone.defend.y - b.contract.homeZone.defend.y);
      for (let i = 0; i < ord.length; i++) {
        ord[i].contract.corridor = ord.length === 1 ? 'C'
          : i === 0 ? 'CL'
          : i === ord.length - 1 ? 'CR'
          : 'C';
      }
      /* O corredor de ataque só difere quando o jogador de fato muda de faixa
         entre bloco e posse; senão herda, para não inventar amplitude. */
      for (const p of row) {
        const d = p.contract.homeZone.defend.y, a = p.contract.homeZone.attack.y;
        p.contract.corridorAttack = Math.abs(a - d) < 4 ? p.contract.corridor
          : CORRIDORS[clamp(Math.floor(a / FW * 5), 0, 4)];
      }
    }

    /* ── cobertura ─────────────────────────────────────────────────────────
       Quem está ao lado, na mesma linha, compensa a saída. Nenhum lugar do
       motor diz isso hoje. */
    for (const line of Object.keys(byLine)) {
      const row = byLine[line].slice().sort(
        (a, b) => a.contract.homeZone.defend.y - b.contract.homeZone.defend.y);
      for (let i = 0; i < row.length; i++) {
        const c = row[i].contract;
        if (i > 0) { c.coveredBy.push(row[i - 1].contract.id); c.coverFor.push(row[i - 1].contract.id); }
        if (i < row.length - 1) { c.coveredBy.push(row[i + 1].contract.id); c.coverFor.push(row[i + 1].contract.id); }
      }
    }

    /* Linha de um jogador só — centroavante isolado do 4-5-1, volante único —
       ficava sem compensador nenhum. Medido: 12 de 374 jogadores nas 17
       formações. O compensador vem da linha adjacente, pelo y mais próximo. */
    for (const p of players) {
      const c = p.contract;
      if (!c || c.line === 'GK' || c.coverFor.length) continue;
      let best = null, bestD = Infinity;
      for (const ln of ADJACENT[c.line] || []) {
        for (const q of byLine[ln] || []) {
          if (q === p || !q.contract) continue;
          const d = Math.abs(q.contract.homeZone.defend.y - c.homeZone.defend.y);
          if (d < bestD) { bestD = d; best = q; }
        }
      }
      if (best) { c.coverFor.push(best.contract.id); c.coveredBy.push(best.contract.id); }
    }
  }

  const oldBuildTeam = P._buildTeam;
  P._buildTeam = function (t, side) {
    const tm = oldBuildTeam.apply(this, arguments);
    try {
      const audit = { slotsUnknown: [], built: 0 };
      for (const p of (tm && tm.players) || []) {
        const c = buildContract(p, side, audit);
        /* enumerable:false — invisível para Object.keys, spread e JSON.
           É o que garante que nenhum snapshot capture o contrato por acidente. */
        Object.defineProperty(p, 'contract', {
          value: c, enumerable: false, writable: true, configurable: true
        });
        audit.built++;
      }
      assignStructure((tm && tm.players) || []);
      Object.defineProperty(tm, '__contractAudit', {
        value: audit, enumerable: false, writable: true, configurable: true
      });
    } catch (_) {
      /* O contrato é inerte: se ele falhar, a partida NÃO pode falhar junto.
         No passo 3, quando alguém passar a ler, este catch tem de sair. */
    }
    return tm;
  };

  root.CDS_R18_CONTRACT = { version: VERSION, LINE_OF, ZONE, CORRIDORS, inert: true };
})(typeof window !== 'undefined' ? window : globalThis);

/*
 * Copa dos Sonhos · §19 · MATCH STATE MACHINE — INERTE (passos 1 e 2 de N)
 *
 * PASSO 1: expõe uma fase canônica `this.matchState` derivada dos sinais que o
 *          motor já mantém (`dead`/`waiting`/`isOver()`). Ninguém lê.
 * PASSO 2: MARCA O TIPO de reinício (GOAL_SEQUENCE, STOPPED_FOUL, OUT_CORNER,
 *          OUT_GOAL_KICK, HALF_TIME) envolvendo os métodos que agendam a bola
 *          morta — SEM tocar o núcleo R13 (que é byte-congelado): a marcação é
 *          por wrapper de protótipo em r14, como o §18/§19. Continua ninguém
 *          lendo; é aditivo e inerte.
 *
 * A regra do §18/item-0 vale para os dois passos: paridade determinística —
 * 294/294 placares idênticos, métricas até 1e-9 — ANTES de qualquer leitura. Se
 * a matriz mudar, o observador vazou para o motor, e a regra é reverter.
 *
 * NÃO-VAZAMENTO (padrão §18):
 *   1. `matchState` é `enumerable:false`; a dica de tipo (`_hint`) vive DENTRO
 *      dele → invisível a Object.keys/spread/JSON. Nenhum snapshot a capta.
 *   2. Nada aqui escreve em campo que o motor leia. Os wrappers só chamam o
 *      original, guardam a dica e devolvem o mesmo retorno. `refresh()` não
 *      consome RNG. `try/catch` inerte em tudo.
 *   3. O núcleo R13 (`src/r13/`) NÃO é editado — `verify_r13` continua idêntico.
 *
 * clockPolicy espelha o motor: o relógio só corre com dead<=0 (10-base:2662).
 */
(function installCDSMatchState(root) {
  'use strict';
  const M = root && root.MatchSim;
  if (!M || !M.prototype || M.prototype.__CDS_R19_MATCHSTATE__) return;
  const P = M.prototype;
  P.__CDS_R19_MATCHSTATE__ = true;

  const VERSION = '5.9.4-R19.0-inerte';
  const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

  /* Cria o objeto uma vez (enumerable:false) e depois MUTA seus campos. */
  function ensureState(sim) {
    if (sim.matchState) return sim.matchState;
    const st = {
      version: VERSION,
      phase: 'PRE_MATCH',
      enteredAtSimSeconds: 0,
      enteredAtMinute: 0,
      previousLivePhase: null,
      reason: 'init',
      clockPolicy: 'STOP',
      inputPolicy: 'LOCKED',
      transitions: 0,
      _hint: null,      // {phase, at} — tipo do reinício da bola morta corrente
      _prevHalf: null   // detecção de intervalo
    };
    Object.defineProperty(sim, 'matchState', {
      value: st, enumerable: false, writable: true, configurable: true
    });
    return st;
  }

  /* Marca o tipo do reinício corrente. `at` = this.t (constante dentro do passo)
     permite saber se a dica foi posta NESTE passo — usado para não sobrescrever
     um OUT_CORNER vindo de dentro de _goalKickOrRestart. */
  function setHint(sim, phase) {
    try { ensureState(sim)._hint = { phase, at: num(sim.t) }; } catch (_) {}
  }

  const RESTART = phase => phase; // legibilidade

  function phaseNow(sim, st) {
    if (typeof sim.isOver === 'function' && sim.isOver()) return 'FINISHED';
    const dead = num(sim.dead);
    if (dead > 0) {
      if (st._hint && st._hint.phase) return st._hint.phase;
      return num(sim.t) < 0.5 ? 'PRE_MATCH' : 'SETUP_RESTART';
    }
    return 'LIVE';
  }

  const LIVE_PHASES = new Set(['LIVE']);

  function refresh(sim, forcedReason) {
    const st = ensureState(sim);

    /* Intervalo: o motor troca half para 2/4 dentro do step; capturamos aqui,
       porque não há método dedicado a envolver. */
    const half = num(sim.half);
    if (st._prevHalf !== null && half !== st._prevHalf && (half === 2 || half === 4)) {
      setHint(sim, 'HALF_TIME');
    }
    st._prevHalf = half;

    const phase = phaseNow(sim, st);
    const dead = num(sim.dead);
    st.clockPolicy = dead > 0 ? 'STOP' : 'RUN';
    st.inputPolicy = phase === 'LIVE' ? 'FULL'
      : (phase === 'SETUP_RESTART' || phase === 'HALF_TIME') ? 'TACTICS_ONLY' : 'LOCKED';

    if (phase !== st.phase) {
      if (LIVE_PHASES.has(st.phase)) st.previousLivePhase = st.phase;
      st.phase = phase;
      st.enteredAtSimSeconds = num(sim.t);
      st.enteredAtMinute = num(sim.minute);
      st.reason = forcedReason || (st._hint && st._hint.phase) || `dead=${dead.toFixed(2)}`;
      st.transitions++;
    }
    /* Voltou a bola viva → a dica do reinício expira. */
    if (phase === 'LIVE') st._hint = null;
    return st;
  }

  /* ── wrappers de agendamento (passo 2) — só marcam a dica ─────────────────── */
  function wrapHint(name, phase, prefer) {
    const old = P[name];
    if (typeof old !== 'function') return;
    P[name] = function () {
      const r = old.apply(this, arguments);
      try {
        const st = ensureState(this);
        if (prefer) {
          /* _goalKickOrRestart pode ter chamado _setCorner por dentro NESTE
             passo: se já marcou OUT_CORNER agora, respeita. */
          if (!(st._hint && st._hint.at === num(this.t) && st._hint.phase === 'OUT_CORNER')) {
            setHint(this, phase);
          }
        } else {
          setHint(this, phase);
        }
      } catch (_) {}
      return r;
    };
  }

  wrapHint('_goal', RESTART('GOAL_SEQUENCE'), false);
  wrapHint('_awardFoul', RESTART('STOPPED_FOUL'), false);
  wrapHint('_setCorner', RESTART('OUT_CORNER'), false);
  wrapHint('_goalKickOrRestart', RESTART('OUT_GOAL_KICK'), true);

  /* ── ciclo de vida do observador ─────────────────────────────────────────── */
  const oldReset = P.reset;
  P.reset = function () {
    const r = oldReset.apply(this, arguments);
    try { const st = ensureState(this); st._hint = null; st._prevHalf = num(this.half); refresh(this, 'reset'); }
    catch (_) { /* inerte */ }
    return r;
  };

  const oldStep = P.step;
  P.step = function () {
    const r = oldStep.apply(this, arguments);
    try { refresh(this, null); }
    catch (_) { /* inerte */ }
    return r;
  };

  root.CDS_R19_MATCHSTATE = {
    version: VERSION, inert: true,
    phases: ['PRE_MATCH', 'LIVE', 'SETUP_RESTART', 'GOAL_SEQUENCE',
             'STOPPED_FOUL', 'OUT_CORNER', 'OUT_GOAL_KICK', 'HALF_TIME', 'FINISHED']
  };
})(typeof window !== 'undefined' ? window : globalThis);

