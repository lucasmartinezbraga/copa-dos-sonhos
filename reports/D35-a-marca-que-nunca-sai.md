# D35 · A marca de arrancada que nunca sai

**Data:** 2026-08-13 · **Sondas:** `tools/fisica/ramo-d08.js`, `ramo-d08b.js` ·
**Achado durante a recontagem obrigatória do D08.**

---

## Como apareceu

A ficha do D08 manda recontar antes de atacar. A recontagem instrumentou o topo
da pilha e atribuiu cada chamada de `_deflectTo`/`_looseBall` ao seu ponto de
chamada real. Ao medir também o alvo lateral pedido pelo `_attackTarget`, 34%
das chamadas para papéis de flanco voltaram sem `y` legível.

`JSON.stringify` imprimiu `[19.94, null]` e o `null` custou dez minutos: não era
`null`, era **NaN** — `JSON.stringify(NaN)` produz `null`. Vale como armadilha
por si só (**C5**).

---

## O defeito

`src/scripts/layers/17-cds-r13-football-observer-cadence.js`, ao armar o
cobrador do lateral:

```js
taker._breaking = taker._breaking || { throwInDuty: true };
```

`p._breaking` tem um contrato de duas chaves — `{t, dir}` — criado assim pelo
motor:

```js
p._breaking = { t: 1.4, dir: chance(0.5) ? 1 : -1 };
```

e apagado assim:

```js
if (p._breaking) { p._breaking.t -= dt; if (p._breaking.t <= 0) p._breaking = null; }
```

O objeto da camada 17 não tem `t`. `undefined - dt` é **NaN**, e **`NaN <= 0` é
falso** — então a marca nunca é apagada. **Quem cobrar um lateral fica marcado
como se estivesse em arrancada até o apito final.**

---

## O tamanho do estrago (16 partidas)

| | |
|---|---|
| quadros de jogador com marca **válida** (arrancada de verdade) | 3.402 |
| quadros de jogador com marca **envenenada** | **174.719** |
| percentual do tempo de jogo envenenado | **20,4%** |
| jogadores de linha envenenados no apito final | **6,19 de 20** |
| minuto médio do contágio | 36,6 |
| chamadas de `_attackTarget` com `ty` NaN | **18,6%** |
| chamadas de `_integrate` recebendo `ty` NaN | **902.014** (6,4%) |

A marca legítima é **51× mais rara** que a envenenada. Na prática, neste jogo
`p._breaking` significava "já cobrou um lateral".

O cobrador é escolhido entre `['LB','RB','LWB','RWB','LM','RM']` com bônus de
−2 na ordenação — ou seja, **exatamente os papéis de flanco**, que são os que o
D08 precisa ver perto da linha.

---

## Oito consequências, todas permanentes

`p._breaking` é lido em oito lugares. Para o jogador envenenado, todos passam a
valer para sempre:

| onde | o que passa a valer |
|---|---|
| `_attackTarget:3340` | `ty = clamp(ty + undefined*9, …)` → **alvo lateral NaN** |
| `_attackTarget:3339` | fica sempre **16 m à frente da bola** |
| `_attackTarget:3345` | **isento do teto de impedimento**, para sempre |
| `_movePlayers:3015` | pula a **suavização de reação** (`ballDutyEarly`) |
| `_bestPass:1377` | **+2,4** no escore — vira alvo preferencial de passe |
| `_bestPass:1434` | +0,25 na ameaça de bola em profundidade |
| `_attackTarget:3191` | `!p._breaking` → **nunca mais inicia uma arrancada real** |
| `_attackTarget:3288` | excluído do papel de `_thirdMan` |
| `_defendTarget:3471` | a defesa o trata como **perigoso** permanentemente |

O NaN é o mais visível, mas não é o pior. O pior é a isenção de impedimento
somada ao empurrão de 16 m: um terço do time de linha joga o segundo tempo
adiantado e imune ao juiz.

---

## O conserto

Duas linhas, na mesma camada que criou o problema.

**1 · o objeto passa a cumprir o contrato.** `dir: 0` porque a intenção da
camada é fazer o cobrador correr até a bola, não empurrá-lo de lado — e porque
`chance()` consumiria RNG e faria toda semente divergir por outro motivo.

```js
taker._breaking = taker._breaking ||
  { t: 1.4, dir: 0, throwInDuty: true, until: finite13(this.t) + 1.4 };
```

**2 · uma varredura por quadro** remove qualquer marca malformada ou vencida,
venha de onde vier. O decaimento do motor mora dentro de `_attackTarget`, que
não roda quando o time está defendendo — sem a varredura, a marca de um zagueiro
que cobrou o lateral sobreviveria mesmo com `t` válido.

```js
function varreArrancadaInvalida13(sim){
  const agora=finite13(sim.t);
  for(const tm of sim.teams||[]) for(const p of (tm&&tm.players)||[]){
    const br=p&&p._breaking; if(!br) continue;
    if(!Number.isFinite(+br.t)||!Number.isFinite(+br.dir)||
       (Number.isFinite(+br.until)&&agora>+br.until)) p._breaking=null;
  }
}
```

---

## O que isto NÃO é

**Não é o D08.** O D08 pergunta por que há 15,9 laterais contra 33–48 do futebol
real. Este conserto remove um NaN e uma isenção de impedimento; ele pode mexer
na largura do time, e é por isso que o D08 tem de ser medido **depois** dele —
mas a hipótese do D08 continua de pé ou cai por conta própria.

O que a recontagem do D08 já estabeleceu, e que independe deste defeito, está em
`reports/D08-a-bola-nao-vai-na-linha.md`.
