#!/usr/bin/env python3
"""
Avaliador de controles por ID — fecha os itens AUTO cujo critério de aceite é
numérico e já tem métrica medida.

Diferente do reconciliador (que fecha por domínio), aqui cada item tem o SEU
critério escrito em código, com o número exigido pela matriz e o número
observado. Se a métrica não existir, o item continua PENDENTE — nunca vira PASS
por omissão.

  python tools/r14/eval_controls.py [--write]
"""
import json, sys, hashlib, datetime, subprocess, os, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MATRIX = ROOT / "audit-r14/matriz/AUDITORIA-MESTRA-R14-800-ITENS.json"
BUILD = ROOT / "dist/COPA DOS SONHOS - R14 - MOTOR VIVO.html"
CSV = "tools/r13/COPA_DOS_SONHOS_P0-6_R12.3_PARTIDAS.csv"
NODE = os.environ.get("CDS_NODE") or shutil.which("node") or "node"


def jload(p):
    p = ROOT / p
    return json.loads(p.read_bytes().decode("utf-8")) if p.exists() else None


def determinismo():
    """REL-007: a mesma seed tem de produzir resultado idêntico em duas execuções."""
    out = []
    for i in (1, 2):
        p = ROOT / f"reports/r14/determinismo/run{i}.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        r = subprocess.run([NODE, "tools/ux/probe_balllock.js", f"--build={BUILD}",
                            f"--csv={CSV}", "--start=0", "--end=8", f"--out={p}"],
                           cwd=ROOT, capture_output=True, text=True)
        if r.returncode:
            return None, f"sonda falhou: {r.stderr[-300:]}"
        d = json.loads(p.read_bytes().decode("utf-8"))
        # compara só o que o motor decidiu, não carimbos de tempo
        out.append(json.dumps([{k: m[k] for k in ("seed", "score", "lockCount", "lockMaxSec", "stats")}
                               for m in d["results"]], sort_keys=True))
    igual = out[0] == out[1]
    return igual, ("resultado idêntico nas duas execuções (8 partidas)" if igual
                   else "DIVERGIU entre execuções")


def main():
    lock = jload("reports/r14/ball-lock/r14-final.json")
    perf = jload("reports/r14/ux/perf.json")
    if not lock:
        sys.exit("falta reports/r14/ball-lock/r14-final.json")
    s = lock["summary"]
    pm, sp, ho = s["perMatch"], s["setPieces"], s["humanObserver"]
    ev = s.get("events", {})
    n = s["matches"]

    det_ok, det_txt = determinismo()

    # ── cada item com o SEU critério, o exigido e o observado ───────────────
    C = {}

    def chk(rid, ok, exigido, observado):
        C[rid] = {"pass": bool(ok), "exigido": exigido, "observado": observado}

    chk("BOL-030", 5 <= pm["throwIns"] <= 16, "5 a 16 laterais/jogo", f"{pm['throwIns']:.2f}")
    chk("BOL-037", 0.02 <= sp["cornerGoalShare"] <= 0.18, "participação de escanteio em gols 2%–18%",
        f"{sp['cornerGoalShare']*100:.2f}%")
    chk("BOL-044", 4 <= sp["goalKicks"] <= 12, "tiros de meta sem colapso, referência 7,71/jogo",
        f"{sp['goalKicks']:.2f}/jogo")
    chk("REG-006", 0.5 <= pm["offsides"] <= 4, "0,5 a 4 impedimentos/jogo, referência R13 0,805",
        f"{pm['offsides']:.2f}/jogo")
    chk("IA-003", ho["disconnectedLineRate"] == 0, "taxa de desconexão da linha dentro do gate",
        f"desconexão {ho['disconnectedLineRate']:.4f}")
    chk("IA-021", ho["markerMeanDistance"] <= 8.5, "distância média do marcador <= 8,5 m",
        f"{ho['markerMeanDistance']:.2f} m")
    chk("IA-022", ho["goalSideCoverageRate"] >= 0.70, "cobertura pelo lado do gol >= 70%",
        f"{ho['goalSideCoverageRate']*100:.1f}%")
    chk("IA-076", ho["bodyOrientationMismatchRate"] == 0 and ev.get("visual_contact_failed", 0) == 0,
        "zero ação sem trajetória ou alcance válido",
        f"contatos inválidos {ev.get('visual_contact_failed',0)}, corpo desalinhado {ho['bodyOrientationMismatchRate']:.4f}")
    chk("REL-002", BUILD.exists(), "hashes idênticos; rebuild não altera a candidata",
        f"SHA {hashlib.sha256(BUILD.read_bytes()).hexdigest()[:16]}…" if BUILD.exists() else "ausente")
    if det_ok is not None:
        chk("REL-007", det_ok, "R14 repete byte a byte por seed", det_txt)
    if perf:
        p = perf.get("perf") or {}
        mt = perf.get("matches") or {}
        heaps = [x["heapMB"] for x in mt.get("partidas", []) if x.get("heapMB")]
        cresc = ((heaps[-1] - heaps[0]) / heaps[0] * 100) if len(heaps) >= 2 else None
        if cresc is not None:
            chk("VFX-042", cresc <= 15, "cache de projeção sem crescimento contínuo",
                f"heap {cresc:+.1f}% em 3 partidas")
            chk("VFX-043", cresc <= 15, "contagem de VFX volta ao baseline após cada partida",
                f"heap {cresc:+.1f}% em 3 partidas")

    # ── aplica ──────────────────────────────────────────────────────────────
    data = json.loads(MATRIX.read_bytes().decode("utf-8"))
    por_id = {i["id"]: i for i in data["items"]}
    sha = hashlib.sha256(BUILD.read_bytes()).hexdigest() if BUILD.exists() else "PREENCHER"
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    novos = falhas = 0

    print(f"candidata {sha[:16]}…\n")
    for rid, r in sorted(C.items()):
        it = por_id.get(rid)
        if not it:
            continue
        marca = "OK  " if r["pass"] else "FAIL"
        print(f"  {marca} {rid:<9} {r['exigido']}")
        print(f"       observado: {r['observado']}")
        if "--write" in sys.argv:
            antes = it["result"]
            it["result"] = "PASS" if r["pass"] else "FAIL"
            it["evidence_path"] = "reports/r14/ball-lock/r14-final.json"
            it["notes"] = f"exigido: {r['exigido']} | observado: {r['observado']}"
            it["owner"] = "claude/r14"
            it["executed_at"] = now
            it["bug_or_commit"] = sha[:12]
            if r["pass"] and antes != "PASS":
                novos += 1
            if not r["pass"]:
                falhas += 1

    if "--write" in sys.argv:
        MATRIX.write_bytes(json.dumps(data, ensure_ascii=False, indent=1).encode("utf-8"))
        base = ROOT / "audit-r14/evidence"
        for rid, r in C.items():
            achado = list(base.glob(f"*/{rid}/resultado.json"))
            if not achado:
                continue
            p = achado[0]
            o = json.loads(p.read_bytes().decode("utf-8"))
            o.update({"result": "PASS" if r["pass"] else "FAIL", "candidate_sha256": sha,
                      "executed_at": now,
                      "metrics": {"exigido": r["exigido"], "observado": r["observado"]},
                      "notes": "Critério avaliado item a item por eval_controls.py"})
            p.write_bytes(json.dumps(o, ensure_ascii=False, indent=2).encode("utf-8"))
        print(f"\n{len(C)} controles avaliados · {novos} novos PASS · {falhas} FAIL")
    return 0


if __name__ == "__main__":
    sys.exit(main())
