#!/usr/bin/env python3
"""O portao que faltava: uma metrica de design NAO pode sair da faixa.

Por que este arquivo existe
---------------------------
`tools/comparar.py` compara as 14 metricas agregadas da bateria com o criterio
de 2 SE. Ele e bom e nao basta: `drawRate`, `zeroZeroRate`, `blowoutRate` e
`averageEndingStamina` **nao estao entre as 14**. Sao derivadas da distribuicao
de placares, nao de uma media por partida.

No D11 isso apareceu na pratica. O `aceitar.sh` imprimiu

    APROVADO: nenhuma metrica se moveu 2 SE

para uma mudanca que levou o placar de design de 12/13 para 10/13:

    drawRate      0,270 -> 0,190   (3,53 SE)  SAIU da faixa 0,20-0,33
    blowoutRate   0,153 -> 0,197   (1,92 SE)  SAIU da faixa 0,09-0,19

O portao estava cego justamente para as metricas que dizem se os JOGOS sao
diferentes uns dos outros — e um jogo em que ninguem empata e todo mundo goleia
esta quebrado de um jeito que nenhuma media por partida denuncia.

O criterio
----------
REPROVA quando uma metrica que estava DENTRO da faixa sai dela. Nao exige
melhora, nao reprova por ruido dentro da faixa, e nao reprova metrica que ja
estava fora e continua fora (essa e a que voce provavelmente esta consertando).

Uso:
  python3 tools/regressao_design.py <base.json> <depois.json>

Saida: 0 aprovado, 1 reprovado.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "tools" / "fisica"))

from placar import metricas  # noqa: E402

ALVOS = json.loads((RAIZ / "calibration" / "targets.json").read_text(encoding="utf8"))

VERM, AMAR, VERD, FIM = "\033[31m", "\033[33m", "\033[32m", "\033[0m"

# Metricas que sao proporcao por partida — o erro-padrao e binomial, nao o
# desvio da media que a bateria publica.
PROPORCAO = {"drawRate", "zeroZeroRate", "blowoutRate", "onTargetRate", "passCompletion"}


def faixa(nome: str):
    a = ALVOS["metrics"].get(nome)
    if isinstance(a, dict) and "min" in a:
        return a["min"], a["max"]
    return None


def dentro(v, lo, hi) -> bool:
    return v is not None and lo <= v <= hi


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    base = json.loads(Path(sys.argv[1]).read_text(encoding="utf8"))
    dep = json.loads(Path(sys.argv[2]).read_text(encoding="utf8"))
    n = max(1, len(dep.get("porPartida") or []))

    ma, md = metricas(base), metricas(dep)
    saidas, entradas = [], []

    for nome, vd in md.items():
        f = faixa(nome)
        if not f:
            continue
        lo, hi = f
        va = ma.get(nome)
        antes_ok, depois_ok = dentro(va, lo, hi), dentro(vd, lo, hi)
        if antes_ok and not depois_ok:
            se = (math.sqrt(vd * (1 - vd) / n) if nome in PROPORCAO and 0 < vd < 1
                  else None)
            saidas.append((nome, va, vd, lo, hi, se))
        elif depois_ok and not antes_ok:
            entradas.append((nome, va, vd, lo, hi))

    for nome, va, vd, lo, hi in entradas:
        print(f"  {VERD}ENTROU{FIM}  {nome:<24} {va:.3f} -> {vd:.3f}   faixa {lo:g}-{hi:g}")
    for nome, va, vd, lo, hi, se in saidas:
        quanto = f"   = {abs(vd - va) / se:.2f} SE" if se else ""
        print(f"  {VERM}SAIU{FIM}    {nome:<24} {va:.3f} -> {vd:.3f}   "
              f"faixa {lo:g}-{hi:g}{quanto}")

    if saidas:
        print()
        print(f"{VERM}REPROVADO pelo placar de design: {len(saidas)} metrica(s) "
              f"saiu(ram) da faixa.{FIM}")
        print(f"{AMAR}As 14 metricas agregadas podem ter passado — elas nao contem "
              f"estas.{FIM}")
        print(f"{AMAR}Se a saida era o objetivo declarado da mudanca, diga isso no "
              f"commit. Se nao era, e regressao.{FIM}")
        return 1

    if entradas:
        print(f"{VERD}nenhuma metrica de design saiu da faixa; "
              f"{len(entradas)} entrou.{FIM}")
    else:
        print(f"{VERD}nenhuma metrica de design saiu da faixa.{FIM}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
