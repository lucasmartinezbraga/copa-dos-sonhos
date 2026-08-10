#!/usr/bin/env python3
"""Extrai o corpo de TODA sobrescrita de MatchSim.prototype e agrupa POR METODO.

Ler as camadas arquivo a arquivo nao mostra o problema. Ler as 22 versoes de
`step` juntas mostra: sao quatro sistemas diferentes (corretivo de bug do core,
cerimonia de bola parada, apresentacao, futebol) misturados num cano so.

  python3 tools/fisica/agrupar.py [saida/]     # default: /tmp/cds-leitura
"""
import re, sys, json, pathlib, collections

RAIZ = pathlib.Path(__file__).resolve().parents[2]
SAIDA = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/cds-leitura')
SAIDA.mkdir(parents=True, exist_ok=True)

PAD = re.compile(r'\b(?:P|proto|MP|Pr|M\.prototype|MatchSim\.prototype)\s*\.\s*(_?\w+)\s*=\s*function[^{]*\{')

def corpo(t, i):
    d = 0
    for j in range(i, len(t)):
        if t[j] == '{': d += 1
        elif t[j] == '}':
            d -= 1
            if d == 0: return j
    return len(t) - 1

por = collections.defaultdict(list)
for f in sorted((RAIZ / 'src/scripts/layers').glob('*.js')):
    t = f.read_text(encoding='utf-8', errors='replace')
    for m in PAD.finditer(t):
        j = corpo(t, m.end() - 1)
        por[m.group(1)].append((f.name, t[:m.start()].count('\n') + 1, t[m.start():j + 1]))

# estado medido pela pilha.js, se disponivel
est = {}
p = RAIZ / 'reports/pilha-estado.json'
if p.exists():
    for e in json.loads(p.read_text()):
        est[(e['bloco'], e['metodo'])] = e['estado']

resumo = []
for nome, lista in sorted(por.items(), key=lambda kv: -len(kv[1])):
    linhas = sum(c.count('\n') + 1 for _, _, c in lista)
    resumo.append((nome, len(lista), linhas))
    partes = [f"/* ===== {nome} — {len(lista)} sobrescritas, {linhas} linhas ===== */\n"]
    for arq, li, c in lista:
        partes.append(f"\n/* ---------- {arq}:{li} ---------- */\n{c}\n")
    (SAIDA / f"{nome}.js").write_text(''.join(partes))

print(f"{len(por)} metodos, {sum(x[1] for x in resumo)} sobrescritas, "
      f"{sum(x[2] for x in resumo)} linhas -> {SAIDA}")
for n, c, l in resumo[:12]:
    print(f"  {n:<26}{c:>4}{l:>7}")
