#!/usr/bin/env python3
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
manifest_path=ROOT/'manifests/build-manifest.json'
m=json.loads(manifest_path.read_text(encoding='utf-8'))
m['phase']=3
m['name']='Laboratório estatístico, passo fixo e calibração do motor 4.3'
m['parent_phase']=2
m['build_output']='dist/COPA DOS SONHOS - FASE 3 - MOTOR CALIBRADO.html'
m['qa_file']='manifests/phase3-qa.json'
m['calibration_report']='reports/phase3/validation214-v43.json'
m['mass_regression_report']='reports/phase3/regression3200-v432-3200.json'
m['notes']=[
 'HTML final continua autocontido.',
 'Laboratório oficial usa o passo fixo real de 1/60 s.',
 'Tentativas de desarme usam taxa temporal e cooldown apenas após tentativa real.',
 'Todos os estilos, inclusive a Retranca, foram validados por confrontos espelhados.',
 'Escanteios, conversão e bolas paradas foram calibrados pela matriz oficial.',
 'Matriz oficial possui checkpoint e retomada automática.',
 'Relatórios incluem intervalos de confiança, estilos, formações e viés de lado.',
 'Regressão massiva adicional executa 3.200 partidas no mesmo passo fixo.'
]
def info(rel):
 p=ROOT/rel;b=p.read_bytes();return {'file':rel,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
m['head_script']=info(m['head_script']['file'])
m['styles']=[info(x['file']) for x in m['styles']]
m['scripts']=[info(x['file']) for x in m['scripts']]
manifest_path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
official_path=ROOT/m['calibration_report'];mass_path=ROOT/m['mass_regression_report']
if not official_path.exists() or not mass_path.exists():
 raise SystemExit('Relatórios oficial e massivo precisam existir antes do fechamento da Fase 3')
official=json.loads(official_path.read_text(encoding='utf-8'))
mass=json.loads(mass_path.read_text(encoding='utf-8'))
metric_failures={k:v for k,v in official['calibration']['checks'].items() if v['status']!='ok'}
style_failures={k:v for k,v in official.get('styleExpectationChecks',{}).items() if v['status']!='ok'}
mass_metric_failures={k:v for k,v in mass['calibration']['checks'].items() if v['status']!='ok'}
mass_style_failures={k:v for k,v in mass.get('styleExpectationChecks',{}).items() if v['status']!='ok'}
qa={
 'phase':3,'complete':not metric_failures and not style_failures and not mass_metric_failures and not mass_style_failures and official.get('matches')==214 and mass.get('matches',0)>=3000,
 'engineVersion':official.get('engineVersion'),'fixedStep':official.get('dt'),
 'officialMatrix':{'report':m['calibration_report'],'matches':official.get('matches'),'score':official['calibration']['score'],'metricFailures':metric_failures,'styleFailures':style_failures,'sideBias':official.get('features',{}).get('sideBias',{})},
 'massRegression':{'report':m['mass_regression_report'],'matches':mass.get('matches'),'score':mass.get('calibration',{}).get('score'),'dt':mass.get('dt'),'metricFailures':mass_metric_failures,'styleFailures':mass_style_failures,'sideBias':mass.get('features',{}).get('sideBias',{})},
 'database':{'players':7739,'lineupsValidated':13284},
 'requiredTests':['phase3_determinism','phase3_fixed_step','phase3_job_matrix','phase3_regression_thresholds','phase3_mass_regression','phase2_engine_smoke']
}
(ROOT/m['qa_file']).write_text(json.dumps(qa,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(manifest_path)
