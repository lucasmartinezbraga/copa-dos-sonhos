#!/usr/bin/env python3
"""
Amostragem de PIXEL RENDERIZADO — mede o que a tela realmente mostra.

Estilos computados mentem sobre cor de fundo quando há gradiente, camada ou
background-clip: a sonda de a11y errou duas vezes por isso, em direções opostas.
O pixel não mente. Aqui o navegador desenha, e a medição lê o que foi desenhado.

Cobre o contraste real (A11Y-011) e invariantes visuais do campo 2.5D que só
existem depois de rasterizar.

  python tools/r14/browser_pixel_probe.py <build.html> [--out arquivo.json]
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

# Desenha a página num canvas via html2canvas? Não — usa a API de captura do
# próprio navegador: para cada nó de texto, lê o pixel do CANTO da caixa, que é
# fundo por construção (o glifo fica no miolo).
JS_CONTRASTE = r"""
async () => {
  const out = { amostras: [], erro: null };
  try {
    const lum = c => { const [r,g,b] = c.map(v => { v/=255; return v<=.03928? v/12.92 : Math.pow((v+.055)/1.055,2.4); });
                       return .2126*r + .7152*g + .0722*b; };
    const rgb = s => { const m=(s||'').match(/\d+/g); return m? m.slice(0,3).map(Number) : null; };
    const vis = el => { const s=getComputedStyle(el), r=el.getBoundingClientRect();
      return s.display!=='none' && s.visibility!=='hidden' && +s.opacity>0 && r.width>2 && r.height>2; };
    const textos = [...document.querySelectorAll('p,span,div,button,a,h1,h2,h3,label')]
      .filter(el => vis(el) && el.children.length===0 && (el.textContent||'').trim().length>2)
      .slice(0, 60);
    for (const el of textos) {
      const s = getComputedStyle(el);
      const fg = rgb(s.color);
      const alpha = parseFloat((s.color.match(/[\d.]+\)$/) || ['1)'])[0]);
      if (!fg || alpha < 0.5) continue;
      const r = el.getBoundingClientRect();
      out.amostras.push({
        txt: (el.textContent||'').trim().slice(0,28),
        fg, px: parseFloat(s.fontSize), bold: +s.fontWeight >= 700,
        // pontos de FUNDO: cantos da caixa, onde não há glifo
        pts: [[r.left+1, r.top+1], [r.right-2, r.top+1],
              [r.left+1, r.bottom-2], [r.right-2, r.bottom-2]].map(p => [Math.round(p[0]), Math.round(p[1])])
      });
    }
  } catch (e) { out.erro = String((e&&e.message)||e); }
  return out;
}
"""

JS_CANVAS = r"""
() => {
  const out = { erro: null };
  try {
    const cv = document.querySelector('canvas');
    if (!cv) { out.erro = 'sem canvas'; return out; }
    const ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    const d = ctx.getImageData(0, 0, w, h).data;
    let n = 0, escuros = 0, verdes = 0, claros = 0;
    const cores = new Set();
    for (let i = 0; i < d.length; i += 4 * 37) {   // amostragem esparsa determinística
      const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
      if (a < 8) continue;
      n++;
      cores.add((r >> 4) + ',' + (g >> 4) + ',' + (b >> 4));
      if (g > r + 12 && g > b + 12) verdes++;          // gramado
      if (r < 60 && g < 60 && b < 60) escuros++;        // sombras/linhas
      if (r > 200 && g > 200 && b > 200) claros++;      // bola/marcações
    }
    out.amostrados = n;
    out.coresDistintas = cores.size;
    out.fracaoGramado = +(verdes / Math.max(n,1)).toFixed(4);
    out.fracaoEscura = +(escuros / Math.max(n,1)).toFixed(4);
    out.fracaoClara = +(claros / Math.max(n,1)).toFixed(4);
    out.dimensoes = [w, h];
  } catch (e) { out.erro = String((e&&e.message)||e); }
  return out;
}
"""


def main():
    build = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if not build or not build.exists():
        sys.exit("uso: browser_pixel_probe.py <build.html> [--out arquivo.json]")
    html = build.read_bytes().decode("utf-8")
    res = {"checks": []}

    def add(cid, nome, ok, exigido, obs):
        res["checks"].append({"id": cid, "nome": nome, "pass": bool(ok),
                              "exigido": exigido, "observado": obs})

    with sync_playwright() as pw:
        br = pw.chromium.launch()
        pg = br.new_page(viewport={"width": 1440, "height": 810})
        pg.set_content(html, wait_until="load")
        pg.wait_for_timeout(2400)

        # ── contraste real: captura a tela e lê o pixel dos cantos de cada caixa
        info = pg.evaluate(JS_CONTRASTE)
        shot = ROOT / "reports/r14/pixel/home.png"
        shot.parent.mkdir(parents=True, exist_ok=True)
        pg.screenshot(path=str(shot))
        try:
            from PIL import Image
            img = Image.open(shot).convert("RGB")
            W, H = img.size
            def lum(c):
                f = [v / 255 for v in c]
                f = [v / 12.92 if v <= .03928 else ((v + .055) / 1.055) ** 2.4 for v in f]
                return .2126 * f[0] + .7152 * f[1] + .0722 * f[2]
            ruins, pior, det = 0, 99.0, []
            for a in info.get("amostras", []):
                L1 = lum(a["fg"])
                melhor = 0.0
                for (x, y) in a["pts"]:
                    if not (0 <= x < W and 0 <= y < H):
                        continue
                    L2 = lum(list(img.getpixel((x, y))))
                    r = (max(L1, L2) + .05) / (min(L1, L2) + .05)
                    melhor = max(melhor, r)   # melhor canto = fundo efetivo do texto
                if melhor == 0:
                    continue
                alvo = 3 if (a["px"] >= 24 or (a["px"] >= 18.66 and a["bold"])) else 4.5
                if melhor < alvo:
                    ruins += 1
                    if len(det) < 5:
                        det.append(f'"{a["txt"]}" {melhor:.2f}:1 (alvo {alvo})')
                pior = min(pior, melhor)
            add("A11Y-011", "contraste de texto (pixel real)", ruins == 0,
                "4,5:1 normal e 3:1 grande, medido no pixel renderizado",
                f"{ruins} de {len(info.get('amostras',[]))} abaixo do alvo; pior {pior:.2f}:1"
                + (" | " + "; ".join(det) if det else ""))
        except ImportError:
            add("A11Y-011", "contraste de texto (pixel real)", False,
                "4,5:1 / 3:1", "Pillow ausente — não medido")

        # ── canvas do campo: precisa existir jogo desenhado, não tela chapada
        try:
            pg.evaluate("() => { const b=document.querySelector('#bt-start'); if(b) b.click(); }")
            pg.wait_for_timeout(1500)
        except Exception:
            pass
        cv = pg.evaluate(JS_CANVAS)
        res["canvas"] = cv
        if cv.get("erro"):
            add("VFX-CANVAS", "campo rasterizado", False, "canvas presente e desenhado", cv["erro"])
        else:
            add("VFX-CANVAS", "campo rasterizado",
                cv["coresDistintas"] > 12 and cv["amostrados"] > 500,
                "canvas com conteúdo real (não chapado)",
                f"{cv['coresDistintas']} cores distintas em {cv['amostrados']} amostras {cv['dimensoes']}")
        br.close()

    ck = res["checks"]
    res["passed"] = sum(1 for c in ck if c["pass"])
    res["total"] = len(ck)
    res["pass"] = res["passed"] == res["total"]
    for c in ck:
        print(f"  {'OK  ' if c['pass'] else 'FAIL'} {c['id']:<11} {c['nome']:<34} {c['observado']}")
    print(f"\npixel: {res['passed']}/{res['total']}")
    if "--out" in sys.argv:
        p = ROOT / sys.argv[sys.argv.index("--out") + 1]
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(json.dumps(res, ensure_ascii=False, indent=1).encode("utf-8"))
        print(f"[gravado] {p}")
    return 0 if res["pass"] else 2


if __name__ == "__main__":
    sys.exit(main())
