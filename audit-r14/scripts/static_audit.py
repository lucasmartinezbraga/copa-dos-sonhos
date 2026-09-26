#!/usr/bin/env python3
from common import *
import re, subprocess, tempfile, json, sys
root,cfg=load_config(); p=root/cfg['candidate']; text=p.read_text(encoding='utf-8',errors='replace')
checks=[]
def add(name,ok,detail=''): checks.append({'name':name,'pass':bool(ok),'detail':detail})
add('doctype_primeira_linha', text.lstrip().lower().startswith('<!doctype html>'))
add('charset_utf8', bool(re.search(r'<meta[^>]+charset=["\']?utf-8',text,re.I)))
add('viewport_mobile', bool(re.search(r'<meta[^>]+name=["\']viewport',text,re.I)))
ids=re.findall(r'\bid=["\']([^"\']+)',text,re.I); dup=sorted({x for x in ids if ids.count(x)>1})
add('ids_repetidos_em_templates_revisar', True, ', '.join(dup[:20]) if dup else 'nenhum')
urls=re.findall(r'(?:src|href)=["\'](https?://[^"\']+)',text,re.I)
add('sem_dependencia_externa_obrigatoria', not urls, ', '.join(urls[:10]))
add('botao_inicio_existe', 'id="bt-start"' in text or "id='bt-start'" in text)
add('navegacao_setup_existe', "go('setup')" in text or 'go("setup")' in text)
add('motor_matchsim_existe', 'class MatchSim' in text or 'function MatchSim' in text)
add('probe_hooks_recomendados', 'ball.owner' in text and 'pendingRestart' in text)
# syntax check dos scripts inline
scripts=re.findall(r'<script[^>]*>([\s\S]*?)</script>',text,re.I); errors=[]
for i,code in enumerate(scripts):
    tf=tempfile.NamedTemporaryFile('w',suffix='.js',delete=False,encoding='utf-8'); tf.write(code); tf.close()
    try:
        cp=subprocess.run(['node','--check',tf.name],capture_output=True,text=True)
        if cp.returncode: errors.append({'index':i,'error':(cp.stderr or cp.stdout)[-1000:]})
    except FileNotFoundError:
        errors=[{'index':None,'error':'Node não encontrado; sintaxe não executada'}]; break
    finally:
        try: Path(tf.name).unlink()
        except: pass
add('scripts_inline_sintaxe', not errors, json.dumps(errors,ensure_ascii=False))
obj={'candidate_sha256':sha256(p),'executed_at':utcnow(),'checks':checks,'pass':all(c['pass'] for c in checks)}
write_json(root/'evidence'/'static-audit.json',obj); print(json.dumps(obj,ensure_ascii=False,indent=2)); sys.exit(0 if obj['pass'] else 2)
