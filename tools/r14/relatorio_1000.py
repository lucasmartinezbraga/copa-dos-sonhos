#!/usr/bin/env python3
"""
Relatório da auditoria de 1000 partidas — R14.1 contra R13.0.

Rode quando as duas sondas terminarem:
    python tools/r14/relatorio_1000.py

Compara nos eixos que importam: travas (o P0), futebol observado (os gates da
R13.0) e cadência. Não inventa veredito — mostra número contra limite.
"""
import json, sys, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
D = ROOT / "reports/r14/auditoria-1000"


def carrega(nome):
    p = D / nome
    if not p.exists():
        return None
    try:
        return json.loads(p.read_bytes().decode("utf-8"))
    except Exception as e:
        print(f"  [{nome}] ainda incompleto: {e}")
        return None


def resume(d):
    res = d["results"]
    n = len(res)
    locks = [l for r in res for l in r.get("worstLocks", [])]
    sub = collections.Counter()
    status = collections.Counter()
    for r in res:
        of = r.get("observedFootball") or {}
        status[str(of.get("status"))] += 1
        for k, v in (of.get("gates") or {}).items():
            if not v:
                sub[k] += 1
    s = d["summary"]
    h = s.get("humanObserver", {})
    pm = s.get("perMatch", {})
    sp = s.get("setPieces", {})
    return {
        "partidas": n,
        "travas": sum(r["lockCount"] for r in res),
        "travasPorPartida": round(sum(r["lockCount"] for r in res) / max(n, 1), 2),
        "travas2p": sum(r["lockTwoPlayer"] for r in res),
        "piorTrava": max((r["lockMaxSec"] for r in res), default=0),
        "travas>=10s": sum(1 for l in locks if l["gameSec"] >= 10),
        "travas>=20s": sum(1 for l in locks if l["gameSec"] >= 20),
        "consistentes": sum(1 for r in res if r.get("canonicalStatus") == "CONSISTENT"),
        "observerPASS": status.get("FOOTBALL_OBSERVER_PASS", 0),
        "subgates": dict(sub),
        "gols": pm.get("goals"), "chutes": pm.get("shots"), "passes": pm.get("passes"),
        "laterais": pm.get("throwIns"), "escanteios": pm.get("corners"),
        "impedimentos": pm.get("offsides"),
        "cobertura": round(1 - h.get("uncoveredThreatRate", 0), 4),
        "ladoDoGol": round(h.get("goalSideCoverageRate", 0), 4),
        "distMarcador": round(h.get("markerMeanDistance", 0), 2),
        "linhasDesconectadas": h.get("disconnectedLineRate"),
        "corpoDivergente": h.get("bodyOrientationMismatchRate"),
        "escanteioEmGols": round(sp.get("cornerGoalShare", 0) * 100, 2),
    }


def linha(rot, a, b, fmt="{}", melhor=None):
    va, vb = a.get(rot[1]), b.get(rot[1]) if b else None
    if va is None:
        return
    sa = fmt.format(va)
    sb = fmt.format(vb) if vb is not None else "—"
    marca = ""
    if isinstance(va, (int, float)) and isinstance(vb, (int, float)) and melhor:
        if (melhor == "menor" and vb < va) or (melhor == "maior" and vb > va):
            marca = "  <-- R14.1 melhor"
        elif (melhor == "menor" and vb > va) or (melhor == "maior" and vb < va):
            marca = "  <-- R13.0 melhor"
    print(f"  {rot[0]:<34}{sa:>12}{sb:>12}{marca}")


def main():
    r13 = carrega("r13-1000.json")
    r14 = carrega("r14-1000.json")
    if not r14:
        print("A sonda da R14.1 ainda não terminou. Progresso:")
        for f in ("r14-1000.log", "r13.log"):
            p = D / f
            if p.exists():
                n = p.read_bytes().decode("utf-8", "replace").count("[lock] partida")
                print(f"  {f}: {n}/1000")
        return 1
    A = resume(r13) if r13 else {}
    B = resume(r14)

    print(f"\nAUDITORIA DE {B['partidas']} PARTIDAS\n")
    print(f"  {'':<34}{'R13.0':>12}{'R14.1':>12}")
    print("  " + "-" * 58)
    print("  P0 — TRAVA DA BOLA")
    for rot in [("travas totais", "travas"), ("travas por partida", "travasPorPartida"),
                ("travas de 2 jogadores", "travas2p"), ("pior trava (s)", "piorTrava"),
                ("travas >= 10s", "travas>=10s"), ("travas >= 20s", "travas>=20s")]:
        linha(rot, A, B, "{}", "menor")
    print("\n  INTEGRIDADE")
    for rot in [("partidas CONSISTENT", "consistentes"), ("observer PASS", "observerPASS")]:
        linha(rot, A, B, "{}", "maior")
    print("\n  FUTEBOL OBSERVADO")
    for rot, m in [(("gols/partida", "gols"), None), (("chutes/partida", "chutes"), None),
                   (("passes/partida", "passes"), None), (("laterais/partida", "laterais"), None),
                   (("escanteios/partida", "escanteios"), None),
                   (("impedimentos/partida", "impedimentos"), None),
                   (("cobertura de ameaças", "cobertura"), "maior"),
                   (("cobertura lado do gol", "ladoDoGol"), "maior"),
                   (("dist. média do marcador (m)", "distMarcador"), "menor"),
                   (("gols de escanteio (%)", "escanteioEmGols"), None)]:
        linha(rot, A, B, "{}", m)
    print("\n  SUB-GATES REPROVADOS (partidas)")
    todas = set(A.get("subgates", {})) | set(B["subgates"])
    for k in sorted(todas):
        print(f"  {k:<34}{A.get('subgates',{}).get(k,0):>12}{B['subgates'].get(k,0):>12}")

    out = D / "RELATORIO-1000.json"
    out.write_bytes(json.dumps({"r13": A, "r14": B}, ensure_ascii=False, indent=1).encode("utf-8"))
    print(f"\n[gravado] {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
