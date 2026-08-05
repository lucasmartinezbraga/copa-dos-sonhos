/* Driver de verificacao do OS-84: mede a trajetoria do fantasma na tela e
   captura os quadros do canvas no desfecho de um chute. */
(function () {
  const L = window.__LAB = window.__LAB || {};
  L.lances = []; L.matches = 0; L.tiros = [];

  function fixContext() {
    if (!window.G.cup) window.G.cup = { scorers: {} };
    if (!window.G.cup.scorers) window.G.cup.scorers = {};
    window.G.db.byId['QA'] = window.G.db.squads[3];
    window.G.db.byId['QB'] = window.G.db.squads[60];
  }

  const PARES = [[6, 20], [16, 25], [38, 21], [6, 17], [2, 15], [30, 12], [42, 44], [6, 25]];
  function startOne() {
    fixContext();
    const p = PARES[L.matches % PARES.length];
    L.matches++;
    window.G.speed = L.speed || 2;
    window.__quickMatch(p[0], p[1]);
  }
  L.start = function (opts) {
    L.stop(); opts = opts || {};
    L.speed = opts.speed || 2; L.lances = []; L.matches = 0; L.tiros = [];
    startOne();
    L.matchTimer = setInterval(() => { const s = window.GAME._sim(); if (!s || s.isOver()) startOne(); }, 700);
    L.watch();
    return 'lab87 on';
  };
  L.stop = function () { [L.matchTimer, L.grabber, L.watcher].forEach(clearInterval); L.matchTimer = L.grabber = L.watcher = 0; return 'off'; };

  /* Vigia: enquanto shotFx existe, guarda a posicao de TELA da bola quadro a
     quadro. E a medida direta do que o dono ve. */
  L.watch = function () {
    let atual = null;
    clearInterval(L.watcher);
    L.watcher = setInterval(() => {
      const D = window.__DBG_UI, f = D && D.shotFx;
      if (f && f !== 'TDZ') {
        if (!atual) {
          atual = { kind: f.k, t0: performance.now(), quadros: [], om: D.outMark, sm: D.slowmo, gx: f.atRight ? 105 : 0 };
          if (L.capturar) L.grabNow(f.k + '_' + (L.lances.length + 1), 12, 70);
        }
        const pr = window.__DBG_PROJ(f.x / 105, f.y / 68);
        atual.quadros.push({ ms: Math.round(performance.now() - atual.t0), x: f.x, y: f.y, z: f.z,
                             sx: +pr.sx.toFixed(1), sy: +pr.sy.toFixed(1), p: f.parked });
      } else if (atual) {
        atual.duracaoMs = Math.round(performance.now() - atual.t0);
        atual.omFinal = D && D.outMark;
        L.lances.push(atual); atual = null;
      }
    }, 16);
  };

  L.grabNow = function (tag, n, everyMs) {
    let i = 0, last = 0;
    clearInterval(L.grabber);
    L.grabber = setInterval(() => {
      const now = Date.now(); if (now - last < everyMs) return; last = now;
      const cv = document.getElementById('fieldcv'); if (!cv) return;
      i++;
      fetch('/save?name=' + tag + '_' + String(i).padStart(2, '0'), { method: 'POST', body: cv.toDataURL('image/png') }).catch(() => {});
      if (i >= n) { clearInterval(L.grabber); L.grabber = 0; L.capturar = false; }
    }, 16);
  };

  window.__LAB87_READY = true;
})();
