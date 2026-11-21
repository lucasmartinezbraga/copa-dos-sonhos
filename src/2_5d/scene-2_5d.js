/*
 * Copa dos Sonhos · Motor Visual 2.5D · SceneRenderer (protótipo V1/V2)
 * ---------------------------------------------------------------------------
 * Consome VisualState (RenderSnapshot somente-leitura) e desenha campo,
 * atletas, bola e sombras numa câmera broadcast oblíqua. NÃO decide futebol:
 * lê snapshots e projeta. Usa CDS_25D_CONTRACTS.createProjection (projeção
 * afim reversível) para posições/hit-testing e escala por profundidade nos
 * corpos, de modo que as linhas do campo permanecem retas e coerentes.
 *
 * Fora do build autoritativo R13 enquanto câmera/projeção/escala não forem
 * aprovadas (Gate V1). Depois de aprovado, promover a src/r13/scripts como
 * nova camada e gerar candidata versionada.
 */
(function (root) {
  'use strict';
  const C = root.CDS_25D_CONTRACTS;
  if (!C) { console.warn('[scene-2.5d] CDS_25D_CONTRACTS ausente'); }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // Paleta broadcast noturna (coerente com o sistema visual do redesign).
  const PALETTE = {
    grassA: '#1f7a3d', grassB: '#1a6d36', grassEdge: '#14532a',
    line: 'rgba(233,246,255,0.92)', lineSoft: 'rgba(233,246,255,0.5)',
    shadow: 'rgba(4,10,18,0.34)',
    home: '#eff4ff', homeTrim: '#2f6bff', away: '#ffd23d', awayTrim: '#c8410b',
    gk0: '#25d07d', gk1: '#ff5db1', ball: '#ffffff', ballLine: '#0b1220'
  };

  // Constrói uma projeção afim que enquadra a região desejada do campo,
  // com foreshortening vertical (aparência oblíqua) e altura de bola em z.
  function buildProjection(W, H, field, cam) {
    const FL = field.FL || 105, FW = field.FW || 68;
    const ky = cam.foreshorten != null ? cam.foreshorten : 0.62; // compressão vertical
    const pad = cam.pad != null ? cam.pad : 0.05;
    const zoom = cam.zoom || 1;
    const availW = W * (1 - 2 * pad), availH = H * (1 - 2 * pad);
    // margem de gramado além das linhas (contexto/estádio)
    const bx = cam.borderX != null ? cam.borderX : 6;
    const by = cam.borderY != null ? cam.borderY : 4;
    const worldW = FL + bx * 2, worldH = FW + by * 2;
    let s = Math.min(availW / worldW, availH / (worldH * ky)) * zoom;
    const scaleX = s, scaleY = s * ky, heightScale = s * 0.82;
    const cx = cam.cx != null ? cam.cx : FL / 2;
    const cy = cam.cy != null ? cam.cy : FW / 2;
    const originX = W / 2 - scaleX * cx;
    const originY = H / 2 - scaleY * cy;
    return C.createProjection({ originX, originY, scaleX, scaleY, shearX: 0, shearY: 0, heightScale });
  }

  // Escala do corpo por profundidade: near (y=FW, base da tela) maior.
  function depthScale(worldY, FW) {
    const t = clamp(worldY / (FW || 68), 0, 1);
    return lerp(0.82, 1.16, t);
  }

  function createRenderer(canvas, options) {
    const opts = options || {};
    const ctx = canvas.getContext('2d');
    let field = opts.field || { FL: 105, FW: 68 };
    let camera = Object.assign({ cx: field.FL / 2, cy: field.FW / 2, zoom: 1, foreshorten: 0.62 }, opts.camera || {});
    let proj = null, W = 0, H = 0, dpr = opts.dpr || 1;

    function resize(cssW, cssH) {
      W = cssW; H = cssH;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      rebuild();
    }
    function setCamera(c) { camera = Object.assign(camera, c); rebuild(); }
    function setField(f) { field = f; rebuild(); }
    function rebuild() { proj = buildProjection(W, H, field, camera); }
    function w2s(x, y, z) { return proj.worldToScreen({ x, y, z: z || 0 }); }
    function s2w(sx, sy, z) { return proj.screenToWorld({ x: sx, y: sy }, z || 0); }

    // ── CAMPO ────────────────────────────────────────────────────────────
    function drawPitch() {
      const FL = field.FL, FW = field.FW;
      ctx.save();
      ctx.scale(dpr, dpr);
      // fundo (fora do gramado)
      ctx.fillStyle = '#0a1119';
      ctx.fillRect(0, 0, W, H);

      // gramado com faixas de corte (bandas ao longo de x)
      const stripes = 18;
      for (let i = 0; i < stripes; i++) {
        const x0 = (i / stripes) * FL, x1 = ((i + 1) / stripes) * FL;
        const p0 = w2s(x0, 0, 0), p1 = w2s(x1, 0, 0), p2 = w2s(x1, FW, 0), p3 = w2s(x0, FW, 0);
        ctx.fillStyle = i % 2 ? PALETTE.grassA : PALETTE.grassB;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.closePath(); ctx.fill();
      }
      // vinheta de borda do gramado
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(4,10,18,0.35)'); g.addColorStop(0.35, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(4,10,18,0.22)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // linhas
      ctx.lineJoin = 'round';
      const line = (ax, ay, bx, by, soft) => {
        const a = w2s(ax, ay, 0), b = w2s(bx, by, 0);
        ctx.strokeStyle = soft ? PALETTE.lineSoft : PALETTE.line;
        ctx.lineWidth = Math.max(1, camera._lineW || 2);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      };
      const rect = (x0, y0, x1, y1) => { line(x0, y0, x1, y0); line(x1, y0, x1, y1); line(x1, y1, x0, y1); line(x0, y1, x0, y0); };
      camera._lineW = Math.max(1.4, buildProjection(W, H, field, camera).config.scaleX * 0.12);
      // contorno
      rect(0, 0, FL, FW);
      // meio
      line(FL / 2, 0, FL / 2, FW);
      // círculo central (elipse sob afim)
      ellipseWorld(FL / 2, FW / 2, 9.15, 9.15);
      dot(FL / 2, FW / 2);
      // áreas e metas (dois lados)
      penaltyArea(0, +1); penaltyArea(FL, -1);
      ctx.restore();
    }
    function ellipseWorld(cxw, cyw, rx, ry) {
      const seg = 48; ctx.strokeStyle = PALETTE.line; ctx.lineWidth = camera._lineW || 2;
      ctx.beginPath();
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const p = w2s(cxw + Math.cos(a) * rx, cyw + Math.sin(a) * ry, 0);
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
    }
    function dot(x, y) { const p = w2s(x, y, 0); ctx.fillStyle = PALETTE.line; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, 7); ctx.fill(); }
    function penaltyArea(goalX, dir) {
      const FW = field.FW;
      const boxDepth = 16.5, boxW = 40.3, sixDepth = 5.5, sixW = 18.32;
      const cy = FW / 2;
      const bx1 = goalX + dir * boxDepth;
      seg4(goalX, cy - boxW / 2, bx1, cy - boxW / 2); // top
      seg4(bx1, cy - boxW / 2, bx1, cy + boxW / 2);   // front
      seg4(bx1, cy + boxW / 2, goalX, cy + boxW / 2); // bottom
      const sx1 = goalX + dir * sixDepth;
      seg4(goalX, cy - sixW / 2, sx1, cy - sixW / 2);
      seg4(sx1, cy - sixW / 2, sx1, cy + sixW / 2);
      seg4(sx1, cy + sixW / 2, goalX, cy + sixW / 2);
      // marca do pênalti
      dot(goalX + dir * 11, cy);
      // gol (traves com altura em z)
      const gW = 7.32, gh = 2.44, gy0 = cy - gW / 2, gy1 = cy + gW / 2;
      const postA0 = w2s(goalX, gy0, 0), postA1 = w2s(goalX, gy0, gh);
      const postB0 = w2s(goalX, gy1, 0), postB1 = w2s(goalX, gy1, gh);
      ctx.strokeStyle = '#f7fbff'; ctx.lineWidth = (camera._lineW || 2) * 1.1;
      ctx.beginPath();
      ctx.moveTo(postA0.x, postA0.y); ctx.lineTo(postA1.x, postA1.y);
      ctx.lineTo(postB1.x, postB1.y); ctx.lineTo(postB0.x, postB0.y);
      ctx.stroke();
      // rede (leve)
      ctx.strokeStyle = 'rgba(233,246,255,0.18)';
      for (let i = 1; i < 5; i++) {
        const yy = lerp(gy0, gy1, i / 5);
        const a = w2s(goalX, yy, 0), b = w2s(goalX, yy, gh);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    function seg4(ax, ay, bx, by) {
      const a = w2s(ax, ay, 0), b = w2s(bx, by, 0);
      ctx.strokeStyle = PALETTE.line; ctx.lineWidth = camera._lineW || 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // ── ENTIDADES ─────────────────────────────────────────────────────────
    function drawShadow(x, y, z, r) {
      const base = w2s(x, y, 0);
      const lift = clamp((z || 0) / 6, 0, 1);
      const rx = r * (1 + lift * 0.6), ry = r * 0.42 * (1 + lift * 0.4);
      ctx.save(); ctx.globalAlpha = 0.34 * (1 - lift * 0.4);
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath(); ctx.ellipse(base.x, base.y, rx, ry, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    function drawPlayer(p) {
      const FW = field.FW;
      const ds = depthScale(p.y, FW) * (camera._entScale || 1);
      const rBody = (camera._unit || 8) * ds;
      drawShadow(p.x, p.y, 0, rBody * 0.95);
      const feet = w2s(p.x, p.y, 0);
      const bodyH = rBody * 2.2;
      const isHome = p.team === 0;
      const fill = p.isGK ? (isHome ? PALETTE.gk0 : PALETTE.gk1) : (isHome ? PALETTE.home : PALETTE.away);
      const trim = p.isGK ? '#04121f' : (isHome ? PALETTE.homeTrim : PALETTE.awayTrim);
      // corpo (cápsula) subindo dos pés
      const topY = feet.y - bodyH;
      ctx.save();
      ctx.fillStyle = fill; ctx.strokeStyle = trim; ctx.lineWidth = Math.max(1, rBody * 0.28);
      roundedCapsule(feet.x, topY, feet.y - rBody * 0.5, rBody * 0.82);
      ctx.fill(); ctx.stroke();
      // cabeça
      ctx.fillStyle = '#f0c9a0';
      ctx.beginPath(); ctx.arc(feet.x, topY, rBody * 0.6, 0, 7); ctx.fill();
      // indicador de direção (para onde o corpo aponta)
      const fx = Math.cos(p.facing), fy = Math.sin(p.facing);
      const tip = w2s(p.x + fx * 1.6, p.y + fy * 1.6, 0);
      ctx.strokeStyle = trim; ctx.lineWidth = Math.max(1, rBody * 0.32);
      ctx.beginPath(); ctx.moveTo(feet.x, feet.y - rBody * 0.5); ctx.lineTo(tip.x, tip.y - rBody * 0.5); ctx.stroke();
      ctx.restore();
    }
    function roundedCapsule(cx, topY, botY, r) {
      ctx.beginPath();
      ctx.moveTo(cx - r, topY);
      ctx.lineTo(cx - r, botY);
      ctx.quadraticCurveTo(cx - r, botY + r, cx, botY + r);
      ctx.quadraticCurveTo(cx + r, botY + r, cx + r, botY);
      ctx.lineTo(cx + r, topY);
      ctx.quadraticCurveTo(cx + r, topY - r, cx, topY - r);
      ctx.quadraticCurveTo(cx - r, topY - r, cx - r, topY);
      ctx.closePath();
    }
    function drawBall(b) {
      const FW = field.FW;
      const ds = depthScale(b.y, FW) * (camera._entScale || 1);
      const r = (camera._unit || 8) * 0.55 * ds;
      drawShadow(b.x, b.y, b.z, r * 1.05);
      const s = w2s(b.x, b.y, b.z);
      ctx.save();
      ctx.fillStyle = PALETTE.ball; ctx.strokeStyle = PALETTE.ballLine; ctx.lineWidth = Math.max(0.8, r * 0.22);
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // ── FRAME ─────────────────────────────────────────────────────────────
    function render(visualState, cam) {
      if (cam) setCamera(cam);
      camera._unit = Math.max(5, buildProjection(W, H, field, camera).config.scaleX * 0.85);
      drawPitch();
      ctx.save(); ctx.scale(dpr, dpr);
      // ordenar por profundidade (worldY crescente = do fundo para a frente).
      // Normaliza players (VisualState traz p.position.{x,y,z}) para forma plana.
      const ents = [];
      for (const p of visualState.players) ents.push({ kind: 'p', y: p.position.y, data: {
        x: p.position.x, y: p.position.y, z: p.position.z, team: p.team, facing: p.facing, isGK: p.isGK, pose: p.pose
      } });
      const b = visualState.ball;
      ents.push({ kind: 'b', y: b.position.y, data: { x: b.position.x, y: b.position.y, z: b.position.z } });
      ents.sort((a, b) => a.y - b.y);
      for (const e of ents) {
        if (e.kind === 'p') drawPlayer(e.data);
        else drawBall(e.data);
      }
      ctx.restore();
    }

    resize(opts.width || 960, opts.height || 540);
    return { render, resize, setCamera, setField, worldToScreen: w2s, screenToWorld: s2w, get projection() { return proj; }, get camera() { return camera; } };
  }

  root.CDS_SCENE_2_5D = { version: '1.0.0-proto', createRenderer, buildProjection, depthScale, PALETTE };
})(typeof window !== 'undefined' ? window : globalThis);
