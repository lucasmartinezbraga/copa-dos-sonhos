#!/usr/bin/env python3
"""
Avalia a R16.0 contra o critério PRÉ-REGISTRADO em
`reports/r15/CRITERIO-R16.0-PRE-REGISTRADO.md`.

Os limites abaixo são cópia literal daquele arquivo, escrito ANTES de qualquer
número aparecer. O veredito é mecânico de propósito: tira de mim a possibilidade
de reinterpretar sucesso depois de ver o resultado.
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# Build sob avaliacao. Passe --sha/--matrix/--jitter para avaliar outra
# candidata; os LIMITES continuam vindo do criterio pre-registrado e nao mudam.
_a = sys.argv[1:]
def _opt(n, d=None):
    return _a[_a.index(n) + 1] if n in _a else d
CAND = _opt("--sha", "b9a2096797920e523745a7e789af1ae274659db30e4cc8d34a2aac6e49cd1f97")
MATRIX = _opt("--matrix", "reports/r15/real-r160.json")
JITTER = _opt("--jitter", "reports/r15/jitter-r160.json")
INTEG = _opt("--integ", "reports/r15/integridade-r160.json")
OUT = _opt("--out", "reports/r15/avaliacao-r160.json")

def load(p):
    return json.loads((ROOT / p).read_text(encoding="utf-8"))

def rate(doc, key, guard):
    v = []
    for r in doc["results"]:
        o = r.get("observedFootball") or {}
        m = o.get("metrics") or {}
        if m.get(guard):
            v.append(o["rates"][key])
    return sum(v) / len(v) if v else None

def teleports(doc):
    t = [r.get("teleport") or {} for r in doc["results"]]
    return sum(x.get("teleports", 0) for x in t) / max(1, len(t))

def style_ppg(doc):
    mx = doc.get("matrix") or {}
    return {s["style"]: s["ppg"] for s in (mx.get("styles") or [])}

def main():
    ctl = load("reports/r15/real-r159.json") if (ROOT / "reports/r15/real-r159.json").exists() \
          else load("reports/r15/real-r158.json")   # R15.8/R15.9 = mesmo motor
    new = load(MATRIX)
    jit_old = load("reports/r15/jitter-overlap.json")
    jit_new = load(JITTER)

    checks = []
    def chk(bloco, nome, val, ok, alvo):
        checks.append({"bloco": bloco, "nome": nome, "valor": val,
                       "alvo": alvo, "ok": bool(ok)})

    # ── A. o ganho tem de permanecer ────────────────────────────────────────
    chk("A", "giros bruscos geral", jit_new["fracao_giros_bruscos_25g"],
        jit_new["fracao_giros_bruscos_25g"] <= 0.004, "<= 0,004")
    chk("A", "giros bruscos perto da bola", jit_new["fracao_giros_bruscos_perto_da_bola"],
        jit_new["fracao_giros_bruscos_perto_da_bola"] <= 0.012, "<= 0,012")
    chk("A", "giro medio (nao engessar)", jit_new["giroMedio_graus_por_quadro"],
        jit_new["giroMedio_graus_por_quadro"] >= 1.9, ">= 1,9")

    # ── B. marcacao ────────────────────────────────────────────────────────
    tc = rate(new, "threatCoverage", "dangerousThreats")
    md = rate(new, "markerMeanDistance", "markerSamples")
    so = rate(new, "spatialOverloadCoverage", "spatialOverloadSamples")
    chk("B", "cobertura de ameaca", round(tc, 4), tc >= 0.530, ">= 0,530")
    chk("B", "distancia do marcador", round(md, 4), md <= 8.90, "<= 8,90")
    chk("B", "sobrecarga coberta", round(so, 4), so >= 0.520, ">= 0,520")
    gk = {}
    for r in new["results"]:
        for k, v in ((r.get("observedFootball") or {}).get("gates") or {}).items():
            gk[k] = gk.get(k, 0) + (1 if v else 0)
    chk("B", "sub-gate marking", f"{gk.get('marking',0)}/294", gk.get("marking", 0) >= 1, ">= 1/294")

    # ── C. criacao e finalizacao ───────────────────────────────────────────
    pm = new["summary"]["perMatch"]
    for nome, key, lo, hi in [("gols/jogo","goals",2.80,3.45),
                              ("chutes/jogo","shots",18.0,23.0),
                              ("passes/jogo","passes",172,190),
                              ("impedimentos/jogo","offsides",2.8,4.6)]:
        chk("C", nome, round(pm[key], 3), lo <= pm[key] <= hi, f"{lo}–{hi}")

    # ── D. integridade e determinismo ──────────────────────────────────────
    cons = new["summary"]["canonicalStatuses"].get("CONSISTENT", 0)
    chk("D", "transacional CONSISTENT", f"{cons}/294", cons == 294, "294/294")
    chk("D", "sha do artefato", new.get("sha256", "")[:12],
        new.get("sha256") == CAND, "= candidata")
    tp = teleports(new)
    chk("D", "teleportes/partida", round(tp, 1), tp <= 25, "<= 25")
    integ = load(INTEG)
    for k in ("r13_byte_identical", "candidate_reproducible", "syntax_ok",
              "smoke_ok", "scenarios_ok"):
        chk("D", k, integ.get(k), integ.get(k) is True, "True")

    # ── E. sem regressao estrutural por estilo ─────────────────────────────
    g = (new.get("matrix") or {}).get("gates") or {}
    chk("E", "noDominantStyle", g.get("noDominantStyle"), g.get("noDominantStyle") is True, "True")
    chk("E", "ppgRange", round(g.get("ppgRange", 9), 4), g.get("ppgRange", 9) <= 0.75, "<= 0,75")
    a, b = style_ppg(ctl), style_ppg(new)
    worst, worst_s = 0.0, "-"
    for s in b:
        if s in a:
            d = a[s] - b[s]
            if d > worst: worst, worst_s = d, s
    chk("E", f"maior perda de ppg por estilo ({worst_s})", round(worst, 3),
        worst <= 0.45, "<= 0,45")

    # ── veredito mecanico ──────────────────────────────────────────────────
    blocos = {}
    for c in checks:
        blocos.setdefault(c["bloco"], []).append(c["ok"])
    okA, okB = all(blocos.get("A", [])), all(blocos.get("B", []))
    okC, okD, okE = all(blocos.get("C", [])), all(blocos.get("D", [])), all(blocos.get("E", []))

    if okA and okB and okC and okD and okE:
        verdict, why = "APROVA", "A, B, C, D e E satisfeitos"
    elif not okA:
        verdict, why = "REPROVA", "bloco A falhou: o patch nao entregou o ganho prometido"
    elif not okD:
        verdict, why = "REPROVA", "bloco D falhou: integridade ou determinismo"
    elif not okB:
        verdict, why = "AJUSTA_A_CURVA", ("bloco B falhou: conceito correto, taxa em baixa "
                                          "velocidade apertada. Ajuste fisico e geral — proibida "
                                          "excecao contextual.")
    else:
        verdict, why = "AJUSTA_A_CURVA", "bloco C ou E falhou"

    print("=" * 74)
    print(f"{CAND[:12]}… vs criterio PRE-REGISTRADO  ->  {verdict}")
    print(f"matriz: {MATRIX}  ·  jitter: {JITTER}")
    print(f"motivo: {why}")
    print("=" * 74)
    for bl in "ABCDE":
        rows = [c for c in checks if c["bloco"] == bl]
        if not rows: continue
        print(f"\n-- bloco {bl} --")
        for c in rows:
            print(f"  [{'ok  ' if c['ok'] else 'FALHA'}] {c['nome']:<34} "
                  f"{str(c['valor']):>12}   alvo {c['alvo']}")

    out = {"verdict": verdict, "why": why, "candidate": CAND,
           "matrix": MATRIX, "jitter": JITTER, "checks": checks}
    (ROOT / OUT).write_text(
        json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"\nartefato: reports/r15/avaliacao-r160.json")
    return 0 if verdict == "APROVA" else 1

if __name__ == "__main__":
    sys.exit(main())
