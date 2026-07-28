# R18.21-RC1 — Defesa, Pressão e Ecologia

Candidata construída sobre a **R18.20 — Inteligência de Chance**, seguindo o handoff
`COPA_DOS_SONHOS_HANDOFF_CLAUDE_R18.20`.

| | |
|---|---|
| Base | `COPA DOS SONHOS - R18.20 - INTELIGENCIA DE CHANCE.html` |
| SHA-256 da base | `11ab3fc32609f1a4cd87ea75437e27ce8ad491a4c8849c4c686f7c0a07314805` |
| Candidata | `dist/COPA DOS SONHOS - R18.21-RC1 - DEFESA PRESSAO E ECOLOGIA.html` |
| SHA-256 da candidata | `bf9bd6ec96bb8c4dbd0b9f43d7424174fa2b0b97955972a0c74f4f3330b57a88` |
| Status | **CANDIDATA — NECESSITA AJUSTES** |

A base **não foi alterada**. O construtor `tools/r1821/build_rc1.js` aborta se o SHA-256
da base não bater, e regenera a candidata do zero a cada execução.

```bash
node tools/r1821/build_rc1.js \
  --base="COPA DOS SONHOS - R18.20 - INTELIGENCIA DE CHANCE.html" \
  --out="dist/COPA DOS SONHOS - R18.21-RC1 - DEFESA PRESSAO E ECOLOGIA.html" \
  --layers=tools/r1821/layers
```

## O que mudou

**Remoção da camada `cds-r1819-tactical-authority`.** Ablação com 49 partidas pareadas
mostrou que a tática autoritativa custava 20% dos chutes, 26% das tentativas de desarme
e 36% das faltas, e reprovava os três gates de identidade de estilo. O harness reproduz
as baselines documentadas do relatório anterior (R18.20 medida em 9,76 chutes contra
9,85 documentado; sem r1819/r1820 em 12,27 contra 11,91 da R18.18.3).

**Cinco camadas aditivas**, na ordem em que são injetadas:

| camada | o que faz |
|---|---|
| `cds-r1821-throwin-law` | Restaura a lei do lateral (sem gol direto). Ver "Regressão corrigida". |
| `cds-r1821-post-recovery-decision` | Guarda contra chutão pós-roubada fora do terço defensivo. |
| `cds-r1821-shot-plausibility` | Comprime a amplitude do chute errado: raspa a trave em vez de ir à arquibancada. |
| `cds-r1821-press-anticipation` | O pressionador vai ao **recebedor** em vez de perseguir a bola em voo. |
| `cds-r1821-respread-top` | Reespalha o topo saturado de `finalizacao` e `passe`. |

## Resultados medidos

Matriz de estilos 7×7 com `--repeats=3` (**147 partidas pareadas**, mesmos seeds):

| métrica | R18.20 | R18.21-RC1 | alvo | |
|---|---:|---:|---:|---|
| chutes | 9,76 | **13,97** | 12–20 | PASS |
| passes | 212,6 | 210,4 | 170–235 | PASS |
| gols | 1,98 | 3,19 | — | — |
| tentativas de desarme | 7,00 | 12,80 | 18–40 | FAIL |
| desarmes | 3,53 | 6,04 | 8–22 | FAIL |
| faltas | 3,16 | 5,18 | 7–17 | FAIL |
| laterais | 5,16 | 4,99 | 5–16 | FAIL (limítrofe) |
| escanteios | 1,31 | 1,16 | 4–10 | FAIL |
| cobertura crítica | 61,9% | 61,1% | 70% | FAIL |

Gates de identidade de estilo do probe:

| gate | R18.20 | R18.21-RC1 |
|---|---|---|
| `parkIdentity` | FAIL | **PASS** |
| `tikiIdentity` | FAIL | **PASS** |
| `noDominantStyle` | FAIL | INDECIDÍVEL |

**Ressalva sobre `noDominantStyle`:** este gate compara `ppgRange <= 0,75` e
`maxAbsGoalDiffPerMatch <= 0,65`. As duas grandezas oscilam mais que a própria
margem nesta amostra — medido, `ppgRange` desloca 11,5% sozinho entre amostras
da mesma build, e as amostras usadas nessa medição eram correlacionadas, então
o valor real é maior. Numa das builds intermediárias o gate passou com margem de
**0,007** em `maxAbsGoalDiff`. Não tratar PASS nem FAIL deste gate como
conclusivo sem `--repeats=6` (294 partidas), que é a prática estabelecida do
projeto para a matriz.

### Alcance do goleiro em jogo aberto

O motor usava `contactRadius` 3,0 no chute normal mas 1,95 no chute de cruzamento
rasteiro e no cabeceio — sem razão física. Quando o goleiro não alcançava, o chute
rasteiro não tinha caminho nem para gol nem para defesa: ia para fora, garantido.

Corrigido para 3,0 nas duas rotas de **jogo aberto** (bola parada fica em 1,95: ali
o goleiro está posicionado e a cobrança é desenhada para batê-lo). Medido em 147
partidas pareadas:

| métrica | antes | depois | |
|---|---:|---:|---|
| escanteios | 1,16 | **1,27** | +8,8% |
| defesas | 1,37 | **1,50** | +9,4% |
| chutes para fora | 8,70 | **8,19** | −5,9% |
| cabeceios | 1,20 | 1,29 | +7,4% |
| chutes | 13,97 | 14,00 | — |

Escanteio é a métrica mais estável do probe (desloca 0,0% sozinha), então o ganho
é sinal. Gols subiram 12,4% na mesma amostra, mas gols oscilam ~27% sozinhos aqui
e não sustentam conclusão.

O ganho isolado da **pressão antecipada**, medido em 147 partidas pareadas contra a
mesma build sem ela: tentativas de desarme 7,88 → 12,93 (+64%), desarmes 3,68 → 6,22
(+69%), faltas 3,85 → 5,36 (+39%), e os três gates de estilo virando PASS.

## Regressão corrigida

A regra que impede **gol direto de cobrança de lateral** foi escrita na R18.18.3.1 mas
vivia *dentro* do bloco `cds-r1819-tactical-authority`. Ao remover aquela camada, a lei
foi junto: a base R18.20 tem 4 ocorrências de `untouchedSinceRestart` e a candidata
intermediária tinha zero.

Prova dirigida (`tools/r1821/teste_lateral.js`): **40 de 40** cobranças viravam gol
direto; com a camada restaurada, **0 de 40** (viram tiro de meta). Custo em 147 partidas
pareadas: **zero** — todas as métricas idênticas, porque a lei só dispara no caso ilegal.

## Limitações conhecidas

**A área está vazia quando a bola cruza.** Medido em 619 cruzamentos: **74,3%** dos
cruzamentos são feitos sem nenhum companheiro dentro de 24 m do gol, e **96,9%** sem
ninguém dentro de 16 m. A causa é `_canCross`, que libera o cruzamento a partir de 27 m
do gol — no instante do cruzamento a bola está no progresso 75,7 (≈30 m do gol) e os
atacantes em 75,2, ou seja, corretamente ao lado dela.

Isso explica de uma vez: cabeceio ao gol em 1,20/partida contra 4–6 reais; o atributo
`cabeceio` valendo só +3,6%; e o escanteio travado. **Nenhum gate mede isso** — cruzamento
conta 19/partida, dentro da faixa real, e fica verde.

Dez tentativas de correção (corridas de área, isenção de separação, limiar de cruzamento,
condução do ponta) estão documentadas e **nenhuma foi promovida**: elevar o limiar enche
a área (76,3% → 19,4% de área vazia) mas derruba os cruzamentos de 14,88 para 2,50.

**Não executado:** bateria dos 8 seeds canônicos, lotes de 30 e 100 partidas com os seeds
das baselines, auditor formal com `PASS`/`FAIL`/`INSUFFICIENT_DATA`, verificação de
determinismo e de boot mobile. Por isso o status é **CANDIDATA — NECESSITA AJUSTES** e
não `PROMOVIDA`.

## Ruído de medição

Medido na mesma build, sem alteração de código, comparando 49 e 98 partidas — deslocamento
da métrica sozinha:

| métrica | desloca | decidível a n=49? |
|---|---:|---|
| escanteios | 0,0% | sim, a mais estável |
| passes | 1,3% | sim |
| laterais | 1,8% | sim |
| tentativas de desarme | 4,1% | sim |
| faltas / chutes / desarmes | 8–9% | limítrofe |
| `ppgRange` | 11,5% | **não** |
| gols | 26,7% | **não** |
| dribles | 60,4% | **não** |

As amostras são correlacionadas (a de 98 contém a de 49), então a variação entre amostras
independentes é da ordem do dobro. **Não aceitar nem rejeitar candidata por gols, dribles
ou `ppgRange` com 49 partidas.**

## Ferramentas

| arquivo | o que mede |
|---|---|
| `build_rc1.js` | regenera a candidata a partir da base, com verificação de SHA |
| `probe_ablate.js` | matriz de estilos; `--skipIds` desliga camadas por id para ablação |
| `diag_area.js` | ocupação da área no instante do cruzamento, por formação |
| `diag_corrida.js` | distância ao alvo do início ao fim de cada corrida designada |
| `diag_atributos2.js` | impacto de cada atributo, com lados alternados (controle dá zero exato) |
| `diag_saturacao.js` | empates no topo da escala por atributo |
| `diag_elencos_2026.js` | jogadores de elencos antigos aparecendo em elencos de 2026 |
| `scenario_119.js` | matriz 17×7 de recuperação de bola no meio-campo |
| `teste_lateral.js` | prova dirigida da lei do lateral |
| `censo_rotas.js` | funil do bote e origem de escanteios/laterais |

Rodar a partir da raiz do repositório, com o Node portátil do projeto.
