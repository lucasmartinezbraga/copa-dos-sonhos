# RODADA OS-108 / OS-109 — onde foram os 1,56 chutes da OS-107

**Pergunta herdada:** a OS-107 põe o time na área (medido) e custa **1,5556 chute
por partida, negativo nas seis bases** — o único efeito que sobreviveu a 288
partidas. Era a condição registrada para religar o patch: *ache o canal*.

Esta rodada achou parte dele, encontrou **um defeito no próprio patch**, e mediu
o que sobrou. Todos os números abaixo são da base 4200000, 24 partidas, exceto
onde estiver dito outra coisa.

---

## 1. A suspeita mais óbvia estava morta antes de custar uma rodada

A hipótese natural era fadiga: a OS-107 alonga `dead` na falta cruzada de 1,73 s
para 5,07 s, e o pino faz jogador caminhar durante a bola morta.

**`:4859` mata isso em uma linha.** O ramo de bola morta de `step` faz `return`
**antes** do bloco de stamina (`:4912`) e antes do relógio. Bola morta não gasta
fôlego nem minuto de jogo.

Confirmado na medição, e é bom que confirme — se não batesse, a leitura do código
estaria errada:

| | R18.96 | OS-107 |
|---|---:|---:|
| tempo vivo por partida | 748,02 s | 750,55 s |
| distância por jogador | 2805,1 m | 2833,2 m |
| stamina média no fim | 45,15 | 45,35 |

Nada se move. **A hipótese de fadiga está falsificada.**

---

## 2. A decomposição — `diag_os108_onde_foram_os_chutes.js`

Todo chute atribuído a uma fase, com o tempo **vivo** de cada fase como base de
comparação (só o tempo vivo é comparável, `:4859`):

- `bola_parada` — até 2,5 s de tempo vivo após o reinício do escanteio ou da
  falta cruzada, que é a janela em que o cruzamento está no ar;
- `pos_reinicio` — de 2,5 s a 12 s do mesmo reinício;
- `jogo_corrido` — todo o resto.

| chutes por partida | R18.96 | só o pino | OS-107 |
|---|---:|---:|---:|
| **total** | 20,333 | 18,542 | 17,833 |
| bola parada | 3,042 | 2,333 | **1,500** |
| pós-reinício | 0,917 | 1,042 | **1,292** |
| jogo corrido | 16,375 | 15,167 | **15,042** |

E por minuto de tempo vivo, que é o número que não depende de quanto tempo cada
fase durou:

| chutes / min vivo | R18.96 | só o pino | OS-107 |
|---|---:|---:|---:|
| bola parada | 7,726 | 6,202 | **3,874** |
| pós-reinício | 0,715 | 0,853 | **1,066** |
| jogo corrido | 1,517 | 1,388 | 1,379 |

**A leitura, em três partes:**

1. **−1,54 na janela do cruzamento, e isso é o efeito pretendido.** A taxa cai
   pela metade porque a área passou a ser defendida: na R18.96 a falta cruzada é
   cobrada contra **0,26 defensor** dentro da área. Cruzamento em área vazia
   virando finalização não é uma qualidade que se perde — é o defeito que a
   rodada foi consertar. O número mede o conserto, não um dano.
2. **+0,38 nos 10 s seguintes, e isso é ganho.** A taxa sobe de 0,715 para 1,066
   por minuto vivo: com o time na área, o lance **continua** em vez de morrer.
   É a única fase em que a OS-107 produz mais futebol que a base.
3. **−1,33 no jogo corrido, e isso não estava explicado.** É a parte que
   interessa, e é onde esta rodada foi cavar.

---

## 3. O defeito no próprio patch — `diag_os109_papel_vazado.js`

Duas camadas **ignoram** quem carrega `_setPieceRole`:

```js
:21841  if(team==null||!actor||actor.isGK||actor._setPieceRole) return r;
:21867  if(!base||!tm||!p||p.red||p.isGK||p._setPieceRole||finite(this.dead)>.04) return base;
```

E `_setPieceRole` só é limpo por `clearCorner13` (`:17074`), que roda em
`goal|miss|post` (`:17098`), em `goal_kick` (`:17328`) e na expiração da **cadeia
de escanteio** (`:17848`) — e falta cruzada **não abre cadeia nenhuma**.

A edição E3 da OS-107 marca cinco defensores com `_setPieceRole='zone'` numa
falta cruzada, onde o núcleo não marcava ninguém. Medido:

| | R18.96 | só o pino | OS-107 | **OS-107b** |
|---|---:|---:|---:|---:|
| papéis pendurados por quadro vivo | 0,2216 | 0,1871 | **1,0222** | 0,3873 |
| quadros vivos com ao menos um | 4,47% | 3,72% | **10,48%** | — |
| p90 da sobrevida do papel | 2,133 s | 2,000 s | **28,767 s** | 4,433 s |
| sobrevida do papel `zone` | — | — | mediana **4,433 s**, máx **183,1 s** | **não sobrevive** |

**Cinco jogadores sumiam de duas camadas de movimento e ataque por até 183
segundos de jogo vivo.** Isso é bug meu, não preço do mecanismo.

**A correção (OS-107b):** devolver o papel no instante em que a bola volta a
rolar. O núcleo não marca ninguém na falta cruzada, então devolver no reinício é
o comportamento mais próximo da base.

### E quanto isso valia

| chutes por partida | R18.96 | OS-107 | **OS-107b** |
|---|---:|---:|---:|
| total | 20,333 | 17,833 | **18,125** |
| bola parada | 3,042 | 1,500 | 1,625 |
| pós-reinício | 0,917 | 1,292 | 1,250 |
| jogo corrido | 16,375 | 15,042 | **15,250** |

**+0,29 chute.** O vazamento era real e valia pouco. Não inventar que valia mais
é o ponto.

O mecanismo continua inteiro depois da correção: postos ocupados no reinício
94,3% no escanteio e 97,9% na falta, atacantes na área 2,233 e 2,957, defensores
na própria área 4,468 na falta, **zero teleporte em 2140 jogadores**.

---

## 4. O que sobra, e é o que fica aberto

**−1,13 chute no jogo corrido, causado pelo pino e não pela E3.** A prova é que
"só o pino" — que não marca papel nenhum e não vaza nada (0,1871 contra 0,2216 da
base) — perde **1,21** no jogo corrido sozinho.

A explicação candidata, **não medida**: o pino segura a forma dos dois times até
a cobrança, então o lance termina com o time que ataca comprometido dentro da
área e o resto fora da posição tática. Quando a bola é afastada, a equipe começa
a transição de uma forma comprimida e leva tempo para se reorganizar. Um sinal
compatível com isso, mas que **não** prova: retenção de posse 10 s após o
reinício cai de 12,2% para 7,9%.

Isso pode ser realismo — time real também perde a forma depois de um escanteio.
Mas é 7% do volume de finalização do jogo, e a tabela de distância do futebol
real já põe chutes em 77% do real.

**Para a próxima rodada:** meça a reorganização depois do reinício. Quanto tempo
vivo cada time leva para voltar à distância tática média, e o que acontece com a
finalização nesse intervalo. Se a demora for o canal, o conserto provavelmente é
soltar o pino de forma escalonada em vez de tudo de uma vez — mas **meça antes de
escrever**.

---

## 5. A OS-107b na bateria oficial nova — passa 6/6

`tools/r1896/bateria_oficial.sh`, 48 × 6 = 288 partidas.

| | R18.96 | OS-107b | gate |
|---|---:|---:|---|
| gols | 2,1493 | 2,0070 | 1,8–3,0 · **passa 6/6** |
| pior base | 1,9583 | **1,8125** | piso 1,8 |
| xG | 2,1695 (máx 2,307) | 2,1139 (máx 2,293) | ≤ 2,7 · **passa 6/6** |
| escanteios | 4,8785 (pior 4,417) | 4,9305 (pior 4,583) | 4–10 · **passa 6/6** |
| chutes | 19,13 | **17,59** | — |

Aplicando a regra da §3.2b do HANDOFF — acreditar em consistência entre bases,
não em média:

| | média | bases negativas | leitura |
|---|---:|---:|---|
| gols | −0,1424 | 4 de 6 | **não estabelecido** |
| escanteios | +0,0521 | 2 de 6 | **não estabelecido** |
| chutes | −1,5469 | **6 de 6** | **real** |

---

## 6. Veredito da OS-107b — PROMOVIDA, R18.97

**Passa nos três gates, e o dono do projeto decidiu promover** depois de ver o
preço com número. A build é a R18.97:

```
sha256  df4d9f284691ca5341866983c3bd1d4ffc91bbb1258d6192125cc74b67a34e66
node tools/r1896/build_r1897.js saida.html \
  --base="dist/COPA DOS SONHOS - R18.86 - JOGO DE FUTEBOL.html"
```

Reproduzida três vezes a partir da base R18.86, byte a byte.

**O que foi trocado, com número na mesa:** chutes 19,13 → 17,59 por partida
(negativo nas seis bases; de 77% para 70% do futebol real na tabela da §4 do
HANDOFF), em troca de 0,656 → 2,233 atacante dentro da área no escanteio e
0,262 → 4,468 defensor dentro da própria área na falta cruzada.

### A recomendação que foi dada antes da decisão, e que fica no registro

Eu tinha recomendado **não** promover, por uma razão que continua valendo como
aviso e que agora está no HANDOFF §4 e no topo da fila:

**A pior base fica a 0,0125 do piso.** O gate de gols tem ruído da ordem de ±0,3
(§3.2b), então 1,8125 não é "passou", é "não dá para saber". Promover uma build
que se apoia nessa margem deixa a próxima rodada **sem folga nenhuma** para
trabalhar, e o projeto já foi mordido exatamente assim: a R18.86 foi promovida e
depois reprovou o piso na base 6300000, que ninguém tinha rodado.

Some-se a isso que **1,55 chute por partida** some com o mesmo sinal nas seis
bases e só ~60% disso está explicado (a perda na janela do cruzamento, que é
intencional). Os outros ~40% são o jogo corrido, e ninguém sabe por quê.

Essa recomendação era de **prudência de margem**, não de mecanismo — em nenhum
momento o patch foi acusado de estar errado. O defeito que ele conserta é real,
está medido, e é o que o dono pediu com todas as letras. A decisão de gastar a
folga para ter o lance certo é dele, e foi tomada com os dois números na mesa.

**O que a promoção obriga daqui para a frente, e está no topo da fila:**

1. a R18.97 trabalha a **0,0125 do piso** de gols. Qualquer rodada que possa
   custar gol precisa da bateria completa antes de qualquer conclusão, e precisa
   olhar consistência entre bases em vez de média;
2. os **−1,13 chute no jogo corrido** viraram o item **A0** — é a próxima rodada,
   e recuperá-los devolve folga ao gate ao mesmo tempo que devolve futebol.
