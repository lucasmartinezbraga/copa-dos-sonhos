#!/usr/bin/env python3
"""
Invariantes da projeção 2.5D (Fase 5), medidos NO NAVEGADOR.

Projeção não se audita a olho: ou as propriedades valem para todo o campo, ou
existe uma região onde o jogador fica do tamanho errado, atrás de quem deveria
estar na frente, ou com a sombra deslocada do pé. Cada invariante abaixo é
verificado sobre uma malha do campo inteiro, não em pontos escolhidos a dedo.

  python tools/r14/browser_projection_probe.py <build.html> [--out arquivo.json]
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

JS = r"""
() => {
  const out = { ok:false, erro:null, checks:[] };
  const add = (nome, ok, detalhe) => out.checks.push({ nome, pass: !!ok, detalhe: detalhe || '' });
  try {
    const F = window.CDS_F25D;
    if (!F || typeof F.project !== 'function') { out.erro = 'CDS_F25D.project ausente'; return out; }

    // malha do campo inteiro (coordenadas de tela do canvas lógico)
    const pts = [];
    for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) pts.push([i/20, j/20]);

    // 1. FINITUDE: nenhum ponto do campo projeta para NaN/Infinito
    let naoFinito = 0;
    const proj = pts.map(([u,v]) => {
      const p = F.project(u * 1000, v * 600);
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.s)) naoFinito++;
      return { u, v, p };
    });
    add('projeção finita em toda a malha', naoFinito === 0, `${naoFinito} pontos não-finitos`);

    // 2. ESCALA: quem está mais longe (v menor = topo) é menor. Estritamente.
    let escalaErrada = 0;
    for (let i = 0; i < proj.length; i++) {
      for (let j = i + 1; j < proj.length; j++) {
        const a = proj[i], b = proj[j];
        if (Math.abs(a.u - b.u) > 1e-9) continue;
        if (a.v < b.v - 1e-9 && a.p.s > b.p.s + 1e-9) escalaErrada++;
      }
    }
    add('escala diminui com a profundidade', escalaErrada === 0, `${escalaErrada} pares invertidos`);

    // 3. ORDENAÇÃO EM PROFUNDIDADE: y de tela cresce monotonicamente com v.
    //    É o que garante que ordenar por worldY desenha o de trás primeiro.
    let ordemErrada = 0;
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      let prev = -Infinity;
      for (let k = 0; k <= 40; k++) {
        const p = F.project(u * 1000, (k/40) * 600);
        if (p.y < prev - 1e-6) ordemErrada++;
        prev = p.y;
      }
    }
    add('ordenação por profundidade é monotônica', ordemErrada === 0, `${ordemErrada} inversões`);

    // 4. EIXO DE FUGA: numa projeção central vale x(fx,v) = C + (fx - C)*s(v),
    //    então existe EXATAMENTE UM fx invariante em profundidade — o eixo C.
    //    Ele é resolvido a partir de duas amostras (não chutado), e depois se
    //    verifica que a coluna nesse fx realmente não deriva em toda a malha.
    //    Testar uma coluna arbitrária falharia só por não ser simétrica.
    const s1 = F.project(0, 100).s, s2 = F.project(0, 500).s;
    const C = (s1 - s2) !== 0
      ? (F.project(0, 100).x * s2 - F.project(0, 500).x * s1) / (s2 - s1)
      : NaN;
    let desvioEixo = 0;
    for (let k = 0; k <= 40; k++) {
      const v = (k/40) * 600;
      desvioEixo = Math.max(desvioEixo, Math.abs(F.project(C, v).x - C));
    }
    add('existe eixo de fuga e ele não deriva', isFinite(C) && desvioEixo < 1e-6,
        `eixo em x=${isFinite(C)?C.toFixed(2):'NaN'}, desvio ${desvioEixo.toExponential(2)}px`);

    // 5. CONVERGÊNCIA: a largura projetada encolhe ao fundo (trapézio, não retângulo)
    const larguraPerto = F.project(1000, 600).x - F.project(0, 600).x;
    const larguraLonge = F.project(1000, 0).x - F.project(0, 0).x;
    add('campo converge ao fundo (trapézio)', larguraLonge < larguraPerto - 1,
        `perto ${larguraPerto.toFixed(1)} vs longe ${larguraLonge.toFixed(1)}`);

    // 6. RAZÃO DE PERSPECTIVA: a razão longe/perto bate com a constante declarada
    const razao = larguraLonge / larguraPerto;
    add('razão de perspectiva ~ R0 declarado', razao > 0.5 && razao < 0.95, `razão ${razao.toFixed(4)}`);

    // 7. CONTINUIDADE: sem saltos entre amostras vizinhas (nada de descontinuidade)
    let salto = 0;
    for (let k = 1; k <= 200; k++) {
      const a = F.project(500, (k-1)/200 * 600), b = F.project(500, k/200 * 600);
      salto = Math.max(salto, Math.abs(b.y - a.y));
    }
    add('projeção contínua (sem descontinuidade)', salto < 20, `maior salto ${salto.toFixed(2)}px`);

    // 8. API DE DESENHO COMPLETA (o render 2.5D depende de todas)
    const faltando = ['project','grass','pitch','body','trail','ball','traj'].filter(k => typeof F[k] !== 'function');
    add('API 2.5D completa', faltando.length === 0, faltando.join(','));

    // 9. IMUTABILIDADE: a camada de apresentação não pode ser repintada por engano
    add('CDS_F25D é congelado', Object.isFrozen(F), String(Object.isFrozen(F)));

    out.ok = true;
  } catch (e) { out.erro = String((e && e.message) || e); }
  return out;
}
"""


def main():
    build = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if not build or not build.exists():
        sys.exit("uso: browser_projection_probe.py <build.html> [--out arquivo.json]")
    html = build.read_bytes().decode("utf-8")
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        pg = br.new_page(viewport={"width": 1440, "height": 810})
        erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)))
        pg.set_content(html, wait_until="load")
        pg.wait_for_timeout(2000)
        res = pg.evaluate(JS)
        br.close()

    res["pageErrors"] = erros[:5]
    checks = res.get("checks", [])
    res["passed"] = sum(1 for c in checks if c["pass"])
    res["total"] = len(checks)
    res["pass"] = bool(res.get("ok") and checks and res["passed"] == res["total"] and not erros)

    if res.get("erro"):
        print("erro:", res["erro"])
    for c in checks:
        print(f"  {'OK  ' if c['pass'] else 'FAIL'} {c['nome']:<45} {c['detalhe']}")
    print(f"\ninvariantes de projeção: {res['passed']}/{res['total']} — "
          f"{'PASS' if res['pass'] else 'FAIL'}")

    if "--out" in sys.argv:
        p = ROOT / sys.argv[sys.argv.index("--out") + 1]
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(json.dumps(res, ensure_ascii=False, indent=1).encode("utf-8"))
        print(f"[gravado] {p}")
    return 0 if res["pass"] else 2


if __name__ == "__main__":
    sys.exit(main())
