#!/usr/bin/env python3
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
m=json.loads((ROOT/'manifests/build-manifest.json').read_text(encoding='utf-8'))
t=(ROOT/'src/index.template.html').read_text(encoding='utf-8')
h=(ROOT/m['head_script']['file']).read_text(encoding='utf-8')
c=''.join((ROOT/x['file']).read_text(encoding='utf-8') for x in m['styles'])
j=''.join((ROOT/x['file']).read_text(encoding='utf-8') for x in m['scripts'])
out=t.replace('/*__CDS_HEAD_BOOTSTRAP__*/',h).replace('/*__CDS_STYLES__*/',c).replace('/*__CDS_MAIN_SCRIPTS__*/',j)
p=ROOT/m['build_output'];p.parent.mkdir(parents=True,exist_ok=True);p.write_text(out,encoding='utf-8')
print(p);print('sha256:',hashlib.sha256(p.read_bytes()).hexdigest())
