#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,subprocess,sys
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def call(cmd,timeout=600):
    return subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,timeout=timeout)

def valid_result(path:Path,expected:int)->bool:
    try:
        data=json.loads(path.read_text(encoding='utf-8'))
        return data.get('matches')==expected and isinstance(data.get('raw'),list) and len(data['raw'])==expected
    except Exception:return False

def main():
    ap=argparse.ArgumentParser(description='Executa uma matriz oficial em lotes persistentes e retomáveis.')
    ap.add_argument('jobs_file')
    ap.add_argument('--label',required=True)
    ap.add_argument('--output',required=True)
    ap.add_argument('--chunk-size',type=int,default=5)
    ap.add_argument('--parallel',type=int,default=4)
    ap.add_argument('--dt',type=float,default=1/60)
    args=ap.parse_args()
    jobs_path=Path(args.jobs_file).resolve();jobs=json.loads(jobs_path.read_text(encoding='utf-8'))
    work=ROOT/'reports'/'phase3'/f'_matrix_{args.label}';work.mkdir(parents=True,exist_ok=True)
    chunks=[]
    for n,start in enumerate(range(0,len(jobs),max(1,args.chunk_size))):
        chunk=jobs[start:start+args.chunk_size]
        jf=work/f'jobs_{n:04d}.json';rf=work/f'result_{n:04d}.json'
        jf.write_text(json.dumps(chunk,ensure_ascii=False,indent=2),encoding='utf-8')
        if not valid_result(rf,len(chunk)):chunks.append((n,jf,rf,len(chunk)))
    print(f'[MATRIX] {len(jobs)} partidas; {len(chunks)} lotes pendentes; {args.parallel} processos',flush=True)
    def run_one(item):
        n,jf,rf,count=item
        cp=call(['node','tools/lab.js',f'--jobsFile={jf}','--inProcess=true','--raw=true',f'--dt={args.dt}',f'--label={args.label}-chunk-{n}',f'--output={rf}'],timeout=900)
        return item,cp
    done=0
    with ThreadPoolExecutor(max_workers=max(1,args.parallel)) as pool:
        futures=[pool.submit(run_one,x) for x in chunks]
        for fut in as_completed(futures):
            item,cp=fut.result();n,jf,rf,count=item
            if cp.returncode or not valid_result(rf,count):
                print(f'ERRO no lote {n}\nSTDOUT:\n{cp.stdout}\nSTDERR:\n{cp.stderr}',file=sys.stderr)
                return 2
            done+=1;print(f'[MATRIX] lote {n:04d} concluído ({done}/{len(chunks)})',flush=True)
    output=Path(args.output).resolve();output.parent.mkdir(parents=True,exist_ok=True)
    cp=call(['node','tools/lab.js',f'--mergeDir={work}',f'--label={args.label}','--mode=official',f'--dt={args.dt}',f'--output={output}','--raw=true'],timeout=300)
    print(cp.stdout,end='')
    if cp.returncode:
        print(cp.stderr,file=sys.stderr);return cp.returncode
    final=json.loads(output.read_text(encoding='utf-8'))
    if final.get('matches')!=len(jobs):
        print(f'ERRO: merge retornou {final.get("matches")} de {len(jobs)} partidas',file=sys.stderr);return 3
    print(output)
    return 0

if __name__=='__main__':raise SystemExit(main())
