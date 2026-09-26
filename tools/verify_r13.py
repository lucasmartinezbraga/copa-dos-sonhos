#!/usr/bin/env python3
"""
Verificador da candidata modular R13.0.

Gate V-1: prova que a árvore src/r13/ é fonte de verdade da R13.0.
  1. integridade do manifesto (bytes + sha de cada módulo);
  2. rebuild modular byte-idêntico ao artefato autoritativo (SHA-256);
  3. sintaxe de cada módulo de script (node --check);
  4. smoke estático 13/13 e 25 cenários dirigidos sobre o build.

Falha com código != 0 em qualquer divergência. Não substitui a auditoria
visual nem a regressão completa de matrizes (essas rodam no Gate Final).
"""
import json, hashlib, subprocess, sys, os, shutil, tempfile
from pathlib import Path

NODE = os.environ.get("CDS_NODE") or shutil.which("node") or "node"
ROOT = Path(__file__).resolve().parents[1]
MAN = json.loads((ROOT / "manifests/r13-build-manifest.json").read_text(encoding="utf-8"))
HARNESS = ROOT / "tools/r13"

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def fail(msg): raise SystemExit(f"ERRO: {msg}")

# 1. integridade do manifesto
for b in MAN["blocks"]:
    p = ROOT / b["module"]
    if not p.exists():
        fail(f"módulo ausente: {b['module']}")
    if p.stat().st_size != b["bytes"] or sha(p) != b["sha256"]:
        fail(f"manifesto desatualizado para {b['module']} "
             f"(edite e rode extract, ou atualize o manifesto conscientemente)")
print(f"OK: {len(MAN['blocks'])} módulos íntegros vs manifesto")

# 2. rebuild byte-idêntico
r = subprocess.run([sys.executable, str(ROOT / "tools/build_r13.py")],
                   capture_output=True, text=True)
sys.stdout.write(r.stdout)
if r.returncode != 0:
    fail("build_r13.py divergiu do alvo autoritativo (não byte-idêntico)")
out = ROOT / MAN["target_output"]
if sha(out) != MAN["target_sha256"]:
    fail("SHA do build != alvo")
print("OK: rebuild modular byte-idêntico à R13.0 autoritativa")

# 3. sintaxe de cada módulo de script
for b in MAN["blocks"]:
    if b["kind"] != "script":
        continue
    c = subprocess.run([NODE, "--check", str(ROOT / b["module"])],
                       capture_output=True, text=True)
    if c.returncode != 0:
        fail(f"sintaxe inválida em {b['module']}:\n{c.stderr}")
print("OK: sintaxe de todos os módulos de script")

# 4. harness estático + cenários
smoke_out = tempfile.mktemp(suffix=".json")
c = subprocess.run([NODE, str(HARNESS / "static_smoke_r130.js"), str(out), smoke_out],
                   capture_output=True, text=True)
if c.returncode != 0:
    fail(f"smoke falhou:\n{c.stderr}")
sd = json.loads(Path(smoke_out).read_text())
if sd.get("status") != "PASS" or sd["passed"] != sd["total"]:
    fail(f"smoke {sd['passed']}/{sd['total']}")
print(f"OK: smoke estático {sd['passed']}/{sd['total']}")

cen_out = tempfile.mktemp(suffix=".json")
c = subprocess.run([NODE, "test_r130_scenarios.js", str(out), cen_out],
                   cwd=str(HARNESS), capture_output=True, text=True)
if c.returncode != 0:
    fail(f"cenários falharam:\n{c.stderr}")
cd = json.loads(Path(cen_out).read_text())
if cd["passed"] != cd["total"]:
    fail(f"cenários {cd['passed']}/{cd['total']}")
print(f"OK: cenários dirigidos {cd['passed']}/{cd['total']}")

print(f"\nbuild_sha256: {sha(out)}")
print("VERIFY R13 MODULAR: OK")
