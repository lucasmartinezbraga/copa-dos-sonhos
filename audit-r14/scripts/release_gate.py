#!/usr/bin/env python3
from common import *
import json, sys, glob
root,cfg=load_config(); matrix=json.load(open(root/cfg['matrix'],encoding='utf-8'))
status={i['id']:i.get('result','PENDENTE') for i in matrix['items']}
# resultados individuais sobrepõem a matriz
for p in root.glob('evidence/**/resultado.json'):
    try:
        o=json.load(open(p,encoding='utf-8')); rid=o.get('id'); res=o.get('result')
        if rid in status and res: status[rid]=res
    except Exception: pass
from collections import Counter,defaultdict
byprio=defaultdict(Counter)
for i in matrix['items']: byprio[i['priority']][status[i['id']]]+=1
def rate(pr):
    c=byprio[pr]; total=sum(c.values()); return c.get('PASS',0)/total if total else 0
reasons=[]
if any(k!='PASS' and v for k,v in byprio['P0'].items()): reasons.append('P0 não está 100% PASS')
if rate('P1')<0.98: reasons.append(f"P1 abaixo de 98% ({rate('P1'):.1%})")
if rate('P2')<0.95: reasons.append(f"P2 abaixo de 95% ({rate('P2'):.1%})")
for req in ['candidate-manifest.json','static-audit.json','browser-smoke.json','balllock-result.json','repo-regression.json']:
    if not (root/'evidence'/req).exists(): reasons.append(f'Evidência obrigatória ausente: {req}')
verdict='APROVADO' if not reasons else 'BLOQUEADO'
obj={'candidate_sha256':sha256(root/cfg['candidate']),'generated_at':utcnow(),'verdict':verdict,'reasons':reasons,'by_priority':{p:dict(c) for p,c in byprio.items()},'rates':{'P1':rate('P1'),'P2':rate('P2')}}
write_json(root/'evidence'/'release-summary.json',obj); print(json.dumps(obj,ensure_ascii=False,indent=2)); sys.exit(0 if verdict=='APROVADO' else 2)
