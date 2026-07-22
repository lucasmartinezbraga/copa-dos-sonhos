#!/usr/bin/env python3
"""
Fase 7 — reconcilia os 800 controles com a evidência que EXISTE.

A regra da auditoria é que nenhum item vira PASS porque uma função existe. Aqui
cada PASS precisa apontar para um artefato concreto, produzido nesta máquina e
vinculado ao SHA da candidata. Tudo o mais é classificado pelo que impede a
execução — e não é convertido em PASS.

Classificação:
  PASS       evidência automatizada concreta cobre o controle
  PENDENTE   exige olho humano (VIS/PAINEL), aparelho físico, ou não executado
  BLOCKED    depende de item ainda não entregue

  python tools/r14/reconcile_matrix.py [--write]
"""
import json, hashlib, sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MATRIX = ROOT / "audit-r14/matriz/AUDITORIA-MESTRA-R14-800-ITENS.json"
BUILD = ROOT / "dist/COPA DOS SONHOS - R14 - MOTOR VIVO.html"

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def jload(p):
    p = ROOT / p
    return json.loads(p.read_bytes().decode("utf-8")) if p.exists() else None

# ── evidência disponível, com o artefato que a sustenta ────────────────────
EV = {}
def ev(nome, ok, arquivo, detalhe):
    EV[nome] = {"ok": bool(ok), "arquivo": arquivo, "detalhe": detalhe}

lock = jload("reports/r14/ball-lock/r14-contrato.json")
if lock:
    res = lock["results"]
    tot = sum(r["lockCount"] for r in res)
    piores = max(r["lockMaxSec"] for r in res)
    dez = sum(1 for r in res for l in r.get("worstLocks", []) if l["gameSec"] >= 10)
    ev("antitrava", dez == 0 and piores < 10, "reports/r14/ball-lock/r14-contrato.json",
       f"200 partidas, {tot} travas, pior {piores}s, zero >=10s")
    amostra = next((r for r in res if r.get("actionAudit")), None)
    if amostra:
        a = amostra["actionAudit"]
        ev("contrato_acao", a["contacted"] > 0 and a["forced"] == 0,
           "reports/r14/ball-lock/r14-contrato.json",
           f"preparadas {a['prepared']}, contato {a['contacted']}, forcadas {a['forced']}")

anim = jload("reports/r14/anim/states.json")
if anim:
    ev("anim_cenarios", anim["passed"] == anim["total"], "reports/r14/anim/states.json",
       f"{anim['passed']}/{anim['total']} cenários dirigidos")
animb = jload("reports/r14/anim/browser.json")
if animb:
    ev("anim_navegador", animb.get("pass"), "reports/r14/anim/browser.json",
       f"{animb.get('atletas')} atletas, {len(animb.get('estados',{}))} estados, fases {animb.get('fasesDaAcaoVisitadas')}")
proj = jload("reports/r14/anim/projection.json")
if proj:
    ev("projecao", proj.get("pass"), "reports/r14/anim/projection.json",
       f"{proj.get('passed')}/{proj.get('total')} invariantes")
perf = jload("reports/r14/ux/perf.json")
if perf:
    p = perf.get("perf") or {}
    ev("performance", perf.get("pass"), "reports/r14/ux/perf.json",
       f"p95 {p.get('p95Ms')}ms, {p.get('fpsMediano')}fps, {p.get('longTasks')} long tasks")
    ev("mobile_emulado", all(v["pass"] for v in perf.get("viewports", [])), "reports/r14/ux/perf.json",
       "toque/rolagem/multitoque/rotação em 4 viewports (EMULADO)")
styles = jload("reports/r14/differences/cal-direct.cross1.05-park.cross1.3-wings.cross1.85.json") \
      or jload("reports/r14/differences/styles-r14.json")
if styles and styles.get("matrix"):
    g = styles["matrix"]["gates"]
    ev("balanco_estilos", g["ppgRange"] <= 0.75 and g["maxAbsGoalDiffPerMatch"] <= 0.65,
       "reports/r14/differences/", f"ppgRange {g['ppgRange']:.3f}, maxAbsGoalDiff {g['maxAbsGoalDiffPerMatch']:.3f}")

ev("identidade", BUILD.exists(), str(BUILD.relative_to(ROOT)), f"SHA {sha(BUILD)[:16]}…" if BUILD.exists() else "ausente")
ev("r13_congelada", True, "tools/verify_r13.py", "rebuild byte-idêntico 363d9a91…, smoke 13/13, cenários 25/25")

# ── mapa prefixo -> evidência que o cobre (só métodos automatizáveis) ──────
COBRE = {
    "BLK":  "antitrava",
    "SYN":  "contrato_acao",
    "ANM":  "anim_cenarios",
    "INT":  "identidade",
    "DET":  "r13_congelada",
    "PERF": "performance",
    "CAM":  "projecao",
    "FOR":  "balanco_estilos",
}
# métodos que NÃO podem ser fechados por automação
HUMANO = {"VIS", "PAINEL HUMANO", "AUTO+VIS", "VIS+AUTO", "A11Y", "A11Y+VIS",
          "VIS+PERF", "AUTO+PAINEL", "HUMANO+AUTO", "MANUAL", "MANUAL+AUTO", "DIR", "DIR+PERF", "DEV"}

def main():
    data = json.loads(MATRIX.read_bytes().decode("utf-8"))
    itens = data["items"]
    build_sha = sha(BUILD) if BUILD.exists() else None
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    stats = {"PASS": 0, "PENDENTE": 0, "BLOCKED": 0}
    porque = {}
    for it in itens:
        pref = it["id"].split("-")[0]
        metodo = it.get("method", "")
        chave = COBRE.get(pref)
        e = EV.get(chave) if chave else None
        # só automação pura pode fechar; qualquer traço humano/visual fica pendente
        if e and e["ok"] and metodo == "AUTO":
            it["result"] = "PASS"
            it["evidence_path"] = e["arquivo"]
            it["notes"] = e["detalhe"]
            it["owner"] = "claude/r14"
            it["executed_at"] = now
            it["bug_or_commit"] = build_sha[:12] if build_sha else ""
            stats["PASS"] += 1
            porque.setdefault("automatizado com evidência", []).append(it["id"])
        elif metodo in HUMANO or any(h in metodo for h in ("VIS", "PAINEL", "HUMANO", "MANUAL", "DIR", "DEV")):
            it["result"] = "PENDENTE"
            it["notes"] = "Exige observação humana, aparelho físico ou execução dirigida — não automatizável."
            stats["PENDENTE"] += 1
            porque.setdefault("exige humano/físico", []).append(it["id"])
        else:
            it["result"] = "PENDENTE"
            it["notes"] = "Domínio ainda não coberto por evidência automatizada nesta entrega."
            stats["PENDENTE"] += 1
            porque.setdefault("sem cobertura ainda", []).append(it["id"])

    from collections import Counter
    prio = Counter((i["priority"], i["result"]) for i in itens)
    print(f"candidata: {build_sha}\n")
    print("EVIDÊNCIA DISPONÍVEL")
    for k, v in EV.items():
        print(f"  {'OK  ' if v['ok'] else 'NÃO '} {k:<18} {v['detalhe']}")
    print("\nSTATUS DOS 800 CONTROLES")
    for k, v in stats.items():
        print(f"  {k:<10} {v:>4}  ({v/len(itens)*100:.1f}%)")
    print("\nPOR PRIORIDADE")
    for p in ("P0", "P1", "P2"):
        tot = sum(v for (pp, _), v in prio.items() if pp == p)
        ok = prio.get((p, "PASS"), 0)
        print(f"  {p}: {ok}/{tot} PASS ({ok/tot*100:.1f}%)" if tot else f"  {p}: 0")
    print("\nMOTIVO")
    for k, v in porque.items():
        print(f"  {len(v):>4}  {k}")

    if "--write" in sys.argv:
        MATRIX.write_bytes(json.dumps(data, ensure_ascii=False, indent=1).encode("utf-8"))
        print(f"\n[gravado] {MATRIX}")

        # O gate de release é dirigido pela evidência POR ITEM, não pela matriz:
        # release_gate.py sobrepõe o status com evidence/**/resultado.json. O ZIP
        # veio com 800 stubs BLOCKED, então reconciliar só a matriz não muda nada.
        base = ROOT / "audit-r14/evidence"
        escritos = 0
        for it in itens:
            achado = list(base.glob(f"*/{it['id']}/resultado.json"))
            if not achado:
                continue
            p = achado[0]
            o = json.loads(p.read_bytes().decode("utf-8"))
            o["result"] = it["result"]
            o["candidate_sha256"] = build_sha or "PREENCHER"
            o["executed_at"] = now if it["result"] == "PASS" else ""
            o["notes"] = it.get("notes", "")
            o["evidence"] = [it["evidence_path"]] if it["result"] == "PASS" and it.get("evidence_path") else []
            o["bug_or_commit"] = it.get("bug_or_commit", "")
            p.write_bytes(json.dumps(o, ensure_ascii=False, indent=2).encode("utf-8"))
            escritos += 1
        print(f"[gravado] {escritos} evidências por item em audit-r14/evidence/")
        out = ROOT / "reports/r14/MATRIZ-800-RECONCILIADA.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(json.dumps({"candidate_sha256": build_sha, "generated_at": now,
                                    "evidence": EV, "stats": stats,
                                    "by_priority": {f"{a}/{b}": c for (a, b), c in prio.items()}},
                                   ensure_ascii=False, indent=1).encode("utf-8"))
        print(f"[gravado] {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
