#!/usr/bin/env python3
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'src/index.dev.html').read_text(encoding='utf-8')
script_files = sorted((ROOT / 'src/scripts').glob('*.js'))
style_files = sorted((ROOT / 'src/styles').glob('*.css'))

for path in script_files:
    ref = f'scripts/{path.name}'
    if ref not in html:
        raise SystemExit(f'ERRO: referência ausente no index.dev.html: {ref}')
    subprocess.run(['node', '--check', str(path)], check=True)

for path in style_files:
    ref = f'styles/{path.name}'
    if ref not in html:
        raise SystemExit(f'ERRO: referência ausente no index.dev.html: {ref}')

if '__CDS_' in html:
    raise SystemExit('ERRO: placeholder de build permaneceu no index.dev.html')

print(f'OK: {len(script_files)} scripts externos referenciados e sintaticamente válidos')
print(f'OK: {len(style_files)} folhas CSS externas referenciadas')
