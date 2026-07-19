#!/usr/bin/env python3
from pathlib import Path
import json,hashlib,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[1];m=json.loads((ROOT/'manifests/build-manifest.json').read_text(encoding='utf-8'))
base=ROOT/'reference'/m['baseline_file'];out=ROOT/m['build_output'];subprocess.run(['python3',str(ROOT/'tools/build.py')],check=True)
bh=hashlib.sha256(base.read_bytes()).hexdigest();oh=hashlib.sha256(out.read_bytes()).hexdigest()
if bh!=m['baseline_sha256']:raise SystemExit('ERRO: baseline alterado')
if oh!=bh:raise SystemExit(f'ERRO: build divergiu\nbaseline={bh}\nbuild={oh}')
h=out.read_text(encoding='utf-8');a=h.find('<script>',h.find('<body'))+8;b=h.find('</script>',a)
with tempfile.NamedTemporaryFile('w',suffix='.js',encoding='utf-8',delete=False) as f:f.write(h[a:b]);jp=f.name
subprocess.run(['node','--check',jp],check=True);print('OK: byte-equivalente');print('OK: JavaScript válido')
