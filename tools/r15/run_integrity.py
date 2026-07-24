#!/usr/bin/env python3
"""
Produz o artefato de INTEGRIDADE consumido pelo agregador (§26).

Mede, sem interpretar:
  · a R13.0 congelada continua byte-idêntica ao SHA de contrato;
  · a fonte versionada reconstrói o candidato declarado, byte a byte;
  · sintaxe dos módulos, smoke estático e cenários dirigidos.

Cada resultado vira um booleano no JSON. O veredito é do agregador, não daqui —
por isso este script sai com 0 mesmo quando algo falha: quem reprova é o §26.

Uso:
    python tools/r15/run_integrity.py --candidate "dist/....html" \
        [--out reports/r15/integridade.json] [--with <patch-id>] [--without <patch-id>]
"""
import json, hashlib, os, re, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PY = sys.executable

# O Node é portátil e não está no PATH. verify_r13.py o invoca para checar
# sintaxe; sem isto o subprocesso morre com WinError 2 e a integridade seria
# reportada como falha por motivo errado.
NODE_DIR = Path(os.environ.get("LOCALAPPDATA", "")) / "nodejs-portable" / "node-v24.18.0-win-x64"


def child_env():
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    if NODE_DIR.exists():
        env["PATH"] = str(NODE_DIR) + os.pathsep + env.get("PATH", "")
    return env


def sha256(p: Path):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(cmd):
    r = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True,
                       encoding="utf-8", errors="replace", env=child_env())
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def main():
    args = sys.argv[1:]
    def opt(n, d=None):
        return args[args.index(n) + 1] if n in args else d
    def opts(n):
        return [args[i + 1] for i, a in enumerate(args) if a == n and i + 1 < len(args)]

    cand_rel = opt("--candidate")
    if not cand_rel:
        sys.exit("ERRO: --candidate é obrigatório")
    cand = ROOT / cand_rel
    if not cand.exists():
        sys.exit(f"ERRO: candidato não encontrado: {cand}")
    cand_sha = sha256(cand)

    report = {
        "candidate": cand_rel,
        "candidate_sha256": cand_sha,
        "candidate_bytes": cand.stat().st_size,
    }

    # ── 1. verify_r13: identidade da base congelada + sintaxe + smoke + cenários
    code, out = run([PY, "tools/verify_r13.py"])
    report["verify_r13_exit"] = code
    report["r13_byte_identical"] = "EQUIVAL" in out and "OK (== R13.0 autoritativo)" in out
    report["syntax_ok"] = "OK: sintaxe de todos os módulos de script" in out
    m = re.search(r"smoke est[áa]tico (\d+)/(\d+)", out)
    report["smoke_ok"] = bool(m) and m.group(1) == m.group(2)
    report["smoke_detail"] = m.group(0) if m else None
    m = re.search(r"cen[áa]rios dirigidos (\d+)/(\d+)", out)
    report["scenarios_ok"] = bool(m) and m.group(1) == m.group(2)
    report["scenarios_detail"] = m.group(0) if m else None
    m = re.search(r"build_sha256:\s*([0-9a-f]{64})", out)
    report["r13_sha256"] = m.group(1) if m else None

    # ── 2. O candidato é reproduzível a partir da fonte?
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "rebuild.html"
        cmd = [PY, "tools/build_ux.py", "--out", str(tmp)]
        for p in opts("--with"):
            cmd += ["--with", p]
        for p in opts("--without"):
            cmd += ["--without", p]
        code, out = run(cmd)
        report["rebuild_exit"] = code
        if code == 0 and tmp.exists():
            rebuilt = sha256(tmp)
            report["rebuild_sha256"] = rebuilt
            report["candidate_reproducible"] = (rebuilt == cand_sha)
            m = re.search(r"patches de MOTOR \(R14\): (.+)", out)
            report["engine_patches"] = m.group(1).strip() if m else None
            m = re.search(r"patches de MOTOR ignorados: (.+)", out)
            report["engine_patches_skipped"] = m.group(1).strip() if m else None
        else:
            report["candidate_reproducible"] = False
            report["rebuild_error"] = out[-800:]

    out_rel = opt("--out", "reports/r15/integridade.json")
    (ROOT / out_rel).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / out_rel).write_text(json.dumps(report, indent=1, ensure_ascii=False),
                                encoding="utf-8")

    for k in ("r13_byte_identical", "candidate_reproducible", "syntax_ok",
              "smoke_ok", "scenarios_ok"):
        print(f"  {k:<28} {report.get(k)}")
    print(f"  candidate_sha256             {cand_sha}")
    print(f"\nartefato: {out_rel}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
