# OS-253 · O engasgo de quadro era, em grande parte, a sonda

Item que estava no topo do que faltava: "engasgo de quadro, 0,40 a 0,49 por
segundo, pior caso de 240 a 509 ms — identificado e nunca atacado".

**Fui atacar e ele quase não existe.**

## A medição que faltava: o ruído da própria sonda

Esta é a dívida de método que eu tinha admitido — nunca medir o piso de ruído
dos meus instrumentos. `tools/fisica/tela/engasgo.js` corrige isso por
construção: roda **duas passadas limpas do mesmo build** antes de qualquer
conclusão, e a diferença entre elas é o mínimo que qualquer afirmação precisa
superar.

| | varredura de fluidez | medição limpa |
|---|---|---|
| engasgos por segundo | 0,40 a 0,49 | **0,11** e **0,07** |
| pior quadro | 240 a 509 ms | **62 ms** |
| mediana | 16,7 ms | 16,7 ms |
| p99 | 30 a 32 ms | **21 ms** |

**Piso de ruído medido: 0,04 engasgo/s** entre duas medidas idênticas.

A varredura de fluidez envolve os 22 desenhos de corpo e a bola a cada quadro e
guarda histórico. Isso **infla o engasgo de 4 a 7 vezes** e o pior caso de 4 a 8
vezes. Eu já tinha escrito nela o aviso de que o número era teto; agora o aviso
tem o número do teto, medido.

## O que sobra, em proporção

```
tempo total de tela      74908 ms
soma dos engasgos          197 ms   (0,3% do tempo de tela)
dentro de sim.step        7571 ms   (10,1%)  | pior passo 14 ms | 14151 passos
```

Oito engasgos em 75 segundos, o pior de 62 ms, somando 0,3% do tempo. O motor
nunca passa de 14 ms num passo — **o engasgo não é dele**.

Isso está na faixa do que um jogo em Canvas faz de qualquer jeito: coleta de
lixo e compositor do navegador. **Item fechado**, e sai do topo da fila.

## Limitação honesta desta sonda

`paintField` é de escopo de módulo, não está em `window` — então a metade do
**desenho** não pôde ser cronometrada. Sei que o motor consome 10,1% do quadro
e que o resto (89,9%) é desenho mais navegador, mas não sei a divisão entre
esses dois. Se o item voltar a importar, o caminho é expor `paintField` para
sondagem ou instrumentar por dentro da camada de render.

## A conta do dia

Sexta vez que um número alarmante se revelou instrumento meu, e a única em que
eu já havia previsto (o aviso estava escrito na sonda). A diferença é que desta
vez o aviso virou número: "é teto" não serve, "infla 4 a 7 vezes" serve.
