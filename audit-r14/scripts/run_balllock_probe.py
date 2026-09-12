#!/usr/bin/env python3
from common import *
import subprocess, sys, json, shlex
root,cfg=load_config(); repo=Path(sys.argv[1]).resolve() if len(sys.argv)>1 and sys.argv[1] != '--dry-run' else root
dry='--dry-run' in sys.argv
probe=repo/cfg['repo_tools']['balllock_probe']; csvp=repo/cfg['repo_tools']['golden_csv']; candidate=root/cfg['candidate']; out=root/'evidence'/'balllock-result.json'
cmd=['node',str(probe),f'--build={candidate}',f'--csv={csvp}','--start=0','--end=200',f'--out={out}']
print('COMANDO:', ' '.join(shlex.quote(x) for x in cmd))
if dry: sys.exit(0)
missing=[str(p) for p in [probe,csvp,candidate] if not p.exists()]
if missing: print('Arquivos ausentes:',*missing,sep='\n- '); sys.exit(4)
cp=subprocess.run(cmd,cwd=repo); sys.exit(cp.returncode)
