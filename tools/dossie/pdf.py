#!/usr/bin/env python3
"""Monta o PDF do dossie: Markdown -> HTML com CSS de impressao -> Chromium.

Nao ha pandoc nem weasyprint neste ambiente, e nao precisa: o Chromium ja esta
instalado para as sondas de tela, e imprimir por ele da controle total de
tipografia, quebra de pagina e numeracao.

O conversor de Markdown aqui e proposital e deliberadamente pequeno: ele cobre
exatamente o que o documento usa (titulos, tabelas, cercas de codigo, citacoes,
listas, regua, negrito/italico/codigo/link) e nada mais.

Uso:
  python3 tools/dossie/pdf.py                      # gera reports/pdf/*.html
  node tools/dossie/imprimir.js                    # e depois o PDF
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DEST = RAIZ / "reports" / "pdf"
GRAF = RAIZ / "reports" / "graficos"

# Onde cada figura entra. A chave e um trecho do titulo da secao; a figura e
# inserida logo DEPOIS do paragrafo que abre a secao.
FIGURAS = {
    "4.1 Distribuição dos gols": ("G1-gols-por-faixa.svg",
        "Figura 1 — A distribuição é monotonicamente decrescente; no futebol de elite é crescente."),
    "4.2 Para onde a bola é mandada": ("G2-direcao-do-desvio.svg",
        "Figura 2 — O portão da camada 45 exige alvo a menos de 1,15 m da linha. Só 0,2% chegam lá."),
    "4.3 Reinícios por partida": ("G3-reinicios.svg",
        "Figura 3 — Escanteios e tiros de meta estão na faixa. O buraco é inteiro dos laterais."),
    "4.4 Forma de equipe": ("G4-forma-do-bloco.svg",
        "Figura 4 — Com a bola a forma está correta. O time simplesmente não muda de forma ao perdê-la."),
    "4.5 Distribuição de placares": ("G8-placares.svg",
        "Figura 5 — Serve de guarda-corpo: qualquer mudança em D19 ou D20 precisa preservar esta curva."),
    "4.6 O funil da finalização": ("G5-funil-da-finalizacao.svg",
        "Figura 6 — As três taxas derivadas estão dentro da faixa real; um terço dos chutes no alvo "
        "continua fora do alcance do goleiro."),
    "4.10 O caminho do placar": ("G6-evolucao-do-placar.svg",
        "Figura 7 — Dois de quatro consertos foram revertidos. Taxa de acerto 50% — normal quando se mede."),
    "VOLUME III — CATÁLOGO DE DEFEITOS": ("G7-defeitos-por-fase.svg",
        "Figura 8 — Os 34 defeitos por fase e severidade. Cada quadrado é um defeito. "
        "As cores da figura vêm da paleta validada para daltonismo (violeta/verde/azul/ouro) "
        "e não dos emoji da legenda ao lado — vermelho, laranja e amarelo juntos não passam "
        "na separação CVD."),
}

CSS = """
@page { size: A4; margin: 20mm 17mm 20mm 17mm; }
:root{
  --tinta:#1c2321; --tinta2:#39423f; --mudo:#77817d; --linha:#dfe4e1;
  --fundo:#ffffff; --faixa:#f2f5f3; --verde:#0E8A5F; --violeta:#6A4C93;
  --ouro:#B8860B; --azul:#2D6E9E; --codigo:#f6f8f7;
}
*{box-sizing:border-box}
body{
  font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;
  font-size:9.6pt; line-height:1.52; color:var(--tinta); background:var(--fundo);
  margin:0; -webkit-font-smoothing:antialiased;
}
h1,h2,h3,h4{ line-height:1.22; text-wrap:balance; margin:0 0 .5em; font-weight:600; }
h1{ font-size:19pt; margin-top:0; page-break-before:always; padding-top:2mm;
    border-top:2.5pt solid var(--tinta); padding-top:4mm; letter-spacing:-.01em; }
h1:first-of-type{ page-break-before:avoid; }
h2{ font-size:13pt; margin-top:1.5em; padding-bottom:1.5mm;
    border-bottom:.5pt solid var(--linha); page-break-after:avoid; }
h3{ font-size:11pt; margin-top:1.3em; color:var(--tinta2); page-break-after:avoid; }
h4{ font-size:9.8pt; margin-top:1.1em; color:var(--tinta2); page-break-after:avoid; }
p{ margin:0 0 .62em; orphans:3; widows:3; }
strong{ font-weight:600; }
em{ font-style:italic; }
a{ color:var(--azul); text-decoration:none; }
hr{ border:0; border-top:.5pt solid var(--linha); margin:1.4em 0; }

code{ font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace; font-size:8.4pt;
      background:var(--codigo); padding:.5pt 2pt; border-radius:2pt; }
pre{ font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace; font-size:7.5pt;
     line-height:1.4; background:var(--codigo); border:.5pt solid var(--linha);
     border-left:2pt solid var(--verde); border-radius:2pt; padding:3mm 3.5mm;
     margin:.7em 0; overflow-x:auto; white-space:pre; page-break-inside:avoid; }
pre code{ background:none; padding:0; font-size:inherit; }
pre.longo{ page-break-inside:auto; }

blockquote{ margin:.8em 0; padding:2.5mm 4mm; background:var(--faixa);
            border-left:2pt solid var(--violeta); border-radius:2pt;
            page-break-inside:avoid; }
blockquote p:last-child{ margin-bottom:0; }

table{ border-collapse:collapse; width:100%; margin:.8em 0; font-size:8.4pt;
       page-break-inside:avoid; }
th{ text-align:left; font-weight:600; border-bottom:1pt solid var(--tinta2);
    padding:1.6mm 2mm; background:var(--faixa); }
td{ border-bottom:.5pt solid var(--linha); padding:1.4mm 2mm; vertical-align:top; }
td:nth-child(n+2), th:nth-child(n+2){ font-variant-numeric:tabular-nums; }
tr:nth-child(even) td{ background:#fafcfb; }

ul,ol{ margin:.5em 0 .7em; padding-left:5.5mm; }
li{ margin:.22em 0; }

figure{ margin:1.1em 0; page-break-inside:avoid; text-align:center; }
figure img, figure svg{ max-width:100%; height:auto; }
figcaption{ font-size:8pt; color:var(--mudo); margin-top:2mm; text-align:left;
            border-top:.5pt solid var(--linha); padding-top:1.5mm; }

.capa{ page-break-after:always; padding-top:38mm; text-align:left; }
.capa .eyebrow{ font-family:ui-monospace,monospace; font-size:9pt; letter-spacing:.14em;
   text-transform:uppercase; color:var(--verde); margin-bottom:6mm; }
.capa h1{ font-size:31pt; border:0; padding:0; margin:0 0 4mm; page-break-before:avoid; }
.capa .sub{ font-size:13pt; color:var(--tinta2); margin-bottom:14mm; max-width:120mm; }
.capa table{ width:auto; font-size:9pt; }
.capa td{ border:0; padding:1mm 8mm 1mm 0; }
.capa td:first-child{ color:var(--mudo); }
.capa .rodape{ margin-top:26mm; font-size:8.5pt; color:var(--mudo);
   border-top:.5pt solid var(--linha); padding-top:3mm; }

.sumario{ page-break-after:always; }
.sumario ol{ list-style:none; padding:0; columns:2; column-gap:12mm; }
.sumario li{ margin:.3em 0; font-size:9pt; break-inside:avoid; }
.sumario .vol{ font-weight:600; margin-top:.8em; color:var(--tinta); }

.destaque{ background:var(--faixa); border:.5pt solid var(--linha); border-radius:3pt;
  padding:3mm 4mm; margin:1em 0; page-break-inside:avoid; }
"""


# ── conversor ────────────────────────────────────────────────────────────────
def inline(t: str) -> str:
    t = html.escape(t, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', t)
    return t


def tabela(linhas: list[str]) -> str:
    def celulas(l: str) -> list[str]:
        return [c.strip() for c in l.strip().strip("|").split("|")]
    cab = celulas(linhas[0])
    corpo = [celulas(l) for l in linhas[2:]]
    out = ["<table><thead><tr>"]
    out += [f"<th>{inline(c)}</th>" for c in cab]
    out.append("</tr></thead><tbody>")
    for linha in corpo:
        out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in linha) + "</tr>")
    out.append("</tbody></table>")
    return "".join(out)


def converter(md: str) -> str:
    linhas = md.split("\n")
    out: list[str] = []
    i = 0
    lista: str | None = None

    def fechar_lista() -> None:
        nonlocal lista
        if lista:
            out.append(f"</{lista}>")
            lista = None

    while i < len(linhas):
        l = linhas[i]

        # cerca de codigo
        if l.startswith("```"):
            fechar_lista()
            lang = l[3:].strip()
            i += 1
            buf: list[str] = []
            while i < len(linhas) and not linhas[i].startswith("```"):
                buf.append(linhas[i]); i += 1
            i += 1
            corpo = html.escape("\n".join(buf), quote=False)
            cls = ' class="longo"' if len(buf) > 42 else ""
            if lang == "mermaid":
                out.append('<div class="destaque"><p><strong>Diagrama</strong> '
                           '<span style="color:var(--mudo)">— fonte Mermaid; '
                           'renderiza na versão HTML do documento</span></p>'
                           f'<pre{cls}><code>{corpo}</code></pre></div>')
            else:
                out.append(f"<pre{cls}><code>{corpo}</code></pre>")
            continue

        # tabela
        if l.startswith("|") and i + 1 < len(linhas) and re.match(r"^\|[\s:|-]+\|$", linhas[i + 1]):
            fechar_lista()
            bloco = [l]
            i += 1
            while i < len(linhas) and linhas[i].startswith("|"):
                bloco.append(linhas[i]); i += 1
            out.append(tabela(bloco))
            continue

        # citacao
        if l.startswith(">"):
            fechar_lista()
            buf = []
            while i < len(linhas) and linhas[i].startswith(">"):
                buf.append(linhas[i].lstrip(">").strip()); i += 1
            texto = " ".join(buf).replace("  ", " ")
            partes = [p for p in texto.split("\n") if p]
            out.append("<blockquote><p>" + inline(" ".join(partes)) + "</p></blockquote>")
            continue

        # titulos
        m = re.match(r"^(#{1,4})\s+(.*)$", l)
        if m:
            fechar_lista()
            n = len(m.group(1))
            txt = m.group(2).strip()
            ident = re.sub(r"[^\w]+", "-", txt.lower())[:60]
            out.append(f'<h{n} id="{ident}">{inline(txt)}</h{n}>')
            i += 1
            continue

        # regua
        if re.match(r"^-{3,}$", l.strip()):
            fechar_lista(); out.append("<hr>"); i += 1; continue

        # listas
        m = re.match(r"^\s*([-*])\s+(.*)$", l)
        if m:
            if lista != "ul":
                fechar_lista(); out.append("<ul>"); lista = "ul"
            out.append(f"<li>{inline(m.group(2))}</li>"); i += 1; continue
        m = re.match(r"^\s*(\d+)\.\s+(.*)$", l)
        if m:
            if lista != "ol":
                fechar_lista(); out.append("<ol>"); lista = "ol"
            out.append(f"<li>{inline(m.group(2))}</li>"); i += 1; continue

        if not l.strip():
            fechar_lista(); i += 1; continue

        # paragrafo
        fechar_lista()
        buf = [l]
        i += 1
        while i < len(linhas) and linhas[i].strip() and not re.match(
                r"^(#{1,4}\s|```|\||>|-{3,}$|\s*[-*]\s|\s*\d+\.\s)", linhas[i]):
            buf.append(linhas[i]); i += 1
        out.append("<p>" + inline(" ".join(x.strip() for x in buf)) + "</p>")

    fechar_lista()
    return "\n".join(out)


def inserir_figuras(corpo: str) -> str:
    for chave, (arq, legenda) in FIGURAS.items():
        svg_path = GRAF / arq
        if not svg_path.exists():
            print(f"  aviso: {arq} nao existe", file=sys.stderr)
            continue
        svg = svg_path.read_text(encoding="utf8")
        svg = re.sub(r'\swidth="\d+"\s+height="\d+"', ' width="100%"', svg, count=1)
        fig = f'<figure>{svg}<figcaption>{html.escape(legenda)}</figcaption></figure>'
        # insere depois do cabecalho que contem a chave
        alvo = re.search(r"(<h[1-4][^>]*>[^<]*" + re.escape(chave.split("—")[0].strip()[:34]) + r"[^<]*</h[1-4]>)", corpo)
        if alvo:
            corpo = corpo[:alvo.end()] + fig + corpo[alvo.end():]
        else:
            print(f"  aviso: ancora nao encontrada para {arq} ({chave[:40]})", file=sys.stderr)
    return corpo


def capa_e_sumario(md: str) -> str:
    d = json.loads((RAIZ / "reports/defeitos.json").read_text(encoding="utf8"))
    n_ab = sum(1 for x in d["defeitos"] if x["estado"] == "aberto")
    capa = f"""
<div class="capa">
  <div class="eyebrow">Copa dos Sonhos · R19.09</div>
  <h1>Investigação completa dos defeitos do jogo</h1>
  <div class="sub">Onde mexer no código, por que mexer, e onde isso chega.
  Trinta e quatro defeitos com endereço, evidência medida e critério numérico de aceite.</div>
  <table>
    <tr><td>Data</td><td>11 de agosto de 2026</td></tr>
    <tr><td>Build analisado</td><td><code>ff808761f579765613f0a13fdab1112a9ab335837300fbd61e2f92e6c8c95e7e</code></td></tr>
    <tr><td>Placar de design</td><td><strong>12 / 13</strong></td></tr>
    <tr><td>Placar do futebol real</td><td><strong>15 / 21</strong></td></tr>
    <tr><td>Base estatística</td><td>300 partidas com semente pareada · 40 de sonda direcional · 6 sondas em Chromium</td></tr>
    <tr><td>Defeitos catalogados</td><td>34 &nbsp;({n_ab} abertos, 4 feitos, 4 verificados e descartados)</td></tr>
    <tr><td>Hipóteses declaradas</td><td>11 — marcadas como tais, não como fato</td></tr>
  </table>
  <div class="rodape">
    Toda afirmação deste documento vem marcada <strong>[LIDO]</strong> (li o código),
    <strong>[MEDIDO]</strong> (rodei e contei) ou <strong>[HIPÓTESE]</strong> (inferência, pode estar errada).
    Nenhuma recomendação aparece sem arquivo, linha e critério de aceite.
  </div>
</div>
"""
    # fora das cercas de codigo: os comentarios "# 1. quem e o dono?" dos blocos
    # bash estavam entrando no sumario como se fossem titulos.
    sem_codigo = re.sub(r"```.*?```", "", md, flags=re.S)
    vols = [v for v in re.findall(r"^#\s+(.+)$", sem_codigo, re.M)
            if re.match(r"(VOLUME|APÊNDICE|TABELA|COPA)", v)]
    itens = "".join(f'<li class="vol">{html.escape(v)}</li>' for v in vols)
    defs = re.findall(r"^##\s+(D\d\d.+)$", sem_codigo, re.M)
    itens_d = "".join(f"<li>{html.escape(x[:64])}</li>" for x in defs)
    sumario = (f'<div class="sumario"><h2 style="page-break-after:avoid">Sumário</h2>'
               f"<ol>{itens}</ol>"
               f'<h3 style="margin-top:8mm">Catálogo de defeitos</h3><ol>{itens_d}</ol></div>')
    return capa + sumario


def main() -> int:
    md_path = RAIZ / "reports" / "INVESTIGACAO-COMPLETA-2026-08.md"
    md = md_path.read_text(encoding="utf8")
    corpo = converter(md)
    corpo = inserir_figuras(corpo)
    doc = (f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
           f"<title>Copa dos Sonhos — Investigação completa dos defeitos</title>"
           f"<style>{CSS}</style></head><body>"
           + capa_e_sumario(md) + corpo + "</body></html>")
    DEST.mkdir(parents=True, exist_ok=True)
    saida = DEST / "investigacao.html"
    saida.write_text(doc, encoding="utf8")
    print(f"html: {saida}  ({len(doc) // 1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
