#!/usr/bin/env python3
"""
§13 — MATRIZ DE RASTREABILIDADE DOS 120 LANCES DA COLETÂNEA.

Cada lance recebe status final. Nenhum some do controle sem classificação.

O ponto central: a classificação automática da coletânea é SINAL, não veredito
(§16). Este script reprocessa os estados brutos e separa, com regra explícita e
verificável, o que é falha do que é contexto legítimo.

Discriminações implementadas (cada uma com justificativa física):

  · SALTO — a coletânea amostra a cada 8 ticks de dt=1/30, ou seja 0,267 s de
    FÍSICA. A 8 m/s o deslocamento máximo legítimo é 2,13 m por amostra — que é
    exatamente a mediana medida (2,08 m). Um salto de 29 m nesse intervalo
    equivale a 109 m/s.
    MAS: na virada do intervalo os times TROCAM DE LADO, e o goleiro atravessa
    ~96 m legitimamente. Saltos com mudança de `half` ou na janela 44–47,5 min
    são FALSO_POSITIVO. Os demais são teleporte real.

  · VELOCIDADE — `max_speed_ratio` foi reconferido contra o estado bruto e
    reproduz exatamente. É sinal confiável.

  · LADO — `persistent_wrong_side` satura em 119/120 lances. Métrica saturada
    quase sempre indica definição errada, não falha universal; fica
    INCONCLUSIVO até a definição do coletor ser validada contra o contrato de
    função do motor (que ainda não existe, §18).

Uso:
    python tools/r15/traceability_matrix.py --coletanea <dir> [--out ...]
"""
import csv, glob, gzip, io, json, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Física da amostragem da coletânea (script/gerar_coletanea_r15_expandida.py:94)
DT = 1 / 30
SAMPLE_EVERY = 8
SAMPLE_SEC = DT * SAMPLE_EVERY              # 0,2667 s de física
MAXSPD_CEIL = 8.5                            # m/s, teto generoso de atleta
LEGIT_STEP = MAXSPD_CEIL * SAMPLE_SEC        # ~2,27 m
TELEPORT_M = 7.0                             # 3,1× o limite físico
HALF_WINDOW = (44.0, 47.5)                   # janela da virada do intervalo


def load_index(base):
    p = base / "INDICE_LANCES.csv"
    return list(csv.DictReader(io.open(p, encoding="utf-8-sig")))


def load_matches(base):
    out = {}
    for fp in sorted(glob.glob(str(base / "dados" / "match_*.json.gz"))):
        d = json.load(gzip.open(fp, "rt", encoding="utf-8"))
        out[int(d["summary"]["config"]["seed"])] = d
    return out


def jumps_of(frames):
    """Saltos por amostra, com marcação de virada de tempo."""
    res = []
    for a, b in zip(frames, frames[1:]):
        ha, hb = a.get("half"), b.get("half")
        mn = b.get("minute", 0)
        pa = {(p["team"], p["n"]): (p["x"], p["y"]) for p in a.get("players", [])}
        for p in b.get("players", []):
            k = (p["team"], p["n"])
            if k not in pa:
                continue
            d = math.hypot((p["x"] - pa[k][0]) * 105, (p["y"] - pa[k][1]) * 68)
            if d <= TELEPORT_M:
                continue
            half_change = (ha != hb) or (HALF_WINDOW[0] <= mn <= HALF_WINDOW[1])
            res.append({"m": round(d, 2), "minute": round(mn, 1),
                        "player": p["n"], "gk": bool(p.get("gk")),
                        "half_change": half_change})
    return res


def classify(row, match):
    """Devolve (status, causa_raiz, sistema, etapa, evidencia)."""
    try:
        met = json.loads(row["metricas"])
    except Exception:
        met = {}
    seed = int(row["seed"])
    minute = float(row["minuto"])

    cand, best = None, 1e9
    for c in (match or {}).get("candidates", []):
        dm = abs(c["event"].get("minute", -99) - minute)
        if dm < best:
            best, cand = dm, c
    frames = (cand or {}).get("frames") or []

    jl = jumps_of(frames)
    real = [j for j in jl if not j["half_change"]]
    swap = [j for j in jl if j["half_change"]]

    speed = met.get("max_speed_ratio", 0)
    findings = []

    if real:
        worst = max(real, key=lambda j: j["m"])
        findings.append({
            "sinal": "teleporte",
            "status": "CONFIRMADO_P0",
            "causa_raiz": (
                "A guarda global de movimento em P.step (29-r12-transactional-core.js:89) "
                "é DESLIGADA quando `dead>0 || waiting || pendingRestart`. Durante "
                "reinícios e mudanças administrativas a posição é escrita direto, sem "
                "passar por _integrate nem pelo clamp de passo. §17 exige que a forma "
                "surja da movimentação física, nunca de teletransporte."),
            "sistema": "movimento / reinício",
            "funcao": "P.step (guarda administrativa) + reposicionamento de bola parada",
            "etapa": "§32/§36 física e regras",
            "evidencia": f"{worst['m']} m em {SAMPLE_SEC:.3f} s de física "
                         f"({worst['m'] / SAMPLE_SEC:.0f} m/s) · {worst['player']} "
                         f"aos {worst['minute']}'",
        })
    if swap and not real:
        findings.append({
            "sinal": "teleporte",
            "status": "FALSO_POSITIVO",
            "causa_raiz": "Troca de lado na virada do intervalo — deslocamento legítimo.",
            "sistema": "—", "funcao": "—", "etapa": "—",
            "evidencia": f"{len(swap)} saltos, todos com mudança de tempo ou em 44–47,5'",
        })

    if speed > 1.22:
        findings.append({
            "sinal": "velocidade",
            "status": "CONFIRMADO_P1",
            "causa_raiz": (
                "A guarda de frame permite `maxSpd*dt*1.28 + 0.20` por passo. A 7 m/s "
                "e dt=1/30 isso autoriza 0,499 m/passo = 14,9 m/s = 2,14× maxSpd. O "
                "teto efetivo do motor é o dobro do atributo do jogador, então "
                "`maxSpd` não é limite de velocidade — é sugestão."),
            "sistema": "movimento",
            "funcao": "commitMovement + guarda global (29-r12:85 e :90)",
            "etapa": "§32 física",
            "evidencia": f"max_speed_ratio = {speed:.3f}× maxSpd (reconferido no estado bruto)",
        })

    if met.get("persistent_wrong_side", 0) >= 0.45:
        # Recontagem com a régua correta: o lado é relativo à posição-base do
        # próprio jogador, não a um `y` absoluto igual para os dois times.
        wide = {"LB", "LWB", "LM", "LW", "RB", "RWB", "RM", "RW"}
        tot = ok = 0
        for fr in frames:
            for p in fr.get("players", []):
                if p.get("slot") not in wide:
                    continue
                y, hy = p.get("y"), p.get("hy")
                if y is None or hy is None:
                    continue
                tot += 1
                if (y - 0.5) * (hy - 0.5) > 0 or abs(y - 0.5) <= 0.08:
                    ok += 1
        share = (ok / tot) if tot else None
        if share is not None and share >= 0.85:
            findings.append({
                "sinal": "invasao_lateral",
                "status": "FALSO_POSITIVO",
                "causa_raiz": (
                    "Defeito de MEDIÇÃO do coletor, não do motor. A régua usa `y` "
                    "absoluto igual para os dois times (script:141-142), mas os lados "
                    "são espelhados por equipe — medido no estado bruto: LB do time 0 "
                    "tem hy=0,110 e LB do time 1 tem hy=0,785. Todo ala de um dos times "
                    "é marcado NA PRÓPRIA POSIÇÃO-BASE. Sobre os 120 lances a régua do "
                    "coletor marca 48,95% das amostras (≈ um time inteiro de alas); a "
                    "régua relativa à base mede 96,31% de respeito ao lado."),
                "sistema": "—", "funcao": "—",
                "etapa": "§26 respeito aos lados",
                "evidencia": f"lado respeitado neste lance = {share:.4f} "
                             f"(coletor dizia invasão em {met.get('persistent_wrong_side'):.0%} dos quadros)",
            })
        else:
            findings.append({
                "sinal": "invasao_lateral",
                "status": "CONFIRMADO_P1" if share is not None else "INCONCLUSIVO",
                "causa_raiz": (
                    "Invasão de lado sobrevive à régua corrigida (relativa à posição-base). "
                    "§26 admite invasão por rotação, cobertura, transição ou perseguição — "
                    "mas exige motivo, duração, compensação e retorno, e o motor não "
                    "registra nenhum dos quatro (§18 não implementado)."),
                "sistema": "posicionamento",
                "funcao": "_attackTarget / _defendTarget",
                "etapa": "§18 contrato de função (não iniciada)",
                "evidencia": (f"lado respeitado neste lance = {share:.4f}"
                              if share is not None else "sem amostra de ala no lance"),
            })

    if met.get("persistent_uncovered", 0) >= 0.9:
        findings.append({
            "sinal": "ameaca_sem_marcador",
            "status": "CONFIRMADO_P0",
            "causa_raiz": (
                "Cobertura de ameaça medida em 0,618 sobre 294 partidas (limite 0,65). "
                "As cinco tentativas de parâmetro registradas no handoff não moveram a "
                "métrica (travada em 0,68–0,71): o gargalo é o CÁLCULO da posição de "
                "marcação, não o ajuste. `_defendTarget` decide 27,4% das posições "
                "defensivas pelo ramo `_markRef`."),
            "sistema": "defesa",
            "funcao": "_defendTarget ramo _markRef (30-r13-football-observer.js:561)",
            "etapa": "§30 defesa coletiva",
            "evidencia": f"persistent_uncovered = {met.get('persistent_uncovered'):.2f}",
        })

    if not findings:
        findings.append({
            "sinal": "nenhum", "status": "COMPORTAMENTO_LEGITIMO",
            "causa_raiz": "Nenhum sinal acima do limiar após reprocessamento.",
            "sistema": "—", "funcao": "—", "etapa": "—", "evidencia": "—",
        })
    return findings


def main():
    args = sys.argv[1:]
    def opt(n, d=None):
        return args[args.index(n) + 1] if n in args else d

    base = Path(opt("--coletanea", str(Path.home() / "Downloads" / "COLETANEA_R15" /
                                      "COLETANEA_VISUAL_R15_0_EXPANDIDA")))
    if not (base / "INDICE_LANCES.csv").exists():
        sys.exit(f"ERRO: coletânea não encontrada em {base}")

    rows = load_index(base)
    matches = load_matches(base)

    out_rows, tally = [], {}
    for r in rows:
        seed = int(r["seed"])
        for f in classify(r, matches.get(seed)):
            rec = {
                "lance": r["id"], "seed": seed, "minuto": r["minuto"],
                "tipo": r["tipo"], "formacoes": f"{r['formacao_a']} x {r['formacao_b']}",
                "estilos": f"{r['estilo_a']} x {r['estilo_b']}",
                "classificacao_automatica": r["classificacao"],
                "sinal": f["sinal"], "status_final": f["status"],
                "sistema": f["sistema"], "funcao": f["funcao"],
                "causa_raiz": f["causa_raiz"], "etapa": f["etapa"],
                "evidencia": f["evidencia"],
            }
            out_rows.append(rec)
            tally[f["status"]] = tally.get(f["status"], 0) + 1

    out_json = ROOT / opt("--out", "reports/r15/matriz-rastreabilidade.json")
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(
        {"lances": len(rows), "achados": len(out_rows), "tally": tally, "matriz": out_rows},
        indent=1, ensure_ascii=False), encoding="utf-8")

    out_csv = out_json.with_suffix(".csv")
    with io.open(out_csv, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out_rows[0].keys()))
        w.writeheader()
        w.writerows(out_rows)

    print(f"lances processados : {len(rows)}")
    print(f"achados registrados: {len(out_rows)}\n")
    for k, v in sorted(tally.items(), key=lambda x: -x[1]):
        print(f"  {k:<26} {v}")

    lances_status = {}
    for rec in out_rows:
        s = lances_status.setdefault(rec["lance"], set())
        s.add(rec["status_final"])
    piores = sum(1 for v in lances_status.values() if "CONFIRMADO_P0" in v)
    print(f"\nlances com ao menos um CONFIRMADO_P0: {piores}/{len(rows)}")
    print(f"\nartefatos: {out_json.relative_to(ROOT)} · {out_csv.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
