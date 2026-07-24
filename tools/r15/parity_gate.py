#!/usr/bin/env python3
"""
Portão de paridade — item 0 do critério pré-registrado do §18.

Um passo que só ADICIONA estrutura (criar o Contrato de Função sem ninguém ler)
tem de produzir a MESMA partida. Se mudar qualquer coisa, o módulo vazou para o
motor antes da hora, e a regra é reverter, não ajustar.

Exige, contra o controle:
  · 294/294 placares idênticos
  · todas as métricas agregadas iguais até 1e-9
  · mesmos status transacionais

    python tools/r15/parity_gate.py --a reports/r15/real-r162.json \
                                    --b reports/r15/real-r170.json
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EPS = 1e-9

_a = sys.argv[1:]
def _opt(n, d=None):
    return _a[_a.index(n) + 1] if n in _a else d

A = _opt("--a", "reports/r15/real-r162.json")
B = _opt("--b", "reports/r15/real-r170.json")
OUT = _opt("--out", "reports/r15/paridade.json")


def load(p):
    return json.loads((ROOT / p).read_text(encoding="utf-8"))


def walk(node, prefix=""):
    """Achata um dicionário de métricas em pares (caminho, número)."""
    if isinstance(node, dict):
        for k, v in node.items():
            yield from walk(v, f"{prefix}.{k}" if prefix else k)
    elif isinstance(node, (int, float)) and not isinstance(node, bool):
        yield prefix, float(node)


def main():
    da, db = load(A), load(B)
    rel = {"a": A, "b": B, "sha_a": da.get("sha256"), "sha_b": db.get("sha256"),
           "n_a": len(da["results"]), "n_b": len(db["results"]),
           "placares_diferentes": [], "metricas_diferentes": [],
           "status_diferentes": []}

    ra = {(r["index"], r["seed"]): r for r in da["results"]}
    rb = {(r["index"], r["seed"]): r for r in db["results"]}
    comuns = sorted(set(ra) & set(rb))

    for k in comuns:
        if list(ra[k]["score"]) != list(rb[k]["score"]):
            rel["placares_diferentes"].append(
                {"seed": k[1], "a": ra[k]["score"], "b": rb[k]["score"]})
        if ra[k].get("canonicalStatus") != rb[k].get("canonicalStatus"):
            rel["status_diferentes"].append(
                {"seed": k[1], "a": ra[k].get("canonicalStatus"),
                 "b": rb[k].get("canonicalStatus")})

    ma = dict(walk(da.get("summary") or {}))
    mb = dict(walk(db.get("summary") or {}))
    for key in sorted(set(ma) | set(mb)):
        va, vb = ma.get(key), mb.get(key)
        if va is None or vb is None or abs(va - vb) > EPS:
            rel["metricas_diferentes"].append({"metrica": key, "a": va, "b": vb})

    ok = (rel["n_a"] == rel["n_b"] == len(comuns)
          and not rel["placares_diferentes"]
          and not rel["metricas_diferentes"]
          and not rel["status_diferentes"])
    rel["veredito"] = "PARIDADE" if ok else "VAZAMENTO"

    print("=" * 78)
    print(f"PORTÃO DE PARIDADE  ·  {rel['veredito']}")
    print("=" * 78)
    print(f"  controle : {A}\n             sha {rel['sha_a']}")
    print(f"  candidata: {B}\n             sha {rel['sha_b']}")
    print(f"  partidas pareadas: {len(comuns)}/{rel['n_a']}")
    print(f"  placares diferentes  : {len(rel['placares_diferentes'])}")
    print(f"  status  diferentes   : {len(rel['status_diferentes'])}")
    print(f"  métricas diferentes  : {len(rel['metricas_diferentes'])}  (eps {EPS})")
    for d in rel["placares_diferentes"][:5]:
        print(f"     seed {d['seed']}: {d['a']} != {d['b']}")
    for d in rel["metricas_diferentes"][:10]:
        print(f"     {d['metrica']}: {d['a']} != {d['b']}")
    if ok:
        print("\n  O módulo adiciona estrutura sem tocar no comportamento.")
        print("  Item 0 do critério pré-registrado do §18: CUMPRIDO.")
    else:
        print("\n  O módulo VAZOU para o motor. Reverter, não ajustar.")

    (ROOT / OUT).write_text(json.dumps(rel, indent=1, ensure_ascii=False),
                            encoding="utf-8")
    print(f"\nartefato: {OUT}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
