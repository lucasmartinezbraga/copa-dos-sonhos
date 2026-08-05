# RODADA OS-84 · o desfecho do chute

> Observação do dono: *"o chute pra fora nao da pra ver que é pra fora, nem o
> chute pra dentro do gol vc nao percebe que eh pra dentro do gol"*

## 1. O que eu achei, e não era o que eu tinha ido procurar

Fui atrás de um defeito de apresentação. Encontrei dois defeitos, e o segundo é
de motor.

### 1.1 O defeito de apresentação (medido)

R18.86 intocada, 27 finalizações em 4 partidas no Chromium, instrumentando
`MatchSim.prototype.step` e o desfecho de `_goal` / `_emit`:

| chute PARA FORA (23 casos) | valor |
|---|---|
| a bola congela além da linha de fundo | 0,90 a 3,00 m |
| altura em que ela congela | z de 0,45 a 1,67 m — **no ar** |
| quantos quadros congelada | **13** (0,217 s de simulação) |
| distância ao poste, quando congela | máx. 1,24 m · mín. 0,34 m |
| salto seguinte, num único quadro | **7,4 a 18,0 m**, para o pé do goleiro |

| GOL (4 casos) | valor |
|---|---|
| a bola congela além da linha | 0,90 m — **nunca entra na rede** |

Na tela, com a projeção 2.5D medida (`CDS_F25D.project`, escala s = 0,823):

```
bola de um chute para fora tipico ......  6,7 px do poste
bola de um gol rente ao mesmo poste .... 11,3 px do poste
separacao entre "entrou" e "saiu" ......  9,4 px
raio desenhado da bola .................  5,1 px
```

**Menos de dois diâmetros de bola separavam os dois desfechos**, ambos parados
no ar, atrás da mesma linha — e o gol é desenhado no palco 2.5D
pré-renderizado, ou seja **atrás da bola**. Em relógio de parede o evento
inteiro durava 0,217 s / 1,8 = **0,12 s**.

E o único marcador visual de "fora" (`:12451`) nascia no pé do **chutador**, a
uns 25 metros do gol.

### 1.2 O defeito de motor (medido) — este eu não esperava

Ao retro-projetar a reta pé→alvo até a linha de fundo, apareceu isto:

| 26 chutes "para fora" | valor |
|---|---|
| cruzaram a linha **entre os postes** | **7 (26,9 %)** |
| desses, por baixo do travessão | **7 de 7** (z de 0,49 a 1,76 m) |
| passaram por cima do travessão | **0** |
| penetração máxima dentro do gol | **1,32 m** |

**Mais de um quarto dos chutes que o jogo narra como "manda pra fora" entram no
gol.** Cruzam a linha entre as traves, por baixo do travessão, e só ficam
"fora" porque o ponto de PARADA está 2 a 3 m atrás da linha.

Mecanismo, com `arquivo:linha` (R18.86): o alvo do desfecho `miss` é posto além
da linha e com desvio lateral sorteado em torno do **centro** do gol —
`:5413`, `:5524`, `:6314`, `:6386`, `:6989`, `:7065`. `_startTravel` (`:6568`)
manda a bola em **linha reta** do pé até esse alvo. Como o alvo está 2 a 3 m
atrás da linha, o segmento cruza a linha **antes**, num ponto lateralmente mais
para dentro — tanto mais para dentro quanto mais fechado o ângulo do chute. O
desvio foi sorteado para o ponto de parada; quem decide o que o olho vê é o
ponto de cruzamento.

Isto reescreve a queixa do dono. Não é só que não dá para ver que foi para
fora: **em 27% das vezes não foi para fora.**

## 2. O que a rodada fez

Duas camadas, medidas separadamente porque têm naturezas diferentes.

### OS-84 · apresentação pura

1. **Fantasma de trajetória.** Um objeto de apresentação continua a parábola que
   o motor interrompe. Ele nasce de uma leitura de `sim.ball`, tem relógio
   próprio, e morre no quadro em que o motor devolve a posse. No gol ele para no
   fundo da rede e estufa a malha; no chute para fora ele sai do campo.
2. **A gaiola do gol desenhada na frente.** O palco 2.5D é pré-renderizado e é o
   primeiro desenho do quadro; a mesma geometria é redesenhada depois da bola,
   com a malha translúcida. A bola que cruzou fica **atrás da rede**.
3. **Veredito na linha.** Uma haste no ponto exato de cruzamento — verde quando
   entrou, vermelha quando saiu — e, no gol, o trecho da linha entre os postes
   aceso.
4. **Rótulo "PRA FORA"** em espaço de tela, com a folga medida em metros, no
   vocabulário que o próprio jogo já usa (`:13098`, `:13202`).
5. **Câmera lenta curta no desfecho do chute para fora.** Mesma alavanca do
   slow-mo que já existe em `:12507`: reduz o passo da **apresentação**, não o
   da simulação. Os 0,217 s de bola morta viram ~0,8 s de tela sem criar nem
   perder um único `sim.step`.

### OS-84B · geometria do motor

Uma camada envolve `_startTravel` e `_continueTravel`. Quando o lance é chute, o
alvo está além da linha e o desvio lateral do alvo é maior que 3,36 m — o motor
codifica GOL com `|dy| ≤ 3,35` e FORA com `|dy| ≥ 3,4`, a separação é
inequívoca — o alvo é **reprojetado** para que a reta cruze a linha por fora do
poste, com folga entre 0,28 e 1,80 m. Nenhum sorteio novo, nenhum desfecho
alterado: continua `miss`, continua tiro de meta. Só a reta muda.

## 3. Previsão registrada ANTES de medir

1. a separação de tela entre um chute que sai e um que entra **sobe**;
2. o tempo de tela do desfecho **sobe**;
3. **OS-84 sozinha**: os agregados do motor ficam **idênticos** — é patch de
   apresentação, e se um número se mover, vazou;
4. **OS-84B**: a fração de chutes "para fora" que cruzam entre os postes **cai a
   zero**. Gols/xG/escanteios **não têm direção esperada** — o desfecho de cada
   lance já estava decidido antes desta camada; o que muda é a posição dos
   corpos durante a bola morta, e daí o futuro, por caos.

## 4. Resultado

### Gate 3 — OS-84 não vazou para a simulação

Bateria `espelho_30`, base 4200000, 24 partidas:

| | gols | xG | chutes | no alvo | escanteios | passes | faltas | impressão jogo a jogo |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| R18.86 | 2,4583 | 2,3233 | 21,0833 | 7,0833 | 4,7500 | 464,583 | 13,667 | `bfd219ed7f991cba` |
| R18.87 (OS-84) | 2,4583 | 2,3233 | 21,0833 | 7,0833 | 4,7500 | 464,583 | 13,667 | `bfd219ed7f991cba` |

**Idênticos, inclusive a impressão jogo a jogo.** A camada de apresentação não
tocou a simulação.

### O que a bateria derrubou de quebra

Ao rodar a R18.86 **promovida** em seis bases em vez de três:

| semente | gols | xG |
|---:|---:|---:|
| 4200000 | 2,4583 | 2,3233 |
| 8400000 | 2,7500 | 2,1514 |
| 1260000 | 2,5000 | 2,2659 |
| 2100000 | 2,2083 | 2,1632 |
| **6300000** | **1,6667** | 2,0041 |
| 3150000 | 2,4583 | 2,1859 |
| **144 jogos** | **2,3403** | **2,1823** |

As três primeiras reproduzem, número a número, a tabela publicada no relatório
R18.86 — o instrumento está validado. **A base 6300000 dá 1,667 gol por partida
na própria build promovida, abaixo do piso de 1,8 do gate.** As três bases
publicadas eram um recorte favorável, exatamente como a R18.83 havia sido antes
dela (HANDOFF §11).

Amplitude entre bases na build promovida, sem patch nenhum: **1,08 gol** (1,667
a 2,750). O xG é muito mais estável: amplitude 0,32. **Julgar uma candidata por
gols em uma base de 24 é julgá-la por ruído** — o que confirma, com número da
própria build promovida, o que já estava anotado em memória.

## 5. Armadilhas registradas

- `cx()` / `cy()` recebem **0..1, não metros** (HANDOFF §7). Escrever metros
  joga o desenho para fora do quadro — aconteceu comigo na primeira medição
  desta sessão, e a projeção devolveu `s` negativo.
- O palco 2.5D é **pré-renderizado uma vez** e desenhado antes de tudo. Para a
  bola aparecer dentro da rede a gaiola tem de ser redesenhada dentro do
  `paintField`, na mesma transformação de câmera e com a mesma projeção.
- Na comemoração o laço **não chama `sim.step`** (o gate `celebrating` bloqueia
  em `:12609`). Um fantasma preso ao tempo de simulação congelaria junto.
- O fantasma tem de morrer no quadro em que o motor devolve a posse, ou a tela
  mostra **duas bolas**.
- O ramo da **trave** (`:6369`) usa alvo com `|dy| = 3,66` exato e `x = g.x`
  (além = 0). Se a condição de entrada da OS-84B fosse só pelo desvio lateral,
  ela moveria a bola da trave e mataria o evento `post`. Por isso a condição
  exige `alem > 0.05`.
- Três sítios criam alvo de "fora" por **`_continueTravel`** e não por
  `_startTravel` (`:5516`, `:6356`, `:6982`). A primeira versão da OS-84B
  envolvia só o segundo, e uma folga de 0,07 m escapou por ali.
