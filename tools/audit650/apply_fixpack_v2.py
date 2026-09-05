#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, re, sys
from datetime import datetime, timezone
from pathlib import Path

TARGET = Path('dist/COPA DOS SONHOS - RC-UX.html')
REPORT = Path('reports/AUDITORIA-650-FIXPACK-RESULTADO.json')
EXPECTED_SHA256 = 'a2f62022807a9b322bc64487bba5298c5c9f1b7cbf7255c9e140e9618c58f36c'
MARKER = 'AUDIT650-RCUX-FIXPACK-2'
applied: list[str] = []


def digest(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def replace_one(text: str, old: str, new: str, control: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{control}: expected one exact match, found {count}')
    applied.append(control)
    return text.replace(old, new, 1)


def regex_one(text: str, pattern: str, replacement: str, control: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{control}: expected one regex match, found {count}')
    applied.append(control)
    return updated


def regex_all(text: str, pattern: str, replacement: str, control: str, minimum: int = 1, maximum: int = 30, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, flags=flags)
    if count < minimum or count > maximum:
        raise RuntimeError(f'{control}: expected {minimum}..{maximum} regex matches, found {count}')
    applied.append(f'{control} ({count})')
    return updated


def optional_regex(text: str, pattern: str, replacement: str, control: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count:
        applied.append(control)
        return updated
    applied.append(f'{control} (already absent)')
    return text


def main() -> int:
    original = TARGET.read_text(encoding='utf-8')
    before = digest(original)
    if MARKER in original:
        print(f'{MARKER}: already applied')
        return 0
    if before != EXPECTED_SHA256:
        raise RuntimeError(f'candidate hash mismatch: expected={EXPECTED_SHA256} actual={before}')
    text = original

    text = regex_one(text, r'(const G\s*=\s*\{\s*CW:\s*1024,\s*CH:\s*500,\s*M:\s*12,\s*[^{}]*?\btopY:\s*)46(\s*,\s*bottomY:\s*497,)', r'\g<1>64\g<2>', 'CAM-P0-A1-top-band', re.S)
    text = regex_one(text, r'G\.topY\s*=\s*M\s*\+\s*34\s*;', 'G.topY = M + 52;', 'CAM-P0-A1-runtime-top-band')

    projection_helpers = r'''  /* AUDIT650 P0-A1 — visual elevation ceiling.
   * Logical x/y/z stay untouched. Only visual lift is compressed by depth. */
  function elevatedY(p, z) {
    const height = Math.max(0, Number(z) || 0);
    const rawLift = height * 22 * p.s;
    const depth = clamp((p.y - G.topY) / Math.max(1, G.bottomY - G.topY), 0, 1);
    const maxLift = 30 + depth * 104;
    return Math.max(36, p.y - Math.min(rawLift, maxLift));
  }
  function resetVisualCaches() {
    dirCache.clear();
    if (root.__CDS_ACTIONS) Object.keys(root.__CDS_ACTIONS).forEach(k => delete root.__CDS_ACTIONS[k]);
  }

'''
    text = replace_one(text, '  const dirCache = new Map();', projection_helpers + '  const dirCache = new Map();', 'CAM-P0-A1-projector')
    text = replace_one(text, 'const bx = g0.x, by = g0.y - z * 22 * s;', 'const bx = g0.x, by = elevatedY(g0, z);', 'TRJ-P0-A1-ball')
    text = regex_all(text, r'p\.y\s*-\s*\(tp\.z\s*\|\|\s*0\)\s*\*\s*22\s*\*\s*p\.s', 'elevatedY(p, tp.z || 0)', 'TRJ-P0-A1-trail', 1, 3)
    text = regex_all(text, r'g\.y\s*-\s*z\s*\*\s*22\s*\*\s*g\.s', 'elevatedY(g, z)', 'TRJ-P0-A1-guide', 1, 3)
    text = regex_one(text, r'const\s+aerial\s*=\s*!isShot\s*&&\s*z\s*>\s*0\.45\s*;', 'const aerial = z > 0.45;', 'TRJ-P1-high-shot-arc')

    articulated = r'''
  /* AUDIT650 P0-B1 — articulated, state-driven athlete. */
  function body650(ctx, o) {
    const x=o.x, y=o.y, r=Math.max(4,o.r||7), key=String(o.key||'anon');
    const now=performance.now();
    const prev=dirCache.get(key)||{x,y,t:now,dx:0,dy:0,lastSeen:now};
    const dt=Math.max(8,now-prev.t), dx=x-prev.x, dy=y-prev.y;
    const pxSpeed=Math.hypot(dx,dy)/(dt/16.6667);
    const smoothDx=prev.dx*.62+dx*.38, smoothDy=prev.dy*.62+dy*.38;
    dirCache.set(key,{x,y,t:now,dx:smoothDx,dy:smoothDy,lastSeen:now});
    if(dirCache.size>192 && ((now|0)%47===0)) for(const [k,v] of dirCache) if(now-(v.lastSeen||0)>5000) dirCache.delete(k);
    const eventPose=(root.__CDS_ACTIONS&&root.__CDS_ACTIONS[key])||null;
    if(eventPose&&eventPose.until<now) delete root.__CDS_ACTIONS[key];
    let pose=(eventPose&&eventPose.until>=now&&eventPose.type)||o.motionType||'';
    if(o.divePose) pose='dive';
    if(!pose) pose=pxSpeed>.10?'run':'idle';
    if(o.isGK&&pose==='jump') pose='claim';
    const facing=Math.abs(smoothDx)>.03?(smoothDx<0?-1:1):1;
    const cycle=(now*.014+key.length*.73)*(0.55+Math.min(1.5,pxSpeed)*.9);
    const stride=pose==='run'?Math.sin(cycle)*r*.42:0;
    const bob=pose==='run'?Math.abs(Math.cos(cycle))*r*.10:0;
    const lean=clamp(smoothDx*.16,-r*.20,r*.20);
    const wave=clamp(Number(o.actionWave)||0,0,1);
    ctx.save(); ctx.translate(x,y-bob);
    if(pose==='dive') ctx.rotate(facing*(Math.PI*.34));
    else if(pose==='tackle') ctx.rotate(facing*(Math.PI*.16));
    ctx.save();ctx.translate(0,bob);ctx.scale(1,.34);ctx.fillStyle='rgba(0,0,0,.26)';ctx.beginPath();ctx.ellipse(0,r*.70,r*.70,r*.34,0,0,TAU);ctx.fill();ctx.restore();
    const hipY=r*.05, shoulderY=-r*.52, headY=-r*.88;
    let lf={x:-r*.20-stride,y:r*.70}, rf={x:r*.20+stride,y:r*.70};
    let lh={x:-r*.48,y:-r*.12}, rh={x:r*.48,y:-r*.12};
    if(pose==='shoot'){rf={x:facing*r*(.78+.20*wave),y:r*(.20-.20*wave)};lf={x:-facing*r*.20,y:r*.70};lh={x:-facing*r*.58,y:-r*.28};rh={x:facing*r*.40,y:-r*.04};}
    else if(pose==='header'||pose==='claim'){lh={x:-r*.48,y:-r*(.78+.18*wave)};rh={x:r*.48,y:-r*(.78+.18*wave)};lf.y=r*.58;rf.y=r*.58;}
    else if(pose==='punch'){lh={x:-facing*r*.22,y:-r*.70};rh={x:facing*r*(.82+.12*wave),y:-r*(.78+.10*wave)};}
    else if(pose==='parry'){lh={x:-facing*r*.62,y:-r*.58};rh={x:facing*r*.78,y:-r*.48};}
    else if(pose==='tackle'){lf={x:-facing*r*.22,y:r*.46};rf={x:facing*r*.88,y:r*.30};lh={x:-facing*r*.55,y:-r*.05};rh={x:facing*r*.46,y:r*.08};}
    else if(pose==='dive'){lh={x:-r*.72,y:-r*.34};rh={x:r*.82,y:-r*.42};lf={x:-r*.46,y:r*.42};rf={x:r*.58,y:r*.38};}
    else if(o.isGK&&pose==='idle'){lh={x:-r*.58,y:-r*.02};rh={x:r*.58,y:-r*.02};lf={x:-r*.32,y:r*.68};rf={x:r*.32,y:r*.68};}
    const limb=o.isGK?(o.gkC||'#ffd33d'):(o.pc||'#e8eef8');
    ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=Math.max(1.4,r*.22);ctx.strokeStyle=limb;
    function joint(a,b,c){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.stroke();}
    joint({x:-r*.17,y:hipY},{x:-r*.20+stride*.25,y:r*.35},lf);joint({x:r*.17,y:hipY},{x:r*.20-stride*.25,y:r*.35},rf);
    joint({x:-r*.28+lean*.2,y:shoulderY},{x:-r*.38,y:-r*.25},lh);joint({x:r*.28+lean*.2,y:shoulderY},{x:r*.38,y:-r*.25},rh);
    const shirt=o.isGK?(o.gkC||'#ffd33d'):(o.pc||'#e8eef8');
    const grad=ctx.createLinearGradient(-r,0,r,0);grad.addColorStop(0,'rgba(0,0,0,.18)');grad.addColorStop(.45,shirt);grad.addColorStop(1,'rgba(255,255,255,.16)');
    ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(-r*.34+lean*.15,shoulderY);ctx.lineTo(r*.34+lean*.15,shoulderY);ctx.lineTo(r*.25,hipY+r*.12);ctx.lineTo(-r*.25,hipY+r*.12);ctx.closePath();ctx.fill();
    ctx.fillStyle='#d7a77e';ctx.beginPath();ctx.arc(lean*.28,headY,r*.25,0,TAU);ctx.fill();ctx.strokeStyle='rgba(0,0,0,.34)';ctx.lineWidth=Math.max(1,r*.08);ctx.stroke();
    if(o.hasBall){ctx.strokeStyle='rgba(255,219,88,.85)';ctx.lineWidth=Math.max(1,r*.10);ctx.beginPath();ctx.arc(0,0,r*.92,0,TAU);ctx.stroke();}
    ctx.restore();
  }

'''
    text = replace_one(text, '  /* ── RASTRO EM ARCO (projetado)', articulated + '  /* ── RASTRO EM ARCO (projetado)', 'ATH-P0-B1-articulated-body')
    text = replace_one(text, "x, y, r, pc, gkC, isGK: p.slot==='GK', divePose, hasBall: !!p.hasBall, key: (p.ref&&p.ref.n)||p.n||('#'+(p.num||0))", "x, y, r, pc, gkC, isGK: p.slot==='GK', divePose, motionType:motion&&motion.type, actionWave, speed:G.speed, hasBall: !!p.hasBall, key: (p.ref&&p.ref.n)||p.n||('#'+(p.num||0))", 'ATH-P0-B1-feed-state')
    text = optional_regex(text, r"ctx\.font\s*=\s*`bold 10px Arial,sans-serif`;", "ctx.font = `bold ${clamp(r*.78,7.2,11.8).toFixed(1)}px Arial,sans-serif`;", 'ATH-P1-depth-number')
    text = optional_regex(text, r"ctx\.font\s*=\s*`bold 7\.5px Arial,sans-serif`;", "ctx.font = `bold ${clamp(r*.58,6.2,9.3).toFixed(1)}px Arial,sans-serif`;", 'ATH-P1-depth-label')

    text = regex_all(text, r'\bspPerspective\b', 'spStage25D', 'CAM-P0-D1-remove-legacy-name', 3, 20)
    new_stage = r'''function spStage25D(scene){
  const portrait=!!(window.matchMedia&&window.matchMedia('(max-width:700px) and (orientation:portrait)').matches);
  const dist=clamp(+(scene&&scene.dist)||((scene&&scene.mode==='shootout')?11:24),11,32);
  const penalty=dist<=12.5||(scene&&scene.mode==='shootout');
  const horizon=portrait?218:198, depth=clamp((dist-11)/21,0,1);
  const goalW=portrait?(penalty?326:clamp(276-depth*54,214,276)):(penalty?584:clamp(500-depth*126,354,500));
  const goalH=goalW/3, goalY=clamp(horizon-goalH-(portrait?7:9),30,horizon-42);
  const goal={x:(CW-goalW)/2,y:goalY,w:goalW,h:goalH};
  const ballY=portrait?410:420, wallY=ballY-(portrait?105:124)*clamp(1+(dist-24)*.007,.94,1.06);
  const gkScale=goal.h*.77/47, wallScale=gkScale*clamp(1.24+(dist-18)*.017,1.24,1.50);
  return {stage:'CDS_F25D',portrait,dist,penalty,goal,ballY,horizon,wallY,gkScale,wallScale,
    takerScale:clamp(wallScale*1.06,portrait?2.02:2.9,portrait?3.0:4.15),ballR:portrait?7.4:10.6,
    targetBallR:clamp(goal.h*.044,3.2,6.8),vanishX:CW*.5};
}'''
    text = regex_one(text, r'function spStage25D\(scene\)\{.*?\n\}', new_stage, 'CAM-P0-D1-unified-stage', re.S)

    text = optional_regex(text, r'const n\s*=\s*14\s*;', "const n=(root.G&&root.G.speed>=3)?7:14;", 'VFX-P1-turbo-density')
    text = replace_one(text, "root.CDS_F25D = Object.freeze({ version: '2.1.0', project, grass, pitch, body, trail, ball, traj });", "root.CDS_F25D = Object.freeze({ version: '2.2.0-audit650', project, elevatedY, grass, pitch, body:body650, trail, ball, traj, reset:resetVisualCaches });", 'INT-P0-export-auditable-api')
    text = replace_one(text, 'function onEvent(e) {\n  const __phys=physicalTag(e);', 'function onEvent(e) {\n  if(window.__cdsVisualEvent)window.__cdsVisualEvent(e);\n  const __phys=physicalTag(e);', 'ATH-P0-event-poses')
    text = replace_one(text, 'function renderDraft(keepList) {\n  const d = G.draft; if (!d) return;', "function renderDraft(keepList) {\n  const d = G.draft; if (!d) return;\n  const __missing=d.slots&&d.slots.filter(s=>!s.p)||[];\n  const __available=(d.cur&&d.cur.pl)||[];\n  const __canFinish=__missing.some(sl=>__available.some(p=>canPlay(p,sl.pos)));\n  if(filled()===10&&d.rerolls<=0&&!__canFinish&&!d.__emergencyRerollUsed){d.__emergencyRerollUsed=true;d.rerolls=1;setTimeout(()=>toast('Reroll de emergência liberado para completar o 11.'),0);}", 'UX-P1-emergency-reroll')

    runtime = r'''
<!-- AUDIT650-RCUX-FIXPACK-2 -->
<style id="audit650-fixpack-css">
button,.btn,[role="button"],select,input[type="button"],input[type="submit"]{min-height:44px}
.field-wrap{min-height:0!important;margin-bottom:0!important}.match-page,.match-shell,.screen{padding-bottom:max(12px,env(safe-area-inset-bottom))}
@media (min-width:1000px){.field-wrap{max-height:min(64vh,620px)}#fieldcv{display:block;width:100%;height:auto;max-height:min(64vh,620px)}}
@media (max-width:700px) and (orientation:portrait){.field-wrap{width:100%;overflow:hidden;aspect-ratio:1024/500;min-height:0!important}#fieldcv{width:100%!important;height:100%!important;object-fit:contain}.match-scroll-hint{position:static!important;margin:6px auto 0}}
@media (orientation:landscape) and (max-height:500px){body{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}.spd-row{position:relative;z-index:4}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
@media (forced-colors:active){button,.btn,[role="button"]{border:1px solid ButtonText!important}#fieldcv{border:1px solid CanvasText}:focus-visible{outline:3px solid Highlight!important;outline-offset:2px}}
.audit650-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
</style>
<script id="audit650-fixpack-runtime">
(function(){'use strict';window.__CDS_ACTIONS=window.__CDS_ACTIONS||Object.create(null);
const nameOf=p=>p&&((p.ref&&p.ref.n)||p.n||p.name);const classify=e=>{const t=String(e&&e.type||'').toLowerCase();if(/header|head/.test(t))return'header';if(/tackle|slide/.test(t))return'tackle';if(/punch/.test(t))return'punch';if(/parry/.test(t))return'parry';if(/save|claim|catch/.test(t))return'claim';if(/shot|goal|penalty|free.?kick/.test(t))return'shoot';return null;};
window.__cdsVisualEvent=function(e){const type=classify(e);if(!type)return;[e.by,e.player,e.shooter,e.gk,e.keeper,e.winner].filter(Boolean).forEach(p=>{const k=nameOf(p);if(k)window.__CDS_ACTIONS[k]={type,until:performance.now()+720};});};
function installA11y(){let live=document.getElementById('match-live-feed');if(!live){live=document.createElement('div');live.id='match-live-feed';live.className='audit650-sr';live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');document.body.appendChild(live);}const cv=document.getElementById('fieldcv');if(cv){cv.setAttribute('role','img');cv.setAttribute('tabindex','0');cv.setAttribute('aria-label','Partida em campo 2.5D. Os acontecimentos importantes são anunciados no texto ao vivo.');}const narr=document.getElementById('narr');if(narr){const txt=(narr.textContent||'').replace(/\s+/g,' ').trim();if(txt&&live.textContent!==txt)live.textContent=txt;}document.querySelectorAll('button:not([aria-label])').forEach(b=>{const txt=(b.textContent||b.title||'').replace(/\s+/g,' ').trim();if(txt)b.setAttribute('aria-label',txt);});}
const observer=new MutationObserver(installA11y);window.addEventListener('DOMContentLoaded',()=>{installA11y();observer.observe(document.body,{subtree:true,childList:true,characterData:true});});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&document.activeElement&&document.activeElement.getAttribute('role')==='button'){e.preventDefault();document.activeElement.click();}if(e.key==='Escape'){const close=document.querySelector('[aria-modal="true"] [data-close],.modal.on .close,.dialog.on .close');if(close)close.click();}});window.addEventListener('pagehide',()=>{if(window.CDS_F25D&&window.CDS_F25D.reset)window.CDS_F25D.reset();});})();
</script>
'''
    text = replace_one(text, '</body>', runtime + '\n</body>', 'A11Y-MOBILE-UX-runtime')
    text = replace_one(text, '<title>Copa dos Sonhos — Núcleo Autoritativo Transacional R12.3</title>', '<title>Copa dos Sonhos — RC-UX 2.5D Audit650 Fixpack</title>', 'INT-P0-release-identity')

    after = digest(text)
    TARGET.write_text(text, encoding='utf-8')
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps({'fixpack': MARKER, 'generatedOn': datetime.now(timezone.utc).isoformat(), 'target': str(TARGET), 'beforeSha256': before, 'afterSha256': after, 'logicalBaselineChanged': False, 'scope': 'visual projection, athlete rendering, set-piece stage, UX/mobile/a11y safeguards', 'appliedControls': applied, 'remainingMandatoryEvidence': ['876 matches + 25 directed scenarios + 13 smoke checks on final hash', 'physical iOS/Android devices', 'blind human perceptual review', 'long-session memory/frame-time traces']}, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({'before': before, 'after': after, 'patches': len(applied)}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f'AUDIT650 FIXPACK V2 FAILED: {exc}', file=sys.stderr)
        raise
