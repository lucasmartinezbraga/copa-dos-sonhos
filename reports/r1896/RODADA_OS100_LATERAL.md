# RODADA OS-100 · o lateral

> Observação do dono: *"Aconteceu também do Neymar ir bater o lateral e sair
> driblando."*

Esta rodada custou **três diagnósticos, dois deles meus e errados**. O registro
dos erros vale mais que o patch.

---

## 1. O sintoma, medido

8 partidas, 64 laterais (`diag_os93_lateral.js`):

| grandeza | R18.93 |
|---|---:|
| laterais por partida | 8,00 |
| **salto do cobrador no quadro do reinício** | mediana **4,864 m** · p90 7,737 · máx **10,46 m** |
| **saltos acima de 1 m** | **48 de 64 · 75%** |
| cobrador → bola no reinício | 0,483 m |
| bola andou do ponto de saída | 1,996 m |

Um salto de 4,864 m em 1/30 s são **146 m/s**. Para quem assiste, um jogador se
materializa na linha com a bola no pé.

---

## 2. Diagnóstico 1 — **errado**. "Ninguém caminha."

Li `:7180` (`_ballOut`, ramo lateral), vi o `cand.x = clamp(b.x,...)` e concluí
que ninguém caminhava até a bola. Escrevi a **OS-93**: uma seleção própria de
cobrador no instante da saída, com `__spTarget` e `__cdsTakerWait`.

**Falsificada pela medição:** o teleporte morreu (4,475 → 0,021 m) mas a bola
passou a reaparecer a **4,603 m** do ponto de saída (máx 13,285). Eu tinha criado
uma **terceira seleção** competindo com as duas que já existiam; só 17 de 41
cobradores chegavam, e `_giveBall` colava a bola em quem estivesse longe.

---

## 3. Diagnóstico 2 — **também errado**. "A máquina funciona, todos chegam."

Instrumentei quadro a quadro (`diag_os99`) e li: 44 de 44 laterais com
`__spTarget` armado, distância final ao alvo **0 em todos**, "chegou 44 de 44".

Conclusão aparente: a máquina funciona perfeitamente e o problema é outro.

**O instrumento estava contaminado.** Eu pegava o **último** jogador com
`__spTarget` **ou** `_setPieceRole === 'taker'` — e essa segunda marca pode ser
resto de outra bola parada — e depois media a distância dele ao `__spTarget`
*dele próprio*. Ele de fato chegava ao alvo dele. A pergunta é que estava errada.

---

## 4. Diagnóstico 3 — o certo

Buscar o `__spTarget` **mais próximo do ponto do lateral**, e medir a distância
ao **ponto**, não ao alvo do jogador:

| em 64 laterais | valor |
|---|---:|
| com `__spTarget` apontando para o ponto exato | **64 de 64** (distância 0,00) |
| **onde ele está no instante do reinício** | mediana **5,04 m** · p90 7,94 |
| entregaria sem teleporte (≤ 2 m) | **18 de 64** |

**Ele é armado, caminha, chega — e vai embora.** `__spTarget` é limpo no snap de
chegada (`:18259`) e, a partir daí, a IA de movimento normal o puxa de volta para
a posição tática. Quando o reinício dispara, ele está a 5 metros, e
`pendingRestart` teleporta outro qualquer.

Nada segurava o jogador na bola que ele foi buscar.

---

## 5. A correção

Duas partes, ambas reaproveitando máquina existente — **nenhuma seleção nova**:

1. **O pino.** Enquanto a bola estiver morta, `__spTarget` é re-armado a cada
   quadro para o ponto do lateral, no fim do passo, depois do movimento
   coletivo. O jogador para de abandonar a bola.
2. **A entrega.** `pendingRestart` passa a dar a bola a **quem foi armado**, se
   ele estiver a ≤ 2 m do ponto. Se ninguém chegou, cai no comportamento antigo —
   nenhum lance fica sem reinício.

## 6. Resultado

| | R18.93 | R18.94 |
|---|---:|---:|
| **salto do cobrador, mediana** | **4,864 m** | **0,109 m** |
| salto máximo | 10,46 m | **0,249 m** |
| **saltos acima de 1 m** | **48 de 64** | **0 de 58** |
| bola andou do ponto de saída | 1,996 m | **2,070 m** ✔ |
| cobrador → bola | 0,483 m | 0,474 m ✔ |
| espera até o reinício | 2,667 s | 3,100 s |

As três previsões registradas antes de medir se confirmaram — inclusive a
segunda, que existia só para testar contra o modo como a OS-93 falhou: **a bola
não se desloca do ponto**.

**Custo declarado:** +0,43 s por lateral × 7,25 laterais = **~3,1 s de bola morta
por partida**, contra os 35,7% de andamento que a OS-78 comprou.

---

## 6b. Bateria de promoção — seis bases, 144 partidas

| semente | gols | xG | chutes | escanteios | passes |
|---:|---:|---:|---:|---:|---:|
| 4200000 | 2,1667 | 1,9935 | 19,042 | 4,6667 | 441,8 |
| 8400000 | 2,0417 | 2,0691 | 18,250 | 4,2083 | 444,1 |
| 1260000 | 2,0000 | 2,1038 | 19,292 | 4,3333 | 442,9 |
| 2100000 | 2,2500 | 2,2046 | 21,042 | 5,2500 | 438,9 |
| 6300000 | **1,9583** | 1,9600 | 19,042 | 5,6250 | 442,0 |
| 3150000 | 2,3333 | 2,1286 | 18,583 | 4,5833 | 443,8 |
| **média** | **2,1250** | **2,0766** | 19,208 | **4,7778** | 442,2 |

**Gols abaixo de 1,8: 0. Escanteios abaixo de 4: 0. xG acima de 2,7: 0.**
Passa nos três gates nas seis bases — inclusive na 6300000, onde a R18.86
promovida reprova com 1,667.

Contra a R18.93: xG −4,1%, chutes −2,7%, no alvo −5,2%, faltas −5,7%,
escanteios +1,2%. Quedas pequenas, coerentes com os ~3,1 s a mais de bola morta
por partida somados ao caos.

**Navegador:** 5 laterais com **zero saltos acima de 1 m**, 1 finalização para
fora com zero cruzando entre as traves, zero erros de página.

**PROMOVIDA como R18.94**, sha256
`46b5f355cf1d9be47a85f9d2f569d86827a3d5cf6292043fd024f073e66421a8`.
Cadeia reproduzida duas vezes byte a byte.

---

## 7. A lição de método

Duas vezes eu medi a coisa certa e fiz a pergunta errada. O que resolveu foi
ancorar a medição no **objeto do lance** (o ponto do lateral) em vez de no
**estado do agente** (o alvo que o jogador carrega). Um agente sempre chega ao
próprio alvo; isso não diz nada sobre ele estar onde o lance precisa.
