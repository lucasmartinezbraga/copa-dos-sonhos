#!/usr/bin/env python3
"""Teste do auditor — contra os positivos que este projeto ja pagou para achar.

Um detector que nunca apontou nada nao esta testado, esta calado. Este arquivo
prova, com arquivos sinteticos, que cada forma:

  - APONTA o caso conhecido, e
  - CALA quando o caso foi consertado.

A segunda metade importa tanto quanto a primeira: detector que aponta sempre
vira ruido, e ruido ninguem le.

O caso da forma 1 e literal — e o `staminaF` do D19, com a constante do core
`0.7 + p.stamina/100 * 0.3` repetida na camada 16 como
`.7+finite(p.stamina,75)/100*.3`. A primeira versao do regex nao aceitava
virgula e por isso nao pegava `finite(...,75)`: o unico positivo conhecido
passava batido.

Uso: python3 tests/auditor_test.py
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "tools"))

import auditor  # noqa: E402

MOTOR_FALSO = """
class MatchSim {
  _integrate(p, tx, ty, dt, freeze) {
    const staminaF = 0.7 + p.stamina/100 * 0.3;
    const vmax = p.maxSpd * staminaF;
    return vmax;
  }
}
"""

CAMADA_QUE_REPETE = """
P._integrate=function(p,tx,ty,dt,freeze){
  const staminaF=.7+finite(p.stamina,75)/100*.3;
  return finite(p.maxSpd,7)*staminaF;
};
"""

CAMADA_CORRIGIDA = """
P._integrate=function(p,tx,ty,dt,freeze){
  const staminaF=.80+finite(p.stamina,75)/100*.20;
  return finite(p.maxSpd,7)*staminaF;
};
"""


def ritmo(chutes: list[float], segundos: float = 300.0) -> Path:
    """Uma medicao sintetica com a serie de chutes pedida, por faixa."""
    d = {"fisica": {"ritmoPorFaixa": [
        {"faixa": f, "segundosPorPartida": segundos, "chutes": c,
         "gols": 0.5, "passes": 60.0}
        for f, c in zip(["0-15", "16-30", "31-45", "46-60", "61-75", "76+"], chutes)]}}
    p = Path(tempfile.mkstemp(suffix=".json")[1])
    p.write_text(json.dumps(d), encoding="utf8")
    return p


def main() -> int:
    falhas = []

    def checa(nome: str, condicao: bool, detalhe: str = "") -> None:
        print(f"  {'  ok  ' if condicao else 'FALHOU'}  {nome}")
        if not condicao:
            falhas.append(nome)
            if detalhe:
                print(f"          {detalhe}")

    # ── forma 1 ──────────────────────────────────────────────────────────────
    with tempfile.TemporaryDirectory() as d:
        base = Path(d)
        motor = base / "motor.js"; motor.write_text(MOTOR_FALSO, encoding="utf8")
        repete = base / "16-camada.js"; repete.write_text(CAMADA_QUE_REPETE, encoding="utf8")
        limpa = base / "16-corrigida.js"; limpa.write_text(CAMADA_CORRIGIDA, encoding="utf8")

        achou = auditor.forma1(motor, [repete])
        checa("forma 1 APONTA a constante sombreada (o caso staminaF do D19)",
              len(achou) == 1 and "_integrate" in achou[0],
              f"devolveu {achou!r}")
        checa("forma 1 nomeia a constante repetida",
              bool(achou) and "0.7+x/100*0.3" in achou[0], f"devolveu {achou!r}")

        calou = auditor.forma1(motor, [limpa])
        checa("forma 1 CALA depois do conserto", calou == [], f"devolveu {calou!r}")

    # ── forma 3 ──────────────────────────────────────────────────────────────
    caindo = ritmo([1.16, 1.13, 1.05, 1.02, 1.06, 0.84])      # a serie real do D19
    achou3 = auditor.forma3(caindo)
    checa("forma 3 APONTA a deriva monotona (chutes caindo)",
          any("chutes" in a and "CAI" in a for a in achou3), f"devolveu {achou3!r}")

    plano = ritmo([1.05, 1.02, 1.06, 1.03, 1.05, 1.04])
    achou3b = auditor.forma3(plano)
    checa("forma 3 CALA quando a serie e plana",
          not any("chutes" in a for a in achou3b), f"devolveu {achou3b!r}")

    # a armadilha B3: totais brutos confundem tamanho de faixa com ritmo.
    # A faixa 46-60 recebe mais simulacao; sem normalizar, a serie do D19 deixa
    # de parecer monotona e a forma 3 fica calada com o defeito na frente dela.
    d = json.loads(caindo.read_text(encoding="utf8"))
    for i, f in enumerate(d["fisica"]["ritmoPorFaixa"]):
        f["segundosPorPartida"] = 500.0 if i == 3 else 300.0
        f["chutes"] = f["chutes"] * f["segundosPorPartida"] / 300.0
    desigual = Path(tempfile.mkstemp(suffix=".json")[1])
    desigual.write_text(json.dumps(d), encoding="utf8")
    achou3c = auditor.forma3(desigual)
    checa("forma 3 continua APONTANDO com faixas de duracoes diferentes",
          any("chutes" in a and "CAI" in a for a in achou3c),
          f"devolveu {achou3c!r} — normalizacao por tempo de faixa quebrou")

    print()
    if falhas:
        print(f"\033[31m{len(falhas)} caso(s) falharam.\033[0m")
        return 1
    print("\033[32mtodos os casos passaram — o auditor aponta o que deve e cala "
          "quando deve.\033[0m")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
