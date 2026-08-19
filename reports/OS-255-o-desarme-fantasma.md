# OS-255 · O desarme fantasma: gesto escolhido pelo desfecho, não pela distância

**Queixa do dono, textual:** *"qualidade do desarme da falta"* e *"quando rola
uma falta a animação não me agrada nada"*.

O que já tinha sido feito atacou o **gesto**: a OS-241 fez quem sofre falta cair
de verdade (antes era `agacha 0,30` — quatro pixels, um cambalear), a OS-237 deu
membros articulados ao carrinho, a OS-235 tirou o corte seco da troca de pose. E
o Árbitro confirmava "desarme 26 de 26".

Nada disso responde à pergunta que decide se o lance parece futebol: **os dois
corpos se encontram?** Nenhuma sonda deste projeto olhava isso — o Árbitro
pergunta se o gesto existe, não se houve contato.

## A medição que faltava

`tools/fisica/contato.js`, 36 partidas, 1634 desarmes e 824 faltas:

| invariante | resultado |
|---|---|
| D1 desarme com contato (≤1,5 m) | **826/1634 · 50,6%** · mediana 1,49 · pior 3,00 m |
| D2 falta com contato (≤1,5 m) | 638/824 · 77,4% · mediana 1,22 · pior 2,27 m |
| D3 vítima freia após a falta (≥25%) | **439/649 · 67,6%** |
| D4 bola no pé de quem desarmou (≤2,5 m) | 1495/1634 · 91,5% |
| D5 bote errado deixa os dois perto | 617/617 · 100% |

Distribuição da distância do desarme:

```
p10 0,76   p25 1,16   p50 1,45   p75 1,93   p90 2,24   p99 2,48
```

**Metade dos desarmes acontece com os corpos a mais de 1,5 m.** O motor decide o
duelo dentro de `pressRadius`, que vai de 2,25 a 3,0 m mais o alcance de pressão
— e o desfecho aplica ali. No zoom 2,0 são ~34 px/m: **2 m é um vão de uma vez e
meia a altura do boneco**. É o fantasma que se vê.

## Três defeitos na fiação, todos de apresentação

**a) O gesto saía do desfecho, não da geometria.**

```js
tackle_attempt  -> standing_tackle
tackle          -> (nada para quem desarma)
tackle_missed   -> slide_tackle
```

O bote que **dá certo a 2,2 m** era desenhado em pé — uma perna que não chega. E
o carrinho, que existe no futebol justamente para cobrir esse vão, era reservado
para o **erro**. Agora o gesto sai da distância nos três ramos, com o limiar em
**1,85 m** — o p73 medido, não um chute.

**b) Quem desarma não ganhava gesto nenhum no desarme certo.** O ramo `tackle`
vestia só a vítima. O bote do defensor vinha de `tackle_attempt`, que nasce num
ramo só — e o desarme nasce em quatro (`dribble`, `press_contact`, `press_poke`
e o do bote). Nos outros, o defensor tomava a bola **de pé, parado, sem mover
uma perna**. É o espelho do que a OS-213 achou do outro lado, onde a vítima é
que seguia correndo como se nada tivesse acontecido.

**c) Repedir o mesmo gesto o reiniciava — e isso o apagava.** O bote nasce em
dois eventos seguidos (lançamento e desfecho), os dois pedem com `force`, e
reentrar no mesmo estado zera a fase. Medido: **15 pedidos de carrinho rendiam
16 quadros desenhados** — pouco mais de um quadro por pedido. E entre os dois
eventos os corpos andam, então recalcular a distância trocava carrinho por bote
em pé **no meio do gesto**.

## O que mudou, medido

| 240 s de partida | controle | depois |
|---|---|---|
| carrinho, proporção dos pedidos | 9,3% | **13 a 23%** |
| quadros desenhados por pedido de carrinho | 10,2 | 1,1 → 2,3 → **4,4** |
| quadros por pedido de bote em pé | 1,75 | **2,9** |

O ganho em (c) é o mais sólido: o bote em pé, que é a maioria, passou a durar
**66% mais quadros** por pedido. As contagens de carrinho oscilam muito entre
partidas — são 9 a 16 ocorrências por medição — então a proporção fica anotada
como faixa, não como número.

Tudo aqui é apresentação: `pede` só escreve em `sim.__anim`, não move ninguém,
não sorteia e não muda desfecho. Smoke, verify e Árbitro passam.

## O que fica aberto, e é do motor

* **D1 continua em 50,6%.** O gesto agora é honesto — quem está longe se lança —
  mas o duelo continua sendo *decidido* a até 3 m. Fazer o desfecho esperar o
  contato é mudança de motor, com bateria, e é rodada própria.
* **D3: um terço das vítimas não perde velocidade** depois de sofrer falta.
  Contato sem consequência cinemática é o mesmo que não haver contato — e isso
  é motor, não desenho.
