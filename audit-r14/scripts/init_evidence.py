#!/usr/bin/env python3
from common import *
root,cfg=load_config(); matrix=json.load(open(root/cfg['matrix'],encoding='utf-8'))
for item in matrix['items']:
    d=root/item['evidence_path']; d.mkdir(parents=True,exist_ok=True)
    meta=d/'resultado.json'
    if not meta.exists():
        write_json(meta,{'id':item['id'],'candidate_sha256':'PREENCHER','result':'BLOCKED','executed_at':'','environment':{},'evidence':[],'metrics':{},'notes':'Aguardando execução','bug_or_commit':''})
print(f"Criadas/verificadas {len(matrix['items'])} pastas de evidência.")
