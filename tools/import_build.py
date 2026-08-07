#!/usr/bin/env python3
"""Importa um HTML monolitico do jogo para dentro de src/ como modulos.

Motivacao: as releases R18.5x/R19.x foram feitas empilhando <script> direto no
HTML entregue, entao o src/ do repositorio parou no R18.50 e o build deixou de
reproduzir o jogo real. Este importador traz o monolito de volta para o
controle de versao sem alterar uma virgula de comportamento.

O bloco do core (o <script> de ~1,2 MB) e reparticionado nos mesmos 9 modulos
que o repositorio ja usava, localizando o inicio de cada um pelo seu cabecalho.
Cada camada posterior vira um arquivo proprio em src/scripts/layers/.

Uso:  python3 tools/import_build.py <arquivo.html>
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import split_build as sb  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

# Ordem obrigatoria do core (contrato do manifests/architecture-map.json).
CORE_MODULES = [
    "00-polyfills.js",
    "10-data.js",
    "20-core.js",
    "25-data-integrity-v3.js",
    "30-tactics.js",
    "40-match-engine-and-manager-ai.js",
    "50-tournament.js",
    "60-ui-flow.js",
    "70-game-runtime-and-rendering.js",
]


def slug(block, index: int) -> str:
    if block.ident:
        name = re.sub(r"[^a-zA-Z0-9]+", "-", block.ident).strip("-").lower()
    else:
        name = "inline"
    return f"{index:02d}-{name}"


def core_offsets(core: str) -> list[int]:
    """Offsets de inicio de cada modulo do core, achados pelo cabecalho antigo."""
    offsets = []
    cursor = 0
    for module in CORE_MODULES:
        old = (ROOT / "src/scripts" / module).read_text(encoding="utf-8")
        probe = old[:150]
        found = core.find(probe, cursor)
        if found < 0:
            raise SystemExit(f"nao achei a fronteira de {module} no bloco do core")
        offsets.append(found)
        cursor = found + 1
    if offsets != sorted(offsets):
        raise SystemExit("fronteiras do core fora de ordem")
    return offsets


def main() -> None:
    source = Path(sys.argv[1])
    html = source.read_text(encoding="utf-8")
    if not sb.verify_roundtrip(html):
        raise SystemExit("round-trip do split falhou; abortado")

    template, blocks = sb.split(html)
    core_index = max(range(len(blocks)), key=lambda i: len(blocks[i].content) if blocks[i].kind == "script" else 0)

    manifest: dict = {
        "source_html": source.name,
        "source_sha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
        "build_output": "dist/index.html",
        "core_block_index": core_index,
        "core_modules": [],
        "blocks": [],
    }

    (ROOT / "src/scripts/layers").mkdir(parents=True, exist_ok=True)
    (ROOT / "src/styles/layers").mkdir(parents=True, exist_ok=True)

    for index, block in enumerate(blocks):
        if index == core_index:
            core = block.content
            offsets = core_offsets(core)
            bounds = offsets + [len(core)]
            for position, module in enumerate(CORE_MODULES):
                chunk = core[bounds[position]: bounds[position + 1]]
                path = ROOT / "src/scripts" / module
                path.write_text(chunk, encoding="utf-8")
                manifest["core_modules"].append(
                    {"file": f"src/scripts/{module}", "bytes": len(chunk.encode("utf-8"))}
                )
            manifest["blocks"].append({"index": index, "kind": "core", "assembled_from": "core_modules"})
            continue

        name = slug(block, index)
        if block.kind == "script":
            rel = f"src/scripts/layers/{name}.js"
        else:
            rel = f"src/styles/layers/{name}.css"
        (ROOT / rel).write_text(block.content, encoding="utf-8")
        manifest["blocks"].append(
            {"index": index, "kind": block.kind, "id": block.ident, "file": rel,
             "bytes": len(block.content.encode("utf-8"))}
        )

    (ROOT / "src/index.template.html").write_text(template, encoding="utf-8")
    (ROOT / "manifests/build-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"importado: {len(blocks)} blocos, core em #{core_index}")


if __name__ == "__main__":
    main()
