/*
 * Copa dos Sonhos · R14 · MÁQUINA DE ESTADOS DE ANIMAÇÃO (Fase 3)
 *
 * O que existia: motionAt() empurrava poses numa lista GLOBAL de no máximo 10
 * entradas, com janela em performance.now() e uma única rampa 0..1. Sem estados
 * de locomoção, sem prioridade, sem interrupção e sem vínculo com as fases da
 * ação — a pose de chute podia ser truncada por outro jogador entrar na lista.
 *
 * Aqui cada atleta tem seu próprio controlador. Os estados de AÇÃO são dirigidos
 * pelo contrato da Fase 2 (start/contact/end), então o quadro de contato coincide
 * com a saída da bola por construção, não por coincidência de tempo. Os estados
 * de LOCOMOÇÃO derivam da velocidade e são o piso: sempre há um estado válido.
 *
 * Prioridade cresce com o tier. Um estado só é interrompido por tier igual ou
 * maior, ou por interrupção explícita do motor (desarme durante o preparo).
 * Isso é o que impede a troca de pose no meio de um movimento comprometido.
 *
 * Procedural em Canvas: não há sprite. O controlador diz QUAL estado e em QUE
 * fase; o desenho fica com CDS_F25D.body.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CDS_ANIM = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  const VERSION = '1.0.0-R14';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finite = (v, d = 0) => (Number.isFinite(v) ? v : d);

  /* ── TIERS ────────────────────────────────────────────────────────────────
     0 locomoção · 1 com bola · 2 defesa · 3 ação comprometida · 4 goleiro    */
  const T_LOCO = 0, T_BALL = 1, T_DEF = 2, T_ACTION = 3, T_GK = 4;

  /* Cada estado: tier, duração padrão (s) e se é cíclico (locomoção não termina).
     As durações de AÇÃO são substituídas pelo contrato quando ele existe. */
  const STATES = {
    // locomoção
    idle:        { tier: T_LOCO, loop: true },
    walk:        { tier: T_LOCO, loop: true },
    jog:         { tier: T_LOCO, loop: true },
    run:         { tier: T_LOCO, loop: true },
    sprint:      { tier: T_LOCO, loop: true },
    accelerate:  { tier: T_LOCO, dur: 0.30 },
    decelerate:  { tier: T_LOCO, dur: 0.30 },
    turn:        { tier: T_LOCO, dur: 0.26 },
    strafe:      { tier: T_LOCO, loop: true },
    backpedal:   { tier: T_LOCO, loop: true },
    // com bola
    receive_prepare: { tier: T_BALL, dur: 0.16 },
    receive_contact: { tier: T_BALL, dur: 0.10 },
    receive_control: { tier: T_BALL, dur: 0.22 },
    carry:           { tier: T_BALL, loop: true },
    protect:         { tier: T_BALL, loop: true },
    heavy_touch:     { tier: T_BALL, dur: 0.30 },
    lose_control:    { tier: T_BALL, dur: 0.34 },
    // passe
    pass_prepare:     { tier: T_ACTION, dur: 0.15 },
    pass_contact:     { tier: T_ACTION, dur: 0.07 },
    pass_followthrough: { tier: T_ACTION, dur: 0.10 },
    pass_recover:     { tier: T_ACTION, dur: 0.12 },
    first_touch_pass: { tier: T_ACTION, dur: 0.18 },
    long_pass:        { tier: T_ACTION, dur: 0.26 },
    cross:            { tier: T_ACTION, dur: 0.26 },
    // chute
    shot_prepare:       { tier: T_ACTION, dur: 0.22 },
    shot_contact:       { tier: T_ACTION, dur: 0.08 },
    shot_followthrough: { tier: T_ACTION, dur: 0.20 },
    shot_recover:       { tier: T_ACTION, dur: 0.22 },
    placed_shot:        { tier: T_ACTION, dur: 0.26 },
    power_shot:         { tier: T_ACTION, dur: 0.30 },
    volley:             { tier: T_ACTION, dur: 0.24 },
    header:             { tier: T_ACTION, dur: 0.30 },
    // drible
    dribble_prepare: { tier: T_BALL, dur: 0.14 },
    body_feint:      { tier: T_BALL, dur: 0.24 },
    inside_cut:      { tier: T_BALL, dur: 0.22 },
    outside_cut:     { tier: T_BALL, dur: 0.22 },
    turn_dribble:    { tier: T_BALL, dur: 0.26 },
    burst_touch:     { tier: T_BALL, dur: 0.20 },
    protect_turn:    { tier: T_BALL, dur: 0.26 },
    dribble_success: { tier: T_BALL, dur: 0.22 },
    dribble_failure: { tier: T_BALL, dur: 0.26 },
    // defesa
    press:           { tier: T_DEF, loop: true },
    jockey:          { tier: T_DEF, loop: true },
    intercept:       { tier: T_DEF, dur: 0.24 },
    standing_tackle: { tier: T_DEF, dur: 0.30 },
    slide_tackle:    { tier: T_DEF, dur: 0.52 },
    block:           { tier: T_DEF, dur: 0.26 },
    body_duel:       { tier: T_DEF, dur: 0.30 },
    recover:         { tier: T_DEF, dur: 0.30 },
    // goleiro
    gk_ready:         { tier: T_GK, loop: true },
    gk_shift:         { tier: T_GK, loop: true },
    gk_set:           { tier: T_GK, dur: 0.20 },
    gk_low_dive:      { tier: T_GK, dur: 0.70 },
    gk_high_dive:     { tier: T_GK, dur: 0.90 },
    gk_catch:         { tier: T_GK, dur: 0.60 },
    gk_parry:         { tier: T_GK, dur: 0.50 },
    gk_punch:         { tier: T_GK, dur: 0.50 },
    gk_foot_save:     { tier: T_GK, dur: 0.44 },
    gk_smother:       { tier: T_GK, dur: 0.66 },
    gk_ground_recover:{ tier: T_GK, dur: 0.60 },
    gk_throw:         { tier: T_GK, dur: 0.50 },
    gk_kick:          { tier: T_GK, dur: 0.56 }
  };

  /* Sequências de ação: o contrato dá start/contact/end e as fases são
     derivadas dele, para que o CONTATO caia exatamente na saída da bola. */
  const SEQ = {
    pass:  ['pass_prepare', 'pass_contact', 'pass_followthrough', 'pass_recover'],
    cross: ['pass_prepare', 'pass_contact', 'cross', 'pass_recover'],
    shot:  ['shot_prepare', 'shot_contact', 'shot_followthrough', 'shot_recover']
  };

  /* limiares de locomoção em m/s */
  const LOCO = [[0.25, 'idle'], [1.6, 'walk'], [3.6, 'jog'], [5.8, 'run'], [Infinity, 'sprint']];

  function locoFor(speed, prev) {
    let s = 'idle';
    for (const [lim, name] of LOCO) { if (speed < lim) { s = name; break; } }
    return s;
  }

  function Controller(id) {
    this.id = id;
    this.state = 'idle';
    this.tier = T_LOCO;
    this.t = 0;          // tempo dentro do estado
    this.dur = 0;        // 0 = cíclico
    this.seq = null;     // sequência de ação em curso
    this.seqIdx = 0;
    this.contract = null;
    this.interrupted = false;
    this.history = [];
  }

  Controller.prototype._enter = function (state, dur, now) {
    const def = STATES[state];
    if (!def) return false;
    this.state = state;
    this.tier = def.tier;
    this.t = 0;
    this.dur = def.loop ? 0 : finite(dur, def.dur || 0.25);
    this.history.push({ state: state, at: finite(now) });
    if (this.history.length > 32) this.history.shift();
    return true;
  };

  /* Uma transição só passa se o tier for >= ao atual, ou se o estado atual já
     terminou. É a regra que impede trocar de pose no meio de um comprometimento. */
  Controller.prototype.request = function (state, now, opts) {
    const def = STATES[state];
    if (!def) return false;
    const force = !!(opts && opts.force);
    const finished = this.dur > 0 && this.t >= this.dur;
    const cyclic = this.dur === 0;
    if (!force && def.tier < this.tier && !finished && !cyclic) return false;
    if (!force && def.tier === this.tier && this.seq && !finished) return false;
    if (this.seq && (force || def.tier > this.tier)) { this.seq = null; this.contract = null; }
    return this._enter(state, opts && opts.dur, now);
  };

  /* Dirige a sequência de ação a partir do contrato da Fase 2. As durações vêm
     do motor: prepare = contact-start, e o resto do próprio contrato. */
  Controller.prototype.beginAction = function (contract, now) {
    const seq = SEQ[contract && contract.action];
    if (!seq) return false;
    this.seq = seq.slice();
    this.seqIdx = 0;
    this.contract = contract;
    this.interrupted = false;
    const prep = Math.max(0.02, finite(contract.prepareDuration, 0.15));
    this._enter(seq[0], prep, now);
    this.tier = T_ACTION;
    return true;
  };

  Controller.prototype.interrupt = function (now, reason) {
    if (!this.seq) return false;
    this.seq = null;
    this.contract = null;
    this.interrupted = true;
    this._enter(reason === 'tackled' ? 'lose_control' : 'decelerate', null, now);
    return true;
  };

  /* speed em m/s; gk marca o atleta como goleiro (piso vira gk_ready). */
  Controller.prototype.update = function (dt, now, ctx) {
    ctx = ctx || {};
    this.t += finite(dt);
    if (this.dur > 0 && this.t >= this.dur) {
      if (this.seq) {
        this.seqIdx++;
        if (this.seqIdx < this.seq.length) {
          const next = this.seq[this.seqIdx];
          const c = this.contract || {};
          const d = next.indexOf('_contact') > 0 ? 0.07
                  : next.indexOf('followthrough') > 0 || next === 'cross' ? finite(c.followThroughDuration, 0.12)
                  : finite(c.recoveryDuration, 0.14);
          this._enter(next, d, now);
          return this.snapshot();
        }
        this.seq = null;
        this.contract = null;
      }
      // caiu para o piso: locomoção (ou prontidão do goleiro)
      const base = ctx.isGK ? 'gk_ready' : locoFor(finite(ctx.speed), this.state);
      this.tier = ctx.isGK ? T_GK : T_LOCO;
      this._enter(base, null, now);
    } else if (this.dur === 0) {
      // estado cíclico acompanha a velocidade sem reiniciar a fase à toa
      const base = ctx.isGK ? 'gk_ready'
                 : ctx.hasBall ? (finite(ctx.speed) > 0.3 ? 'carry' : 'protect')
                 : locoFor(finite(ctx.speed), this.state);
      if (base !== this.state && this.tier <= T_BALL) {
        this._enter(base, null, now);
      }
    }
    return this.snapshot();
  };

  Controller.prototype.snapshot = function () {
    const def = STATES[this.state] || {};
    const phase = this.dur > 0 ? clamp(this.t / this.dur, 0, 1) : 0;
    const seg = this.seq ? this.seq[this.seqIdx] : null;
    return {
      state: this.state,
      tier: this.tier,
      phase: +phase.toFixed(4),
      loop: !!def.loop,
      inAction: !!this.seq,
      segment: seg,
      interrupted: this.interrupted,
      actionId: this.contract ? this.contract.actionId : null
    };
  };

  function Machine() { this.byId = Object.create(null); }
  Machine.prototype.of = function (id) {
    return this.byId[id] || (this.byId[id] = new Controller(id));
  };
  Machine.prototype.update = function (dt, now, ctxById) {
    const out = Object.create(null);
    for (const id in this.byId) {
      out[id] = this.byId[id].update(dt, now, (ctxById && ctxById[id]) || {});
    }
    return out;
  };

  return {
    version: VERSION,
    STATES: STATES,
    SEQ: SEQ,
    TIERS: { LOCO: T_LOCO, BALL: T_BALL, DEF: T_DEF, ACTION: T_ACTION, GK: T_GK },
    locoFor: locoFor,
    Controller: Controller,
    Machine: Machine,
    create: function () { return new Machine(); },
    stateCount: Object.keys(STATES).length
  };
});
