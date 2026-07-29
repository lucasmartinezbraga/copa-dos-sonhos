#!/usr/bin/env python3
from pathlib import Path
import asyncio, json, os, glob
ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT/'dist/COPA DOS SONHOS - FASE 2 - BANCO V3 VALIDADO.html'
def chromium_path():
 """O caminho do Chromium varia por máquina (CI, container, desktop). Antes
 estava fixo em /usr/bin/chromium e o teste simplesmente não rodava onde o
 binário mora em outro lugar."""
 env=os.environ.get('CDS_CHROMIUM')
 if env: return env
 for c in ['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome']:
  if os.path.exists(c): return c
 for pat in ['/opt/pw-browsers/chromium-*/chrome-linux/chrome',
             '/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell']:
  hit=sorted(glob.glob(pat))
  if hit: return hit[-1]
 return None
async def main():
 from playwright.async_api import async_playwright
 errors=[];console=[]
 exe=chromium_path()
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,args=['--no-sandbox'],
                            **({'executable_path':exe} if exe else {}))
  page=await b.new_page(viewport={'width':1366,'height':768})
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:console.append((m.type,m.text)) if m.type in ('error','warning') else None)
  await page.set_content(HTML.read_text(encoding='utf-8'),wait_until='load',timeout=120000)
  await page.wait_for_timeout(1200)
  state=await page.evaluate("""() => {
    const db=buildDB(window.DATA);
    const quick=window.CDSDataV3.validateDatabase(db,false);
    const sample=db.squads.find(s=>s.sid===19)?.pl.find(p=>p.n.includes('Messi')) || db.squads[0].pl[0];
    const iran=db.squads.find(s=>s.sid===175);
    const russia=db.squads.find(s=>s.sid===272);
    const lineup=window.CDSDataV3.strictAutoLineup(db.squads[0],FORMATION_KEYS[0],0);
    return {
      title:document.title, app:!!document.querySelector('#app'), appText:(document.querySelector('#app')?.innerText||'').length,
      data:!!window.DATA, match:typeof window.MatchSim, cup:!!window.CUP, ui:!!window.UI, gameState:!!window.G,
      schema:window.CDS_DATA_SCHEMA_VERSION, auditOk:quick.ok, auditErrors:quick.errors.length,
      players:quick.players, sample:{name:sample.n,pos:sample.slot,attrCount:Object.keys(sample.attributesV3||{}).length,foot:sample.profileV3?.dominantFoot,traits:sample.behaviorTraits?.length},
      iranGK:iran?.pl.filter(p=>p.slot==='GK').map(p=>p.n), russiaGK:russia?.pl.filter(p=>p.slot==='GK').map(p=>p.n),
      lineupPlayers:lineup.lineup.filter(x=>x.p).length, lineupGK:lineup.lineup.filter(x=>x.p?.slot==='GK').length
    };
  }""")
  await b.close()
 if errors or console: raise SystemExit(json.dumps({'page_errors':errors,'console':console,'state':state},ensure_ascii=False,indent=2))
 assert state['app'] and state['appText']>10 and state['data'] and state['match']=='function' and state['cup'] and state['ui'] and state['gameState'],state
 assert state['schema']==3 and state['auditOk'] and state['auditErrors']==0 and state['players']==7739,state
 assert state['sample']['attrCount']>=40 and state['sample']['foot'] in ('L','R','B'),state
 assert state['lineupPlayers']==11 and state['lineupGK']==1,state
 assert state['iranGK'] and state['russiaGK'],state
 print('OK: smoke browser',json.dumps(state,ensure_ascii=False))
if __name__=='__main__': asyncio.run(main())
