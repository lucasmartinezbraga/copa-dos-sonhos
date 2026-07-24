#!/usr/bin/env python3
"""
Efeito pareado por seed entre duas matrizes de 294 partidas.

POR QUE ISTO EXISTE. Comparar médias de duas matrizes não diz se a diferença é
do patch ou do sorteio. Como as matrizes usam as MESMAS seeds, dá para parear
partida a partida e medir o efeito com erro-padrão. Sem isso, "os gols caíram
6,2%" e "os gols variaram" são a mesma frase.

Regra de leitura adotada: |t| > 2 ≈ 95% de confiança. Abaixo disso, a diferença
não se distingue de ruído com n = 294 e NÃO deve ser descrita como regressão.

    python tools/r15/paired_effect.py --a reports/r15/real-r158.json \
                                      --b reports/r15/real-r162.json
"""
import json
import math
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

_a = sys.argv[1:]
def _opt(n, d=None):
    return _a[_a.index(n) + 1] if n in _a else d

A = _opt("--a", "reports/r15/real-r158.json")
B = _opt("--b", "reports/r15/real-r162.json")
OUT = _opt("--out", "reports/r15/efeito-pareado.json")

# métrica -> guarda em `metrics` que prova que a amostra existe
RATES = [
    ("threatCoverage",          "dangerousThreats"),
    ("markerMeanDistance",      "markerSamples"),
    ("spatialOverloadCoverage", "spatialOverloadSamples"),
    ("defensiveLineMeanRange",  None),
    ("disconnectedLineRate",    None),
]


def load(p):
    return json.loads((ROOT / p).read_text(encoding="utf-8"))


def key_of(r):
    return (r["index"], r["seed"])


def rates_by_seed(doc, key, guard):
    out = {}
    for r in doc["results"]:
        o = r.get("observedFootball") or {}
        m, rt = o.get("metrics") or {}, o.get("rates") or {}
        if guard and not m.get(guard):
            continue
        if key in rt:
            out[key_of(r)] = rt[key]
    return out


def goals_by_seed(doc):
    return {key_of(r): sum(r["score"]) for r in doc["results"]}


def paired(a, b):
    common = [k for k in a if k in b]
    if len(common) < 3:
        return None
    d = [b[k] - a[k] for k in common]
    m = statistics.mean(d)
    sd = statistics.stdev(d)
    se = sd / math.sqrt(len(d)) if sd else 0.0
    return {"n": len(d), "delta": m, "dp": sd, "ep": se,
            "t": (m / se) if se else 0.0, "real": bool(se and abs(m / se) > 2)}


def main():
    da, db = load(A), load(B)
    print("=" * 88)
    print(f"EFEITO PAREADO POR SEED")
    print(f"  A (controle): {A}  sha {da.get('sha256','')[:12]}")
    print(f"  B (candidata): {B}  sha {db.get('sha256','')[:12]}")
    print("=" * 88)

    ga, gb = goals_by_seed(da), goals_by_seed(db)
    iguais = sum(1 for k in ga if k in gb and ga[k] == gb[k])
    n_com = sum(1 for k in ga if k in gb)
    print(f"placar idêntico em {iguais}/{n_com} partidas "
          f"({iguais/n_com*100:.1f}%) — o patch muda a trajetória da partida\n")

    print(f"{'métrica':<28}{'Δ médio':>12}{'ep':>9}{'t':>8}{'n':>6}   veredito")
    print("-" * 88)
    res = {}
    r = paired(ga, gb)
    res["goals"] = r
    print(f"{'gols/partida':<28}{r['delta']:>+12.4f}{r['ep']:>9.4f}{r['t']:>8.2f}"
          f"{r['n']:>6}   {'REAL' if r['real'] else 'ruído'}")
    for key, guard in RATES:
        pa, pb = rates_by_seed(da, key, guard), rates_by_seed(db, key, guard)
        r = paired(pa, pb)
        if not r:
            continue
        res[key] = r
        print(f"{key:<28}{r['delta']:>+12.4f}{r['ep']:>9.4f}{r['t']:>8.2f}"
              f"{r['n']:>6}   {'REAL' if r['real'] else 'ruído'}")

    print("-" * 88)
    reais = [k for k, v in res.items() if v["real"]]
    ruido = [k for k, v in res.items() if not v["real"]]
    print(f"efeito real:  {', '.join(reais) or '—'}")
    print(f"ruído (n=294): {', '.join(ruido) or '—'}")
    print("\nDescrever como regressão qualquer item da segunda linha é atribuir")
    print("ao patch uma variação que a amostra não sustenta.")

    (ROOT / OUT).write_text(json.dumps(
        {"a": A, "b": B, "sha_a": da.get("sha256"), "sha_b": db.get("sha256"),
         "placares_identicos": iguais, "n": n_com, "metricas": res},
        indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"\nartefato: {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
