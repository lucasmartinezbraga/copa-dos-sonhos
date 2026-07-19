#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,json,math
from pathlib import Path

PT={
'goalsPerMatch':'Gols por partida','shotsPerMatch':'Chutes por partida','xgPerMatch':'xG por partida','onTargetRate':'Chutes no alvo','passCompletion':'Precisão de passe','foulsPerMatch':'Faltas por partida','yellowsPerMatch':'Amarelos por partida','redsPerMatch':'Vermelhos por partida','cornersPerMatch':'Escanteios por partida','drawRate':'Empates','zeroZeroRate':'Jogos 0–0','blowoutRate':'Goleadas (4+ de diferença)','lateGoalShare':'Gols após 75 min','setPieceGoalShare':'Gols de bola parada','favoriteWinRate':'Vitórias do favorito','paritySideAWinShare':'Vitórias do lado A na matriz espelhada','averageEndingStamina':'Fôlego final médio'}
PCT={'onTargetRate','passCompletion','drawRate','zeroZeroRate','blowoutRate','lateGoalShare','setPieceGoalShare','favoriteWinRate','paritySideAWinShare'}

def fmt(k,v):
    if v is None:return '—'
    return f'{v*100:.1f}%' if k in PCT else f'{v:.2f}'

def main():
    ap=argparse.ArgumentParser();ap.add_argument('report');ap.add_argument('--out-dir',required=True);ap.add_argument('--title',default='Fase 3 — Laboratório e calibração')
    a=ap.parse_args();r=json.loads(Path(a.report).read_text(encoding='utf-8'));out=Path(a.out_dir);out.mkdir(parents=True,exist_ok=True)
    checks=r['calibration']['checks'];unc=r.get('uncertainty',{});lines=[f'# {a.title}','',f'- Motor: **{r["engineVersion"]}**',f'- Partidas válidas: **{r["matches"]}**',f'- Passo canônico: **{r["dt"]:.8f}s (60 Hz)**',f'- Nota de calibração: **{r["calibration"]["score"]:.1f}/100**','', '## Métricas gerais','', '| Métrica | Resultado | Faixa | IC 95% | Estado |','|---|---:|---:|---:|---|']
    for k,c in checks.items():
        ci='—';source=(unc.get('means',{}).get(k) or unc.get('rates',{}).get(k))
        if source:ci=f'{fmt(k,source["low"])}–{fmt(k,source["high"])}'
        state={'ok':'OK','low':'BAIXO','high':'ALTO'}.get(c['status'],c['status'])
        lines.append(f'| {PT.get(k,k)} | {fmt(k,c["value"])} | {fmt(k,c["min"])}–{fmt(k,c["max"])} | {ci} | {state} |')
    sb=r.get('features',{}).get('sideBias',{});lines += ['', '## Controle de viés de lado','',f'- Jogos decisivos: **{sb.get("decisiveGames",0)}**',f'- Vitórias do lado A entre jogos decisivos: **{sb.get("sideAWinShare",0)*100:.1f}%**',f'- Posse média do lado A: **{sb.get("averagePossessionA",0)*100:.1f}%**',f'- Diferença média de gols do lado A: **{sb.get("averageGoalDeltaA",0):+.3f}**',f'- Diferença média de xG do lado A: **{sb.get("averageXgDeltaA",0):+.3f}**']
    lines += ['', '## Estilos', '', '| Estilo | Jogos | Vitórias | Δ gols | Δ xG | Δ posse | Δ passe | Δ cruz. | Δ bolas profundas | Δ pressão | Δ fôlego |','|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
    for k,v in r.get('features',{}).get('styles',{}).items():lines.append(f'| {k} | {v.get("games",0)} | {v.get("winRate",0)*100:.1f}% | {v.get("goalDelta",0):+.2f} | {v.get("xgDelta",0):+.2f} | {v.get("possessionDelta",0)*100:+.1f} pp | {v.get("passCompletionDelta",0)*100:+.1f} pp | {v.get("crossDelta",0):+.2f} | {v.get("throughBallDelta",0):+.2f} | {v.get("pressWinsDelta",0):+.2f} | {v.get("staminaDelta",0):+.2f} |')
    lines += ['', '## Formações contra 4-3-3', '', '| Formação | Jogos | Vitórias | Empates | Δ gols | Δ xG | Δ chutes | Δ posse |','|---|---:|---:|---:|---:|---:|---:|---:|']
    formations=r.get('features',{}).get('formations',{})
    for k,v in formations.items():lines.append(f'| {k} | {v.get("games",0)} | {v.get("winRate",0)*100:.1f}% | {v.get("drawRate",0)*100:.1f}% | {v.get("goalDelta",0):+.2f} | {v.get("xgDelta",0):+.2f} | {v.get("shotDelta",0):+.2f} | {v.get("possessionDelta",0)*100:+.1f} pp |')
    lines += ['', '## Critério de leitura','', '- As médias são acompanhadas por intervalos de confiança sempre que possível.', '- Resultados de estilo usam confrontos espelhados contra o mesmo elenco em estilo equilibrado.', '- Resultados de formação usam confrontos espelhados contra o 4-3-3.', '- Uma formação não deve ser classificada como superior ou inferior por apenas dois jogos; estes dados servem principalmente para detectar efeitos extremos e regressões.', '- A simulação usa exatamente o passo fixo do navegador. Passos maiores são bloqueados no laboratório oficial.']
    (out/'FASE_3_RELATORIO.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    with (out/'FASE_3_FORMACOES.csv').open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.writer(f,lineterminator='\n');w.writerow(['formacao','jogos','vitorias','empates','delta_gols','delta_xg','delta_chutes','delta_posse'])
        for k,v in formations.items():w.writerow([k,v.get('games'),v.get('winRate'),v.get('drawRate'),v.get('goalDelta'),v.get('xgDelta'),v.get('shotDelta'),v.get('possessionDelta')])
    styles=r.get('features',{}).get('styles',{})
    with (out/'FASE_3_ESTILOS.csv').open('w',newline='',encoding='utf-8-sig') as f:
        fields=['games','winRate','goalDelta','xgDelta','possessionDelta','passCompletionDelta','crossDelta','throughBallDelta','pressWinsDelta','staminaDelta'];w=csv.writer(f,lineterminator='\n');w.writerow(['estilo','jogos',*fields[1:]])
        for k,v in styles.items():w.writerow([k]+[v.get(x) for x in fields])
    print(out/'FASE_3_RELATORIO.md')
if __name__=='__main__':main()
