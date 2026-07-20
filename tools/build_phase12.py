#!/usr/bin/env python3
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'manifests/build-manifest.json').read_text(encoding='utf-8'))
template=(ROOT/'src/index.template.html').read_text(encoding='utf-8')
head=(ROOT/manifest['head_script']['file']).read_text(encoding='utf-8')
styles=''.join((ROOT/x['file']).read_text(encoding='utf-8') for x in manifest['styles'])
scripts=''.join((ROOT/x['file']).read_text(encoding='utf-8') for x in manifest['scripts'])
modules=[
 ROOT/'src/scripts/45-phases-4-to-7.js',
 ROOT/'src/scripts/46-phase8-goalkeepers-setpieces.js',
 ROOT/'src/scripts/47-phase9-manager-ai.js',
 ROOT/'src/scripts/48-save-contract.js',
 ROOT/'src/scripts/49-phase10-cup-persistence.js',
 ROOT/'src/scripts/51-phase11-draft-advisor.js',
 ROOT/'src/scripts/52-phase12-post-match-analysis.js',
]
needle=(ROOT/'src/scripts/50-tournament.js').read_text(encoding='utf-8')
insert_at=scripts.find(needle)
if insert_at<0: raise SystemExit('Ponto de integração antes do torneio não encontrado.')
injected='\n'.join(p.read_text(encoding='utf-8') for p in modules)+'\n'
scripts=scripts[:insert_at]+injected+scripts[insert_at:]
out=template.replace('/*__CDS_HEAD_BOOTSTRAP__*/',head).replace('/*__CDS_STYLES__*/',styles).replace('/*__CDS_MAIN_SCRIPTS__*/',scripts)
out=out.replace('<title>Copa dos Sonhos</title>','<title>Copa dos Sonhos — Fase 12 — Build 5.5.0</title>',1)
out=out.replace('Motor 3.0 · futebol simulado lance a lance','Motor 5.5.0 · análise pós-jogo explicável',1)
out='<!-- FASE 12 · ANÁLISE PÓS-JOGO · ENGINE 5.5.0 -->\n'+out
path=ROOT/'dist/COPA DOS SONHOS - FASE 12 - ANALISE POS-JOGO - V5.5.0.html'
path.parent.mkdir(parents=True,exist_ok=True);path.write_text(out,encoding='utf-8')
digest=hashlib.sha256(path.read_bytes()).hexdigest()
qa={
 'phase':12,'engineVersion':'5.5.0','parentEngine':'5.4.0','certifiedBase':'4.3.2','fixedStep':1/60,
 'build':str(path.relative_to(ROOT)),'bytes':path.stat().st_size,'sha256':digest,
 'features':[
  'data-driven-tactical-headlines','shot-map-from-real-events','gk-and-set-piece-breakdown',
  'corridor-and-depth-diagnostics','deterministic-analysis','no-generic-text'
 ],
 'modules':[{'file':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in modules]
}
(ROOT/'manifests/phase12-build.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(path);print('sha256:',digest);print('bytes:',path.stat().st_size)
