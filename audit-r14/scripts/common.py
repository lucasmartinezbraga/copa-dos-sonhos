from pathlib import Path
import json, hashlib, datetime, os

def root_from_script(): return Path(__file__).resolve().parents[1]
def load_config():
    root=root_from_script(); return root, json.load(open(root/'config'/'audit.config.json',encoding='utf-8'))
def sha256(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()
def utcnow(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def write_json(path,obj):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    json.dump(obj,open(path,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
