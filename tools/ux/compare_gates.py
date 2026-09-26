#!/usr/bin/env python3
"""
Auditoria de gates — compara a bateria completa do candidato com o baseline
oficial R13.0, usando a MESMA tabela de gates da auditoria "futebol humano".

Uso: python3 tools/ux/compare_gates.py <dir-da-bateria> [--out arquivo.md]
Espera: MATRIZ_FORMACOES_RCUX.json, styles.json, DIVERSAS_RCUX.json,
        cenarios.json, smoke.json
Golden: reports/r13-baseline/golden-*.json (resultados oficiais da R13.0)
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
IND = Path(sys.argv[1])
OUT = ROOT / sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None

def load(p):
    p = Path(p)
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else None

form = load(IND / 'MATRIZ_FORMACOES_RCUX.json')
sty  = load(IND / 'styles.json')
div  = load(IND / 'DIVERSAS_RCUX.json')
cen  = load(IND / 'cenarios.json')
smk  = load(IND / 'smoke.json')
gold_form = load(ROOT / 'reports/r13-baseline/golden-matrix-formations-summary.json')
gold_sty  = load(ROOT / 'reports/r13-baseline/golden-matrix-styles-summary.json')
gold_div  = load(ROOT / 'reports/r13-baseline/golden-diverse-200.json')

fmt = lambda x, nd=3: (f"{x:.{nd}f}").replace('.', ',')
lines = ["| Gate | Limite | R13.0 oficial | Candidato | Veredito |",
         "|---|---:|---:|---:|:--:|"]
allok = True
def row(gate, limit, official, value, ok):
    global allok
    allok &= ok
    lines.append(f"| {gate} | {limit} | {official} | {value} | {'PASS' if ok else '**FAIL**'} |")

# ── canônicas
tot = cons = 0
for src in (form, sty, div):
    if not src: continue
    s = src.get('summary', {})
    tot += s.get('matches', 0)
    cons += s.get('canonicalStatuses', {}).get('CONSISTENT', 0)
row('Partidas canônicas', '100% CONSISTENT', '876/876', f'{cons}/{tot}', cons == tot and tot == 876)

# ── formações
if form:
    g = (form.get('matrix') or {}).get('gates') or {}
    og = ((gold_form or {}).get('matrix') or {}).get('gates') or {}
    fl = (form.get('matrix') or {}).get('formations') or []
    row('Formações cobertas', '17/17', '17/17', f"{len(fl)}/17", len(fl) == 17)
    row('Faixa de PPG entre formações', '≤ 0,65', fmt(og.get('ppgRange', 0)), fmt(g.get('ppgRange', 9)), g.get('ppgRange', 9) <= 0.65)
    row('Maior |saldo| por formação', '≤ 0,55', fmt(og.get('maxAbsGoalDiffPerMatch', 0)), fmt(g.get('maxAbsGoalDiffPerMatch', 9)), g.get('maxAbsGoalDiffPerMatch', 9) <= 0.55)
    h = (form.get('summary') or {}).get('humanObserver') or {}
    oh = ((gold_form or {}).get('summary') or {}).get('humanObserver') or {}
    row('Ameaças descobertas (neutra)', '≤ 30%', fmt(oh.get('uncoveredThreatRate', 0)*100, 2)+'%', fmt(h.get('uncoveredThreatRate', 1)*100, 2)+'%', h.get('uncoveredThreatRate', 1) <= .30)
    row('Defesa do lado do gol', '≥ 70%', fmt(oh.get('goalSideCoverageRate', 0)*100, 2)+'%', fmt(h.get('goalSideCoverageRate', 0)*100, 2)+'%', h.get('goalSideCoverageRate', 0) >= .70)
    row('Distância média de referência', '≤ 8 m', fmt(oh.get('markerMeanDistance', 0), 2)+' m', fmt(h.get('markerMeanDistance', 99), 2)+' m', h.get('markerMeanDistance', 99) <= 8)
    row('Linhas desconectadas', '≤ 20%', fmt(oh.get('disconnectedLineRate', 0)*100, 2)+'%', fmt(h.get('disconnectedLineRate', 1)*100, 2)+'%', h.get('disconnectedLineRate', 1) <= .20)
    row('Bola/corpo divergentes', '≤ 8%', fmt(oh.get('bodyOrientationMismatchRate', 0)*100, 2)+'%', fmt(h.get('bodyOrientationMismatchRate', 1)*100, 2)+'%', h.get('bodyOrientationMismatchRate', 1) <= .08)
    sp = (form.get('summary') or {}).get('setPieces') or {}
    osp = ((gold_form or {}).get('summary') or {}).get('setPieces') or {}
    if 'cornerGoalShare' in sp:
        row('Gols de corner (neutra)', '2%–18%', fmt(osp.get('cornerGoalShare', 0)*100, 2)+'%', fmt(sp['cornerGoalShare']*100, 2)+'%', .02 <= sp['cornerGoalShare'] <= .18)

# ── estilos
if sty:
    g = (sty.get('matrix') or {}).get('gates') or {}
    og = ((gold_sty or {}).get('matrix') or {}).get('gates') or {}
    sl = (sty.get('matrix') or {}).get('styles') or []
    row('Estilos cobertos', '7/7', '7/7', f"{len(sl)}/7", len(sl) == 7)
    row('Faixa de PPG entre estilos', '≤ 0,75', fmt(og.get('ppgRange', 0)), fmt(g.get('ppgRange', 9)), g.get('ppgRange', 9) <= .75)
    row('Maior |saldo| por estilo', '≤ 0,65', fmt(og.get('maxAbsGoalDiffPerMatch', 0)), fmt(g.get('maxAbsGoalDiffPerMatch', 9)), g.get('maxAbsGoalDiffPerMatch', 9) <= .65)

# ── diversas
if div:
    pm = (div.get('summary') or {}).get('perMatch') or {}
    row('Laterais na amostra diversa', '5–16', '7,075', fmt(pm.get('throwIns', 0), 3), 5 <= pm.get('throwIns', 0) <= 16)
    row('Impedimentos na amostra diversa', '0,5–4', '0,805', fmt(pm.get('offsides', 0), 3), .5 <= pm.get('offsides', 0) <= 4)

# ── cenários + smoke
if cen: row('Cenários dirigidos', '25/25', '25/25', f"{cen.get('passed')}/{cen.get('total')}", cen.get('passed') == cen.get('total') == 25)
if smk: row('Smoke estático/sintático', '13/13', '13/13', f"{smk.get('passed')}/{smk.get('total')}", smk.get('passed') == smk.get('total') == 13)

# ── determinismo: igualdade byte-nível com o golden (200 diversas)
if div and gold_div:
    def dig(r):
        st = r.get('stats') or []
        def team(i):
            s = st[i] if i < len(st) else {}
            return {k: s.get(k) for k in ('goals','shots','onTarget','passes','passOk','corners','offsides','throwIns','goalKicks','fouls','tackles','interceptions') if k in s}
        return {'index': r.get('index'), 'seed': r.get('seed'), 'formations': r.get('formations'),
                'styles': r.get('styles'), 'score': r.get('score'),
                'canonicalStatus': r.get('canonicalStatus'), 'teams': [team(0), team(1)]}
    res = sorted(div.get('results', []), key=lambda r: r.get('index', 0))
    eq = sum(1 for i in range(min(len(res), 200))
             if json.dumps(dig(res[i]), sort_keys=True) == json.dumps(gold_div['matches'][i], sort_keys=True))
    row('Determinismo vs golden R13 (200 diversas)', '200/200', '—', f'{eq}/200', eq == 200)

# ── igualdade dos gates das matrizes com o oficial (dígito a dígito)
if form and gold_form:
    eqf = (form.get('matrix') or {}).get('gates') == ((gold_form or {}).get('matrix') or {}).get('gates')
    row('Gates de formações ≡ oficiais', 'idênticos', '—', 'idênticos' if eqf else 'DIFEREM', eqf)
if sty and gold_sty:
    eqs = (sty.get('matrix') or {}).get('gates') == ((gold_sty or {}).get('matrix') or {}).get('gates')
    row('Gates de estilos ≡ oficiais', 'idênticos', '—', 'idênticos' if eqs else 'DIFEREM', eqs)

print('\n'.join(lines))
print(f"\nVEREDITO GERAL: {'TODOS OS GATES PASS' if allok else 'HÁ FAIL'}")
if OUT:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
sys.exit(0 if allok else 1)
