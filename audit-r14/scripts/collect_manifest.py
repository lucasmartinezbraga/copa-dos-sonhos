#!/usr/bin/env python3
from common import *
import sys, os, platform
root,cfg=load_config(); candidate=root/cfg['candidate']
if len(sys.argv)>1: candidate=Path(sys.argv[1]).resolve()
obj={'audit_version':cfg['audit_version'],'candidate':str(candidate),'name':candidate.name,'bytes':candidate.stat().st_size,'sha256':sha256(candidate),'collected_at':utcnow(),'platform':platform.platform(),'python':platform.python_version()}
write_json(root/'evidence'/'candidate-manifest.json',obj); print(json.dumps(obj,ensure_ascii=False,indent=2))
