# FASE 0 — auditoria do próprio sistema de auditoria

Data da análise: 2026-07-23
Candidata sob exame: **R14.4** · `7fdf183581162115344e320d5bfbada3f02f6a47e30a01948f08eba816c8b071`
Base congelada: **R13.0** · `363d9a915a732ae99a889dab05e7f01485d58b140d64e4778ad8d5825f9818a8`

O objetivo desta fase não é avaliar o motor. É responder a uma pergunta anterior:
**o sistema que aprova o motor consegue reprovar alguma coisa?**

---

## 1. Identidade da baseline (§2)

| item | valor |
|---|---|
| arquivo | `dist/COPA DOS SONHOS - R14.4.html` |
| bytes | 1 748 171 |
| SHA-256 | `7fdf1835…c8b071` |
| título interno | `Copa dos Sonhos — Núcleo Autoritativo Transacional R12.3` |
| versão do motor (R13) | `CDS_R13.version` — camada observador |
| versão transacional | `CDS_R12` — `TRANSACTIONAL_CANDIDATE` |
| base R13.0 | `363d9a91…9818a8`, verificada byte a byte |
| patches de motor ativos | 8 (ver `src/r14/patches-engine.json`) |

**Divergência de identidade encontrada.** O título interno declara
`R12.3`, o arquivo declara `R14.4`, e a camada de observação declara a versão
R13. O §2 exige que arquivo, título, manifesto, logs, relatório, testes e
auditor declarem a mesma versão. Hoje declaram três. Classificação: **P1** —
não quebra futebol, mas quebra rastreabilidade, e foi exatamente o tipo de
confusão que produziu o problema do §8.

---

## 2. P0 de rastreabilidade: a fonte não reconstruía a candidata

**Comportamento observado.** `python tools/build_ux.py` produzia
`9bc436a170e970ad77953634e012a9cd9e0273d5501275ae298f897c5ec7d5f1`, e não os
`7fdf1835…` da R14.4 declarada.

**Causa-raiz.** `tools/build_ux.py` aplicava **todas** as entradas de
`src/r14/patches-engine.json` incondicionalmente. A entrada `_exp-clock`
— marcada no próprio arquivo como `"priority": "EXPERIMENTO"` e descrita no
handoff como *"não embarcar"* — era aplicada como se fosse patch de produção.
O build não tinha nenhum conceito de "experimento".

**Por que o sistema permitiu.** Não havia contrato entre a intenção declarada
(`priority: EXPERIMENTO`) e o comportamento do build. A prioridade era um
comentário, não um controle.

**Impacto.** Qualquer medição feita após 2026-07-23 08:00 mediria uma build
diferente da certificada, com o mesmo nome. É a condição que torna todos os
números subsequentes não confiáveis.

**Correção aplicada.** `enabled: false` passa a ser respeitado pelo build;
flags `--with <id>` / `--without <id>` permitem ligar e desligar patches
explicitamente — o que também habilita os testes A/B pareados do §45, que antes
eram impossíveis sem editar o JSON à mão.

**Verificação.** Rebuild reproduz `7fdf1835…c8b071` byte a byte.
Artefato: `reports/r15/integridade.json` → `candidate_reproducible: true`.

---

## 3. Inventário das camadas de auditoria (§5)

### 3.1 Camada transacional R12 — `29-r12-transactional-core.js`

| | |
|---|---|
| função de status | `getR12Audit()` |
| estados | `CONSISTENT` · `REVIEW` |
| entradas | ledger interno de eventos, `this.stats`, histórico de chutes |
| o que verifica | identidade contábil (gols decompostos = gols; finalizações = chutes; completos ≤ tentados), paridade entre 20 pares de estatística canônica/legada, chutes sem resolução, passo máximo de movimento ≤ 0,75 m |
| **o que NÃO verifica** | **nada de futebol** — nem posição, nem marcação, nem decisão, nem formação, nem lado |

**Falso positivo:** baixo para contabilidade.
**Falso negativo como gate de release: máximo.** Uma partida em que os 22
jogadores ficassem parados e a bola nunca saísse do círculo central sairia
`CONSISTENT`, porque o livro-caixa fecharia: zero gols decompostos em zero
gols, zero chutes, zero divergência.

**Como influenciava o status final:** era o número citado como prova de
qualidade (200/200). É o caso exato que o §4 proíbe: *"consistência técnica não
significa realismo futebolístico"*.

### 3.2 Observador de futebol R13 — `30-r13-football-observer.js`

| | |
|---|---|
| função de status | `getR13Audit()` |
| estados | `FOOTBALL_OBSERVER_PASS` · `FOOTBALL_OBSERVER_REVIEW` |
| amostragem | a cada 0,5 s de jogo |
| gates | `structural`, `cadence`, `ball`, `marking`, `lines`, `spatialOverload`, `restarts`, `corners` |

**Defeito estrutural 1 — não existe estado de reprovação.**
`clone.status = Object.values(gates).every(Boolean) ? 'PASS' : 'REVIEW'`.
O pior desfecho possível é `REVIEW`. A camada que deveria julgar futebol é
incapaz de dizer `FAIL`.

**Defeito estrutural 2 — status herdado (§6 proíbe explicitamente).**
```js
const structural = !this.getR12Audit() || this.getR12Audit().status==='CONSISTENT';
```
O primeiro termo é o pior: **se a camada transacional não existir, o gate passa.**
Ausência de auditoria vira aprovação.

**Defeito estrutural 3 — denominador zero vira nota máxima.** Cinco ocorrências:

| linha | expressão | com zero amostras |
|---|---|---|
| 864 | `m.dangerousThreats ? m.coveredThreats/m.dangerousThreats : 1` | cobertura **perfeita** |
| 865 | `m.dangerousThreats ? m.goalSideThreats/… : 1` | perfeita |
| 866 | `m.markerSamples ? m.closeMarkers/… : 1` | perfeita |
| 871 | `m.spatialOverloadSamples ? … : 1` | perfeita |
| 872 | `m.controlledBallSamples ? 1-m.bodyAligned/… : 0` | erro **zero** |

E dois gates com escape explícito:
```js
spatialOverload: m.spatialOverloadSamples===0 || rates.spatialOverloadCoverage>=.62,
corners:         totalGoals<2 || rates.cornerGoalShare<=.34,
```
Uma partida sem sobrecargas detectadas e com menos de 2 gols passa nos dois
gates **por não ter sido medida**. É a conversão automática de `NOT_EXECUTED`
em `PASS` que o §6 proíbe.

### 3.3 Harness de matriz — `tools/ux/probe_balllock.js`

Responsabilidade: rodar partidas headless, detectar travas de posse, montar
matriz de estilos/formações. Gates: `ppgRange`, `maxAbsGoalDiffPerMatch`,
`noDominantStyle`, `parkIdentity`, `tikiIdentity`, `allStylesCovered`.
**Não emite status final.** Produz JSON; a interpretação era humana — e foi aí
que as duas camadas ortogonais se misturaram.

### 3.4 Gate de identidade — `tools/verify_r13.py`

14 módulos vs manifesto · rebuild byte-idêntico · sintaxe · smoke estático 13/13
· cenários dirigidos 25/25. É a camada mais confiável do conjunto, e a única
que já reprovava de verdade.

### 3.5 Sondas sem ligação a status

`probe_movement.js`, `browser_anim_probe.py`, `browser_projection_probe.py`,
`browser_ux_perf_probe.py`, `browser_a11y_probe.py`, `browser_pixel_probe.py`.
Todas produzem números. **Nenhuma alimenta um gate.** Rodavam, relatavam, e o
resultado não tinha consequência sobre aprovar ou reprovar.

---

## 4. §8 confirmado: as duas camadas discordavam e o relatório não dizia

`canonicalStatus` (R12, contábil) e `observedFootball.status` (R13, futebol)
medem coisas ortogonais. O handoff registra 200/200 `CONSISTENT` contra 70/200
`PASS`, com o sub-gate `marking` reprovando em 124/200. Um relatório que cite
apenas o primeiro número descreve uma build aprovada; um que cite apenas o
segundo descreve uma build reprovada. **As duas frases eram verdadeiras.**

Causa-raiz: não havia agregador. Cada camada publicava seu próprio veredito e a
consolidação era feita por prosa.

---

## 5. Correção: agregador único (§26)

`tools/r15/aggregate_release.py` + `manifests/r15-release-gates.json`.

Propriedades exigidas pelo §6 e implementadas:

- **48 gates** cobrindo os 23 domínios do §26, cada um com pergunta explícita,
  prioridade, camada, artefato de origem, operador e limite.
- Estados reais: `PASS` · `FAIL` · `REVIEW` · `INCONCLUSIVE` · `NOT_EXECUTED` ·
  `BLOCKED`.
- **Artefato ausente → `NOT_EXECUTED`.** Nunca `PASS`.
- **`min_samples` por gate.** Amostra abaixo do mínimo → `INCONCLUSIVE`, com o
  valor registrado mas explicitamente desqualificado como evidência. É a
  correção direta do defeito 3 do observador.
- `sample_guard`: ao promediar taxas do observador, partidas com denominador
  zero são **excluídas da média** em vez de entrarem como nota máxima.
- **Nenhum status é herdado.** `CONSISTENT` da R12 é um gate entre 48.
- Regra de veredito: qualquer P0 fora de `PASS` → release `REPROVADA`.

O agregador reporta cobertura (`medidos / total`) para que a quantidade de
`NOT_EXECUTED` seja visível no topo do relatório, e não escondida — §56 proíbe
"relatório que esconda testes não executados".

---

## 6. §41 — varredura de modificadores ocultos

`tools/r15/scan_hidden_modifiers.py` cruza gatilhos proibidos (lenda,
nacionalidade, placar, minuto, momentum) com escritas de capacidade
(velocidade, aceleração, probabilidade, atributo) no HTML **que embarca**.

Resultado na R14.4: **27 trechos varridos · 8 violações de capacidade ativas ·
0 sem veredito.**

O handoff documentava **um** cluster (o buff de lenda). A varredura encontrou
**três violações adicionais que nenhum relatório anterior registrou**:

| # | local | efeito | por que é violação |
|---|---|---|---|
| 1 | `step` ~2752 | `hero.maxSpd *= 1.05` | velocidade física por lenda + placar + minuto |
| 2 | `step` ~2751 | `hero._onFire = true` | liga os bônus 3 e 4 |
| 3 | `P._dribble` R12:125 | `+5` na força de drible | roteiro, não atributo |
| 4 | `_shoot` :3822 | `base *= 1.18` | bônus direto de xG |
| 5 | estilo :2380 | `fx.ritmo *= 1.08` | **química por nacionalidade** acelera decisão do time |
| 6 | `_bestPass` :3415 | `legendPull = 0.38` | bola gravita para o rótulo `legend` |
| 7 | conversão ~5925 | **`pGoal *= 1.15`** | **+15% de gol por trait CLUTCH após o minuto 80 — NOVO** |
| 8 | `_actionContext` ~4918 | **`execution += .055`** | **qualidade de execução por trait + minuto — NOVO** |

Sobre o **#5**: o comentário no código diz que só o time montado no draft
carrega `sl.from`, então times da IA não recebem o bônus — *"a calibração dos
gates não muda"*. Isso não é atenuante, é agravante: **o time do usuário recebe
uma vantagem que a matriz de gates estruturalmente nunca mede.** O modificador
foi desenhado para ser invisível à auditoria.

Sobre **#7 e #8**: são independentes do buff de lenda. Atingem qualquer jogador
com o trait `CLUTCH_PLAYER`, tenha ou não `legend`. Removê-los é obrigatório
pelo §42 — *"traits mentais não podem criar precisão inexistente"* — e pelo §56
— *"bônus direto de gol"*, *"scripting de fim de jogo"*.

Quatro sítios foram examinados e **mantidos**, com justificativa registrada:
`urgency`/`restraint` na decisão de chutar e `_losingLate` na postura alteram
**preferência** (com que frequência tenta, quanto risco aceita), não
capacidade — o §37 permite. `importance` em `_actionContext` **reduz** execução
sob pressão de momento decisivo, mediada por compostura: é nervosismo modelado,
não buff.

---

## 7. Estado da Fase 0

| item | situação |
|---|---|
| baseline preservada e identificada | ✅ |
| reprodutibilidade da candidata | ✅ corrigida (era P0) |
| inventário das camadas | ✅ |
| defeitos do auditor provados | ✅ 3 estruturais no observador, 1 no build |
| agregador único | ✅ implementado |
| varredura de modificadores ocultos | ✅ 8 violações ativas, 0 sem veredito |
| **testes de mutação dos gates (§7)** | **pendente — próximo passo** |

O agregador ainda **não pode ser considerado confiável** até que o §7 seja
executado: injetar defeitos de propósito e provar que ele reprova. Enquanto
isso não acontecer, seu veredito é uma hipótese, não uma certificação.
