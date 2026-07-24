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
    # read_bytes por simetria com build_r13.py: sem normalização de fim de linha.
    html = (ROOT / MAN["template"]).read_bytes().decode("utf-8")
    for b in MAN["blocks"]:
        content = (ROOT / b["module"]).read_bytes().decode("utf-8")
        html = html.replace(b["placeholder"], content, 1)
    return html

def read_layer(subdir, ext):
    d = ROOT / "src/ux"
    files = sorted(p for p in d.glob(f"*.{ext}"))
    return files, "\n".join(p.read_text(encoding="utf-8") for p in files)

def flag_values(name):
    """Todas as ocorrências de `--name valor` na linha de comando."""
    out = []
    for i, a in enumerate(sys.argv):
        if a == name and i + 1 < len(sys.argv):
            out.append(sys.argv[i + 1])
    return out

def main():
    out_arg = None
    if "--out" in sys.argv:
        out_arg = sys.argv[sys.argv.index("--out") + 1]
    force_on = set(flag_values("--with"))
    force_off = set(flag_values("--without"))

    html = build_r13_html()
    # confere que a base R13 está intacta antes de injetar
    base_sha = hashlib.sha256(html.encode("utf-8")).hexdigest()
    if base_sha != MAN["target_sha256"]:
        sys.exit(f"ERRO: base R13 divergiu ({base_sha[:12]} != alvo). Rode verify_r13 antes.")

    # patches de MOTOR da R14 (src/r14/patches-engine.json): mudanças
    # INTENCIONAIS de comportamento, cada uma com justificativa registrada no
    # próprio arquivo. A R13.0 permanece congelada e byte-verificável acima; é
    # aqui que a R14 passa a divergir dela, de forma explícita e auditável.
    # Um patch com "enabled": false é EXPERIMENTO: fica registrado no arquivo,
    # com justificativa, mas NÃO embarca. Só entra se pedido explicitamente com
    # --with <id>. Sem isso o build silenciosamente embarcava experimentos e a
    # candidata declarada deixava de ser reproduzível a partir da fonte.
    engine_path = ROOT / "src/r14/patches-engine.json"
    engine_applied, engine_skipped = [], []
    if engine_path.exists():
        for p in json.loads(engine_path.read_bytes().decode("utf-8")):
            pid = p["id"]
            on = p.get("enabled", True)
            if pid in force_on:
                on = True
            if pid in force_off:
                on = False
            if not on:
                engine_skipped.append(pid)
                continue
            n = html.count(p["from"])
            if n != 1:
                sys.exit(f"ERRO: patch de MOTOR '{pid}' ocorre {n}x na base (esperado 1)")
            html = html.replace(p["from"], p["to"], 1)
            engine_applied.append(pid)
    unknown = (force_on | force_off) - set(engine_applied) - set(engine_skipped)
    if unknown:
        sys.exit(f"ERRO: --with/--without citam patch inexistente: {sorted(unknown)}")

    # patches de APRESENTAÇÃO no candidato (precedente: inject_r13.js).
    # Cada 'from' precisa ocorrer exatamente 1x — se a base mudar, o build grita.
    patches_path = ROOT / "src/ux/patches.json"
    patched = []
    if patches_path.exists():
        for p in json.loads(patches_path.read_bytes().decode("utf-8")):
            n = html.count(p["from"])
            if n != 1:
                sys.exit(f"ERRO: patch '{p['id']}' ocorre {n}x na base (esperado 1)")
            html = html.replace(p["from"], p["to"], 1)
            patched.append(p["id"])

    # camada de MOTOR da R14 (src/r14/*.js): módulos novos que estendem o
    # protótipo do MatchSim. Entram ANTES da apresentação — são motor, não
    # render, e o runner headless precisa executá-los.
    r14_dir = ROOT / "src/r14"
    r14_files = sorted(p for p in r14_dir.glob("*.js")) if r14_dir.exists() else []
    r14_js = "\n".join(p.read_bytes().decode("utf-8") for p in r14_files)

    css_files, css = read_layer("ux", "css")
    js_files, js = read_layer("ux", "js")
    end = "</body></html>"
    if end not in html:
        sys.exit("ERRO: </body></html> não encontrado")
    inject = ""
    if r14_js:
        inject += f'<script id="cds-r14-engine">\n{r14_js}\n</script>\n'
    inject += (f'<style id="cds-ux-system">\n{css}\n</style>\n'
               f'<script id="cds-ux-boot">\n{js}\n</script>')
    html = html.replace(end, inject + end)

    out = ROOT / (out_arg or OUT_DEFAULT)
    out.parent.mkdir(parents=True, exist_ok=True)
    data = html.encode("utf-8")
    out.write_bytes(data)
    sha = hashlib.sha256(data).hexdigest()
    print(out)
    print("base R13 (intacta):", base_sha[:16], "…")
    print("patches de MOTOR (R14):", engine_applied or "nenhum")
    print("patches de MOTOR ignorados:", engine_skipped or "nenhum")
    print("camada de MOTOR (R14):", [p.name for p in r14_files] or "nenhuma")
    print("patches aplicados:", patched or "nenhum")
    print("camada UX: ", [p.name for p in css_files + js_files])
    print("bytes :", len(data))
    print("sha256:", sha)
    return 0

if __name__ == "__main__":
    sys.exit(main())
