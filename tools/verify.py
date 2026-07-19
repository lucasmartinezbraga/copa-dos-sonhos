#!/usr/bin/env python3
from pathlib import Path
import json,hashlib,subprocess,tempfile,sys,os,shutil
NODE=os.environ.get('CDS_NODE') or shutil.which('node') or 'node'
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
subprocess.run([sys.executable,str(ROOT/'tools/build.py')],check=True)
out=ROOT/m['build_output']
# Sintaxe de cada módulo e bundle
for entry in m['scripts']:
 subprocess.run([NODE,'--check',str(ROOT/entry['file'])],check=True,stdout=subprocess.DEVNULL)
h=out.read_text(encoding='utf-8');a=h.find('<script>',h.find('<body'))+8;b=h.find('</script>',a)
with tempfile.NamedTemporaryFile('w',suffix='.js',encoding='utf-8',delete=False) as f:f.write(h[a:b]);jp=f.name
subprocess.run([NODE,'--check',jp],check=True,stdout=subprocess.DEVNULL)
# Auditoria estrutural e motor
subprocess.run([NODE,str(ROOT/'tools/phase2_audit.js')],check=True)
subprocess.run([NODE,str(ROOT/'tests/phase2_engine_smoke.js')],check=True)
if m.get('phase',0)>=3:
 report=ROOT/m['calibration_report']
 mass=ROOT/m['mass_regression_report']
 if not report.exists(): raise SystemExit(f'ERRO: relatório oficial ausente: {report}')
 if not mass.exists(): raise SystemExit(f'ERRO: regressão massiva ausente: {mass}')
 subprocess.run([NODE,str(ROOT/'tests/phase3_determinism.js')],check=True)
 subprocess.run([NODE,str(ROOT/'tests/phase3_fixed_step.js')],check=True)
 subprocess.run([NODE,str(ROOT/'tests/phase3_job_matrix.js')],check=True)
 subprocess.run([NODE,str(ROOT/'tests/phase3_regression_thresholds.js'),str(report)],check=True)
 subprocess.run([NODE,str(ROOT/'tests/phase3_mass_regression.js'),str(mass)],check=True)
 q=ROOT/m['qa_file']
 if not q.exists(): raise SystemExit(f'ERRO: QA da Fase 3 ausente: {q}')
 qa=json.loads(q.read_text(encoding='utf-8'))
 if not qa.get('complete'): raise SystemExit('ERRO: QA da Fase 3 não está concluído')
print('OK: manifesto e módulos íntegros')
print('OK: build autocontido e JavaScript válido')
print('OK: banco V3 e 13.284 escalações validados')
print('OK: integração com o motor validada')
if m.get('phase',0)>=3: print('OK: Fase 3, matriz oficial e regressão massiva validadas')
print('build_sha256:',sha(out))
