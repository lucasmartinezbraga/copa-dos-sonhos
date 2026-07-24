#!/usr/bin/env python3
"""
§45 — TESTE PAREADO A/B DE CADA PATCH DE MOTOR.

Para cada entrada de `src/r14/patches-engine.json`, constrói a candidata COM e
SEM o patch e roda a mesma matriz de seeds nos dois. Só o patch muda.

Serve a duas perguntas:

  1. O patch faz alguma coisa? Um patch que produz resultado byte-idêntico está
     ancorado em CÓDIGO MORTO. Isso já aconteceu: `r14-shadow-lane` foi ancorado
     no `_defendTarget` do bundle base, que a camada R13 substitui — o patch
     embarcou, foi creditado no changelog como correção de comportamento e não
     alterou uma única partida.

  2. Qual é o efeito, com número antes/depois? É o registro que o §2 exige e
     que permite reverter o que não move a métrica-alvo.

Uso:
    python tools/r15/patch_effect.py [--repeats 1] [--only <patch-id>]
"""
import json, os, subprocess, sys, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PY = sys.executable
NODE_DIR = Path(os.environ.get("LOCALAPPDATA", "")) / "nodejs-portable" / "node-v24.18.0-win-x64"
NODE = str(NODE_DIR / "node.exe") if (NODE_DIR / "node.exe").exists() else "node"
WORK = ROOT / "reports/r15/patch-effect"

METRICS = ["goals", "shots", "passes", "corners", "offsides", "throwIns"]


def child_env():
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    if NODE_DIR.exists():
        env["PATH"] = str(NODE_DIR) + os.pathsep + env.get("PATH", "")
    return env


def run(cmd):
    r = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True,
                       encoding="utf-8", errors="replace", env=child_env())
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def rel(p: Path):
    return str(p.relative_to(ROOT)).replace("\\", "/")


def build(out_html, without=None):
    cmd = [PY, "tools/build_ux.py", "--out", str(out_html)]
    if without:
        cmd += ["--without", without]
    code, out = run(cmd)
    if code != 0:
        return None, out[-400:]
    return hashlib.sha256(out_html.read_bytes()).hexdigest(), None


def probe(html, out_json, repeats):
    code, out = run([NODE, "tools/ux/probe_balllock.js",
                     f"--build={rel(html)}", "--styleMatrix=1",
                     f"--repeats={repeats}", f"--out={rel(out_json)}"])
    if not out_json.exists():
        return None
    return json.loads(out_json.read_text(encoding="utf-8"))


def coverage(doc):
    """Média de threatCoverage só sobre partidas com ameaça observada."""
    vals = []
    for r in doc.get("results", []):
        o = r.get("observedFootball") or {}
        if (o.get("metrics") or {}).get("dangerousThreats"):
            vals.append(o["rates"]["threatCoverage"])
    return (sum(vals) / len(vals)) if vals else None


def summarize(doc):
    s = doc.get("summary") or {}
    return {
        "scores": [tuple(r["score"]) for r in doc.get("results", [])],
        "perMatch": {k: (s.get("perMatch") or {}).get(k) for k in METRICS},
        "threatCoverage": coverage(doc),
        "lockMax": max((r.get("lockMaxSec") or 0) for r in doc.get("results", [{}])),
    }


def main():
    args = sys.argv[1:]
    def opt(n, d=None):
        return args[args.index(n) + 1] if n in args else d

    repeats = opt("--repeats", "1")
    only = opt("--only")
    WORK.mkdir(parents=True, exist_ok=True)

    patches = json.loads((ROOT / "src/r14/patches-engine.json").read_bytes().decode("utf-8"))
    active = [p for p in patches if p.get("enabled", True)]
    if only:
        active = [p for p in active if p["id"] == only]

    base_html = WORK / "_base.html"
    base_sha, err = build(base_html)
    if not base_sha:
        sys.exit(f"ERRO no build base: {err}")
    base = summarize(probe(base_html, WORK / "_base.json", repeats))
    print(f"base sha={base_sha[:12]} · {len(base['scores'])} partidas\n")

    rows = []
    for p in active:
        pid = p["id"]
        html = WORK / f"_no_{pid}.html"
        sha, err = build(html, without=pid)
        if not sha:
            rows.append({"id": pid, "error": err})
            print(f"{pid:<32} ERRO no build")
            continue
        doc = probe(html, WORK / f"_no_{pid}.json", repeats)
        if doc is None:
            rows.append({"id": pid, "error": "probe falhou"})
            print(f"{pid:<32} ERRO no probe")
            continue
        arm = summarize(doc)

        same_scores = sum(1 for a, b in zip(base["scores"], arm["scores"]) if a == b)
        n = len(base["scores"])
        inert = (same_scores == n and
                 all(abs((base["perMatch"][k] or 0) - (arm["perMatch"][k] or 0)) < 1e-9
                     for k in METRICS))

        delta = {k: round((base["perMatch"][k] or 0) - (arm["perMatch"][k] or 0), 4)
                 for k in METRICS}
        dcov = None
        if base["threatCoverage"] is not None and arm["threatCoverage"] is not None:
            dcov = round(base["threatCoverage"] - arm["threatCoverage"], 5)

        rows.append({
            "id": pid, "priority": p.get("priority"),
            "identical_scores": same_scores, "matches": n,
            "inert": inert,
            "delta_perMatch": delta,
            "delta_threatCoverage": dcov,
            "lockMax_with": base["lockMax"], "lockMax_without": arm["lockMax"],
        })
        flag = "INERTE" if inert else "ativo"
        print(f"{pid:<32} {flag:<7} placares iguais {same_scores}/{n} "
              f"· Δgols {delta['goals']:+.3f} · Δcobertura "
              f"{(f'{dcov:+.5f}' if dcov is not None else 'n/d')}")

    report = {
        "base_sha256": base_sha,
        "matches_per_arm": len(base["scores"]),
        "repeats": int(repeats),
        "inert_patches": [r["id"] for r in rows if r.get("inert")],
        "patches": rows,
    }
    (ROOT / "reports/r15/patch-effect.json").write_text(
        json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")

    print(f"\npatches inertes: {report['inert_patches'] or 'nenhum'}")
    print("artefato: reports/r15/patch-effect.json")
    return 0 if not report["inert_patches"] else 1


if __name__ == "__main__":
    sys.exit(main())
