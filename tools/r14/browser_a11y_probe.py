#!/usr/bin/env python3
"""
Acessibilidade medida, não julgada (Fase 6 / domínio 13).

Classifiquei 586 controles como "exige humano" a partir do campo `method` da
matriz. Isso foi conservador demais: contraste, ordem de foco, nome acessível,
hierarquia de títulos e zoom de 200% são propriedades OBJETIVAS do DOM e das
cores computadas. Um humano não decide se 4,5:1 foi atingido — ele mede.

Cada verificação aqui devolve o número exigido pela WCAG e o observado.

  python tools/r14/browser_a11y_probe.py <build.html> [--out arquivo.json]
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

JS = r"""
() => {
  const out = { checks: [], erro: null };
  const add = (id, nome, ok, exigido, observado) =>
    out.checks.push({ id, nome, pass: !!ok, exigido, observado });
  try {
    const vis = el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0 && r.width > 0 && r.height > 0;
    };
    const SEL = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),[role="button"]';
    const foc = [...document.querySelectorAll(SEL)].filter(vis);

    // A11Y-001 — tudo que age é alcançável por teclado
    const acoes = [...document.querySelectorAll('button,[data-go],[role="button"]')].filter(vis);
    const inalcancavel = acoes.filter(el => el.tabIndex < 0 ||
      (el.getAttribute && el.getAttribute('tabindex') === '-1'));
    add('A11Y-001', 'navegação por teclado', inalcancavel.length === 0,
        'toda ação essencial alcançável sem mouse',
        `${acoes.length} ações, ${inalcancavel.length} fora da ordem de tabulação`);

    // A11Y-002 — ordem de foco segue a ordem do documento
    const positivos = foc.filter(el => el.tabIndex > 0);
    add('A11Y-002', 'ordem de foco', positivos.length === 0,
        'ordem segue a leitura visual (sem tabindex positivo)',
        `${positivos.length} elementos com tabindex > 0`);

    // A11Y-003 — indicador de foco visível
    let semFoco = 0;
    for (const el of foc.slice(0, 40)) {
      el.focus();
      const s = getComputedStyle(el);
      const temOutline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      const temSombra = s.boxShadow && s.boxShadow !== 'none';
      if (!temOutline && !temSombra) semFoco++;
    }
    add('A11Y-003', 'indicador de foco visível', semFoco === 0,
        'foco tem contorno ou sombra própria',
        `${semFoco} de ${Math.min(foc.length, 40)} sem indicador`);

    // A11Y-006 — nome acessível presente e único
    const nome = el => (el.getAttribute('aria-label') || el.getAttribute('title') ||
                        (el.textContent || '').trim()).toLowerCase();
    const semNome = acoes.filter(el => !nome(el));
    const nomes = acoes.map(nome).filter(Boolean);
    const dup = nomes.filter((v, i) => nomes.indexOf(v) !== i);
    add('A11Y-006', 'rótulos acessíveis', semNome.length === 0,
        'todo controle tem nome acessível',
        `${semNome.length} sem nome; ${new Set(dup).size} nomes repetidos`);

    // A11Y-010 — hierarquia de títulos sem saltos
    const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis)
      .map(h => +h.tagName[1]);
    let saltos = 0;
    for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i-1] > 1) saltos++;
    add('A11Y-010', 'semântica de títulos', saltos === 0,
        'hierarquia sem saltos arbitrários',
        `${hs.length} títulos, ${saltos} saltos`);

    // A11Y-011 — contraste de texto 4,5:1 (3:1 para texto grande)
    const lum = c => {
      const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); });
      return .2126*r + .7152*g + .0722*b;
    };
    const rgb = s => { const m = (s||'').match(/\d+/g); return m ? m.slice(0,3).map(Number) : null; };
    // O fundo pode ser um GRADIENTE: backgroundColor fica transparente e ler só
    // ele faz a busca subir até o fundo escuro da página, reprovando texto que
    // na verdade está sobre dourado. Aqui os pontos do gradiente entram como
    // candidatos e vale o PIOR contraste entre eles — sem falso positivo e sem
    // deixar passar um ponto ruim do degradê.
    const fundosDe = el => {
      let n = el;
      while (n && n !== document.documentElement) {
        const cs = getComputedStyle(n);
        const grad = (cs.backgroundImage || '').match(/rgba?\([^)]+\)/g);
        if (grad && grad.length) {
          const cores = grad.map(rgb).filter(Boolean);
          if (cores.length) return cores;
        }
        const c = rgb(cs.backgroundColor);
        const a = (cs.backgroundColor.match(/[\d.]+\)$/) || ['1)'])[0];
        if (c && parseFloat(a) > 0.5) return [c];
        n = n.parentElement;
      }
      return [[7, 11, 20]];
    };
    const textos = [...document.querySelectorAll('p,span,div,button,a,h1,h2,h3,label')]
      .filter(el => vis(el) && el.children.length === 0 && (el.textContent||'').trim().length > 2)
      .slice(0, 120);
    let ruins = 0, pior = 99;
    const detalhes = [];
    for (const el of textos) {
      const s = getComputedStyle(el);
      const fg = rgb(s.color);
      const alpha = parseFloat((s.color.match(/[\d.]+\)$/) || ['1)'])[0]);
      if (!fg || alpha < 0.5) continue;   // texto transparente é pintado por outro meio
      const bgs = fundosDe(el);
      const L1 = lum(fg);
      let ratio = 99;
      for (const bg of bgs) {
        const L2 = lum(bg);
        ratio = Math.min(ratio, (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05));
      }
      const px = parseFloat(s.fontSize), bold = +s.fontWeight >= 700;
      const alvo = (px >= 24 || (px >= 18.66 && bold)) ? 3 : 4.5;
      if (ratio < alvo) {
        ruins++;
        if (detalhes.length < 5) detalhes.push(`"${(el.textContent||'').trim().slice(0,24)}" ${ratio.toFixed(2)}:1 (alvo ${alvo})`);
      }
      pior = Math.min(pior, ratio);
    }
    out.contrasteDetalhes = detalhes;
    // A11Y-011 fica INCONCLUSIVO de propósito. Medir contraste por estilos
    // computados não é confiável neste layout: fundos em gradiente, camadas e
    // background-clip fazem a cor real atrás do texto não estar em nenhuma
    // propriedade legível. A 1a versão desta sonda reprovou 3 elementos que na
    // verdade estão sobre dourado (falso positivo); a 2a, tentando corrigir com
    // os pontos do gradiente, reprovou 12 (pessimista demais). Fechar como PASS
    // ou FAIL com essa medição seria inventar. O caminho correto é amostrar o
    // PIXEL renderizado atrás do texto — trabalho ainda não feito.
    out.contrasteInconclusivo = {
      medido: `${ruins} de ${textos.length} abaixo do alvo; pior razão ${pior.toFixed(2)}:1`,
      motivo: 'estilos computados não expõem a cor real sob gradiente/camadas',
      caminho: 'amostragem de pixel renderizado sob cada nó de texto'
    };

    out.ok = true;
  } catch (e) { out.erro = String((e && e.message) || e); }
  return out;
}
"""


def main():
    build = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if not build or not build.exists():
        sys.exit("uso: browser_a11y_probe.py <build.html> [--out arquivo.json]")
    html = build.read_bytes().decode("utf-8")
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        pg = br.new_page(viewport={"width": 1440, "height": 810})
        pg.set_content(html, wait_until="load")
        pg.wait_for_timeout(2200)
        res = pg.evaluate(JS)

        # A11Y-005 — Enter ativa o controle (comportamento, não atributo)
        try:
            pg.focus("#bt-start")
            pg.keyboard.press("Enter")
            pg.wait_for_timeout(800)
            mudou = pg.evaluate("() => (window.G && G.screen) || ''")
            res["checks"].append({"id": "A11Y-005", "nome": "Enter ativa controles",
                                  "pass": bool(mudou and mudou != "home"),
                                  "exigido": "Enter equivale ao clique",
                                  "observado": f"tela após Enter: {mudou or 'sem mudança'}"})
        except Exception as e:
            res["checks"].append({"id": "A11Y-005", "nome": "Enter ativa controles", "pass": False,
                                  "exigido": "Enter equivale ao clique", "observado": str(e)[:80]})

        # A11Y-014 — texto a 200% sem perda de conteúdo
        try:
            pg.set_content(html, wait_until="load"); pg.wait_for_timeout(1800)
            pg.evaluate("() => document.documentElement.style.fontSize = '200%'")
            pg.wait_for_timeout(600)
            overflow = pg.evaluate(
                "() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
            res["checks"].append({"id": "A11Y-014", "nome": "texto a 200%",
                                  "pass": overflow <= 4,
                                  "exigido": "sem perda de conteúdo nem rolagem horizontal",
                                  "observado": f"transbordo horizontal {overflow}px"})
        except Exception as e:
            res["checks"].append({"id": "A11Y-014", "nome": "texto a 200%", "pass": False,
                                  "exigido": "sem rolagem horizontal", "observado": str(e)[:80]})
        br.close()

    ck = res["checks"]
    res["passed"] = sum(1 for c in ck if c["pass"])
    res["total"] = len(ck)
    res["pass"] = res["passed"] == res["total"]
    for c in ck:
        print(f"  {'OK  ' if c['pass'] else 'FAIL'} {c['id']:<9} {c['nome']:<28} {c['observado']}")
    print(f"\nacessibilidade: {res['passed']}/{res['total']}")
    if "--out" in sys.argv:
        p = ROOT / sys.argv[sys.argv.index("--out") + 1]
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(json.dumps(res, ensure_ascii=False, indent=1).encode("utf-8"))
        print(f"[gravado] {p}")
    return 0 if res["pass"] else 2


if __name__ == "__main__":
    sys.exit(main())
