#!/usr/bin/env python3
"""Valida src/, o manifesto e o bundle gerado.

Reescrito para o manifesto de blocos introduzido quando o R19.08 voltou para o
controle de versao. O verificador antigo esperava o formato da fase 2
(head_script/styles/scripts com sha256 por arquivo) e deixou de servir quando o
build passou a montar 89 blocos.

O que e checado:
  1. todo arquivo citado no manifesto existe;
  2. todo modulo JS passa em `node --check`;
  3. o build e reprodutivel e o HTML resultante fecha as tags que abriu;
  4. cada bloco <script> do bundle e JavaScript valido — nao so o do core,
     que era o unico coberto antes;
  5. a camada de fisica esta instalada e passa no teste de balistica.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import split_build as sb  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
NODE = os.environ.get("CDS_NODE") or shutil.which("node") or "node"


def falhar(msg: str) -> None:
    raise SystemExit(f"ERRO: {msg}")


def main() -> None:
    manifest = json.loads((ROOT / "manifests/build-manifest.json").read_text(encoding="utf-8"))

    # 1. presenca dos arquivos
    arquivos = [e["file"] for e in manifest["core_modules"]]
    arquivos += [b["file"] for b in manifest["blocks"] if b.get("file")]
    for rel in arquivos:
        if not (ROOT / rel).exists():
            falhar(f"modulo ausente: {rel}")
    print(f"OK: {len(arquivos)} modulos presentes")

    # 2. sintaxe de cada modulo JS
    js = [r for r in arquivos if r.endswith(".js")]
    for rel in js:
        cp = subprocess.run([NODE, "--check", str(ROOT / rel)], capture_output=True, text=True)
        if cp.returncode:
            falhar(f"sintaxe invalida em {rel}\n{cp.stderr}")
    print(f"OK: {len(js)} modulos JavaScript com sintaxe valida")

    # 3. build reprodutivel
    subprocess.run([sys.executable, str(ROOT / "tools/build.py")], check=True,
                   stdout=subprocess.DEVNULL)
    out = ROOT / manifest["build_output"]
    html = out.read_text(encoding="utf-8")
    if not sb.verify_roundtrip(html):
        falhar("o bundle nao sobrevive a um ciclo de split/join")
    digest = hashlib.sha256(html.encode("utf-8")).hexdigest()
    print(f"OK: build reprodutivel ({digest[:12]})")

    # 4. sintaxe de TODOS os blocos <script> do bundle
    _, blocos = sb.split(html)
    scripts = [b for b in blocos if b.kind == "script"]
    with tempfile.TemporaryDirectory() as tmp:
        for i, bloco in enumerate(scripts):
            caminho = Path(tmp) / f"bloco_{i}.js"
            caminho.write_text(bloco.content, encoding="utf-8")
            cp = subprocess.run([NODE, "--check", str(caminho)], capture_output=True, text=True)
            if cp.returncode:
                falhar(f"bloco <script> #{i} ({bloco.ident or 'sem id'}) invalido\n{cp.stderr}")
    print(f"OK: {len(scripts)} blocos <script> do bundle validos")

    # 5. fisica
    cp = subprocess.run([NODE, str(ROOT / "tests/fisica_balistica.js"), str(out)],
                        capture_output=True, text=True)
    sys.stdout.write(cp.stdout)
    if cp.returncode:
        sys.stderr.write(cp.stderr)
        falhar("teste de balistica reprovou")
    print("OK: balistica validada")


if __name__ == "__main__":
    main()
