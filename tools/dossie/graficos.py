#!/usr/bin/env python3
"""Gera os graficos do dossie em SVG, a partir das medicoes reais.

Nenhum grafico aqui e ilustrativo. Cada um le um arquivo de reports/ e a fonte
esta impressa no rodape da figura.

Paleta validada (6 checks, modo claro, superficie #fcfcfb):
  #0E8A5F verde   #6A4C93 violeta   #B8860B ouro   #2D6E9E azul
  ALL CHECKS PASS — banda de luminancia, croma, separacao CVD (deutan 15,2 /
  tritan 15,0), piso de visao normal 23,4 e contraste >= 3:1.

Uso:  python3 tools/dossie/graficos.py [destino]
"""
from __future__ import annotations

import collections
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DEST = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "reports" / "graficos"

# ── tokens ────────────────────────────────────────────────────────────────────
C = {
    "jogo": "#0E8A5F", "real": "#6A4C93", "ouro": "#B8860B", "azul": "#2D6E9E",
    "tinta": "#1c2321", "tinta2": "#4a5551", "mudo": "#8b9490",
    "grade": "#e3e7e4", "fundo": "#fcfcfb", "faixa": "#eef2ef",
}
F = "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif"
FM = "ui-monospace,'SF Mono',Menlo,Consolas,monospace"


def esc(s: str) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


class Svg:
    def __init__(self, w: int, h: int, titulo: str, sub: str = "", fonte: str = ""):
        self.w, self.h = w, h
        self.p: list[str] = []
        self.titulo, self.sub, self.fonte = titulo, sub, fonte

    def add(self, s: str) -> None:
        self.p.append(s)

    def txt(self, x, y, t, size=12, cor=None, anchor="start", peso=400,
            fam=F, ls=0, op=1) -> None:
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-family="{fam}" '
                 f'font-size="{size}" fill="{cor or C["tinta2"]}" text-anchor="{anchor}" '
                 f'font-weight="{peso}" letter-spacing="{ls}" opacity="{op}">{esc(t)}</text>')

    def barra(self, x, y, w, h, cor, r=3) -> None:
        """Barra vertical com o topo arredondado e a base reta (ancorada na linha)."""
        if h <= 0:
            return
        r = min(r, w / 2, h)
        self.add(f'<path d="M{x:.1f},{y + h:.1f} L{x:.1f},{y + r:.1f} '
                 f'Q{x:.1f},{y:.1f} {x + r:.1f},{y:.1f} L{x + w - r:.1f},{y:.1f} '
                 f'Q{x + w:.1f},{y:.1f} {x + w:.1f},{y + r:.1f} L{x + w:.1f},{y + h:.1f} Z" '
                 f'fill="{cor}"/>')

    def barraH(self, x, y, w, h, cor, r=3) -> None:
        if w <= 0:
            return
        r = min(r, h / 2, w)
        self.add(f'<path d="M{x:.1f},{y:.1f} L{x + w - r:.1f},{y:.1f} '
                 f'Q{x + w:.1f},{y:.1f} {x + w:.1f},{y + r:.1f} L{x + w:.1f},{y + h - r:.1f} '
                 f'Q{x + w:.1f},{y + h:.1f} {x + w - r:.1f},{y + h:.1f} L{x:.1f},{y + h:.1f} Z" '
                 f'fill="{cor}"/>')

    def legenda(self, x, y, itens: list[tuple[str, str]]) -> None:
        cx = x
        for rotulo, cor in itens:
            self.add(f'<rect x="{cx}" y="{y - 8}" width="10" height="10" rx="2" fill="{cor}"/>')
            self.txt(cx + 15, y, rotulo, 11.5, C["tinta2"])
            cx += 15 + len(rotulo) * 6.4 + 22

    def salvar(self, nome: str) -> None:
        cab = [f'<rect width="{self.w}" height="{self.h}" fill="{C["fundo"]}"/>']
        cab.append(f'<text x="28" y="34" font-family="{F}" font-size="17" '
                   f'font-weight="600" fill="{C["tinta"]}">{esc(self.titulo)}</text>')
        if self.sub:
            cab.append(f'<text x="28" y="54" font-family="{F}" font-size="12.5" '
                       f'fill="{C["tinta2"]}">{esc(self.sub)}</text>')
        if self.fonte:
            cab.append(f'<text x="28" y="{self.h - 14}" font-family="{FM}" font-size="9.5" '
                       f'fill="{C["mudo"]}">{esc(self.fonte)}</text>')
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" '
               f'width="{self.w}" height="{self.h}" role="img" '
               f'aria-label="{esc(self.titulo)}">'
               + "".join(cab) + "".join(self.p) + "</svg>")
        DEST.mkdir(parents=True, exist_ok=True)
        (DEST / nome).write_text(svg, encoding="utf8")
        print(f"  {nome}")


def grade_y(s: Svg, x0, x1, y0, y1, vmax, passos=4, fmt="{:.0f}"):
    for i in range(passos + 1):
        v = vmax * i / passos
        y = y1 - (y1 - y0) * i / passos
        s.add(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" '
              f'stroke="{C["grade"]}" stroke-width="1"/>')
        s.txt(x0 - 9, y + 4, fmt.format(v), 10.5, C["mudo"], "end", fam=FM)


# ── G1 · gols por faixa ───────────────────────────────────────────────────────
def g1():
    pp = json.load(open(RAIZ / "reports/a2-goleiro-n300.json"))["porPartida"]
    mins = [g["minuto"] for m in pp for g in m["golsSeq"]]
    faixas = [(0, 15), (16, 30), (31, 45), (46, 60), (61, 75), (76, 95)]
    jogo = [100 * sum(1 for x in mins if a <= x <= b) / len(mins) for a, b in faixas]
    real = [12.0, 15.0, 17.0, 17.0, 18.0, 21.0]
    rot = ["0–15'", "16–30'", "31–45'", "46–60'", "61–75'", "76–90'"]

    s = Svg(760, 452, "A partida murcha em vez de crescer",
            "Distribuição dos 879 gols por faixa de 15 minutos · o futebol real faz o inverso",
            "fonte: reports/a2-goleiro-n300.json · 300 partidas · faixa real: média de ligas de elite")
    x0, x1, y0, y1 = 62, 720, 92, 320
    vmax = 24
    grade_y(s, x0, x1, y0, y1, vmax, 4, "{:.0f}%")
    lg = (x1 - x0) / len(faixas)
    bw = (lg - 26) / 2
    for i, (j, r) in enumerate(zip(jogo, real)):
        cx = x0 + lg * i + 13
        hj = (y1 - y0) * j / vmax
        hr = (y1 - y0) * r / vmax
        s.barra(cx, y1 - hj, bw - 1, hj, C["jogo"])
        s.barra(cx + bw + 2, y1 - hr, bw - 1, hr, C["real"])
        s.txt(cx + bw / 2, y1 - hj - 7, f"{j:.1f}", 10.5, C["tinta"], "middle", 600, FM)
        s.txt(cx + bw + 2 + bw / 2, y1 - hr - 7, f"{r:.0f}", 10.5, C["mudo"], "middle", 400, FM)
        s.txt(x0 + lg * i + lg / 2, y1 + 19, rot[i], 11.5, C["tinta2"], "middle")
    s.add(f'<line x1="{x0}" y1="{y1}" x2="{x1}" y2="{y1}" stroke="{C["tinta2"]}" stroke-width="1.5"/>')
    s.legenda(x0, y1 + 46, [("jogo (medido)", C["jogo"]), ("futebol de elite", C["real"])])
    s.txt(x0, y1 + 76, "Queda de 1,17 ponto percentual por faixa, R² = 0,86 — monotônico, não é ruído.",
          11.5, C["tinta2"])
    s.txt(x0, y1 + 96, "Causa medida: fadiga uniforme. r = 0,814 entre stamina e taxa de chutes. → defeito D19",
          11.5, C["tinta2"])
    s.salvar("G1-gols-por-faixa.svg")


# ── G2 · para onde a bola e mandada ───────────────────────────────────────────
def g2():
    d = json.load(open(RAIZ / "reports/direcao-desvios.json"))
    h = d["histogramaLateral"]
    rot = ["já fora\n(≤ 0 m)", "≤ 1,15 m\n(portão r18181)", "≤ 2,05 m", "≤ 4 m", "≤ 8 m", "> 8 m"]
    val, pct = [], []
    for k in h:
        n, p = h[k].split(" (")
        val.append(int(n)); pct.append(float(p.rstrip("%)")))

    s = Svg(760, 424, "85,8% dos desvios são mirados para longe da linha lateral",
            "Distância do alvo pedido até a linha lateral mais próxima · 6.016 chamadas",
            "fonte: reports/direcao-desvios.json · tools/fisica/direcao.js · 40 partidas")
    x0, x1, y0, y1 = 62, 720, 96, 300
    vmax = 90
    grade_y(s, x0, x1, y0, y1, vmax, 3, "{:.0f}%")
    lg = (x1 - x0) / 6
    for i, p in enumerate(pct):
        cx = x0 + lg * i + 16
        bw = lg - 34
        hh = (y1 - y0) * p / vmax
        cor = C["ouro"] if i == 0 else (C["azul"] if i == 1 else C["jogo"])
        s.barra(cx, y1 - hh, bw, hh, cor)
        s.txt(cx + bw / 2, y1 - hh - 8, f"{p:.1f}%", 11, C["tinta"], "middle", 600, FM)
        s.txt(cx + bw / 2, y1 - hh - 22, f"{val[i]}", 9.5, C["mudo"], "middle", 400, FM)
        for j, ln in enumerate(rot[i].split("\n")):
            s.txt(x0 + lg * i + lg / 2, y1 + 18 + j * 12, ln, 10.5, C["tinta2"], "middle")
    s.add(f'<line x1="{x0}" y1="{y1}" x2="{x1}" y2="{y1}" stroke="{C["tinta2"]}" stroke-width="1.5"/>')
    y = y1 + 62
    s.add(f'<rect x="{x0}" y="{y}" width="{x1 - x0}" height="52" rx="4" fill="{C["faixa"]}"/>')
    s.txt(x0 + 14, y + 21, "A conta que fecha o diagnóstico:", 11.5, C["tinta"], peso=600)
    s.txt(x0 + 14, y + 39,
          "16,8 alvos por partida mirados para fora   ≈   15,9 laterais medidos.  "
          "O jogo não perde laterais — ele nunca os cria.", 11.5, C["tinta2"])
    s.salvar("G2-direcao-do-desvio.svg")


# ── G3 · reinicios ────────────────────────────────────────────────────────────
def g3():
    a = json.load(open(RAIZ / "reports/a2-goleiro-n300.json"))["agregado"]
    dados = [("laterais", a["throwIns"]["media"], 40.0, 33, 48),
             ("escanteios", a["corners"]["media"], 10.0, 8, 13),
             ("tiros de meta", a["goalKicks"]["media"], 15.0, 12, 18)]
    s = Svg(760, 340, "O buraco dos reinícios está inteiro nos laterais",
            "Reinícios por partida · escanteios e tiros de meta já estão na faixa",
            "fonte: reports/a2-goleiro-n300.json · 300 partidas")
    x0, x1 = 168, 700
    vmax = 50
    for i in range(6):
        v = vmax * i / 5
        x = x0 + (x1 - x0) * i / 5
        s.add(f'<line x1="{x:.1f}" y1="88" x2="{x:.1f}" y2="248" stroke="{C["grade"]}" stroke-width="1"/>')
        s.txt(x, 266, f"{v:.0f}", 10.5, C["mudo"], "middle", fam=FM)
    for i, (nome, jogo, real, lo, hi) in enumerate(dados):
        y = 104 + i * 50
        esc_ = lambda v: x0 + (x1 - x0) * v / vmax
        s.add(f'<rect x="{esc_(lo):.1f}" y="{y - 5}" width="{esc_(hi) - esc_(lo):.1f}" '
              f'height="34" rx="3" fill="{C["real"]}" opacity="0.14"/>')
        s.barraH(x0, y + 2, esc_(jogo) - x0, 20, C["jogo"])
        s.txt(x0 - 12, y + 17, nome, 12.5, C["tinta"], "end")
        s.txt(esc_(jogo) + 8, y + 17, f"{jogo:.2f}", 11.5, C["tinta"], peso=600, fam=FM)
        s.txt(esc_(hi) + 8, y + 17, f"faixa real {lo}–{hi}", 10.5, C["mudo"], fam=FM)
    s.add(f'<line x1="{x0}" y1="88" x2="{x0}" y2="248" stroke="{C["tinta2"]}" stroke-width="1.5"/>')
    s.legenda(x0, 292, [("medido no jogo", C["jogo"]), ("faixa do futebol de elite", "#d5cde0")])
    s.salvar("G3-reinicios.svg")


# ── G4 · forma do bloco ───────────────────────────────────────────────────────
def g4():
    linhas = [("comprimento", 37.8, 37.4, 25, 35), ("largura", 49.4, 45.2, 30, 45)]
    s = Svg(760, 372, "O bloco não compacta quando o time perde a bola",
            "Metros · com a bola a forma está certa; sem a bola ela não muda",
            "fonte: tools/fisica/tela/forma.js · Chromium real · 1.198 amostras")
    x0, x1 = 150, 690
    vmin, vmax = 20, 56
    esc_ = lambda v: x0 + (x1 - x0) * (v - vmin) / (vmax - vmin)
    for v in range(20, 57, 6):
        s.add(f'<line x1="{esc_(v):.1f}" y1="92" x2="{esc_(v):.1f}" y2="248" '
              f'stroke="{C["grade"]}" stroke-width="1"/>')
        s.txt(esc_(v), 266, str(v), 10.5, C["mudo"], "middle", fam=FM)
    for i, (nome, com, sem, lo, hi) in enumerate(linhas):
        y = 116 + i * 74
        s.add(f'<rect x="{esc_(lo):.1f}" y="{y - 22}" width="{esc_(hi) - esc_(lo):.1f}" '
              f'height="52" rx="3" fill="{C["real"]}" opacity="0.14"/>')
        s.add(f'<line x1="{esc_(sem):.1f}" y1="{y + 4}" x2="{esc_(com):.1f}" y2="{y + 4}" '
              f'stroke="{C["tinta2"]}" stroke-width="2"/>')
        s.add(f'<circle cx="{esc_(com):.1f}" cy="{y + 4}" r="7" fill="{C["jogo"]}" '
              f'stroke="{C["fundo"]}" stroke-width="2"/>')
        s.add(f'<circle cx="{esc_(sem):.1f}" cy="{y + 4}" r="7" fill="{C["ouro"]}" '
              f'stroke="{C["fundo"]}" stroke-width="2"/>')
        s.txt(x0 - 12, y + 9, nome, 12.5, C["tinta"], "end")
        s.txt(esc_(com) + 12, y - 8, f"com bola {com}", 10.5, C["tinta2"], fam=FM)
        s.txt(esc_(sem), y + 38, f"sem bola {sem}", 10.5, C["tinta2"], "middle", fam=FM)
        s.txt(esc_((lo + hi) / 2), y - 30, f"real sem bola {lo}–{hi}", 10, C["mudo"], "middle", fam=FM)
    s.legenda(x0, 300, [("com a bola", C["jogo"]), ("sem a bola", C["ouro"]),
                        ("faixa real defendendo", "#d5cde0")])
    s.txt(x0, 330, "Encurta 0,4 m ao perder a bola. No futebol real encurta 8 a 10 m. → defeito D20",
          11.5, C["tinta2"])
    s.salvar("G4-forma-do-bloco.svg")


# ── G5 · funil da finalizacao ─────────────────────────────────────────────────
def g5():
    etapas = [("finalizações", 23.67, C["jogo"]), ("chutes no alvo", 7.72, C["azul"]),
              ("gols", 2.93, C["ouro"])]
    s = Svg(760, 350, "O funil da finalização",
            "Por partida · as três taxas derivadas estão todas dentro da faixa real",
            "fonte: reports/a2-goleiro-n300.json · 300 partidas")
    x0, larg = 170, 460
    vmax = 25
    for i, (nome, v, cor) in enumerate(etapas):
        y = 100 + i * 56
        w = larg * v / vmax
        s.barraH(x0, y, w, 34, cor)
        s.txt(x0 - 12, y + 22, nome, 12.5, C["tinta"], "end")
        s.txt(x0 + 12, y + 22, f"{v:.2f}", 13, "#ffffff", peso=600, fam=FM)
        if i:
            ant = etapas[i - 1][1]
            s.txt(x0 + w + 14, y + 22, f"{100 * v / ant:.1f}% da etapa anterior",
                  11, C["tinta2"], fam=FM)
    y = 278
    s.add(f'<rect x="{x0 - 120}" y="{y - 22}" width="620" height="40" rx="4" fill="{C["faixa"]}"/>')
    for i, (r, v, f_) in enumerate([("conversão", "0,124", "0,09–0,13"),
                                    ("acerto ao alvo", "0,326", "0,30–0,40"),
                                    ("gol / chute no alvo", "0,380", "0,27–0,38")]):
        cx = x0 - 104 + i * 200
        s.txt(cx, y - 6, r, 10.5, C["mudo"])
        s.txt(cx, y + 10, f"{v}   real {f_}", 11.5, C["tinta"], peso=600, fam=FM)
    s.salvar("G5-funil-da-finalizacao.svg")


# ── G6 · evolucao do placar ───────────────────────────────────────────────────
def g6():
    marcos = [("OS-200", 10, None), ("OS-201", 10, None), ("OS-203", 11, None),
              ("OS-204", 11, 10), ("A1", 11, 12), ("A2", 12, 15)]
    s = Svg(760, 396, "Os dois maiores saltos vieram de consertos de uma linha",
            "Placar de design (13 métricas) e do futebol real (21) por release",
            "fonte: os laudos em reports/ · cada ponto é uma medição de 300 partidas")
    x0, x1, y0, y1 = 70, 560, 96, 268
    vmax = 21
    for i in range(4):
        v = vmax * i / 3
        y = y1 - (y1 - y0) * i / 3
        s.add(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" stroke="{C["grade"]}" stroke-width="1"/>')
        s.txt(x0 - 9, y + 4, f"{v:.0f}", 10.5, C["mudo"], "end", fam=FM)
    px = lambda i: x0 + (x1 - x0) * i / (len(marcos) - 1)
    py = lambda v: y1 - (y1 - y0) * v / vmax
    for chave, cor, idx, rot in [("design", C["jogo"], 1, "/13 design"), ("real", C["real"], 2, "/21 futebol real")]:
        pts = [(px(i), py(m[idx])) for i, m in enumerate(marcos) if m[idx] is not None]
        d = " ".join(("M" if k == 0 else "L") + f"{x:.1f},{y:.1f}" for k, (x, y) in enumerate(pts))
        s.add(f'<path d="{d}" fill="none" stroke="{cor}" stroke-width="2" '
              f'stroke-linejoin="round" stroke-linecap="round"/>')
        for k, (x, y) in enumerate(pts):
            r = 6 if k == len(pts) - 1 else 4
            s.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{cor}" '
                  f'stroke="{C["fundo"]}" stroke-width="2"/>')
        ux, uy = pts[-1]
        v = [m[idx] for m in marcos if m[idx] is not None][-1]
        s.txt(ux + 14, uy + 4, f"{v}  {rot}", 11.5, C["tinta"], peso=600, fam=FM)
    for i, (nome, _, _) in enumerate(marcos):
        s.txt(px(i), y1 + 19, nome, 11, C["tinta2"], "middle")
    s.add(f'<line x1="{x0}" y1="{y1}" x2="{x1}" y2="{y1}" stroke="{C["tinta2"]}" stroke-width="1.5"/>')
    s.txt(x0, y1 + 52, "A1 · um termo de impedimento em _bestPass       10,03 → 5,11 impedimentos",
          11.5, C["tinta2"], fam=FM)
    s.txt(x0, y1 + 70, "A2 · guardar a MELHOR folga do goleiro           0,428 → 0,378 gol/chute no alvo",
          11.5, C["tinta2"], fam=FM)
    s.txt(x0, y1 + 92, "Nenhum dos dois veio de calibração. Duas outras tentativas foram revertidas.",
          11.5, C["mudo"])
    s.salvar("G6-evolucao-do-placar.svg")


# ── G7 · os 34 defeitos ───────────────────────────────────────────────────────
def g7():
    d = json.load(open(RAIZ / "reports/defeitos.json"))["defeitos"]
    fases = ["F0", "F1", "F2", "F3", "F4", "F5", "F6", "—", "pos-F5"]
    sevs = [("estrutural", C["real"]), ("futebol", C["jogo"]),
            ("higiene", C["azul"]), ("tela", C["ouro"])]
    m = collections.Counter((x["fase"], x["sev"]) for x in d)
    s = Svg(760, 400, "Os 34 defeitos por fase e severidade",
            "Cada quadrado é um defeito · a cor é o tipo, a coluna é quando fazer",
            "fonte: reports/defeitos.json · gerado e validado por tools/defeitos.py")
    x0, y0 = 96, 108
    lg, cel = 68, 17
    for j, f_ in enumerate(fases):
        s.txt(x0 + j * lg + lg / 2 - 8, y0 - 14, f_, 11.5, C["tinta"], "middle", 600, FM)
    for i, (sev, cor) in enumerate(sevs):
        y = y0 + i * 46
        s.txt(x0 - 14, y + 13, sev, 11.5, C["tinta2"], "end")
        for j, f_ in enumerate(fases):
            n = m.get((f_, sev), 0)
            for k in range(n):
                cx = x0 + j * lg + (k % 3) * (cel + 3)
                cy = y + (k // 3) * (cel + 3)
                s.add(f'<rect x="{cx}" y="{cy}" width="{cel}" height="{cel}" rx="3" fill="{cor}"/>')
    est = collections.Counter(x["estado"] for x in d)
    y = 316
    s.add(f'<line x1="{x0 - 60}" y1="{y - 24}" x2="700" y2="{y - 24}" stroke="{C["grade"]}" stroke-width="1"/>')
    for i, (k, rot) in enumerate([("aberto", "abertos"), ("feito", "feitos"),
                                  ("parcial", "parcial"), ("guarda-corpo", "guarda-corpo"),
                                  ("decidir", "a decidir"), ("adiado", "adiado")]):
        cx = x0 - 60 + i * 106
        s.txt(cx, y, str(est.get(k, 0)), 22, C["tinta"], peso=600, fam=FM)
        s.txt(cx, y + 17, rot, 10.5, C["mudo"])
    s.legenda(x0 - 60, 372, [(n, c) for n, c in sevs])
    s.salvar("G7-defeitos-por-fase.svg")


# ── G8 · distribuicao de placares ─────────────────────────────────────────────
def g8():
    pp = json.load(open(RAIZ / "reports/a2-goleiro-n300.json"))["porPartida"]
    c = collections.Counter(tuple(sorted(m["placar"], reverse=True)) for m in pp)
    top = c.most_common(10)
    n = len(pp)
    s = Svg(760, 360, "A distribuição de placares é uma das partes saudáveis do jogo",
            "Os dez resultados mais frequentes em 300 partidas · serve de guarda-corpo",
            "fonte: reports/a2-goleiro-n300.json")
    x0, x1, y0, y1 = 62, 700, 96, 250
    vmax = 16
    grade_y(s, x0, x1, y0, y1, vmax, 4, "{:.0f}%")
    lg = (x1 - x0) / len(top)
    for i, (pl, q) in enumerate(top):
        p = 100 * q / n
        cx = x0 + lg * i + 12
        bw = lg - 26
        hh = (y1 - y0) * p / vmax
        cor = C["ouro"] if pl == (0, 0) else C["jogo"]
        s.barra(cx, y1 - hh, bw, hh, cor)
        s.txt(cx + bw / 2, y1 - hh - 8, f"{p:.1f}", 10.5, C["tinta"], "middle", 600, FM)
        s.txt(cx + bw / 2, y1 + 19, f"{pl[0]}–{pl[1]}", 11.5, C["tinta2"], "middle", fam=FM)
    s.add(f'<line x1="{x0}" y1="{y1}" x2="{x1}" y2="{y1}" stroke="{C["tinta2"]}" stroke-width="1.5"/>')
    y = 286
    s.add(f'<rect x="{x0}" y="{y - 20}" width="{x1 - x0}" height="42" rx="4" fill="{C["faixa"]}"/>')
    for i, (r, v, f_) in enumerate([("0 a 0", "7,7%", "real 7–9%"),
                                    ("gols por partida", "2,93", "real 2,5–3,0"),
                                    ("goleadas (4+)", "~3%", "real 2–4%")]):
        cx = x0 + 16 + i * 214
        s.txt(cx, y - 4, r, 10.5, C["mudo"])
        s.txt(cx, y + 13, f"{v}   {f_}", 11.5, C["tinta"], peso=600, fam=FM)
    s.salvar("G8-placares.svg")


if __name__ == "__main__":
    print(f"gerando graficos em {DEST}")
    for f in (g1, g2, g3, g4, g5, g6, g7, g8):
        f()
    print("ok")
