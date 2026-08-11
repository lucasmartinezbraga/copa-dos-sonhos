#!/usr/bin/env python3
"""Compara duas medicoes da bateria e aplica o criterio de aceite.

O criterio, escrito uma vez para nao viver na cabeca de quem edita:

  Uma metrica SE MOVEU quando |delta| >= 2 x SE, com SE = desvio / raiz(n).

E a regra que reprovou a tentativa A3, escrita ANTES de ela ser tentada:

  Mover 2 SE PARA PIOR uma metrica que voce nao declarou que ia mexer
  reprova a mudanca, mesmo que o alvo declarado tenha melhorado.

Como este script nao sabe o que voce declarou, ele reprova QUALQUER movimento
de 2 SE e deixa a decisao explicita para quem le: se o movimento era esperado,
diga isso no commit e siga. O ponto e que ninguem descubra depois.

Uso:
  python3 tools/comparar.py antes.json depois.json
  python3 tools/comparar.py antes.json depois.json --identico
"""
from __future__ import annotations

import json
import math
import sys

CHAVES = ["shots", "onTarget", "goals", "xg", "corners", "fouls", "yellow", "red",
          "passes", "passOk", "tackles", "offsides", "throwIns", "goalKicks"]

# metricas em que subir e melhor / pior nao e obvio; so reportamos o movimento
NEUTRAS = {"corners", "throwIns", "goalKicks", "passes", "passOk", "tackles"}


def carregar(caminho: str) -> tuple[dict, int]:
    d = json.load(open(caminho, encoding="utf8"))
    return d["agregado"], int(d.get("partidas") or len(d.get("porPartida") or []) or 300)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    identico = "--identico" in sys.argv
    a, na = carregar(sys.argv[1])
    b, nb = carregar(sys.argv[2])

    print(f"{'metrica':<12} {'antes':>9} {'depois':>9} {'delta':>9} {'2 SE':>8}   veredito")
    print("-" * 68)

    moveu: list[str] = []
    difere: list[str] = []
    for k in CHAVES:
        if k not in a or k not in b:
            continue
        ma, mb = a[k]["media"], b[k]["media"]
        # SE do delta entre duas medias independentes
        sa = a[k].get("desvio", 0.0) / math.sqrt(max(na, 1))
        sb = b[k].get("desvio", 0.0) / math.sqrt(max(nb, 1))
        se2 = 2 * math.sqrt(sa * sa + sb * sb)
        delta = mb - ma
        if identico:
            v = "IDENTICO" if ma == mb else "DIFERE"
            if ma != mb:
                difere.append(k)
        elif abs(delta) >= se2:
            v = "MOVEU" + ("" if k in NEUTRAS else (" (subiu)" if delta > 0 else " (caiu)"))
            moveu.append(k)
        else:
            v = "ok"
        print(f"{k:<12} {ma:>9.3f} {mb:>9.3f} {delta:>+9.3f} {se2:>8.3f}   {v}")

    print()
    if identico:
        if difere:
            print(f"REPROVADO: {len(difere)} metrica(s) mudaram numa alteracao que "
                  f"NAO devia mudar comportamento: {', '.join(difere)}")
            print("Isso significa que a regiao editada NAO era morta, ou que a "
                  "edicao passou do escopo.")
            return 1
        print("APROVADO: as 14 metricas identicas ao digito, como esperado.")
        return 0

    if moveu:
        print(f"ATENCAO: {len(moveu)} metrica(s) se moveram 2 SE: {', '.join(moveu)}")
        print("Se algum destes movimentos era o OBJETIVO da mudanca, registre no")
        print("commit e siga. Se algum NAO era, a mudanca esta reprovada — foi")
        print("exatamente assim que a tentativa A3 foi rejeitada.")
        return 1
    print("APROVADO: nenhuma metrica se moveu 2 SE.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
