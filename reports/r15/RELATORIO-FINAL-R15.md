# RELATÓRIO FINAL — R15.2

Entregável do §59. Sem linguagem promocional, sem esconder limitação.

| | |
|---|---|
| candidata | `dist/COPA DOS SONHOS - R15.2.html` |
| SHA-256 | `ebfd0f315d37d6fd407abcaa234d1ff42276ddcc9303c0f296e221c75df14723` |
| baseline recebida | R14.4 `7fdf183581162115344e320d5bfbada3f02f6a47e30a01948f08eba816c8b071` |
| base congelada | R13.0 `363d9a915a732ae99a889dab05e7f01485d58b140d64e4778ad8d5825f9818a8` |
| data | 2026-07-23 |

---

## 1. O que foi corrigido

### 1.1 Rastreabilidade (P0)

A fonte não reconstruía a candidata: `_exp-clock`, marcado como experimento e
descrito no handoff como "não embarcar", era aplicado incondicionalmente. Toda
medição a partir daquele ponto descreveria um arquivo diferente do certificado.
`enabled:false` passou a ser respeitado; `--with`/`--without` habilitaram os
testes A/B pareados do §45, que antes exigiam editar JSON à mão.

### 1.2 Identidade da build (P1)

Havia **três** declarações de versão conflitantes e a que vencia não era nenhuma
das citadas nos relatórios: a camada 30 carrega por último e sobrescrevia
`document.title` com "R13.0", enquanto a tag `<title>` dizia R12.3 e o arquivo
dizia R14.4. As três passaram a declarar a mesma versão.

### 1.3 Modificadores ocultos (P0) — §41/§42/§56

Oito removidos. O handoff documentava um; a varredura automática encontrou os
outros sete, três deles inéditos em qualquer relatório:

| local | efeito |
|---|---|
| `step` ~2752 | `maxSpd *= 1.05` por lenda + placar + minuto |
| `step` ~2751 | estado `_onFire` |
| `P._dribble` R12:125 | `+5` na força de drible |
| `_shoot` :3822 | `base *= 1.18` no xG |
| estilo :2380 | química por nacionalidade acelerando `decideT` |
| `_bestPass` :3415 | `legendPull = 0.38` |
| conversão ~3840 | **`pGoal *= 1.15`** por trait CLUTCH após o 80' — inédito |
| `_actionContext` ~2833 | **`execution += .055`** por trait CLUTCH após o 75' — inédito |

Quatro sítios foram examinados e **mantidos** com justificativa registrada
(`urgency`, `restraint`, `_losingLate`, `importance`): alteram preferência ou
reduzem execução sob pressão, o que o §37 permite.

### 1.4 Linha defensiva (P0) — §30/§53

O achado estrutural mais relevante da sessão. Não existia uma linha: existia um
escalar `_r13LineDepth` que apenas parte do time seguia. Medido em 584.851
amostras de jogadores da linha defensiva:

| ramo | share | desvio da linha (antes) | depois |
|---|---:|---:|---:|
| `DEF` | 31% | 0,28 m | 0,26 m |
| `markRef` | 38% | 2,53 m | 2,50 m |
| **`cover`** | 15,5% | **20,22 m** (>6 m em 80,6%) | **2,83 m** (>6 m em 0,0%) |
| **`shadow`** | 11,6% | **22,01 m** (>6 m em 89,2%) | **2,98 m** (>6 m em 0,4%) |
| quem não é `DEF` | | **9,95 m** | **2,83 m** |

`cover` e `shadow` posicionavam em relação à BOLA, não à linha. A correção
aplica a esses dois papéis o mesmo clamp `line ± 3,0 m` que o ramo `markRef` já
usava — deslocamento lateral segue livre, o que se perde é o direito de
abandonar a profundidade do bloco. Regra geral, sem exceção por formação,
estilo ou nome.

Isto explica os cinco fracassos registrados no handoff: todos mexeram em
marcação (já correta, a 2,53 m) e no escalar. Nenhum tocou nos dois papéis que
rompiam a linha.

---

## 2. O que foi reconstruído na auditoria

### 2.1 O auditor não conseguia reprovar (§4–§7)

Três defeitos estruturais, mesma raiz — **ausência de medição virava aprovação**:

- `structural` era `!this.getR12Audit() || …`: sem auditor, o gate passava.
  Provado por mutação — com `getR12Audit` apagado, o observador aprovou 49/49.
- Cinco taxas viravam nota máxima com denominador zero.
- Nenhuma camada possuía o estado `FAIL`; o pior veredito era `REVIEW`.

### 2.2 O gate de linha media 9% da partida

`lineRange` e `disconnectedLines` só eram amostrados na fase `defensive_block`,
que responde por 8,87% das amostras. Isolado com A/B onde **só a régua mudou**:

| | amostragem estreita | amostragem larga |
|---|---:|---:|
| amostras/partida | 143 | 822 |
| alcance médio | 7,12 m | **14,06 m** |
| desconectada | 0,000 | **0,340** |
| gate `lines` | 294/294 PASS | **0/294** |

### 2.3 A matriz de certificação é cega a scripting

Com atletas de laboratório (atributo 82, sem traits, sem `legend`, sem
nacionalidade) a remoção dos oito modificadores produziu **resultado idêntico**:
294 partidas, mesma cobertura, mesmos gols, mesmo ppgRange.

Com elencos reais, nas mesmas seeds, **93% dos placares mudaram**:

| | R14.4 | R15.1 | Δ |
|---|---:|---:|---:|
| gols/jogo | 3,156 | 3,034 | −0,122 |
| chutes/jogo | 19,707 | 18,963 | −0,745 |
| passes/jogo | 180,738 | 182,653 | +1,915 |

Direção compatível com a remoção de bônus de finalização: menos gol, menos
chute, mais circulação. **As remoções estão validadas (§48).**

E os sub-gates com elencos reais revelam um motor bem pior do que a matriz
neutralizada indicava: `marking` 1/294, `spatialOverload` 27/294.

### 2.4 A certificação misturava builds

O agregador conferia o SHA de um único artefato. Os artefatos estavam
espalhados por cinco builds distintas. Agora **todo** artefato precisa declarar
o SHA da build que examinou; divergência vira `INCONCLUSIVE`, nunca `PASS`.

### 2.5 Teleporte era inauditável

`maxRawStep` = 78,601 m contra `maxFinalStep` = 0,505 m. As guardas clampam
antes de medir, e o gate lia o valor pós-correção — nunca poderia disparar.
Origem do teleporte real: `_resetPositions()` escreve `p.x = p.hx` para os 22
jogadores fora do frame vigiado, no kickoff, no intervalo e após cada gol.

---

## 3. Auditoria visual — 120 lances (§13)

Matriz completa em `reports/r15/matriz-rastreabilidade.csv`. Nenhum lance sem
classificação final.

| status | n |
|---|---:|
| `FALSO_POSITIVO` | 114 |
| `CONFIRMADO_P0` | 66 |
| `CONFIRMADO_P1` | 46 |
| `INCONCLUSIVO` | 0 |

O maior volume de suspeitas era **uma régua invertida**. O coletor marcava
invasão lateral por `y` absoluto igual para os dois times, mas os lados são
espelhados por equipe (LB do time 0 em hy=0,110; LB do time 1 em hy=0,785).
Todo ala de um dos times era marcado parado na própria posição-base.

- régua do coletor: 48,95% das amostras marcadas
- régua correta (relativa à posição-base): **96,31% de respeito ao lado**

Os saltos também se dividem: dos 223 acima de 7 m, **172 são a troca de lado do
intervalo** (legítima) e 51 são teleporte real.

---

## 4. Problemas que permanecem

| id | problema | prioridade | estado |
|---|---|---|---|
| MOV-010 | Teleporte: **todo o subsistema de reinício** escreve posição direto | P0 | causa-raiz completa medida; **não corrigido** |
| MOV-011 | Guarda permite `maxSpd*dt*1.28+0.20` = 2,14× `maxSpd` | P1 | causa-raiz aritmética isolada; **não corrigido** |
| DEF-001 | Cobertura de ameaça 0,538 com elencos reais (limite 0,65) | P0 | **não corrigido** — pode ter melhorado com a linha; a medir |
| PATCH-001 | `r14-shadow-lane` ancorado em código morto | P1 | documentado; **ainda embarca sem efeito** |
| RULE-001 | Escanteio nasce de sorteio sobre deflexão | P1 | **não corrigido** |
| DENS-001 | `clockRate 0.24` comprime 90 min em ~400 s de física | P1 | bloqueado por DEF-001 |

---

### 4.1 MOV-010 — o teleporte tem cinco origens, não uma

Perfilado com `tools/r15/teleport_profiler.js`, que envolve todos os métodos do
protótipo e atribui cada salto ao método mais interno em execução. 6 partidas,
1.296 saltos acima de 1,5 m:

| método | share | salto médio | máx |
|---|---:|---:|---:|
| `_resetPositions` | 49,2% | 11,6 m | 87,9 m |
| `_goalKickOrRestart` | 20,7% | 20,8 m | 83,5 m |
| `_setCorner` | 13,1% | 21,0 m | 84,2 m |
| `_switchSides` | 10,2% | 50,0 m | 102,4 m |
| `_emit` | 6,8% | 42,9 m | 47,3 m |

`_switchSides` é a troca de lado do intervalo — legítima. Os demais não.

**A hipótese inicial estava pela metade.** Consertar `_resetPositions` sozinho
resolveria 49% e deixaria o pior salto em pé. Escanteio e tiro de meta somam
34% e reposicionam do mesmo jeito. O problema é do subsistema de reinício
inteiro.

O caminho da correção está identificado e é viável: durante `dead > 0` o motor
**já** chama `_movePlayers`, e `dead` não consome minutos de jogo. Falta rotear
os reinícios por esse mecanismo e alongar a janela — exatamente o que
`r14-throwin-walk` já fez para o lateral.

Ponta solta registrada: `_emit` não deveria mover jogadores, e aparece com
salto médio de 42,9 m.

## 5. Testes não executados

Não foram executados, e aparecem como `NOT_EXECUTED` na certificação — não como
aprovação:

- §20 percepção — nenhuma métrica; o motor lê o array completo de jogadores
- §18 contrato de função — não existe
- §23 logger de decisão — não existe
- §36 cadeia causal evento↔física
- determinismo por seed em execuções separadas
- navegador real: boot desktop/mobile, erro fatal, frame rate
- §55 aprovação humana

São 18 gates. A cobertura declarada no topo da certificação existe para que
isso fique visível, e não implícito.

---

## 6. Decisão

### R15.2 — **REPROVADA**

Todos os cinco artefatos foram medidos contra `ebfd0f31…`, verificado por SHA
em cada um. Cobertura: **38 de 60 gates medidos · 18 NOT_EXECUTED · 4
INCONCLUSIVE · 29 PASS · 9 FAIL**.

**Gates P0 reprovados:**

| gate | valor | limite |
|---|---:|---:|
| `ball_orientation_metric_alive` | amplitude 0 em 294 partidas | > 0 |
| `marking_coverage` | 0,630 | ≥ 0,65 |
| `no_teleport` | 59.124 saltos | 0 |
| `teleport_max_distance` | 97,33 m | ≤ 1,5 |
| `skill_monotonic_tiers` | 0,333 (2 de 6 métricas) | 1,0 |

**Gates P1 reprovados:** `disconnected_lines` 0,370 · `line_range_peak`
59,69 m · `movement_raw_step` 84,41 m · `spatial_overload_coverage` 0,582.

**Não executados (18):** determinismo por seed, percepção, contrato de função,
logger de decisão, cadeia causal evento↔física, matriz de formações, navegador
real (boot desktop, boot mobile, erro fatal), aprovação humana, e outros.

### O que passou e vale registrar

29 gates em PASS, entre eles os que sustentam a rastreabilidade — identidade da
build, R13.0 congelada byte-idêntica, reprodutibilidade da fonte, sintaxe,
smoke 13/13, cenários 25/25, consistência transacional 294/294 — e três
resultados de futebol conquistados nesta sessão:

- `no_hidden_modifiers` — os oito modificadores de roteiro removidos, varredura
  em zero, nenhum sítio sem veredito;
- `side_discipline` 0,9631 — respeito ao lado, medido contra a posição-base;
- `skill_gap_grows_with_difficulty` — **verdadeiro**: a vantagem do craque é
  nula na ação livre (−0,0005) e positiva sob pressão (+0,0284). O §24 pede
  exatamente isso, e é a primeira vez que o projeto tem essa medição.

`skill_monotonic_tiers` ainda reprova (0,333): `throughPerMatch` e
`shotsPerMatch` são monotônicos, `passesPerMatch`, `retentionPerPossession` e
`lossPerPossession` não. Os extremos separam com folga; 90 e 80 se invertem.

### Baseline oficial

Como a R15.2 está reprovada, a baseline oficial permanece **R14.4**
`7fdf183581162115344e320d5bfbada3f02f6a47e30a01948f08eba816c8b071` — preservada
e não sobrescrita.

Isso não significa que a R15.2 seja pior. Significa que ela é a primeira build
do projeto medida por um auditor que consegue reprovar. A R14.4 nunca foi
submetida a estes 60 gates; sob os gates antigos ela passava, e a Fase 0 provou
que aqueles gates aprovavam por ausência de medição.
