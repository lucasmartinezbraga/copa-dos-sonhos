#!/usr/bin/env python3
"""Monta o pacote de handoff para continuar o trabalho em outra janela."""
import zipfile, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path.home() / "Downloads" / "COPA_DOS_SONHOS_HANDOFF_R16.zip"

FIXOS = [
    "HANDOFF-R16-POLIMENTO.md",
    "HANDOFF-MOTOR.md",
    "CLAUDE.md",
    "src/r14/patches-engine.json",
    "src/r14/10-action-contract.js",
    "src/r14/20-setpiece-walk.js",
    "src/ux/40-match.css",
    "manifests/r15-release-gates.json",
    "manifests/r13-build-manifest.json",
    "tools/build_ux.py",
    "tools/verify_r13.py",
]

ARTEFATOS = [
    "certificacao.json", "avaliacao-r160.json", "avaliacao-r162.json",
    "matriz-rastreabilidade.csv", "matriz-rastreabilidade.json",
    "modificadores-ocultos.json", "linha-defensiva.json",
    "linha-defensiva-r152.json", "teleport-perfil.json",
    "teleport-perfil-r156.json", "teleport-origem.json",
    "jitter-com.json", "jitter-sem.json", "jitter-overlap.json",
    "jitter-r160.json", "jitter-r162.json", "skill-tiers.json",
    "estrutura-tatica.json", "integridade-r162.json", "mutacoes.json",
    "defend-branches.json", "layout-partida.json", "fps-live.json",
]

BUILDS = [
    "dist/COPA DOS SONHOS - R15.9.html",
    "dist/COPA DOS SONHOS - R16.2.html",
]


def main():
    alvos = list(FIXOS)
    alvos += [str(p.relative_to(ROOT)).replace("\\", "/")
              for p in sorted(ROOT.glob("tools/r15/*")) if p.is_file()]
    alvos += [str(p.relative_to(ROOT)).replace("\\", "/")
              for p in sorted(ROOT.glob("reports/r15/*.md"))]
    alvos += [f"reports/r15/{n}" for n in ARTEFATOS
              if (ROOT / "reports/r15" / n).exists()]
    alvos += BUILDS

    vistos, n = set(), 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for rel in alvos:
            if rel in vistos:
                continue
            vistos.add(rel)
            p = ROOT / rel
            if p.exists() and p.is_file():
                z.write(p, rel)
                n += 1

    sha = hashlib.sha256(OUT.read_bytes()).hexdigest()
    print(OUT)
    print(f"arquivos: {n}  ·  {OUT.stat().st_size/1024/1024:.2f} MB")
    print(f"sha256: {sha}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
