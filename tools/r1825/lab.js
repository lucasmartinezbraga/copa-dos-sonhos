/* Laboratório do replay de gol — roda DENTRO da página (mesma origem).
   Não altera o jogo: só instrumenta, dirige partidas e captura quadros. */
(function () {
  const L = window.__LAB = window.__LAB || {};
  L.goals = []; L.errs = []; L.replaySeen = []; L.shots = []; L.matches = 0; L.notes = [];

  // contexto que o atalho de dev __quickMatch não monta (cup + byId)
  function fixContext() {
    if (!window.G.cup) window.G.cup = { scorers: {} };
    if (!window.G.cup.scorers) window.G.cup.scorers = {};
    window.G.db.byId['QA'] = window.G.db.squads[3];
    window.G.db.byId['QB'] = window.G.db.squads[60];
  }

  const PAIRS = [[6, 20], [16, 25], [38, 21], [6, 17], [2, 15], [30, 12], [42, 44], [6, 25], [21, 17], [16, 6]];

  function startOne() {
    fixContext();
    const p = PAIRS[L.matches % PAIRS.length];
    L.matches++;
    window.G.speed = L.speed || 24;
    window.__quickMatch(p[0], p[1]);
    const s = window.GAME._sim(), orig = s.onEvent;
    s.onEvent = function (e) {
      const isGoal = e && e.type === 'goal';
      try {
        const r = orig.apply(this, arguments);
        if (isGoal) L.goals.push({ m: L.matches, min: e.minute, physId: (e.__physics && e.__physics.eventId) || null, at: Date.now() });
        return r;
      } catch (err) {
        L.errs.push({ type: e && e.type, msg: String((err && err.message) || err), stack: String((err && err.stack) || '').split('\n').slice(1, 3).join(' | ') });
        throw err;
      }
    };
    if (typeof L.onMatch === 'function') try { L.onMatch(s); } catch (_) {}
  }

  L.start = function (opts) {
    L.stop();
    opts = opts || {};
    L.speed = opts.speed || 24;
    L.base = Object.assign({}, window.CDS_TIMELINE_PRESENTATION.status().metrics);
    L.goals = []; L.errs = []; L.replaySeen = []; L.shots = []; L.matches = 0;
    startOne();
    L.matchTimer = setInterval(() => { const s = window.GAME._sim(); if (!s || s.isOver()) startOne(); }, 700);
    return 'lab on';
  };

  L.stop = function () {
    clearInterval(L.matchTimer); clearInterval(L.poll); clearInterval(L.grabber);
    L.matchTimer = L.poll = L.grabber = 0;
    return 'lab off';
  };

  /* Captura quadros do canvas durante a janela de replay e os envia ao disco. */
  L.capture = function (tag, maxFrames, everyMs) {
    maxFrames = maxFrames || 14; everyMs = everyMs || 90;
    let last = 0, n = 0, curId = null, seq = 0;
    L.captureDone = false;
    clearInterval(L.grabber);
    L.grabber = setInterval(() => {
      const st = window.CDS_TIMELINE_PRESENTATION.status(), now = Date.now();
      if (!st.replay) return;
      if (st.replay.timelineId !== curId) { curId = st.replay.timelineId; seq++; }
      if (seq > 1) { clearInterval(L.grabber); L.captureDone = true; return; }
      if (now - last < everyMs || n >= maxFrames) return;
      last = now; n++;
      const name = tag + '_' + String(n).padStart(2, '0');
      const cv = document.getElementById('fieldcv');
      const data = cv ? cv.toDataURL('image/jpeg', 0.75) : null;
      const D = window.__DBG_UI, c = D && D.celebration, rp = D && D.replay;
      L.shots.push({
        name, id: st.replay.timelineId, frames: st.replay.frames, dur: +st.replay.duration.toFixed(3),
        idx: rp ? rp.idx : null, el: rp ? +rp.elapsed.toFixed(3) : null,
        sinceStart: c ? Math.round(D.now - c.start) : null,
        rframe: D ? D.rframeActive : null, hasSim: D ? D.hasSim : null,
        fin: D ? D.finished : null, scene: D ? D.scene : null,
        npF: D && D.replayFrame ? D.replayFrame.np : null, cv: !!cv
      });
      if (!data) return;
      fetch('/save?name=' + name, { method: 'POST', body: data }).catch(() => {});
      if (n >= maxFrames) { clearInterval(L.grabber); L.captureDone = true; }
    }, 16);
    return 'capturando ' + tag;
  };

  /* Captura N quadros de jogo AO VIVO (sem replay), para comparação. */
  L.captureLive = function (tag, maxFrames, everyMs) {
    maxFrames = maxFrames || 6; everyMs = everyMs || 150;
    const cv = document.getElementById('fieldcv');
    let last = 0, n = 0;
    const t = setInterval(() => {
      const st = window.CDS_TIMELINE_PRESENTATION.status(), now = Date.now();
      if (st.replay) return;
      if (now - last < everyMs) return;
      last = now; n++;
      fetch('/save?name=' + tag + '_' + String(n).padStart(2, '0'), { method: 'POST', body: cv.toDataURL('image/jpeg', 0.75) }).catch(() => {});
      if (n >= maxFrames) clearInterval(t);
    }, 16);
    return 'capturando vivo ' + tag;
  };

  L.report = function () {
    const st = window.CDS_TIMELINE_PRESENTATION.status(), b = L.base || st.metrics;
    return {
      matches: L.matches, goals: L.goals.length, errs: L.errs.slice(0, 5),
      shots: L.shots, captureDone: !!L.captureDone,
      delta: { replays: st.metrics.replays - b.replays, legacy: st.metrics.legacyGoalReplays - b.legacyGoalReplays, faults: st.metrics.faults - b.faults },
      replayNow: st.replay
    };
  };

  window.__LAB_READY = true;
})();
