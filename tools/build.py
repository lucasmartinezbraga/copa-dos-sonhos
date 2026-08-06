#!/usr/bin/env python3
"""Remonta dist/index.html a partir de src/, guiado pelo build-manifest.

O core continua sendo a concatenacao dos 9 modulos na ordem obrigatoria; cada
camada posterior entra no seu proprio bloco, na posicao original do documento.

O manifesto de fase 2 (baseline 4.0) foi preservado em
manifests/phase2-build-manifest.json — ele descreve outro artefato e nao e mais
o alvo do build.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import split_build as sb  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


def assemble() -> str:
    manifest = json.loads((ROOT / "manifests/build-manifest.json").read_text(encoding="utf-8"))
    template = (ROOT / "src/index.template.html").read_text(encoding="utf-8")

    core = "".join(
        (ROOT / entry["file"]).read_text(encoding="utf-8") for entry in manifest["core_modules"]
    )

    contents: list[str] = []
    for block in manifest["blocks"]:
        if block["kind"] == "core":
            contents.append(core)
        else:
            contents.append((ROOT / block["file"]).read_text(encoding="utf-8"))
    return sb.join(template, contents)


def main() -> None:
    manifest = json.loads((ROOT / "manifests/build-manifest.json").read_text(encoding="utf-8"))
    out = ROOT / manifest["build_output"]
    html = assemble()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    digest = hashlib.sha256(html.encode("utf-8")).hexdigest()
    print(out)
    print("sha256:", digest)
    if digest == manifest.get("source_sha256"):
        print("identico ao HTML importado")


if __name__ == "__main__":
    main()
