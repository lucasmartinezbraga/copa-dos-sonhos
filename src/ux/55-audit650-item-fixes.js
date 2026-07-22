/* Copa dos Sonhos · Auditoria 650 · correções itemizadas
 * Camada de apresentação somente-leitura. Não decide futebol nem consome RNG.
 * Fecha os controles PRO-021..035, ATL-016..030, VFX-021..030 e PRF-031..035
 * na fonte reconstruível, em vez de editar exclusivamente dist/. */
(function (root) {
  'use strict';
  const base = root.CDS_F25D;
  if (!base || base.__audit650Itemized) return;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dirCache = new Map();
  root.__CDS_ACTIONS = root.__CDS_ACTIONS || Object.create(null);

  /* PRO-021..030 — a bola nunca pode atravessar a banda superior do estádio.
   * O estado lógico x/y/z permanece intacto; somente a elevação em tela é limitada. */
  function elevatedY(p, z) {
    const height = Math.max(0, Number(z) || 0);
    const rawLift = height * 22 * p.s;
    const depth = clamp((p.y - 46) / Math.max(1, 497 - 46), 0, 1);
    const maxLift = 30 + depth * 104;
    return Math.max(36, p.y - Math.min(rawLift, maxLift));
  }

  function resetVisualCaches() {
    dirCache.clear();
    Object.keys(root.__CDS_ACTIONS).forEach(k => delete root.__CDS_ACTIONS[k]);
  }

  /* ATL-016..030 — passada e poses causalmente ligadas aos estados/eventos. */
  function body(ctx, o) {
    const x = o.x, y = o.y, r = Math.max(4, o.r || 7);
    const key = String(o.key || 'anon'), now = performance.now();
    const prev = dirCache.get(key) || { x, y, t: now, dx: 0, dy: 0, lastSeen: now };
    const dt = Math.max(8, now - prev.t), dx = x - prev.x, dy = y - prev.y;
    const pxSpeed = Math.hypot(dx, dy) / (dt / 16.6667);
    const smoothDx = prev.dx * .62 + dx * .38;
    const smoothDy = prev.dy * .62 + dy * .38;
    dirCache.set(key, { x, y, t: now, dx: smoothDx, dy: smoothDy, lastSeen: now });
    if (dirCache.size > 192 && ((now | 0) % 47 === 0)) {
      for (const [k, v] of dirCache) if (now - (v.lastSeen || 0) > 5000) dirCache.delete(k);
    }

    const eventPose = root.__CDS_ACTIONS[key] || null;
    if (eventPose && eventPose.until < now) delete root.__CDS_ACTIONS[key];
    let pose = (eventPose && eventPose.until >= now && eventPose.type) || o.motionType || '';
    if (o.divePose) pose = 'dive';
    if (!pose) pose = pxSpeed > .10 ? 'run' : 'idle';
    if (o.isGK && pose === 'jump') pose = 'claim';

    const facing = Math.abs(smoothDx) > .03 ? (smoothDx < 0 ? -1 : 1) : 1;
    const cycle = (now * .014 + key.length * .73) * (.55 + Math.min(1.5, pxSpeed) * .9);
    const stride = pose === 'run' ? Math.sin(cycle) * r * .42 : 0;
    const bob = pose === 'run' ? Math.abs(Math.cos(cycle)) * r * .10 : 0;
    const leanX = clamp(smoothDx * .16, -r * .20, r * .20);
    const leanY = clamp(smoothDy * .10, -r * .12, r * .12);
    const wave = clamp(Number(o.actionWave) || 0, 0, 1);

    ctx.save();
    ctx.translate(x, y - bob);
    if (pose === 'dive') ctx.rotate(facing * Math.PI * .34);
    else if (pose === 'tackle') ctx.rotate(facing * Math.PI * .16);

    // sombra acompanha profundidade e orientação do corpo
    ctx.save();
    ctx.translate(0, bob + leanY * .2);
    ctx.rotate(clamp(Math.atan2(smoothDy, smoothDx || .001) * .08, -.18, .18));
    ctx.scale(1, .34);
    ctx.fillStyle = 'rgba(0,0,0,.26)';
    ctx.beginPath(); ctx.ellipse(0, r * .70, r * .70, r * .34, 0, 0, TAU); ctx.fill();
    ctx.restore();

    const hipY = r * .05, shoulderY = -r * .52, headY = -r * .88;
    let lf = { x: -r * .20 - stride, y: r * .70 }, rf = { x: r * .20 + stride, y: r * .70 };
    let lh = { x: -r * .48, y: -r * .12 }, rh = { x: r * .48, y: -r * .12 };
    if (pose === 'shoot') {
      rf = { x: facing * r * (.78 + .20 * wave), y: r * (.20 - .20 * wave) };
      lf = { x: -facing * r * .20, y: r * .70 };
      lh = { x: -facing * r * .58, y: -r * .28 }; rh = { x: facing * r * .40, y: -r * .04 };
    } else if (pose === 'header' || pose === 'claim') {
      lh = { x: -r * .48, y: -r * (.78 + .18 * wave) }; rh = { x: r * .48, y: -r * (.78 + .18 * wave) };
      lf.y = r * .58; rf.y = r * .58;
    } else if (pose === 'punch') {
      lh = { x: -facing * r * .22, y: -r * .70 }; rh = { x: facing * r * (.82 + .12 * wave), y: -r * (.78 + .10 * wave) };
    } else if (pose === 'parry') {
      lh = { x: -facing * r * .62, y: -r * .58 }; rh = { x: facing * r * .78, y: -r * .48 };
    } else if (pose === 'tackle') {
      lf = { x: -facing * r * .22, y: r * .46 }; rf = { x: facing * r * .88, y: r * .30 };
      lh = { x: -facing * r * .55, y: -r * .05 }; rh = { x: facing * r * .46, y: r * .08 };
    } else if (pose === 'dive') {
      lh = { x: -r * .72, y: -r * .34 }; rh = { x: r * .82, y: -r * .42 };
      lf = { x: -r * .46, y: r * .42 }; rf = { x: r * .58, y: r * .38 };
    } else if (o.isGK && pose === 'idle') {
      lh = { x: -r * .58, y: -r * .02 }; rh = { x: r * .58, y: -r * .02 };
      lf = { x: -r * .32, y: r * .68 }; rf = { x: r * .32, y: r * .68 };
    }

    const jersey = o.isGK ? (o.gkC || '#ffd33d') : (o.pc || '#e8eef8');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.4, r * .22); ctx.strokeStyle = jersey;
    function joint(a, b, c) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.stroke(); }
    joint({ x: -r * .17, y: hipY }, { x: -r * .20 + stride * .25, y: r * .35 }, lf);
    joint({ x: r * .17, y: hipY }, { x: r * .20 - stride * .25, y: r * .35 }, rf);
    joint({ x: -r * .28 + leanX * .2, y: shoulderY }, { x: -r * .38, y: -r * .25 }, lh);
    joint({ x: r * .28 + leanX * .2, y: shoulderY }, { x: r * .38, y: -r * .25 }, rh);

    const grad = ctx.createLinearGradient(-r, 0, r, 0);
    grad.addColorStop(0, 'rgba(0,0,0,.18)'); grad.addColorStop(.45, jersey); grad.addColorStop(1, 'rgba(255,255,255,.16)');
    ctx.fillStyle = grad; ctx.beginPath();
    ctx.moveTo(-r * .34 + leanX * .15, shoulderY); ctx.lineTo(r * .34 + leanX * .15, shoulderY);
    ctx.lineTo(r * .25, hipY + r * .12); ctx.lineTo(-r * .25, hipY + r * .12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d7a77e'; ctx.beginPath(); ctx.arc(leanX * .28, headY + leanY * .15, r * .25, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.34)'; ctx.lineWidth = Math.max(1, r * .08); ctx.stroke();
    if (o.hasBall) { ctx.strokeStyle = 'rgba(255,219,88,.85)'; ctx.lineWidth = Math.max(1, r * .10); ctx.beginPath(); ctx.arc(0, 0, r * .92, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  function trail(ctx, pts, cx, cy) {
    if (!pts.length) return;
    const speed = clamp((root.G && root.G.speed) || 1, 1, 3.6);
    const step = speed >= 3 ? 2 : 1;
    ctx.save();
    for (let i = pts.length - 1; i >= 0; i -= step) {
      const tp = pts[i], f = 1 - i / pts.length, p = base.project(cx(tp.x), cy(tp.y));
      const py = elevatedY(p, tp.z || 0);
      ctx.shadowColor = 'rgba(255,215,50,.9)'; ctx.shadowBlur = 10 * f;
      ctx.fillStyle = 'rgba(255,224,90,' + (f * .7).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, py, Math.max(.6, (4.4 - i * .5)) * p.s, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* VFX-021..025 — qualquer chute alto usa arco; não existe exceção por kind. */
  function traj(ctx, o) {
    const A = base.project(o.cx(o.fx), o.cy(o.fy));
    const D = base.project(o.cx(o.tx), o.cy(o.ty));
    const g = base.project(o.cx(o.gx), o.cy(o.gy));
    const z = o.z || 0, isShot = o.kind === 'shot', aerial = z > .45;
    ctx.save();
    if (aerial) {
      const B = { x: g.x, y: elevatedY(g, z) };
      const du = Math.hypot(D.x - A.x, D.y - A.y) || 1;
      let u = clamp(Math.hypot(g.x - A.x, g.y - A.y) / du, .08, .92);
      const w = 2 * u * (1 - u);
      const C = { x: (B.x - (1 - u) ** 2 * A.x - u ** 2 * D.x) / w, y: (B.y - (1 - u) ** 2 * A.y - u ** 2 * D.y) / w };
      const AC = { x: A.x + (C.x - A.x) * u, y: A.y + (C.y - A.y) * u };
      const CD = { x: C.x + (D.x - C.x) * u, y: C.y + (D.y - C.y) * u };
      ctx.strokeStyle = isShot ? 'rgba(255,255,255,.46)' : 'rgba(255,220,40,.42)'; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(AC.x, AC.y, B.x, B.y); ctx.stroke();
      ctx.strokeStyle = isShot ? 'rgba(255,255,255,.9)' : 'rgba(255,220,40,.9)'; ctx.setLineDash([7, 6]);
      ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.quadraticCurveTo(CD.x, CD.y, D.x, D.y); ctx.stroke(); ctx.setLineDash([]);
      const ang = Math.atan2(D.y - CD.y, D.x - CD.x);
      ctx.fillStyle = isShot ? 'rgba(255,255,255,.9)' : 'rgba(255,220,40,.95)';
      ctx.beginPath(); ctx.moveTo(D.x, D.y); ctx.lineTo(D.x - 9 * Math.cos(ang - .42), D.y - 9 * Math.sin(ang - .42)); ctx.lineTo(D.x - 9 * Math.cos(ang + .42), D.y - 9 * Math.sin(ang + .42)); ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle = isShot ? 'rgba(255,255,255,.75)' : 'rgba(255,220,40,.9)'; ctx.lineWidth = 2; ctx.setLineDash(isShot ? [] : [7, 6]);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(D.x, D.y); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function ball(ctx, o) {
    const g0 = base.project(o.gx, o.gy), s = g0.s, z = o.z || 0, air = clamp(z / 3.2, 0, 1);
    const bx = g0.x, by = elevatedY(g0, z);
    if (o.tv && o.tv.kind !== 'shot' && z > .35) {
      const t = base.project(o.tv.tx, o.tv.ty);
      const visualSpeed = clamp((root.G && root.G.speed) || 1, 1, 3.6);
      const pulse = 1 + Math.sin(performance.now() / (130 * visualSpeed)) * .18;
      ctx.save(); ctx.strokeStyle = 'rgba(255,214,64,.85)'; ctx.lineWidth = 2 * t.s;
      ctx.beginPath(); ctx.ellipse(t.x, t.y, 8.5 * pulse * t.s, 3.9 * pulse * t.s, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,214,64,.35)'; ctx.lineWidth = t.s;
      ctx.beginPath(); ctx.ellipse(t.x, t.y, 13 * pulse * t.s, 6 * pulse * t.s, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = .32 - air * .14; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(bx, g0.y + 2 * s, (5.6 - air * 1.8) * s, (2.6 - air * .9) * s, 0, 0, TAU); ctx.fill(); ctx.restore();
    if (z > .5) { ctx.save(); ctx.strokeStyle = 'rgba(255,230,120,.55)'; ctx.lineWidth = Math.max(.7, s); ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(bx, g0.y); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore(); }
    const rb = (6.2 + air * 2.6) * s;
    const bg = ctx.createRadialGradient(bx - rb * .36, by - rb * .36, 0, bx, by, rb);
    bg.addColorStop(0, '#fff'); bg.addColorStop(.75, '#e9e9e9'); bg.addColorStop(1, '#b9bcc4');
    ctx.beginPath(); ctx.arc(bx, by, rb, 0, TAU); ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = '#3d3f46'; ctx.lineWidth = .8; ctx.stroke();
  }

  /* PRO-031..035 — falta e pênalti recebem o mesmo contrato de palco 2.5D. */
  function spStage25D(scene) {
    const CW = 1024;
    const portrait = !!(root.matchMedia && root.matchMedia('(max-width:700px) and (orientation:portrait)').matches);
    const dist = clamp(+(scene && scene.dist) || ((scene && scene.mode === 'shootout') ? 11 : 24), 11, 32);
    const penalty = dist <= 12.5 || (scene && scene.mode === 'shootout');
    const horizon = portrait ? 218 : 198, depth = clamp((dist - 11) / 21, 0, 1);
    const goalW = portrait ? (penalty ? 326 : clamp(276 - depth * 54, 214, 276)) : (penalty ? 584 : clamp(500 - depth * 126, 354, 500));
    const goalH = goalW / 3, goalY = clamp(horizon - goalH - (portrait ? 7 : 9), 30, horizon - 42);
    const goal = { x: (CW - goalW) / 2, y: goalY, w: goalW, h: goalH };
    const ballY = portrait ? 410 : 420, wallY = ballY - (portrait ? 105 : 124) * clamp(1 + (dist - 24) * .007, .94, 1.06);
    const gkScale = goal.h * .77 / 47, wallScale = gkScale * clamp(1.24 + (dist - 18) * .017, 1.24, 1.50);
    return { stage: 'CDS_F25D', portrait, dist, penalty, goal, ballY, horizon, wallY, gkScale, wallScale,
      takerScale: clamp(wallScale * 1.06, portrait ? 2.02 : 2.9, portrait ? 3.0 : 4.15),
      ballR: portrait ? 7.4 : 10.6, targetBallR: clamp(goal.h * .044, 3.2, 6.8), vanishX: CW * .5 };
  }
  root.spStage25D = spStage25D;
  root.spPerspective = spStage25D; // alias de compatibilidade: implementação antiga é substituída em runtime.

  const nameOf = p => p && ((p.ref && p.ref.n) || p.n || p.name);
  root.__cdsVisualEvent = function (e) {
    const t = String(e && e.type || '').toLowerCase();
    const type = /header|head/.test(t) ? 'header' : /tackle|slide/.test(t) ? 'tackle' : /punch/.test(t) ? 'punch' : /parry/.test(t) ? 'parry' : /save|claim|catch/.test(t) ? 'claim' : /shot|goal|penalty|free.?kick/.test(t) ? 'shoot' : null;
    if (!type) return;
    [e.by, e.player, e.shooter, e.gk, e.keeper, e.winner].filter(Boolean).forEach(p => { const k = nameOf(p); if (k) root.__CDS_ACTIONS[k] = { type, until: performance.now() + 720 }; });
  };

  root.addEventListener('pagehide', resetVisualCaches);
  root.addEventListener('beforeunload', resetVisualCaches);
  root.CDS_F25D = Object.freeze(Object.assign({}, base, {
    version: '2.3.0-audit650-itemized', __audit650Itemized: true,
    elevatedY, body, trail, traj, ball, reset: resetVisualCaches
  }));
})(typeof window !== 'undefined' ? window : globalThis);
