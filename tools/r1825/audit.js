/* Auditoria do replay de gol — mede a MESMA coisa na base e na corrigida.
   Por gol: houve replay? animou quanto da janela? quantos quadros distintos?
   deu volta? estourou exceção de desenho? */
(function () {
  const A = window.__AUDIT = { goals: [], warns: 0, warnMsgs: [], cur: null, done: 0 };

  const ow = window.__cdsDebugWarn;
  window.__cdsDebugWarn = function () {
    A.warns++;
    try { if (A.warnMsgs.length < 6) A.warnMsgs.push(String(arguments[1]).slice(0, 90)); } catch (_) {}
    return ow && ow.apply(this, arguments);
  };

  const D = () => window.__DBG_UI;
  let lastId = null;

  A.ticks = 0; A.celebSeen = 0; A.sampleErr = null;
  const num = (v, d0) => (typeof v === 'number' && isFinite(v)) ? v : d0;

  A.sampler = setInterval(() => {
    try {
      A.ticks++;
      const d = D(); if (!d) return;
      const c = d.celebration, rp = d.replay;
      if (!c) A.lastStart = null;
      // uma comemoração dura MAIS que a janela de replay (confete depois); só
      // abre um novo registro quando é outra comemoração, não a mesma.
      if (c && !A.cur && c.start !== A.lastStart) {
        A.lastStart = c.start;
        A.celebSeen++;
        A.cur = { start: num(c.start, d.now), replayUntil: num(c.replayUntil, d.now), pend: c.pendingTimelineId,
                  src: c.source, samples: [], t0: d.now };
      }
      if (A.cur) {
        if (rp) A.cur.samples.push({ t: Math.round(d.now - A.cur.start), idx: num(rp.idx, -1),
                                     src: rp.source || 'legacy_buffer', fr: num(rp.frames, 0), dur: num(rp.duration, 0) });
        else A.cur.samples.push({ t: Math.round(d.now - A.cur.start), idx: null });
        // a janela pode ser esticada pela ponte quando a timeline finaliza
        if (c) A.cur.replayUntil = num(c.replayUntil, A.cur.replayUntil);
        if (!c || d.now > A.cur.replayUntil + 120) { close(); }
      }
    } catch (e) { A.sampleErr = String(e && e.stack || e).slice(0, 200); }
  }, 16);

  function close() {
    const c = A.cur; A.cur = null;
    if (!c) return;
    try { closeInner(c); } catch (e) { A.sampleErr = 'close: ' + String(e && e.stack || e).slice(0, 200); }
  }
  function closeInner(c) {
    const withR = c.samples.filter(s => s.idx != null);
    const distinct = new Set(withR.map(s => s.idx));
    let loops = 0, prev = null, animatedMs = 0, lastChange = null;
    for (const s of withR) {
      if (prev != null && s.idx < prev) loops++;
      if (prev != null && s.idx !== prev) { if (lastChange != null) animatedMs += s.t - lastChange; lastChange = s.t; }
      if (lastChange == null) lastChange = s.t;
      prev = s.idx;
    }
    const windowMs = Math.max(1, Math.round(c.replayUntil - c.start));
    const span = withR.length ? withR[withR.length - 1].t - withR[0].t : 0;
    A.goals.push({
      src: c.src, hadReplay: withR.length > 0, replaySrc: withR.length ? withR[0].src : null,
      clipFrames: withR.length ? withR[withR.length - 1].fr : 0,
      clipDur: withR.length ? +Number(withR[withR.length - 1].dur || 0).toFixed(3) : 0,
      windowMs, sampledMs: span, distinctFrames: distinct.size, loops,
      animatedPct: span ? Math.round(animatedMs / span * 100) : 0
    });
    A.done++;
  }

  A.report = function () {
    const g = A.goals;
    const withR = g.filter(x => x.hadReplay);
    const avg = (f) => withR.length ? +(withR.reduce((s, x) => s + f(x), 0) / withR.length).toFixed(1) : 0;
    return {
      gols: g.length, comReplay: withR.length,
      cobertura: g.length ? Math.round(withR.length / g.length * 100) + '%' : '—',
      fonte: withR.length ? withR[0].replaySrc : null,
      quadrosDistintosMedio: avg(x => x.distinctFrames),
      quadrosDoClipeMedio: avg(x => x.clipFrames),
      duracaoClipeMedia: avg(x => x.clipDur),
      voltasMedio: avg(x => x.loops),
      pctAnimadoMedio: avg(x => x.animatedPct),
      janelaMsMedia: avg(x => x.windowMs),
      excecoesDeDesenho: A.warns, exemplos: A.warnMsgs,
      ticks: A.ticks, celebSeen: A.celebSeen, sampleErr: A.sampleErr,
      detalhe: g
    };
  };
  window.__AUDIT_READY = true;
})();
