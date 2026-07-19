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
m['notes']=[
 'HTML final continua autocontido.',
 'Laboratório oficial usa o passo fixo real de 1/60 s.',
 'Tentativas de desarme usam taxa temporal e cooldown apenas após tentativa real.',
 'Presets Tiki-Taka, Contra-Ataque e Retranca foram recalibrados por confrontos espelhados.',
 'Bolas paradas aéreas receberam ajuste leve após validação estatística.',
 'Matriz oficial possui checkpoint e retomada automática.',
 'Relatórios incluem intervalos de confiança, estilos, formações e viés de lado.'
]
def info(rel):
 p=ROOT/rel;b=p.read_bytes();return {'file':rel,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
m['head_script']=info(m['head_script']['file'])
m['styles']=[info(x['file']) for x in m['styles']]
m['scripts']=[info(x['file']) for x in m['scripts']]
manifest_path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(manifest_path)
