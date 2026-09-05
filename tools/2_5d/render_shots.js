#!/usr/bin/env node
'use strict';
/*
 * Gate V1 — driver de auditoria visual do protótipo 2.5D.
 * Compõe uma página com os contratos 2.5D + o SceneRenderer + um frame real
 * (snapshot do motor), renderiza em vários aspect ratios via Chromium e grava
 * screenshots. Também mede o round-trip da projeção (worldToScreen->screenToWorld)
 * e verifica presença/ordem das entidades numa sequência (anti-teleporte).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const EXE = process.env.CDS_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.resolve(__dirname, '../..');
const argv = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v]; }));
const STREAM = argv.stream || path.join(ROOT, 'reports/2_5d/clip-match0.json');
const OUTDIR = argv.outdir || path.join(ROOT, 'reports/2_5d/shots');

const CONTRACTS = fs.readFileSync(path.join(ROOT, 'src/r13/scripts/22-2_5d-gate-a-contracts.js'), 'utf8');
const RENDERER = fs.readFileSync(path.join(ROOT, 'src/2_5d/scene-2_5d.js'), 'utf8');

const VIEWPORTS = [
  { name: 'desktop-16x9', w: 1280, h: 720 },
  { name: 'mobile-land-19_5x9', w: 844, h: 390 },
  { name: 'tablet-4x3', w: 1024, h: 768 },
  { name: 'mobile-portrait', w: 390, h: 844 },
];

function pageHtml(frame, field, vw, vh) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#0a1119}#stage{width:${vw}px;height:${vh}px}</style></head>
<body><canvas id="stage"></canvas>
<script>${CONTRACTS}</script>
<script>${RENDERER}</script>
<script>
const FRAME=${JSON.stringify(frame)}, FIELD=${JSON.stringify(field)};
const C=window.CDS_25D_CONTRACTS;
const vs=C.createVisualState({
  timelineId:'proto', time:FRAME.t||0, interpolationAlpha:0,
  ball:{position:{x:FRAME.ball.x,y:FRAME.ball.y,z:FRAME.ball.z},velocity:{x:FRAME.ball.vx||0,y:FRAME.ball.vy||0,z:FRAME.ball.vz||0},ownerId:FRAME.ball.ownerId,traveling:!!FRAME.ball.traveling},
  players:FRAME.players.map(p=>({id:p.id,team:p.team,position:{x:p.x,y:p.y,z:p.z||0},velocity:{x:0,y:0,z:0},facing:p.facing||0,pose:p.pose||'idle',actionPhase:'none',isGK:!!p.isGK,visible:true})),
  eventIds:[]
});
const cv=document.getElementById('stage');
const r=window.CDS_SCENE_2_5D.createRenderer(cv,{field:FIELD,width:${vw},height:${vh},dpr:1});
r.render(vs);
// round-trip da projeção
let maxErr=0;
for(let x=0;x<=FIELD.FL;x+=7)for(let y=0;y<=FIELD.FW;y+=7){const s=r.worldToScreen(x,y,0);const w=r.screenToWorld(s.x,s.y,0);maxErr=Math.max(maxErr,Math.hypot(w.x-x,w.y-y));}
window.__roundTrip=maxErr;
window.__entities={players:vs.players.length,ballVisible:Number.isFinite(vs.ball.position.x)};
</script></body></html>`;
}

function pickFrames(frames) {
  // kickoff, ~1/4, meio, gol/altura, fim
  const n = frames.length;
  const byBallHeight = frames.map((f, i) => ({ i, z: f.ball.z })).sort((a, b) => b.z - a.z)[0];
  return [
    { tag: 'kickoff', i: Math.min(4, n - 1) },
    { tag: 'quarter', i: Math.floor(n * 0.25) },
    { tag: 'mid', i: Math.floor(n * 0.5) },
    { tag: 'ball-high', i: byBallHeight ? byBallHeight.i : Math.floor(n * 0.75) },
    { tag: 'late', i: Math.floor(n * 0.92) },
  ];
}

(async () => {
  const stream = JSON.parse(fs.readFileSync(STREAM, 'utf8'));
  const field = stream.meta.field;
  const frames = stream.frames;
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const picks = pickFrames(frames);
  const report = { stream: path.basename(STREAM), field, frameCount: frames.length, shots: [], roundTripMax: 0 };
  for (const vp of VIEWPORTS) {
    for (const pk of picks) {
      const frame = frames[pk.i];
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      await page.setContent(pageHtml(frame, field, vp.w, vp.h), { waitUntil: 'networkidle' });
      await page.waitForTimeout(60);
      const rt = await page.evaluate(() => window.__roundTrip);
      const ents = await page.evaluate(() => window.__entities);
      const file = `${vp.name}__${pk.tag}.png`;
      await page.screenshot({ path: path.join(OUTDIR, file) });
      report.shots.push({ viewport: vp.name, tag: pk.tag, frame: pk.i, ballZ: +frame.ball.z.toFixed(2), roundTripErr: rt, entities: ents, file });
      report.roundTripMax = Math.max(report.roundTripMax, rt);
      await page.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUTDIR, 'render-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outdir: OUTDIR, shots: report.shots.length, roundTripMax: report.roundTripMax,
    sample: report.shots.slice(0, 3) }, null, 2));
})().catch(e => { console.error('FALHOU:', e.stack || e.message); process.exit(1); });
