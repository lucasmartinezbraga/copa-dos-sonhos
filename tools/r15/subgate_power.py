#!/usr/bin/env python3
"""
Poder discriminante dos sub-gates do observador (§7).

PERGUNTA: quando um sub-gate sai de 3/294 para 0/294, isso é sinal ou ruído?

Um gate cujo limiar está acima do p90 de TODAS as builds não distingue
candidatas — ele só amostra a cauda. Usar um gate assim como bloqueio de
promoção é reprovar por ruído.

Este script decompõe cada sub-gate composto em suas pernas e mostra, por build:
a média da grandeza, o p90, o máximo, o limiar exigido, e quantas partidas
passam em cada perna separadamente.

    python tools/r15/subgate_power.py
"""
import json
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

BUILDS = [
    ("R15.9 (ctl)", "reports/r15/real-r158.json"),
    ("R16.0",       "reports/r15/real-r160.json"),
    ("R16.1",       "reports/r15/real-r161.json"),
    ("R16.2",       "reports/r15/real-r162.json"),
]

# sub-gate -> pernas: (rótulo, chave em rates, guarda em metrics, operador, limiar)
PERNAS = {
    "marking": [
        ("threatCoverage",     "threatCoverage",     "dangerousThreats",       ">=", 0.65),
        ("markerMeanDistance", "markerMeanDistance", "markerSamples",          "<=", 8.5),
    ],
    "spatialOverload": [
        ("spatialOverloadCoverage", "spatialOverloadCoverage", "spatialOverloadSamples", ">=", 0.62),
    ],
    "lines": [
        ("defensiveLineMeanRange", "defensiveLineMeanRange", None, "<=", 10.0),
        ("disconnectedLineRate",   "disconnectedLineRate",   None, "<=", 0.22),
    ],
    "ball": [
        ("bodyOrientationMismatch", "bodyOrientationMismatch", None, "<=", 0.10),
    ],
}


def ok(v, op, lim):
    return v >= lim if op == ">=" else v <= lim


def main():
    docs = {}
    for rot, p in BUILDS:
        f = ROOT / p
        if f.exists():
            docs[rot] = json.loads(f.read_text(encoding="utf-8"))
        else:
            print(f"[ausente] {rot}: {p}")

    saida = {}
    for gate, pernas in PERNAS.items():
        print("=" * 96)
        print(f"SUB-GATE `{gate}`")
        print("=" * 96)
        print(f"{'perna':<26}{'build':<14}{'média':>9}{'p90':>9}{'máx':>9}"
              f"{'limiar':>9}{'passa':>11}")
        print("-" * 96)
        for rotulo, chave, guarda, op, lim in pernas:
            for rot in docs:
                vals = []
                for r in docs[rot]["results"]:
                    o = r.get("observedFootball") or {}
                    m, rt = o.get("metrics") or {}, o.get("rates") or {}
                    if guarda and not m.get(guarda):
                        continue
                    if chave in rt:
                        vals.append(rt[chave])
                if not vals:
                    continue
                s = sorted(vals)
                p90 = s[min(len(s) - 1, int(0.9 * len(s)))]
                n = sum(1 for v in vals if ok(v, op, lim))
                taxa = n / len(vals)
                # Sem poder discriminante = quase nunca passa ou quase sempre
                # passa. Nos dois casos o gate não separa candidatas: só mede a
                # cauda, ou não mede nada.
                cego = taxa <= 0.05 or taxa >= 0.95
                # Métrica morta: constante em todas as partidas.
                morta = (max(vals) - min(vals)) == 0
                marca = "  ← cego" if cego else ""
                if morta:
                    marca += "  ← MÉTRICA CONSTANTE"
                print(f"{rotulo:<26}{rot:<14}{statistics.mean(vals):>9.4f}{p90:>9.4f}"
                      f"{(max(vals) if op=='>=' else min(vals)):>9.4f}{lim:>9.4f}"
                      f"{str(n)+'/'+str(len(vals)):>11}{marca}")
                saida.setdefault(gate, {}).setdefault(rotulo, {})[rot] = {
                    "media": statistics.mean(vals), "p90": p90,
                    "limiar": lim, "op": op, "passa": n, "n": len(vals),
                    "taxa_de_passagem": taxa, "sem_poder": cego,
                    "metrica_constante": morta,
                }
            print()

    print("=" * 96)
    print("LEITURA")
    print("=" * 96)
    for gate, pernas in saida.items():
        for perna, porbuild in pernas.items():
            if all(v["metrica_constante"] for v in porbuild.values()):
                print(f"  `{gate}` / {perna}: CONSTANTE em todas as partidas de todas")
                print(f"     as builds. A métrica não está viva — o gate não mede nada.")
            elif all(v["sem_poder"] for v in porbuild.values()):
                taxas = ", ".join(f"{r}={v['passa']}/{v['n']}" for r, v in porbuild.items())
                print(f"  `{gate}` / {perna}: sem poder discriminante ({taxas}).")
                print(f"     O limiar está fora da distribuição — o gate só amostra a")
                print(f"     cauda. Bloquear promoção por ele é reprovar por ruído.")

    dest = ROOT / "reports/r15/poder-dos-subgates.json"
    dest.write_text(json.dumps(saida, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"\nartefato: reports/r15/poder-dos-subgates.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
