#!/usr/bin/env python3
"""
Build do candidato RC-UX = R13.0 (byte-idêntica) + camada UX aditiva.

Reconstrói o HTML R13 a partir de src/r13/ (sem tocar no arquivo autoritativo)
e injeta, imediatamente antes de </body></html>:
  - <style id="cds-ux-system">  = concatenação de src/ux/*.css
  - <script id="cds-ux-boot">   = concatenação de src/ux/*.js

Patches exatos são carregados de src/ux/patches*.json. Substituições globais
controladas são carregadas de src/ux/token-patches*.json. Todos os patches são
fail-closed: contagens fora do intervalo declarado encerram o build.
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


def read_layer(ext):
    d = ROOT / "src/ux"
    files = sorted(p for p in d.glob(f"*.{ext}"))
    return files, "\n".join(p.read_text(encoding="utf-8") for p in files)


def apply_presentation_patches(html):
    patched = []
    for patches_path in sorted((ROOT / "src/ux").glob("patches*.json")):
        rows = json.loads(patches_path.read_text(encoding="utf-8"))
        for p in rows:
            n = html.count(p["from"])
            if n != 1:
                sys.exit(
                    f"ERRO: patch '{p['id']}' de {patches_path.name} ocorre {n}x "
                    "na entrada (esperado 1)"
                )
            html = html.replace(p["from"], p["to"], 1)
            patched.append(f"{patches_path.name}:{p['id']}")
    return html, patched


def apply_token_patches(html):
    patched = []
    for patches_path in sorted((ROOT / "src/ux").glob("token-patches*.json")):
        rows = json.loads(patches_path.read_text(encoding="utf-8"))
        for p in rows:
            n = html.count(p["from"])
            minimum = int(p.get("min", 1))
            maximum = int(p.get("max", minimum))
            if n < minimum or n > maximum:
                sys.exit(
                    f"ERRO: token patch '{p['id']}' de {patches_path.name} ocorre {n}x "
                    f"(esperado {minimum}..{maximum})"
                )
            html = html.replace(p["from"], p["to"])
            patched.append(f"{patches_path.name}:{p['id']}({n})")
    return html, patched


def main():
    out_arg = None
    if "--out" in sys.argv:
        out_arg = sys.argv[sys.argv.index("--out") + 1]

    html = build_r13_html()
    base_sha = hashlib.sha256(html.encode("utf-8")).hexdigest()
    if base_sha != MAN["target_sha256"]:
        sys.exit(f"ERRO: base R13 divergiu ({base_sha[:12]} != alvo). Rode verify_r13 antes.")

    html, exact_patches = apply_presentation_patches(html)
    html, token_patches = apply_token_patches(html)
    css_files, css = read_layer("css")
    js_files, js = read_layer("js")
    end = "</body></html>"
    if end not in html:
        sys.exit("ERRO: </body></html> não encontrado")
    inject = (
        f'<style id="cds-ux-system">\n{css}\n</style>\n'
        f'<script id="cds-ux-boot">\n{js}\n</script>'
    )
    html = html.replace(end, inject + end)

    out = ROOT / (out_arg or OUT_DEFAULT)
    out.parent.mkdir(parents=True, exist_ok=True)
    data = html.encode("utf-8")
    out.write_bytes(data)
    sha = hashlib.sha256(data).hexdigest()
    print(out)
    print("base R13 (intacta):", base_sha[:16], "…")
    print("patches exatos:", exact_patches or "nenhum")
    print("token patches:", token_patches or "nenhum")
    print("camada UX:", [p.name for p in css_files + js_files])
    print("bytes:", len(data))
    print("sha256:", sha)
    return 0


if __name__ == "__main__":
    sys.exit(main())
