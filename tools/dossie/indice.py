#!/usr/bin/env python3
"""Gera o INDICE.html do dossie — a porta de entrada navegavel, offline.

Um zip com 90 arquivos e um labirinto. Esta pagina abre no navegador sem
servidor, mostra os 8 graficos embutidos, lista os 34 defeitos com o endereco
de cada um e linka todo o resto.

Uso:  python3 tools/dossie/indice.py <pasta-do-pacote>
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DEST = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "reports" / "pdf"

CSS = """
:root{--tinta:#1c2321;--tinta2:#39423f;--mudo:#77817d;--linha:#dfe4e1;--fundo:#fcfcfb;
 --faixa:#f2f5f3;--verde:#0E8A5F;--violeta:#6A4C93;--ouro:#B8860B;--azul:#2D6E9E;--codigo:#f6f8f7}
@media (prefers-color-scheme:dark){:root{--tinta:#e8ece9;--tinta2:#b8c2be;--mudo:#8b9490;
 --linha:#2b3330;--fundo:#121614;--faixa:#1a201d;--codigo:#171d1a}}
*{box-sizing:border-box}
body{font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;
 background:var(--fundo);color:var(--tinta);margin:0;line-height:1.55;font-size:16px}
.wrap{max-width:1080px;margin:0 auto;padding:48px 24px 96px}
header{border-bottom:2px solid var(--tinta);padding-bottom:22px;margin-bottom:34px}
.eyebrow{font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.16em;
 text-transform:uppercase;color:var(--verde);margin-bottom:12px}
h1{font-size:38px;line-height:1.1;margin:0 0 10px;letter-spacing:-.02em;text-wrap:balance}
.sub{font-size:18px;color:var(--tinta2);max-width:62ch;margin:0}
h2{font-size:23px;margin:52px 0 14px;padding-bottom:8px;border-bottom:1px solid var(--linha);
 text-wrap:balance}
h3{font-size:17px;margin:30px 0 10px;color:var(--tinta2)}
p{margin:0 0 12px;max-width:74ch}
a{color:var(--azul);text-decoration:none;border-bottom:1px solid transparent}
a:hover{border-bottom-color:var(--azul)}
a:focus-visible{outline:2px solid var(--azul);outline-offset:2px;border-radius:2px}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;background:var(--codigo);
 padding:1px 5px;border-radius:3px}
pre{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;background:var(--codigo);
 border:1px solid var(--linha);border-left:3px solid var(--verde);border-radius:4px;
 padding:14px 16px;overflow-x:auto;margin:14px 0}
table{border-collapse:collapse;width:100%;margin:16px 0;font-size:14px}
th{text-align:left;font-weight:600;border-bottom:2px solid var(--tinta2);padding:8px 10px;
 background:var(--faixa)}
td{border-bottom:1px solid var(--linha);padding:7px 10px;vertical-align:top}
td:nth-child(n+2),th:nth-child(n+2){font-variant-numeric:tabular-nums}
.rolar{overflow-x:auto;-webkit-overflow-scrolling:touch}
.cartoes{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:14px;margin:20px 0}
.cartao{border:1px solid var(--linha);border-radius:6px;padding:16px 18px;background:var(--faixa)}
.cartao .n{font-family:ui-monospace,monospace;font-size:29px;font-weight:600;line-height:1.1}
.cartao .r{font-size:13px;color:var(--mudo);margin-top:4px}
.pill{display:inline-block;font-size:11px;font-family:ui-monospace,monospace;padding:2px 7px;
 border-radius:9px;border:1px solid var(--linha);color:var(--tinta2);white-space:nowrap}
.est{border-color:var(--violeta);color:var(--violeta)}
.fut{border-color:var(--verde);color:var(--verde)}
.hig{border-color:var(--azul);color:var(--azul)}
.tel{border-color:var(--ouro);color:var(--ouro)}
figure{margin:26px 0}
figure svg{max-width:100%;height:auto;display:block;border:1px solid var(--linha);border-radius:5px}
figcaption{font-size:13px;color:var(--mudo);margin-top:8px;border-top:1px solid var(--linha);
 padding-top:7px}
.aviso{background:var(--faixa);border-left:3px solid var(--violeta);border-radius:4px;
 padding:14px 18px;margin:18px 0}
.aviso p:last-child{margin-bottom:0}
.arq{font-family:ui-monospace,monospace;font-size:13px}
footer{margin-top:64px;padding-top:20px;border-top:1px solid var(--linha);font-size:13px;color:var(--mudo)}
"""


def esc(t) -> str:
    return html.escape(str(t), quote=False)


def main() -> int:
    d = json.loads((RAIZ / "reports/defeitos.json").read_text(encoding="utf8"))
    ref = json.loads((RAIZ / "reports/REFERENCIA.json").read_text(encoding="utf8"))["agregado"]
    defs = d["defeitos"]
    est = {}
    for x in defs:
        est[x["estado"]] = est.get(x["estado"], 0) + 1

    o: list[str] = []
    A = o.append
    A('<div class="wrap"><header>')
    A('<div class="eyebrow">Copa dos Sonhos · R19.09 · 11 de agosto de 2026</div>')
    A("<h1>Investigação completa dos defeitos do jogo</h1>")
    A('<p class="sub">Trinta e quatro defeitos com endereço de código, evidência '
      "medida e critério numérico de aceite. Esta página é o índice do dossiê — "
      "tudo o que ela cita está neste zip.</p></header>")

    A('<div class="cartoes">')
    for n, r in [("12/13", "placar de design"), ("15/21", "placar do futebol real"),
                 (str(len(defs)), "defeitos catalogados"), (str(est.get("feito", 0)), "já feitos"),
                 ("5.086", "linhas do motor"), ("11", "hipóteses declaradas")]:
        A(f'<div class="cartao"><div class="n">{n}</div><div class="r">{r}</div></div>')
    A("</div>")

    A('<div class="aviso"><p><strong>Se você é uma IA:</strong> não leia o relatório '
      "inteiro (4.900 linhas). Abra <code>01-comece-aqui/COLE-ISTO.txt</code>, e no "
      "repositório use <code>python3 tools/defeito.py &lt;ID&gt;</code> — ele devolve a "
      "ficha, o código como está agora e só a seção relevante.</p></div>")

    A("<h2>Por onde começar</h2><div class='rolar'><table><thead><tr>"
      "<th>quero…</th><th>abra</th></tr></thead><tbody>")
    for a, b in [("entregar para uma IA", "<code>01-comece-aqui/COLE-ISTO.txt</code> + este zip"),
                 ("ler o relatório", '<a href="02-relatorio/COPA-DOS-SONHOS-investigacao.pdf">o PDF, ~110 páginas</a>'),
                 ("o mesmo com links", '<a href="02-relatorio/investigacao-navegavel.html">versão HTML</a>'),
                 ("saber o estado do projeto", '<a href="01-comece-aqui/ESTADO.md">ESTADO.md</a>'),
                 ("o índice de tudo", '<a href="MAPA-DO-DOSSIE.md">MAPA-DO-DOSSIE.md</a>'),
                 ("jogar", '<a href="07-jogo/COPA DOS SONHOS - R19.09.html">o jogo, abre no navegador</a>'),
                 ("o código-fonte", "<code>08-codigo-fonte/copa-dos-sonhos-fonte.zip</code>")]:
        A(f"<tr><td>{a}</td><td>{b}</td></tr>")
    A("</tbody></table></div>")

    A("<h2>O que foi medido</h2>")
    A("<p>Nenhum gráfico aqui é ilustrativo. Cada um lê um arquivo de "
      "<code>04-dados/</code> e a fonte está impressa no rodapé da própria figura.</p>")
    figs = [("G1-gols-por-faixa.svg", "A distribuição dos gols é decrescente; no futebol de elite é crescente. → D19"),
            ("G2-direcao-do-desvio.svg", "85,8% dos alvos de desvio ficam a mais de 8 m da linha lateral. → D08"),
            ("G3-reinicios.svg", "Escanteios e tiros de meta estão na faixa. O buraco é inteiro dos laterais. → D08"),
            ("G4-forma-do-bloco.svg", "Com a bola a forma está certa. O time não muda de forma ao perdê-la. → D20"),
            ("G5-funil-da-finalizacao.svg", "As três taxas derivadas estão dentro da faixa real."),
            ("G6-evolucao-do-placar.svg", "Os dois maiores saltos vieram de consertos de uma linha cada."),
            ("G7-defeitos-por-fase.svg", "Os 34 defeitos por fase e severidade."),
            ("G8-placares.svg", "Distribuição saudável — serve de guarda-corpo para D19 e D20. → D23")]
    for arq, leg in figs:
        p = RAIZ / "reports/graficos" / arq
        if not p.exists():
            continue
        svg = re.sub(r'\swidth="\d+"\s+height="\d+"', ' width="100%"', p.read_text(encoding="utf8"), count=1)
        A(f"<figure>{svg}<figcaption>{esc(leg)}</figcaption></figure>")

    A("<h2>Os 34 defeitos</h2>")
    A("<p>Ordenados por fase. O endereço abaixo é onde o defeito estava na análise; "
      "a <strong>âncora</strong> em <code>04-dados/defeitos.json</code> não envelhece — e "
      "<code>tools/defeitos.py</code> falha se ela deixar de apontar para o código certo.</p>")
    ordem = {"F0": 0, "F1": 1, "F2": 2, "F3": 3, "F4": 4, "F5": 5, "F6": 6, "—": 7, "pos-F5": 8}
    cls = {"estrutural": "est", "futebol": "fut", "higiene": "hig", "tela": "tel"}
    marca = {"feito": "✅", "aberto": "", "parcial": "◐", "guarda-corpo": "🛡",
             "decidir": "?", "adiado": "⏸"}
    A('<div class="rolar"><table><thead><tr><th>#</th><th>fase</th><th></th><th>tipo</th>'
      "<th>defeito</th><th>onde no código</th></tr></thead><tbody>")
    for x in sorted(defs, key=lambda y: (ordem.get(y["fase"], 9), y["id"])):
        onde = "<br>".join(
            f'<span class="arq">{esc(l["arquivo"].split("/")[-1])}:'
            f'{l.get("linha_atual") or l.get("linha") or "?"}</span>' for l in x["locais"][:2]
        ) or '<span class="arq" style="color:var(--mudo)">distribuído</span>'
        A(f'<tr><td><strong>{x["id"]}</strong></td><td>{esc(x["fase"])}</td>'
          f'<td>{marca.get(x["estado"],"")}</td>'
          f'<td><span class="pill {cls.get(x["sev"],"")}">{esc(x["sev"])}</span></td>'
          f'<td>{esc(x["titulo"])}</td><td>{onde}</td></tr>')
    A("</tbody></table></div>")

    A("<h2>A linha de base</h2>")
    A("<p>300 partidas com semente pareada, do estado commitado. É contra isto que "
      "<code>tools/aceitar.sh</code> compara toda mudança.</p>")
    A('<div class="rolar"><table><thead><tr><th>métrica</th><th>média</th><th>desvio</th>'
      "<th>2 SE</th></tr></thead><tbody>")
    for k in ["goals", "shots", "onTarget", "xg", "corners", "fouls", "yellow", "red",
              "passes", "passOk", "tackles", "offsides", "throwIns", "goalKicks"]:
        m = ref[k]
        se2 = 2 * m["desvio"] / (300 ** 0.5)
        A(f'<tr><td><code>{k}</code></td><td>{m["media"]:.3f}</td>'
          f'<td>{m["desvio"]:.3f}</td><td>{se2:.3f}</td></tr>')
    A("</tbody></table></div>")

    A("<h2>As duas regras que não se negociam</h2>")
    A("<h3>1. Descubra quem é o dono do método antes de editar</h3>")
    A("<pre>node tools/fisica/pilha.js dist/index.html 14</pre>")
    A("<p>São <strong>362 sobrescritas</strong> em 60 camadas empilhadas sobre "
      "<code>MatchSim.prototype</code>. Uma camada pode substituir um método e não chamar "
      "a de baixo. Editar o motor e nada acontecer já ocorreu <strong>seis vezes</strong>.</p>")
    A('<div class="aviso"><p><strong>E a ferramenta tem limite.</strong> Na sexta vez '
      "(D25) ela respondeu VIVA e estava <em>certa</em> — o método era alcançado, a linha "
      "editada não. <strong>VIVA é propriedade do método, não de cada linha dele.</strong> "
      "Quando o alvo é uma linha, instrumente aquela linha: "
      "<code>tools/fisica/ramo-d25.js</code> é o modelo — 40 linhas, resposta em 2 minutos.</p></div>")
    A("<h3>2. Nada entra sem medição</h3>")
    A("<pre>bash tools/aceitar.sh --antes\n"
      "# ... edite src/, nunca dist/ ...\n"
      "bash tools/aceitar.sh --depois              # criterio de 2 SE\n"
      "bash tools/aceitar.sh --depois --identico   # exige as 14 metricas iguais ao digito</pre>")
    A("<p>Uma métrica <strong>se moveu</strong> quando |Δ| ≥ 2 × SE. E a regra que já "
      "reprovou uma mudança: mover 2 SE para pior uma métrica que você não declarou que ia "
      "mexer <strong>reprova a mudança</strong>, mesmo que o alvo declarado tenha melhorado.</p>")

    A("<h2>Convenção de confiança</h2>")
    A("<p>Toda afirmação do relatório vem marcada <code>[LIDO]</code> (li o código), "
      "<code>[MEDIDO]</code> (rodei e contei) ou <code>[HIPÓTESE]</code> (inferência, pode "
      "estar errada).</p>")
    A('<div class="rolar"><table><thead><tr><th>número</th><th>o que é</th></tr></thead><tbody>'
      "<tr><td><strong>11</strong></td><td>hipóteses abertas, declaradas como tais (seção 8.5)</td></tr>"
      "<tr><td><strong>4</strong></td><td>suspeitas levantadas e <strong>derrubadas</strong> pela medição (seção 3.35)</td></tr>"
      "<tr><td><strong>2 de 4</strong></td><td>tentativas de conserto <strong>revertidas</strong> (Volume VII)</td></tr>"
      "<tr><td><strong>3</strong></td><td>erros meus corrigidos em público (seção 8.1)</td></tr>"
      "</tbody></table></div>")
    A("<p>Um terço das suspeitas iniciais não sobreviveu ao primeiro teste. Os laudos das "
      "duas tentativas revertidas estão em <code>05-laudos/</code> e não devem ser pulados: "
      "são eles que ensinam o padrão de aceitação.</p>")

    A("<footer>Build analisado <code>82b2148b6b97dd22</code> · "
      "repositório <code>lucasmartinezbraga/copa-dos-sonhos</code>, branch "
      "<code>claude/game-ball-physics-issues-50m9e6</code>. Índice gerado por "
      "<code>tools/dossie/indice.py</code> a partir de "
      "<code>reports/defeitos.json</code>.</footer></div>")

    doc = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width,initial-scale=1">'
           "<title>Copa dos Sonhos — dossiê da investigação</title>"
           f"<style>{CSS}</style></head><body>" + "".join(o) + "</body></html>")
    DEST.mkdir(parents=True, exist_ok=True)
    saida = DEST / "INDICE.html"
    saida.write_text(doc, encoding="utf8")
    print(f"indice: {saida}  ({len(doc)//1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
