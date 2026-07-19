#!/usr/bin/env python3
from pathlib import Path
import json,hashlib,subprocess,tempfile,sys
ROOT=Path(__file__).resolve().parents[1]
m=json.loads((ROOT/'manifests/build-manifest.json').read_text(encoding='utf-8'))

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
# Integridade dos módulos
for entry in [m['head_script'],*m['styles'],*m['scripts']]:
 p=ROOT/entry['file']
 if not p.exists(): raise SystemExit(f'ERRO: módulo ausente: {entry["file"]}')
 if p.stat().st_size!=entry['bytes'] or sha(p)!=entry['sha256']:
  raise SystemExit(f'ERRO: manifesto desatualizado para {entry["file"]}')
# Build
subprocess.run(['python3',str(ROOT/'tools/build.py')],check=True)
out=ROOT/m['build_output']
# Sintaxe de cada módulo e bundle
for entry in m['scripts']:
 subprocess.run(['node','--check',str(ROOT/entry['file'])],check=True,stdout=subprocess.DEVNULL)
h=out.read_text(encoding='utf-8');a=h.find('<script>',h.find('<body'))+8;b=h.find('</script>',a)
with tempfile.NamedTemporaryFile('w',suffix='.js',encoding='utf-8',delete=False) as f:f.write(h[a:b]);jp=f.name
subprocess.run(['node','--check',jp],check=True,stdout=subprocess.DEVNULL)
# Auditoria estrutural e motor
subprocess.run(['node',str(ROOT/'tools/phase2_audit.js')],check=True)
subprocess.run(['node',str(ROOT/'tests/phase2_engine_smoke.js')],check=True)
print('OK: manifesto e módulos íntegros')
print('OK: build autocontido e JavaScript válido')
print('OK: banco V3 e 13.284 escalações validados')
print('OK: integração com o motor validada')
print('build_sha256:',sha(out))
