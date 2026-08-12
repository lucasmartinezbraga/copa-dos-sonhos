#!/usr/bin/env python3
"""Teste do portao de regressao de design.

Um portao que nunca reprovou nada nao esta testado — esta calado. Este arquivo
constroi medicoes sinteticas e exige que `tools/regressao_design.py` responda
certo nos quatro casos que importam:

  1. metrica DENTRO da faixa que SAI          -> reprova (exit 1)
  2. metrica que ja estava FORA e continua    -> aprova  (nao e regressao nova)
  3. metrica que estava fora e ENTRA          -> aprova
  4. ruido dentro da faixa                    -> aprova

O caso 1 usa os numeros reais do D11 — a regressao que passou batida pelo
criterio de 2 SE e deu origem a este portao.

Uso: python3 tests/regressao_design_test.py
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
PORTAO = RAIZ / "tools" / "regressao_design.py"


def medicao(empates: int, goleadas: int, zeros: int = 24, n: int = 300,
            stamina: float = 64.3) -> dict:
    """Uma medicao sintetica com a distribuicao de placares pedida.

    So preciso que `placar.py` consiga derivar drawRate / blowoutRate /
    zeroZeroRate — entao os placares sao construidos, nao simulados.
    """
    por = []
    for i in range(n):
        if i < empates:
            placar = [0, 0] if i < zeros else [1, 1]
        elif i < empates + goleadas:
            placar = [4, 0]
        else:
            placar = [2, 1]
        por.append({"placar": placar, "staminaFinal": stamina})

    med = lambda v: {"media": v, "desvio": 0.0, "erroPadrao": 0.0}
    return {
        "agregado": {k: med(v) for k, v in {
            "shots": 23.7, "onTarget": 7.6, "goals": 2.87, "xg": 3.01,
            "corners": 11.3, "fouls": 22.1, "yellow": 4.49, "red": 0.26,
            "passes": 384.7, "passOk": 314.3, "tackles": 49.8, "offsides": 5.2,
            "throwIns": 15.8, "goalKicks": 13.0,
        }.items()},
        "porPartida": por,
    }


def roda(antes: dict, depois: dict) -> tuple[int, str]:
    with tempfile.TemporaryDirectory() as d:
        a, b = Path(d) / "a.json", Path(d) / "b.json"
        a.write_text(json.dumps(antes), encoding="utf8")
        b.write_text(json.dumps(depois), encoding="utf8")
        r = subprocess.run([sys.executable, str(PORTAO), str(a), str(b)],
                           capture_output=True, text=True)
        return r.returncode, r.stdout


CASOS = [
    # nome                                        antes            depois           reprova?
    ("1 · drawRate sai da faixa (o caso D11)",    (81, 46),        (57, 59),        True),
    ("2 · ja estava fora e continua fora",        (57, 59),        (55, 60),        False),
    ("3 · estava fora e entra na faixa",          (57, 59),        (81, 46),        False),
    ("4 · ruido dentro da faixa",                 (81, 46),        (78, 44),        False),
]


def main() -> int:
    falhas = 0
    for nome, (ea, ga), (ed, gd), esperava_reprovar in CASOS:
        codigo, saida = roda(medicao(ea, ga), medicao(ed, gd))
        reprovou = codigo == 1
        ok = reprovou == esperava_reprovar
        falhas += not ok
        marca = "  ok  " if ok else "FALHOU"
        print(f"  {marca}  {nome}")
        print(f"          esperava {'REPROVAR' if esperava_reprovar else 'aprovar'}, "
              f"portao {'reprovou' if reprovou else 'aprovou'} (exit {codigo})")
        if not ok:
            print("          --- saida do portao ---")
            for ln in saida.strip().splitlines():
                print(f"          {ln}")

    print()
    if falhas:
        print(f"\033[31m{falhas} de {len(CASOS)} casos falharam.\033[0m")
        return 1
    print(f"\033[32mtodos os {len(CASOS)} casos passaram — o portao reprova o que deve "
          f"e so o que deve.\033[0m")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
