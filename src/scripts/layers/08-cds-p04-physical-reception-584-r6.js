
/*
 * Copa dos Sonhos · Build 5.8.7-R9 · P0-4 + calibração de passes
 * Recepção física, posse sem snap e detector de teleporte.
 *
 * Este patch deve ser carregado DEPOIS do motor e da timeline física 5.8.2.
 */
(function installCDSP04(root) {
  'use strict';

  const MatchSim = root && root.MatchSim;
  if (!MatchSim || !MatchSim.prototype) return;
  const P = MatchSim.prototype;
  if (P.__CDS_P04_PHYSICAL_RECEPTION_585_R7__) return;
  Object.defineProperty(P, '__CDS_P04_PHYSICAL_RECEPTION_585_R7__', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  const VERSION = '5.8.7-R9';
  const EPS = 1e-7;
  const DEFAULT_DT = 1 / 60;
  const MAX_LOG = 600;

  const original = {
    startTravel: P._startTravel,
    continueTravel: P._continueTravel,
    ballTravel: P._ballTravel,
    receive: P._receive,
    giveBall: P._giveBall,
    ballGlue: P._ballGlue,
    looseBall: P._looseBall,
    looseRoll: P._looseRoll,
    contestLoose: P._contestLoose,
    goalkeeperClaim: P._goalkeeperClaim
  };

  if (typeof original.receive !== 'function' ||
      typeof original.giveBall !== 'function' ||
      typeof original.ballGlue !== 'function' ||
      typeof original.looseRoll !== 'function' ||
      typeof original.contestLoose !== 'function') {
    return;
  }

  function finite(value, fallback) {
    return Number.isFinite(value) ? value : (fallback == null ? 0 : fallback);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function distance(ax, ay, bx, by) {
    return Math.hypot(finite(ax) - finite(bx), finite(ay) - finite(by));
  }

  function actorId(player) {
    if (!player) return null;
    if (player.idx != null) return player.idx;
    if (player.id != null) return player.id;
    if (player.ref && player.ref.id != null) return player.ref.id;
    return null;
  }

  function actorName(player) {
    if (!player) return '—';
    if (player.ref && player.ref.n) return player.ref.n;
    return player.name || player.n || String(actorId(player) == null ? '—' : actorId(player));
  }

  function playerHeight(player) {
    const profile = player && player.ref && player.ref.profileV3;
    const cm = profile && finite(profile.heightCmSim, NaN);
    return clamp(Number.isFinite(cm) ? cm / 100 : (player && player.isGK ? 1.88 : 1.80), 1.55, 2.08);
  }

  function ensureDiagnostics(sim) {
    if (!sim.__p04Diagnostics) {
      sim.__p04Diagnostics = {
        version: VERSION,
        installed: true,
        contacts: 0,
        receptionContacts: 0,
        looseBallContacts: 0,
        preventedOwnerTransfers: 0,
        snapPreventions: 0,
        controlTransitions: 0,
        poorTouchDeflections: 0,
        ownerChangesWithoutContact: 0,
        liveOwnerTransfersBlocked: 0,
        ownerToOwnerContacts: 0,
        anchorClamps: 0,
        missedReceptionContinuations: 0,
        releaseActorContactsPrevented: 0,
        directOwnerAssignmentsReverted: 0,
        boundaryTeleportsClamped: 0,
        controlLocksApplied: 0,
        movingPlayerContacts: 0,
        maxObservedFrameStep: 0,
        maxAllowedFrameStep: 0,
        maxControlStep: 0,
        maxOwnerDistanceAtTransfer: 0,
        events: []
      };
    }
    return sim.__p04Diagnostics;
  }

  function log(sim, type, data) {
    const diagnostics = ensureDiagnostics(sim);
    const event = Object.assign({
      type: type,
      time: finite(sim && sim.t),
      minute: finite(sim && sim.minute),
      version: VERSION
    }, data || {});
    diagnostics.events.push(event);
    if (diagnostics.events.length > MAX_LOG) diagnostics.events.splice(0, diagnostics.events.length - MAX_LOG);
    return event;
  }

  function sampleBall(ball) {
    return {
      x: finite(ball && ball.x),
      y: finite(ball && ball.y),
      z: Math.max(0, finite(ball && ball.z)),
      vx: finite(ball && ball.vx),
      vy: finite(ball && ball.vy),
      vz: finite(ball && ball.vz)
    };
  }

  function speed3(sample) {
    return Math.hypot(finite(sample && sample.vx), finite(sample && sample.vy), finite(sample && sample.vz));
  }

  function sanitizeSegment(sim, from, to, applyToBall) {
    const start = from || to || { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
    const end = to || start;
    const dt = clamp(finite(sim && sim.__p04LastDt, DEFAULT_DT), 1 / 240, 0.12);
    const observed = distance(start.x, start.y, end.x, end.y);
    const speed = Math.max(speed3(start), speed3(end));
    // Tolerância suficiente para integração sub-frame, mas pequena demais para
    // aceitar que o motor conclua uma viagem reposicionando a bola no target.
    const allowed = Math.max(0.18, speed * dt * 1.55 + 0.14);
    const diagnostics = ensureDiagnostics(sim);
    diagnostics.maxObservedFrameStep = Math.max(diagnostics.maxObservedFrameStep, observed);
    diagnostics.maxAllowedFrameStep = Math.max(diagnostics.maxAllowedFrameStep, allowed);
    if (observed <= allowed + 0.06 || observed <= EPS) {
      return { from: start, to: end, clamped: false, observed: observed, allowed: allowed };
    }

    const ratio = clamp(allowed / observed, 0, 1);
    const safe = {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
      z: Math.max(0, start.z + (end.z - start.z) * ratio),
      vx: finite(end.vx, start.vx),
      vy: finite(end.vy, start.vy),
      vz: finite(end.vz, start.vz)
    };
    diagnostics.anchorClamps += 1;
    log(sim, 'base_anchor_clamped', {
      observedStep: observed,
      allowedStep: allowed,
      fromX: start.x,
      fromY: start.y,
      requestedX: end.x,
      requestedY: end.y,
      safeX: safe.x,
      safeY: safe.y
    });
    if (applyToBall && sim && sim.ball) {
      sim.ball.x = safe.x;
      sim.ball.y = safe.y;
      sim.ball.z = safe.z;
    }
    return { from: start, to: safe, clamped: true, observed: observed, allowed: allowed };
  }

  function closestPointOnSegment(ax, ay, bx, by, px, py) {
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby;
    const t = len2 <= EPS ? 1 : clamp(((px - ax) * abx + (py - ay) * aby) / len2, 0, 1);
    const x = ax + abx * t;
    const y = ay + aby * t;
    return { t: t, x: x, y: y, distance: distance(x, y, px, py) };
  }

  function surfaceAndReach(player, z, speed) {
    const h = playerHeight(player);
    const movingBonus = clamp(finite(speed) / 85, 0, 0.08);

    if (player && player.isGK) {
      if (z <= 0.55) return { surface: 'foot_or_low_hand', radius: 0.96 + movingBonus, maxZ: 0.72 };
      if (z <= 1.55) return { surface: 'hand_or_body', radius: 0.88 + movingBonus, maxZ: 1.70 };
      if (z <= h + 0.52) return { surface: 'extended_hand', radius: 1.04 + movingBonus, maxZ: h + 0.52 };
      return null;
    }

    if (z <= 0.58) return { surface: 'foot', radius: 0.90 + movingBonus, maxZ: 0.58 };
    if (z <= 1.28) return { surface: 'thigh_or_chest', radius: 0.72 + movingBonus, maxZ: 1.28 };
    if (z <= h + 0.28) return { surface: 'head', radius: 0.62 + movingBonus, maxZ: h + 0.28 };
    return null;
  }

  function allActivePlayers(sim) {
    const result = [];
    const teams = sim && Array.isArray(sim.teams) ? sim.teams : [];
    for (const team of teams) {
      const players = team && Array.isArray(team.players) ? team.players : [];
      for (const player of players) {
        if (!player || player.red) continue;
        result.push(player);
      }
    }
    return result;
  }

  function contactCandidate(sim, player, from, to, intendedReceiver) {
    if (!player || player.red) return null;
    const ball = sim && sim.ball;
    if (ball && player === ball.__p04ReleaseActor &&
        finite(sim.t) - finite(ball.__p04ReleaseTime, -999) < 0.22) {
      ensureDiagnostics(sim).releaseActorContactsPrevented += 1;
      return null;
    }
    // Colisão espaço-temporal: a bola e o jogador podem se mover no mesmo frame.
    // Calculamos a menor distância no referencial relativo, não contra a posição
    // final estática do atleta.
    const previousPlayers = sim && sim.__p04PlayerPrevPositions;
    const previousPlayer = previousPlayers && previousPlayers.get ? previousPlayers.get(player) : null;
    const p0x = previousPlayer ? finite(previousPlayer.x, player.x) : finite(player.x);
    const p0y = previousPlayer ? finite(previousPlayer.y, player.y) : finite(player.y);
    const p1x = finite(player.x);
    const p1y = finite(player.y);
    const relative = closestPointOnSegment(
      from.x - p0x, from.y - p0y,
      to.x - p1x, to.y - p1y,
      0, 0
    );
    const t = relative.t;
    const ballX = from.x + (to.x - from.x) * t;
    const ballY = from.y + (to.y - from.y) * t;
    const playerX = p0x + (p1x - p0x) * t;
    const playerY = p0y + (p1y - p0y) * t;
    const contactDistance = distance(ballX, ballY, playerX, playerY);
    const z = from.z + (to.z - from.z) * t;
    const vx = from.vx + (to.vx - from.vx) * t;
    const vy = from.vy + (to.vy - from.vy) * t;
    const vz = from.vz + (to.vz - from.vz) * t;
    const speed = Math.hypot(vx, vy, vz);
    const reach = surfaceAndReach(player, z, speed);
    if (!reach || contactDistance > reach.radius) return null;
    if (previousPlayer && (Math.abs(p1x - p0x) > 0.001 || Math.abs(p1y - p0y) > 0.001)) {
      ensureDiagnostics(sim).movingPlayerContacts += 1;
    }

    return {
      player: player,
      actorId: actorId(player),
      actorName: actorName(player),
      t: t,
      x: ballX,
      y: ballY,
      z: z,
      distance: contactDistance,
      radius: reach.radius,
      surface: reach.surface,
      intended: player === intendedReceiver,
      incomingVelocity: { x: vx, y: vy, z: vz },
      incomingSpeed: speed
    };
  }


  function goalkeeperClaimCandidate(sim, player, current) {
    if (!sim || !player || !player.isGK || !current) return null;
    const ball = sim.ball;
    const attr = root && typeof root.getAttr === 'function' ? root.getAttr : null;
    let domain = 70;
    try { domain = attr ? finite(attr(player.ref || player, 'dominio_area'), 70) : 70; } catch (_) {}
    const swing = ball && ball.lastTouch && finite(ball.lastTouch._deliverySwingUntil) > finite(sim.t)
      ? ball.lastTouch._deliverySwing : null;
    const radius = 1.25 + domain / 100 * 1.65 + (swing === 'in' ? 0.55 : swing === 'out' ? -0.55 : 0);
    const d = distance(current.x, current.y, finite(player.x), finite(player.y));
    if (d > radius + 0.0001 || current.z > 2.70) return null;
    return {
      player: player,
      actorId: actorId(player),
      actorName: actorName(player),
      t: 1,
      x: current.x,
      y: current.y,
      z: current.z,
      distance: d,
      radius: radius,
      surface: current.z > 1.55 ? 'extended_hand_claim' : (current.z > 0.55 ? 'hand_or_body_claim' : 'low_hand_claim'),
      intended: true,
      incomingVelocity: { x: current.vx, y: current.vy, z: current.vz },
      incomingSpeed: speed3(current)
    };
  }

  function findFirstContact(sim, from, to, preferred) {
    const players = allActivePlayers(sim);
    let best = null;
    for (const player of players) {
      const candidate = contactCandidate(sim, player, from, to, preferred);
      if (!candidate) continue;
      // A intenção do passe nunca vence a física. O primeiro contato temporal
      // vence; o receptor pretendido só desempata coincidências numéricas.
      const tie = best && Math.abs(candidate.t - best.t) <= 1e-6;
      if (!best || candidate.t < best.t - 1e-6 ||
          (tie && candidate.distance < best.distance - 1e-6) ||
          (tie && Math.abs(candidate.distance - best.distance) <= 1e-6 && candidate.intended && !best.intended)) {
        best = candidate;
      }
    }
    return best;
  }

  function isAdministrativeTransfer(sim, ball) {
    if (sim.__p04AdminPermit) return true;
    if (finite(sim.dead) > 0) return true;
    if (sim.pendingRestart) return true;
    if (!ball) return true;
    const speed = Math.hypot(finite(ball.vx), finite(ball.vy), finite(ball.vz));
    if (!ball.__p04Live && !ball.traveling && !ball.owner && speed < 0.08) return true;
    return false;
  }

  function desiredFootPoint(sim, owner) {
    const team = sim && sim.teams && sim.teams[owner.team];
    const goal = team && team.oppGoal ? team.oppGoal : { x: finite(owner.x) + 1, y: finite(owner.y) };
    const angle = Math.atan2(finite(goal.y) - finite(owner.y), finite(goal.x) - finite(owner.x));
    return {
      x: finite(owner.x) + Math.cos(angle) * 0.55,
      y: finite(owner.y) + Math.sin(angle) * 0.55,
      z: 0
    };
  }

  function beginControlTransition(sim, owner, contact) {
    const ball = sim.ball;
    if (!ball || !owner) return;
    const now = finite(sim.t);
    const start = sampleBall(ball);
    const desired = desiredFootPoint(sim, owner);
    const gap = distance(start.x, start.y, desired.x, desired.y);
    ball.__p04ControlTransition = {
      owner: owner,
      ownerId: actorId(owner),
      startTime: now,
      lastTime: now,
      start: start,
      contact: contact || null,
      initialGap: gap
    };
    const diagnostics = ensureDiagnostics(sim);
    diagnostics.controlTransitions += 1;
    diagnostics.maxOwnerDistanceAtTransfer = Math.max(diagnostics.maxOwnerDistanceAtTransfer, gap);
    // A posse lógica pode existir após o contato, mas o jogador não pode tomar
    // nova decisão antes de a bola terminar a aproximação física ao pé.
    const ownerSpeed = Math.hypot(finite(owner.vx), finite(owner.vy));
    const controlDuration = gap / Math.max(6.0, ownerSpeed + 10.5) + 0.020;
    owner.settle = Math.max(finite(owner.settle), controlDuration);
    diagnostics.controlLocksApplied += 1;
    log(sim, 'control_transition_started', {
      actorId: actorId(owner),
      actorName: actorName(owner),
      initialGap: gap,
      controlDuration: controlDuration,
      contactType: contact && contact.type || null
    });
  }

  function recordPhysicalContact(sim, contact, type) {
    const ball = sim.ball;
    const diagnostics = ensureDiagnostics(sim);
    diagnostics.contacts += 1;
    if (type === 'reception') diagnostics.receptionContacts += 1;
    else diagnostics.looseBallContacts += 1;

    const outgoing = ball ? { x: finite(ball.vx), y: finite(ball.vy), z: finite(ball.vz) } : { x: 0, y: 0, z: 0 };
    const payload = {
      type: type,
      source: 'p04_physical_reception',
      actorId: contact.actorId,
      actorName: contact.actorName,
      x: contact.x,
      y: contact.y,
      z: contact.z,
      surface: contact.surface,
      distance: contact.distance,
      radius: contact.radius,
      segmentT: contact.t,
      intended: !!contact.intended,
      incomingVelocity: contact.incomingVelocity,
      outgoingVelocity: outgoing
    };

    log(sim, 'physical_contact', payload);

    if (typeof sim._recordVisualContact === 'function') {
      try {
        sim._recordVisualContact(type === 'reception' ? 'receive' : 'loose_receive', contact.player, contact.x, contact.y, {
          source: payload.source,
          z: contact.z,
          surface: contact.surface,
          distance: contact.distance,
          contactRadius: contact.radius,
          segmentT: contact.t,
          intended: !!contact.intended,
          incomingVelocity: contact.incomingVelocity,
          outgoingVelocity: outgoing,
          receiverId: contact.actorId
        });
      } catch (_) {
        // A auditoria própria permanece disponível mesmo se uma build antiga
        // não aceitar o novo tipo de contato na timeline visual.
      }
    }
  }

  function completePhysicalReception(sim, contact, type) {
    if (!contact || !contact.player || contact.player.red) return false;
    const ball = sim.ball;
    if (!ball) return false;

    // O instante real de contato passa a ser o estado da bola. Esta correção é
    // sub-frame e limitada ao próprio segmento percorrido; não reposiciona a bola
    // no jogador nem no target do passe.
    ball.x = contact.x;
    ball.y = contact.y;
    ball.z = Math.max(0, contact.z);

    sim.__p04ContactPermit = {
      player: contact.player,
      actorId: contact.actorId,
      time: finite(sim.t),
      contact: contact,
      type: type
    };
    sim.__p04ReceiveContext = true;

    let result;
    try {
      result = original.receive.call(sim, contact.player);
    } finally {
      sim.__p04ReceiveContext = false;
      sim.__p04ContactPermit = null;
    }

    // R18.11: a física continua decidindo quem chegou primeiro. Depois do
    // contato real, antecipação/posicionamento podem alterar apenas a rapidez
    // de preparar a bola e a estabilidade da primeira decisão.
    if(type === 'loose_ball' && ball.owner === contact.player && sim._r1811AfterSecondBallControl){
      sim._r1811AfterSecondBallControl(contact.player, contact);
    }
    recordPhysicalContact(sim, contact, type);
    ball.__p04PendingReceiver = null;
    ball.__p04PendingUntil = 0;
    if (ball.owner) ball.__p04Live = false;
    return !!ball.owner;
  }

  function tryPhysicalContact(sim, from, to, preferred, type) {
    const contact = findFirstContact(sim, from, to, preferred);
    if (!contact) return false;
    return completePhysicalReception(sim, contact, type || (preferred ? 'reception' : 'loose_ball'));
  }

  function wrapArrival(sim, callback, receiver) {
    if (typeof callback !== 'function') return callback;
    return function p04ArrivalWrapper() {
      const previous = sim.__p04ArrivalContext;
      sim.__p04ArrivalContext = { receiver: receiver || null, time: finite(sim.t) };
      try {
        return callback.apply(this, arguments);
      } finally {
        sim.__p04ArrivalContext = previous || null;
      }
    };
  }

  if (typeof original.startTravel === 'function') {
    P._startTravel = function p04StartTravel() {
      const args = Array.prototype.slice.call(arguments);
      const receiver = args.length > 4 ? args[4] : null;
      const releaseActor = this.ball && (this.ball.owner || this.ball.lastTouch) || null;
      if (typeof args[3] === 'function') args[3] = wrapArrival(this, args[3], receiver);
      const result = original.startTravel.apply(this, args);
      const ball = this.ball;
      if (ball) {
        ball.__p04ReleaseActor = releaseActor;
        ball.__p04ReleaseTime = finite(this.t);
        ball.__p04Live = true;
        ball.__p04IntendedReceiver = receiver || ball.receiver || null;
        ball.__p04PendingReceiver = null;
        ball.__p04PreviousSample = sampleBall(ball);
      }
      return result;
    };
  }

  if (typeof original.continueTravel === 'function') {
    P._continueTravel = function p04ContinueTravel() {
      const args = Array.prototype.slice.call(arguments);
      if (typeof args[2] === 'function') args[2] = wrapArrival(this, args[2], null);
      const result = original.continueTravel.apply(this, args);
      const ball = this.ball;
      if (ball) {
        ball.__p04Live = true;
        ball.__p04PreviousSample = sampleBall(ball);
      }
      return result;
    };
  }

  if (typeof original.ballTravel === 'function') {
    P._ballTravel = function p04BallTravel(dt) {
      const ball = this.ball;
      if (!ball) return original.ballTravel.apply(this, arguments);
      this.__p04LastDt = clamp(finite(dt, DEFAULT_DT), 1 / 240, 0.12);
      const before = sampleBall(ball);
      ball.__p04PreviousSample = before;
      const previousOwner = ball.owner;
      const result = original.ballTravel.apply(this, arguments);

      // O motor-base ainda pode tentar concluir a viagem no target. A correção
      // limita o deslocamento ao que a velocidade e o dt permitem.
      if (!ball.owner && ball.__p04Live && !isAdministrativeTransfer(this, ball)) {
        const after = sampleBall(ball);
        const safe = sanitizeSegment(this, before, after, true);
        if (safe.clamped && !ball.traveling && speed3(before) > 0.55) {
          ball.vx = before.vx * 0.72;
          ball.vy = before.vy * 0.72;
          ball.vz = before.vz * 0.72;
          ball._looseT = 0;
          ball.__p04Live = true;
          ensureDiagnostics(this).missedReceptionContinuations += 1;
          log(this, 'missed_reception_continues_physically', {
            vx: ball.vx, vy: ball.vy, vz: ball.vz
          });
        }
      }

      const contactBackedTransfer = !!(ball.owner && ball.__p04LastOwnerTransferContactActor === ball.owner &&
        Math.abs(finite(ball.__p04LastOwnerTransferContactTime, -999) - finite(this.t)) <= this.__p04LastDt + 0.0001);
      if (previousOwner !== ball.owner && ball.owner && !contactBackedTransfer && !isAdministrativeTransfer(this, ball)) {
        const diagnostics = ensureDiagnostics(this);
        diagnostics.ownerChangesWithoutContact += 1;
        log(this, 'owner_changed_without_contact_during_travel', {
          previousOwnerId: actorId(previousOwner),
          actorId: actorId(ball.owner),
          actorName: actorName(ball.owner)
        });
      }
      return result;
    };
  }

  P._receive = function p04Receive(player) {
    const ball = this.ball;
    const liveArrival = !!(ball && (ball.__p04Live || this.__p04ArrivalContext));
    if (!liveArrival || this.__p04ReceiveContext) {
      return original.receive.apply(this, arguments);
    }

    if (!player || player.red) {
      if (ball) {
        ball.__p04PendingReceiver = null;
        ball.__p04PendingUntil = 0;
      }
      return false;
    }

    ball.owner = null;
    ball.traveling = false;
    ball.receiver = player;
    ball.__p04IntendedReceiver = player;
    ball.__p04PendingReceiver = player;
    ball.__p04PendingUntil = finite(this.t) + 1.05;

    const rawCurrent = sampleBall(ball);
    const previous = ball.__p04PreviousSample || rawCurrent;
    const segment = sanitizeSegment(this, previous, rawCurrent, true);
    if (tryPhysicalContact(this, segment.from, segment.to, player, 'reception')) return true;

    // Um passe que erra o pé não pode morrer no ponto-alvo. Se o motor-base
    // zerou a velocidade no callback, preservamos parte do impulso de entrada.
    if (speed3(sampleBall(ball)) < 0.25 && speed3(previous) > 0.55) {
      ball.vx = previous.vx * 0.56;
      ball.vy = previous.vy * 0.56;
      ball.vz = previous.vz * 0.56;
      ball._looseT = 0;
      ball.__p04Live = true;
      ensureDiagnostics(this).missedReceptionContinuations += 1;
    }

    const current = sampleBall(ball);
    log(this, 'reception_waiting_for_contact', {
      actorId: actorId(player),
      actorName: actorName(player),
      ballX: current.x,
      ballY: current.y,
      ballZ: current.z,
      distance: distance(current.x, current.y, finite(player.x), finite(player.y))
    });
    return false;
  };


  if (typeof original.goalkeeperClaim === 'function') {
    P._goalkeeperClaim = function p04GoalkeeperClaim() {
      const previous = this.__p04GKClaimContext;
      this.__p04GKClaimContext = { player: arguments[1] || null };
      try { return original.goalkeeperClaim.apply(this, arguments); }
      finally { this.__p04GKClaimContext = previous; }
    };
  }

  P._giveBall = function p04GiveBall(player) {
    const ball = this.ball;
    let permit = this.__p04ContactPermit;
    const administrative = isAdministrativeTransfer(this, ball);
    const previousOwner = ball && ball.owner;
    const competitiveTransfer = !!(ball && player && previousOwner !== player && !administrative);
    let validPermit = !!(permit && permit.player === player && permit.contact);
    let synthesizedContact = null;

    // Também bloqueia owner→owner. A versão anterior só protegia bolas sem dono,
    // deixando desarmes/roubadas diretas escaparem pela mesma porta de snap.
    if (competitiveTransfer && !validPermit) {
      const current = sampleBall(ball);
      const previous = ball.__p04PreviousSample || current;
      const segment = sanitizeSegment(this, previous, current, false);
      const gkClaimContext = this.__p04GKClaimContext && this.__p04GKClaimContext.player === player;
      synthesizedContact = (gkClaimContext ? goalkeeperClaimCandidate(this, player, current) : null) ||
        contactCandidate(this, player, segment.from, segment.to, player) ||
        contactCandidate(this, player, current, current, player);
      if (synthesizedContact) {
        permit = {
          player: player,
          actorId: synthesizedContact.actorId,
          time: finite(this.t),
          contact: synthesizedContact,
          type: gkClaimContext ? 'goalkeeper_claim' : (previousOwner ? 'possession_challenge' : 'reception')
        };
        validPermit = true;
        ensureDiagnostics(this).ownerToOwnerContacts += previousOwner ? 1 : 0;
      }
    }

    if (competitiveTransfer && !validPermit) {
      const diagnostics = ensureDiagnostics(this);
      diagnostics.preventedOwnerTransfers += 1;
      diagnostics.liveOwnerTransfersBlocked += 1;
      log(this, 'owner_transfer_blocked_without_contact', {
        previousOwnerId: actorId(previousOwner),
        actorId: actorId(player),
        actorName: actorName(player),
        ballX: finite(ball.x),
        ballY: finite(ball.y),
        playerX: finite(player && player.x),
        playerY: finite(player && player.y),
        distance: player ? distance(ball.x, ball.y, player.x, player.y) : null
      });
      if (!previousOwner && player) {
        ball.__p04PendingReceiver = player;
        ball.__p04PendingUntil = finite(this.t) + 0.70;
      }
      return false;
    }

    const before = ball ? sampleBall(ball) : null;
    const result = original.giveBall.apply(this, arguments);

    if (ball && ball.owner === player && player && previousOwner !== player) {
      const contact = validPermit ? permit.contact : null;
      if (!contact && !administrative) {
        const diagnostics = ensureDiagnostics(this);
        diagnostics.ownerChangesWithoutContact += 1;
        log(this, 'owner_changed_without_contact_after_guard', {
          previousOwnerId: actorId(previousOwner), actorId: actorId(player)
        });
      }
      if (administrative) {
        ball.__p04ControlTransition = null;
        ball.__p04Live = false;
        try { original.ballGlue.call(this); } catch (_) {}
      } else {
        beginControlTransition(this, player, contact);
        ball.__p04LastPhysicalContact = contact || null;
        if (validPermit) {
          ball.__p04LastOwnerTransferContactTime = finite(this.t);
          ball.__p04LastOwnerTransferContactActor = player;
        }
        ball.__p04Live = false;
        if (synthesizedContact) {
          recordPhysicalContact(this, synthesizedContact, permit && permit.type ? permit.type : (previousOwner ? 'possession_challenge' : 'reception'));
        }
      }
      if (before) ball.__p04PreviousSample = before;
    }
    return result;
  };

  P._ballGlue = function p04BallGlue() {
    const ball = this.ball;
    const owner = ball && ball.owner;
    if (!ball || !owner) return;

    const diagnostics = ensureDiagnostics(this);
    const desired = desiredFootPoint(this, owner);
    const now = finite(this.t);
    const transition = ball.__p04ControlTransition;
    const previousTime = transition ? finite(transition.lastTime, now - DEFAULT_DT) : finite(ball.__p04GlueTime, now - DEFAULT_DT);
    const dt = clamp(now - previousTime || finite(this.__p04LastDt, DEFAULT_DT), 1 / 240, 0.08);
    ball.__p04GlueTime = now;
    if (transition) transition.lastTime = now;

    const dx = desired.x - finite(ball.x);
    const dy = desired.y - finite(ball.y);
    const gap = Math.hypot(dx, dy);
    const ownerSpeed = Math.hypot(finite(owner.vx), finite(owner.vy));
    const maxStep = Math.max(0.06, (ownerSpeed + 10.5) * dt);
    const step = Math.min(gap, maxStep);

    if (gap > maxStep + 0.015) {
      diagnostics.snapPreventions += 1;
      if (!transition) beginControlTransition(this, owner, ball.__p04LastPhysicalContact || null);
    }

    if (gap > EPS) {
      ball.x = finite(ball.x) + dx / gap * step;
      ball.y = finite(ball.y) + dy / gap * step;
    } else {
      ball.x = desired.x;
      ball.y = desired.y;
    }

    const zStep = Math.min(Math.max(0, finite(ball.z)), 7.5 * dt);
    ball.z = Math.max(0, finite(ball.z) - zStep);
    ball.vx = dt > EPS ? (step > 0 ? dx / Math.max(gap, EPS) * step / dt : finite(owner.vx)) : finite(owner.vx);
    ball.vy = dt > EPS ? (step > 0 ? dy / Math.max(gap, EPS) * step / dt : finite(owner.vy)) : finite(owner.vy);
    ball.vz = -zStep / Math.max(dt, EPS);
    diagnostics.maxControlStep = Math.max(diagnostics.maxControlStep, step);

    if (gap <= 0.045 && ball.z <= 0.025) {
      ball.x = desired.x;
      ball.y = desired.y;
      ball.z = 0;
      ball.vx = finite(owner.vx);
      ball.vy = finite(owner.vy);
      ball.vz = 0;
      ball.__p04ControlTransition = null;
    }
  };

  if (typeof original.looseBall === 'function') {
    P._looseBall = function p04LooseBall(x, y) {
      const ball = this.ball;
      const targetX = finite(x, ball && ball.x);
      const targetY = finite(y, ball && ball.y);
      const live = !!(ball && (ball.__p04Live || this.__p04ReceiveContext) && !isAdministrativeTransfer(this, ball));
      const gap = ball ? distance(ball.x, ball.y, targetX, targetY) : 0;

      if (live && gap > 0.14) {
        const diagnostics = ensureDiagnostics(this);
        const speed = clamp(gap / 0.24, 3.5, 11.0);
        const dx = targetX - finite(ball.x);
        const dy = targetY - finite(ball.y);
        ball.owner = null;
        ball.traveling = false;
        ball.vx = dx / Math.max(gap, EPS) * speed;
        ball.vy = dy / Math.max(gap, EPS) * speed;
        ball.vz = Math.max(-0.4, finite(ball.vz));
        ball._looseT = 0;
        ball.__p04Live = true;
        ball.__p04PendingReceiver = null;
        ball.__p04PendingUntil = 0;
        diagnostics.poorTouchDeflections += 1;
        log(this, 'loose_ball_converted_to_physical_deflection', {
          fromX: finite(ball.x),
          fromY: finite(ball.y),
          intendedX: targetX,
          intendedY: targetY,
          distance: gap,
          speed: speed
        });
        return;
      }

      const result = original.looseBall.apply(this, arguments);
      if (ball) {
        ball.__p04Live = !isAdministrativeTransfer(this, ball);
        ball.__p04PreviousSample = sampleBall(ball);
      }
      return result;
    };
  }

  P._contestLoose = function p04ContestLoose() {
    const ball = this.ball;
    if (!ball) return;
    const current = sampleBall(ball);
    const previous = ball.__p04PreviousSample || current;
    const segment = sanitizeSegment(this, previous, current, true);
    const preferred = ball.__p04PendingReceiver || ball.__p04IntendedReceiver || null;
    if (tryPhysicalContact(this, segment.from, segment.to, preferred, preferred ? 'reception' : 'loose_ball')) return true;
    return false;
  };

  P._looseRoll = function p04LooseRoll(dt) {
    const ball = this.ball;
    if (!ball) return original.looseRoll.apply(this, arguments);
    this.__p04LastDt = clamp(finite(dt, DEFAULT_DT), 1 / 240, 0.12);
    const previous = sampleBall(ball);
    ball.__p04PreviousSample = previous;
    const previousOwner = ball.owner;
    const result = original.looseRoll.apply(this, arguments);
    if (!ball.owner && !isAdministrativeTransfer(this, ball)) {
      sanitizeSegment(this, previous, sampleBall(ball), true);
    }

    const contactBackedTransfer = !!(ball.owner && ball.__p04LastOwnerTransferContactActor === ball.owner &&
      Math.abs(finite(ball.__p04LastOwnerTransferContactTime, -999) - finite(this.t)) < 0.0001);
    if (previousOwner !== ball.owner && ball.owner && !contactBackedTransfer && !isAdministrativeTransfer(this, ball)) {
      const diagnostics = ensureDiagnostics(this);
      diagnostics.ownerChangesWithoutContact += 1;
      log(this, 'owner_changed_without_contact_during_loose_roll', {
        actorId: actorId(ball.owner),
        actorName: actorName(ball.owner)
      });
    }

    if (!ball.owner && !ball.traveling && !isAdministrativeTransfer(this, ball)) {
      const current = sampleBall(ball);
      const segment = sanitizeSegment(this, previous, current, true);
      const preferred = ball.__p04PendingReceiver || ball.__p04IntendedReceiver || null;
      tryPhysicalContact(this, segment.from, segment.to, preferred, preferred ? 'reception' : 'loose_ball');

      if (ball.__p04PendingReceiver && finite(this.t) > finite(ball.__p04PendingUntil)) {
        log(this, 'reception_window_expired', {
          actorId: actorId(ball.__p04PendingReceiver),
          actorName: actorName(ball.__p04PendingReceiver),
          distance: distance(ball.x, ball.y, ball.__p04PendingReceiver.x, ball.__p04PendingReceiver.y)
        });
        ball.__p04PendingReceiver = null;
        ball.__p04PendingUntil = 0;
      }
    }
    return result;
  };

  // Auditoria de borda: captura e CORRIGE mudanças diretas de owner e saltos
  // feitos fora dos contratos. Também preserva a posição anterior dos jogadores
  // para colisão espaço-temporal no mesmo frame.
  const stepName = ['step', 'tick', 'update', '_step'].find(function(name) {
    return typeof P[name] === 'function' && P[name] !== P._ballTravel && P[name] !== P._looseRoll;
  });
  if (stepName) {
    const originalStep = P[stepName];
    P[stepName] = function p04AuditedStep() {
      const ball = this.ball;
      const beforeOwner = ball && ball.owner;
      const beforeBall = ball ? sampleBall(ball) : null;
      const adminBefore = isAdministrativeTransfer(this, ball);
      const playerMap = new Map();
      for (const player of allActivePlayers(this)) {
        playerMap.set(player, { x: finite(player.x), y: finite(player.y) });
      }
      this.__p04PlayerPrevPositions = playerMap;

      // Reposições são executadas dentro do próprio step depois que o motor
      // limpa pendingRestart. Sem esta permissão curta, o guard interpretava
      // lateral/tiro de meta/kickoff como uma tomada de posse competitiva.
      const stepDt = clamp(finite(arguments[0], DEFAULT_DT), 1 / 240, 0.12);
      const restartWillRun = !!this.pendingRestart && finite(this.dead) > 0 &&
        finite(this.dead) <= stepDt + 0.000001;
      const previousAdminPermit = this.__p04AdminPermit;
      if (restartWillRun) this.__p04AdminPermit = true;
      let result;
      try {
        result = originalStep.apply(this, arguments);
      } finally {
        this.__p04AdminPermit = previousAdminPermit;
        // Mantemos o mapa até o fim das verificações deste frame.
      }

      const afterOwner = ball && ball.owner;
      if (ball && beforeOwner !== afterOwner && afterOwner && !adminBefore) {
        const dt = clamp(finite(this.__p04LastDt, DEFAULT_DT), 1 / 240, 0.12);
        const backed = ball.__p04LastOwnerTransferContactActor === afterOwner &&
          Math.abs(finite(ball.__p04LastOwnerTransferContactTime, -999) - finite(this.t)) <= dt + 0.0001;
        if (!backed) {
          const diagnostics = ensureDiagnostics(this);
          diagnostics.ownerChangesWithoutContact += 1;
          diagnostics.directOwnerAssignmentsReverted += 1;
          log(this, 'direct_owner_assignment_reverted', {
            step: stepName,
            previousOwnerId: actorId(beforeOwner),
            actorId: actorId(afterOwner)
          });
          // Não devolvemos a bola magicamente ao dono anterior. A consequência
          // física neutra é bola viva e solta exatamente onde o frame a deixou.
          ball.owner = null;
          ball.traveling = false;
          ball.__p04Live = true;
          ball.__p04PendingReceiver = afterOwner;
          ball.__p04PendingUntil = finite(this.t) + 0.45;
          ball._looseT = 0;
        }
      }

      if (ball && beforeBall && !adminBefore && !restartWillRun && !isAdministrativeTransfer(this, ball)) {
        const afterBall = sampleBall(ball);
        const checked = sanitizeSegment(this, beforeBall, afterBall, true);
        if (checked.clamped) {
          ensureDiagnostics(this).boundaryTeleportsClamped += 1;
          if (ball.owner) {
            // Um owner válido continua existindo, mas a aproximação será refeita
            // gradualmente pelo _ballGlue endurecido.
            beginControlTransition(this, ball.owner, ball.__p04LastPhysicalContact || null);
          } else {
            ball.__p04Live = true;
          }
        }
      }
      this.__p04PlayerPrevPositions = null;
      return result;
    };
  }

  P.getP04ValidationReport = function getP04ValidationReport() {
    const diagnostics = ensureDiagnostics(this);
    return JSON.parse(JSON.stringify({
      version: VERSION,
      status: diagnostics.ownerChangesWithoutContact === 0 && diagnostics.directOwnerAssignmentsReverted === 0 ? 'READY_FOR_FULL_MATCH_REGRESSION' : 'VIOLATION_DETECTED',
      diagnostics: diagnostics,
      ball: this.ball ? {
        ownerId: actorId(this.ball.owner),
        traveling: !!this.ball.traveling,
        live: !!this.ball.__p04Live,
        pendingReceiverId: actorId(this.ball.__p04PendingReceiver),
        x: finite(this.ball.x),
        y: finite(this.ball.y),
        z: finite(this.ball.z)
      } : null
    }));
  };

  root.CDS_P04 = Object.freeze({
    version: VERSION,
    contract: 'contact-before-possession',
    installed: true,
    getReport: function getReport(sim) {
      return sim && typeof sim.getP04ValidationReport === 'function'
        ? sim.getP04ValidationReport()
        : { version: VERSION, installed: true, error: 'MatchSim instance required' };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);

