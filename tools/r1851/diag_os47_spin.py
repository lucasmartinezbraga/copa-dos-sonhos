from pathlib import Path
import asyncio, sys, json
HTML=Path(sys.argv[1])
async def main():
 from playwright.async_api import async_playwright
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
  pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
  await pg.set_content(HTML.read_text(encoding='utf-8'),wait_until='load',timeout=180000)
  await pg.wait_for_timeout(1500)
  st=await pg.evaluate("""() => {
    const db=buildDB(window.DATA);
    const sq=db.squads.find(s=>s.c==='Brasil'&&Number(s.y)===1970)||db.squads[0];
    const mk=h=>{const l=autoLineup(sq,'4-3-3',0);return{squad:sq,name:sq.c,flag:sq.f,color:h?'#2e9bff':'#ff3d7f',lineup:l.lineup,bench:l.bench,formKey:'4-3-3',style:'balanced'};};
    const conta={}; let amostras=0, giros=0, moves={};
    for(let m=0;m<3;m++){
      srand(4200000+m*7919);
      const s=new MatchSim(mk(true),mk(false),{neutral:true});
      const P=Object.getPrototypeOf(s);
      s._emit=function(t,d){ if(t==='dribble'&&d&&d.flair&&d.move){moves[d.move]=(moves[d.move]||0)+1;} return P._emit.apply(this,arguments); };
      let g=0, vistoGiro=new Set();
      while(!s.isOver()&&g++<400000){
        s.step(1/60);
        if(g%6)continue;
        if(!s.__animState)continue;
        for(const tm of s.teams)for(const pl of tm.players){
          if(pl.red)continue; const a=s.animOf(pl); if(!a)continue;
          amostras++; conta[a.state]=(conta[a.state]||0)+1;
        }
      }
    }
    const top=Object.entries(conta).sort((x,y)=>y[1]-x[1]).map(([k,v])=>[k,+(v/amostras*100).toFixed(3)]);
    return {amostras, dribleStates: top.filter(([k])=>/dribble|cut|feint|turn|burst|carry|protect/.test(k)), moves};
  }""")
  print('amostras',st['amostras'])
  print('moves emitidos:',json.dumps(st['moves'],ensure_ascii=False))
  print('estados de drible:')
  for k,v in st['dribleStates']: print('   %-20s %6.3f%%'%(k,v))
  print('pageerror:',errs[:2])
  await b.close()
asyncio.run(main())
