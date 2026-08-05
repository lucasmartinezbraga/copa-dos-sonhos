# RODADA OS-103 a OS-106 · a fila de observações de campo

Build promovida: **R18.96**, sha256
`a335bbba8aad76a40df4399bbc32ebf995116e46f0e73fcdf31b4a3fa14ca164`.
Cadeia reproduzida duas vezes byte a byte.

**Só um dos quatro itens desta rodada entrou.** Os outros foram medidos, e dois
deles foram derrubados pela própria bateria. Isto é o registro dos quatro.

---

## 1. "A precisão dos chutes ficou estranha" — parte minha, e o defeito é outro

### Medido, bola rolando, 10 partidas

| | R18.86 | R18.95 |
|---|---:|---:|
| gol | 12,4% | **14,3%** |
| defesa | 27,7% | **32,1%** |
| fora | 40,9% | **34,3%** |
| **cruza dentro das traves** | **67%** | **49%** |
| desvio mediano do centro | 2,99 m | 3,91 m |

**O desfecho melhorou** — mais gols, mais defesas, menos erros. O que mudou na
tela: antes da OS-92, 43% dos "erros" cruzavam **dentro** das traves e pareciam
quase-gol; agora todos cruzam por fora. Daí a sensação de menos pontaria, com o
jogo acertando mais.

### O defeito real, e ele é anterior a mim

```
passaramPorCimaDoTravessao: 0
```

Zero, em todas as amostras de todas as builds. **Nenhum chute do jogo passava
por cima do gol.** Todo erro era lateral, com folga ao poste comprimida entre
0,13 e 2,57 m.

A causa é um teto, não uma ausência de sorteio. Passei `z = 3,55` ao planejador
e ele devolveu `2,35`:

```js
:19691  if(target&&Number.isFinite(target.z))return clamp(target.z,0,2.35);
:19697  if(kind==='shot'){ ... return clamp(finite(base,.72),.14,1.74); }
```

Chute sem `z` explícito é travado em **1,74 m**; com `z` explícito, em **2,35 m**.
O travessão está a **2,44 m**. O motor era fisicamente incapaz de mandar por
cima, duas vezes.

### OS-104 — funciona, e **não foi promovida**

Abri uma exceção cirúrgica ao teto, só para o erro alto, com critério
determinístico (reinterpreta o desvio lateral que o motor já sorteou, sem RNG
novo):

| | R18.95 | com OS-104 |
|---|---:|---:|
| **passaram por cima do travessão** | **0** | **15 de 51 · 29,4%** |
| cruzaram entre as traves e sob o travessão | 0 | **0** ✔ |

Faixa real (~30–40%) e a garantia da OS-92 preservada. **Mas a bateria reprovou:**

| semente | gols |
|---:|---:|
| 4200000 | 2,2917 |
| 8400000 | 1,8333 |
| 1260000 | 1,8750 |
| **2100000** | **1,4583** ✗ |
| 6300000 | 2,5833 |
| 3150000 | 2,0833 |
| **média** | **2,0208** |

Uma base abaixo do piso de 1,8, e a média caiu de 2,18 para 2,02.

**Fica desligada por padrão** (`--porCima=1` religa), com o número no cabeçalho.
**Antes de promover, descubra por quê:** nenhum lance muda de desfecho, então
deveria ser caos — e 1,4583 é forte demais para caos.

---

## 2. "A forma que o jogador se aproxima pra chutar ficou estranha" — diagnosticada, patch derrubado

### Medido nos 0,6 s antes do chute

| | R18.86 | R18.96 |
|---|---:|---:|
| andou | 2,852 m | 2,998 m |
| velocidade no chute | 5,635 m/s | 5,975 m/s |
| fração dos quadros parado | 0 | 0 |
| **quadros com a bola no pé (de 19)** | **16** (p25 12) | **19** (p25 18) |

Ele não ficou parado nem lento — anda mais e mais rápido. O que mudou é que
**carrega a bola durante quase toda a janela**, porque a OS-98 fez o domínio
vincular. E aí um defeito escondido ficou exposto:

```js
_ballGlue()  :6674
  const ang = Math.atan2(g.y - o.y, g.x - o.x);   // direção do GOL
  b.x = o.x + Math.cos(ang) * 0.55; ...
```

A bola é **soldada** a exatos 0,55 m, sempre apontando para o **gol** — não para
onde ele corre. Quem se desloca de lado leva a bola flutuando ao lado do corpo.
Ela nunca quica, nunca sai do pé.

### OS-105 — **não promovida**

Reescrevi para a bola ir à frente da direção de corrida, com cadência de toque
(0,42–0,78 m). Na primeira base de 12 partidas os gols caíram para **1,4167**.
É exatamente a armadilha que registrei no cabeçalho: `_ballGlue` roda todo
quadro e afastar a bola do pé a aproxima dos adversários.

**Fora da cadeia.** Se voltar a ela, reduza o teto para perto de 0,60 m e meça
desarmes e interceptações antes da bateria.

---

## 3. OS-106 — câmera lenta em todo chute · **PROMOVIDA**

Antes, só o chute perigoso desacelerava (`xg >= 0.28`), e o xG médio por chute
gira em torno de 0,10 — a maioria passava em velocidade cheia.

Agora todo `shot_taken` entra em câmera lenta, em **dois níveis**, para a ênfase
continuar significando algo: perigoso 780 ms a 0,32; comum 520 ms a 0,45.
Uniformizar transformaria o jogo em lentidão e o momento perigoso deixaria de se
destacar.

**Impressão jogo a jogo idêntica** (`6de7e514f0607850`): apresentação pura, o
motor não foi tocado. Base 4200000 na build promovida: gols 2,4583, xG 2,2354,
escanteios 4,8333 — os mesmos da R18.95.

**Custo declarado:** ~20 chutes por partida × ~0,4 s = **~8 s numa partida de
~384 s no 2X (+2%)**. Somado à OS-84 (~10 s) e à OS-100 (~3 s), o andamento já
devolveu perto de 5% dos 35,7% que a OS-78 comprou. Se incomodar, o botão é a
duração aqui — **não** o `clockRate`.

---

## 4. O que fica aberto desta fila

| item | estado |
|---|---|
| time vai para a área no escanteio e na falta | **não iniciado** |
| física da espalmada do goleiro | **não iniciado** |
| chute por cima (OS-104) | medido, funciona, reprova gols em 1 de 6 |
| condução da bola (OS-105) | medido, derrubado na primeira base |
| **teto de 1,74 m do chute normal** | **achado novo, não investigado** |

### O teto de 1,74 m merece uma rodada própria

`:19697` trava a altura de chegada de **todo** chute em 1,74 m. O gol tem 2,44 m.
Isso significa que **o ângulo superior não existe como região de gol** — nenhuma
bola chega lá, nem para entrar, nem para o goleiro voar. É provavelmente a
explicação de várias coisas que "parecem estranhas" na finalização, e talvez
esteja ligado ao custo em gols da OS-104: se a bola nunca sobe, subir o alvo de
alguns chutes muda mais coisa do que parece.
