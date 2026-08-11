#!/usr/bin/env python3
"""Carrega UM defeito: a ficha, a secao do documento e o CODIGO ATUAL.

Por que este arquivo existe
---------------------------
`reports/INVESTIGACAO-COMPLETA-2026-08.md` tem ~4.900 linhas. Uma IA que va
consertar um defeito nao deve ler o documento inteiro — deve pedir o defeito.

Este comando devolve, num lugar so:
  1. a ficha do catalogo (dono, criterio de aceite, dependencias, risco);
  2. a secao do documento correspondente, extraida por intervalo de linhas;
  3. o CODIGO COMO ELE ESTA AGORA em cada endereco, localizado por ancora —
     nao pelo numero de linha, que envelhece.

O item 3 e o que impede o documento de virar ficcao: se o codigo mudou desde
que o texto foi escrito, voce ve a diferenca na hora, no mesmo terminal.

Uso:
  python3 tools/defeito.py D08              # ficha + documento + codigo
  python3 tools/defeito.py D08 --so-codigo  # so o codigo atual
  python3 tools/defeito.py D08 --so-ficha   # so a ficha (saida curta)
  python3 tools/defeito.py --lista          # a tabela dos 34, uma linha cada
  python3 tools/defeito.py --fase F1        # os defeitos de uma fase
  python3 tools/defeito.py --proximo        # o que fazer agora, sem dependencia pendente
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
INDICE = RAIZ / "reports" / "defeitos.json"
CONTEXTO = 12  # linhas de codigo acima e abaixo da ancora

SEV_COR = {"estrutural": "\033[31m", "futebol": "\033[33m",
           "higiene": "\033[36m", "tela": "\033[35m"}
RESET = "\033[0m"


def carregar() -> dict:
    if not INDICE.exists():
        print("reports/defeitos.json nao existe. Rode: python3 tools/defeitos.py",
              file=sys.stderr)
        raise SystemExit(1)
    return json.loads(INDICE.read_text(encoding="utf8"))


def regra(titulo: str = "") -> None:
    print("\n" + "─" * 78)
    if titulo:
        print(titulo)
        print("─" * 78)


def mostrar_ficha(d: dict) -> None:
    cor = SEV_COR.get(d["sev"], "")
    print(f'{cor}{d["id"]}{RESET}  {d["titulo"]}')
    print(f'     severidade: {d["sev"]}   fase: {d["fase"]}   estado: {d["estado"]}')
    print()
    print(f'  DONO (quem realmente executa):')
    print(f'     {d["dono"]}')
    if d["intercepta"]:
        print(f'  CAMADAS QUE INTERCEPTAM: {", ".join(d["intercepta"])}')
        print(f'     confirme com: node tools/fisica/pilha.js dist/index.html 14')
    print()
    print(f'  EVIDENCIA MEDIDA:')
    print(f'     {d["evidencia"]}')
    print()
    print(f'  CRITERIO DE ACEITE:')
    for c in d["criterio"]:
        print(f'     - {c}')
    if d["depende"]:
        print()
        print(f'  DEPENDE DE: {", ".join(d["depende"])}  <- faca esses ANTES')
    print()
    print(f'  RISCO: {d["risco"]}')


def mostrar_codigo(d: dict) -> None:
    if not d["locais"]:
        print("  (este defeito nao tem endereco unico — e distribuido)")
        return
    for loc in d["locais"]:
        anc = loc.get("ancora") or ""
        caminho = RAIZ / loc["arquivo"]
        print()
        if not anc:
            print(f'  {loc["arquivo"]}  (sem ancora)')
            continue
        texto = caminho.read_text(encoding="utf8")
        n = texto.count(anc)
        if n != 1:
            print(f'  \033[31m{loc["arquivo"]}: ancora aparece {n}x — o catalogo '
                  f'envelheceu. Rode python3 tools/defeitos.py\033[0m')
            continue
        linhas = texto.split("\n")
        alvo = texto[: texto.index(anc)].count("\n")  # 0-based
        ini = max(0, alvo - CONTEXTO)
        fim = min(len(linhas), alvo + CONTEXTO + 1)
        antiga = loc.get("linha")
        aviso = ""
        if antiga and antiga != alvo + 1:
            aviso = f"   \033[33m(o documento dizia linha {antiga} — o codigo andou)\033[0m"
        print(f'  \033[1m{loc["arquivo"]}:{alvo + 1}\033[0m{aviso}')
        print()
        for i in range(ini, fim):
            marca = "\033[32m>\033[0m" if i == alvo else " "
            print(f"  {marca} {i + 1:>5} │ {linhas[i]}")


def mostrar_secao(d: dict) -> None:
    sec = d.get("secao")
    if not sec:
        print("  (sem secao no documento)")
        return
    doc = (RAIZ / sec["arquivo"]).read_text(encoding="utf8").split("\n")
    for ln in doc[sec["linha_inicio"] - 1: sec["linha_fim"]]:
        print("  " + ln)


def lista(dados: dict, fase: str | None = None) -> None:
    print(f'{"id":<5} {"sev":<11} {"fase":<6} {"estado":<12} titulo')
    print("─" * 100)
    for d in dados["defeitos"]:
        if fase and d["fase"] != fase:
            continue
        cor = SEV_COR.get(d["sev"], "")
        dep = f'  <- depende de {",".join(d["depende"])}' if d["depende"] else ""
        print(f'{cor}{d["id"]:<5}{RESET} {d["sev"]:<11} {d["fase"]:<6} '
              f'{d["estado"]:<12} {d["titulo"][:58]}{dep}')


def proximo(dados: dict) -> None:
    feitos = {d["id"] for d in dados["defeitos"]
              if d["estado"] in ("feito", "guarda-corpo")}
    pronto = [d for d in dados["defeitos"]
              if d["estado"] == "aberto" and set(d["depende"]) <= feitos]
    ordem = {"F0": 0, "F1": 1, "F2": 2, "F3": 3, "F4": 4, "F5": 5, "F6": 6}
    pronto.sort(key=lambda d: (ordem.get(d["fase"], 9), d["id"]))
    print("Defeitos SEM dependencia pendente, em ordem de fase:\n")
    for d in pronto[:8]:
        cor = SEV_COR.get(d["sev"], "")
        print(f'  {cor}{d["id"]}{RESET} [{d["fase"]}] {d["titulo"][:64]}')
    print()
    cp = dados.get("comece_por")
    if cp:
        alvo = cp["id"]
        print(f'\033[1mO documento recomenda comecar por {alvo}\033[0m')
        print(f'  {cp["porque"]}')
        print()
        print(f'  python3 tools/defeito.py {alvo}')
    elif pronto:
        print(f'Comece por {pronto[0]["id"]}:  python3 tools/defeito.py {pronto[0]["id"]}')


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2
    dados = carregar()

    if args[0] == "--lista":
        lista(dados)
        return 0
    if args[0] == "--fase":
        if len(args) < 2:
            print("uso: --fase F1", file=sys.stderr)
            return 2
        lista(dados, args[1])
        return 0
    if args[0] == "--proximo":
        proximo(dados)
        return 0

    ident = args[0].upper()
    d = next((x for x in dados["defeitos"] if x["id"] == ident), None)
    if not d:
        print(f"defeito {ident} nao existe. Veja: python3 tools/defeito.py --lista",
              file=sys.stderr)
        return 1

    so_codigo = "--so-codigo" in args
    so_ficha = "--so-ficha" in args

    if not so_codigo:
        regra()
        mostrar_ficha(d)
    if not so_ficha:
        regra("CODIGO ATUAL (localizado por ancora, nao por numero de linha)")
        mostrar_codigo(d)
    if not so_codigo and not so_ficha:
        regra(f'DOCUMENTO — {d["secao"]["arquivo"]}:'
              f'{d["secao"]["linha_inicio"]}-{d["secao"]["linha_fim"]}'
              if d.get("secao") else "DOCUMENTO")
        mostrar_secao(d)
        regra("ANTES DE EDITAR")
        print("  node tools/fisica/pilha.js dist/index.html 14   # confirme o DONO acima")
        print("  bash tools/aceitar.sh --antes")
        print("  # ... edite src/, NUNCA dist/ ...")
        identico = any("identica" in c.lower() for c in d["criterio"])
        print(f'  bash tools/aceitar.sh --depois{" --identico" if identico else ""}')
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
