#!/usr/bin/env python3
"""
§26 — AGREGADOR ÚNICO DE CERTIFICAÇÃO DA RELEASE.

Este é o ÚNICO lugar autorizado a dizer se uma build está aprovada. Nenhuma
camada de auditoria emite veredito próprio a partir daqui: cada uma entrega
MEDIÇÕES, e este arquivo aplica os limites e consolida.

Regras não negociáveis (§6):
  · O status final NÃO é herdado de nenhuma camada anterior. Em especial,
    `CONSISTENT` da camada transacional R12 é UM gate entre muitos — não é
    aprovação de nada.
  · Qualquer gate P0 que não seja PASS reprova a release inteira.
  · Um gate obrigatório sem artefato aparece como NOT_EXECUTED e NUNCA é
    convertido em aprovação.
  · Um gate com artefato mas sem amostra suficiente aparece como INCONCLUSIVE
    e também não é convertido em aprovação.

Estados: PASS · FAIL · REVIEW · INCONCLUSIVE · NOT_EXECUTED · BLOCKED

Uso:
    python tools/r15/aggregate_release.py --sha <sha256-da-build> \
        [--gates manifests/r15-release-gates.json] [--out reports/r15/certificacao.json]
"""
import json, sys, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

PASS, FAIL, REVIEW = "PASS", "FAIL", "REVIEW"
INCONCLUSIVE, NOT_EXECUTED, BLOCKED = "INCONCLUSIVE", "NOT_EXECUTED", "BLOCKED"

# Estados que jamais contam como aprovação.
NON_APPROVING = {FAIL, REVIEW, INCONCLUSIVE, NOT_EXECUTED, BLOCKED}


class Missing(Exception):
    """Artefato existe mas não contém o dado — vira INCONCLUSIVE, não PASS."""


# ─────────────────────────────────────────────────────────────────────────────
# Carregamento de artefatos
# ─────────────────────────────────────────────────────────────────────────────

_cache = {}

def artifact(rel):
    if rel in _cache:
        return _cache[rel]
    p = ROOT / rel
    if not p.exists():
        _cache[rel] = None
        return None
    try:
        _cache[rel] = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:                                    # artefato corrompido
        _cache[rel] = {"__parse_error__": str(e)}
    return _cache[rel]


def _results(doc):
    r = doc.get("results")
    if not isinstance(r, list) or not r:
        raise Missing("sem results[]")
    return r


def _mean(vals):
    vals = [v for v in vals if isinstance(v, (int, float)) and not math.isnan(v)]
    if not vals:
        raise Missing("nenhuma amostra numérica")
    return sum(vals) / len(vals), len(vals)


# ─────────────────────────────────────────────────────────────────────────────
# Extratores. Cada um devolve (valor, n_amostras).
# n_amostras é o número de PARTIDAS/OBSERVAÇÕES que sustentam o valor — é o que
# permite distinguir "passou" de "não teve amostra", a falha central do auditor
# antigo (rates com denominador zero devolviam 1 = perfeito).
# ─────────────────────────────────────────────────────────────────────────────

def ex_build_sha(doc, cfg, ctx):
    sha = doc.get("sha256")
    if not sha:
        raise Missing("sha256 ausente")
    return (1.0 if sha == ctx.get("sha") else 0.0), 1


def ex_matches_completed(doc, cfg, ctx):
    s = doc.get("summary") or {}
    m, c = s.get("matches"), s.get("completed")
    if not m:
        raise Missing("summary.matches ausente")
    return c / m, m


def ex_canonical_consistent(doc, cfg, ctx):
    s = doc.get("summary") or {}
    m = s.get("matches")
    st = s.get("canonicalStatuses") or {}
    if not m:
        raise Missing("summary.matches ausente")
    return st.get("CONSISTENT", 0) / m, m


def ex_matrix_gate(doc, cfg, ctx):
    """Gate booleano vindo da matriz de estilos/formações."""
    mx = doc.get("matrix") or {}
    g = mx.get("gates") or {}
    key = cfg["key"]
    if key not in g:
        raise Missing(f"matrix.gates.{key} ausente")
    v = g[key]
    n = (doc.get("summary") or {}).get("matches", 0)
    return (1.0 if v else 0.0) if isinstance(v, bool) else float(v), n


def ex_observed_rate_mean(doc, cfg, ctx):
    """
    Média de uma taxa do observador R13 — mas SÓ sobre partidas que realmente
    tiveram amostra. O auditor antigo devolvia 1 (perfeito) quando o denominador
    era zero; aqui essas partidas são excluídas e passam a reduzir n.
    """
    key, guard = cfg["key"], cfg.get("sample_guard")
    vals = []
    for r in _results(doc):
        obs = r.get("observedFootball") or {}
        rates = obs.get("rates") or {}
        metrics = obs.get("metrics") or {}
        if guard:
            n = metrics.get(guard)
            if not n:                       # zero amostras nesta partida → não conta
                continue
        if key in rates and isinstance(rates[key], (int, float)):
            vals.append(rates[key])
    return _mean(vals)


def _rate_series(doc, cfg):
    """Série da taxa por partida, excluídas as partidas sem amostra."""
    key, guard = cfg["key"], cfg.get("sample_guard")
    vals = []
    for r in _results(doc):
        obs = r.get("observedFootball") or {}
        rates, metrics = obs.get("rates") or {}, obs.get("metrics") or {}
        if guard and not metrics.get(guard):
            continue
        v = rates.get(key)
        if isinstance(v, (int, float)):
            vals.append(v)
    if not vals:
        raise Missing(f"rates.{key} sem amostra")
    return sorted(vals)


def ex_observed_rate_pct(doc, cfg, ctx):
    """
    Percentil da taxa ENTRE partidas — a cauda, não a média.

    Uma média que passa pode esconder partidas catastróficas: a média do alcance
    da linha é 7,4 m e a pior partida chega a 10,7 m. O §53 pede ausência de
    linhas desconectadas, não média aceitável de desconexão.
    """
    v = _rate_series(doc, cfg)
    p = float(cfg.get("pct", 0.95))
    return v[min(len(v) - 1, int(len(v) * p))], len(v)


def ex_observed_rate_worst(doc, cfg, ctx):
    """Pior partida da série (max ou min, conforme a direção do gate)."""
    v = _rate_series(doc, cfg)
    return (v[0] if cfg.get("worst") == "min" else v[-1]), len(v)


def ex_observed_metric_max(doc, cfg, ctx):
    """
    Máximo de um contador bruto do observador — o PICO dentro da partida.

    `lineRangeMax` é coletado desde sempre e nunca foi gateado: a média por
    partida fica em 7,4 m enquanto o pico chega a 61,9 m num campo de 105 m.
    """
    key = cfg["key"]
    vals = []
    for r in _results(doc):
        m = (r.get("observedFootball") or {}).get("metrics") or {}
        v = m.get(key)
        if isinstance(v, (int, float)) and v:
            vals.append(v)
    if not vals:
        raise Missing(f"metrics.{key} ausente")
    return max(vals), len(vals)


def ex_observed_rate_spread(doc, cfg, ctx):
    """
    Amplitude da taxa entre partidas. Serve de DETECTOR DE MÉTRICA MORTA.

    Uma métrica que devolve o mesmo valor em 294 partidas não está medindo nada
    — e faz o gate que a consome passar por construção. É o caso de
    `bodyOrientationMismatch`, constante em 0,000, que sozinho aprova o sub-gate
    `ball` em 294/294. Mesmo defeito de série degenerada que o §6 proíbe.
    """
    v = _rate_series(doc, cfg)
    return v[-1] - v[0], len(v)


def ex_observed_gate_share(doc, cfg, ctx):
    """Fração de partidas em que um sub-gate do observador passou."""
    key = cfg["key"]
    ok = tot = 0
    for r in _results(doc):
        g = (r.get("observedFootball") or {}).get("gates") or {}
        if key in g:
            tot += 1
            ok += 1 if g[key] else 0
    if not tot:
        raise Missing(f"gates.{key} ausente em todas as partidas")
    return ok / tot, tot


def ex_lock_max(doc, cfg, ctx):
    res = _results(doc)
    return max((r.get("lockMaxSec") or 0) for r in res), len(res)


def ex_lock_over(doc, cfg, ctx):
    """Quantidade de travas de posse acima do limiar (segundos de jogo)."""
    lim, res = cfg.get("seconds", 10), _results(doc)
    n = sum(1 for r in res for l in (r.get("worstLocks") or [])
            if (l.get("gameSec") or 0) >= lim)
    return n, len(res)


def ex_permatch(doc, cfg, ctx):
    s = (doc.get("summary") or {}).get("perMatch") or {}
    key = cfg["key"]
    if key not in s:
        raise Missing(f"perMatch.{key} ausente")
    return s[key], (doc.get("summary") or {}).get("matches", 0)


def ex_verify_flag(doc, cfg, ctx):
    """Flags do verify_r13 (identidade, sintaxe, smoke, cenários)."""
    key = cfg["key"]
    if key not in doc:
        raise Missing(f"{key} ausente")
    v = doc[key]
    return (1.0 if v else 0.0) if isinstance(v, bool) else float(v), 1


def ex_json_path(doc, cfg, ctx):
    """Extrator genérico por caminho pontuado, com n declarado no artefato."""
    cur = doc
    for part in cfg["path"].split("."):
        if not isinstance(cur, dict) or part not in cur:
            raise Missing(f"caminho {cfg['path']} ausente")
        cur = cur[part]
    if isinstance(cur, bool):
        cur = 1.0 if cur else 0.0
    if not isinstance(cur, (int, float)):
        raise Missing(f"{cfg['path']} não é numérico")
    n = 1
    if cfg.get("n_path"):
        cn = doc
        for part in cfg["n_path"].split("."):
            if not isinstance(cn, dict) or part not in cn:
                cn = None
                break
            cn = cn[part]
        if isinstance(cn, (int, float)):
            n = cn
    return cur, n


def ex_teleport_total(doc, cfg, ctx):
    """
    Saltos de posição maiores que o fisicamente possível, EXCLUÍDA a troca de
    lado do intervalo. A guarda da R12 clampa antes de medir e é desligada em
    estado administrativo, então `maxFinalStep` não serve — este número vem de
    amostragem externa, por fora do motor.
    """
    res = _results(doc)
    vals = [(r.get("teleport") or {}).get("teleports") for r in res]
    vals = [v for v in vals if isinstance(v, (int, float))]
    if not vals:
        raise Missing("teleport.teleports ausente (sonda antiga?)")
    return sum(vals), len(vals)


def ex_teleport_max(doc, cfg, ctx):
    res = _results(doc)
    vals = [(r.get("teleport") or {}).get("teleportMaxM") for r in res]
    vals = [v for v in vals if isinstance(v, (int, float))]
    if not vals:
        raise Missing("teleport.teleportMaxM ausente")
    return max(vals), len(vals)


def ex_diag_max(doc, cfg, ctx):
    """Máximo de um contador de diagnóstico da camada transacional."""
    key = cfg["key"]
    vals = []
    for r in _results(doc):
        d = r.get("diagnostics") or {}
        if key in d and isinstance(d[key], (int, float)):
            vals.append(d[key])
    if not vals:
        raise Missing(f"diagnostics.{key} ausente")
    return max(vals), len(vals)


EXTRACTORS = {
    "teleport_total": ex_teleport_total,
    "teleport_max": ex_teleport_max,
    "diag_max": ex_diag_max,
    "build_sha": ex_build_sha,
    "matches_completed": ex_matches_completed,
    "canonical_consistent": ex_canonical_consistent,
    "matrix_gate": ex_matrix_gate,
    "observed_rate_mean": ex_observed_rate_mean,
    "observed_rate_pct": ex_observed_rate_pct,
    "observed_rate_worst": ex_observed_rate_worst,
    "observed_metric_max": ex_observed_metric_max,
    "observed_rate_spread": ex_observed_rate_spread,
    "observed_gate_share": ex_observed_gate_share,
    "lock_max": ex_lock_max,
    "lock_over": ex_lock_over,
    "permatch": ex_permatch,
    "verify_flag": ex_verify_flag,
    "json_path": ex_json_path,
}


# ─────────────────────────────────────────────────────────────────────────────
# Comparação
# ─────────────────────────────────────────────────────────────────────────────

def compare(value, op, threshold):
    if op == ">=":
        return value >= threshold
    if op == "<=":
        return value <= threshold
    if op == "==":
        return value == threshold
    if op == "<":
        return value < threshold
    if op == ">":
        return value > threshold
    if op == "between":
        return threshold[0] <= value <= threshold[1]
    raise ValueError(f"operador desconhecido: {op}")


def evaluate(gate, ctx):
    """Avalia um gate e devolve o registro completo, sempre com motivo."""
    # `relax` existe SÓ para os testes de mutação do §7, onde o efeito injetado é
    # grosseiro de propósito e a pergunta é "o gate acusa?", não "qual o valor
    # exato?". Toda execução relaxada carimba isso no relatório.
    min_s = gate.get("min_samples", 1)
    if ctx.get("relax"):
        min_s = min(min_s, ctx["relax"])
    rec = {
        "id": gate["id"], "priority": gate["priority"], "layer": gate["layer"],
        "question": gate.get("question", ""), "status": NOT_EXECUTED,
        "value": None, "threshold": gate.get("threshold"), "op": gate.get("op"),
        "samples": 0, "min_samples": min_s,
        "artifact": gate.get("artifact"), "reason": "",
    }

    if gate.get("blocked"):
        rec["status"] = BLOCKED
        rec["reason"] = gate.get("blocked_reason", "bloqueado")
        return rec

    rel = gate.get("artifact")
    if not rel:
        rec["reason"] = "gate obrigatório sem artefato definido — nunca foi medido"
        return rec

    doc = artifact(rel)
    if doc is None:
        rec["reason"] = f"artefato ausente: {rel}"
        return rec
    if "__parse_error__" in doc:
        rec["status"] = INCONCLUSIVE
        rec["reason"] = f"artefato ilegível: {doc['__parse_error__']}"
        return rec

    # §2 — TODO artefato precisa ter medido A MESMA build. Sem esta checagem o
    # agregador consolida execuções de motores diferentes num veredito só:
    # basta uma correção entre duas medições para que metade dos gates descreva
    # um binário que já não existe. Um artefato que declara SHA divergente é
    # INCONCLUSIVE — mediu, mas mediu outra coisa.
    want = ctx.get("sha")
    got = doc.get("sha256") or doc.get("candidate_sha256") or doc.get("base_sha256")
    if want and got and got != want:
        rec["status"] = INCONCLUSIVE
        rec["measured_sha256"] = got
        rec["reason"] = (f"artefato mediu outra build: {got[:12]}… "
                         f"≠ candidata {want[:12]}…")
        return rec
    if want and not got and gate.get("requires_sha", True):
        rec["status"] = INCONCLUSIVE
        rec["reason"] = ("artefato não declara sha256 — impossível provar que "
                         "mediu a candidata")
        return rec

    fn = EXTRACTORS.get(gate["extractor"])
    if fn is None:
        rec["status"] = INCONCLUSIVE
        rec["reason"] = f"extrator desconhecido: {gate['extractor']}"
        return rec

    try:
        value, n = fn(doc, gate, ctx)
    except Missing as e:
        rec["status"] = INCONCLUSIVE
        rec["reason"] = f"dado ausente no artefato: {e}"
        return rec
    except Exception as e:
        rec["status"] = INCONCLUSIVE
        rec["reason"] = f"erro ao extrair: {type(e).__name__}: {e}"
        return rec

    rec["value"], rec["samples"] = value, n

    if n < rec["min_samples"]:
        rec["status"] = INCONCLUSIVE
        rec["reason"] = (f"amostra insuficiente: {n} < {rec['min_samples']} "
                         f"(valor {value!r} não é evidência)")
        return rec

    ok = compare(value, gate["op"], gate["threshold"])
    if ok:
        rec["status"] = PASS
        rec["reason"] = f"{value} {gate['op']} {gate['threshold']} com n={n}"
    else:
        rec["status"] = REVIEW if gate.get("advisory") else FAIL
        rec["reason"] = f"{value} viola {gate['op']} {gate['threshold']} com n={n}"
    return rec


def certify(gates, ctx):
    records = [evaluate(g, ctx) for g in gates]

    by_pri = {}
    for r in records:
        by_pri.setdefault(r["priority"], []).append(r)

    p0 = by_pri.get("P0", [])
    p1 = by_pri.get("P1", [])

    p0_bad = [r for r in p0 if r["status"] in NON_APPROVING]
    p1_fail = [r for r in p1 if r["status"] == FAIL]

    if p0_bad:
        verdict, why = "REPROVADA", (
            f"{len(p0_bad)} gate(s) P0 não aprovados: "
            + ", ".join(f"{r['id']}={r['status']}" for r in p0_bad))
    elif p1_fail:
        verdict, why = "REPROVADA", (
            f"{len(p1_fail)} gate(s) P1 reprovados: "
            + ", ".join(r["id"] for r in p1_fail))
    else:
        verdict, why = "APROVADA", "todos os gates P0 em PASS e nenhum P1 em FAIL"

    counts = {}
    for r in records:
        counts[r["status"]] = counts.get(r["status"], 0) + 1

    return {
        "verdict": verdict,
        "verdict_reason": why,
        "build_sha256": ctx.get("sha"),
        "relaxed_samples": ctx.get("relax"),
        "counts": counts,
        "coverage": {
            "total": len(records),
            "measured": sum(1 for r in records if r["status"] in (PASS, FAIL, REVIEW)),
            "not_executed": counts.get(NOT_EXECUTED, 0),
            "inconclusive": counts.get(INCONCLUSIVE, 0),
        },
        "gates": records,
    }


def render(report):
    L = []
    L.append("=" * 78)
    L.append(f"CERTIFICAÇÃO DE RELEASE — {report['verdict']}")
    L.append(f"build sha256: {report['build_sha256']}")
    L.append(f"motivo: {report['verdict_reason']}")
    c = report["coverage"]
    L.append(f"cobertura: {c['measured']}/{c['total']} gates medidos · "
             f"{c['not_executed']} NOT_EXECUTED · {c['inconclusive']} INCONCLUSIVE")
    L.append("=" * 78)
    order = [FAIL, INCONCLUSIVE, NOT_EXECUTED, BLOCKED, REVIEW, PASS]
    for st in order:
        rows = [r for r in report["gates"] if r["status"] == st]
        if not rows:
            continue
        L.append(f"\n── {st} ({len(rows)}) " + "─" * (60 - len(st)))
        for r in sorted(rows, key=lambda x: (x["priority"], x["id"])):
            val = r["value"]
            if isinstance(val, float):
                val = round(val, 4)
            L.append(f"  [{r['priority']}] {r['id']:<34} {r['layer']:<14} "
                     f"valor={val} n={r['samples']}")
            L.append(f"        {r['reason']}")
    return "\n".join(L)


def main():
    args = sys.argv[1:]
    def opt(name, default=None):
        return args[args.index(name) + 1] if name in args else default

    gates_path = ROOT / opt("--gates", "manifests/r15-release-gates.json")
    if not gates_path.exists():
        sys.exit(f"ERRO: catálogo de gates não encontrado: {gates_path}")
    gates = json.loads(gates_path.read_text(encoding="utf-8"))
    ctx = {"sha": opt("--sha")}
    if "--relax-samples" in args:
        ctx["relax"] = int(opt("--relax-samples"))
    if "--artifact-dir" in args:
        # Redireciona todos os artefatos para um diretório de execução isolado,
        # sem tocar no catálogo de gates (usado pelos testes de mutação).
        d = opt("--artifact-dir").rstrip("/")
        for g in gates:
            if g.get("artifact", "").startswith("reports/r15/"):
                g["artifact"] = d + "/" + g["artifact"].split("/")[-1]

    report = certify(gates, ctx)
    out = opt("--out", "reports/r15/certificacao.json")
    (ROOT / out).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / out).write_text(json.dumps(report, indent=1, ensure_ascii=False),
                            encoding="utf-8")
    print(render(report))
    print(f"\nartefato: {out}")
    return 0 if report["verdict"] == "APROVADA" else 1


if __name__ == "__main__":
    sys.exit(main())
