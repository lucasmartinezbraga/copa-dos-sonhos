# DIAGNÓSTICO — arquitetura, fluxo, autoridade e falhas

Entregável do §57. Baseado em leitura do código vivo e em medição sobre 294
partidas de matriz neutralizada, não em relatórios anteriores.

---

## 1. Identidade da baseline

| | |
|---|---|
| candidata recebida | `dist/COPA DOS SONHOS - R14.4.html` |
| SHA-256 | `7fdf183581162115344e320d5bfbada3f02f6a47e30a01948f08eba816c8b071` |
| bytes | 1 748 171 |
| base congelada | R13.0 `363d9a915a732ae99a889dab05e7f01485d58b140d64e4778ad8d5825f9818a8` |
| candidata produzida | `dist/COPA DOS SONHOS - R15.0.html` · `54a8160c7d374fed1b73def9695de3fc64629fc0fe6b31812ec1e3ebeb0c5db4` |

---

## 2. Arquitetura atual

O motor não é um arquivo: é uma **pilha de camadas que reescrevem o protótipo
`MatchSim.prototype` na ordem do documento**. A ordem em
`manifests/r13-build-manifest.json` é contrato executável — trocar dois blocos
de lugar troca qual implementação vence.

| # | módulo | papel |
|---|---|---|
| 00 | `00-head-bootstrap.js` | boot |
| 10 | `10-base-bundle.js` (1,13 MB) | dados, classe `MatchSim`, decisão, ataque, chute, UI, render |
| 20 | `20-physics-timeline.js` | trajetória física, interceptação, timeline |
| 21 | `21-p04-physical-reception.js` | recepção, bola solta, domínio, `_ballGlue` |
| 22–24 | contratos 2.5D, auditor de runtime, meta de build | render/DOM |
| 25–26 | calibrações de passe R7/R9 | apenas constantes |
| 27 | `27-r10-engine-closure.js` | contrato de contato, `transferPossession` |
| 29 | `29-r12-transactional-core.js` | **escritor de movimento**, transações de chute, livro-caixa |
| 30 | `30-r13-football-observer.js` | cadência, marcação, linha defensiva, observador |

### 2.1 Mapa de sobrescrita (quem realmente executa)

Este mapa é a informação mais importante do diagnóstico, e a mais fácil de
errar. Ancorar um patch no dono errado produz uma mudança que **embarca sem
efeito nenhum** — e isso já aconteceu duas vezes neste projeto.

| método | último dono | observação |
|---|---|---|
| `_movePlayers`, `_resolveOverlaps` | R12 (29) | escritor único de posição |
| `_integrate` | **R13 (30) → chama R12 (29)** | R13 só marca `_breaking`; a física é da R12. A do bundle base é morta. |
| `_pressAndTackle` | **R13 (30) → chama R12 (29)** | idem |
| `_dribble` | R12 (29) — **substituição total** | a do bundle base (linha 3573) é **código morto** |
| `_defendTarget` | **R13 (30) — substituição com fallback** | a do bundle base só roda para quem não é presser/marcador/cover/shadow/DEF/MID |
| `_decide` | R13 (30) → R12 (29) → base | cadeia de três |
| `_shoot`, `_bestPass`, `_actionContext` | **base (10)** | nunca sobrescritos — é onde vivia a maior parte dos modificadores ocultos |
| `_emit` | R13 (30) → R12 (29) → físico (20) → base | quatro níveis |
| `step` | R13 (30) → R12 (29) → base | R13 amostra; R12 guarda movimento |

---

## 3. Fluxo de uma jogada (§9)

```
usuário escolhe formação/estilo
   └─► autoLineup                        → slots {pos, x, y}
        └─► MatchSim(teams)              → cria 22 entidades
             └─► step(dt)   [R13 → R12 → base]
                  ├─ updateCadence13      fase coletiva (build_up / transition / final_third)
                  │     └─ reescreve decideT a CADA tick  ← ponto do P0 já corrigido
                  ├─ _assignDefRoles      define _presser, _cover, _shadow, _markRef
                  ├─ decideT -= dt
                  │   └─ se <=0 → _decide(owner)
                  │        ├─ R13: saída curta / contexto
                  │        ├─ R12: chute contextual, cruzamento
                  │        └─ base: _bestPass → pontuação de opções → _pass | _dribble | _shoot
                  ├─ _movePlayers  [R12]
                  │     └─ para cada jogador: _attackTarget | _defendTarget → (tx,ty)
                  │          └─ _integrate [R13 → R12]  → intenção de posição
                  │               └─ _resolveOverlaps → commitMovement  ← ESCRITA ÚNICA
                  ├─ _ballTravel / _ballGlue   física da bola
                  ├─ _pressAndTackle  [R13 → R12]  duelo de contato
                  ├─ _emit(evento)  [R13 → R12 → físico → base]
                  │     ├─ livro-caixa transacional (R12)
                  │     ├─ narração
                  │     └─ estatística
                  └─ guarda global de frame (R12): clampa escritores tardios
```

### 3.1 Onde uma ação pode nascer sem cadeia causal

Três pontos identificados:

1. **`_setCorner` por deflexão** (`29-…:139`) — qualquer deflexão perto da linha
   de fundo vira escanteio com 72% (cruzamento) ou 48%, por sorteio, sem que a
   bola tenha fisicamente cruzado a linha. O evento existe antes da causa.
2. **`beginShot(…, 'synthetic_travel')`** (`29-…:105`) — quando um `_startTravel`
   de tipo `shot` chega sem transação aberta, a transação é criada
   retroativamente. É reconciliação contábil, não jogada.
3. **`administrativePassBridges`** (`29-…:103`) — quando a estatística legada tem
   mais passes que o livro-caixa, a diferença é lançada como passe
   "administrativo". O número fecha; a jogada não existiu.

Os três são mecanismos de *conciliação*: fazem o livro-caixa fechar, e é
exatamente por isso que `CONSISTENT` não prova futebol.

---

## 4. Mapa de autoridade do estado (§10)

| estado | autoridade | escritores concorrentes |
|---|---|---|
| posição do jogador | **`commitMovement` (R12)** — escrita única por frame | guarda global em `step` clampa tardios |
| velocidade | derivada da posição em `commitMovement` | — |
| posição da bola | `_ballTravel` (20/21) + `_ballGlue` (21/30) | — |
| posse / último toque | `transferPossession` (27) + `_giveBall` (21) | `_turnover` (30→29→27) |
| ação atual | `p._act`, escrito por `_dribble`/`_shoot`/`_pass` | sem dono formal |
| alvo de movimento | `_tx/_ty` por `_attackTarget`/`_defendTarget` | **`_r13MarkTarget` é calculado e devolvido em `_defendTarget`, mas só quando `_markRef` existe** |
| marcador | `_assignDefRoles` (30) | — |
| evento | `_emit` — quatro camadas encadeadas | cada uma pode abortar |
| estatística | duas contabilidades paralelas: `this.stats` (legada) e o ledger R12 | conciliadas por `legacyParityErrors` |
| placar | `this.score` | — |
| status da partida | **nenhuma autoridade única** ← causa-raiz do §8 |

**O achado central de autoridade:** estatística tem *duas* fontes de verdade
mantidas em sincronia por conciliação, e status de partida não tem nenhuma.
O primeiro é gerenciável; o segundo produziu relatórios contraditórios e ambos
verdadeiros.

---

## 5. Falhas

### P0 — quebram o futebol ou invalidam a auditoria

| id | falha | evidência | estado |
|---|---|---|---|
| **AUD-001** | Auditor aprova por ausência: `!this.getR12Audit() \|\| …` | mutação `mut-audit-removed`: com o auditor deletado, `structural` passou **49/49** | corrigido no agregador |
| **AUD-002** | Observador de futebol não tem estado de reprovação (só PASS/REVIEW) | `30-…:892` | corrigido no agregador |
| **AUD-003** | Denominador zero vira nota máxima (5 sítios) | `30-…:864-872` | corrigido via `sample_guard` + `min_samples` |
| **BUILD-001** | Fonte não reconstrói a candidata: `_exp-clock` embarcava | rebuild dava `9bc436a1…` ≠ `7fdf1835…` | **corrigido** |
| **PATCH-001** | `r14-shadow-lane` altera **código morto** | A/B 49 seeds: **49/49 placares idênticos**, todas as métricas iguais a 1e-9 | documentado, patch a remover |
| **SCRIPT-001** | Buff de lenda: `maxSpd *= 1.05` + `_onFire` (+5 drible, ×1,18 xG) | `10-…:2744-2758`, `29-…:125`, `10-…:3822` | **corrigido (R15.0)** |
| **SCRIPT-002** | Química por nacionalidade acelera `decideT` do time | `10-…:2380` → `fx.ritmo` → `10-…:2728` | **corrigido (R15.0)** |
| **SCRIPT-003** | `legendPull = 0.38` — bola gravita para o rótulo `legend` | `10-…:3415` | **corrigido (R15.0)** |
| **SCRIPT-004** | `pGoal *= 1.15` para trait CLUTCH após o 80' | `10-…:3840` | **corrigido (R15.0)** — achado novo |
| **SCRIPT-005** | `execution += .055` para trait CLUTCH após o 75' | `10-…:2833` | **corrigido (R15.0)** — achado novo |
| **DEF-001** | Marcação: cobertura média 0,618 (limite 0,65) | 294 partidas, média sobre partidas com ameaça real | **aberto** |

### P1 — prejudicam fortemente o realismo

| id | falha | evidência | estado |
|---|---|---|---|
| **VER-001** | Três versões declaradas na mesma build (título R12.3, arquivo R14.4, observador R13) | `<title>` vs nome do arquivo | aberto |
| **DEF-002** | Sobrecarga espacial coberta em 0,576 (limite 0,62) | 294 partidas | aberto |
| **RULE-001** | Escanteio nasce de sorteio sobre deflexão, não de bola cruzando a linha | `29-…:139` | aberto |
| **AUD-004** | Teleporte é **inauditável**: as guardas clampam ANTES de medir, e `maxFinalStep` registra o valor já corrigido | `29-…:85` e `:90` | aberto — medir `maxRawStep` e os contadores de clamp |
| **DENS-001** | `clockRate 0.24` comprime 90 min em ~400 s de física (13,5×) | handoff, reproduzido | aberto — bloqueado por DEF-001 |

### P2 — refinamento

- Sondas de navegador, animação, projeção e performance existem e **não
  alimentam gate nenhum**.
- Narração de lenda removida junto com o buff; se o beat narrativo for desejado,
  precisa de causa mecânica real (§37 permite preferência).

---

## 6. Causa-raiz das falhas de auditoria

Nenhuma das falhas AUD-* é "o limite estava errado". Todas têm a mesma
causa estrutural:

> **O sistema tratava ausência de medição como evidência de qualidade.**

- Sem auditor → `structural` passa.
- Sem ameaça observada → cobertura 1,0.
- Sem sobrecarga observada → gate passa.
- Menos de 2 gols → gate de escanteio passa.
- Sonda que não roda → nenhum efeito no status.

E o motivo de isso sobreviver tanto tempo: **o pior veredito que qualquer
camada podia emitir era `REVIEW`.** Nada no sistema tinha o poder de dizer
`FAIL`. A correção não é ajustar limites — é dar ao agregador estados que
distinguem "medi e passou" de "não medi".

---

## 7. Arquitetura-alvo (§15) — ordem proposta

O §15 pede separação de 12 responsabilidades. A pilha atual já separa
razoavelmente **física / estado coletivo / execução / estatística**, e o
escritor único de movimento da R12 é uma boa fundação. O que falta é anterior a
isso:

1. **Camada de percepção explícita.** Hoje `_bestPass` lê o array completo de
   jogadores: conhecimento onisciente. O §20 exige que o jogador decida só com o
   que poderia ver. Isto é a mudança estrutural de maior alcance e deve vir
   antes de qualquer recalibração.
2. **Contrato de função (§18) como dado**, não rótulo. Hoje a função é inferida
   de `slotPos` em vários lugares independentes (`lineOf`, `_assignDefRoles`,
   `_attackTarget`), sem contrato único.
3. **Logger de decisão (§23)** — sem ele, "por que passou?" não tem resposta
   verificável, e o gate `decision_explainable` fica `NOT_EXECUTED` para sempre.
4. **Redesenho da posição de marcação.** As cinco tentativas de parâmetro
   registradas no handoff falharam (cobertura travada em 0,68–0,71 sob toda
   intervenção). O gargalo não é ajuste — é o cálculo da posição.
5. **Relógio.** Só depois que a marcação aguentar tempo real de bola rolando.

---

## 8. Ordem de implementação executada nesta sessão

| # | item | estado |
|---|---|---|
| 1 | Preservação, identidade, reprodutibilidade do build | ✅ |
| 2 | Inventário e auditoria das camadas de auditoria | ✅ |
| 3 | Agregador único de release (48 gates, 6 estados) | ✅ |
| 4 | Varredura de modificadores ocultos + registro de vereditos | ✅ |
| 5 | Testes de mutação dos gates | ✅ parcial (ver relatório final) |
| 6 | Remoção dos 8 modificadores ocultos → R15.0 | ✅ |
| 7 | Harness de diferenciação 97/90/80/70 | ✅ |
| 8 | A/B por patch (detector de patch inerte) | ✅ ferramenta pronta |
| 9 | Percepção, contrato de função, logger de decisão | ❌ não iniciado |
| 10 | Marcação estrutural, relógio | ❌ não iniciado |
