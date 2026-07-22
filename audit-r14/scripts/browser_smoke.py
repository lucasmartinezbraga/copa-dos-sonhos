#!/usr/bin/env python3
from common import *
import json, sys, shutil
try:
    from playwright.sync_api import sync_playwright
except Exception:
    print('Playwright ausente. Execute: pip install playwright'); sys.exit(3)
root,cfg=load_config(); candidate=(root/cfg['candidate']).resolve(); html=candidate.read_text(encoding='utf-8',errors='replace')
results=[]
with sync_playwright() as pw:
    launch_opts={'headless':True}
    system_chromium=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome') or shutil.which('msedge')
    if system_chromium: launch_opts['executable_path']=system_chromium
    browser=pw.chromium.launch(**launch_opts)
    for vp in cfg['viewports']:
        mobile=vp['name'].startswith('mobile')
        page=browser.new_page(viewport={'width':vp['width'],'height':vp['height']},is_mobile=mobile,has_touch=mobile)
        errors=[]; console=[]
        page.on('pageerror',lambda e,arr=errors: arr.append(str(e)))
        page.on('console',lambda m,arr=console: arr.append({'type':m.type,'text':m.text}) if m.type=='error' else None)
        page.set_content(html,wait_until='load',timeout=60000)
        page.wait_for_selector('#bt-start',timeout=30000)
        try: page.wait_for_function("typeof G!=='undefined' && !!G.db",timeout=30000)
        except Exception: pass
        boot=page.evaluate("typeof G!=='undefined' && !!G.db")
        dup_home=page.evaluate("Array.from(document.querySelectorAll('[id]')).map(e=>e.id).filter((v,i,a)=>a.indexOf(v)!==i)")
        page.locator('#bt-start').click(timeout=10000)
        page.wait_for_timeout(700)
        screen=page.evaluate("typeof G!=='undefined' ? G.screen : null")
        prep=page.get_by_text('Preparação',exact=True).count()>0
        dup_setup=page.evaluate("Array.from(document.querySelectorAll('[id]')).map(e=>e.id).filter((v,i,a)=>a.indexOf(v)!==i)")
        shot=root/'evidence'/f"smoke-{vp['name']}.png"; page.screenshot(path=str(shot),full_page=True)
        results.append({'viewport':vp,'boot_db':boot,'screen_after_start':screen,'preparacao_visible':prep,'duplicate_ids_home':dup_home,'duplicate_ids_setup':dup_setup,'page_errors':errors,'console_errors':console,'pass':boot and screen=='setup' and prep and not dup_home and not dup_setup and not errors and not console})
        page.close()
    browser.close()
obj={'candidate_sha256':sha256(candidate),'executed_at':utcnow(),'mode':'page.set_content (HTML autocontido)','results':results,'pass':all(r['pass'] for r in results)}
write_json(root/'evidence'/'browser-smoke.json',obj); print(json.dumps(obj,ensure_ascii=False,indent=2)); sys.exit(0 if obj['pass'] else 2)
