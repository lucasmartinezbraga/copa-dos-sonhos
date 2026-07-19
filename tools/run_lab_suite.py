#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, os, shutil, subprocess, sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def run(cmd:list[str],timeout:int=900)->subprocess.CompletedProcess:
    return subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,timeout=timeout,check=False)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--matches',type=int,default=300)
    ap.add_argument('--chunk-size',type=int,default=5)
    ap.add_argument('--parallel',type=int,default=2)
    ap.add_argument('--dt',type=float,default=.08)
    ap.add_argument('--label',default='phase3')
    ap.add_argument('--mode',default='full')
    args=ap.parse_args()
    work=ROOT/'reports'/'phase3'/f'_chunks_{args.label}'
    if work.exists(): shutil.rmtree(work)
    work.mkdir(parents=True)
    jobs_file=work/'jobs.json'
    gen=run(['node','tools/lab.js',f'--mode={args.mode}',f'--matches={args.matches}',f'--dumpJobs={jobs_file}','--generateOnly=true',f'--dt={args.dt}'],120)
    if gen.returncode:
        print(gen.stderr,file=sys.stderr);return gen.returncode
    jobs=json.loads(jobs_file.read_text())
    chunks=[]
    for i in range(0,len(jobs),args.chunk_size):
        cf=work/f'jobs_{i//args.chunk_size:04d}.json'
        cf.write_text(json.dumps(jobs[i:i+args.chunk_size],ensure_ascii=False),encoding='utf-8')
        out=work/f'result_{i//args.chunk_size:04d}.json'
        chunks.append((cf,out))
    def execute(pair):
        cf,out=pair
        cp=run(['node','tools/lab.js',f'--jobsFile={cf}','--inProcess=true','--raw=true',f'--dt={args.dt}',f'--label={args.label}',f'--output={out}'],300)
        return cf,out,cp
    completed=0
    with ThreadPoolExecutor(max_workers=max(1,args.parallel)) as ex:
        futs=[ex.submit(execute,p) for p in chunks]
        for fut in as_completed(futs):
            cf,out,cp=fut.result();completed+=1
            if cp.returncode:
                print(f'Falhou {cf.name}:\n{cp.stderr}',file=sys.stderr);return cp.returncode
            print(f'[{completed}/{len(chunks)}] {cf.name}',flush=True)
    final=ROOT/'reports'/'phase3'/f'{args.label}-{args.matches}.json'
    merge=run(['node','tools/lab.js',f'--mergeDir={work}',f'--label={args.label}',f'--mode={args.mode}',f'--dt={args.dt}',f'--output={final}'],180)
    print(merge.stdout)
    if merge.returncode:
        print(merge.stderr,file=sys.stderr);return merge.returncode
    print(final)
    return 0
if __name__=='__main__': raise SystemExit(main())
