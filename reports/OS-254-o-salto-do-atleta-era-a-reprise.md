# OS-254 · O salto do atleta desenhado é a reprise do gol

Segundo item do topo da fila, e o segundo que quase não existe.

## O viés, que aqui é pior que no engasgo

Os números antigos — "pico de 776 px numa varredura e 143 px em outra" — vêm da
varredura de fluidez, medindo **salto por chamada de desenho**. Isso tem um viés
que não é óbvio: quando a sonda derruba quadros, dois desenhos consecutivos
ficam 50 ms distantes em vez de 16,7, o atleta andou três vezes mais entre eles,
e o "salto" triplica **sem nada ter piorado no jogo**. A varredura de fluidez
envolve 23 desenhos por quadro e guarda histórico — ela derruba quadros por
construção.

`tools/fisica/tela/salto-desenhado.js` mede em **pixel por milissegundo**,
normalizado a um quadro de 60 fps.

## O desenho contínuo é limpo

| bola VIVA | passada #1 | #2 | #3 | #4 | #5 | #6 |
|---|---|---|---|---|---|---|
| mediana | 1,1 px | 0,9 | 1,0 | 1,0 | 1,1 | 1,1 |
| p99 | 3,1 px | 3,1 | 3,2 | 3,2 | 3,1 | 3,1 |

**Mediana de 1 px por quadro e p99 de 3,1 px em seis passadas.** Noventa e nove
por cento do desenho é suave, e isso é estável entre execuções.

## A cauda: uma rajada por partida, e o motor está parado nela

Em três das seis passadas apareceu **um episódio único**, sempre concentrado num
minuto só, com 17 a 21 saltos de 70 a 240 px, 1 ou 2 atletas por quadro.

Três hipóteses testadas, na ordem:

1. **Corte de câmera?** Não. Corte moveria os 22 no mesmo quadro; são 1 ou 2.
2. **Reprise de gol?** A primeira medição pareceu refutar — gol no minuto 8,3,
   saltos no 16,7.
3. **O que o motor estava fazendo?** Gravei a fita de eventos em volta:

```
NENHUM evento do motor nos 2 s em volta -- o motor estava PARADO
```

É a reprise. O laço de render tem o gate `celebrating` que **bloqueia
`sim.step`**, e a reprise avança `replay.idx += 36 * dt` — quadros gravados a
36/s desenhados a 60/s. O minuto exibido fica congelado no que a simulação
parou, e foi por isso que a comparação com o minuto do gol enganou.

Ninguém se move errado: o renderizador está tocando quadros gravados, que é a
função dele. **Item fechado.**

## O que fica de método

O piso de ruído entre duas passadas, medido no pico com bola viva, ficou entre
**110 e 228 px** — ou seja, minha própria comparação de duas passadas **não
resolve a cauda**. Só a mediana e o p99 são conclusivos aqui. Registrar isso é
o ponto: sem o piso, eu teria dito "pico 242 px" com a mesma confiança com que
digo "mediana 1,1 px", e um dos dois números não vale nada.
