# Gate V-1 — Reconciliação modular da R13.0

**Estratégia autorizada:** A — o HTML R13.0 é a fonte de verdade. A árvore
`src/r13/` é um recorte fiel do artefato autoritativo e a build modular o
reproduz **byte-a-byte**.

## Resultado

| Prova | Evidência |
|---|---|
| Rebuild modular == R13.0 | SHA-256 `363d9a91…9818a8` idêntico; `cmp` byte-a-byte OK |
| HTML autoritativo inalterado | `git status` limpo após `build_r13.py` no caminho canônico |
| Sintaxe de todos os módulos | `node --check` OK em 13 scripts |
| Smoke estático | 13/13 PASS (sobre build-a-partir-do-src) |
| Cenários dirigidos | 25/25 PASS |
| Comportamento (amostra diversa 0–40) | 40/40 fingerprints idênticos ao golden R13 |
| Verificador dedicado | `python3 tools/verify_r13.py` → `VERIFY R13 MODULAR: OK` |

A byte-identidade é a forma mais forte de equivalência: garante, por
construção, que **nenhuma melhoria da R13.0 foi perdida** e que a cadência,
o equilíbrio e as métricas auditadas permanecem exatamente os mesmos.

## O que foi feito

O HTML R13.0 foi fatiado por um tokenizer linear (não escaneia dentro de
blocos; round-trip verificado) em 14 blocos reais → módulos em `src/r13/`:

| Módulo | Origem no HTML | Papel |
|---|---|---|
| `scripts/00-head-bootstrap.js` | `<script>` inicial | boot mobile/charset |
| `styles/00-bundle.css` | `<style>` único (316 KB) | todo o CSS (será fatiado no Gate UX) |
| `scripts/10-base-bundle.js` | bundle base (1,14 MB) | motor + dados + UI base (engine ~5.7.3) |
| `scripts/20-physics-timeline.js` | `cds-physics-timeline-581` | linha do tempo física |
| `scripts/21-p04-physical-reception.js` | `cds-p04-physical-reception-584-r6` | recepção física |
| `scripts/22-2_5d-gate-a-contracts.js` | `cds-2_5d-gate-a-contracts-v02` | **contratos 2.5D (Gate A) já existentes** |
| `scripts/23-pre25d-runtime-auditor.js` | `cds-pre25d-runtime-auditor-v04` | auditor de runtime pré-2.5D |
| `scripts/24-pre25d-build-meta.js` | `cds-pre25d-build-meta-584-r6` | metadados de build |
| `scripts/25-r7-pass-flow-calibration.js` | `cds-r7-pass-flow-calibration` | calibração de passe R7 |
| `scripts/26-r9-pass-natural-calibration.js` | `cds-r9-pass-natural-calibration` | calibração de passe R9 |
| `scripts/27-r10-engine-closure.js` | `cds-r10-engine-closure` | fechamento de motor R10 |
| `scripts/28-r109-async-cup.js` | `cds-r109-async-cup` | copa assíncrona R10.9 |
| `scripts/29-r12-transactional-core.js` | `cds-r12-transactional-core-r123` | núcleo transacional R12.3 |
| `scripts/30-r13-football-observer.js` | `cds-r13-football-observer-cadence` | observador/cadência R13 |

**A ordem dos blocos é contrato** (`manifests/r13-build-manifest.json`): as
camadas fazem monkey-patch sobre o bundle base na ordem do documento; alterar a
ordem muda o comportamento.

## Ferramentas

- `tools/extract_r13.py` — regenera `src/r13/` a partir do HTML autoritativo.
- `tools/build_r13.py` — reconcatena `src/r13/` → HTML (checa SHA).
- `tools/verify_r13.py` — verificação completa do gate.

## Fronteira honesta: o que V-1 **não** fez (V-1b, adiado)

O bundle base e as 11 camadas continuam como blocos ordenados (injeção tardia
preservada). A byte-identidade exige isso. A "eliminação da injeção tardia"
(dobrar cada override no módulo dono, com prova **comportamental** a cada passo,
já que a byte-identidade quebra) é refinamento arquitetural incremental,
**não pré-requisito** do 2.5D/UX, e será feito de forma segura e faseada. O
objetivo primário do handoff — portar a R13.0 para módulos e comprovar
equivalência sem perder melhorias — está cumprido.

## Regeneração / reprodução

```bash
python3 tools/extract_r13.py     # HTML autoritativo -> src/r13/ (idempotente)
python3 tools/build_r13.py       # src/r13/ -> HTML (byte-idêntico)
python3 tools/verify_r13.py      # verificação completa do gate
```
