
/*
 * Copa dos Sonhos · Motor Visual 2.5D · Gate A contracts v0.2
 * Fundação não invasiva: contratos físicos/visuais imutáveis, adaptação da
 * timeline 5.8.2, interpolação entre ticks e projeção reversível.
 */
(function installCDS25DContracts(root) {
  'use strict';
  if (root.CDS_25D_CONTRACTS && root.CDS_25D_CONTRACTS.version === '0.2.0') return;

  const VERSION = '0.2.0';
  const SCHEMA = 'cds.visual.2_5d.v1';
  const EPS = 1e-9;

  const finite = (v, name) => {
    if (!Number.isFinite(v)) throw new TypeError(name + ' must be finite');
    return v;
  };
  const text = (v, name) => {
    if (typeof v !== 'string' || !v.trim()) throw new TypeError(name + ' must be a non-empty string');
    return v;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clone = value => {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    return value;
  }
  const vec3 = (value, name) => deepFreeze({
    x: finite(value && value.x, name + '.x'),
    y: finite(value && value.y, name + '.y'),
    z: finite(value && value.z, name + '.z')
  });
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpAngle = (a, b, t) => {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };
  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stableValue(value[key]);
    return out;
  }
  function stableStringify(value) { return JSON.stringify(stableValue(value)); }
  function hashDeterministic(value) {
    const input = stableStringify(value);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }
  function actorId(player, fallback) {
    if (!player) return fallback == null ? null : fallback;
    if (player.idx != null) return player.idx;
    if (player.id != null) return player.id;
    if (player.ref && player.ref.id != null) return player.ref.id;
    return fallback == null ? null : fallback;
  }

  function createContactEvent(input) {
    const event = {
      schema: SCHEMA,
      kind: 'ContactEvent',
      id: text(input && input.id, 'id'),
      timelineId: text(input && input.timelineId, 'timelineId'),
      time: finite(input && input.time, 'time'),
      actorId: input && input.actorId != null ? input.actorId : null,
      otherActorId: input && input.otherActorId != null ? input.otherActorId : null,
      contactType: text(input && input.contactType, 'contactType'),
      surface: text(input && input.surface, 'surface'),
      point: vec3(input && input.point, 'point'),
      incomingVelocity: vec3(input && input.incomingVelocity, 'incomingVelocity'),
      outgoingVelocity: vec3(input && input.outgoingVelocity, 'outgoingVelocity'),
      segmentId: input && input.segmentId != null ? String(input.segmentId) : null,
      metadata: deepFreeze(clone(input && input.metadata || {}))
    };
    return deepFreeze(event);
  }

  function createPhysicalEvent(input) {
    const contacts = (input && input.contacts || []).map(createContactEvent);
    const event = {
      schema: SCHEMA,
      kind: 'PhysicalEvent',
      id: text(input && input.id, 'id'),
      timelineId: text(input && input.timelineId, 'timelineId'),
      eventType: text(input && input.eventType, 'eventType'),
      time: finite(input && input.time, 'time'),
      actorId: input && input.actorId != null ? input.actorId : null,
      ball: deepFreeze({
        position: vec3(input && input.ball && input.ball.position, 'ball.position'),
        velocity: vec3(input && input.ball && input.ball.velocity, 'ball.velocity')
      }),
      contacts: deepFreeze(contacts),
      requiresContact: !!(input && input.requiresContact),
      result: deepFreeze(clone(input && input.result || {})),
      presentation: deepFreeze(clone(input && input.presentation || {}))
    };
    if (event.requiresContact && !event.contacts.length) {
      throw new Error('PhysicalEvent requires at least one ContactEvent');
    }
    return deepFreeze(event);
  }

  function normalizePlayer(player, index) {
    return deepFreeze({
      id: player.id != null ? player.id : index,
      team: finite(player.team, 'player.team'),
      position: vec3(player.position, 'player.position'),
      velocity: vec3(player.velocity || { x: 0, y: 0, z: 0 }, 'player.velocity'),
      facing: finite(player.facing == null ? 0 : player.facing, 'player.facing'),
      pose: text(player.pose || 'idle', 'player.pose'),
      actionPhase: text(player.actionPhase || 'none', 'player.actionPhase'),
      isGK: !!player.isGK,
      visible: player.visible !== false
    });
  }

  function createVisualState(input) {
    const players = (input && input.players || []).map(normalizePlayer);
    const state = {
      schema: SCHEMA,
      kind: 'VisualState',
      timelineId: text(input && input.timelineId, 'timelineId'),
      time: finite(input && input.time, 'time'),
      interpolationAlpha: clamp(finite(input && input.interpolationAlpha, 'interpolationAlpha'), 0, 1),
      ball: deepFreeze({
        position: vec3(input && input.ball && input.ball.position, 'ball.position'),
        velocity: vec3(input && input.ball && input.ball.velocity, 'ball.velocity'),
        spin: vec3(input && input.ball && input.ball.spin || { x: 0, y: 0, z: 0 }, 'ball.spin'),
        ownerId: input && input.ball && input.ball.ownerId != null ? input.ball.ownerId : null,
        traveling: !!(input && input.ball && input.ball.traveling)
      }),
      players: deepFreeze(players),
      eventIds: deepFreeze((input && input.eventIds || []).map(String))
    };
    state.hash = hashDeterministic(state);
    return deepFreeze(state);
  }

  function inferFacing(player, team) {
    if (Number.isFinite(player && player.facing)) return player.facing;
    const vx = Number(player && player.vx) || 0;
    const vy = Number(player && player.vy) || 0;
    if (Math.hypot(vx, vy) > 0.02) return Math.atan2(vy, vx);
    const goal = team && team.oppGoal;
    return goal ? Math.atan2(goal.y - Number(player.y || 0), goal.x - Number(player.x || 0)) : 0;
  }

  function createVisualStateFromSim(sim, options) {
    if (!sim || !sim.ball) throw new TypeError('MatchSim-like instance required');
    const opts = options || {};
    const players = [];
    const teams = Array.isArray(sim.teams) ? sim.teams : [];
    teams.forEach((team, teamIndex) => {
      (team && Array.isArray(team.players) ? team.players : []).forEach((player, playerIndex) => {
        if (!player || player.red) return;
        const speed = Math.hypot(Number(player.vx) || 0, Number(player.vy) || 0);
        players.push({
          id: actorId(player, teamIndex + ':' + playerIndex),
          team: Number.isFinite(player.team) ? player.team : teamIndex,
          position: { x: Number(player.x) || 0, y: Number(player.y) || 0, z: Number(player.z) || 0 },
          velocity: { x: Number(player.vx) || 0, y: Number(player.vy) || 0, z: Number(player.vz) || 0 },
          facing: inferFacing(player, team),
          pose: player._divingUntil > sim.t ? 'dive' : player._blockingUntil > sim.t ? 'block' : speed > 5 ? 'sprint' : speed > .2 ? 'run' : 'idle',
          actionPhase: player.settle > 0 ? 'control' : 'none',
          isGK: !!player.isGK,
          visible: true
        });
      });
    });
    const ball = sim.ball;
    return createVisualState({
      timelineId: String(opts.timelineId || (sim._physicsActive && sim._physicsActive.id) || 'live'),
      time: Number.isFinite(opts.time) ? opts.time : Number(sim.t) || 0,
      interpolationAlpha: Number.isFinite(opts.interpolationAlpha) ? opts.interpolationAlpha : 0,
      ball: {
        position: { x: Number(ball.x) || 0, y: Number(ball.y) || 0, z: Math.max(0, Number(ball.z) || 0) },
        velocity: { x: Number(ball.vx) || 0, y: Number(ball.vy) || 0, z: Number(ball.vz) || 0 },
        spin: ball.spin || { x: 0, y: 0, z: Number(ball.rot) || 0 },
        ownerId: actorId(ball.owner),
        traveling: !!ball.traveling
      },
      players,
      eventIds: opts.eventIds || []
    });
  }

  function interpolateVisualState(previous, next, alpha) {
    if (!previous || !next) throw new TypeError('previous and next VisualState required');
    const t = clamp(finite(alpha, 'alpha'), 0, 1);
    const prevById = new Map(previous.players.map(p => [String(p.id), p]));
    const players = next.players.map((p, index) => {
      const a = prevById.get(String(p.id)) || p;
      return {
        id: p.id,
        team: p.team,
        position: {
          x: lerp(a.position.x, p.position.x, t),
          y: lerp(a.position.y, p.position.y, t),
          z: lerp(a.position.z, p.position.z, t)
        },
        velocity: {
          x: lerp(a.velocity.x, p.velocity.x, t),
          y: lerp(a.velocity.y, p.velocity.y, t),
          z: lerp(a.velocity.z, p.velocity.z, t)
        },
        facing: lerpAngle(a.facing, p.facing, t),
        pose: t < .5 ? a.pose : p.pose,
        actionPhase: t < .5 ? a.actionPhase : p.actionPhase,
        isGK: p.isGK,
        visible: p.visible
      };
    });
    return createVisualState({
      timelineId: next.timelineId,
      time: lerp(previous.time, next.time, t),
      interpolationAlpha: t,
      ball: {
        position: {
          x: lerp(previous.ball.position.x, next.ball.position.x, t),
          y: lerp(previous.ball.position.y, next.ball.position.y, t),
          z: lerp(previous.ball.position.z, next.ball.position.z, t)
        },
        velocity: {
          x: lerp(previous.ball.velocity.x, next.ball.velocity.x, t),
          y: lerp(previous.ball.velocity.y, next.ball.velocity.y, t),
          z: lerp(previous.ball.velocity.z, next.ball.velocity.z, t)
        },
        spin: {
          x: lerp(previous.ball.spin.x, next.ball.spin.x, t),
          y: lerp(previous.ball.spin.y, next.ball.spin.y, t),
          z: lerp(previous.ball.spin.z, next.ball.spin.z, t)
        },
        ownerId: t < .5 ? previous.ball.ownerId : next.ball.ownerId,
        traveling: t < .5 ? previous.ball.traveling : next.ball.traveling
      },
      players,
      eventIds: next.eventIds
    });
  }

  function createCameraState(input) {
    const zoom = finite(input && input.zoom, 'zoom');
    if (zoom <= 0) throw new RangeError('zoom must be positive');
    return deepFreeze({
      schema: SCHEMA,
      kind: 'CameraState',
      time: finite(input && input.time, 'time'),
      center: deepFreeze({
        x: finite(input && input.center && input.center.x, 'center.x'),
        y: finite(input && input.center && input.center.y, 'center.y')
      }),
      zoom,
      rotation: finite(input && input.rotation || 0, 'rotation'),
      lookAhead: deepFreeze({
        x: finite(input && input.lookAhead && input.lookAhead.x || 0, 'lookAhead.x'),
        y: finite(input && input.lookAhead && input.lookAhead.y || 0, 'lookAhead.y')
      }),
      mode: text(input && input.mode || 'match', 'mode'),
      safeBounds: deepFreeze(clone(input && input.safeBounds || { left: 0, top: 0, right: 1, bottom: 1 }))
    });
  }

  function createProjection(config) {
    const cfg = deepFreeze({
      originX: finite(config && config.originX || 0, 'originX'),
      originY: finite(config && config.originY || 0, 'originY'),
      scaleX: finite(config && config.scaleX, 'scaleX'),
      scaleY: finite(config && config.scaleY, 'scaleY'),
      shearX: finite(config && config.shearX || 0, 'shearX'),
      shearY: finite(config && config.shearY || 0, 'shearY'),
      heightScale: finite(config && config.heightScale, 'heightScale')
    });
    const determinant = cfg.scaleX * cfg.scaleY - cfg.shearX * cfg.shearY;
    if (Math.abs(determinant) < EPS) throw new Error('Projection matrix is singular');

    function worldToScreen(point) {
      const x = finite(point && point.x, 'point.x');
      const y = finite(point && point.y, 'point.y');
      const z = finite(point && point.z || 0, 'point.z');
      return deepFreeze({
        x: cfg.originX + cfg.scaleX * x + cfg.shearX * y,
        y: cfg.originY + cfg.shearY * x + cfg.scaleY * y - cfg.heightScale * z,
        depth: y + z * 0.001
      });
    }

    function screenToWorld(screen, z) {
      const height = finite(z || 0, 'z');
      const sx = finite(screen && screen.x, 'screen.x') - cfg.originX;
      const sy = finite(screen && screen.y, 'screen.y') - cfg.originY + cfg.heightScale * height;
      return deepFreeze({
        x: (sx * cfg.scaleY - cfg.shearX * sy) / determinant,
        y: (cfg.scaleX * sy - sx * cfg.shearY) / determinant,
        z: height
      });
    }

    return deepFreeze({ config: cfg, determinant, worldToScreen, screenToWorld });
  }

  function validateTimeline(timeline) {
    const errors = [];
    const warnings = [];
    if (!timeline || typeof timeline !== 'object') return deepFreeze({ ok: false, errors: ['timeline missing'], warnings: [] });
    const contacts = Array.isArray(timeline.contacts) ? timeline.contacts : [];
    const events = Array.isArray(timeline.events) ? timeline.events : [];
    const frames = Array.isArray(timeline.visualFrames) ? timeline.visualFrames : [];
    const contactIds = new Set();
    contacts.forEach((contact, i) => {
      const point = contact && (contact.point || contact);
      if (![point && point.x, point && point.y, point && point.z].every(Number.isFinite)) errors.push('contact[' + i + '] point invalid');
      if (!contact || !contact.surface) warnings.push('contact[' + i + '] surface missing');
      const id = contact && (contact.id != null ? String(contact.id) : String(i));
      if (contactIds.has(id)) errors.push('contact[' + i + '] duplicate id');
      contactIds.add(id);
    });
    let lastTime = -Infinity;
    events.forEach((event, i) => {
      if (!Number.isFinite(event && event.time)) errors.push('event[' + i + '].time invalid');
      if (event && Number.isFinite(event.time) && event.time < lastTime - EPS) errors.push('event[' + i + '] out of order');
      if (event && Number.isFinite(event.time)) lastTime = Math.max(lastTime, event.time);
      const requires = !!(event && event.requiresContact) || !!(event && event.__physics && event.__physics.requiresContact);
      const has = !!(event && event.contact) || (Number.isInteger(event && event.contactIndex) && contacts[event.contactIndex]);
      if (requires && !has) errors.push('event[' + i + '] requires contact');
    });
    let lastFrameTime = -Infinity;
    frames.forEach((frame, i) => {
      const t = frame && (Number.isFinite(frame.time) ? frame.time : frame.t);
      if (!Number.isFinite(t)) errors.push('visualFrames[' + i + '] time invalid');
      else if (t < lastFrameTime - EPS) errors.push('visualFrames[' + i + '] out of order');
      if (Number.isFinite(t)) lastFrameTime = Math.max(lastFrameTime, t);
      const ball = frame && frame.ball;
      if (ball && ![ball.x, ball.y, ball.z || 0].every(Number.isFinite)) errors.push('visualFrames[' + i + '] ball invalid');
    });
    if (timeline.startTime != null && timeline.endTime != null && timeline.endTime < timeline.startTime) errors.push('endTime before startTime');
    if (!frames.length) warnings.push('timeline has no visualFrames');
    return deepFreeze({ ok: errors.length === 0, errors, warnings, hash: hashDeterministic(timeline) });
  }

  function snapshotLogicalState(sim) {
    if (!sim || !sim.ball) throw new TypeError('MatchSim-like instance required');
    const teams = (sim.teams || []).map(team => (team.players || []).map(player => ({
      id: actorId(player), team: player.team, x: Number(player.x) || 0, y: Number(player.y) || 0,
      stamina: Number(player.stamina) || 0, red: !!player.red, yellow: Number(player.yellow) || 0
    })));
    return deepFreeze({
      time: Number(sim.t) || 0,
      minute: Number(sim.minute) || 0,
      score: clone(sim.score || sim.sc || null),
      poss: sim.poss == null ? null : sim.poss,
      ball: {
        x: Number(sim.ball.x) || 0, y: Number(sim.ball.y) || 0, z: Number(sim.ball.z) || 0,
        vx: Number(sim.ball.vx) || 0, vy: Number(sim.ball.vy) || 0, vz: Number(sim.ball.vz) || 0,
        ownerId: actorId(sim.ball.owner), traveling: !!sim.ball.traveling
      },
      teams
    });
  }

  root.CDS_25D_CONTRACTS = deepFreeze({
    version: VERSION,
    schema: SCHEMA,
    createContactEvent,
    createPhysicalEvent,
    createVisualState,
    createVisualStateFromSim,
    interpolateVisualState,
    createCameraState,
    createProjection,
    validateTimeline,
    snapshotLogicalState,
    hashDeterministic,
    stableStringify
  });
})(typeof window !== 'undefined' ? window : globalThis);

