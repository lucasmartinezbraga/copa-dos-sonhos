#!/usr/bin/env python3
"""
Gate V-1a — Extração fiel da R13.0 para módulos.

Fatia o HTML autoritativo R13.0 nos seus blocos reais (bootstrap, bundle de
estilo, bundle base do motor e as 11 camadas injetadas), grava cada bloco como
módulo em src/r13/, e produz um template + manifesto que o build_r13.py
reconcatena de volta em bytes IDÊNTICOS.

Não altera nenhum byte de comportamento: é um recorte determinístico. A prova é
o SHA-256 do rebuild bater com o do artefato autoritativo.
"""
import re, json, hashlib, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_HTML = ROOT / "dist/COPA DOS SONHOS - V5.9.3-R13.0 - FUTEBOL OBSERVAVEL E CADENCIADO.html"
TARGET_SHA = "363d9a915a732ae99a889dab05e7f01485d58b140d64e4778ad8d5825f9818a8"

# nomes de módulo por índice de bloco (ordem do documento)
MODULE_NAMES = {
    0:  ("scripts", "00-head-bootstrap.js"),
    1:  ("styles",  "00-bundle.css"),
    2:  ("scripts", "10-base-bundle.js"),
    3:  ("scripts", "20-physics-timeline.js"),
    4:  ("scripts", "21-p04-physical-reception.js"),
    5:  ("scripts", "22-2_5d-gate-a-contracts.js"),
    6:  ("scripts", "23-pre25d-runtime-auditor.js"),
    7:  ("scripts", "24-pre25d-build-meta.js"),
    8:  ("scripts", "25-r7-pass-flow-calibration.js"),
    9:  ("scripts", "26-r9-pass-natural-calibration.js"),
    10: ("scripts", "27-r10-engine-closure.js"),
    11: ("scripts", "28-r109-async-cup.js"),
    12: ("scripts", "29-r12-transactional-core.js"),
    13: ("scripts", "30-r13-football-observer.js"),
}

def tokenize(html):
    """Segmentos em ordem: ('glue', txt) | ('block', kind, open_tag, content, close_tag)."""
    segs, i, glue_start, n = [], 0, 0, len(html)
    pat = re.compile(r'<(script|style)\b[^>]*>', re.I)
    while i < n:
        m = pat.search(html, i)
        if not m:
            break
        kind = m.group(1).lower()
        if m.start() > glue_start:
            segs.append(('glue', html[glue_start:m.start()]))
        cm = re.compile(rf'</{kind}\s*>', re.I).search(html, m.end())
        segs.append(('block', kind, m.group(0), html[m.end():cm.start()], html[cm.start():cm.end()]))
        i = cm.end(); glue_start = i
    if glue_start < n:
        segs.append(('glue', html[glue_start:]))
    return segs

def main():
    raw = SRC_HTML.read_bytes()
    got = hashlib.sha256(raw).hexdigest()
    if got != TARGET_SHA:
        sys.exit(f"ERRO: SHA da fonte {got} != esperado {TARGET_SHA}")
    html = raw.decode("utf-8")
    segs = tokenize(html)

    blocks = [s for s in segs if s[0] == 'block']
    if len(blocks) != len(MODULE_NAMES):
        sys.exit(f"ERRO: {len(blocks)} blocos, esperava {len(MODULE_NAMES)}")

    (ROOT / "src/r13/scripts").mkdir(parents=True, exist_ok=True)
    (ROOT / "src/r13/styles").mkdir(parents=True, exist_ok=True)

    manifest = {
        "version": "5.9.3-R13.0",
        "target_sha256": TARGET_SHA,
        "target_output": "dist/COPA DOS SONHOS - V5.9.3-R13.0 - FUTEBOL OBSERVAVEL E CADENCIADO.html",
        "template": "src/r13/index.template.html",
        "note": "Recorte fiel do HTML autoritativo. Ordem dos blocos é contrato. build_r13.py reconstrói byte-a-byte.",
        "blocks": [],
    }

    template_parts = []
    bi = 0
    for s in segs:
        if s[0] == 'glue':
            template_parts.append(s[1])
            continue
        _, kind, open_tag, content, close_tag = s
        subdir, fname = MODULE_NAMES[bi]
        rel = f"src/r13/{subdir}/{fname}"
        (ROOT / rel).write_text(content, encoding="utf-8")
        placeholder = f"/*__CDS_R13_BLOCK_{bi}__*/"
        if placeholder in html:
            sys.exit(f"ERRO: placeholder {placeholder} colide com conteúdo")
        idm = re.search(r'id=["\']([^"\']+)["\']', open_tag)
        manifest["blocks"].append({
            "index": bi, "kind": kind,
            "id": idm.group(1) if idm else None,
            "module": rel,
            "placeholder": placeholder,
            "bytes": len(content.encode("utf-8")),
            "sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        })
        template_parts.append(open_tag + placeholder + close_tag)
        bi += 1

    template = "".join(template_parts)
    (ROOT / "src/r13/index.template.html").write_text(template, encoding="utf-8")
    (ROOT / "manifests/r13-build-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Extraídos {bi} blocos para src/r13/")
    print(f"Template: src/r13/index.template.html ({len(template.encode('utf-8'))} B)")
    print(f"Manifesto: manifests/r13-build-manifest.json")

if __name__ == "__main__":
    main()
