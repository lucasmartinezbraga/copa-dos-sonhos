#!/usr/bin/env python3
"""O auditor: procura sozinho as classes de defeito que este projeto achou a mao.

Por que este arquivo existe
---------------------------
Todo conserto real deste projeto veio de alguem LENDO codigo e desconfiando.
Isso nao escala e nao se lembra. Mas as descobertas caem em poucas FORMAS, e
forma da para procurar automaticamente.

O auditor NAO diz o que consertar. Ele diz onde olhar, com o motivo, e cala
quando nao tem nada — um detector que sempre acha algo e ruido.

As quatro formas
----------------
  1. CONSTANTE SOMBREADA   a mesma expressao existe no core e numa camada que
                           reimplementa o metodo. Editar a do core nao faz nada.
                           >>> Esta teria evitado a rodada perdida do D19: eu
                           editei `staminaF = 0.7 + stamina/100*0.3` no motor e
                           o funil voltou IDENTICO AO DIGITO, porque a camada 16
                           reimplementa `_integrate` com a sua propria copia.

  2. CALIBRACAO DESLIGADA  a camada le uma chave de calibracao que nao existe e
                           cai no default silenciosamente pelo `||`. Foi o D32:
                           a divisao de escanteios ficou desligada sem sinal.

  3. DERIVA MONOTONA       uma metrica que so anda para um lado ao longo das seis
                           faixas de 15 min. E a forma do D19 — a partida murcha
                           — e nenhum agregado por partida a denuncia.

  4. NUMERO MAGICO NOVO    constante numerica em camada que nao aparece em
                           calibration/ nem tem comentario ao lado. E como
                           parametro vira folclore.

Uso:
  python3 tools/auditor.py                    # tudo
  python3 tools/auditor.py --forma 1          # so uma forma
  python3 tools/auditor.py --medicao reports/REFERENCIA.json   # inclui a forma 3
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
MOTOR = RAIZ / "src" / "scripts" / "40-match-engine-and-manager-ai.js"
CORE = RAIZ / "src" / "scripts" / "20-core.js"
CAMADAS = sorted((RAIZ / "src" / "scripts" / "layers").glob("*.js"))

VERM, AMAR, VERD, CINZA, FIM = "\033[31m", "\033[33m", "\033[32m", "\033[90m", "\033[0m"


def sem_comentarios(txt: str) -> str:
    txt = re.sub(r"/\*.*?\*/", " ", txt, flags=re.S)
    return re.sub(r"(?m)//.*$", " ", txt)


# ── forma 1 · constante sombreada ────────────────────────────────────────────
def forma1(motor: Path = MOTOR, camadas: list[Path] | None = None) -> list[str]:
    """Metodo reimplementado numa camada E no core, com a MESMA constante.

    Assinatura procurada: `nome = <numero> + <algo>/100 * <numero>` e parentes —
    o formato dos fatores deste motor. Comparo por forma normalizada, entao
    `.7+x/100*.3` casa com `0.7 + x/100 * 0.3`.
    """
    achados = []
    camadas = CAMADAS if camadas is None else camadas
    if not motor.exists():
        return achados

    texto_motor = sem_comentarios(motor.read_text(encoding="utf8"))
    # metodos que alguma camada reimplementa
    reimpl: dict[str, list[Path]] = defaultdict(list)
    for c in camadas:
        for m in re.finditer(r"P\.(_?\w+)\s*=\s*function", sem_comentarios(c.read_text(encoding="utf8"))):
            reimpl[m.group(1)].append(c)

    def constantes(txt: str) -> set[str]:
        """Fatores no formato deste motor, normalizados."""
        achadas = set()
        # A expressao do meio pode ser `p.stamina` (core) ou
        # `finite(p.stamina,75)` (camada). A primeira versao deste regex nao
        # aceitava virgula e por isso NAO pegou o caso do staminaF — o unico
        # positivo conhecido. Detector nao validado contra positivo conhecido e
        # detector calado; foi assim que o portao do D11 deixou passar a
        # regressao de drawRate.
        for m in re.finditer(r"(\d*\.?\d+)\s*\+\s*[\w.(),'\"\s]*?/\s*100\s*\*\s*(\d*\.?\d+)", txt):
            a, b = m.group(1), m.group(2)
            norm = lambda s: f"{float(s):g}"
            achadas.add(f"{norm(a)}+x/100*{norm(b)}")
        return achadas

    for metodo, arquivos in sorted(reimpl.items()):
        # o corpo do metodo no core (heuristica: do nome ate a proxima definicao)
        mm = re.search(rf"(?m)^\s*{re.escape(metodo)}\s*\([^)]*\)\s*\{{", texto_motor)
        if not mm:
            continue
        corpo_core = texto_motor[mm.start(): mm.start() + 4000]
        cs_core = constantes(corpo_core)
        if not cs_core:
            continue
        for arq in arquivos:
            t = sem_comentarios(arq.read_text(encoding="utf8"))
            am = re.search(rf"P\.{re.escape(metodo)}\s*=\s*function", t)
            if not am:
                continue
            corpo_camada = t[am.start(): am.start() + 4000]
            comuns = cs_core & constantes(corpo_camada)
            if comuns:
                achados.append(
                    f"{arq.name} reimplementa {VERM}{metodo}{FIM} e repete "
                    f"{', '.join(sorted(comuns))}\n"
                    f"      {CINZA}editar essa constante no motor nao faz nada — "
                    f"a camada e que executa{FIM}")
    return achados


# ── forma 2 · calibracao desligada ───────────────────────────────────────────
def forma2() -> list[str]:
    """Camada le ENGINE_CALIBRATION.<caminho> que nao existe no arquivo."""
    alvo = RAIZ / "calibration" / "engine.json"
    if not alvo.exists():
        cands = list((RAIZ / "calibration").glob("*.json"))
        alvo = next((c for c in cands if "target" not in c.name), None)
    if not alvo or not alvo.exists():
        return []
    cal = json.loads(alvo.read_text(encoding="utf8"))

    def existe(caminho: list[str]) -> bool:
        no = cal
        for parte in caminho:
            if not isinstance(no, dict) or parte not in no:
                return False
            no = no[parte]
        return True

    achados = []
    for c in CAMADAS:
        t = sem_comentarios(c.read_text(encoding="utf8"))
        for m in re.finditer(r"ENGINE_CALIBRATION((?:\s*\.\s*\w+)+)", t):
            caminho = [p.strip() for p in m.group(1).split(".") if p.strip()]
            if len(caminho) >= 2 and not existe(caminho):
                achados.append(
                    f"{c.name} le {VERM}ENGINE_CALIBRATION.{'.'.join(caminho)}{FIM}, "
                    f"que nao existe em {alvo.name}\n"
                    f"      {CINZA}o `||` do lado direito engole isso em silencio "
                    f"(foi o D32){FIM}")
    return sorted(set(achados))


# ── forma 3 · deriva monotona por faixa ──────────────────────────────────────
def forma3(medicao: Path | None) -> list[str]:
    if not medicao or not medicao.exists():
        return []
    d = json.loads(medicao.read_text(encoding="utf8"))
    # a bateria publica isto sob `fisica`, nao na raiz. Procurei no lugar errado
    # primeiro e a forma 3 ficou CALADA — falso negativo silencioso, que e o
    # modo de falha mais caro de um detector.
    ritmo = ((d.get("fisica") or {}).get("ritmoPorFaixa")
             or d.get("ritmoPorFaixa"))
    if not ritmo:
        print(f"    {AMAR}sem ritmoPorFaixa em {medicao.name} — forma 3 nao pode "
              f"responder (isto NAO e 'nada a apontar'){FIM}")
        return []
    achados = []
    for chave in ("gols", "chutes", "passes"):
        # POR TEMPO DE FAIXA, nunca o total. A faixa 46-60 recebe mais simulacao
        # que as outras (a partida reinicia no intervalo) e a 76+ e aberta —
        # comparar totais mede o tamanho da faixa, nao o ritmo do jogo. Foi
        # exatamente esse erro que fez esta forma responder "nada" na primeira
        # versao, com o D19 na frente dela. E a armadilha B3.
        serie = []
        for f in ritmo:
            if not isinstance(f, dict) or f.get(chave) is None:
                continue
            seg = f.get("segundosPorPartida") or 0
            if seg <= 0:
                continue
            serie.append(round(f[chave] / seg * 60, 3))   # por minuto simulado
        if len(serie) < 5:
            continue
        descidas = sum(1 for a, b in zip(serie, serie[1:]) if b < a)
        subidas = sum(1 for a, b in zip(serie, serie[1:]) if b > a)
        n = len(serie) - 1
        if descidas >= n - 1 or subidas >= n - 1:
            direcao = "CAI" if descidas > subidas else "SOBE"
            achados.append(
                f"{chave} {VERM}{direcao} em {max(descidas, subidas)} das {n} "
                f"transicoes de faixa{FIM}: {' -> '.join(f'{v:g}' for v in serie)}\n"
                f"      {CINZA}deriva monotona ao longo da partida — nenhum agregado "
                f"por partida denuncia isso (e a forma do D19){FIM}")
    return achados


# ── forma 4 · numero magico sem procedencia ──────────────────────────────────
def forma4() -> list[str]:
    """Constante em camada, longe de comentario, e ausente da calibracao.

    Deliberadamente conservador: so numeros com casa decimal e fora de faixas
    obviamente geometricas, senao vira ruido e ninguem le a saida.
    """
    texto_cal = " ".join(p.read_text(encoding="utf8")
                         for p in (RAIZ / "calibration").glob("*.json"))
    achados = []
    for c in CAMADAS:
        bruto = c.read_text(encoding="utf8")
        linhas_com_comentario = {i for i, ln in enumerate(bruto.splitlines())
                                 if "//" in ln or "/*" in ln or "*" == ln.strip()[:1]}
        t = bruto.splitlines()
        magicos = set()
        for i, ln in enumerate(t):
            if i in linhas_com_comentario:
                continue
            # so linhas de calibracao aparente: atribuicao a const/let com numero
            for m in re.finditer(r"\b(\d+\.\d{2,})\b", ln):
                v = m.group(1)
                if v in texto_cal:
                    continue
                if float(v) in (0.5, 1.0):
                    continue
                magicos.add(v)
        if len(magicos) >= 12:
            achados.append(
                f"{c.name}: {AMAR}{len(magicos)} constantes decimais{FIM} sem "
                f"comentario na linha e ausentes de calibration/\n"
                f"      {CINZA}exemplos: {', '.join(sorted(magicos)[:8])}{FIM}")
    return sorted(achados, reverse=True)[:8]


TITULOS = {
    1: "constante sombreada — a camada repete a do core e so ela roda",
    2: "calibracao desligada — a chave nao existe e o `||` engole",
    3: "deriva monotona por faixa — a partida muda de ritmo sozinha",
    4: "numero magico sem procedencia — parametro virando folclore",
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--forma", type=int, choices=[1, 2, 3, 4])
    ap.add_argument("--medicao", type=Path,
                    default=RAIZ / "reports" / "REFERENCIA.json")
    a = ap.parse_args()

    resultados = {1: forma1(), 2: forma2(), 3: forma3(a.medicao), 4: forma4()}
    formas = [a.forma] if a.forma else [1, 2, 3, 4]

    total = 0
    print("\nAUDITOR — as formas de defeito que este projeto ja pagou para aprender\n")
    for f in formas:
        itens = resultados[f]
        print(f"  \033[1m{f} · {TITULOS[f]}\033[0m")
        if not itens:
            print(f"    {VERD}nada{FIM}\n")
            continue
        for it in itens:
            print(f"    - {it}")
        print()
        total += len(itens)

    if total:
        print(f"{AMAR}{total} coisa(s) para olhar.{FIM} O auditor nao diz o que "
              f"consertar — diz onde olhar e por que.\n")
    else:
        print(f"{VERD}nada a apontar nas formas verificadas.{FIM}\n")
    # nunca reprova build: e um detector, e detector que reprova vira ignorado
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
