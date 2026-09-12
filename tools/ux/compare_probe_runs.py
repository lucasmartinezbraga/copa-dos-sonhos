#!/usr/bin/env python3
"""
Compara duas execuções da sonda (probe_balllock.js) e produz o relatório de
diferenças R13 -> R14 exigido pela auditoria mestra.

Cobre as duas metades do gate: as TRAVAS (o P0 que se quer eliminar) e o
FUTEBOL (o que não pode regredir por acidente). Diferença intencional não é
regressão — mas precisa aparecer, com número, para ser defendida.

  python tools/ux/compare_probe_runs.py <antes.json> <depois.json> [--md saida.md]
"""
import json, sys
from pathlib import Path


def load(p):
    return json.loads(Path(p).read_bytes().decode("utf-8"))


def lock_metrics(d):
    res = d["results"]
    n = len(res)
    locks = [l for r in res for l in r.get("worstLocks", [])]
    total = sum(r["lockCount"] for r in res)
    two = sum(r["lockTwoPlayer"] for r in res)
    worst = max((r["lockMaxSec"] for r in res), default=0)
    over = lambda s: sum(1 for l in locks if l["gameSec"] >= s)
    return {
        "partidas": n,
        "travas totais": total,
        "travas por partida": round(total / n, 2) if n else 0,
        "travas de 2 jogadores": two,
        "pior trava (s)": worst,
        "partidas com >=1 trava": sum(1 for r in res if r["lockCount"]),
        "travas >=5s (amostradas)": over(5),
        "travas >=10s (amostradas)": over(10),
        "travas >=20s (amostradas)": over(20),
        "stallFires": sum(r.get("stallFires", 0) for r in res),
    }


def football_metrics(d):
    s = d["summary"]
    pm = s.get("perMatch", {})
    ev = s.get("events", {})
    n = s.get("matches", 1) or 1
    out = {f"{k}/partida": round(v, 3) if isinstance(v, (int, float)) else v
           for k, v in pm.items()}
    for key in ("pass", "shot_taken", "dribble", "tackle", "cross", "goal",
                "bad_pass", "looseControl", "pressure", "containment",
                "tackle_missed", "corner", "throw_in", "offside"):
        if key in ev:
            out[f"ev:{key}/partida"] = round(ev[key] / n, 2)
    ho = s.get("humanObserver", {})
    for key in ("defensiveLineMeanRange", "markerMeanDistance",
                "uncoveredThreatRate", "disconnectedLineRate"):
        if key in ho and isinstance(ho[key], (int, float)):
            out[f"obs:{key}"] = round(ho[key], 3)
    return out


def fmt_delta(a, b):
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        return str(a), str(b), ""
    d = b - a
    pct = (d / a * 100) if a else float("inf") if d else 0
    arrow = "=" if abs(d) < 1e-9 else ("+" if d > 0 else "")
    pcts = "—" if a == 0 else f"{pct:+.1f}%"
    return f"{a:g}", f"{b:g}", f"{arrow}{d:g} ({pcts})"


def table(title, ma, mb):
    lines = [f"### {title}", "", "| métrica | antes | depois | delta |", "|---|---:|---:|---:|"]
    for k in ma:
        a, b, d = fmt_delta(ma[k], mb.get(k, 0))
        lines.append(f"| {k} | {a} | {b} | {d} |")
    lines.append("")
    return lines


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2:
        sys.exit(__doc__)
    before, after = load(args[0]), load(args[1])

    out = ["# Diferenças R13 -> R14 (sonda de trava)", "",
           f"- **antes**: `{args[0]}` — build `{before.get('sha256','?')[:16]}…` seeds {before.get('range')}",
           f"- **depois**: `{args[1]}` — build `{after.get('sha256','?')[:16]}…` seeds {after.get('range')}", ""]
    out += table("P0 — travas de bola", lock_metrics(before), lock_metrics(after))
    fa, fb = football_metrics(before), football_metrics(after)
    out += table("Futebol observado", fa, fb)

    md = "\n".join(out)
    print(md)
    if "--md" in sys.argv:
        p = Path(sys.argv[sys.argv.index("--md") + 1])
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(md.encode("utf-8"))
        print(f"\n[gravado] {p}", file=sys.stderr)


if __name__ == "__main__":
    main()
