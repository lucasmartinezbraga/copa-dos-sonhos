#!/usr/bin/env python3
"""
Build R13.0 modular — reconcatena os módulos de src/r13/ no HTML autocontido.

Lê o manifesto r13-build-manifest.json, substitui cada placeholder do template
pelo conteúdo exato do módulo correspondente e grava o HTML final. Confere o
SHA-256 contra o alvo autoritativo: se bater, a build modular é byte-idêntica à
R13.0. Uso opcional: `python3 tools/build_r13.py --out caminho.html`.
"""
import json, hashlib, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAN = json.loads((ROOT / "manifests/r13-build-manifest.json").read_text(encoding="utf-8"))

def main():
    out_arg = None
    if "--out" in sys.argv:
        out_arg = sys.argv[sys.argv.index("--out") + 1]

    # read_bytes: read_text() normaliza \r\n em \n e esconderia um módulo
    # corrompido por fim de linha. Aqui a divergência precisa ser barulhenta.
    html = (ROOT / MAN["template"]).read_bytes().decode("utf-8")
    for b in MAN["blocks"]:
        content = (ROOT / b["module"]).read_bytes().decode("utf-8")
        got = hashlib.sha256(content.encode("utf-8")).hexdigest()
        if got != b["sha256"]:
            print(f"[aviso] módulo {b['module']} mudou (sha {got[:12]} != manifesto {b['sha256'][:12]})")
        ph = b["placeholder"]
        if html.count(ph) != 1:
            sys.exit(f"ERRO: placeholder {ph} aparece {html.count(ph)}x no template")
        html = html.replace(ph, content, 1)

    out = ROOT / (out_arg or MAN["target_output"])
    out.parent.mkdir(parents=True, exist_ok=True)
    data = html.encode("utf-8")
    out.write_bytes(data)
    sha = hashlib.sha256(data).hexdigest()
    print(out)
    print("bytes :", len(data))
    print("sha256:", sha)
    target = MAN["target_sha256"]
    if sha == target:
        print("EQUIVALÊNCIA BYTE-A-BYTE: OK (== R13.0 autoritativo)")
        return 0
    else:
        print(f"DIVERGE do alvo {target}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
