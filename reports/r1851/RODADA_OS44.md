# RODADA OS-44 — o duelo aéreo passa a depender de quem está lá

## Correção primeiro

No relatório da OS-42/43 escrevi que **"o cruzamento aéreo não sobe"**. Está
errado. Eu li `_startTravel(o, __alvo, 'pass', ...)` e não li o fim da chamada:
ela termina em `},null,'launch')`. O cruzamento sobe — `z = 0,3`, `vz = 7`,
velocidade 24,3, arco com pico de ~1,5 m.

O que de fato aconteceu com a OS-42 v1 é diferente: o gatilho testava `z` no
**instante da chamada**, quando a bola ainda está a 0,3 m do chão. A conclusão
prática (usar gatilho geométrico) continua valendo; a explicação estava errada.
O relatório anterior já foi corrigido no arquivo.

---

## O mecanismo que apareceu ao ler o trecho inteiro

O cruzamento tem dois ramos, e o que gera `header_shot` é o de `:5411`, que
entrega direto na cabeça do atacante e **já resolve um duelo**:

```js
const def  = defs.slice().sort((a,b)=>D(a,atk)-D(b,atk))[0];   // sem limite
const pWin = duelProb(facet(atk,'head_atk')+setBoost+swing,
                      (def?facet(def,'head_def'):40)+5);        // sem distancia
```

O duelo existe. O que não existe é a **distância**. `def` é o defensor mais
próximo do atacante, sem nenhum limite: um zagueiro a 15 m entra na conta com o
atributo dele, e um zagueiro colado não ganha nada por estar colado.

### Edit

```
prox = clamp((3,2 - dDef) * 9, -22, +22)      somado ao lado do DEFENSOR
  dDef = 0,0 m  -> defensor +22
  dDef = 3,2 m  -> neutro
  dDef >= 5,6 m -> defensor -22  (atacante livre de verdade)
```

Nenhum atributo novo, nenhum RNG novo: `duelProb`, `head_atk` e `head_def` são
os mesmos. Entra só a pergunta que faltava — o defensor está lá?

---

## Medido

```
                       R18.68   R18.69
cruzamento -> chute     52,7%    44,7%    (real ~25%)
cruzamento -> corte     32,7%    38,0%    (real ~50%)

40 partidas
goals                    1.90     2.42
xg                       2.45     2.45    <- ECO-02 (<=2,7) cumprido
shots                   20.15    20.07
onTarget                 6.35     6.97
corners                  5.47     6.40    <- ECO-05 (4-10) cumprido
```

### A previsão que errei — para o lado bom

Registrei "gols 1,90: pode DESCER mais — é o risco desta rodada". **Subiram para
2,42**, perto da média real de ~2,7. O mecanismo explica: o termo de distância
corta **dos dois lados**. Zagueiro colado passa a ganhar o duelo; zagueiro a
10 m deixa de contar como oposição, e aí o atacante cabeceia limpo. Antes o
zagueiro distante entrava na conta como se marcasse, o que ao mesmo tempo
roubava gols legítimos e permitia cabeceio livre com defensor em cima.

### OS-44 sozinha não resolve

Testei sem a OS-43:

```
                    OS-42+44   OS-42+43+44
cruzamento -> chute   62,2%       44,7%
cruzamento -> corte   17,3%       38,0%
```

As três camadas fazem coisas diferentes e nenhuma substitui a outra: a OS-42 põe
o defensor no ponto de queda, a OS-43 cria a disputa na entrega vinda de fora, e
a OS-44 faz o duelo do ramo direto depender de quem está lá.

### Estrutura — as regressões da rodada anterior se desfizeram

```
                          R18.68   R18.69
gate marking reprovado     6/12     7/12
gate lines reprovado       0/12     0/12
gate swarmRate reprovado   2/12     0/12
gate severeCollapse        3/12     2/12
colunaLongeDaBola         0.0265   0.0277
salto acima de 12 m/s     0.653%   0.527%
```

`swarm` e `severeCollapse` voltaram ao normal. `marking` oscila em ±1 partida e
já está registrado como gate inadequado (teto de cobertura calculado em 73,5%).

Navegador: sem `pageerror`, sem erro de console, 7 faltas / 7 barreiras armadas.

---

## Onde a linhagem chegou

```
                R18.63 (inicio)   R18.69
corners              2.90          6.40    ECO-05 (4-10) cumprido
goals                3.27          2.42
xg                   2.84          2.45    ECO-02 (<=2,7) cumprido
blocked              0.33          ~2.3
falta com barreira   nao           sim, 9,15 m
falta direta         57% em nada   0% em nada
```

## Fica aberto

- `cruzamento -> chute` 44,7% ainda acima do real (~25%).
- gols 2,42 contra ~2,7 reais.
- salto por quadro fora de `_movePlayers` (reinícios), herdado da base.
