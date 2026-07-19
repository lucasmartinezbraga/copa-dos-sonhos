#!/usr/bin/env python3
from pathlib import Path
import hashlib, json
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'manifests/build-manifest.json').read_text(encoding='utf-8'))
template=(ROOT/'src/index.template.html').read_text(encoding='utf-8')
head=(ROOT/manifest['head_script']['file']).read_text(encoding='utf-8')
styles=''.join((ROOT/x['file']).read_text(encoding='utf-8') for x in manifest['styles'])
scripts=''.join((ROOT/x['file']).read_text(encoding='utf-8') for x in manifest['scripts'])
phase47=(ROOT/'src/scripts/45-phases-4-to-7.js').read_text(encoding='utf-8')
# A camada precisa entrar depois do MatchSim (40) e antes do runtime (70).
needle=(ROOT/'src/scripts/50-tournament.js').read_text(encoding='utf-8')
insert_at=scripts.find(needle)
if insert_at < 0:
    raise SystemExit('Não foi possível localizar o ponto de integração antes do torneio.')
scripts=scripts[:insert_at]+phase47+'\n'+scripts[insert_at:]
out=template.replace('/*__CDS_HEAD_BOOTSTRAP__*/',head).replace('/*__CDS_STYLES__*/',styles).replace('/*__CDS_MAIN_SCRIPTS__*/',scripts)
out=out.replace('<title>Copa dos Sonhos</title>','<title>Copa dos Sonhos — Build Final 5.0.0</title>',1)
out=out.replace('Motor 3.0 · futebol simulado lance a lance','Motor 5.0 · decisões, funções e movimentação coletiva',1)
out='<!-- BUILD FINAL FASES 4–7 · ENGINE 5.0.0 -->\n'+out
path=ROOT/'dist/COPA DOS SONHOS - BUILD FINAL FASES 4 A 7 - V5.0.0.html'
path.parent.mkdir(parents=True,exist_ok=True)
path.write_text(out,encoding='utf-8')
digest=hashlib.sha256(path.read_bytes()).hexdigest()
qa={'phaseRange':[4,7],'engineVersion':'5.0.0','parentEngine':'4.3.2','fixedStep':1/60,'build':str(path.relative_to(ROOT)),'bytes':path.stat().st_size,'sha256':digest,'features':['contextual-decisions','dual-phase-roles','phase-instructions','tactical-coherence','five-corridors','anti-clumping','overlap-underlap','advanced-metrics']}
(ROOT/'manifests/phase47-build.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(path)
print('sha256:',digest)
