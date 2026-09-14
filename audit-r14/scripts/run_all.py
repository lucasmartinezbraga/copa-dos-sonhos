#!/usr/bin/env python3
from pathlib import Path
import subprocess, sys
here=Path(__file__).resolve().parent
steps=[['python',str(here/'collect_manifest.py')],['python',str(here/'static_audit.py')],['python',str(here/'init_evidence.py')],['python',str(here/'browser_smoke.py')]]
failed=[]
for cmd in steps:
    print('\n===',cmd[-1],'==='); cp=subprocess.run(cmd);
    if cp.returncode: failed.append((cmd[-1],cp.returncode))
print('\nEtapas automáticas iniciais concluídas. Falhas:',failed or 'nenhuma')
print('Agora execute run_balllock_probe.py e repo_regression.py dentro do repositório, preencha os controles humanos/mobile e rode release_gate.py.')
sys.exit(2 if failed else 0)
