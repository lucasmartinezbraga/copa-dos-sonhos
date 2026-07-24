# Resíduo `_resolveOverlaps` — registrado, NÃO corrigido

Item declarado **fora de escopo** no critério pré-registrado da R16.0, para não
misturar duas variáveis na mesma regressão. Este arquivo existe para que o
resíduo não desapareça junto com a decisão do limitador.

---

## 1. O defeito

`src/r13/scripts/29-r12-transactional-core.js:81`

```js
P._resolveOverlaps = function () {
  …
  for (i…) for (j…) {
    … if (dd >= 1.7) continue;                    // raio de separação
    const push = Math.min(.24, (1.7 - dd) / 2);   // empurrão por par
    cp.x -= nx*push; …  cq.x += nx*push; …
  }
  for (const c of corr.values()) {
    const L = Math.hypot(c.x, c.y);
    if (L > .30) { c.x = c.x/L*.30; c.y = c.y/L*.30; }   // teto por quadro
  }
  commitMovement(this, ctx, corr);                       // escreve POSIÇÃO
};
```

A correção de sobreposição é somada **à posição**, depois que o integrador já
produziu `planned`. Não passa por `vx/vy`, não respeita `amax`, e — desde a
R16.x — **não passa pelo limitador angular**, que atua dentro de `_integrate`.

É um deslocamento instantâneo de até **0,30 m por quadro** (9 m/s a 1/30 s)
escrito por fora do modelo físico. O §33 e o §17 proíbem exatamente isso.

## 2. Tamanho medido do resíduo

`tools/r15/jitter_probe.js` estratificado por proximidade de companheiro
(R15.9, 5 seeds, 1 373 190 amostras — `reports/r15/jitter-overlap.json`):

| | giro médio (°/quadro) | fração de giros bruscos | amostras |
|---|---:|---:|---:|
| com companheiro colado (< 1,7 m) | 4,98 | **0,0362** | 2 984 |
| sem companheiro colado | 2,49 | 0,0118 | 1 370 206 |

**Leitura honesta:** estar colado **triplica** a taxa de giro brusco (3,62% contra
1,18%), mas isso acontece em apenas **0,217%** dos quadros. A contribuição do
overlap para o 1,19% global é de aproximadamente

```
0,00217 × 0,0362 ≈ 0,0000786   →  ~0,66% de todos os giros bruscos
```

Ou seja: **`_resolveOverlaps` não explica o piso de giro brusco.** Foi essa
estratificação que eliminou a hipótese e mandou a investigação para o modelo de
steering, onde o limitador angular acabou nascendo. O resíduo é real, é uma
violação de modelo, e é **pequeno**.

## 3. Por que não corrigir agora

1. Misturar com o limitador impediria atribuir qualquer regressão à mudança certa
   — a regra que esta auditoria existe para respeitar.
2. O efeito no gate é de segunda ordem: corrigir o overlap sozinho move o giro
   brusco global em ~0,00008, contra o 0,0097 que o limitador move.
3. A correção certa depende do §18: parte da sobreposição é **sintoma** de
   cardume — dois jogadores disputando a mesma responsabilidade espacial. Com
   contrato de função, a frequência de `amostras_colado` deve cair sozinha.
   Corrigir o efeito antes da causa mascararia a medição do §18.

## 4. Correção proposta, para quando chegar a vez

Trocar deslocamento instantâneo por força integrada:

```js
// em vez de somar à posição:
//   corr → commitMovement
// somar ao steering, antes do clamp de aceleração:
p._sepAx += -nx * push * K;
p._sepAy += -ny * push * K;
```

de modo que a separação:

- passe por `amax` (limite de aceleração);
- passe pelo limitador angular (não crie giro que o §33 proíbe);
- apareça em `vx/vy` e portanto na animação e na orientação corporal.

**Critério de aceite, a pré-registrar antes de medir:**

- `bruscos_com_companheiro_colado` cai de 0,0362 para ≤ 0,015;
- `amostras_colado` **não sobe** (a separação continua funcionando);
- distância mínima entre jogadores não cai abaixo de 1,4 m em p99;
- matriz de 294: gols, marcação e transacional dentro das mesmas faixas.

## 5. Situação

**ABERTO.** Não corrigido na R15.x nem na R16.x. Depende do §18 para ser medido
sem confundir causa e sintoma.
