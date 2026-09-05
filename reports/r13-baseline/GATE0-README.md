# Gate 0 — Fundação e harness de regressão R13.0

Estabelece a base autoritativa e o harness de regressão **antes** de qualquer
reconciliação modular ou feature. Objetivo: nada de comportamento é alterado;
apenas se congela a verdade e se prova que ela é reproduzível aqui.

## Artefato autoritativo

- `dist/COPA DOS SONHOS - V5.9.3-R13.0 - FUTEBOL OBSERVAVEL E CADENCIADO.html`
- SHA-256: `363d9a915a732ae99a889dab05e7f01485d58b140d64e4778ad8d5825f9818a8`
- 13 scripts embutidos (1 bootstrap + 1 bundle base + 11 camadas injetadas).

## Harness (em `tools/r13/`)

| Runner | Papel |
|---|---|
| `static_smoke_r130.js` | parsing + compilação dos 13 scripts + 13 checagens estáticas |
| `test_r130_scenarios.js` | 25 cenários dirigidos (carrega o motor em VM) |
| `runner_observer_r130.js` | matriz de formações, matriz de estilos e amostra diversa (CSV) com o observador de futebol |
| `merge_matrix_r130.js`, `generate_manifest_r130.js` | agregação/manifesto |
| `r13_football_observer.js`, `inject_r13.js` | fonte da 11ª camada (referência para modularização em V-1) |
| `COPA_DOS_SONHOS_P0-6_R12.3_PARTIDAS.csv` | elencos/cenários da amostra diversa |

Como rodar (a partir de `tools/r13/`, pois os runners leem o CSV do CWD):

```bash
node static_smoke_r130.js "<HTML>" out-smoke.json
node test_r130_scenarios.js "<HTML>" out-cenarios.json
node runner_observer_r130.js --build="<HTML>" --start=0 --end=200 --out=out-diverse.json
node runner_observer_r130.js --build="<HTML>" --matrix=true --repeats=2 --out=out-formacoes.json
node runner_observer_r130.js --build="<HTML>" --styleMatrix=true --repeats=2 --out=out-estilos.json
```

## Baseline capturado (contra o HTML R13.0)

| Verificação | Resultado |
|---|---|
| Smoke estático | **13/13 PASS** (`smoke-baseline.json`) |
| Cenários dirigidos | **25/25 PASS** (`cenarios-baseline.json`), inclui determinismo |
| Amostra diversa (5) reproduz o pacote | **5/5 byte-idênticas** (`diverse-smoke5.json`) |

### Determinismo do ambiente — CONFIRMADO

As 5 primeiras partidas da amostra diversa geradas aqui são **byte-a-byte
idênticas** às do pacote (`R13.0_AUDITORIA_200_PARTIDAS_FINAL.json`): mesmos
seeds, placares, estatísticas por time e métricas do observador. Logo, este
ambiente reproduz a verdade R13.0 e pode gerar a referência-ouro sob demanda.

## Referência-ouro (versionada, compacta)

- `golden-diverse-200.json` — digest por partida das 200 diversas
  (seed, formações, estilos, placar, status canônico, stats-chave por time).
  `digest_sha256 = 5a2ff3501334876b…`
- `golden-matrix-formations-summary.json` — balanço das 578 partidas de formação.
- `golden-matrix-styles-summary.json` — balanço das 98 partidas de estilo.
- JSONs finais do pacote (pequenos): cenários, smoke, manifesto, resultado.

As matrizes brutas completas (formações 5,4 MB, estilos 0,9 MB, 200 partidas
1,85 MB) **não são versionadas** por serem regeneráveis deterministicamente a
partir do HTML R13.0 com os runners acima.

## Gate V-1 usará este baseline assim

1. Reconstruir o HTML pela build modular.
2. Rodar os mesmos runners contra o build modular.
3. Comparar: smoke 13/13, cenários 25/25, e digest das 200 diversas +
   summaries das matrizes **iguais** ao golden. Qualquer desvio autoritativo
   bloqueia o gate.
