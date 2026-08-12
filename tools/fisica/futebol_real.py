#!/usr/bin/env python3
"""Pontua uma medicao da bateria contra o FUTEBOL DE VERDADE.

Isto nao e o `placar.py`. Aquele mede o jogo contra
`calibration/targets.json` — as faixas que o proprio projeto escolheu, que
cobrem 13 metricas e foram desenhadas para preservar variedade e identidade
entre estilos. Um jogo pode passar em 13/13 la e ainda assim nao parecer
futebol, porque a lista nao pergunta quantos laterais acontecem nem quantos
impedimentos sao marcados.

Aqui a referencia e o futebol de elite (media das grandes ligas europeias e de
Copa do Mundo, por partida, SOMANDO os dois times). Sao faixas, nao pontos: o
futebol real varia bastante entre ligas — faltas na La Liga passam de 25 por
jogo enquanto a Premier League fica perto de 20 — e uma faixa honesta tem que
caber essa variacao.

Uso:
  python3 tools/fisica/futebol_real.py reports/os203-n300.json
  python3 tools/fisica/futebol_real.py depois.json antes.json   # compara
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# ─── faixas do futebol de elite, por partida, os dois times somados ──────────
# `fonte` diz de onde sai o numero: MEDIDO = estatistica corrente de liga;
# DERIVADO = consequencia aritmetica de outro numero desta mesma tabela.
REFERENCIA = {
    "gols": (2.5, 3.0, "MEDIDO  grandes ligas ~2,7-2,9; Copa 2022 ~2,7"),
    "finalizacoes": (22.0, 28.0, "MEDIDO  ~25 por partida nas grandes ligas"),
    "chutesNoAlvo": (7.5, 9.5, "MEDIDO  ~8-9, isto e ~1/3 das finalizacoes"),
    "acertoAoAlvo": (0.30, 0.40, "DERIVADO  chutesNoAlvo / finalizacoes"),
    "conversao": (0.09, 0.13, "DERIVADO  gols / finalizacoes"),
    "golPorChuteNoAlvo": (0.27, 0.38, "DERIVADO  gols / chutesNoAlvo"),
    "xg": (2.4, 3.0, "MEDIDO  xG total acompanha os gols de perto"),
    "passes": (750.0, 1000.0, "MEDIDO  ~900 nas grandes ligas; menos em jogo direto"),
    "acertoDePasse": (0.78, 0.87, "MEDIDO  ~83% na Premier League"),
    "faltas": (19.0, 26.0, "MEDIDO  ~20 na Premier League, >25 na La Liga"),
    "amarelos": (3.0, 5.5, "MEDIDO  ~3,9 na Premier League, mais no sul da Europa"),
    "vermelhos": (0.06, 0.22, "MEDIDO  ~0,10-0,15 por partida"),
    "escanteios": (9.0, 12.0, "MEDIDO  ~10,5 por partida"),
    "impedimentos": (2.5, 6.0, "MEDIDO  ~3-5 por partida, os dois times"),
    "laterais": (33.0, 48.0, "MEDIDO  ~40 por partida — o reinicio mais comum do futebol"),
    "tirosDeMeta": (11.0, 18.0, "MEDIDO  ~13-16 por partida"),
    "empates": (0.20, 0.30, "MEDIDO  ~24% nas grandes ligas"),
    "zeroAZero": (0.05, 0.10, "MEDIDO  ~7-8% das partidas"),
    "goleadas": (0.10, 0.18, "MEDIDO  vitoria por 3+; ~13-15%"),
    "golsTardios": (0.18, 0.30, "MEDIDO  fracao dos gols de 76' em diante, ~23%"),
    "golsNoSegundoTempo": (0.50, 0.60, "MEDIDO  ~55% dos gols saem no 2o tempo"),
}


def metricas(d: dict) -> dict:
    a = d["agregado"]
    por = d.get("porPartida") or []
    n = max(1, len(por))
    placares = [p["placar"] for p in por if p.get("placar")]

    m = lambda k: a[k]["media"] if k in a else None
    shots = m("shots") or 1e-9
    passes = m("passes") or 1e-9
    onT = m("onTarget") or 0.0
    gols = m("goals") or 0.0

    # ─ tempo dos gols: golsSeq traz o minuto de cada um ─
    minutos = [g["minuto"] for p in por for g in (p.get("golsSeq") or [])
               if g.get("minuto") is not None]
    tardios = sum(1 for x in minutos if x >= 76)
    segundoTempo = sum(1 for x in minutos if x > 45)

    out = {
        "gols": gols,
        "finalizacoes": m("shots"),
        "chutesNoAlvo": onT,
        "acertoAoAlvo": onT / shots,
        "conversao": gols / shots,
        "golPorChuteNoAlvo": (gols / onT) if onT else None,
        "xg": m("xg"),
        "passes": m("passes"),
        "acertoDePasse": (m("passOk") or 0) / passes,
        "faltas": m("fouls"),
        "amarelos": m("yellow"),
        "vermelhos": m("red"),
        "escanteios": m("corners"),
        "impedimentos": m("offsides"),
        "laterais": m("throwIns"),
        "tirosDeMeta": m("goalKicks"),
        "empates": sum(1 for s in placares if s[0] == s[1]) / n if placares else None,
        "zeroAZero": sum(1 for s in placares if s == [0, 0]) / n if placares else None,
        "goleadas": sum(1 for s in placares if abs(s[0] - s[1]) >= 3) / n if placares else None,
        "golsTardios": (tardios / len(minutos)) if minutos else None,
        "golsNoSegundoTempo": (segundoTempo / len(minutos)) if minutos else None,
    }
    out["__placares"] = placares
    out["__minutos"] = minutos
    out["__ritmo"] = (d.get("fisica") or {}).get("ritmoPorFaixa") or []
    out["__n"] = n
    return out


def desvio(valor, lo, hi):
    """Quanto o valor esta fora da faixa, em fracao da propria faixa."""
    if valor is None:
        return None
    if valor < lo:
        return -(lo - valor) / max(1e-9, hi - lo)
    if valor > hi:
        return (valor - hi) / max(1e-9, hi - lo)
    return 0.0


def fmt(v):
    if v is None:
        return "    —"
    return f"{v:8.3f}" if abs(v) < 3 else f"{v:8.2f}"


def main() -> None:
    atual = metricas(json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")))
    antes = metricas(json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))) if len(sys.argv) > 2 else {}

    print(f"FUTEBOL REAL — {Path(sys.argv[1]).name}   ({atual['__n']} partidas)\n")
    print(f"  {'':3} {'metrica':<20} {'medido':>8}  {'faixa real':>13}   fonte")
    print("  " + "-" * 96)

    dentro = fora = 0
    piores = []
    for k, (lo, hi, fonte) in REFERENCIA.items():
        v = atual.get(k)
        d = desvio(v, lo, hi)
        if d is None:
            print(f"  {'—':>3} {k:<20} (nao medido)")
            continue
        if d == 0:
            marca, dentro = " ok", dentro + 1
        else:
            marca, fora = ("BAI" if d < 0 else "ALT"), fora + 1
            piores.append((abs(d), k, v, lo, hi))
        faixa = f"{lo:g}–{hi:g}"
        extra = ""
        if antes.get(k) is not None:
            extra = f"   antes {fmt(antes[k]).strip()}"
        print(f"  {marca:>3} {k:<20} {fmt(v)}  {faixa:>13}   {fonte}{extra}")

    total = dentro + fora
    print(f"\n  {dentro}/{total} metricas dentro da faixa do futebol real")

    if piores:
        print("\n  MAIORES DESVIOS (em larguras de faixa):")
        for d, k, v, lo, hi in sorted(piores, reverse=True)[:6]:
            lado = "abaixo" if v < lo else "acima"
            razao = v / lo if v < lo else v / hi
            print(f"    {k:<20} {fmt(v)}  {lado} da faixa {lo:g}–{hi:g}"
                  f"   ({d:.1f}x a largura, {razao:.2f}x o limite)")

    # ─── distribuicao de placares: o futebol tem uma forma reconhecivel ───
    pl = atual["__placares"]
    if pl:
        print("\n  PLACARES MAIS COMUNS (o futebol real: 1-0, 1-1, 2-1, 2-0, 0-0)")
        cont = {}
        for s in pl:
            k = f"{max(s)}-{min(s)}"
            cont[k] = cont.get(k, 0) + 1
        for k, c in sorted(cont.items(), key=lambda x: -x[1])[:8]:
            print(f"    {k:>5}  {c/len(pl)*100:5.1f}%  {'#' * round(c / len(pl) * 100)}")

        # ─ o placar segue Poisson? e o teste classico de credibilidade ─
        gols_time = [s[0] for s in pl] + [s[1] for s in pl]
        lam = sum(gols_time) / len(gols_time)
        print(f"\n  AJUSTE A POISSON (media {lam:.2f} gols por time por partida)")
        print(f"    {'gols':>4}  {'observado':>9}  {'Poisson':>8}")
        for g in range(0, 6):
            obs = sum(1 for x in gols_time if x == g) / len(gols_time)
            esp = math.exp(-lam) * lam ** g / math.factorial(g)
            print(f"    {g:>4}  {obs*100:8.1f}%  {esp*100:7.1f}%")
        obs5 = sum(1 for x in gols_time if x >= 6) / len(gols_time)
        print(f"    {'6+':>4}  {obs5*100:8.1f}%  "
              f"{(1 - sum(math.exp(-lam)*lam**g/math.factorial(g) for g in range(6)))*100:7.1f}%")

    mins = atual["__minutos"]
    if mins:
        # ── AS FAIXAS NAO TEM A MESMA DURACAO, e isso distorcia este histograma.
        # Medido com tools/fisica/ramo-posse.js, 96 partidas, lendo `sim.minute`:
        #
        #     0-15, 16-30, 31-45, 61-75 .... 15,00 min de jogo por partida
        #     46-60 ........................ 18,70   (+25%)
        #     76+ .......................... 21,14   (+41%)
        #
        # O 76+ e aberto — vai ate o fim, acrescimos incluidos — entao ser maior
        # e esperado. O 46-60 e maior porque os ACRESCIMOS DO PRIMEIRO TEMPO
        # caem nele: o minuto 45,0-48,7 tem indice de faixa 3.
        #
        # Comparar percentuais BRUTOS entre faixas de tamanhos diferentes mede o
        # tamanho da faixa junto com o ritmo do jogo. O efeito nao e pequeno e
        # anda nos DOIS sentidos: inventa um pico no 46-60 e disfarca a queda do
        # 76+. Por isso o histograma passa a publicar as duas colunas — a bruta,
        # que e a que sempre foi citada, e a normalizada por minuto de jogo, que
        # e a comparavel.
        # A bateria publica isto desde 2026-08-12 (fisica.ritmoPorFaixa
        # [].minutosDeJogoPorPartida). Os valores abaixo sao so o fallback para
        # medicoes gravadas ANTES disso — se voce mudar o clockRate ou o calculo
        # de acrescimos, o fallback envelhece e a medida nova nao.
        FALLBACK = {"0-15": 15.00, "16-30": 15.00, "31-45": 15.00,
                    "46-60": 18.70, "61-75": 15.00, "76+": 21.14}
        ritmo = (atual.get("__ritmo") or [])
        DURACAO, medido = {}, False
        for item in ritmo:
            if isinstance(item, dict) and item.get("minutosDeJogoPorPartida"):
                DURACAO[item.get("faixa")] = item["minutosDeJogoPorPartida"]
                medido = True
        if not medido:
            DURACAO = FALLBACK
        print("\n  GOLS POR FAIXA DE 15 MINUTOS (o futebol real cresce ate o fim)")
        if not medido:
            print("    (duracao das faixas: FALLBACK — esta medicao e anterior ao campo"
                  " minutosDeJogoPorPartida)")
        print(f"    {'faixa':>7}  {'bruto':>6}  {'min':>5}  {'por minuto (normalizado)':<34}")
        faixas = [(0, 15), (16, 30), (31, 45), (46, 60), (61, 75), (76, 200)]
        linhas = []
        for lo, hi in faixas:
            c = sum(1 for x in mins if lo <= x <= hi)
            rot = f"{lo}-{hi}" if hi < 200 else f"{lo}+"
            dur = DURACAO.get(rot, FALLBACK.get(rot, 15.0))
            linhas.append((rot, c / len(mins) * 100, dur, (c / len(mins) * 100) / dur))
        tot = sum(x[3] for x in linhas) or 1
        for rot, bruto, dur, taxa in linhas:
            norm = 100 * taxa / tot
            print(f"    {rot:>7}  {bruto:5.1f}%  {dur:5.2f}  {norm:5.1f}%  {'#' * round(norm)}")
        prim, ult = linhas[0][3], linhas[-1][3]
        print(f"\n    inicio/fim por minuto de jogo: {prim/(ult or 1):.2f}x")
        print("    (no futebol de elite este numero e MENOR que 1 — o jogo cresce)")


if __name__ == "__main__":
    main()
