# R18.45 — O RASTEIRO GANHA POSIÇÃO, E O CONJUNTO DE GATES SE REVELA INSATISFAZÍVEL

**Status: NÃO PROMOVIDA.** O patch faz exatamente o que foi projetado; o que ele
revela é que os gates de ecologia, como estão escritos, **proíbem** finalização
honesta com o volume de chutes atual.

**RC** `dist/COPA DOS SONHOS - R18.45-RC - RASTEIRO POSICIONAL (NAO PROMOVIDA).html`
SHA `94774061ff6c630656aacece89a2a3c21cdf4cff05836988678a66c805289ab1` (bônus 2,60)
**Baseline** R18.44 (`8466fd7bf6b9`) · **Patch** `tools/r1845/patch_rasteiro.js`

---

## A. O defeito

`low_cross_shot` é **44,2% de todas as finalizações** do jogo e não tinha termo
posicional nenhum:

```js
const pGoal=clamp((.16+(finish-keeper)/100*.23+ctx.execution*.09)*.82,.06,.40);
```

O sítio tem a bola e `atk.x`/`atk.y` em escopo e não usa nenhum. Medido no
instante do evento, pela posição da **bola**: distância média ao gol de **24,3 m**,
com 46% dos casos em 22–30 m e 24% além de 30 m, todos recebendo `pGoal` de
**0,204**. A tabela `CAL` do próprio motor vale 0,032 em 22–30 m e 0,015 além de
30 m. O caminho cobrava **~6× o valor posicional**.

## B. Por que trocar a constante não resolveria — o ponto técnico da rodada

Os termos de perícia e execução eram **aditivos** e valiam até +0,32:

```
(finish-keeper)/100*.23   ->  ~0,08 na faixa tipica
ctx.execution*.09         ->  ~0,09
```

A 24 m, trocar `.16` por `distanceXg(24)*ang*2 = 0,051` daria
`(0,051+0,08+0,07)*0,82 = 0,165` — praticamente o 0,204 de hoje. **A posição
continuaria sendo detalhe e a soma continuaria mandando.**

O conserto é de **forma**, não de constante: perícia e execução passam a
**modular** a base posicional em vez de somar a ela, que é exatamente a forma que
`_shoot` já usa (`base*conversionScale*angMul*(1+skill*skillInfluence)*execution`).
Assim a posição volta a ser soberana e o talento aproveita melhor a posição em vez
de substituir estar bem colocado — o princípio que o comentário de `CAL.shooting`
já declara para a finalização normal.

`_cross` é sobrescrito em `cds-r122` (~linha 16263), mas o override só registra a
janela de cruzamento e delega com `oldCross.apply`. Verificado antes de editar.

## C. O patch funciona

Base s1, n=48, três valores do bônus situacional:

| variante | xG/chute | pGoal médio do rasteiro |
|---|---:|---:|
| R18.44 | 0,1695 | 0,2042 |
| bônus 1,35 | **0,1052** | 0,0699 |
| bônus 1,90 | 0,1181 | 0,0945 |
| bônus 2,60 | 0,1318 | 0,1251 |

Com bônus 1,35 o xG/chute do jogo vai a **0,1052** — o valor do futebol real
(~0,108). O mecanismo está correto e a grandeza responde como previsto.

`COE-01` (gols/xG) permanece cumprido em todas as variantes (0,998–1,077), ou
seja, a coerência conquistada na R18.44 não foi perdida.

## D. E reprova, em três bases

| build | métrica | s1 | s2 | s3 | mediana | veredito |
|---|---|---:|---:|---:|---:|---|
| R18.44 | gols | 2,500 | 2,542 | 2,875 | **2,542** | cumpre 3/3 |
| bônus 2,60 | gols | 1,917 | 2,271 | 2,313 | **2,271** | **reprova 0/3** |
| bônus 2,60 | xG | 1,920 | 1,927 | 2,066 | 1,927 | cumpre 3/3 |
| bônus 2,60 | chutes | 14,563 | 14,750 | 15,167 | 14,750 | cumpre 3/3 |
| bônus 2,60 | no alvo | 4,063 | 4,833 | 4,646 | 4,646 | cumpre 3/3 |
| bônus 1,35 | gols | 1,646 | 1,708 | 1,813 | **1,708** | **reprova 0/3** |
| bônus 1,35 | xG | 1,528 | 1,540 | 1,544 | **1,540** | **reprova 0/3** |

Medi três bases justamente porque o efeito em `ECO-01` (−23% em s1) fica **dentro**
da banda de ruído declarada do gate (30%) — com uma base só eu não teria direito
de concluir. Com três, `ECO-01` reprova em **0/3** e não há dúvida.

Note que **até o bônus 2,60 reprova**, e ele deixa o xG/chute em 0,1318 — ainda
**22% acima** do futebol real. Não existe ajuste do bônus que torne a finalização
honesta *e* cumpra `ECO-01` no volume de chutes atual.

## E. O achado: o conjunto de gates é insatisfazível

Com `gols ≈ xG` (que `COE-01` exige e a R18.44 conquistou) e
`xG = chutes × xG/chute`, o teto de `ECO-03` fixa o máximo de gols possível:

```
gols_max = 20 chutes (teto ECO-03) × 0,108 (xG/chute honesto) = 2,16
ECO-01 exige                                                  >= 2,40
```

**Nenhum volume de chutes admitido por `ECO-03` produz gols suficientes para
`ECO-01`, se a finalização for honesta.** O piso de `ECO-01` exige 22,2 chutes,
contra teto de 20.

Isso explica o que vinha acontecendo: **os pisos de `ECO-01` e `ECO-02` eram
cumpridos porque 44–48% das finalizações estavam com preço inflado.** Não é que o
conserto quebre os gates — é que os gates dependiam do defeito.

E o teste decisivo: **futebol real reprova `ECO-03`.** Somando os dois times, o
futebol real tem ~25 chutes por partida contra teto de 20. Um gate que exclui a
referência que ele deveria representar está mal derivado — mesmo diagnóstico que
`tools/r1840/gate_eco03.md` fez pelo lado do piso, agora pelo lado do teto.

Proposta completa, com o teste de não-auto-servência, em
`tools/r1845/gate_eco_consistencia.md`. Em resumo: `ECO-03` para 17–27 e `ECO-04`
para 6–10, ambos derivados de futebol real na faixa 0,7–1,0× que a Ordem de
Serviço define para camadas de "Momento"; `ECO-01` e `ECO-02` **ficam como estão**,
porque batem com a realidade.

**Subir o teto de `ECO-03` não aprova esta candidata** — ela entrega 14,7 chutes,
dentro da faixa antiga e da nova, e reprova por `ECO-01`. A proposta não a
beneficia; ela apenas torna alcançável um estado final hoje proibido por
construção.

## F. Segundo defeito no mesmo caminho, não tocado nesta rodada

O pool de alvos do cruzamento rasteiro aceita jogadores a **até 44 m do gol**:

```js
const lowPool = tm.players.filter(p=> ... D(p.x,p.y,g.x,g.y)<44 ...);
```

E **todo cruzamento rasteiro que chega vira chute automaticamente** — o callback de
chegada faz `stats.shots++` e calcula `pGoal` direto. Ou seja, parte dos 44% não
são cruzamentos: são passes para frente resolvidos como finalização. É a raiz da
distância média de 24 m, e é uma explicação melhor do volume do que qualquer
ajuste de preço.

Não entra aqui porque a disciplina desta linhagem é um mecanismo por etapa, e
misturar preço com frequência tornaria impossível atribuir o efeito — que é
exatamente o erro que fez a R18.40B reprovar sem saber de qual metade vinha a
reprovação.

**Cuidado ao mexer nisso:** restringir o pool reduz o número de finalizações, e
`ECO-03` já está em 14,7 com piso de 12. Frequência e volume têm de ser tratados
juntos, não em sequência.

## G. Integridade da RC

| gate | resultado |
|---|---|
| TEC-04 determinismo | 8/8 e 8/8 em ordem inversa |
| TEC-03 erros de console | 0 em Chromium real |
| COE-01 gols/xG | 0,998–1,077 — coerência da R18.44 preservada |
| ESP-02/03/04 | não medidos (o patch não toca movimentação) |

## H. Recomendação

1. **Decisão do dono da matriz sobre `ECO-03`/`ECO-04`** (§E). Sem ela, finalização
   honesta é inalcançável e o jogo fica preso a um preço de chute que o próprio
   motor contradiz quando consultado sobre posição.
2. **Se a decisão vier**, a rodada seguinte junta na MESMA entrega: o preço
   posicional desta RC (bônus a calibrar em ~1,35–1,9) **mais** volume de chutes
   (`INT-03` / frequência do rasteiro, §F). Separadas, o intervalo entre elas
   reprova `ECO-01`.
3. **Se a decisão não vier**, o próximo trabalho de valor é `OS-05` (escanteios
   1,4/partida contra faixa 4–10), que é independente disso — mas registre que
   escanteios na faixa adicionam ~+0,1 a +0,26 de xG, e a folga até o teto de
   `ECO-02` na R18.44 é 0,205.

## I. Arquivos

```
dist/COPA DOS SONHOS - R18.45-RC - RASTEIRO POSICIONAL (NAO PROMOVIDA).html  94774061ff6c
tools/r1845/patch_rasteiro.js            o patch, parametrizado
tools/r1845/gate_eco_consistencia.md     a prova de insatisfazibilidade e a proposta
reports/r1845/bat_lc{1.35,2.60}_s{1,2,3}.json  bateria n=48
reports/r1845/bat_lc1.90_s1.json               varredura do bonus
reports/r1845/xg_lc*.json                      coerencia e distribuicao
```
