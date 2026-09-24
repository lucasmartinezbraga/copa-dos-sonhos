#!/usr/bin/env python3
"""
Build do candidato RC-UX = R13.0 (byte-idêntica) + camada UX aditiva.

Reconstrói o HTML R13 a partir de src/r13/ (sem tocar no arquivo autoritativo)
e injeta, imediatamente antes de </body></html>:
  - <style id="cds-ux-system">  = concatenação de src/ux/*.css
  - <script id="cds-ux-boot">   = concatenação de src/ux/*.js

Como é aditivo e a camada UX não altera o motor, a regressão de engine
(verify_ux.py) deve permanecer idêntica ao golden R13. Gera um novo SHA
(candidato versionado) — a R13.0 continua congelada e verificável.
"""
import json, hashlib, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAN = json.loads((ROOT / "manifests/r13-build-manifest.json").read_text(encoding="utf-8"))
OUT_DEFAULT = "dist/COPA DOS SONHOS - RC-UX.html"

def build_r13_html():
    html = (ROOT / MAN["template"]).read_text(encoding="utf-8")
    for b in MAN["blocks"]:
        content = (ROOT / b["module"]).read_text(encoding="utf-8")
        html = html.replace(b["placeholder"], content, 1)
    return html

def read_layer(subdir, ext):
    d = ROOT / "src/ux"
    files = sorted(p for p in d.glob(f"*.{ext}"))
    return files, "\n".join(p.read_text(encoding="utf-8") for p in files)

def main():
    out_arg = None
    if "--out" in sys.argv:
        out_arg = sys.argv[sys.argv.index("--out") + 1]

    html = build_r13_html()
    # confere que a base R13 está intacta antes de injetar
    base_sha = hashlib.sha256(html.encode("utf-8")).hexdigest()
    if base_sha != MAN["target_sha256"]:
        sys.exit(f"ERRO: base R13 divergiu ({base_sha[:12]} != alvo). Rode verify_r13 antes.")

    # patches de APRESENTAÇÃO no candidato (precedente: inject_r13.js).
    # Cada 'from' precisa ocorrer exatamente 1x — se a base mudar, o build grita.
    patches_path = ROOT / "src/ux/patches.json"
    patched = []
    if patches_path.exists():
        for p in json.loads(patches_path.read_text(encoding="utf-8")):
            n = html.count(p["from"])
            if n != 1:
                sys.exit(f"ERRO: patch '{p['id']}' ocorre {n}x na base (esperado 1)")
            html = html.replace(p["from"], p["to"], 1)
            patched.append(p["id"])

    css_files, css = read_layer("ux", "css")
    js_files, js = read_layer("ux", "js")
    end = "</body></html>"
    if end not in html:
        sys.exit("ERRO: </body></html> não encontrado")
    inject = (f'<style id="cds-ux-system">\n{css}\n</style>\n'
              f'<script id="cds-ux-boot">\n{js}\n</script>')
    html = html.replace(end, inject + end)

    out = ROOT / (out_arg or OUT_DEFAULT)
    out.parent.mkdir(parents=True, exist_ok=True)
    data = html.encode("utf-8")
    out.write_bytes(data)
    sha = hashlib.sha256(data).hexdigest()
    print(out)
    print("base R13 (intacta):", base_sha[:16], "…")
    print("patches aplicados:", patched or "nenhum")
    print("camada UX: ", [p.name for p in css_files + js_files])
    print("bytes :", len(data))
    print("sha256:", sha)
    return 0

if __name__ == "__main__":
    sys.exit(main())
