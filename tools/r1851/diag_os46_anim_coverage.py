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
    const db=buildDB(window.DATA), A=db.squads[0], B=db.squads[1]||db.squads[0];
    const mk=(sq,h)=>{const l=autoLineup(sq,'4-3-3',0);return{squad:sq,name:sq.c,flag:sq.f,color:h?'#2e9bff':'#ff3d7f',lineup:l.lineup,bench:l.bench,formKey:'4-3-3',style:'balanced'};};
    const cats={chute:{n:0,ok:0},defesa:{n:0,ok:0},drible:{n:0,ok:0},cabeceio:{n:0,ok:0},bloqueio:{n:0,ok:0}};
    const RE={chute:/^shot_|^power_shot$|^placed_shot$|^volley$/,
              defesa:/^gk_(low_dive|high_dive|parry|catch|punch|foot_save|smother)$/,
              drible:/^(dribble_|body_feint|inside_cut|outside_cut|turn_dribble|burst_touch|carry)/,
              cabeceio:/^header$/, bloqueio:/^block$/};
    for(let m=0;m<3;m++){
      srand(4200000+m*7919);
      const s=new MatchSim(mk(A,true),mk(B,false),{neutral:true});
      const P=Object.getPrototypeOf(s);
      let pend=[];
      s._emit=function(t,d){
        const r=P._emit.apply(this,arguments);
        try{
          const alvo = t==='save'?['defesa',d&&d.gk]
                    : (t==='shot_taken')?['chute',d&&d.by]
                    : (t==='dribble')?['drible',d&&d.by]
                    : (t==='header_shot'||t==='header_clear')?['cabeceio',d&&d.by]
                    : (t==='blocked')?['bloqueio',d&&d.by] : null;
          if(alvo&&alvo[1]){cats[alvo[0]].n++;pend.push({cat:alvo[0],p:alvo[1],ate:this.t+0.8,hit:false});}
        }catch(_){}
        return r;
      };
      let g=0;
      while(!s.isOver()&&g++<400000){
        s.step(1/60);
        if(pend.length){
          for(const q of pend){
            if(q.hit||s.t>q.ate)continue;
            const a=s.animOf(q.p);
            if(a&&RE[q.cat].test(a.state)){q.hit=true;cats[q.cat].ok++;}
          }
          pend=pend.filter(q=>!q.hit&&s.t<=q.ate);
        }
      }
    }
    return cats;
  }""")
  for k,v in st.items():
    n=v['n'] or 1
    print('  %-10s eventos %5d | com pose propria %5d = %5.1f%%'%(k,v['n'],v['ok'],v['ok']/n*100))
  await b.close()
asyncio.run(main())
