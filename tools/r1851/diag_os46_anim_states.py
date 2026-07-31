from pathlib import Path
import asyncio, sys, json
HTML=Path(sys.argv[1])
async def main():
 from playwright.async_api import async_playwright
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,executable_path='/opt/pw-browsers/chromium',args=['--no-sandbox'])
  pg=await b.new_page()
  await pg.set_content(HTML.read_text(encoding='utf-8'),wait_until='load',timeout=180000)
  await pg.wait_for_timeout(1500)
  st=await pg.evaluate("""() => {
    const db=buildDB(window.DATA);
    const A=db.squads[0], B=db.squads[1]||db.squads[0];
    const mk=(sq,h)=>{const l=autoLineup(sq,'4-3-3',0);return{squad:sq,name:sq.c,flag:sq.f,color:h?'#2e9bff':'#ff3d7f',lineup:l.lineup,bench:l.bench,formKey:'4-3-3',style:'balanced'};};
    const conta={}, contaGK={}; let amostras=0, gkAm=0, quadros=0;
    for(let m=0;m<3;m++){
      srand(4200000+m*7919);
      const s=new MatchSim(mk(A,true),mk(B,false),{neutral:true});
      let g=0;
      while(!s.isOver()&&g++<400000){
        s.step(1/60);
        if(g%12)continue;
        quadros++;
        if(!s.__animState)continue;
        for(const tm of s.teams)for(const pl of tm.players){
          if(pl.red)continue;
          const a=s.animOf(pl); if(!a)continue;
          amostras++; conta[a.state]=(conta[a.state]||0)+1;
          if(pl.isGK){gkAm++; contaGK[a.state]=(contaGK[a.state]||0)+1;}
        }
      }
    }
    const top=(o,t)=>Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,+(v/t*100).toFixed(2)]);
    return {quadros,amostras,gkAm,estados:top(conta,amostras),gk:top(contaGK,gkAm||1)};
  }""")
  print('quadros amostrados',st['quadros'],'| amostras jogador',st['amostras'])
  print('ESTADOS:')
  for k,v in st['estados'][:22]: print('   %-24s %5.2f%%'%(k,v))
  print('GOLEIRO:')
  for k,v in st['gk'][:12]: print('   %-24s %5.2f%%'%(k,v))
  await b.close()
asyncio.run(main())
