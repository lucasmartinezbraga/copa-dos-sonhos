#!/usr/bin/env python3
"""PAINEL.html — o monitoramento visual: cada métrica, sua trajetória e a faixa.

Chamado por `python3 tools/monitorar.py --html`.

Uma sparkline por métrica, com a faixa-alvo desenhada como banda e o veredito
ao lado. O ponto é responder de relance: **isto está dando resultado?**
"""
from __future__ import annotations

import html
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DEST = RAIZ / "reports" / "pdf"

COR = {"DENTRO": "#0E8A5F", "ENTROU": "#0E8A5F", "CONVERGINDO": "#2D6E9E",
       "QUASE PARADA": "#B8860B", "PARADA": "#B8860B", "AFASTANDO": "#B03A2E",
       "SAIU": "#B03A2E"}
ROTULO = {"DENTRO": "dentro da faixa", "ENTROU": "entrou na faixa",
          "CONVERGINDO": "convergindo", "QUASE PARADA": "quase parada",
          "PARADA": "parada", "AFASTANDO": "afastando", "SAIU": "saiu da faixa"}

CSS = """
:root{--tinta:#1c2321;--tinta2:#39423f;--mudo:#77817d;--linha:#dfe4e1;--fundo:#fcfcfb;
 --faixa:#f2f5f3;--codigo:#f6f8f7}
@media (prefers-color-scheme:dark){:root{--tinta:#e8ece9;--tinta2:#b8c2be;--mudo:#8b9490;
 --linha:#2b3330;--fundo:#121614;--faixa:#1a201d;--codigo:#171d1a}}
*{box-sizing:border-box}
body{font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;
 background:var(--fundo);color:var(--tinta);margin:0;line-height:1.55}
.wrap{max-width:1000px;margin:0 auto;padding:44px 22px 90px}
.eyebrow{font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.16em;
 text-transform:uppercase;color:#0E8A5F;margin-bottom:10px}
h1{font-size:34px;line-height:1.1;margin:0 0 8px;letter-spacing:-.02em}
.sub{font-size:17px;color:var(--tinta2);max-width:64ch;margin:0 0 30px}
h2{font-size:20px;margin:44px 0 12px;padding-bottom:7px;border-bottom:1px solid var(--linha)}
.cartoes{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:22px 0 34px}
.cartao{border:1px solid var(--linha);border-radius:6px;padding:14px 16px;background:var(--faixa)}
.cartao .n{font-family:ui-monospace,monospace;font-size:27px;font-weight:600;line-height:1.1}
.cartao .r{font-size:12.5px;color:var(--mudo);margin-top:3px}
.linha{display:grid;grid-template-columns:150px 1fr 132px;gap:16px;align-items:center;
 padding:13px 0;border-bottom:1px solid var(--linha)}
.nome{font-family:ui-monospace,monospace;font-size:13.5px}
.nome small{display:block;color:var(--mudo);font-family:inherit;font-size:11.5px;margin-top:2px}
.valor{text-align:right;font-family:ui-monospace,monospace;font-size:13px}
.valor .v{font-size:16px;font-weight:600}
.tag{display:inline-block;font-size:10.5px;font-family:ui-monospace,monospace;padding:2px 7px;
 border-radius:9px;color:#fff;margin-top:4px;white-space:nowrap}
.expl{grid-column:1/-1;font-size:12.5px;color:var(--mudo);margin:-4px 0 4px}
.aviso{background:var(--faixa);border-left:3px solid #B8860B;border-radius:4px;
 padding:14px 18px;margin:20px 0}
.aviso p{margin:0 0 8px}.aviso p:last-child{margin:0}
code{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;background:var(--codigo);
 padding:1px 5px;border-radius:3px}
footer{margin-top:52px;padding-top:18px;border-top:1px solid var(--linha);font-size:12.5px;color:var(--mudo)}
"""


def spark(serie: list[float], lo: float, hi: float, cor: str, w: int = 400, h: int = 54) -> str:
    """Sparkline com a faixa-alvo desenhada como banda."""
    todos = serie + [lo, hi]
    vmin, vmax = min(todos), max(todos)
    span = max(vmax - vmin, 1e-9)
    pad = span * 0.12
    vmin -= pad; vmax += pad; span = vmax - vmin
    x = lambda i: 2 + (w - 4) * i / max(len(serie) - 1, 1)
    y = lambda v: h - 3 - (h - 6) * (v - vmin) / span
    banda = f'<rect x="0" y="{y(hi):.1f}" width="{w}" height="{max(1, y(lo) - y(hi)):.1f}" fill="#0E8A5F" opacity="0.11"/>'
    d = " ".join(("M" if i == 0 else "L") + f"{x(i):.1f},{y(v):.1f}" for i, v in enumerate(serie))
    pts = "".join(f'<circle cx="{x(i):.1f}" cy="{y(v):.1f}" r="{3.4 if i == len(serie)-1 else 2.2}" '
                  f'fill="{cor}"/>' for i, v in enumerate(serie))
    return (f'<svg viewBox="0 0 {w} {h}" width="100%" height="{h}" role="img" '
            f'aria-label="trajetoria">{banda}'
            f'<path d="{d}" fill="none" stroke="{cor}" stroke-width="2" '
            f'stroke-linejoin="round" stroke-linecap="round"/>{pts}</svg>')


def gerar(painel: dict, pontos: list[dict]) -> None:
    ms = painel["metricas"]
    cont: dict[str, int] = {}
    for v in ms.values():
        cont[v["veredito"]] = cont.get(v["veredito"], 0) + 1
    ordem = {"AFASTANDO": 0, "SAIU": 1, "PARADA": 2, "QUASE PARADA": 3, "CONVERGINDO": 4,
             "ENTROU": 5, "DENTRO": 6}

    o = ['<div class="wrap">']
    o.append('<div class="eyebrow">Copa dos Sonhos · monitoramento</div>')
    o.append("<h1>Está dando resultado?</h1>")
    o.append(f'<p class="sub">{len(pontos)} medições de 300 partidas, de '
             f'{html.escape(pontos[0]["release"])} a {html.escape(pontos[-1]["release"])}. '
             "Cada linha mostra a trajetória da métrica contra a faixa-alvo (a banda verde). "
             "O ponto não é o número: é saber se o trabalho move a agulha.</p>")

    o.append('<div class="cartoes">')
    for cod in ["DENTRO", "CONVERGINDO", "QUASE PARADA", "PARADA", "SAIU", "AFASTANDO"]:
        if cont.get(cod):
            o.append(f'<div class="cartao"><div class="n" style="color:{COR[cod]}">{cont[cod]}</div>'
                     f'<div class="r">{ROTULO[cod]}</div></div>')
    o.append("</div>")

    acao = cont.get("AFASTANDO", 0) + cont.get("SAIU", 0)
    parada = cont.get("PARADA", 0)
    if acao or parada:
        o.append('<div class="aviso">')
        if acao:
            o.append(f"<p><strong>{acao} métrica piorando</strong> — é onde olhar primeiro.</p>")
        if parada:
            o.append(f"<p><strong>{parada} métrica parada</strong> há várias medições. Mais uma "
                     "tentativa do mesmo tipo não vai mover: essa precisa de outro diagnóstico, "
                     "não de outra tentativa.</p>")
        o.append("</div>")

    o.append("<h2>Métrica por métrica</h2>")
    for m, v in sorted(ms.items(), key=lambda kv: (ordem.get(kv[1]["veredito"], 9), kv[0])):
        cor = COR[v["veredito"]]
        lo, hi = v["faixa"]
        o.append('<div class="linha">')
        o.append(f'<div class="nome">{html.escape(m)}<small>{html.escape(v["rotulo"])}</small></div>')
        o.append(f'<div>{spark(v["serie"], lo, hi, cor)}</div>')
        o.append(f'<div class="valor"><span class="v">{v["atual"]:g}</span><br>'
                 f'<span style="color:var(--mudo)">faixa {lo:g}–{hi:g}</span>'
                 f'<br><span class="tag" style="background:{cor}">{ROTULO[v["veredito"]]}</span></div>')
        if v["veredito"] in ("AFASTANDO", "SAIU", "PARADA", "QUASE PARADA"):
            o.append(f'<div class="expl">{html.escape(v["explicacao"])}</div>')
        o.append("</div>")

    o.append("<h2>O que cada release fez</h2>")
    o.append('<div class="rolar"><table style="border-collapse:collapse;width:100%;font-size:13.5px">')
    o.append('<thead><tr><th style="text-align:left;padding:7px 9px;border-bottom:2px solid var(--tinta2)">release</th>'
             '<th style="text-align:left;padding:7px 9px;border-bottom:2px solid var(--tinta2)">o que mudou</th>'
             '<th style="text-align:right;padding:7px 9px;border-bottom:2px solid var(--tinta2)">partidas</th></tr></thead><tbody>')
    for p in pontos:
        o.append(f'<tr><td style="padding:6px 9px;border-bottom:1px solid var(--linha)"><strong>{html.escape(p["release"])}</strong></td>'
                 f'<td style="padding:6px 9px;border-bottom:1px solid var(--linha)">{html.escape(p["nota"])}</td>'
                 f'<td style="padding:6px 9px;border-bottom:1px solid var(--linha);text-align:right;font-variant-numeric:tabular-nums">{p["n"]}</td></tr>')
    o.append("</tbody></table></div>")

    o.append("<h2>Como ler isto</h2>")
    o.append("<p><strong>DENTRO</strong> — na faixa e estável. Serve de guarda-corpo: "
             "qualquer mudança futura precisa mantê-la aí.</p>")
    o.append("<p><strong>CONVERGINDO</strong> — fora, mas se aproximando. O trabalho está "
             "produzindo efeito; continuar.</p>")
    o.append("<p><strong>QUASE PARADA</strong> — anda, mas tão devagar que no ritmo "
             "atual precisaria de mais de oito medições para entrar na faixa. O painel diz "
             "quantas. Na prática, é parada com outro nome.</p>")
    o.append("<p><strong>PARADA</strong> — fora e sem movimento há várias medições. "
             "<em>É o sinal mais valioso do painel.</em> Significa que o diagnóstico está "
             "errado, não que faltou esforço.</p>")
    o.append("<p><strong>SAIU / AFASTANDO</strong> — regressão. Olhar primeiro.</p>")
    o.append('<div class="aviso"><p>As faixas vêm de <code>calibration/targets.json</code>, '
             "exceto laterais, impedimentos e desarmes, que vêm do placar de futebol real. "
             "A de desarmes está marcada como <strong>ESTIMADA</strong> — eu a derivei, não é "
             "publicada pelo projeto, e não deve virar alvo com aparência de medição.</p></div>")

    o.append('<footer>Gerado por <code>python3 tools/monitorar.py --html</code> a partir de '
             '<code>reports/painel.json</code>. Para atualizar depois de uma mudança aceita: '
             '<code>bash tools/aceitar.sh --fixar</code> e rode o painel de novo.</footer></div>')

    doc = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width,initial-scale=1">'
           "<title>Copa dos Sonhos — está dando resultado?</title>"
           f"<style>{CSS}</style></head><body>" + "".join(o) + "</body></html>")
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / "PAINEL.html").write_text(doc, encoding="utf8")
    print(f"  painel: {DEST / 'PAINEL.html'}")
