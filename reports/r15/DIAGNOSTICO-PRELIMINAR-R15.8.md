# Diagnóstico preliminar — Motor de partida, candidata R15.8

> Entregável obrigatório da Parte I §3 do protocolo: mapa da arquitetura, fluxo
> de jogada, inventário de sistemas e de auditorias, falhas confirmadas e
> suspeitas, evidências, causas-raiz e ordem de reconstrução — **antes** de
> qualquer alteração estrutural do motor.
>
> Método: análise estática do HTML R15.8 (SHA `a20468…dc91`) decomposto em seus
> 16 blocos de script + 5 de estilo, cruzada com o `HANDOFF-MOTOR.md`, o
> `src/r14/patches-engine.json` e a árvore `src/r13/`/`src/r14/` do branch.
> Ainda **sem execução** de matrizes/navegador (ver §Riscos e §Ordem).

---

## 0. Identidade e ressalva de escopo

Identidade completa em [`baseline-identidade-R15.8.json`](./baseline-identidade-R15.8.json).

| campo | valor |
|---|---|
| artefato | Copa dos Sonhos — R15.8 (`a20468…dc91`, 1.760.037 bytes) |
| engine declarada | `5.3.0` (rótulo de exibição `R15.8`) |
| base congelada | R13.0 (`363d9a91…`, `src/r13/`, gate `verify_r13.py`) |
| clockRate | `0.24` |

**Ressalva crítica de escopo.** O branch (`…r14-motor-vivo-auditoria-800`) tem a
árvore-fonte na **R14.4**; o artefato enviado é a **R15.8**. As mudanças R15.x
(anti-teleporte de bola parada, remoção do buff de lenda, calibrações
R15.2–R15.5) só existem **no HTML compilado**, não no `src/`. Este diagnóstico
audita o **HTML R15.8** (a versão real do usuário). A reconstrução por patch
(fluxo do handoff) exige primeiro fechar esse gap: ou o fonte R15.x é
disponibilizado, ou os deltas são extraídos do HTML e reintegrados ao `src/`.

---

## 1. Arquitetura atual — pilha de camadas

O motor **não** é um arquivo: é uma pilha de _monkey-patches_ sobre
`MatchSim.prototype`, aplicada na ordem do documento. Cada camada substitui
métodos das anteriores. **A versão viva de um método é sempre a da camada mais
tardia que o redefine** — o corpo no bundle base costuma ser código morto
(confirmado: handoff §1 e presença de `P._integrate=…`, `P._pass=…` etc. na
camada R12).

```
ordem   camada (bloco)                     engine        responsabilidade viva
─────   ────────────────────────────────   ───────────   ──────────────────────────────
 1      base bundle (06)                    "MOTOR V3"    DATA, DB, atributos, MatchSim base,
                                                          UI, canvas/render. ~11,7k linhas;
                                                          grande parte SOBRESCRITA adiante.
 2      physics-timeline (07)               R6 (581)      timeline de eventos físicos
 3      p04 physical-reception (08)         R6 (584)      recepção física; getP04ValidationReport
 4      2.5D contracts + auditor (09,10)    v02/v04       projeção 2.5D + auditor de runtime
 5      pass calibrations (12,13)           R7/R9         pesos de passe
 6      r10 engine-closure (14)             5.8.17-R10.9  POSSE por contato, recovery de bola
                                                          solta/borda, guarda de dono inválido,
                                                          CUP.simQuick; getR10Report
 7      r12 transactional-core (16)         5.9.3-R12.3   AUTORIDADE de movimento (_integrate,
                                                          _movePlayers commit-once, frame guard),
                                                          transação de chute/passe, _dribble,
                                                          _pressAndTackle, _decide (chute/cruzam.
                                                          contextual), _emit canônico; getR12Audit;
                                                          getFullFootballAudit
 8      r13 football-observer (17)          5.9.3-R13.0   FUTEBOL OBSERVÁVEL: máquina de fases,
                                                          marcação goal-side espacial, linha
                                                          sincronizada, ball glue (corpo), arremesso
                                                          físico, _defendTarget/_attackTarget,
                                                          _decide por fase; getR13Audit; reescreve
                                                          getFullFootballAudit
 9      r14 action-contract (18a)           5.9.4-R14.0   DECIDIR≠EXECUTAR: _pass/_cross/_shoot viram
                                                          contrato prep→contato→follow; a bola só sai
                                                          no contato; getR14ActionAudit
10      r15 set-piece walk (18b)            R15           anti-teleporte: _setCorner/_goalKickOrRestart/
                                                          _kickoff fotografam, adiam e CAMINHAM até o
                                                          posto (DEAD_CAP 2.2s)
11      ux (19,20)                          R15           render 2.5D, boot, CSS
```

`root.CDS_R10/CDS_R12/CDS_R13/CDS_R14` publicam versão + `targets` (faixas
estatísticas alvo) de cada camada.

---

## 2. Fluxo completo de uma jogada (cadeia causal viva)

Passo a passo real de posse com bola, com o dono de cada etapa:

1. **`step(dt)`** (empilhado: r15→r14→r13→r12→r10→base) avança o relógio de
   física. `dead>0` congela o relógio de jogo (base bundle:2662) — bola parada
   gasta tempo de física, não de partida.
2. **`updateCadence13`** (r13) classifica a fase de cada time
   (`reorganization`/`transition_attack`/`build_up`/`progression`/`final_third`
   / defensivas) e ajusta `decideT` por fase (escada `.20 < .31 < .44`).
3. **Gate de decisão do portador**: `decideT -= dt`; ao zerar chama
   **`_decide(owner)`**.
4. **`_decide`** — resolvido pela camada mais tardia aplicável: r14 bloqueia se
   há ação pendente; r13 aplica lógica por fase (outlet curto, saída do bloco
   baixo); r12 injeta chute/cruzamento contextual; o restante cai no `_decide`
   do bundle (geração+pontuação de opções: `_bestPass`, `_safePass`,
   `_openLaneAhead`, `_laneRisk`).
5. **Ação escolhida** (`_pass`/`_cross`/`_shoot`/`_dribble`): em r14 vira
   **contrato** — `prep` (0,10–0,30s conforme técnica `a8[1]`) com a bola ainda
   no pé; pode ser desarmado → `interrupted`.
6. **Contato** (fim do prep): `__r14Firing=true` → executa a MESMA ação. `_pass`
   (r12) decide enfiada vs. curto e contabiliza no ledger; `_startTravel`
   (r13→r10) fixa trajetória, drag por tipo, altura `z`, clamp de ângulo/alcance.
7. **`_ballTravel`** (r13→r12) move a bola; r12 vincula `__r122ShotId` a chutes.
8. **Reação**: `_defendTarget` (r13) posiciona presser/cover/shadow/marcadores/
   dropper e linha; `_attackTarget` (r13) posiciona apoio/largura/profundidade;
   `_pressAndTackle` (r13 cadencia → r12 executa) resolve pressão/desarme.
9. **Resolução física**: `_receive`/`_turnover`/`_deflectTo`/`_looseBall`/
   `_ballOut` (r13+r10) — recepção, dividida, corte, saída pela linha (arremesso
   físico), com posse só transferida por **contato alcançável** (r10).
10. **Evento canônico** `_emit` (r12 então r13): abre/fecha transação de chute,
    credita passe/cruzamento/escanteio/falta/cartão/impedimento; alimenta os
    contadores da fase (r13) e o ledger transacional (r12).
11. **`commitMovement`** (r12) escreve `p.x/p.y` **uma vez por frame** (com
    resolução de sobreposição e clamp de passo); a `step` de r12 tem uma
    **guarda global** que corta qualquer escritor administrativo tardio.
12. **`sampleFootball13`** (r13, a cada 0,5s) mede cobertura, distância de
    marcação, alcance de linha, alinhamento corporal, sobrecarga espacial →
    alimenta os gates de futebol.

**Onde uma ação pode nascer sem cadeia** (falha estrutural do §9): o
**escanteio por deflexão** (r12:139) cria escanteio com 72%/48% a partir de
qualquer desvio perto da linha de fundo, sem exigir contato/chute que o
justifique — ver P1-2.

---

## 3. Mapa de autoridade do estado (§10)

| estado | autoridade viva | observação |
|---|---|---|
| posição do jogador | **r12 `commitMovement`** (write-once) + frame guard | r13/r15 apenas propõem alvos (`_tx/_ty`, `_smx/_smy`, `__spTarget`) |
| intenção de movimento | r13 `_defendTarget`/`_attackTarget`; r10 recovery | |
| posição da bola (com dono) | **r13 `_ballGlue`** (orientada ao corpo) | |
| posição da bola (viajando) | r13/r10 `_startTravel` + r13 `_ballTravel` | |
| posição da bola (solta) | **r10 `recover`/`_looseRoll`** | nudge/boundary/stationary |
| posse / último toque | **r10 contact contract** (`transfer`/`_giveBall`) | turnover sem contato é CANCELADO |
| ação atual | r14 contrato (`__r14Pending`) | |
| evento | r12 `_emit` (canônico) → r13 `_emit` (fases/chain) | |
| estatística | **DUAL**: `sim.stats` (legado, bundle) + ledger r12 (`__r122State`) | cruzados por `legacyParityErrors` |
| tempo / placar | base bundle (`minute`, `score`, `stoppage`, `dead`) | |
| status / certificação | **FRAGMENTADO** (r10, r12, r13, p04, pre25d) | **sem agregador — ver Fase 0** |

Não há divergência silenciosa de _posição_ (r12 é dona única). Há, porém, dois
livros de _estatística_ conciliados por paridade, e — o ponto grave — **cinco
donos de _status_ sem consolidação**.

---

## 4. Inventário de sistemas de futebol

Presentes e vivos (camada entre parênteses):

- Percepção/decisão: `_decide`, `_bestPass`, `_safePass`, `_openLaneAhead`,
  `_laneRisk`, `shortOutlet13` (bundle+r12+r13).
- Movimentação: `_integrate` (r12), steering por `duty/effort`, `__chase`
  (perseguição só do presser + quem está ~2,5m da bola), `_resolveOverlaps`.
- Marcação/defesa: `threats13`, `_assignDefRoles` (marcador/cover/shadow/dropper),
  `desiredLine13` (linha + armadilha de impedimento), `_defendTarget`,
  `_selectPresser` (r13).
- Ataque coletivo: `_attackTarget` — largura das pontas, profundidade do runner,
  terceiro homem, defesa de descanso (cap de progressão de zagueiros) (r13).
- Física da bola: drag por tipo de passe, altura `z`/`vz`, quique, deflexão
  para linha, `_ballGlue` orientado ao corpo (r13); trajetória/alcance (r10).
- Contato: contract de posse por alcance real (r10); `_dribble` outcome-first
  (contenção é resultado válido), `_pressAndTackle` (r12).
- Regras: arremesso físico com cobrador+distância+trajetória (r13), tiro de meta,
  escanteio (organização de rest-defence), impedimento (armadilha), falta/cartão
  (`_awardFoul`/`_foulProb`), prorrogação/pênaltis (`beginExtraTime`/`shootout`).
- Goleiro: `_gkInterceptTarget`, alcance de mão/corpo por altura (r10) +
  lógica no bundle base.
- Fadiga: `stamina` com dreno por esforço/pressão/minuto tardio (bundle:2769).
- Bola parada sem teleporte: R15 walk (r14/r15).
- Contrato de ação (preparo→contato): r14.
- Traits/atributos: `getAttr`, `facet`, `a8[]`, `attributesV3`, `duelProb`.

Faltando (o §7 do handoff continua válido em R15.8): **métrica de
habilidade×sucesso (97/90/80/70)**, **log de decisão explicável** (§23/§31) e o
**agregador único de release** (§6/§26).

---

## 5. FASE 0 — Auditoria da própria auditoria (§4–§7)

### 5.1 Inventário das camadas de auditoria

| auditor | função | estados | o que verifica | risco de falso verde |
|---|---|---|---|---|
| R10 | `getR10Report` | `CANDIDATE` / `NEEDS_REGRESSION` | bola estacionária, passe não resolvido, dono inválido, transferência stale | só integridade física |
| P04 | `getP04ValidationReport` | (relatório) | validade de recepção física | escopo estreito |
| pre25d | auditor de runtime (bloco 10) | (relatório) | projeção 2.5D | visual/projeção só |
| R12 | `getR12Audit` | `CONSISTENT` / `REVIEW` | paridade de stats legado×ledger, transações de chute fechadas, `maxFinalStep≤.75` | **ALTO: "consistente" não sabe nada de futebol** |
| R13 | `getR13Audit` | `FOOTBALL_OBSERVER_PASS` / `REVIEW` | marcação, linhas, cadência, bola (corpo), sobrecarga, reinícios, escanteios | limiares justos (marcação) |
| R14 | `getR14ActionAudit` | contadores | prepared/contacted/interrupted/forced | não emite PASS/FAIL |
| — | `getFullFootballAudit` | **herda status da R12** | agrega totais + `observedFootball` | **CRÍTICO §26** |

### 5.2 Achado P0 da Fase 0 — status herdado (§26/§8), PROVADO no código

`getFullFootballAudit()` é sobrescrito **duas vezes**:

- **r12 (bloco 16:170)** define `status: this.getR12Audit().status` — ou seja, o
  status **transacional**.
- **r13 (bloco 17:899–903)** chama a versão anterior e só **anexa**
  `r.observedFootball = this.getR13Audit()`; **não** toca em `r.status`.

Resultado: `getFullFootballAudit().status` continua sendo o veredito
**transacional** (`CONSISTENT`), enquanto o veredito de **futebol** fica
enterrado em `.observedFootball.status` (`FOOTBALL_OBSERVER_PASS/REVIEW`). É
literalmente a evidência do handoff §8 (200/200 `CONSISTENT` vs 70/200 futebol):
**uma release pode passar no status agregado com o futebol reprovado.**

Não existe:
- agregador que **reprove a release se qualquer P0 de qualquer camada falhar**;
- estados `NOT_EXECUTED` / `INCONCLUSIVE` / `BLOCKED` (§6) — um gate não rodado
  hoje simplesmente não aparece;
- teste do próprio auditor por mutação (§7) — nada garante que os auditores
  **conseguem reprovar** defeitos deliberados.

**Veredito da Fase 0: o sistema de certificação NÃO é confiável ainda.** Ele
mede muita coisa certa por camada, mas o topo herda o status errado e não há
consolidação. Corrigir isto é pré-requisito para confiar em qualquer gate.

---

## 6. Falhas confirmadas — causa-raiz (§13/§14)

### P0

**P0-1 · §26/§6 — Sem agregador único; status herdado.**
Causa-raiz: `getFullFootballAudit` (16:170 + 17:899) nunca recomputa `status`;
o topo reflete só a R12. Impacto: falso verde de release. Correção proposta:
nova camada de certificação (topo) que lê R10/R12/R13/P04/pre25d, classifica
cada gate por P0/P1/P2 e estados {PASS,FAIL,REVIEW,INCONCLUSIVE,NOT_EXECUTED,
BLOCKED}, e aplica "qualquer P0=FAIL ⇒ release FAIL". Teste: mutação (§7).
Risco: baixo — camada aditiva, não altera comportamento de jogo.

**P0-2 · §27 — Buff de lenda: RESOLVIDO em comportamento, com resíduo morto.**
Causa-raiz histórica (R14.4, `10-base-bundle.js:2751-2752`):
`hero._onFire=true; hero.maxSpd*=1.05` — velocidade física + `_onFire` ligados
aos 75' com `diff` empatado/perdendo (bônus por placar + minuto + lenda: três
proibições do §27 juntas). **Em R15.8 o gatilho foi removido**: o bloco
"MOMENTO DE LENDA" (bloco 06:2749-2762) só faz `this._legendFired=true`
(flag inerte); `maxSpd*=1.05` e `_onFire=true` não existem mais. Como `_onFire`
**nunca é atribuído**, os leitores sobreviventes são código morto que nunca
dispara: `(o._onFire?7:0)` no duelo de drible (06:3610) e o glow visual
(06:11122-11124). Impacto atual: **nenhum** (inerte). Correção proposta:
remover o bloco 2749-2762, os leitores órfãos e a flag `_legendFired` — fecha o
§41 (modificadores ocultos) e impede reativação acidental. Reclassificado
**P2-limpeza** (comportamento já correto). `legendEdge` (06:3608) é baseado em
`isDribbler`/atributo de drible — legítimo (§24), apesar do nome; manter.

**P0-3 · §3/§54 — Sem prova de diferenciação de habilidade (97/90/80/70).**
Causa-raiz: nenhuma métrica isola atributo→sucesso; o §7 do handoff registra
que isso nunca foi medido. Impacto: "habilidade importa" é hipótese, não fato —
e o §54 exige provar 97>90>80>70 com diferença crescente na dificuldade.
Estado: **NOT_EXECUTED**. Correção proposta: cenário dirigido A/B com o mesmo
jogador em 4 tiers, mesma seed/contexto, medindo 1º toque, perdas sob pressão,
dribles, passes de ruptura, chances; exigir progressão monotônica. Executável
aqui (node presente) — mas sobre a fonte R14.4 até o gap R15.x fechar.

### P1

**P1-1 · §30 — Marcação estruturalmente travada.**
Causa-raiz (handoff §5, corroborado): a cobertura empaca em 0,68–0,71 sob toda
intervenção de parâmetro (5 tentativas medidas em 200 seeds, revertidas). Em
R15.8 a marcação **já dirige o movimento** (`_defendTarget` 17:561-571 lê
`_markRef` e retorna alvo — diferente do "decorativo" da R14.4), mas o gate é
justo (`threatCoverage≥.65 && markerMeanDistance≤8.5`). Impacto: sob tempo real
de jogo a marcação não aguenta (bloqueia a redução de relógio). Correção: é
estrutural, não paramétrica — redesenhar **como** a posição de marcação é
calculada (atribuição ameaça→marcador e ancoragem à linha). Risco: alto de
regressão; medir antes/depois em ≥200 seeds.

**P1-2 · §36/§9 — Escanteio "do nada" por deflexão.**
Causa-raiz (r12:139): `_turnover` transforma qualquer deflexão perto da linha
de fundo em escanteio com prob `.72` (cruzamento) / `.48`, sem exigir um
contato defensivo que o justifique fisicamente. Impacto: escanteios sem cadeia
causal (viola §9). Correção: condicionar a um bloqueio/desvio defensivo real
sobre bola com trajetória para o gol. Risco: médio (mexe em taxa de escanteios;
recalibrar o gate `corners`).

**P1-3 · §32 — Densidade de relógio.**
Causa-raiz: `clockRate=0.24` comprime 90 min em ~400s de física (13,5×). Handoff
mediu: reduzir para 0,20 aproxima gols/impedimentos do real **mas derruba
`marking` para 0,627 e reprova 87/100**. Impacto: o realismo temporal está
refém da marcação. Correção: **só após** P1-1. Risco: alto; é o último passo.

### P2

**P2-1 · §2 — Identidade de versão inconsistente.** `ENGINE_VERSION=5.3.0`,
`VERSION` variando (`5.1.0`, `5.2.2`, `5.8.7-R9`, `1.0.0`), exibição `R15.8`,
camadas `R10.9/R12.3/R13.0/R14.0`. O §2 exige que arquivo, título, manifesto,
logs, relatório e auditor declarem a MESMA versão. Correção: manifesto único de
versão consolidado pela camada de certificação.

**P2-2 · Resíduo morto** do buff de lenda (ver P0-2) e possíveis leitores
`_onFire` — limpeza.

---

## 7. Falhas suspeitas (exigem medição — ainda NÃO executada)

- Se a marcação **reconectada** da R15.8 passa de fato o gate em amostra grande
  (o código melhorou vs. R14.4; falta medir).
- `cornerGoalShare`, `bodyOrientationMismatch`, `disconnectedLineRate` em 200
  seeds na R15.8.
- Diferenciação de tiers (P0-3) — hipótese até haver número.
- Comportamento visual em navegador (perseguição à bola, giros, bola magnética,
  colisões entre companheiros) — o §49 exige olho humano em navegador real.

---

## 8. Riscos

1. **Gap de fonte R15.x** (o maior): patch sobre R14.4 não reflete a R15.8 real;
   risco de refazer/divergir do trabalho do usuário. Mitigação: fechar o gap
   antes de tocar no motor (obter fonte R15.x ou extrair deltas do HTML).
2. **Sem tooling R15 no repo** (`tools/r15/` ausente): o profiler de teleporte e
   demais aferidores R15 citados no HTML não estão versionados aqui.
3. **Execução**: node 22 e Chromium existem (matrizes headless e navegador são
   viáveis), mas rodam sobre a fonte R14.4; medir a R15.8 exige carregar o HTML
   (via Chromium ou stub de DOM em node) — a montar.
4. **Marcação**: qualquer mexida arrisca regressão; regra do handoff #11 (medir
   antes, reverter o que não move a métrica) é obrigatória.

---

## 9. Arquitetura-alvo (§15/§16)

A separação em camadas (físico → coletivo → percepção → decisão → execução →
resolução → evento → estatística → render → auditoria) **já é** essencialmente a
arquitetura-alvo: o motor R15.8 é mais bem estruturado do que o texto do
protocolo pressupõe. O que falta para fechar o alvo:

1. **Camada de certificação de topo** (§6/§26) — consumidora, não intrusiva:
   consolida todos os sub-auditores, aplica P0-fails-release e os 6 estados.
2. **Instrumentação de habilidade** (§3/§20/§24) — medir atributo→sucesso por
   ação e por tier, com explicabilidade (§23/§31).
3. **Redesenho estrutural da marcação** (§30) — o único subsistema com falha de
   projeto (não de parâmetro).
4. **Higiene de identidade** (§2) — manifesto de versão único.

O modelo espacial (corredores/faixas), os contratos de função e a forma
com/sem posse já existem de forma observável (`_attackTarget`/`_defendTarget`/
`desiredLine13`/`threats13`).

---

## 10. Ordem de reconstrução recomendada (revisada para o estado R15.8)

A ordem do handoff começava por §27 (buff de lenda). **Em R15.8 isso já está
feito** (P0-2), então a ordem muda:

1. **§26 — Agregador único de certificação** (P0-1). Primeiro: sem ele nenhum
   gate seguinte é confiável. Aditivo, baixo risco, testável por mutação (§7).
   *Pode ser feito já, sobre a fonte R14.4, como camada portável para a R15.8.*
2. **§41/§27 — Limpeza do resíduo de lenda** (P0-2→P2). Pequeno; fecha
   "modificadores ocultos".
3. **§3/§54 — Teste de tiers 97/90/80/70** (P0-3). Constrói a métrica que hoje
   não existe; executável com node.
4. **Fechar o gap de fonte R15.x** — obter/extrair os deltas R15.x para o
   `src/` antes de qualquer patch de motor.
5. **§30 — Marcação estrutural** (P1-1). Redesenho, não parâmetro; medir ≥200
   seeds antes/depois.
6. **§36 — Escanteio por deflexão** (P1-2).
7. **§32 — Densidade de relógio** (P1-3). Só depois que a marcação aguentar
   tempo real.
8. **Calibração** (Fase 11) — só após aprovação estrutural (§50).
9. **Auditoria visual em navegador** (§49) + gates finais (§52–§55).

### Regras de trabalho herdadas (handoff §11, mantidas)

- Medir ANTES de mexer; toda mudança com número antes/depois em ≥200 seeds.
- Reverter o que não move a métrica-alvo, mesmo que "faça sentido".
- Validar o teste por mutação (quebrar de propósito e conferir se acusa).
- Nunca marcar PASS sem artefato concreto vinculado ao SHA.
- Quando métrica e olho humano discordam, registrar os dois.

---

## 11. Situação da certificação (honesta, §59)

Nenhum gate está aprovado nesta etapa: o diagnóstico é **estático**, sem
matrizes nem navegador. O estado por gate P0 é:

| gate P0 | estado |
|---|---|
| Agregador único de release (§26) | **FAIL** (inexistente / status herdado) |
| Sem modificadores ocultos (§27/§41) | **PASS em comportamento**, com resíduo morto a limpar |
| Diferenciação de habilidade (§3/§54) | **NOT_EXECUTED** |
| Marcação estrutural (§30) | **INCONCLUSIVE** (melhorou vs R14.4; falta medir R15.8) |
| Densidade/relógio (§32) | **BLOCKED** (depende da marcação) |

**Baseline oficial enquanto a R15.8 não for certificada:** permanece a **R13.0**
(`363d9a91…`), que é a única congelada e verificável por SHA. A R15.8 é a
**candidata** em auditoria.
