#!/usr/bin/env python3
"""FPS da partida AO VIVO (jogadores se movendo), medido em navegador real.

Abre a partida via window.GAME.open(), joga em 1x e mede o intervalo entre
quadros de requestAnimationFrame durante a movimentacao — que e o que a queixa
descreve. O perf probe antigo media as telas de menu, nao a partida.
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]

SETUP = r"""
() => { try {
  const sq=G.db.squads[0], lu=autoLineup(sq,'4-3-3',0);
  const picks=lu.lineup.map(s=>({p:s.p,from:sq.c}));
  const me=CUP.registerPlayerTeam(G.db,picks,(lu.bench||[]).map(p=>({p,from:sq.c})));
  G.lineup=lu.lineup.map((s,i)=>({p:me.pl[i],x:s.x,y:s.y,pos:s.pos,from:sq.c}));
  G.bench=me.pl.slice(11); G.formKey='4-3-3'; G.style='balanced';
  G.cup=CUP.createCup(G.db,'ME'); window.GAME.open._ready=true; window.GAME.open();
  G.speed=1.0; return {ok:true};
} catch(e){ return {ok:false,erro:String((e&&e.message)||e)}; } }
"""
MEASURE = r"""
(ms) => new Promise(res=>{
  const fr=[]; let last=performance.now(); const t0=last; let long=0; let po=null;
  try{ po=new PerformanceObserver(l=>{for(const e of l.getEntries())if(e.duration>50)long++;});
       po.observe({entryTypes:['longtask']}); }catch(_){}
  function tick(now){ fr.push(now-last); last=now;
    if(now-t0<ms) requestAnimationFrame(tick);
    else{ try{if(po)po.disconnect();}catch(_){}
      const s=fr.slice(1).sort((a,b)=>a-b);
      const q=p=>s.length?s[Math.min(s.length-1,Math.floor(s.length*p))]:0;
      res({frames:s.length, medianMs:+q(.5).toFixed(2), p95Ms:+q(.95).toFixed(2),
           maxMs:+(s[s.length-1]||0).toFixed(2),
           fpsMediano:s.length?+(1000/Math.max(q(.5),.001)).toFixed(1):0, longTasks:long}); }
  } requestAnimationFrame(tick);
})
"""

def main():
    a=sys.argv[1:]
    if not a: sys.exit("uso: browser_match_fps.py <build.html> [--secs N]")
    build=Path(a[0]); build=build if build.is_absolute() else ROOT/build
    secs=float(a[a.index("--secs")+1]) if "--secs" in a else 7.0
    with sync_playwright() as pw:
        br=pw.chromium.launch(); pg=br.new_page(viewport={"width":1024,"height":640})
        errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
        pg.goto(build.as_uri(),wait_until="load"); pg.wait_for_timeout(1200)
        s=pg.evaluate(SETUP)
        if not s.get("ok"):
            print(f"{build.name}: FALHA setup: {s.get('erro')}"); br.close(); return None
        pg.wait_for_timeout(1500)
        m=pg.evaluate(MEASURE, secs*1000)
        br.close()
    m["build"]=build.name; m["page_errors"]=errs[:5]
    print(f"{build.name[:46]:<48} fps {m['fpsMediano']:>6} | mediano {m['medianMs']:>6}ms | "
          f"p95 {m['p95Ms']:>6}ms | max {m['maxMs']:>7}ms | long {m['longTasks']}")
    if errs: print("   erros:", errs[:2])
    return m

if __name__=="__main__":
    r=main()
    if isinstance(r,dict):
        with (ROOT/"reports/r15/fps-live.json").open("a",encoding="utf-8") as f:
            f.write(json.dumps(r)+"\n")
