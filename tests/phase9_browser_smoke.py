#!/usr/bin/env python3
from pathlib import Path
import asyncio,json
ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT/'dist/COPA DOS SONHOS - FASE 9 - IA DO TREINADOR - V5.2.0.html'
OUT=ROOT/'reports/phase9'
async def inspect(browser,width,height,label,simulate=False):
 errors=[];console=[]
 page=await browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:console.append((m.type,m.text)) if m.type=='error' else None)
 await page.set_content(HTML.read_text(encoding='utf-8'),wait_until='load',timeout=120000)
 await page.wait_for_timeout(700)
 state=await page.evaluate("""({simulate})=>{
   const db=buildDB(window.DATA);let match=null;
   if(simulate){
    const A=db.squads[312],B=db.squads[288],la=autoLineup(A,'4-3-3',0),lb=autoLineup(B,'4-3-3',0);
    const team=(s,l)=>({squad:structuredClone(s),name:s.c,flag:s.f||'',color:'#fff',lineup:l.lineup,bench:l.bench,style:'balanced',axes:{...STYLE_AXES.balanced},atkForm:'4-3-3',defForm:'4-3-3',varIdx:0});
    srand(520100);const sim=new MatchSim(team(A,la),team(B,lb),{neutral:true,labMode:true});sim.setInteractive(0);
    let steps=0;while(!sim.isOver()&&steps++<500000)sim.step(1/60);
    const d=sim.getManagerData(1);match={over:sim.isOver(),steps,score:sim.score,version:d&&d.version,finite:sim.teams.flatMap(t=>t.players).every(p=>[p.x,p.y,p.stamina,p.rating].every(Number.isFinite)),manager:d};
   }
   const de=document.documentElement,b=document.body;
   return {title:document.title,phase9:window.CDS_PHASE9&&window.CDS_PHASE9.VERSION,phase8:window.CDS_PHASE8&&window.CDS_PHASE8.VERSION,phase47:window.CDS_PHASES_4_7&&window.CDS_PHASES_4_7.VERSION,app:!!document.querySelector('#app'),managerButton:!!document.querySelector('#p9btn'),viewport:innerWidth,bodyWidth:b.scrollWidth,documentWidth:de.scrollWidth,overflow:Math.max(b.scrollWidth,de.scrollWidth)-innerWidth,players:db.squads.reduce((n,s)=>n+s.pl.length,0),match};
 }""",{'simulate':simulate})
 await page.screenshot(path=str(OUT/f'phase9-smoke-{label}.png'),full_page=False)
 await page.close();return {'label':label,'errors':errors,'console':console,'state':state}
async def main():
 from playwright.async_api import async_playwright
 OUT.mkdir(parents=True,exist_ok=True)
 async with async_playwright() as p:
  exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
  b=await p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
  results=[await inspect(b,1366,768,'desktop',True),await inspect(b,390,844,'mobile-vertical'),await inspect(b,844,390,'mobile-horizontal')]
  await b.close()
 for r in results:
  if r['errors'] or r['console']:raise SystemExit(json.dumps(results,ensure_ascii=False,indent=2))
  s=r['state'];assert s['phase9']=='5.2.0' and s['phase8']=='5.1.0' and s['phase47']=='5.0.0' and s['app'] and s['managerButton'] and s['players']==7739,s
  assert s['overflow']<=1,s
 m=results[0]['state']['match'];assert m and m['over'] and m['finite'] and m['version']=='5.2.0' and m['manager']['metrics']['preMatchPlans']==1,m
 (OUT/'phase9-browser-smoke.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'ok':True,'viewports':[r['state'] for r in results]},ensure_ascii=False,indent=2))
if __name__=='__main__':asyncio.run(main())
