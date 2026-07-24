# Critério de aceite do §18 (Contrato de Função) — PRÉ-REGISTRADO

**Escrito em 2026-07-23, ANTES da primeira linha do Contrato de Função.**
Qualquer alteração depois de ver resultado invalida a certificação do §18.

Corrige, por construção, as duas falhas do critério da R16.0:
baseline ancorada no controle real, e nenhum sub-gate vira bloqueio sem ter
poder discriminante verificado.

| | |
|---|---|
| controle | **R16.2** `b168fd1a…266626a3b47` · matriz `reports/r15/real-r162.json` |
| variável | Contrato de Função (§18) e marcação persistente |
| amostra | 294 partidas, elencos reais, mesmas seeds |
| patamar histórico | R15.8/R15.9 (`real-r158.json`) — o que havia antes do limitador |

---

## 0. Portão de paridade — obrigatório antes de qualquer medição

O passo 1 do §18 (criar o objeto e preenchê-lo, **sem ninguém ler**) tem de
produzir:

- **294/294 placares idênticos** ao controle;
- todas as métricas agregadas iguais até **1e-9**.

Se a matriz mudar, o contrato vazou para o motor antes da hora. **Reverte, não
ajusta.** Só depois de passar este portão as condições abaixo entram em vigor.

---

## 1. A dívida da R16.2 tem de ser paga

Não basta "não piorar". O §18 existe para destravar marcação; se ele não
recuperar o que o limitador custou, não cumpriu seu propósito.

- `threatCoverage` ≥ **0,5591** — o patamar da R15.8/R15.9, não o da R16.2
- `markerMeanDistance` ≤ **8,4752 m** — idem

*(R16.2 hoje: 0,5517 e 8,6077. A dívida é de +0,0074 e −0,133 m.)*

## 2. O ganho próprio do §18

O contrato promete marcação **antecipatória** e persistente. Isso tem assinatura
mensurável própria:

- `markingSwitches` por partida cai ≥ **25%** contra o controle
  *(hoje o contador existe em `S.metrics.markingSwitches` e não governa nada)*
- fração de quadros com `overload` **sem** referência persistente cai a ≤ **0,10**
  *(hoje é 1,00: `30-r13-football-observer.js:478` descarta toda a memória sob overload)*
- gate `role_observable` sai de **NOT_EXECUTED** para medido

## 3. Nada de regressão nos ganhos já pagos

- `fracao_giros_bruscos_25g` ≤ **0,004** (R16.2: 0,0022)
- `fracao_giros_bruscos_perto_da_bola` ≤ **0,012** (R16.2: 0,0079)
- `giroMedio_graus_por_quadro` ≥ **1,9** (R16.2: 2,43)
- `ppgRange` ≤ **0,50** e nenhum estilo perde mais de **0,35 ppg**
  *(R16.2: 0,369 e 0,226 — o §18 não pode desfazer isso)*

## 4. Futebol dentro de faixa

- gols/jogo entre **2,80 e 3,45**
- chutes/jogo entre **18,0 e 23,0**
- passes/jogo entre **172 e 190**
- impedimentos/jogo entre **2,8 e 4,6**

## 5. Integridade

- consistência transacional **294/294 CONSISTENT**
- R13.0 byte-idêntica · build reproduzível · smoke 13/13 · cenários 25/25
- teleportes/partida ≤ **25** (R16.2: 16,4)

---

## Regra de decisão

- **APROVA** se 0, 1, 2, 3, 4 e 5 forem todas satisfeitas.
- **REPROVA** se 0 falhar (o passo de paridade vazou) ou se 3 falhar (o §18
  desfez ganho já pago).
- **AJUSTA** se 1 ou 2 falharem mas 0, 3, 4 e 5 passarem — o contrato está certo,
  a parametrização de persistência é que não está. Permitido ajustar
  `minHoldSeconds`, `switchCost` e `markPriority`. **Proibido** criar exceção por
  papel, nome, formação, estilo ou proximidade da bola.

## Uso de sub-gates: regra nova

**Nenhum sub-gate do observador pode bloquear promoção sem passar antes por
`tools/r15/subgate_power.py`.** Um sub-gate cuja taxa de passagem esteja fora da
faixa [5%, 95%] em todas as builds mede cauda, não comportamento, e entra no
relatório como informação — nunca como bloqueio.

Isto vale, hoje, para: `marking`/`threatCoverage` (0–3/294),
`lines`/`disconnectedLineRate` (0–1/294), `lines`/`defensiveLineMeanRange`
(294/294) e `ball`/`bodyOrientationMismatch` (métrica constante).

## Fora de escopo desta etapa

- `_resolveOverlaps` — ver `RESIDUO-RESOLVE-OVERLAPS.md`
- `r14-shadow-lane` inerte — remover ou reancorar em mudança separada
- métrica de orientação corporal tautológica — reconstruir antes de medir animação
- `r16-foul-restarts-ball` — registrado com `enabled:false`, matriz própria
