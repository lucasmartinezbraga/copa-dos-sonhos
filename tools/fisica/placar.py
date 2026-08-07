#!/usr/bin/env python3
"""Pontua uma medicao da bateria contra os alvos de design do proprio projeto.

`calibration/targets.json` sempre existiu, mas nada media o jogo contra ele de
ponta a ponta — o laboratorio que fazia isso (`tools/lab.js`) carrega so os
modulos do core, sem as 76 camadas, ou seja mede um jogo que ninguem joga.

Aqui a fonte e a bateria, que carrega o bundle inteiro.

Uso:
  python3 tools/fisica/placar.py reports/fisica-os200.json
  python3 tools/fisica/placar.py a.json b.json      # compara dois
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def metricas(d: dict) -> dict:
    """Traduz a saida da bateria para as chaves de calibration/targets.json."""
    a = d["agregado"]
    por = d.get("porPartida") or []
    n = max(1, len(por))
    placares = [p["placar"] for p in por if p.get("placar")]
    staminas = [p["staminaFinal"] for p in por if p.get("staminaFinal") is not None]

    empates = sum(1 for s in placares if s[0] == s[1])
    zeros = sum(1 for s in placares if s[0] == 0 and s[1] == 0)
    goleadas = sum(1 for s in placares if abs(s[0] - s[1]) >= 3)

    shots = a["shots"]["media"] or 1e-9
    passes = a["passes"]["media"] or 1e-9
    return {
        "goalsPerMatch": a["goals"]["media"],
        "shotsPerMatch": a["shots"]["media"],
        "xgPerMatch": a["xg"]["media"],
        "onTargetRate": a["onTarget"]["media"] / shots,
        "passCompletion": a["passOk"]["media"] / passes,
        "foulsPerMatch": a["fouls"]["media"],
        "yellowsPerMatch": a["yellow"]["media"],
        "redsPerMatch": a["red"]["media"],
        "cornersPerMatch": a["corners"]["media"],
        "drawRate": empates / n if placares else None,
        "zeroZeroRate": zeros / n if placares else None,
        "blowoutRate": goleadas / n if placares else None,
        "averageEndingStamina": (sum(staminas) / len(staminas)) if staminas else None,
    }


def avaliar(valor, alvo):
    """-1 abaixo do minimo, 0 dentro da faixa, +1 acima do maximo."""
    if valor is None:
        return None
    if valor < alvo["min"]:
        return -1
    if valor > alvo["max"]:
        return 1
    return 0


def linha(nome, valor, alvo, ref=None):
    if valor is None:
        return f"  {'—':>3} {nome:<22} (nao medido)"
    v = avaliar(valor, alvo)
    marca = {0: " ok", -1: "BAI", 1: "ALT"}[v]
    fmt = "%8.3f" if abs(valor) < 3 else "%8.2f"
    txt = f"  {marca:>3} {nome:<22} {fmt % valor}   faixa {alvo['min']}–{alvo['max']} (alvo {alvo['target']})"
    if ref is not None:
        txt += f"   antes {fmt % ref}"
    return txt


def main() -> None:
    alvos = json.loads((ROOT / "calibration/targets.json").read_text(encoding="utf-8"))["metrics"]
    atual = metricas(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")))
    antes = metricas(json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))) if len(sys.argv) > 2 else {}

    print(f"\nPLACAR CONTRA OS ALVOS DE DESIGN — {Path(sys.argv[1]).name}\n")
    dentro = fora = 0
    for chave, alvo in alvos.items():
        if chave not in atual:
            continue
        v = atual[chave]
        print(linha(chave, v, alvo, antes.get(chave)))
        r = avaliar(v, alvo)
        if r is None:
            continue
        dentro += 1 if r == 0 else 0
        fora += 1 if r != 0 else 0
    total = dentro + fora
    print(f"\n  {dentro}/{total} metricas dentro da faixa de design\n")


if __name__ == "__main__":
    main()
