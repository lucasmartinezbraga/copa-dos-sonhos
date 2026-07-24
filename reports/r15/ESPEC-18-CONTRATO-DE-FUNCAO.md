# §18 — Contrato de Função · especificação

Escrito depois de ler o dono **vivo** de cada rotina, não o bundle base.
Toda referência de arquivo:linha abaixo foi conferida nesta sessão.

---

## 1. Quem manda hoje

O motor tem camadas que se sobrescrevem. Para posicionamento e marcação, o dono
vivo é `src/r13/scripts/30-r13-football-observer.js`:

| rotina | base (`10-base-bundle.js`) | camada R13 | quem executa |
|---|---|---|---|
| `_assignDefRoles` | 5214 | **431** `P._assignDefRoles=function` | **R13 — substituição total.** A base é código morto. |
| `_defendTarget` | 5144 | **540** `P._defendTarget=function` | **R13**, com `oldDefend13` só no fim |
| `_attackTarget` | 4937 | **602** wrapper `oldAttack13` | R13 encapsula, base ainda roda |

### 1.1 Por que `r14-shadow-lane` nunca funcionou

`P._defendTarget` (R13) trata `presser`, passe em voo, `_markRef`, `_r13Dropper`,
`_cover`, `_shadow`, `DEF` e `MID` — e só cai em `oldDefend13.apply(...)` na
linha 597, **alcançável apenas para `line13(p) === 'FWD'`**.

O patch `r14-shadow-lane` reescreve o ramo do shadow do bundle base, que nunca
executa para um defensor. O shadow vivo está em **30-r13:580**, com
`lerp13(b.x, a.x, .40)` — 60% do caminho em direção à bola, exatamente o
comportamento que o patch dizia ter corrigido.

**Ação:** remover `r14-shadow-lane` ou reancorá-lo em 30-r13:580, em mudança
separada e medida. Hoje ele é ruído no changelog.

---

## 2. Diagnóstico: o que existe e o que falta

O handoff anterior afirma que "a marcação é recalculada do zero a cada quadro".
**Isso é meio verdade, e a metade que falta é a que importa.**

### 2.1 Existe histerese — desligada justamente sob pressão

`_assignDefRoles` (30-r13:431) começa zerando tudo:

```js
previous.set(p, p._markRef || null);
p._markRef = null; p._r13MarkTarget = null; p._r13MarkClass = null;   // :434-435
```

e depois tenta **repor** a referência anterior (:474-484):

```js
for (const p of eligible) {
  if (overload) continue;                       // :478  ← desliga a histerese
  const a = previous.get(p);
  if (!a || !threats.includes(a) || assigned.has(a)) continue;
  if (overload && availableDefs >= …) continue; // :481  ← MORTO (:478 já saiu)
  if (d13(p,a) <= 18.5 && …) bind(p, a);
}
```

Ou seja: **a persistência da marcação vale só quando NÃO há sobrecarga.**
`overload` (:451) é verdadeiro quando

```js
lastLineThreats.length >= Math.max(2, allDefs.length) || localOverload || threats.length >= 5
```

— isto é, precisamente nos momentos de área, contra-ataque e superioridade
numérica, quando a referência persistente é mais necessária. Sob pressão o motor
volta a atribuir do zero, guloso, por geometria instantânea.

**Achado de código morto:** a condição da linha 481 começa com `overload &&`,
mas a linha 478 já fez `continue` para todo caso de overload. A linha 481 nunca
avalia verdadeiro. Registrar como defeito próprio.

### 2.2 A atribuição gulosa não tem custo de troca

O segundo laço (:485-499) escolhe o marcador por escore puramente geométrico:

```js
score = |p.y - a.y| * .72 + |ownProg(p.x) - ap| * .22 + role + flank;
```

Não há termo para "este defensor já marcava outro", nem tempo mínimo de posse da
referência, nem `assignmentId`. Dois atacantes que se cruzam trocam de marcador
de graça, quadro a quadro.

### 2.3 `cover`, `shadow` e `dropper` não têm persistência nenhuma

São recalculados por `argmin` a cada chamada (:501-527). `previous` nem é
consultado. É daí que vem boa parte do aspecto de cardume no meio-campo.

### 2.4 `previous` é medido, mas não governa

A única consequência de trocar de referência é o contador:

```js
if (previous.get(best) && previous.get(best) !== a) S.metrics.markingSwitches++;  // :470
```

O motor **sabe** que trocou e **registra** que trocou, mas não **paga** por
trocar. Instrumentação sem realimentação.

### 2.5 Função é inferida em três baldes grosseiros

`line13(p)` devolve `DEF`/`MID`/`FWD`. Corredor, lado, altura e zona não
existem como conceito — são reconstruídos ad hoc em cada sítio
(`Math.abs(a.y-FW13/2)>15` para "wide", lista literal
`['LB','RB','LWB','RWB','LM','RM']` para "flank", `laneOf(y)` com terços em
`_assignDefRoles`, `p.dhy`/`p.hy` em `_defendTarget`). Quatro definições
independentes da mesma ideia.

**É esta ausência — e não a taxa de giro — que trava `marking_coverage` em
0,54–0,56.** Cinco calibrações por parâmetro já falharam contra isso.

---

## 3. O contrato

Um objeto por jogador, criado na escalação, **fonte única de verdade**, lido por
`_attackTarget`, `_defendTarget` e `_assignDefRoles` — que deixam de inferir.

```js
/** Contrato de Função — §18. Criado uma vez por jogador, por partida. */
{
  id,                    // estável na partida inteira
  slot,                  // 'LB' | 'CB' | 'CDM' | …  (declarado, não inferido)

  // ── geometria de responsabilidade ─────────────────────────────────────
  homeZone:  { x, y, rx, ry },   // elipse-base em progresso próprio (0..1)
  corridor:  'L' | 'CL' | 'C' | 'CR' | 'R',
  height:    0..1,               // altura média desejada no bloco
  width:     0..1,               // amplitude desejada
  side:      -1 | 0 | +1,        // lado do campo a que pertence

  // ── função por fase ───────────────────────────────────────────────────
  onBall,        // função com bola
  offBall,       // função sem bola
  inTransitionA, // transição ofensiva
  inTransitionD, // transição defensiva

  // ── responsabilidade defensiva ────────────────────────────────────────
  coverFor:   [id, …],   // quem este jogador cobre
  coveredBy:  [id, …],   // quem cobre a saída deste jogador
  markPriority,          // 0..1 — quanto este slot persegue referência

  // ── condições, com histerese explícita ────────────────────────────────
  leaveZoneWhen:  [cond, …],
  returnZoneWhen: [cond, …],
  minHoldSeconds,        // tempo mínimo antes de trocar de referência
  switchCost,            // penalidade no escore de atribuição
  riskTolerance,         // 0..1

  preferredActions: [], forbiddenActions: []
}
```

### 3.1 Alvo como soma de termos limitados

Substituir o `return` direto por composição auditável:

```
alvo = homeZone
     + deslocamentoDoBloco(fase, linhaDefensiva)
     + funçãoNaFase(onBall | offBall | transição)
     + ajusteLadoDaBola(corridor, side)
     + atribuiçãoDefensiva(markRef, coverFor)
     + apoio
     + emergência
```

Cada termo devolve `{dx, dy, limite, prioridade, motivo}`. A soma satura no
limite de cada termo, e o `motivo` do termo dominante vira o campo `why` do
logger de decisão (§23), hoje `NOT_EXECUTED`.

### 3.2 Marcação persistente (item D do plano)

```js
assignment = {
  assignmentId,      // estável enquanto durar
  markerId, threatId,
  since,             // tick de início — alimenta minHoldSeconds
  reason,            // 'zone' | 'threat' | 'handover' | 'emergency'
  zoneOwner,         // dono da zona onde a ameaça está
  handoverTo,        // preenchido só no gatilho explícito de transferência
}
```

Regras:

1. **A atribuição sobrevive ao quadro.** Nunca zerar `_markRef` no topo da
   função. Reavaliar, não recriar.
2. **`overload` deixa de desligar a persistência.** Sob sobrecarga o que muda é
   a *prioridade* (quem recebe sobra), não a *memória*.
3. **Custo de troca no escore:** `score += (p.assignment && p.assignment.threatId !== a.id) ? switchCost : 0`.
4. **Tempo mínimo:** só troca antes de `minHoldSeconds` por gatilho explícito
   (ameaça saiu do campo de jogo, marcador caiu, transferência de zona aceita).
5. **`cover`/`shadow`/`dropper` também persistem**, com o mesmo custo de troca.

**Alvo de aceite:** `markingSwitches` por partida cai; `marking_coverage` sai de
0,54–0,56; `spatialOverload` sobe de 28–35/294. Medir **antes** de mexer.

---

## 4. Ordem de implementação, e o que cada passo destrava

| passo | mexe em | destrava |
|---|---|---|
| 1. Criar o objeto e preenchê-lo na escalação, **sem ninguém ler** | novo módulo | nada — paridade byte a byte obrigatória |
| 2. Sonda `role_observable` lendo o contrato | `tools/r15/` | 1º dos 18 gates NOT_EXECUTED |
| 3. `_defendTarget` passa a ler `corridor`/`side`/`homeZone` | 30-r13:540 | zona canônica, lado, corredor |
| 4. Marcação persistente com `assignmentId` | 30-r13:431 | `marking_coverage`, `spatialOverload` |
| 5. Cobertura e compensação declaradas | 30-r13:501 | cardume no meio-campo |
| 6. Termo `motivo` → logger de decisão | novo | `decision_explainable` (§23) |

O passo 1 **não pode mudar uma única partida**. É o mesmo teste de inércia do
`patch_effect.py`: se a matriz de 294 mudar, o contrato vazou para o motor antes
da hora.

---

## 5. Relação com o limitador angular

A marcação deste motor é **reativa**: o marcador persegue uma referência
recalculada por geometria instantânea, então depende da taxa de reorientação —
exatamente o que o limitador angular corta.

Enquanto a marcação for reativa, limitador e marcação disputam o mesmo recurso e
qualquer ganho de fluidez sai do bolso da marcação. Com marcação
**antecipatória** — referência persistente, alvo derivado de zona e ameaça em vez
de posição atual do atacante — o marcador para de precisar de giro brusco, e o
limitador deixa de custar cobertura.

**Por isso o limitador deve ser reavaliado depois do §18, não calibrado antes
dele.** Ver `reports/r15/DECISAO-R16.md`.
