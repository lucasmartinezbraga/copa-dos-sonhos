#!/usr/bin/env python3
"""Le a saida da pilha.js e publica o CENSO de sobrescritas mortas.

Por que existe
--------------
`pilha.js` imprime um relatorio para humano, truncado na largura do terminal, e
o numero que ele da depende de QUANTAS PARTIDAS rodaram. Medido em 2026-08-13,
na camada 07:

    n=4  -> 12 sobrescritas mortas
    n=12 -> 11
    n=24 -> 11

O metodo que mudou de lado tem nome: `_continueTravel`, morto com 4 partidas e
vivo com 24. Quem apagasse com a evidencia curta removeria um metodo vivo do
caminho da bola em voo. Por isso o D34 exige 300 partidas ANTES de apagar
qualquer coisa — e por isso a contagem precisa virar arquivo, nao olhada.

Uso:
  python3 tools/fisica/censo.py pilha-300.txt                  # publica o censo
  python3 tools/fisica/censo.py pilha-24.txt pilha-300.txt     # e compara
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

CAB_METODO = re.compile(r"^  (_[A-Za-z0-9_]+|get[A-Za-z0-9_]+)\s+\((\d+) camadas\)")
LINHA_CAMADA = re.compile(r"^\s+(MORTA|TERMINAL|VIVA)\s+(\S+)\s+(\d+) chamadas")
# O resumo final tem a CONTAGEM autoritativa por bloco, mas trunca os NOMES na
# largura do terminal. As secoes detalhadas tem os nomes, mas o pilha.js so
# imprime secao para parte dos metodos. Por isso os dois sao lidos: contagem do
# resumo, nomes da uniao — e o relatorio AVISA quando faltam nomes.
# (Ler so as secoes detalhadas dava 11 onde o pilha.js dizia 17. Eu quase
#  publiquei o 11.)
LINHA_RESUMO = re.compile(r"^  (\S+)\s+(\d+)\s+([_a-zA-Z].*)$")
MARCO_RESUMO = "TODAS AS SOBRESCRITAS MORTAS, POR BLOCO"


def ler(caminho: Path) -> dict:
    """{metodo: [(estado, bloco, chamadas), ...]} na ordem da pilha."""
    metodos: dict[str, list] = {}
    atual = None
    for linha in caminho.read_text(encoding="utf8", errors="replace").split("\n"):
        m = CAB_METODO.match(linha)
        if m:
            atual = m.group(1)
            metodos.setdefault(atual, [])
            continue
        c = LINHA_CAMADA.match(linha)
        if c and atual:
            metodos[atual].append((c.group(1), c.group(2), int(c.group(3))))
    return metodos


def mortos_por_bloco(metodos: dict) -> dict[str, set]:
    fora: dict[str, set] = {}
    for metodo, camadas in metodos.items():
        for estado, bloco, _n in camadas:
            if estado == "MORTA":
                fora.setdefault(bloco, set()).add(metodo)
    return fora


def resumo(caminho: Path) -> dict[str, tuple[int, set]]:
    """{bloco: (contagem autoritativa, nomes que couberam na linha)}."""
    texto = caminho.read_text(encoding="utf8", errors="replace").split("\n")
    try:
        i = next(k for k, l in enumerate(texto) if MARCO_RESUMO in l)
    except StopIteration:
        return {}
    out: dict[str, tuple[int, set]] = {}
    ultimo = None
    for linha in texto[i + 1:]:
        if not linha.strip():
            break
        m = LINHA_RESUMO.match(linha)
        if m:
            nomes = {x.strip() for x in m.group(3).split(",") if x.strip()}
            ultimo = m.group(1)
            out[ultimo] = (int(m.group(2)), nomes)
            continue
        # linha de CONTINUACAO: o pilha.js quebra a lista longa em varias linhas,
        # indentadas ate a coluna dos nomes. Sem ler isto o censo reporta
        # "nome truncado" para uma lista que esta inteira na saida.
        if ultimo and re.match(r"^\s{20,}[_a-zA-Z][\w, ]*$", linha):
            extra = {x.strip() for x in linha.split(",") if x.strip()}
            n, nomes = out[ultimo]
            out[ultimo] = (n, nomes | extra)
    return out


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    novo = Path(sys.argv[1])
    if not novo.exists():
        print(f"nao existe: {novo}", file=sys.stderr)
        return 1
    m_novo = ler(novo)
    censo = mortos_por_bloco(m_novo)
    res = resumo(novo)
    # a contagem manda; os nomes sao a uniao do que as duas fontes deram
    for bloco, (_n, nomes) in res.items():
        censo.setdefault(bloco, set()).update(nomes)

    # get* sao diagnostico que ninguem chama; separar evita inflar o numero
    def so_comportamento(s: set) -> set:
        return {x for x in s if not x.startswith("get")}

    print(f"CENSO DE SOBRESCRITAS MORTAS — {novo.name}")
    print(f"  {len(censo)} blocos com pelo menos uma sobrescrita morta\n")
    print(f"  {'bloco':48s} {'total':>5} {'nomes':>5}  metodos de COMPORTAMENTO conhecidos")
    faltando = 0
    for bloco in sorted(censo, key=lambda b: -res.get(b, (0, set()))[0]):
        total = res.get(bloco, (len(censo[bloco]), set()))[0]
        comp = sorted(so_comportamento(censo[bloco]))
        vistos = len(censo[bloco])
        if vistos < total:
            faltando += total - vistos
        marca = "" if vistos >= total else f"  <- {total - vistos} nome(s) truncado(s) pelo pilha.js"
        if comp or total:
            print(f"  {bloco:48s} {total:5d} {vistos:5d}  {', '.join(comp) or '(so get*)'}{marca}")
    if faltando:
        print(f"\n  ATENCAO: {faltando} nome(s) nao aparecem em lugar nenhum da saida — o pilha.js")
        print("  trunca a linha do resumo na largura do terminal e nao imprime secao detalhada")
        print("  para todo metodo. A CONTAGEM e confiavel; a lista de nomes nao esta completa.")

    if len(sys.argv) >= 3:
        velho = Path(sys.argv[2])
        m_velho = ler(velho)
        c_velho = mortos_por_bloco(m_velho)
        print(f"\nCOMPARACAO com {velho.name} — quem REVIVEU ao rodar mais partidas:")
        achou = False
        for bloco, antes in sorted(c_velho.items()):
            reviveu = sorted(so_comportamento(antes - censo.get(bloco, set())))
            if reviveu:
                achou = True
                print(f"  {bloco:48s} {', '.join(reviveu)}")
        if not achou:
            print("  nenhum — a contagem nao se mexeu entre as duas amostras")
        print("\n  Reviver aqui significa: aparecia como MORTA na amostra menor.")
        print("  Apagar com base nela teria removido codigo VIVO.")

    saida = novo.with_suffix(".censo.json")
    saida.write_text(json.dumps(
        {b: sorted(v) for b, v in sorted(censo.items())}, indent=1, ensure_ascii=False),
        encoding="utf8")
    print(f"\n  censo gravado em {saida}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
