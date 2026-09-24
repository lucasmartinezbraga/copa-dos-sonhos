#!/usr/bin/env python3
"""
Recalibração dos pesos de estilo sobre o motor R14 (decisão liberada em build_up).

O golden R13.0 foi calibrado COM o defeito do decideT presente. Com o portador
voltando a decidir, os estilos ganharam volume de forma desigual e o gate
ppgRange (<= 0,75) reprovou. Este script re-deriva os pesos: aplica overrides em
STYLE_FX/STYLE_AXES como patch de motor da R14, constrói, roda a matriz de
estilos e imprime os gates.

  python tools/r14/calibrate_styles.py --set wings.cross=1.30 --set direct.far=1.15
  python tools/r14/calibrate_styles.py --from-json tools/r14/style-overrides.json
  python tools/r14/calibrate_styles.py --baseline          # sem overrides

Nada é gravado em src/ sem --save: a exploração é descartável por construção.
"""
import json, subprocess, sys, os, hashlib, re, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / "src/r14/patches-engine.json"
OVERRIDES = ROOT / "tools/r14/style-overrides.json"
NODE = os.environ.get("CDS_NODE") or shutil.which("node") or "node"
CSV = "tools/r13/COPA_DOS_SONHOS_P0-6_R12.3_PARTIDAS.csv"

# linha autoritativa de STYLE_FX na base R13 (âncora do patch)
FX_ANCHOR = "const STYLE_KEYS = Object.keys(STYLE_FX);"


def parse_sets(argv):
    out = {}
    for i, a in enumerate(argv):
        if a == "--set" and i + 1 < len(argv):
            key, _, val = argv[i + 1].partition("=")
            style, _, field = key.partition(".")
            out.setdefault(style, {})[field] = float(val)
    return out


def build_patch(overrides):
    """Reatribui campos de STYLE_FX/STYLE_AXES logo após a definição da tabela.

    Sobrescrever depois da declaração é deliberado: não reescreve a tabela
    original (que segue legível e diffável), e cada override fica explícito.
    """
    if not overrides:
        return None
    lines = []
    for style, fields in sorted(overrides.items()):
        for field, val in sorted(fields.items()):
            tgt = "STYLE_AXES" if field in ("line", "press", "width", "tempo", "posture") \
                  and val > 3 else "STYLE_FX"
            lines.append(f"{tgt}.{style}.{field}={val:g};")
    body = " ".join(lines)
    return {
        "id": "r14-style-recalibration",
        "priority": "P0",
        "audit_ids": "BAL-001",
        "rationale": ("Recalibração dos pesos de estilo sobre o motor consertado. O golden "
                      "R13.0 foi derivado com o portador congelado em build_up; liberada a "
                      "decisão, os estilos ganharam volume de forma desigual (wings +0,536 ppg, "
                      "balanced -0,500, direct -0,393) e ppgRange passou de 0,571 para 0,821. "
                      "Estes overrides re-derivam o equilíbrio no motor que efetivamente decide."),
        "from": FX_ANCHOR,
        "to": f"{body}\n{FX_ANCHOR}",
    }


def run(overrides, tag, repeats=2):
    base = json.loads(ENGINE.read_bytes().decode("utf-8"))
    base = [p for p in base if p["id"] != "r14-style-recalibration"]
    patch = build_patch(overrides)
    if patch:
        base.append(patch)
    ENGINE.write_bytes(json.dumps(base, ensure_ascii=False, indent=1).encode("utf-8"))

    out_html = f"dist/_cal_{tag}.html"
    r = subprocess.run([sys.executable, "tools/build_ux.py", "--out", out_html],
                       cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"build falhou:\n{r.stdout}\n{r.stderr}")
    sha = hashlib.sha256((ROOT / out_html).read_bytes()).hexdigest()

    out_json = f"reports/r14/differences/cal-{tag}.json"
    r = subprocess.run([NODE, "tools/ux/probe_balllock.js", f"--build={out_html}",
                        f"--csv={CSV}", "--styleMatrix=1", f"--repeats={repeats}",
                        f"--out={out_json}"], cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"sonda falhou:\n{r.stderr[-3000:]}")
    d = json.loads((ROOT / out_json).read_bytes().decode("utf-8"))
    (ROOT / out_html).unlink(missing_ok=True)
    return sha, d


def report(tag, sha, d, repeats):
    m = d["matrix"]
    g, styles = m["gates"], m["styles"]
    res = d["results"]
    locks = sum(r["lockCount"] for r in res)
    worst = max(r["lockMaxSec"] for r in res)
    print(f"\n=== {tag} === sha {sha[:12]}… ({len(res)} partidas, repeats={repeats})")
    print(f"  ppgRange              {g['ppgRange']:.3f}   (limite <= 0,75)  "
          f"{'PASS' if g['ppgRange'] <= 0.75 else 'FAIL'}")
    print(f"  maxAbsGoalDiff        {g['maxAbsGoalDiffPerMatch']:.3f}   (limite <= 0,65)  "
          f"{'PASS' if g['maxAbsGoalDiffPerMatch'] <= 0.65 else 'FAIL'}")
    for k in ("noDominantStyle", "parkIdentity", "tikiIdentity"):
        print(f"  {k:<21} {'PASS' if g[k] else 'FAIL'}")
    print(f"  travas {locks} | pior {worst}s")
    med = sorted(s["passesPerMatch"] for s in styles)[len(styles) // 2]
    print(f"  {'estilo':<10}{'ppg':>7}{'gols/j':>8}{'passes':>8}{'chutes':>8}   (mediana passes {med:.1f})")
    for s in styles:
        print(f"  {s['style']:<10}{s['ppg']:>7.3f}{s['goalsForPerMatch']:>8.2f}"
              f"{s['passesPerMatch']:>8.1f}{s['shotsPerMatch']:>8.2f}")
    return g


def main():
    repeats = 2
    for i, a in enumerate(sys.argv):
        if a == "--repeats":
            repeats = int(sys.argv[i + 1])
        elif a.startswith("--repeats="):
            repeats = int(a.split("=", 1)[1])
    if "--from-json" in sys.argv:
        p = Path(sys.argv[sys.argv.index("--from-json") + 1])
        ov = json.loads(p.read_bytes().decode("utf-8"))
    elif "--baseline" in sys.argv:
        ov = {}
    else:
        ov = parse_sets(sys.argv)
    tag = "baseline" if not ov else "-".join(
        f"{s}.{f}{v:g}" for s, fs in sorted(ov.items()) for f, v in sorted(fs.items()))[:60]
    if ov:
        print("overrides:", json.dumps(ov, ensure_ascii=False))
    sha, d = run(ov, re.sub(r"[^A-Za-z0-9._-]", "_", tag), repeats)
    g = report(tag, sha, d, repeats)
    if "--save" in sys.argv and ov:
        OVERRIDES.write_bytes(json.dumps(ov, ensure_ascii=False, indent=1).encode("utf-8"))
        print(f"\n[gravado] {OVERRIDES}")
    else:
        # restaura o patch de motor sem a recalibração exploratória
        base = [p for p in json.loads(ENGINE.read_bytes().decode("utf-8"))
                if p["id"] != "r14-style-recalibration"]
        if OVERRIDES.exists():
            saved = json.loads(OVERRIDES.read_bytes().decode("utf-8"))
            if saved:
                base.append(build_patch(saved))
        ENGINE.write_bytes(json.dumps(base, ensure_ascii=False, indent=1).encode("utf-8"))
    return 0 if g["ppgRange"] <= 0.75 and g["maxAbsGoalDiffPerMatch"] <= 0.65 else 2


if __name__ == "__main__":
    sys.exit(main())
