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
