# CHECKPOINT da auditoria de 59 etapas — estado verificado

Escrito em 2026-07-23, abrindo a janela de polimento rumo ao padrão FM.
Tudo abaixo foi **medido nesta sessão**, não herdado de relatório anterior.
Onde herdei um número sem conseguir reproduzi-lo, está dito.

---

## 1. Onde o projeto está de fato

```
REPO    C:\Users\lucmartinez\Downloads\COPA%20DOS%20SONHOS%20-%20FASE%201%20-%20PACOTE%20MODULAR (1)\COPA_DOS_SONHOS_FASE_1
BRANCH  claude/r14-motor-vivo-auditoria-800   (upstream: origin/mesma)
HEAD    4c28e8cc796d1088f8be60c26a985ae3b16cc352
        "docs: handoff para reconstrucao do motor + achado P0 do buff de lenda"
NODE    %LOCALAPPDATA%\nodejs-portable\node-v24.18.0-win-x64\node.exe  (fora do PATH)
PYTHON  3.11.8 no PATH
```

O diretório de trabalho primário desta sessão (`…\Documents\CopadosSonhos`)
está **vazio** — contém só `.claude`. O repositório real é o caminho acima.

### 1.1 RISCO ABERTO: a sessão R15/R16 inteira está fora do git

`git status` acusa **5 arquivos modificados e 37 não rastreados**. Entre eles:

| não rastreado | o que é |
|---|---|
| `dist/COPA DOS SONHOS - R15.0 … R16.2.html` | 13 builds, incluindo a candidata corrente |
| `reports/r15/**` | matrizes de 294 partidas, jitter, integridade, certificação |
| `manifests/r15-release-gates.json` | os 60 gates da certificação |
| `HANDOFF-R16-POLIMENTO.md` | handoff da sessão anterior |

| modificado | o que muda |
|---|---|
| `src/r14/patches-engine.json` | 8 → 24 patches de motor (todo o trabalho R15/R16) |
| `tools/build_ux.py` | contrato `enabled:false` + `--with`/`--without` |
| `tools/ux/probe_balllock.js` | seleção de script por ID (ver §1.3) |
| `src/ux/40-match.css` | correções de campo cortado e legenda |
| `HANDOFF-MOTOR.md` | — |

**Só a R14.4 está versionada** (`dist/COPA DOS SONHOS - R14.4.html`, rastreada).
O fallback declarado no handoff está seguro; **todo o resto existe apenas na
árvore de trabalho**. Uma limpeza acidental apaga a R15.9, a R16.2, as seis
matrizes de 294 partidas e os 60 gates. Congelar isso é a ação de menor custo e
maior valor deste checkpoint.

### 1.2 Builds — hashes conferidos nesta sessão

| build | SHA-256 (16) | bytes | papel |
|---|---|---:|---|
| R14.4 | `7fdf183581162115` | 1 748 171 | fallback versionado |
| **R15.9** | `b3e105327e08296b` | 1 761 874 | **candidata segura corrente** |
| R16.0 | `b9a2096797920e52` | 1 762 683 | limitador, `bonus = 0` |
| R16.1 | `1e0e8dc36f37ba38` | 1 762 700 | limitador, `bonus = 10` |
| R16.2 | `b168fd1a8bbbaa2e` | 1 762 699 | limitador, `bonus = 6` |

Todas com integridade limpa: R13.0 byte-idêntica (`363d9a91…9818a8`), rebuild
reproduzível, sintaxe 13/13, cenários dirigidos 25/25.

### 1.3 Armadilha de ferramenta encontrada nesta sessão

`tools/r13/runner_observer_r130.js` seleciona scripts **por índice**
(`if ([4,5,10].includes(index)) return;`) e só tolera falta de DOM no índice 1.
Rodá-lo hoje **quebra** (`document is not defined` em `02-script-2.js`) e, pior,
se um script fosse inserido antes, ele puliria silenciosamente a camada de motor
errada.

O runner **vivo** é `tools/ux/probe_balllock.js`, que seleciona por `id` e
documenta o motivo no próprio código. Foi ele que produziu todas as matrizes
`real-r1xx.json`. Este é o mesmo tipo de armadilha que tornou `r14-shadow-lane`
inerte: **neste projeto, confirme quem é o dono vivo antes de usar a ferramenta,
não só antes de ancorar o patch.**

---

## 2. Estado da certificação — os 60 gates

Agregador: `tools/r15/aggregate_release.py` + `manifests/r15-release-gates.json`.

**A certificação em disco (`reports/r15/certificacao.json`) está DESATUALIZADA
em 8 builds:** foi rodada contra `ebfd0f315d37` = R15.2. A candidata corrente é
a R15.9 (`b3e10532…`). Nenhum PASS dela vale para a build de hoje — a própria
regra do projeto ("nunca marque PASS sem artefato vinculado ao SHA") a invalida.

Cobertura registrada naquela corrida:

| estado | nº | leitura |
|---|---:|---|
| PASS | 29 | |
| FAIL | 9 | |
| INCONCLUSIVE | 4 | |
| NOT_EXECUTED | 18 | **30% dos gates nunca rodaram** |
| **medidos** | **38 / 60** | veredito: **REPROVADA** |

### 2.1 Os 9 FAIL

`skill_monotonic_tiers` (P0) · `marking_coverage` (P0) · `no_teleport` (P0) ·
`teleport_max_distance` (P0) · `ball_orientation_metric_alive` (P0) ·
`disconnected_lines` (P1) · `spatial_overload_coverage` (P1) ·
`movement_raw_step` (P1) · `line_range_peak` (P1)

### 2.2 Os 18 NOT_EXECUTED — o que a auditoria nunca olhou

| domínio | gate |
|---|---|
| determinismo | `determinism_by_seed` (P0) |
| scripting | `legend_buff_ab_null` (P0) |
| formação | `formation_no_dominance` (P0) |
| funções (§18) | `role_observable` (P0) |
| percepção (§20) | `perception_no_omniscience` (P0) |
| decisão (§23) | `decision_explainable` (P0) |
| regras (§36) | `event_has_physical_cause` (P0) |
| navegador real | `browser_boot_desktop`, `browser_boot_mobile`, `browser_no_fatal_errors` (P0) |
| inspeção visual (§55) | `human_visual_approval` (P0) |
| ataque / transições / contatos / goleiros / física da bola / performance | 6 gates P1 |
| fadiga | `fatigue_behavioral` (P2) |

Onze desses dezoito são **P0**. Note que `role_observable`,
`perception_no_omniscience` e `decision_explainable` são exatamente os três
domínios que o plano de polimento ataca a seguir — hoje não há linha de base
contra a qual medir a melhora.

### 2.3 Certificação atual da candidata (produzida nesta sessão)

`manifests/r162-release-gates.json` remapeia os artefatos para os da R16.2 sem
sobrescrever nada; `reports/r15/certificacao-r162.json` é o resultado.

| | R15.2 (o que havia) | **R16.2 (atual)** |
|---|---|---|
| SHA | `ebfd0f315d37` | `b168fd1a8bbb` |
| gates | 60 | **63** (+3 do jitter) |
| PASS | 29 | **25** |
| FAIL | 9 | **12** |
| INCONCLUSIVE | 4 | **8** |
| NOT_EXECUTED | 18 | **18** |
| veredito | REPROVADA | **REPROVADA** |

**Não compare as duas colunas como efeito do limitador.** São builds diferentes
(R15.2 não é o controle da R16.x) e a disponibilidade de artefatos mudou: os
quatro INCONCLUSIVE a mais são `skill-tiers`, `modificadores-ocultos` e
`estrutura-tatica`, que continuam apontando para SHAs antigos e por isso o
agregador se recusa — corretamente — a herdar o status.

Os 12 FAIL da R16.2: `marking_coverage`, `marker_distance`, `goal_side_coverage`,
`disconnected_lines`, `spatial_overload_coverage`, `no_teleport`,
`teleport_max_distance`, `movement_raw_step`, `line_range_peak`,
`marking_coverage_worst`, `marker_distance_p95`, `ball_orientation_metric_alive`.

Os três gates novos de fluidez **passam** na R16.2 (`no_instant_turn` 0,0022;
`no_instant_turn_near_ball` 0,0079; `turn_not_frozen` 2,43) e **reprovam** na
R15.9 (0,0119 / 0,0281 / 2,50).

### 2.4 `ball_orientation_metric_alive` — a métrica está morta, e agora está provado

O gate `ball` do observador é `rates.bodyOrientationMismatch <= .10`. Medido nas
294 partidas do controle:

```
controlledBallSamples = 38 829      bodyAligned = 38 829      →  mismatch ≡ 0
```

**Nenhuma amostra desalinhada em 38 829.** `bodyOrientationMismatch` é
identicamente 0 em todas as partidas de todas as builds, então o sub-gate `ball`
passa 294/294 sem medir nada. É por isso que o gate P0
`ball_orientation_metric_alive` reprova — e está certo em reprovar.

Importa para o polimento: **orientação corporal é um dos itens que o plano FM
quer tornar reais**, e hoje a única métrica que os cobriria é tautológica.
Reconstruir a métrica é pré-requisito de medir a máquina de estados de animação.

Ferramenta: `tools/r15/subgate_power.py` (novo) mede poder discriminante de cada
sub-gate e sinaliza métrica constante.

### 2.5 Etapas §1–§59 citadas com artefato

39 das 59 etapas aparecem citadas nos produtos da R15 (§1–§10, §13, §15, §17–§27,
§30–§32, §36, §37, §40–§42, §45, §48, §53–§57, §59). As 20 restantes não têm
menção nem artefato. O texto normativo das 59 etapas **não está versionado no
repositório** — vive apenas nos prompts. Versioná-lo é pré-requisito para que
"§18" signifique a mesma coisa entre janelas.

---

## 3. Dois defeitos no critério pré-registrado da R16.0

O critério (`reports/r15/CRITERIO-R16.0-PRE-REGISTRADO.md`) foi escrito com a
disciplina certa — limites antes dos resultados. Mas o **bloco B foi ancorado na
build errada**, e isso muda o veredito.

### 3.1 O bloco B cita a R15.4, não o controle

O critério declara, para a R15.9:

| grandeza | valor no critério | de onde esse número realmente vem |
|---|---|---|
| `threatCoverage` | 0,5430 | `real-r154.json` — **R15.4** |
| `markerMeanDistance` | 8,8716 m | `real-r154.json` — **R15.4** |
| sub-gate `marking` | 1/294 "já é o piso" | `real-r154.json` — **R15.4** |

Os valores do controle **real** (R15.8/R15.9, `real-r158.json`, `a20468959f3b`),
recomputados nesta sessão a partir da matriz bruta:

| grandeza | controle real | o critério supôs | efeito |
|---|---:|---:|---|
| `threatCoverage` | **0,5591** | 0,5430 | limiar 0,530 ficou frouxo |
| `markerMeanDistance` | **8,4752 m** | 8,8716 m | limiar 8,90 ficou **0,40 m** frouxo |
| sub-gate `marking` | **3/294** | 1/294 | piso declarado abaixo do real |

Confirmação independente: o próprio `CHANGELOG-R15.md`, na tabela do veredito da
R15.4, registra "dist. marcador 8,87 · cobertura ameaça 0,5430". São os mesmos
números. O critério copiou a linha da build reprovada.

**Consequência.** A tolerância pretendida era "controle + 0,03" = **8,5052 m**.
O limiar aplicado foi 8,90 m. Sob o limiar pretendido, R16.0 (8,6639) e R16.2
(8,6077) **também reprovam por distância do marcador**, não só pelo sub-gate.

### 3.2 O controle declarado nunca rodou a matriz

O critério declara controle R15.9 `b3e10532…`. Não existe `real-r159.json`:
`evaluate_r160.py` cai para `real-r158.json` com o comentário "R15.8/R15.9 =
mesmo motor".

**Verifiquei essa suposição e ela procede.** Diff das duas builds: 48 linhas,
todas dentro de um bloco `<style>` — a faixa própria da narração (`.narr`) e a
altura do canvas. Zero linhas de motor. O layout de scripts é idêntico
(16 scripts, `script-2` com 1 130 707 bytes nos dois). Como o laboratório roda
headless e só executa o motor, `real-r158.json` é controle **válido** para a
R15.9.

Ou seja: o defeito 3.2 é de rastreabilidade, não de medição. O defeito 3.1 é de
medição e **muda o veredito**.

---

## 4. O que este checkpoint NÃO fecha

Registrado para não ser reinterpretado depois como concluído:

- a certificação dos 60 gates **não foi re-rodada** contra a R15.9;
- 18 gates seguem NOT_EXECUTED, 11 deles P0;
- `_resolveOverlaps` (`29-r12-transactional-core.js:81`) segue escrevendo posição
  fora do integrador — resíduo de 3,2% de giro brusco dentro de 1,7 m, em 0,26%
  dos quadros. **Fora do escopo do limitador, por decisão pré-registrada**;
- `r14-shadow-lane` segue embarcado e **inerte** (A/B: 49/49 placares idênticos);
- `r15-drop-legend-pass-pull` removeu o único termo em que a qualidade do
  receptor pesava no passe. O §54 exige que o jogador de elite influencie o
  coletivo. Pendência aberta.

---

## 5. Decisão do limitador angular

Ver `reports/r15/DECISAO-R16.md` — depende da matriz da R16.1, que fecha a curva
de troca com três pontos em vez de dois.
