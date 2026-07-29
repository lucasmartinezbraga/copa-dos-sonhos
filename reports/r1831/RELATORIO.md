# R18.31 — BOLA LIVRE NA ÁREA

**Status: `PROMOVÍVEL`** · base R18.25 (`ddccf733e880`) · entrega `1377d8081a33`

Contém, acumuladas: R18.21-RC2 (replay de gol), R18.25 (entrega na área) e esta.

É a **primeira inversão de causalidade** do motor: um desfecho que era *decidido* passou a *acontecer*.

---

## A. O que mudou

O ramo `!atk` de `_cross` — cruzamento aéreo sem atacante na área, **~3,1 lances por partida** — resolvia o lance assim:

```js
if (chance(CAL.restarts.failedCrossCorner)) this._setCorner(o.team);
else this._goalKickOrRestart(1-o.team);
```

Um cara-ou-coroa entre escanteio e tiro de meta, sem ninguém tocar a bola.

Agora a bola **segue**. Quem alcançar fica com ela; quem não alcançar vê a bola sair, e o reinício nasce do último toque real.

**Nenhuma regra de futebol foi escrita.** `_ballOut()` (linha ~6927) já derivava tudo corretamente — escanteio se a defesa tocou por último, senão tiro de meta; lateral para quem não tocou. O censo mediu que ela acerta **99,3%** das vezes em que a bola de fato sai. O problema nunca foi a regra: era a bola nunca chegar até ela.

## B. A armadilha evitada

`_looseBall(x,y)` **não é** "a bola fica solta":

```js
_looseBall(x, y) {
  b.x=x; b.y=y; b.z=0; b.vx=0; b.vy=0;
  this._contestLoose();          // entrega ao mais próximo, SEM limite de distância
}
```

Foi assim que a **R18.22 inflou o xG em 30%**: a bola materializava parada na pequena área no pé de quem estivesse mais perto, mesmo a 20 m.

O caminho certo é `_looseRoll` (linha ~6538): rola com atrito, exige **1,7 m** para alguém alcançar (após 0,26 s), e chama `_ballOut()` ao cruzar a linha.

## C. Resultado — o sorteio morreu

Censo de reinícios, 12 partidas:

| | R18.25 | R18.31 |
|---|---:|---:|
| concedidos com a bola **dentro do campo** | 46 (**29,3%**) | 10 (**6,4%**) |
| a regra **concorda com a geometria** | 70,1% | **93,0%** |
| escanteios **invocados** com a bola em jogo | 37 de 47 | **8 de 18** |

Fabricação caiu **78%**. E os escanteios **reais** eram 10 e continuam 10 — o que sumiu foi só o inventado.

## D. Custo ecológico — nenhum

Bateria pareada, n=48, mesmas sementes:

| métrica | R18.25 | R18.31 | | faixa |
|---|---:|---:|---:|---|
| chutes | 12,750 | 12,208 | −4,3% | 12–20 **✓** |
| no alvo | 4,688 | 4,708 | +0,4% | 4–7 **✓** |
| xG | 2,202 | 2,171 | −1,4% | 1,8–2,7 **✓** |
| gols | 2,813 | 2,688 | −4,4% | — |
| desarmes | 7,771 | 8,021 | +3,2% | 8–22 |
| escanteios | 1,438 | 1,396 | −2,9% | 4–10 (reprova, já reprovava) |
| `cross_livre` | 0,00 | **3,10** | — | — |

Tudo dentro do ruído próprio de cada métrica. **Nenhuma faixa que passava deixou de passar.**

Ressalva honesta: `header_clear` caiu de 1,21 para 1,04 (−14%). Número pequeno, sem medição de ruído próprio — registrado, não explicado.

## E. O que isto NÃO faz

**Não cria escanteio novo.** A área continua vazia, então ninguém desvia. Escanteio segue em 1,40 contra alvo 4–10.

Isso é coerente com tudo o que foi medido: a presença agora **valeria**, mas ainda não acontece. E é justamente por isso que esta era a peça a fazer primeiro — ela funciona no mundo vazio de hoje e continua funcionando quando a área encher. Todas as tentativas de posicionamento dependiam de uma consequência que não existia.

## F. Por que abandonei o posicionamento

Quatro camadas perseguidas, todas medidas, nenhuma entregou futebol:

| | resultado |
|---|---|
| R18.23 — goleiro sai na bola | percorre 3,84 dos 9,45 m necessários (~5 m/s) |
| R18.24 — posição lateral do goleiro | efeito exatamente zero |
| R18.29 — linha desce no cruzamento | linha vai de 25,8 m a 16,0 m, jogador anda 3 m |
| R18.30 — dever defensivo na marcha | zagueiros na área 0,04 → 0,18 |

**Armadilha estrutural encontrada três vezes:** neste motor, corrigir um método base é quase sempre corrigir código morto. `_defendTarget` é reimplementado pela camada R13 (linha 16770) e nunca chama adiante — 8.392 avaliações do método base durante a fase de cruzamento, **todas de atacantes**. `_integrate` é reimplementado pela R12.2 (linha 16121). O sintoma é sempre o mesmo: **calibrações diferentes devolvendo números idênticos**. Contar execuções antes de calibrar.

## G. Próximo passo

Os outros quatro `chance()` que fabricam escanteio — `chance(.42)` no bloqueio de cruzamento, `chance(.5)` após chute, `aerialBlockCorner`, `shotBlockCorner` — podem cair um a um pelo mesmo método, cada um verificado por `censo_geometria.js`. A meta é levar a concordância geométrica de 93% para ~100%.

Depois disso, e só depois, voltar ao posicionamento: aí cada metro de recuo vira futebol, não número.
