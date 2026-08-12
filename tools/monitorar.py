#!/usr/bin/env python3
"""PAINEL — está dando resultado ou não?

Le todas as medicoes historicas em ordem de release, cruza com as faixas de
`calibration/targets.json` e responde, metrica por metrica:

  DENTRO       ja esta na faixa e nao saiu
  CONVERGINDO  esta fora, mas se aproximando
  PARADA       esta fora e nao se move
  AFASTANDO    esta fora e piorando            <- o unico que exige acao
  SAIU         estava dentro e saiu            <- regressao

O ponto nao e ter um numero bonito: e saber se o TRABALHO esta produzindo
efeito. Uma metrica parada ha cinco releases nao precisa de mais uma tentativa
do mesmo tipo — precisa de outro diagnostico.

Uso:
  python3 tools/monitorar.py              # imprime o painel e grava painel.json
  python3 tools/monitorar.py --html       # + reports/pdf/PAINEL.html
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]

# ordem cronologica real das medicoes (release a release)
SERIE = [
    ("OS-200", "reports/fisica-os200.json", "integracao numerica entra"),
    ("OS-201", "reports/fisica-os201.json", "clockRate 0,13 -> 0,085"),
    ("OS-202", "reports/fisica-os202.json", "perseguicao e ritmo"),
    ("OS-203", "reports/os203-n300.json", "o passe rasteiro para de quicar"),
    ("OS-206", "reports/os206-final.json", "o portador ganha um plano"),
    ("A1", "reports/a1-n300.json", "impedimento no _bestPass"),
    ("A2", "reports/a2-goleiro-n300.json", "o goleiro escolhe onde mergulha"),
    ("F1", "reports/REFERENCIA.json", "limpeza e a 2a fisica em _looseRoll"),
]

# metrica da bateria -> (chave em targets.json, como derivar do agregado)
MAPA = {
    "goals": ("goalsPerMatch", lambda a: a["goals"]["media"]),
    "shots": ("shotsPerMatch", lambda a: a["shots"]["media"]),
    "xg": ("xgPerMatch", lambda a: a["xg"]["media"]),
    "onTargetRate": ("onTargetRate", lambda a: a["onTarget"]["media"] / max(a["shots"]["media"], 1e-9)),
    "passCompletion": ("passCompletion", lambda a: a["passOk"]["media"] / max(a["passes"]["media"], 1e-9)),
    "fouls": ("foulsPerMatch", lambda a: a["fouls"]["media"]),
    "yellow": ("yellowsPerMatch", lambda a: a["yellow"]["media"]),
    "red": ("redsPerMatch", lambda a: a["red"]["media"]),
    "corners": ("cornersPerMatch", lambda a: a["corners"]["media"]),
}
# Metricas do futebol de elite que nao estao em targets.json. As faixas sao as
# do placar de futebol real (tools/fisica/futebol_real.py) e valem para os DOIS
# times somados, que e como a bateria conta.
#   ESTIMADA = faixa que eu derivei, nao publicada no projeto. Marcada como tal
#   para nao virar alvo com aparencia de medicao.
REAL = {
    "throwIns": (33.0, 48.0, lambda a: a["throwIns"]["media"], "laterais", False),
    "offsides": (2.5, 6.0, lambda a: a["offsides"]["media"], "impedimentos", False),
    "tackles": (30.0, 45.0, lambda a: a["tackles"]["media"], "desarmes (faixa ESTIMADA)", True),
}


def carregar() -> list[dict]:
    alvos = json.loads((RAIZ / "calibration/targets.json").read_text(encoding="utf8"))["metrics"]
    pontos = []
    for nome, caminho, nota in SERIE:
        p = RAIZ / caminho
        if not p.exists():
            continue
        d = json.loads(p.read_text(encoding="utf8"))
        a = d.get("agregado")
        if not a:
            continue
        vals = {}
        for m, (chave, fn) in MAPA.items():
            try:
                vals[m] = (fn(a), alvos[chave]["min"], alvos[chave]["max"], chave)
            except Exception:
                pass
        for m, (lo, hi, fn, rot, _est) in REAL.items():
            try:
                vals[m] = (fn(a), lo, hi, rot)
            except Exception:
                pass
        pontos.append({"release": nome, "nota": nota, "n": d.get("partidas"), "vals": vals})
    return pontos


def veredito(serie: list[float], lo: float, hi: float) -> tuple[str, str]:
    """Classifica a trajetoria. Devolve (codigo, explicacao)."""
    def fora(v: float) -> float:
        if v < lo: return lo - v
        if v > hi: return v - hi
        return 0.0

    atual = serie[-1]
    d_atual = fora(atual)
    if d_atual == 0:
        antes = [fora(v) for v in serie[:-1]]
        if antes and antes[-1] == 0:
            return "DENTRO", "na faixa e estavel"
        return "ENTROU", "entrou na faixa"
    # esta fora: olha as ultimas tres medicoes
    janela = serie[-3:] if len(serie) >= 3 else serie
    ds = [fora(v) for v in janela]
    if len(ds) < 2:
        return "PARADA", "sem historico suficiente"
    delta = ds[-1] - ds[0]
    largura = max(hi - lo, 1e-9)
    passos = max(len(ds) - 1, 1)
    ritmo = -delta / passos            # quanto encosta por medicao
    if delta < -0.02 * largura:
        # "convergindo" so ajuda se disser QUANTO FALTA no ritmo atual. Uma
        # metrica que anda 0,3 com 4,8 de distancia precisa de 16 releases —
        # chamar isso de convergindo sem o prazo e enganoso.
        faltam = d_atual / ritmo if ritmo > 1e-9 else 999
        if faltam > 8:
            return ("QUASE PARADA",
                    f"aproximou so {abs(delta):.2f} em {passos} medicao(oes); "
                    f"faltam {d_atual:.2f} — neste ritmo, ~{faltam:.0f} medicoes para entrar")
        return ("CONVERGINDO",
                f"aproximou {abs(delta):.2f} em {passos} medicao(oes); "
                f"faltam {d_atual:.2f} — neste ritmo, ~{faltam:.0f} medicoes para entrar")
    if delta > 0.02 * largura:
        return "AFASTANDO", f"afastou {delta:.2f} nas ultimas {len(ds)} medicoes"
    # estava dentro em algum momento?
    if any(fora(v) == 0 for v in serie[:-1]):
        return "SAIU", "ja esteve na faixa e saiu"
    return "PARADA", f"fora ha {sum(1 for v in serie if fora(v) > 0)} medicoes, sem movimento"


ICONE = {"DENTRO": "ok", "ENTROU": "ok", "CONVERGINDO": "→", "QUASE PARADA": "~",
         "PARADA": "—", "AFASTANDO": "!!", "SAIU": "!!"}


def main() -> int:
    pontos = carregar()
    if not pontos:
        print("nenhuma medicao encontrada", file=sys.stderr)
        return 1
    metricas = sorted({m for p in pontos for m in p["vals"]})
    painel = {"gerado_em": "2026-08-12", "releases": [p["release"] for p in pontos], "metricas": {}}

    largura = 74
    print()
    print("PAINEL — o trabalho esta dando resultado?")
    print("=" * largura)
    print(f"{len(pontos)} medicoes, de {pontos[0]['release']} a {pontos[-1]['release']}\n")

    contagem: dict[str, int] = {}
    for m in metricas:
        serie = [p["vals"][m][0] for p in pontos if m in p["vals"]]
        if len(serie) < 2:
            continue
        _, lo, hi, rot = pontos[-1]["vals"][m]
        cod, expl = veredito(serie, lo, hi)
        contagem[cod] = contagem.get(cod, 0) + 1
        painel["metricas"][m] = {
            "rotulo": rot, "serie": [round(v, 4) for v in serie],
            "faixa": [lo, hi], "atual": round(serie[-1], 4),
            "veredito": cod, "explicacao": expl,
        }
        seta = "".join("+" if serie[i] > serie[i - 1] else ("-" if serie[i] < serie[i - 1] else "=")
                       for i in range(1, len(serie)))
        print(f"  {ICONE[cod]:<3} {m:<15} {serie[-1]:>8.3f}   faixa {lo:g}-{hi:g}"
              f"   {cod:<12} {seta}")
        if cod in ("AFASTANDO", "SAIU", "PARADA", "QUASE PARADA"):
            print(f"      {expl}")

    print("\n" + "-" * largura)
    resumo = "  ".join(f"{k}: {v}" for k, v in sorted(contagem.items()))
    print(f"  {resumo}")
    acao = contagem.get("AFASTANDO", 0) + contagem.get("SAIU", 0)
    parada = contagem.get("PARADA", 0) + contagem.get("QUASE PARADA", 0)
    print()
    if acao:
        print(f"  {acao} metrica(s) PIORANDO — e onde olhar primeiro.")
    if parada:
        print(f"  {parada} metrica(s) PARADAS ha varias medicoes. Mais uma tentativa do")
        print("  mesmo tipo nao vai mover: essas precisam de outro diagnostico.")
    if not acao and not parada:
        print("  Nenhuma metrica piorando ou parada.")
    print()

    (RAIZ / "reports/painel.json").write_text(json.dumps(painel, ensure_ascii=False, indent=1), encoding="utf8")
    print(f"  gravado em reports/painel.json")
    if "--html" in sys.argv:
        from painel_html import gerar  # type: ignore
        gerar(painel, pontos)
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent / "dossie"))
    raise SystemExit(main())
