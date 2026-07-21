# src/r13 — fonte modular da candidata autoritativa R13.0

Recorte fiel do HTML `dist/COPA DOS SONHOS - V5.9.3-R13.0 …`. A build modular o
reproduz **byte-a-byte** (SHA `363d9a91…9818a8`).

## Build e verificação

```bash
python3 tools/build_r13.py     # src/r13/ -> HTML autocontido (checa SHA)
python3 tools/verify_r13.py    # integridade + byte-identidade + smoke + cenários
python3 tools/extract_r13.py   # HTML autoritativo -> src/r13/ (regenera; idempotente)
```

## Estrutura

- `index.template.html` — casca HTML com placeholders `/*__CDS_R13_BLOCK_N__*/`.
- `scripts/00-head-bootstrap.js` — boot mobile/charset.
- `styles/00-bundle.css` — todo o CSS (será fatiado no Gate UX).
- `scripts/10-base-bundle.js` — motor + dados + UI base (engine ~5.7.3).
- `scripts/20..30-*.js` — 11 camadas ordenadas (physics → R13 observer).

## Contrato de ordem

`manifests/r13-build-manifest.json` define a ordem dos blocos. As camadas
`20..30` fazem monkey-patch sobre o `10-base-bundle` na ordem do documento.
**Não reordene sem revalidar** (`verify_r13.py`) — a ordem é comportamento.

## Como editar com segurança

1. Edite o módulo dono (ex.: um override de cadência vive em `30-r13-…`).
2. `python3 tools/build_r13.py` — se o objetivo é **preservar** comportamento,
   a byte-identidade deve se manter (só some se você mudou algo de propósito).
3. Ao mudar de propósito, a byte-identidade quebra: prove **equivalência
   comportamental** com os runners de `tools/r13/` contra o golden e atualize
   o manifesto (bytes/sha) conscientemente.
4. `python3 tools/verify_r13.py` antes de commit.
