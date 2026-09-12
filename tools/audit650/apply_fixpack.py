#!/usr/bin/env python3
# Apply the RC-UX audit-650 visual fixpack to the frozen self-contained HTML.
from __future__ import annotations
import hashlib, json, re, sys
from datetime import datetime, timezone
from pathlib import Path

TARGET = Path("dist/COPA DOS SONHOS - RC-UX.html")
REPORT = Path("reports/AUDITORIA-650-FIXPACK-RESULTADO.json")
EXPECTED_SHA256 = "a2f62022807a9b322bc64487bba5298c5c9f1b7cbf7255c9e140e9618c58f36c"
MARKER = "AUDIT650-RCUX-FIXPACK-1"
applied: list[str] = []

def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

def replace_once(text: str, old: str, new: str, control: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{control}: expected exactly one match, found {count}")
    applied.append(control)
    return text.replace(old, new, 1)

def regex_once(text: str, pattern: str, replacement: str, control: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{control}: expected exactly one regex match, found {count}")
    applied.append(control)
    return updated

def replace_bounded(text: str, old: str, new: str, control: str, minimum: int = 1, maximum: int = 20) -> str:
    count = text.count(old)
    if count < minimum or count > maximum:
        raise RuntimeError(f"{control}: expected {minimum}..{maximum} matches, found {count}")
    applied.append(f"{control} ({count} ocorrências)")
    return text.replace(old, new)

def main() -> int:
    original = TARGET.read_text(encoding="utf-8")
    before_sha = sha256_text(original)
    if MARKER in original:
        print(f"{MARKER}: already patched")
        return 0
    if before_sha != EXPECTED_SHA256:
        raise RuntimeError(f"candidate hash mismatch: expected={EXPECTED_SHA256} actual={before_sha}")
    text = original

    text = replace_once(text,
        "const G = { CW:1024, CH:500, M:12, R0:0.72, topY:46, bottomY:497, ready:false };",
        "const G = { CW:1024, CH:500, M:12, R0:0.72, topY:64, bottomY:497, ready:false };",
        "CAM-P0-A1-geometry-top-band")
    text = replace_once(text, "G.topY=M+34;", "G.topY=M+52;",
                        "CAM-P0-A1-reserve-stadium-sky-band")

    elevation_helper = r"""
  /* AUDIT650 P0-A1 — teto perceptivo de elevação.
     A física lógica (x/y/z) permanece intocada. Somente a projeção visual
     comprime a altura conforme profundidade e preserva a banda do estádio. */
  function elevatedY(p, z) {
    const height = Math.max(0, Number(z) || 0);
    const rawLift = height * 22 * p.s;
    const depth = clamp((p.y - G.topY) / Math.max(1, G.bottomY - G.topY), 0, 1);
    const maxLift = 30 + depth * 104;
    return Math.max(34, p.y - Math.min(rawLift, maxLift));
  }
  function resetVisualCaches() {
    dirCache.clear();
    if (root.__CDS_ACTIONS) Object.keys(root.__CDS_ACTIONS).forEach(k => delete root.__CDS_ACTIONS[k]);
  }

"""
    text = replace_once(text, "  const dirCache = new Map();",
                        elevation_helper + "  const dirCache = new Map();",
                        "CAM-P0-A1-elevation-projector")
    text = replace_once(text, "const bx = g0.x, by = g0.y - z * 22 * s;",
                        "const bx = g0.x, by = elevatedY(g0, z);",
                        "TRJ-P0-A1-ball-projection")
    text = replace_bounded(text, "p.y - z*22*p.s", "elevatedY(p, z)",
                           "TRJ-P0-A1-trail-projection", 1, 12)
    text = replace_once(text, "const aerial=!isShot && z>0.45;",
                        "const aerial=z>0.45;",
                        "TRJ-P1-shot-aerial-arc")

    new_body = r"""  function body(ctx, o) {
    const x=o.x, y=o.y, r=Math.max(4,o.r||7), key=String(o.key||'anon');
    const now=performance.now();
    const prev=dirCache.get(key)||{x,y,t:now,dx:0,dy:0,lastSeen:now};
    const dt=Math.max(8,now-prev.t), dx=x-prev.x, dy=y-prev.y;
    const pxSpeed=Math.hypot(dx,dy)/(dt/16.6667);
    const smoothDx=prev.dx*.62+dx*.38, smoothDy=prev.dy*.62+dy*.38;
    dirCache.set(key,{x,y,t:now,dx:smoothDx,dy:smoothDy,lastSeen:now});
    if(dirCache.size>192 && ((now|0)%47===0)){
      for(const [k,v] of dirCache) if(now-(v.lastSeen||0)>5000) dirCache.delete(k);
    }
    const eventPose=(root.__CDS_ACTIONS&&root.__CDS_ACTIONS[key])||null;
    if(eventPose&&eventPose.until<now) delete root.__CDS_ACTIONS[key];
    const eventType=eventPose&&eventPose.until>=now?eventPose.type:null;
    let pose=eventType||o.motionType||'';
    if(o.divePose) pose='dive';
    if(!pose) pose=pxSpeed>.10?'run':'idle';
    if(o.isGK&&pose==='jump') pose='claim';

    const facing=Math.abs(smoothDx)>.03?(smoothDx<0?-1:1):1;
    const cycle=(now*.014+key.length*.73)*(0.55+Math.min(1.5,pxSpeed)*.9);
    const stride=pose==='run'?Math.sin(cycle)*r*.42:0;
    const bob=pose==='run'?Math.abs(Math.cos(cycle))*r*.10:0;
    const lean=clamp(smoothDx*.16,-r*.20,r*.20);
    const actionWave=clamp(Number(o.actionWave)||0,0,1);

    ctx.save();ctx.translate(x,y-bob);
    if(pose==='dive')ctx.rotate(facing*(Math.PI*.34));
    else if(pose==='tackle')ctx.rotate(facing*(Math.PI*.16));

    ctx.save();ctx.translate(0,bob);ctx.scale(1,.34);
    ctx.fillStyle='rgba(0,0,0,.26)';ctx.beginPath();
    ctx.ellipse(0,r*.70,r*.70,r*.34,0,0,Math.PI*2);ctx.fill();ctx.restore();

    const hipY=r*.05, shoulderY=-r*.52, headY=-r*.88;
    let lFoot={x:-r*.20-stride,y:r*.70}, rFoot={x:r*.20+stride,y:r*.70};
    let lHand={x:-r*.48,y:-r*.12}, rHand={x:r*.48,y:-r*.12};
    if(pose==='shoot'){
      rFoot={x:facing*r*(.78+.20*actionWave),y:r*(.20-.20*actionWave)};
      lFoot={x:-facing*r*.20,y:r*.70};
      lHand={x:-facing*r*.58,y:-r*.28};rHand={x:facing*r*.40,y:-r*.04};
    }else if(pose==='header'||pose==='claim'){
      lHand={x:-r*.48,y:-r*(.78+.18*actionWave)};
      rHand={x:r*.48,y:-r*(.78+.18*actionWave)};lFoot.y=r*.58;rFoot.y=r*.58;
    }else if(pose==='punch'){
      lHand={x:-facing*r*.22,y:-r*.70};
      rHand={x:facing*r*(.82+.12*actionWave),y:-r*(.78+.10*actionWave)};
    }else if(pose==='parry'){
      lHand={x:-facing*r*.62,y:-r*.58};rHand={x:facing*r*.78,y:-r*.48};
    }else if(pose==='tackle'){
      lFoot={x:-facing*r*.22,y:r*.46};rFoot={x:facing*r*.88,y:r*.30};
      lHand={x:-facing*r*.55,y:-r*.05};rHand={x:facing*r*.46,y:r*.08};
    }else if(pose==='dive'){
      lHand={x:-r*.72,y:-r*.34};rHand={x:r*.82,y:-r*.42};
      lFoot={x:-r*.46,y:r*.42};rFoot={x:r*.58,y:r*.38};
    }else if(o.isGK&&pose==='idle'){
      lHand={x:-r*.58,y:-r*.02};rHand={x:r*.58,y:-r*.02};
      lFoot={x:-r*.32,y:r*.68};rFoot={x:r*.32,y:r*.68};
    }

    const limb=o.isGK?(o.gkC||'#ffd33d'):(o.pc||'#e8eef8');
    ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=Math.max(1.4,r*.22);ctx.strokeStyle=limb;
    function joint(a,b,c){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.stroke();}
    joint({x:-r*.17,y:hipY},{x:-r*.20+stride*.25,y:r*.35},lFoot);
    joint({x:r*.17,y:hipY},{x:r*.20-stride*.25,y:r*.35},rFoot);
    joint({x:-r*.28+lean*.2,y:shoulderY},{x:-r*.38,y:-r*.25},lHand);
    joint({x:r*.28+lean*.2,y:shoulderY},{x:r*.38,y:-r*.25},rHand);

    const shirt=o.isGK?(o.gkC||'#ffd33d'):(o.pc||'#e8eef8');
    const grad=ctx.createLinearGradient(-r,0,r,0);
    grad.addColorStop(0,'rgba(0,0,0,.18)');grad.addColorStop(.45,shirt);grad.addColorStop(1,'rgba(255,255,255,.16)');
    ctx.fillStyle=grad;ctx.beginPath();
    ctx.moveTo(-r*.34+lean*.15,shoulderY);ctx.lineTo(r*.34+lean*.15,shoulderY);
    ctx.lineTo(r*.25,hipY+r*.12);ctx.lineTo(-r*.25,hipY+r*.12);ctx.closePath();ctx.fill();
    ctx.fillStyle='#d7a77e';ctx.beginPath();ctx.arc(lean*.28,headY,r*.25,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.34)';ctx.lineWidth=Math.max(1,r*.08);ctx.stroke();
    if(o.hasBall){ctx.strokeStyle='rgba(255,219,88,.85)';ctx.lineWidth=Math.max(1,r*.10);
      ctx.beginPath();ctx.arc(0,0,r*.92,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }

  /* ── RASTRO"""
    text = regex_once(text, r"  function body\(ctx, o\) \{.*?\n  \}\n\n  /\* ── RASTRO",
                      new_body, "ATH-P0-B1-articulated-body", re.S)
    text = replace_once(text,
        "x, y, r, pc, gkC, isGK: p.slot==='GK', divePose, hasBall: !!p.hasBall, key: (p.ref&&p.ref.n)||p.n||('#'+(p.num||0))",
        "x, y, r, pc, gkC, isGK: p.slot==='GK', divePose, motionType:motion&&motion.type, actionWave, speed:G.speed, hasBall: !!p.hasBall, key: (p.ref&&p.ref.n)||p.n||('#'+(p.num||0))",
        "ATH-P0-B1-feed-motion-state")
    text = replace_once(text, "ctx.font = 'bold 10px system-ui,Arial';",
                        "ctx.font = `bold ${clamp(r*.78,7.2,11.8).toFixed(1)}px system-ui,Arial`;",
                        "ATH-P1-depth-number-scale")
    text = replace_once(text, "ctx.font = 'bold 7.5px system-ui,Arial';",
                        "ctx.font = `bold ${clamp(r*.58,6.2,9.3).toFixed(1)}px system-ui,Arial`;",
                        "ATH-P1-depth-label-scale")

    text = replace_bounded(text, "spPerspective", "spStage25D",
                           "CAM-P0-D1-remove-legacy-stage", 3, 30)
    new_stage = r"""function spStage25D(scene){
  const portrait=!!(window.matchMedia&&window.matchMedia('(max-width:700px) and (orientation:portrait)').matches);
  const dist=clamp(+(scene&&scene.dist)||((scene&&scene.mode==='shootout')?11:24),11,32);
  const penalty=dist<=12.5||(scene&&scene.mode==='shootout');
  /* AUDIT650 P0-D1 — falta e pênalti usam o mesmo palco 2.5D. */
  const horizon=portrait?218:198, depth=clamp((dist-11)/21,0,1);
  const goalW=portrait?(penalty?326:clamp(276-depth*54,214,276)):(penalty?584:clamp(500-depth*126,354,500));
  const goalH=goalW/3, goalY=clamp(horizon-goalH-(portrait?7:9),30,horizon-42);
  const goal={x:(CW-goalW)/2,y:goalY,w:goalW,h:goalH};
  const ballY=portrait?410:420, wallY=ballY-(portrait?105:124)*clamp(1+(dist-24)*.007,.94,1.06);
  const gkScale=goal.h*.77/47, wallScale=gkScale*clamp(1.24+(dist-18)*.017,1.24,1.50);
  return {stage:'CDS_F25D',portrait,dist,penalty,goal,ballY,horizon,wallY,gkScale,wallScale,
    takerScale:clamp(wallScale*1.06,portrait?2.02:2.9,portrait?3.0:4.15),
    ballR:portrait?7.4:10.6,targetBallR:clamp(goal.h*.044,3.2,6.8),vanishX:CW*.5};
}"""
    text = regex_once(text, r"function spStage25D\(scene\)\{.*?\n\}",
                      new_stage, "CAM-P0-D1-unified-25d-stage", re.S)

    if "const n=14;" in text:
        text = text.replace("const n=14;", "const n=(root.G&&root.G.speed>=3)?7:14;", 1)
        applied.append("VFX-P1-turbo-trail-density")

    text = replace_once(text,
        "root.CDS_F25D = Object.freeze({ version: '2.1.0', project, grass, pitch, body, trail, ball, traj });",
        "root.CDS_F25D = Object.freeze({ version: '2.2.0-audit650', project, elevatedY, grass, pitch, body, trail, ball, traj, reset:resetVisualCaches });",
        "INT-P0-export-auditable-25d-api")
    text = replace_once(text, "function onEvent(e) {\n  const __phys=physicalTag(e);",
                        "function onEvent(e) {\n  if(window.__cdsVisualEvent)window.__cdsVisualEvent(e);\n  const __phys=physicalTag(e);",
                        "ATH-P0-event-driven-poses")
    text = replace_once(text, "function renderDraft(keepList) {\n  const d = G.draft; if (!d) return;",
        "function renderDraft(keepList) {\n  const d = G.draft; if (!d) return;\n  const __missing=d.slots&&d.slots.filter(s=>!s.p)||[];\n  const __available=(d.cur&&d.cur.pl)||[];\n  const __canFinish=__missing.some(sl=>__available.some(p=>canPlay(p,sl.pos)));\n  if(filled()===10&&d.rerolls<=0&&!__canFinish&&!d.__emergencyRerollUsed){\n    d.__emergencyRerollUsed=true;d.rerolls=1;\n    setTimeout(()=>toast('Reroll de emergência liberado para completar o 11.'),0);\n  }",
        "UX-P1-G2-emergency-reroll")

    runtime = r"""
<!-- AUDIT650-RCUX-FIXPACK-1 -->
<style id="audit650-fixpack-css">
button,.btn,[role="button"],select,input[type="button"],input[type="submit"]{min-height:44px}
.field-wrap{min-height:0!important;margin-bottom:0!important}
.match-page,.match-shell,.screen{padding-bottom:max(12px,env(safe-area-inset-bottom))}
@media (min-width:1000px){.field-wrap{max-height:min(64vh,620px)}#fieldcv{display:block;width:100%;height:auto;max-height:min(64vh,620px)}}
@media (max-width:700px) and (orientation:portrait){.field-wrap{width:100%;overflow:hidden;aspect-ratio:1024/500;min-height:0!important}#fieldcv{width:100%!important;height:100%!important;object-fit:contain}.match-scroll-hint{position:static!important;margin:6px auto 0}}
@media (orientation:landscape) and (max-height:500px){body{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}.spd-row{position:relative;z-index:4}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
@media (forced-colors:active){button,.btn,[role="button"]{border:1px solid ButtonText!important}#fieldcv{border:1px solid CanvasText}:focus-visible{outline:3px solid Highlight!important;outline-offset:2px}}
.audit650-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
</style>
<script id="audit650-fixpack-runtime">
(function(){
  'use strict';
  window.__CDS_ACTIONS=window.__CDS_ACTIONS||Object.create(null);
  const nameOf=p=>p&&((p.ref&&p.ref.n)||p.n||p.name);
  const classify=e=>{const t=String(e&&e.type||'').toLowerCase();
    if(/header|head/.test(t))return'header';if(/tackle|slide/.test(t))return'tackle';
    if(/punch/.test(t))return'punch';if(/parry/.test(t))return'parry';
    if(/save|claim|catch/.test(t))return'claim';if(/shot|goal|penalty|free.?kick/.test(t))return'shoot';return null;};
  window.__cdsVisualEvent=function(e){const type=classify(e);if(!type)return;
    [e.by,e.player,e.shooter,e.gk,e.keeper,e.winner].filter(Boolean).forEach(p=>{const k=nameOf(p);if(k)window.__CDS_ACTIONS[k]={type,until:performance.now()+720};});};
  function installA11y(){
    let live=document.getElementById('match-live-feed');
    if(!live){live=document.createElement('div');live.id='match-live-feed';live.className='audit650-sr';
      live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');document.body.appendChild(live);}
    const cv=document.getElementById('fieldcv');if(cv){cv.setAttribute('role','img');cv.setAttribute('tabindex','0');
      cv.setAttribute('aria-label','Partida em campo 2.5D. Os acontecimentos importantes são anunciados no texto ao vivo.');}
    const narr=document.getElementById('narr');if(narr){const txt=(narr.textContent||'').replace(/\s+/g,' ').trim();if(txt&&live.textContent!==txt)live.textContent=txt;}
    document.querySelectorAll('button:not([aria-label])').forEach(b=>{const txt=(b.textContent||b.title||'').replace(/\s+/g,' ').trim();if(txt)b.setAttribute('aria-label',txt);});
  }
  const observer=new MutationObserver(installA11y);
  window.addEventListener('DOMContentLoaded',()=>{installA11y();observer.observe(document.body,{subtree:true,childList:true,characterData:true});});
  document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&document.activeElement&&document.activeElement.getAttribute('role')==='button'){e.preventDefault();document.activeElement.click();}
    if(e.key==='Escape'){const close=document.querySelector('[aria-modal="true"] [data-close],.modal.on .close,.dialog.on .close');if(close)close.click();}});
  window.addEventListener('pagehide',()=>{if(window.CDS_F25D&&window.CDS_F25D.reset)window.CDS_F25D.reset();});
})();
</script>
"""
    text = replace_once(text, "</body>", runtime + "\n</body>",
                        "A11Y-MOBILE-UX-runtime-fixpack")
    text = replace_once(text, "<title>Copa dos Sonhos — Núcleo Autoritativo Transacional R12.3</title>",
                        "<title>Copa dos Sonhos — RC-UX 2.5D Audit650 Fixpack</title>",
                        "INT-P0-release-identity")

    after_sha = sha256_text(text)
    TARGET.write_text(text, encoding="utf-8")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps({
        "fixpack": MARKER, "generatedOn": datetime.now(timezone.utc).isoformat(),
        "target": str(TARGET), "beforeSha256": before_sha, "afterSha256": after_sha,
        "logicalBaselineChanged": False,
        "scope": "visual projection, rendering, set-piece stage, UX/mobile/a11y safeguards",
        "appliedControls": applied,
        "remainingMandatoryEvidence": [
            "876 partidas + 25 cenários + 13 smoke na hash final",
            "dispositivos físicos iOS/Android",
            "observação humana cega dos gates perceptivos",
            "sessão longa e traces de memória/frame time"
        ]}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"before": before_sha, "after": after_sha, "patches": len(applied)}, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"AUDIT650 FIXPACK FAILED: {exc}", file=sys.stderr)
        raise
