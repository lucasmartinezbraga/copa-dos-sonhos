#!/usr/bin/env python3
from pathlib import Path
import asyncio,json
ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT/'dist/COPA DOS SONHOS - FASE 3 - MOTOR CALIBRADO.html'
async def main():
 from playwright.async_api import async_playwright
 errors=[];console=[]
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await b.new_page(viewport={'width':1366,'height':768})
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:console.append((m.type,m.text)) if m.type in ('error','warning') else None)
  await page.set_content(HTML.read_text(encoding='utf-8'),wait_until='load',timeout=120000)
  await page.wait_for_timeout(700)
  state=await page.evaluate("""() => {
    const db=buildDB(window.DATA), A=db.squads[0],B=db.squads[1];
    const la=autoLineup(A,'4-3-3',0),lb=autoLineup(B,'4-2-3-1',0);
    const team=(s,l,style)=>({squad:structuredClone(s),name:s.c,flag:s.f||'',color:'#fff',lineup:l.lineup,bench:l.bench,style,axes:{...STYLE_AXES[style]},atkForm:'4-3-3',defForm:'4-3-3',varIdx:0});
    srand(987654);
    const sim=new MatchSim(team(A,la,'balanced'),team(B,lb,'counter'),{neutral:true,labMode:true});sim.setInteractive(-1);
    let steps=0;while(!sim.isOver()&&steps++<50000)sim.step(ENGINE_CALIBRATION.timing.fixedStep);
    return {title:document.title,app:!!document.querySelector('#app'),schema:window.CDS_DATA_SCHEMA_VERSION,players:db.squads.reduce((n,s)=>n+s.pl.length,0),engine:ENGINE_CALIBRATION.version,fixedStep:ENGINE_CALIBRATION.timing.fixedStep,over:sim.isOver(),steps,score:sim.score,shots:sim.stats[0].shots+sim.stats[1].shots,fouls:sim.stats[0].fouls+sim.stats[1].fouls,coords:sim.teams.flatMap(t=>t.players).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=105&&p.y>=0&&p.y<=68)};
  }""")
  await b.close()
 if errors or console:raise SystemExit(json.dumps({'page_errors':errors,'console':console,'state':state},ensure_ascii=False,indent=2))
 assert state['app'] and state['schema']==3 and state['players']==7739,state
 assert state['engine']=='4.3.2' and abs(state['fixedStep']-1/60)<1e-12,state
 assert state['over'] and 20000<state['steps']<50000 and state['coords'],state
 print('OK:',json.dumps(state,ensure_ascii=False))
if __name__=='__main__':asyncio.run(main())
