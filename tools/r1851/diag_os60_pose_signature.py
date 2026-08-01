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
  r=await pg.evaluate("""() => {
    const F=window.CDS_F25D; if(!F||!F.body) return 'sem body';
    const estados=['run','carry','body_feint','inside_cut','outside_cut','burst_touch','turn_dribble','header','block','gk_low_dive'];
    const fases=[0.2,0.5,0.8];
    const out={};
    for(const st of estados){
      const assinaturas=[];
      for(const ph of fases){
        const cv=document.createElement('canvas');cv.width=90;cv.height=90;
        const c=cv.getContext('2d');
        window.__CDS_ANIM_BY_KEY = {}; window.__CDS_ANIM_BY_KEY['TESTE_'+st+'_'+ph] = { state: st, phase: ph };
        // simula deslocamento para a passada existir
        for(let i=0;i<6;i++){
          c.clearRect(0,0,90,90);
          F.body(c,{x:45+i*0.9,y:52,r:16,pc:'#e2342f',gkC:'#1b3fa8',isGK:st.indexOf('gk_')===0,
                    divePose:false,hasBall:true,key:'TESTE_'+st+'_'+ph,act:'',pose:'',wave:0});
        }
        const d=c.getImageData(0,0,90,90).data;
        let h=2166136261;
        for(let i=0;i<d.length;i+=4){ h^=(d[i]+d[i+1]*3+d[i+2]*7+d[i+3]*11); h=Math.imul(h,16777619); }
        assinaturas.push((h>>>0).toString(16));
      }
      out[st]=assinaturas;
    }
    window.__CDS_ANIM_BY_KEY=null;
    return out;
  }""")
  if isinstance(r,str): print(r); await b.close(); return
  vistos={}
  for st,ass in r.items():
    chave='|'.join(ass)
    vistos.setdefault(chave,[]).append(st)
    print('%-14s %s' % (st, ' '.join(ass)))
  print()
  dup=[v for v in vistos.values() if len(v)>1]
  print('estados com desenho IDENTICO:', dup if dup else 'nenhum')
  # varia dentro do proprio estado?
  print('estados que NAO mudam com a fase:', [st for st,a in r.items() if len(set(a))==1])
  await b.close()
asyncio.run(main())
