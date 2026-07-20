#!/usr/bin/env python3
from pathlib import Path
import asyncio, json
ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'dist/COPA DOS SONHOS - FASE 10 - PERSISTENCIA DA COPA - V5.3.0.html'
OUT = ROOT / 'reports/phase10'

async def inspect(browser, width, height, label):
    errors=[]; console=[]
    page=await browser.new_page(viewport={'width':width,'height':height}, device_scale_factor=1)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: console.append((m.type,m.text)) if m.type=='error' else None)
    await page.evaluate("""()=>{const mem={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v)},removeItem:k=>{delete mem[k]},clear:()=>{for(const k of Object.keys(mem))delete mem[k]}}})}""")
    await page.set_content(HTML.read_text(encoding='utf-8'), wait_until='load', timeout=120000)
    await page.wait_for_timeout(900)
    setup=await page.evaluate("""()=>{
      const db=buildDB(window.DATA);
      const sq=db.squads.find(s=>s.pl&&s.pl.length>=18);
      const auto=autoLineup(sq,'4-3-3',0);
      const starters=auto.lineup.filter(x=>x.p).slice(0,11).map(x=>({p:x.p,from:sq}));
      const bench=(auto.bench||[]).slice(0,7).map(p=>({p,from:sq}));
      const me=CUP.registerPlayerTeam(db,starters,bench);
      G.db=db; G.modo='almanaque'; G.style='balanced'; G.axes={...STYLE_AXES.balanced};
      G.formKey='4-3-3'; G.varIdx=0;
      G.lineup=auto.lineup.filter(x=>x.p).slice(0,11).map((x,i)=>({p:me.pl[i],x:x.x,y:x.y,pos:x.pos,from:sq}));
      G.bench=me.pl.slice(11);
      G.draft={slots:G.lineup.map(x=>({...x})),benchPicks:bench};
      G.cup=CUP.createCup(db,'ME',530010);
      UI.go('cup');
      return {players:db.squads.reduce((n,s)=>n+s.pl.length,0),phase10:CDS_PHASE10.ENGINE_VERSION,saveVersion:CDS_SAVE_CONTRACT.SAVE_VERSION};
    }""")
    await page.wait_for_timeout(300)
    before=await page.evaluate("""()=>({
      prep:!!document.querySelector('.phase10-prep'),
      options:document.querySelectorAll('[data-prep]').length,
      disabled:!!document.querySelector('#bt-play')?.disabled,
      overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,
      title:document.title,
      bodyText:document.body.innerText.includes('Preparação para a próxima partida')
    })""")
    await page.screenshot(path=str(OUT/f'phase10-preparation-{label}.png'), full_page=True)
    await page.click('[data-prep="recovery"]')
    await page.wait_for_timeout(250)
    after=await page.evaluate("""()=>({
      prep:!!document.querySelector('.phase10-prep'),
      enabled:!document.querySelector('#bt-play')?.disabled,
      last:G.cup.persistence.teams.ME.lastPreparation,
      pending:G.cup.persistence.teams.ME.pendingPreparation,
      saved:(()=>{const raw=localStorage.getItem('copa_save');const s=raw&&CDS_SAVE_CONTRACT.decodeSave(raw);return s?{v:s.v,engine:s.engineVersion,prep:s.preparationSelection,hasPhase10:!!s.phase10}:null})(),
      overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth
    })""")
    await page.click('[data-t="time"]')
    await page.wait_for_timeout(150)
    squad=await page.evaluate("""()=>({
      hasCondition:/\\d+% condição/.test(document.body.innerText),
      rows:document.querySelectorAll('.row').length,
      overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth
    })""")
    await page.screenshot(path=str(OUT/f'phase10-squad-{label}.png'), full_page=True)
    await page.close()
    return {'label':label,'errors':errors,'console':console,'setup':setup,'before':before,'after':after,'squad':squad}

async def main():
    from playwright.async_api import async_playwright
    OUT.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as p:
        exe='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
        browser=await p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
        results=[
          await inspect(browser,1366,768,'desktop'),
          await inspect(browser,390,844,'mobile-vertical'),
          await inspect(browser,844,390,'mobile-horizontal')
        ]
        await browser.close()
    for r in results:
        assert not r['errors'] and not r['console'], r
        assert r['setup']['players']==7739 and r['setup']['phase10']=='5.3.0' and r['setup']['saveVersion']==3, r
        assert r['before']['prep'] and r['before']['options']==5 and r['before']['disabled'], r
        assert not r['after']['prep'] and r['after']['enabled'] and r['after']['last']=='recovery' and not r['after']['pending'], r
        assert r['after']['saved'] and r['after']['saved']['v']==3 and r['after']['saved']['engine']=='5.3.0' and r['after']['saved']['prep']=='recovery' and r['after']['saved']['hasPhase10'], r
        assert r['squad']['hasCondition'] and r['squad']['rows']>=11, r
        assert r['before']['overflow']<=1 and r['after']['overflow']<=1 and r['squad']['overflow']<=1, r
    (OUT/'phase10-browser-smoke.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'ok':True,'results':results},ensure_ascii=False,indent=2))

if __name__=='__main__': asyncio.run(main())
