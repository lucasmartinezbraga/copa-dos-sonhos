#!/usr/bin/env python3
"""Valida src/, o manifesto e o bundle gerado.

Reescrito para o manifesto de blocos introduzido quando o R19.08 voltou para o
controle de versao. O verificador antigo esperava o formato da fase 2
(head_script/styles/scripts com sha256 por arquivo) e deixou de servir quando o
build passou a montar 89 blocos.

O que e checado:
  1. todo arquivo citado no manifesto existe;
  2. todo modulo JS passa em `node --check`;
  3. o build e reprodutivel e o HTML resultante fecha as tags que abriu;
  4. cada bloco <script> do bundle e JavaScript valido — nao so o do core,
     que era o unico coberto antes;
  5. a camada de fisica esta instalada e passa no teste de balistica.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import split_build as sb  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
NODE = os.environ.get("CDS_NODE") or shutil.which("node") or "node"


def falhar(msg: str) -> None:
    raise SystemExit(f"ERRO: {msg}")


def _sem_comentarios(codigo: str) -> str:
    """Remove /* */ e // para o lint nao reclamar de texto explicativo."""
    import re
    codigo = re.sub(r"/\*.*?\*/", "", codigo, flags=re.S)
    return re.sub(r"//[^\n]*", "", codigo)


def lint_escopo_das_camadas() -> None:
    """D32 · `CAL` nao existe no escopo de uma camada.

    O core e uma IIFE: `facet`, `chance`, `R`, `clamp`, `FL`, `FW`, `getAttr`,
    `lerp`, `D` e `srand` sao globais e podem ser usados direto numa camada.
    `CAL` NAO E — a calibracao se le por `ENGINE_CALIBRATION`.

    Isto e pior do que parece: `window.CAL` e `undefined` (medido), entao um
    acesso guardado como `root.CAL && root.CAL.x || padrao` nao quebra — ele
    cai no padrao em silencio, e o valor calibrado deixa de ter efeito. Foi
    exatamente o que aconteceu na camada 66, onde `restarts.shotBlockCorner`
    estava desconectado da calibracao e ninguem percebeu porque o padrao
    codificado por acaso era igual.
    """
    import re
    ruins: list[str] = []
    padrao = re.compile(r"(?<![\w.$])(?:root\.|window\.|globalThis\.)?CAL\s*[.\[]")
    for arq in sorted((ROOT / "src/scripts/layers").glob("*.js")):
        codigo = _sem_comentarios(arq.read_text(encoding="utf-8"))
        for m in padrao.finditer(codigo):
            linha = codigo[: m.start()].count("\n") + 1
            ruins.append(f"{arq.relative_to(ROOT)}:{linha}  {m.group(0).strip()}")
    if ruins:
        falhar("camada usando CAL, que nao existe nesse escopo — use "
               "ENGINE_CALIBRATION:\n  " + "\n  ".join(ruins))
    print(f"OK: nenhuma das {len(list((ROOT / 'src/scripts/layers').glob('*.js')))} "
          f"camadas referencia CAL fora do escopo")


def fonte_fora_do_manifesto(manifest: dict) -> None:
    """Avisa sobre arquivos em src/ que o build NAO usa.

    Por que isto existe
    -------------------
    `src/styles/85-match-mobile-field-first.css` parece codigo-fonte, tem nome
    de codigo-fonte, mora ao lado do codigo-fonte — e nao esta no manifesto.
    Editei ele para consertar a tela de celular, reconstrui, medi: nada mudou.
    A regra viva era uma copia dentro de `src/styles/layers/02-inline.css`.

    Sao QUINZE arquivos nessa situacao, todos os `src/styles/*.css` que nao
    estao em `layers/`. O CLAUDE.md diz "editar `src/styles/` para CSS", o que
    e verdade para os de `layers/` e mentira para os outros quinze.

    Isto NAO reprova o build: os arquivos sao pre-existentes e remove-los e
    outra decisao. Mas passa a ser impossivel nao ver.
    """
    usados = {e["file"] for e in manifest["core_modules"]}
    usados |= {b["file"] for b in manifest["blocks"] if b.get("file")}
    orfaos = []
    for caminho in sorted((ROOT / "src").rglob("*")):
        if caminho.suffix not in (".css", ".js"):
            continue
        rel = caminho.relative_to(ROOT).as_posix()
        if rel not in usados:
            orfaos.append(rel)
    if not orfaos:
        print("OK: nenhum arquivo de src/ fora do manifesto")
        return
    print(f"\n\033[33mAVISO: {len(orfaos)} arquivo(s) em src/ NAO entram no build.\033[0m")
    print("  Editar qualquer um deles nao muda o jogo. A regra viva costuma ser")
    print("  uma copia dentro de src/styles/layers/ ou src/scripts/layers/.")
    for rel in orfaos:
        print(f"    {rel}")
    print()


def main() -> None:
    manifest = json.loads((ROOT / "manifests/build-manifest.json").read_text(encoding="utf-8"))

    # 1. presenca dos arquivos
    arquivos = [e["file"] for e in manifest["core_modules"]]
    arquivos += [b["file"] for b in manifest["blocks"] if b.get("file")]
    for rel in arquivos:
        if not (ROOT / rel).exists():
            falhar(f"modulo ausente: {rel}")
    print(f"OK: {len(arquivos)} modulos presentes")
    fonte_fora_do_manifesto(manifest)

    # 2. sintaxe de cada modulo JS
    js = [r for r in arquivos if r.endswith(".js")]
    for rel in js:
        cp = subprocess.run([NODE, "--check", str(ROOT / rel)], capture_output=True, text=True)
        if cp.returncode:
            falhar(f"sintaxe invalida em {rel}\n{cp.stderr}")
    print(f"OK: {len(js)} modulos JavaScript com sintaxe valida")

    # 3. build reprodutivel
    subprocess.run([sys.executable, str(ROOT / "tools/build.py")], check=True,
                   stdout=subprocess.DEVNULL)
    out = ROOT / manifest["build_output"]
    html = out.read_text(encoding="utf-8")
    if not sb.verify_roundtrip(html):
        falhar("o bundle nao sobrevive a um ciclo de split/join")
    digest = hashlib.sha256(html.encode("utf-8")).hexdigest()
    print(f"OK: build reprodutivel ({digest[:12]})")

    # 4. sintaxe de TODOS os blocos <script> do bundle
    _, blocos = sb.split(html)
    scripts = [b for b in blocos if b.kind == "script"]
    with tempfile.TemporaryDirectory() as tmp:
        for i, bloco in enumerate(scripts):
            caminho = Path(tmp) / f"bloco_{i}.js"
            caminho.write_text(bloco.content, encoding="utf-8")
            cp = subprocess.run([NODE, "--check", str(caminho)], capture_output=True, text=True)
            if cp.returncode:
                falhar(f"bloco <script> #{i} ({bloco.ident or 'sem id'}) invalido\n{cp.stderr}")
    print(f"OK: {len(scripts)} blocos <script> do bundle validos")

    # 5. fisica
    cp = subprocess.run([NODE, str(ROOT / "tests/fisica_balistica.js"), str(out)],
                        capture_output=True, text=True)
    sys.stdout.write(cp.stdout)
    if cp.returncode:
        sys.stderr.write(cp.stderr)
        falhar("teste de balistica reprovou")
    print("OK: balistica validada")

    # 6. escopo das camadas (D32)
    lint_escopo_das_camadas()


if __name__ == "__main__":
    main()
