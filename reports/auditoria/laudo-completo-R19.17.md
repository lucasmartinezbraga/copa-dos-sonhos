# Laudo de auditoria — auditado-R19.17.html

Gerado em 2026-08-21 00:15 · sha256 `b514442fb2528396`

Artefato auditado: `reference/auditado-R19.17.html`. Nas medicoes ele aparece pelo nome da
copia de trabalho usada na rodada — o sha256 acima e o que identifica o bundle.

Metodologia: `docs/METODOLOGIA-DE-BUGS.md`. Cada achado abaixo traz a
receita que o repete — sem receita, nao e achado, e impressao.

## 1. Veredito

- **105294** violacoes em **9** regra(s) sobre 96 partidas
- gravidade: S3=104378, S2=651, S1=254, S4=11
- partidas que terminaram: 96/96
- camadas: 27 patch(es) perdido(s), 33 metodo(s) com 3+ donos, 10 sem guarda
- tela: partida inteira projetada em **8.3 min** no botao 3X; 25.1% do tempo de tela e bola parada
- artefato: 79 blocos, 2.42 MB, 3 achado(s) de documento
- telas: 3 tamanhos percorridos, 0 erro(s) de script/console

### A faixa cinzenta do `dead`

Tres subsistemas discordam sobre o que `dead > 0` significa:

| quem | o que faz com `dead > 0` |
|---|---|
| relogio da partida | **para** para qualquer `dead > 0` |
| congelamento tatico | so entra em `dead > 0,4` |
| laco de render | **adianta 3,5x** para qualquer `dead > 0` (10,5x no botao 3X) |

Na faixa `0 < dead <= 0,4` isso da, por partida: **8.5 s** de simulacao
em **5.7 episodios**, com a bola andando **64.2 m**;
o pior episodio dura **5.3 s**. Nesses trechos o jogo continua sendo jogado,
o relogio da partida fica parado e a tela acelera.

## 2. Achados de simulacao (N2/N3)

| gravidade | regra | ocorrencias | titulo |
|---|---|---|---|
| S1 | `D8` | 250 | Bola morta com o jogo andando |
| S1 | `C16` | 4 | Gol sem a bola na baliza |
| S2 | `C10` | 557 | Reinicio fora do lugar legal |
| S2 | `F4` | 94 | O motor acusa a si mesmo (visualIntegrity) |
| S3 | `A5` | 102643 | Nota do atleta fora de 0..10 |
| S3 | `E2` | 1097 | Bola acelera no ar sem contato |
| S3 | `B8` | 578 | Recolocacao longa da bola no reinicio |
| S3 | `C13` | 60 | Corpos sobrepostos |
| S4 | `C4b` | 11 | Expulso reposicionado na troca de lados |

### D8 · Bola morta com o jogo andando (S1, 250x)

Tres subsistemas discordam do que `dead > 0` significa. O nucleo retorna cedo (sem fisica nem decisao) para QUALQUER dead > 0; o congelamento tatico so entra em dead > 0,4; e o laco de render adianta 3,5x sempre que dead > 0 (10,5x no botao 3X). Na faixa 0 < dead <= 0,4 o resultado e: a bola continua colada no portador por uma camada, os 22 continuam se movendo, o relogio da partida PARA e a tela ACELERA. E o defeito de sensacao mais caro do jogo.

- partida 0, 1o tempo, 5.49' — `{"duracao":"4.77 s","bolaAndou":"31.2 m","relogioParadoEm":5.49,"adiantoDeTela":"3,5x sobre o botao"}`
- partida 0, 1o tempo, 32.39' — `{"duracao":"4.27 s","bolaAndou":"26.8 m","relogioParadoEm":32.39,"adiantoDeTela":"3,5x sobre o botao"}`

```bash
node tools/auditoria/repro.js --build=<bundle> --partida=0 --regra=D8
```

### C16 · Gol sem a bola na baliza (S1, 4x)

Gol validado com a bola longe da linha ou fora das traves e placar inventado.

- partida 18, 1o tempo, 2.24' — `{"motivo":"cruzou fora da baliza","yNoCruzamento":28.45,"zNoCruzamento":0.95,"postes":[30.34,37.66],"travessao":2.44}`
- partida 48, 1o tempo, 8.66' — `{"motivo":"cruzou fora da baliza","yNoCruzamento":29.9,"zNoCruzamento":0.96,"postes":[30.34,37.66],"travessao":2.44}`

```bash
node tools/auditoria/repro.js --build=<bundle> --partida=18 --regra=C16
```

### C10 · Reinicio fora do lugar legal (S2, 557x)

Escanteio sai da quina, lateral da linha lateral, tiro de meta de dentro da area, penalti da marca. Reinicio no lugar errado e a regra de futebol mais visivel que existe.

- partida 0, 1o tempo, 4.78' — `{"reinicio":"corner","deveriaSairDe":"quina do campo","erro":"2.3 m","bola":[1,66]}`
- partida 0, 1o tempo, 5.1' — `{"reinicio":"corner","deveriaSairDe":"quina do campo","erro":"2.3 m","bola":[1,66]}`

```bash
node tools/auditoria/repro.js --build=<bundle> --partida=0 --regra=C10
```

### F4 · O motor acusa a si mesmo (visualIntegrity) (S2, 94x)

O proprio jogo conta teleportes, contatos falhados e faltas de viagem. Contador acima de zero e confissao.

- partida 0, 2o tempo, 96.42' — `{"failedContacts":9}`
- partida 1, 2o tempo, 95.08' — `{"failedContacts":1}`

```bash
node tools/auditoria/repro.js --build=<bundle> --partida=0 --regra=F4
```

### A5 · Nota do atleta fora de 0..10 (S3, 102643x)

Nota e superficie visivel: aparece na ficha do jogador.

- partida 3, 2o tempo, 87.1' — `{"atleta":"Kempes (ST)","rating":10.05999999999999}`
- partida 3, 2o tempo, 87.11' — `{"atleta":"Kempes (ST)","rating":10.05999999999999}`

```bash
node tools/auditoria/repro.js --build=<bundle> --partida=3 --regra=A5
```

### E2 · Bola acelera no ar sem contato (S3, 1097x)

Bola em voo so perde energia. Ganhar velocidade sem ninguem tocar nela e a integracao numerica vazando ou uma recolocacao disfarcada de fisica.

- partida 0, 1o tempo, 3.38' — `{"de":"16 m/s","para":"39.5 m/s","z":0.85,"kind":"shot"}`
- partida 0, 1o tempo, 5.49' — `{"de":"16.1 m/s","para":"39.8 m/s","z":0.82,"kind":"shot"}`

```bash
node tools/auditoria/repro.js --build=<bundle> --partida=0 --regra=E2
```

### B8 · Recolocacao longa da bola no reinicio (S3, 578x)

No quadro do reinicio a bola muda de lugar de graca. Ate uns metros isso e o arbitro acertando o ponto; dezenas de metros e o lance recomecando noutro lugar, e o olho ve a bola piscar.

- partida 0, 1o tempo, 4.78' — `{"salto":"27.2 m","kind":"deflect","de":[-2.8,39.6],"para":[1,66.5],"rotulo":"corner"}`
- partida 0, 1o tempo, 5.1' — `{"salto":"28.5 m","kind":"deflect","de":[-0.8,38.1],"para":[1,66.5],"rotulo":"corner"}`

```bash
node tools/auditoria/repro.js --build=<bundle> --partida=0 --regra=B8
```

### C13 · Corpos sobrepostos (S3, 60x)

Dois atletas ocupando o mesmo ponto por mais de um segundo: na tela um entra dentro do outro.

- partida 3, 1o tempo, 30.88' — `{"a":"Babington (ST)","b":"Luqué (RW)","juntosHa":"1 s","distancia":"0 m","mesmoTime":false}`
- partida 4, 2o tempo, 86.78' — `{"a":"Gallego (CAM)","b":"Enrique (RM)","juntosHa":"1.2 s","distancia":"0.06 m","mesmoTime":false}`

```bash
node tools/auditoria/repro.js --build=<bundle> --partida=3 --regra=C13
```

### C4b · Expulso reposicionado na troca de lados (S4, 11x)

`_switchSides` espelha todos os atletas, inclusive os expulsos, enquanto `_resetPositions` os pula. Ninguem ve, mas as duas rotinas discordam sobre quem esta em campo.

- partida 12, 2o tempo, 45' — `{"atleta":"Tom Rogić (ST)","andou":"74.59 m","onde":"troca de lados"}`
- partida 13, 2o tempo, 45' — `{"atleta":"Zischek (ST)","andou":"43.73 m","onde":"troca de lados"}`

```bash
node tools/auditoria/repro.js --build=<bundle> --partida=12 --regra=C4b
```

## 2b. Legalidade do reinicio

Distancia entre a bola e o ponto legal, no quadro em que o motor consome o reinicio.

| reinicio | n | erro p50 | erro p90 | pior | fora da tolerancia |
|---|---|---|---|---|---|
| corner | 551 | 2.27 m | 2.27 m | 56.46 m | 551 |
| goal_kick | 1261 | 0 m | 0 m | 0 m | 0 |
| penalty | 2 | 6.47 m | 6.47 m | 6.47 m | 2 |
| throw_in | 1497 | 0.68 m | 1.51 m | 2.04 m | 2 |

O pontape de saida fica **fora** desta tabela de proposito: entre a cerimonia do gol,
a volta para casa e o proprio pontape, o instante do reinicio deixa de ser identificavel
por `pendingRestart`, e um numero inventado seria pior que um buraco declarado.

## 3. O lance de falta

| pergunta | medida |
|---|---|
| faltas por partida | 23.8 |
| sem contato visivel antes do apito | 0.5% |
| distancia infrator-vitima no apito | p50 1.21 m · p90 1.79 m |
| espera ate a bola voltar a rolar | p50 2.03 s · p90 5.03 s |
| bola no ponto da falta no reinicio | p50 0.46 m · p90 0.87 m |
| **saiu andando em vez de bater** | **58.5%** |

Desfechos: carregou=1336, batida=929, apito=16, reiniciado=4

### A bola que pisca

No quadro do reinicio a bola muda de lugar de graca: **77.4 vezes por partida**,
p50 1.79 m, p90 22.98 m, pior caso 99.9 m — **1357 saltos acima de 10 m**
na amostra. Nada disso e desenhado: ela some de um ponto e aparece no outro.

### Economia da bola parada (simulacao)

13.8% da simulacao e bola morta, em 65 pausas por partida.

| reinicio | por partida | pausa media (sim) | pior |
|---|---|---|---|
| corner | 5.74 | 5.711 s | 8.433 s |
| foul | 18.52 | 2.417 s | 5.033 s |
| goal | 2.05 | 7.994 s | 8.367 s |
| goal_kick | 13.14 | 1.464 s | 3.5 s |
| halftime | 1 | 3.818 s | 4.433 s |
| injury | 0.34 | 2.01 s | 5.033 s |
| kickoff | 1 | 3.4 s | 4.4 s |
| offside | 3.06 | 1.72 s | 3.3 s |
| penalty | 0.02 | 0.88 s | 1.033 s |
| red | 0.31 | 2.043 s | 5.033 s |
| throw_in | 15.59 | 3.128 s | 4.533 s |
| yellow | 4.24 | 2.529 s | 5.033 s |

## 3b. O custo de tela, botao a botao

| botao | parede/simulacao | partida inteira | bola parada (tela) | bola parada (simulacao) | tremor | salto |
|---|---|---|---|---|---|---|
| 1X | 0.9267 | 21.1 min | 11.1% | 18.5% | 0.01% | 0.60% |
| 3X | 0.3653 | 8.3 min | 25.1% | 20.9% | 0.21% | 2.39% |
| 6X | 0.2082 | 4.7 min | 26.1% | 14.6% | 0.38% | 3.66% |

## 4. Ritmo e fluidez (N5 — relogio de parede)

Janela medida: 120s no botao 3X.

- **0.3653 s de parede por segundo de simulacao** → partida inteira ~**8.3 min**
- bola parada: **25.1% do tempo de tela** contra 20.9% da simulacao
- fluidez: 93.2 fps · 17.8% dos quadros sem passo (imagem parada) · 58.4% com 2+ passos (salto)

| reinicio | n | parede p50 | parede p90 | pior | sim p50 |
|---|---|---|---|---|---|
| foul | 9 | 2001 ms | 2246 ms | 2246 ms | 2.83 s |
| goal_kick | 6 | 1102 ms | 1148 ms | 1148 ms | 1.58 s |
| sem_evento | 5 | 437 ms | 577 ms | 577 ms | 4.52 s |
| throw_in | 3 | 322 ms | 324 ms | 324 ms | 3.12 s |
| yellow | 1 | 2233 ms | 2233 ms | 2233 ms | 5.03 s |

## 4b. Fluxo de telas (N6)

| tamanho | boot | erros | achados | campo na partida |
|---|---|---|---|---|
| desktop 1366x768 | 2758 ms | 0 | inicio: 16 texto < 11px; partida: 17 texto < 11px | 50% |
| tablet 820x1180 | 2720 ms | 0 | inicio: 16 texto < 11px; partida: 20 texto < 11px | 34% |
| celular 390x844 | 2834 ms | 0 | inicio: 15 texto < 11px; apos-montar-time: 1 alvo < 32px; partida: 19 texto < 11px | 22% |

Capturas em `reports/auditoria/tela/`.

## 5. Camadas (N1 — analise estatica)

79 blocos · 151 metodos no core · 165 remendados.

**Patch perdido** — a camada substitui sem chamar o anterior, e o que estava embaixo para de rodar:

| ordem | camada | metodo | apaga |
|---|---|---|---|
| 3 | `cds-physics-timeline-581` | `_actorReachable` | core |
| 3 | `cds-physics-timeline-581` | `_gkInterceptTarget` | core |
| 3 | `cds-physics-timeline-581` | `_physicalBlockPoint` | core |
| 4 | `cds-p04-physical-reception-584-r6` | `_ballGlue` | core |
| 4 | `cds-p04-physical-reception-584-r6` | `_ballTravel` | core, cds-physics-timeline-581 |
| 4 | `cds-p04-physical-reception-584-r6` | `_contestLoose` | core |
| 4 | `cds-p04-physical-reception-584-r6` | `_continueTravel` | core, cds-physics-timeline-581 |
| 4 | `cds-p04-physical-reception-584-r6` | `_giveBall` | core |
| 4 | `cds-p04-physical-reception-584-r6` | `_goalkeeperClaim` | core |
| 4 | `cds-p04-physical-reception-584-r6` | `_looseBall` | core |
| 4 | `cds-p04-physical-reception-584-r6` | `_looseRoll` | core |
| 4 | `cds-p04-physical-reception-584-r6` | `_receive` | core |
| 4 | `cds-p04-physical-reception-584-r6` | `_startTravel` | core, cds-physics-timeline-581 |
| 10 | `cds-r10-engine-closure` | `_turnover` | core |
| 10 | `cds-r10-engine-closure` | `getPhysicalTimeline` | cds-physics-timeline-581 |
| 12 | `cds-r12-transactional-core-r123` | `_dribble` | core |
| 12 | `cds-r12-transactional-core-r123` | `_pressAndTackle` | core |
| 12 | `cds-r12-transactional-core-r123` | `_resolveOverlaps` | core |
| 13 | `cds-r13-football-observer-cadence` | `_assignDefRoles` | core |
| 13 | `cds-r13-football-observer-cadence` | `_ballGlue` | core, cds-p04-physical-reception-584-r6 |
| 15 | `cds-r183-natural-football` | `_physicalArc` | cds-physics-timeline-581 |
| 15 | `cds-r183-natural-football` | `_trajectoryPoint` | cds-physics-timeline-581 |
| 40 | `cds-r1821-post-recovery-decision` | `_clearBall` | core, cds-r18182-duels-natural-restarts |
| 68 | `cds-os200-balistica-real` | `_physicalArc` | cds-physics-timeline-581, cds-r183-natural-football |
| 68 | `cds-os200-balistica-real` | `_physicalTargetZ` | cds-physics-timeline-581, cds-r183-natural-football, cds-os92-shot-out-geometry |
| 68 | `cds-os200-balistica-real` | `_planPhysicalSegment` | cds-physics-timeline-581, cds-r183-natural-football, cds-os92-shot-out-geometry |
| 68 | `cds-os200-balistica-real` | `_trajectoryPoint` | cds-physics-timeline-581, cds-r183-natural-football |

**Pilha funda** — metodos com tres ou mais donos (a ordem do manifesto e regra de negocio):

- `_emit` — 24x: script-2 → cds-physics-timeline-581 → cds-pre25d-runtime-auditor-v04 → cds-r12-transactional-core-r123 → cds-r13-football-observer-cadence → cds-ux-boot → cds-r18155-shot-restart-law-fix → cds-r1817-release-meta → cds-r18172-approach-before-shot-meta → cds-r1818-offensive-progression → cds-r18181-second-phase-natural-out → cds-r18182-duels-natural-restarts → cds-r18183-corner-ecology → cds-r1821-throwin-law → cds-r1821-tempo-e-pausas → cds-os20-setpiece-hud → cds-os21-wall-taker → cds-os46-anim-wiring → cds-os51-beaten-defender → cds-os113-falta-cartao → cds-os206-plano-do-portador → cds-os216-cruzamento → cds-os263-cerimonia → cds-os267-corte
- `_ballTravel` — 4x: cds-physics-timeline-581 → cds-p04-physical-reception-584-r6 → cds-r12-transactional-core-r123 → cds-r13-football-observer-cadence
- `_continueTravel` — 3x: cds-physics-timeline-581 → cds-p04-physical-reception-584-r6 → cds-r12-transactional-core-r123
- `_deflectTo` — 6x: cds-physics-timeline-581 → cds-r13-football-observer-cadence → cds-r18181-second-phase-natural-out → cds-r18182-duels-natural-restarts → cds-r18183-corner-ecology → cds-os83-restart-watchdog
- `_movePlayers` — 5x: cds-physics-timeline-581 → cds-r12-transactional-core-r123 → cds-r189-offball-intelligence → cds-os36-freekick-distance → cds-os48-carry-flow
- `_physicalArc` — 3x: cds-physics-timeline-581 → cds-r183-natural-football → cds-os200-balistica-real
- `_physicalTargetZ` — 4x: cds-physics-timeline-581 → cds-r183-natural-football → cds-os92-shot-out-geometry → cds-os200-balistica-real
- `_planPhysicalSegment` — 4x: cds-physics-timeline-581 → cds-r183-natural-football → cds-os92-shot-out-geometry → cds-os200-balistica-real
- `_startTravel` — 14x: cds-physics-timeline-581 → cds-p04-physical-reception-584-r6 → cds-r10-engine-closure → cds-r12-transactional-core-r123 → cds-r13-football-observer-cadence → cds-r183-natural-football → cds-r18161-box-runs-execution → cds-r18182-duels-natural-restarts → cds-r1821-throwin-law → cds-r1821-shot-plausibility → cds-os39-block-on-flight → cds-os43-aerial-duel → cds-os46-anim-wiring → cds-os216-cruzamento
- `_trajectoryPoint` — 3x: cds-physics-timeline-581 → cds-r183-natural-football → cds-os200-balistica-real
- `isOver` — 3x: cds-physics-timeline-581 → cds-r12-transactional-core-r123 → cds-r1821-tempo-e-pausas
- `reset` — 12x: cds-physics-timeline-581 → cds-r12-transactional-core-r123 → cds-r13-football-observer-cadence → cds-r14-engine → cds-r1817-release-meta → cds-r18172-approach-before-shot-meta → cds-r18173-defensive-responsibility → cds-r1818-offensive-progression → cds-r18181-second-phase-natural-out → cds-r18182-duels-natural-restarts → cds-r18183-corner-ecology → cds-r1820-chance-intelligence
- `_giveBall` — 4x: cds-p04-physical-reception-584-r6 → cds-r18181-second-phase-natural-out → cds-r1821-throwin-law → cds-os206-plano-do-portador
- `_looseBall` — 5x: cds-p04-physical-reception-584-r6 → cds-r13-football-observer-cadence → cds-r18181-second-phase-natural-out → cds-r18182-duels-natural-restarts → cds-r18183-corner-ecology
- `_receive` — 5x: cds-p04-physical-reception-584-r6 → cds-r13-football-observer-cadence → cds-r1818-offensive-progression → cds-r18181-second-phase-natural-out → cds-r18182-duels-natural-restarts
- `_selectPresser` — 5x: cds-r7-pass-flow-calibration → cds-r13-football-observer-cadence → cds-r18173-defensive-responsibility → cds-r18182-duels-natural-restarts → cds-r1821-press-anticipation
- `step` — 25x: cds-r7-pass-flow-calibration → cds-r10-engine-closure → cds-r12-transactional-core-r123 → cds-r13-football-observer-cadence → cds-r14-engine → cds-ux-boot → cds-r18fix-restart-positions → cds-r18161-box-runs-execution → cds-r18173-defensive-responsibility → cds-r18181-second-phase-natural-out → cds-r18182-duels-natural-restarts → cds-r18183-corner-ecology → cds-os46-anim-wiring → cds-os77-common-foul-restart → cds-os83-restart-watchdog → cds-os100-throwin-delivery → cds-os107-bloco-bola-parada → cds-os112-lateral-saida-e-apoio → cds-r1899-antiteleporte → cds-r1905-papel-morre-com-o-lance → cds-os206-plano-do-portador → cds-os207-cerimonia-sem-tremor → cds-os212-toque-de-primeira → cds-os214-volta-para-casa → cds-os231-batedor
- `_turnover` — 6x: cds-r10-engine-closure → cds-r12-transactional-core-r123 → cds-r13-football-observer-cadence → cds-r18181-second-phase-natural-out → cds-r18182-duels-natural-restarts → cds-r18183-corner-ecology
- `substitute` — 3x: cds-r10-engine-closure → cds-r184-certificacao-honesta → cds-r1821-tempo-e-pausas
- `_decide` — 7x: cds-r12-transactional-core-r123 → cds-r13-football-observer-cadence → cds-r14-engine → cds-r1810-reception-intelligence → cds-r1818-offensive-progression → cds-r18181-second-phase-natural-out → cds-r1820-chance-intelligence

## 5b. O artefato (N0)

auditado-R19.17.html · 2.42 MB · 79 blocos de script · 9 de estilo

| grav. | achado | |
|---|---|---|
| S2 | 1 host(s) externos referenciados | https://flagcdn.com/ |
| S3 | 40 escritas de CDS_BUILD_ID com 38 valores diferentes | 38 valores, vence "R19.17" |
| S3 | usa document.write |  |

## 6. Calibracao de design

| metrica | medido | faixa | |
|---|---|---|---|
| goalsPerMatch | 2.052 | 2.4 .. 3.2 | **fora** |
| shotsPerMatch | 21.646 | 20 .. 30 | ok |
| xgPerMatch | 2.182 | 2.3 .. 3.5 | **fora** |
| onTargetRate | 0.309 | 0.34 .. 0.47 | **fora** |
| passCompletion | 0.8135 | 0.75 .. 0.89 | ok |
| foulsPerMatch | 23.802 | 16 .. 28 | ok |
| yellowsPerMatch | 4.813 | 2.4 .. 5.6 | ok |
| redsPerMatch | 0.323 | 0.06 .. 0.3 | **fora** |
| cornersPerMatch | 5.74 | 5 .. 11.5 | ok |
| drawRate | 0.3021 | 0.2 .. 0.33 | ok |
| zeroZeroRate | 0.125 | 0.045 .. 0.12 | **fora** |
| blowoutRate | 0.1146 | 0.09 .. 0.19 | ok |
| averageEndingStamina | 65.1173 | 64 .. 83 | ok |

## 7. Caminhos que nunca executaram

Eventos que o codigo sabe emitir e que 96 partidas nunca produziram:

- `ai_shape`
- `ai_shift`
- `ai_sub`
- `clear_behind`
- `clearance_out`
- `et_halftime`
- `extratime`
- `throwin_law`
- `visual_travel_fault`

Nem todo item aqui e defeito (prorrogacao so acontece em mata-mata empatado),
mas cada um precisa de uma explicacao — ou vira caminho morto.
