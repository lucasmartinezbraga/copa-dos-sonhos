#!/usr/bin/env python3
from common import *
import argparse, json, sys
ap=argparse.ArgumentParser(); ap.add_argument('id'); ap.add_argument('result',choices=['PASS','FAIL','BLOCKED','N/A']); ap.add_argument('--evidence',action='append',default=[]); ap.add_argument('--notes',default=''); ap.add_argument('--bug-or-commit',default=''); args=ap.parse_args()
root,cfg=load_config(); matrix=json.load(open(root/cfg['matrix'],encoding='utf-8')); item=next((i for i in matrix['items'] if i['id']==args.id),None)
if not item: print('ID não encontrado:',args.id); sys.exit(2)
obj={'id':args.id,'candidate_sha256':sha256(root/cfg['candidate']),'result':args.result,'executed_at':utcnow(),'environment':{},'evidence':args.evidence,'metrics':{},'notes':args.notes,'bug_or_commit':args.bug_or_commit}
write_json(root/item['evidence_path']/'resultado.json',obj); print(json.dumps(obj,ensure_ascii=False,indent=2))
