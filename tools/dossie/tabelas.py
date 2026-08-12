#!/usr/bin/env python3
"""As 300 partidas em CSV — uma linha por partida, para você conferir sozinho.

NÃO renomeie este arquivo de volta para `csv.py`: `import csv` passaria a
importar ele mesmo e quebra com "module 'csv' has no attribute 'writer'".

Por que este arquivo existe
---------------------------
O dossiê publica agregados: média, desvio, erro-padrão. Quem quiser refazer a
conta, plotar outra coisa ou testar outra hipótese precisava escrever um parser
de `reports/*.json` antes de olhar o primeiro número.

Um CSV por medição resolve isso. Abre no Excel, no pandas, no que for. E serve
a um propósito específico deste projeto: **conferir se eu errei.** Sete
premissas deste catálogo caíram na medição; a próxima pode ser uma das que eu
dei por boa.

Uso:
  python3 tools/dossie/tabelas.py [destino] [medicao.json ...]
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]

COLUNAS = ["partida", "semente", "golsCasa", "golsFora", "empate", "goleada",
           "zeroAZero", "staminaFinal"]


def uma(fonte: Path, dest: Path) -> tuple[int, str]:
    d = json.loads(fonte.read_text(encoding="utf8"))
    por = d.get("porPartida") or []
    if not por:
        return 0, "sem porPartida"

    # As chaves por partida variam entre baterias antigas e novas; descobre as
    # metricas escalares presentes em vez de assumir uma lista fixa.
    extras = sorted({k for p in por for k, v in p.items()
                     if isinstance(v, (int, float)) and k not in COLUNAS})

    # A bateria nao grava a semente por partida (ela e derivada de
    # 4200000 + i*7919). Melhor nao publicar uma coluna vazia: reconstruo.
    base, passo = 4200000, 7919
    tem_semente = any(p.get("semente") is not None for p in por)

    with dest.open("w", newline="", encoding="utf8") as fh:
        w = csv.writer(fh)
        w.writerow(COLUNAS + extras)
        for i, p in enumerate(por, 1):
            s = p.get("placar") or [None, None]
            casa, fora = (s + [None, None])[:2]
            empate = goleada = zero = ""
            if casa is not None and fora is not None:
                empate = int(casa == fora)
                goleada = int(abs(casa - fora) >= 3)
                zero = int(casa == 0 and fora == 0)
            sem = p.get("semente") if tem_semente else base + (i - 1) * passo
            w.writerow([i, sem, casa, fora, empate, goleada, zero,
                        p.get("staminaFinal", "")]
                       + [p.get(k, "") for k in extras])
    return len(por), ", ".join(extras[:6]) + ("…" if len(extras) > 6 else "")


def main() -> int:
    dest = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "reports" / "csv"
    fontes = [Path(a) for a in sys.argv[2:]] or [
        p for p in [RAIZ / "reports" / "REFERENCIA.json",
                    RAIZ / "reports" / "_aceitar-depois.json",
                    RAIZ / "reports" / "fisica-os200.json"] if p.exists()]
    dest.mkdir(parents=True, exist_ok=True)

    for f in fontes:
        saida = dest / (f.stem.lstrip("_") + ".csv")
        n, cols = uma(f, saida)
        print(f"  {saida.name:<28} {n:>4} partidas   colunas extras: {cols or '(nenhuma)'}")

    (dest / "LEIA-ME.txt").write_text(
        "As partidas cruas, uma por linha.\n"
        "\n"
        "Gerado por: python3 tools/dossie/tabelas.py\n"
        "\n"
        "REFERENCIA.csv      o estado aceito atual — e contra ele que o portao compara\n"
        "aceitar-depois.csv  a ultima medicao feita (pode ser de uma mudanca REPROVADA)\n"
        "\n"
        "empate, goleada e zeroAZero sao derivadas aqui, do placar, para voce nao\n"
        "precisar recalcular. goleada = diferenca de 3 ou mais.\n"
        "\n"
        "semente: a bateria nao grava por partida — a coluna e RECONSTRUIDA por\n"
        "4200000 + (i-1) * 7919, que e a regra de pareamento da propria bateria.\n"
        "Se voce mudar essa regra la, mude aqui tambem ou a coluna vira ficcao.\n"
        "\n"
        "Estas tres colunas importam mais do que parecem: drawRate, blowoutRate e\n"
        "zeroZeroRate NAO estao entre as 14 metricas do portao de 2 SE. Foi por ai\n"
        "que uma regressao passou batida uma vez.\n"
        "\n"
        "Erro-padrao de uma proporcao (empate, goleada, zeroAZero):\n"
        "    SE = raiz( p * (1-p) / n )\n"
        "Com n = 300 e p perto de 0,2, SE fica em ~0,023. Uma diferenca menor que\n"
        "0,046 entre duas medicoes NAO e sinal.\n",
        encoding="utf8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
