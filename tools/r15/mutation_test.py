#!/usr/bin/env python3
"""
§7 — TESTES DE MUTAÇÃO DO SISTEMA DE GATES.

Quebra o motor DE PROPÓSITO e verifica se o agregador reprova. Um auditor que
nunca viu uma build quebrada não provou nada: enquanto este arquivo não passar,
o veredito do §26 é hipótese, não certificação.

Para cada mutação:
  1. constrói um HTML com o defeito injetado;
  2. roda uma matriz curta de partidas;
  3. roda a varredura de modificadores ocultos;
  4. roda o agregador sobre os artefatos dessa mutação;
  5. confere que os gates esperados saíram de PASS.

A mutação é considerada DETECTADA quando todo gate de `expect_fail` termina em
FAIL. Se terminar em INCONCLUSIVE ou NOT_EXECUTED, o teste é reportado como
NAO_DETECTADA — porque o §6 proíbe tratar ausência de medição como evidência,
e isso vale também para a evidência de que o gate funciona.

Uso:
    python tools/r15/mutation_test.py [--only <id>] [--repeats 1]
"""
import json, os, re, shutil, subprocess, sys, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PY = sys.executable
NODE_DIR = Path(os.environ.get("LOCALAPPDATA", "")) / "nodejs-portable" / "node-v24.18.0-win-x64"
# CreateProcess resolve o executável pelo PATH do processo PAI, não pelo env
# passado ao filho — por isso o caminho absoluto.
NODE = str(NODE_DIR / "node.exe") if (NODE_DIR / "node.exe").exists() else "node"
WORK = ROOT / "reports/r15/mutations"


def child_env():
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    if NODE_DIR.exists():
        env["PATH"] = str(NODE_DIR) + os.pathsep + env.get("PATH", "")
    return env


def run(cmd):
    r = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True,
                       encoding="utf-8", errors="replace", env=child_env())
    return r.returncode, (r.stdout or "") + (r.stderr or "")


# ─────────────────────────────────────────────────────────────────────────────
# Catálogo de defeitos deliberados
#
#   build_without : constrói sem este patch de motor (defeito por REGRESSÃO)
#   edits         : substituições literais no HTML já construído
#   expect_fail   : gates que PRECISAM terminar em FAIL
#   proves        : o que a detecção demonstra
# ─────────────────────────────────────────────────────────────────────────────
MUTATIONS = [
    {
        "id": "mut-audit-removed",
        "title": "A camada transacional de auditoria é removida",
        "why": "§6 — ausência de auditoria não pode virar aprovação. O observador "
               "R13 antigo fazia exatamente isso: `!this.getR12Audit() || ...` "
               "aprovava o gate `structural` quando o auditor sumia.",
        "edits": [(
            "P.getR12Audit=function(){const live=state(this);",
            "P.getR12Audit=null;P.__mutDisabledAudit=function(){const live=state(this);",
        )],
        "expect_fail": ["transactional_consistency"],
        "proves": "O agregador não herda status e não aprova por ausência.",
    },
    {
        "id": "mut-phantom-goal",
        "title": "Gol registrado na estatística sem chute físico",
        "why": "§13 — evento estatístico sem evento físico é P0. É o caso do "
               "'placar alterado sem jogada' do §56.",
        "edits": [(
            "P.step=function(dt){const snap=[],beforeHalf=this.half,",
            "P.step=function(dt){this.__mutT=(this.__mutT||0)+1;"
            "if(this.__mutT%900===0&&this.stats&&this.stats[0])this.stats[0].goals++;"
            "const snap=[],beforeHalf=this.half,",
        )],
        "expect_fail": ["transactional_consistency"],
        "proves": "O livro-caixa acusa gol que não veio de finalização.",
    },
    {
        "id": "mut-marker-standoff",
        "title": "Marcador fica 16 m longe do atacante que deveria marcar",
        "why": "§7 — 'marcador muito distante'. Testa se o observador espacial "
               "mede marcação de verdade ou só declara.",
        "edits": [(
            "let tp=ap-(tm._r13Overload?4.15:3.1);",
            "let tp=ap-(tm._r13Overload?4.15:3.1)-16;",
        )],
        "expect_fail": ["marking_coverage", "marker_distance"],
        "proves": "Os gates de marcação reagem à distância real do marcador.",
    },
    {
        "id": "mut-line-scatter",
        "title": "Linha defensiva espalhada em profundidade (stagger 0,42 → 14 m)",
        "why": "§7 — 'linha defensiva desconectada'.",
        "edits": [(
            "const stagger=((p.idx||0)%3-1)*.42;",
            "const stagger=((p.idx||0)%3-1)*14;",
        )],
        "expect_fail": ["defensive_line_range", "disconnected_lines"],
        "proves": "Os gates de linha reagem à desconexão real.",
    },
    {
        "id": "mut-hidden-style-bonus",
        "title": "Bônus oculto de gol para o estilo 'wings'",
        "why": "§7 — 'formação dominante por regra escondida' e §56 — 'bônus "
               "direto de gol por estilo'. Testa a varredura do §41.",
        "edits": [(
            "let pGoal=base*CAL.shooting.conversionScale*angMul",
            "let pGoal=base*CAL.shooting.conversionScale*"
            "(this.teams[o.team].styleKey==='wings'?1.75:1)*angMul",
        )],
        "expect_fail": ["no_hidden_modifiers"],
        "proves": "A varredura estática acusa modificador novo por nome de estilo.",
    },
    {
        "id": "mut-ball-lock",
        "title": "Regressão do piso de decisão: o portador volta a congelar",
        "why": "§7 — o P0 já corrigido precisa continuar detectável. Se este "
               "teste não acusar, a correção não tem rede de proteção.",
        "build_without": ["r14-buildup-decide-ceiling"],
        "expect_fail": ["no_possession_lock"],
        "proves": "O detector de trava de posse continua vivo.",
    },
]


def build_mutant(mut, out_html):
    cmd = [PY, "tools/build_ux.py", "--out", str(out_html)]
    for pid in mut.get("build_without", []):
        cmd += ["--without", pid]
    code, out = run(cmd)
    if code != 0:
        return False, f"build falhou: {out[-500:]}"

    edits = mut.get("edits", [])
    if edits:
        html = out_html.read_text(encoding="utf-8")
        for frm, to in edits:
            n = html.count(frm)
            if n != 1:
                return False, (f"âncora de mutação ocorre {n}x (esperado 1): "
                               f"{frm[:70]!r}")
            html = html.replace(frm, to, 1)
        out_html.write_text(html, encoding="utf-8")
    return True, hashlib.sha256(out_html.read_bytes()).hexdigest()


def main():
    args = sys.argv[1:]
    def opt(n, d=None):
        return args[args.index(n) + 1] if n in args else d

    only = opt("--only")
    repeats = opt("--repeats", "1")
    muts = [m for m in MUTATIONS if not only or m["id"] == only]
    WORK.mkdir(parents=True, exist_ok=True)

    results = []
    for mut in muts:
        d = WORK / mut["id"]
        d.mkdir(parents=True, exist_ok=True)
        html = d / "build.html"
        rec = {"id": mut["id"], "title": mut["title"], "why": mut["why"],
               "proves": mut["proves"], "expect_fail": mut["expect_fail"]}

        print(f"\n=== {mut['id']} — {mut['title']}")
        ok, info = build_mutant(mut, html)
        if not ok:
            rec.update(detected=False, error=info)
            results.append(rec)
            print(f"    ERRO: {info}")
            continue
        rec["mutant_sha256"] = info

        # Artefatos de integridade: o mutante NÃO é reproduzível a partir da
        # fonte — é esperado e irrelevante aqui, então gravamos um artefato
        # mínimo para os gates de integridade não poluírem o resultado.
        (d / "integridade.json").write_text(json.dumps({
            "candidate": str(html), "candidate_sha256": info,
            "r13_byte_identical": True, "candidate_reproducible": True,
            "syntax_ok": True, "smoke_ok": True, "scenarios_ok": True,
            "note": "artefato sintético do teste de mutação",
        }, indent=1), encoding="utf-8")

        code, out = run([PY, "tools/r15/scan_hidden_modifiers.py",
                         "--build", str(html.relative_to(ROOT)).replace("\\", "/"),
                         "--out", str((d / "modificadores-ocultos.json").relative_to(ROOT)).replace("\\", "/")])

        code, out = run([NODE, "tools/ux/probe_balllock.js",
                         f"--build={html.relative_to(ROOT)}".replace("\\", "/"),
                         "--styleMatrix=1", f"--repeats={repeats}",
                         f"--out={(d / 'baseline-styles.json').relative_to(ROOT)}".replace("\\", "/")])
        if not (d / "baseline-styles.json").exists():
            rec.update(detected=False, error=f"probe falhou: {out[-400:]}")
            results.append(rec)
            print(f"    ERRO: probe falhou")
            continue

        code, out = run([PY, "tools/r15/aggregate_release.py",
                         "--sha", info,
                         "--artifact-dir", f"reports/r15/mutations/{mut['id']}",
                         "--relax-samples", "40",
                         "--out", f"reports/r15/mutations/{mut['id']}/certificacao.json"])
        cert = json.loads((d / "certificacao.json").read_text(encoding="utf-8"))
        states = {g["id"]: g["status"] for g in cert["gates"]}
        detail = {g["id"]: {"status": g["status"], "value": g["value"],
                            "n": g["samples"], "reason": g["reason"]}
                  for g in cert["gates"] if g["id"] in mut["expect_fail"]}

        detected = all(states.get(g) == "FAIL" for g in mut["expect_fail"])
        rec.update(detected=detected, gate_states=detail, verdict=cert["verdict"])
        results.append(rec)

        mark = "DETECTADA" if detected else "NAO DETECTADA"
        print(f"    {mark} · release={cert['verdict']}")
        for gid, g in detail.items():
            v = round(g["value"], 4) if isinstance(g["value"], float) else g["value"]
            print(f"      {gid:<28} {g['status']:<13} valor={v} n={g['n']}")

    report = {
        "mutations_run": len(results),
        "detected": sum(1 for r in results if r.get("detected")),
        "trustworthy": all(r.get("detected") for r in results),
        "results": results,
    }
    out_path = ROOT / "reports/r15/mutacoes.json"
    out_path.write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")

    print("\n" + "=" * 70)
    print(f"MUTAÇÕES: {report['detected']}/{report['mutations_run']} detectadas")
    print(f"SISTEMA DE GATES CONFIÁVEL: {report['trustworthy']}")
    print(f"artefato: reports/r15/mutacoes.json")
    return 0 if report["trustworthy"] else 1


if __name__ == "__main__":
    sys.exit(main())
