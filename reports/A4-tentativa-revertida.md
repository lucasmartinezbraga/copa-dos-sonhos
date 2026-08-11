# A4 · Segunda tentativa nos laterais, também revertida

Dois resultados negativos seguidos no mesmo alvo. O que os dois ensinam vale
mais do que o código que saiu.

## A hipótese

`_ballTravel:2416` isenta explicitamente `kind==='deflect'` de sair de campo:

```js
if (b.kind !== 'shot' && b.kind !== 'deflect' && (b.y<0||b.y>FW||b.x<0||b.x>FL)) {
  this._ballOut(); return;
}
```

E `_deflectTo` termina em `_looseBall(x,y)`, que chamava `_contestLoose()` — o
qual entrega a bola ao jogador mais próximo **sem limite de distância**.

Medido, e o número parecia decisivo:

```
_deflectTo chamado                58,2 por partida
bola solta POUSANDO fora do campo 22,2 por partida
  e entregue a alguem a            6,8 m de distancia
```

Somando à `r13`, que manda a bola solta para fora **de propósito** perto da
linha (`if(edge<5.5 && hit13(this,.64)) ty = y<FW/2 ? -.7 : FW+.7`), a leitura
era: uma camada declara "isto é lateral" e o core desfaz entregando a posse.
Padrão 4 outra vez.

## Por que estava errada

**Duas coisas, e nenhuma delas eu tinha verificado.**

**1. O ramo que editei não roda.** A camada 08 (`p04-physical-reception`)
intercepta `_looseBall` e, quando a bola está viva e o alvo está a mais de
14 cm, converte a chamada num **desvio físico** — dá velocidade à bola em
direção ao alvo e **retorna sem chamar o core**. O `_looseBall` do core está
praticamente morto para o caso vivo. Mesma classe de erro que já me custou três
rodadas nesta sessão, e desta vez eu tinha a `pilha.js` na mão e não a usei.

**2. A premissa também estava errada.** A bola não é resgatada de fora: ela vai
mesmo. O desvio físico rola em direção ao ponto e `_looseRoll` chama `_ballOut`
ao cruzar. As saídas medidas — 9,2 pela lateral e 19,7 pela linha de fundo, ~29
no total — **já vêm em boa parte desse caminho**.

O número é baixo por outra razão: o futebol real produz ~65 reinícios por
partida a partir de bola que deixa o campo (≈40 laterais + ~10 escanteios +
~15 tiros de meta) e o jogo produz ~29. **Poucas bolas são miradas para fora**,
não muitas são resgatadas.

Medição do conserto: **nenhuma das 14 métricas se moveu 0,15 SE.**
`throwIns` 15,82 → 15,90. Revertido; build byte a byte igual (`ff808761f5797656`).

## O que os dois fracassos dizem sobre o alvo

`laterais` é a métrica mais distante da faixa real (15,9 contra 33–48) e
**resistiu a dois consertos por caminhos diferentes**. Isso é informação:

- não é o arremesso (A3) — aquilo é aparência, o contador não passa por lá;
- não é resgate de bola fora (A4) — a bola sai quando é mandada para fora.

O que sobra é **a direção em que a bola é mandada**. Corte, rebote, desvio e
alívio são quase sempre mirados num ponto *dentro* do campo: os pontos de
chamada de `_deflectTo` usam `clamp(..., 2, FL-2)` quase sem exceção. No
futebol real, o corte para a linha lateral é uma jogada deliberada e frequente
— tirar a bola da zona de perigo é mais importante do que mantê-la.

Isso não é um conserto de uma linha. É uma decisão de modelo: **dar ao defensor
a opção de mandar a bola para fora**, com custo e benefício, em vez de ela ser
sempre recolocada em jogo. Fica registrado como tal, sem tentativa número três
antes de o modelo existir.

## Regra que eu não segui e devia

Antes de editar qualquer método do core, rodar:

```bash
node tools/fisica/pilha.js dist/index.html 14
```

e conferir se aquele método tem sobrescrita que não chama a de baixo. A
ferramenta existe desde a manhã de hoje, foi escrita exatamente para isto, e
eu a ignorei duas vezes.
