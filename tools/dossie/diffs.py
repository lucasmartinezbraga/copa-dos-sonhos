#!/usr/bin/env python3
"""Um patch por defeito executado — o que JA FOI FEITO, linha por linha.

Por que este arquivo existe
---------------------------
O dossie inteiro descreve o que **precisa** ser feito. Nao havia um lugar que
mostrasse como e uma mudanca **aceita** neste projeto: o tamanho tipico, o tom
do comentario, a forma do commit, o que foi medido antes e depois.

Quem chega agora tem o catalogo (o que fazer) e o guia (como trabalhar) e nao
tem o exemplo. Isto e o exemplo, tirado do git, nao escrito a mao — entao nao
envelhece em relacao ao codigo.

Uso:
  python3 tools/dossie/diffs.py [destino]
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DEST = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "reports" / "diffs"

# Um defeito por commit. A chave e o ID; o valor e como achar o commit.
# Procuro pelo ID no assunto do commit — e por isso que a convencao de escrever
# "fix(D03):" no assunto vale a pena.
IDS = [f"D{n:02d}" for n in range(1, 35)]

# O patch mostra o CODIGO da mudanca. `dist/` e gerado, `reports/` e papel:
# nenhum dos dois diz nada sobre o tamanho do conserto.
ESCOPO = ["src/", "tools/", "calibration/", "manifests/", "tests/"]


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=RAIZ, capture_output=True,
                          text=True, check=False).stdout


def commits_por_defeito() -> dict[str, list[dict]]:
    bruto = git("log", "--format=%H\x1f%ad\x1f%s\x1f%b\x1e", "--date=short")
    achados: dict[str, list[dict]] = {}
    for reg in bruto.split("\x1e"):
        reg = reg.strip("\n")
        if not reg:
            continue
        partes = reg.split("\x1f")
        if len(partes) < 3:
            continue
        sha, data, assunto = partes[0], partes[1], partes[2]
        corpo = partes[3] if len(partes) > 3 else ""
        for ident in IDS:
            # so o assunto conta como autoria; o corpo cita defeitos vizinhos
            if re.search(rf"\b{ident}\b", assunto):
                achados.setdefault(ident, []).append(
                    dict(sha=sha, curto=sha[:8], data=data, assunto=assunto,
                         corpo=corpo.strip()))
    return achados


def main() -> int:
    DEST.mkdir(parents=True, exist_ok=True)
    achados = commits_por_defeito()
    if not achados:
        print("nenhum commit com ID de defeito no assunto — nada a exportar")
        return 1

    indice = []
    for ident in sorted(achados):
        for i, c in enumerate(achados[ident]):
            sufixo = "" if len(achados[ident]) == 1 else f"-{i + 1}"
            nome = f"{ident}{sufixo}-{c['curto']}.patch"
            # --stat junto para se ler o tamanho da mudanca sem abrir o patch
            # SO o codigo. Sem este filtro o patch do D11 saiu com +5314 linhas
            # porque o commit levou junto as fichas e o PDF regravados — e ai o
            # arquivo mente sobre o tamanho de uma mudanca aceita, que e
            # justamente o que ele existe para mostrar.
            patch = git("show", "--stat", "--patch", "--format=fuller", c["sha"],
                        "--", *ESCOPO)
            (DEST / nome).write_text(patch, encoding="utf8")
            linhas = git("show", "--numstat", "--format=", c["sha"],
                         "--", *ESCOPO).strip().splitlines()
            mais = menos = 0
            arquivos = []
            for ln in linhas:
                p = ln.split("\t")
                if len(p) == 3 and p[0].isdigit() and p[1].isdigit():
                    mais += int(p[0]); menos += int(p[1]); arquivos.append(p[2])
            indice.append(dict(defeito=ident, arquivo=nome, sha=c["curto"],
                               data=c["data"], assunto=c["assunto"],
                               linhas_add=mais, linhas_del=menos,
                               arquivos=arquivos))
            print(f"  {nome:<34} +{mais:<5} -{menos:<5} {c['assunto'][:52]}")

    (DEST / "indice.json").write_text(json.dumps(indice, indent=1, ensure_ascii=False),
                                      encoding="utf8")

    md = ["# O que já foi feito — um patch por defeito",
          "",
          "Gerado por `python3 tools/dossie/diffs.py` direto do git, não escrito à",
          "mão. Serve para uma coisa que nenhum outro arquivo do dossiê faz:",
          "**mostrar o tamanho e o formato de uma mudança que foi aceita aqui.**",
          "",
          "Repare no padrão, porque ele é o contrato:",
          "",
          "- a mudança é pequena e tem um alvo só;",
          "- o comentário no código diz **o que foi medido**, não o que se espera;",
          "- o assunto do commit carrega o ID do defeito (é o que torna este",
          "  arquivo possível);",
          "- quando a medição contrariou a hipótese, o commit **diz isso** em vez de",
          "  ajustar a hipótese.",
          "",
          "| defeito | commit | data | linhas | assunto |",
          "|---|---|---|---|---|"]
    for r in indice:
        md.append(f"| **{r['defeito']}** | `{r['sha']}` | {r['data']} | "
                  f"+{r['linhas_add']} −{r['linhas_del']} | {r['assunto']} |")
    md += ["",
           "## Como ler um patch daqui",
           "",
           "```bash",
           "git show <sha>                    # o commit inteiro, com contexto",
           "git apply --check <arquivo>.patch # o patch ainda aplica?",
           "```",
           "",
           "Os arquivos `.patch` são saída de `git show --stat --patch`, então",
           "trazem o `--stat` no topo: dá para ver o tamanho da mudança sem rolar",
           "o diff inteiro."]
    (DEST / "LEIA-ME.md").write_text("\n".join(md) + "\n", encoding="utf8")

    print(f"\n{len(indice)} patches em {DEST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
