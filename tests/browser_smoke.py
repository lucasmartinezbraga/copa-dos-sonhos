#!/usr/bin/env python3
from pathlib import Path
import asyncio
ROOT=Path(__file__).resolve().parents[1];HTML=ROOT/'dist/COPA DOS SONHOS - FASE 1 - ARQUITETURA MODULAR.html'
async def main():
 from playwright.async_api import async_playwright
 errors=[];console=[]
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=await b.new_page(viewport={'width':1366,'height':768})
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:console.append((m.type,m.text)) if m.type in ('error','warning') else None)
  await page.set_content(HTML.read_text(encoding='utf-8'),wait_until='load',timeout=120000);await page.wait_for_timeout(1200)
  state=await page.evaluate("""() => ({title:document.title,app:!!document.querySelector('#app'),appText:(document.querySelector('#app')?.innerText||'').length,data:!!window.DATA,match:typeof window.MatchSim,cup:!!window.CUP,ui:!!window.UI,gameState:!!window.G})""");await b.close()
 if errors or console:raise SystemExit(str({'page_errors':errors,'console':console,'state':state}))
 assert state['app'] and state['appText']>10 and state['data'] and state['match']=='function' and state['cup'] and state['ui'] and state['gameState'],state
 print('OK: smoke browser',state)
if __name__=='__main__':asyncio.run(main())
