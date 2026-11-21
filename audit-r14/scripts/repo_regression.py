#!/usr/bin/env python3
from common import *
import subprocess, sys, json, shlex
root,cfg=load_config(); repo=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root
commands=[]
import tempfile
# Os harnesses de node exigem <build> <saida.json>; sem argumentos eles abortam
# e a regressão reprovava por falta de integração, não por defeito do motor.
cand=(root/cfg['candidate']).resolve()
for label,key in [('verify_r13','verify_r13'),('scenarios','scenarios'),('static_smoke','static_smoke')]:
    p=repo/cfg['repo_tools'][key]
    if not p.exists(): continue
    if p.suffix=='.py':
        commands.append((label,['python',str(p)],repo))
    else:
        # test_r130_scenarios.js lê arquivos relativos: precisa rodar de tools/r13
        commands.append((label,['node',p.name,str(cand),tempfile.mktemp(suffix='.json')],p.parent))
results=[]
for label,cmd,cwd in commands:
    cp=subprocess.run(cmd,cwd=str(cwd),capture_output=True,text=True); results.append({'label':label,'command':cmd,'returncode':cp.returncode,'stdout':cp.stdout[-8000:],'stderr':cp.stderr[-8000:]})
obj={'executed_at':utcnow(),'repo':str(repo),'results':results,'pass':bool(results) and all(r['returncode']==0 for r in results)}
write_json(root/'evidence'/'repo-regression.json',obj); print(json.dumps(obj,ensure_ascii=False,indent=2)); sys.exit(0 if obj['pass'] else 2)
