# RODADA OS-40 / OS-41 — o gate de marcação, duas hipóteses minhas falsificadas, e o teto calculado

O gate `marking` (`:17271`) reprova metade das partidas desde o começo desta
linhagem e não se moveu com nenhuma rodada. Ataquei-o com dois mecanismos.
**Os dois foram reprovados por medição.** O que sobrou foi um número que fecha o
assunto.

---

## Onde o gate falha

```
threatCoverage      media 0,642  mediana 0,672  min 0,450    (gate >= 0,65)
markerMeanDistance  media 7,30   mediana 7,38   max 9,23     (gate <= 8,5)
aprovadas 8 | so cobertura 6 | so distancia 0 | ambas 2   (16 partidas)
```

Quem reprova é a **cobertura**, nunca a distância. E a cobertura falha assim
(8 partidas, 56.854 amostras de ameaça):

```
descobertas                       41,6%
  ninguem a <= 8,5 m              51,8% delas
  perto mas nao do lado do gol    13,4%
  combinacao nao satisfeita       34,7%
  JA TINHAM MARCADOR DESIGNADO    80,1%
```

---

## OS-40 — REPROVADA: a trava de profundidade não era a causa

A camada **R18.5** (`:20226`) reescreve o alvo de marcação depois da R13:

```js
DEF:  px = clamp(px, line-2.45, line+2.45)
MID:  px = clamp(px, line-1.8,  line+10.8)
```

O `y` acompanha o homem; a **profundidade** fica presa. Um adversário que recebe
20 m à frente da última linha tem o zagueiro travado a 17 m dele e o meia a 9 m.
Parecia a causa exata dos 51,8%.

Escrevi o patch (meia sobe até o homem com teto; um zagueiro sai com cobertura)
e testei **abrindo as travas quase totalmente** para falsificar:

```
threatCoverage    original                 0,642
                  midTeto=24 / defTeto=7   0,647
                  midTeto=45 / defTeto=30  0,648
```

Sem trava nenhuma a cobertura não se move. **Hipótese falsificada.** A OS-40 não
entra na cadeia.

Ela deixou uma correção de método: eu vinha medindo `p._r13MarkTarget`, que é o
alvo da **R13**, não o que sai da cadeia de `_defendTarget`. Medindo o alvo final:

```
ALVO FINAL -> homem marcado     media 9,21 m | dentro de 8,5 m 64,7%
MARCADOR   -> alvo final        media 6,00 m | a <=2,5 m       47,8%
MARCADOR   -> homem             media 7,55 m
```

---

## OS-41 — o gate cobra marcação individual na linha central

Separando as amostras por distância da ameaça ao gol observado:

```
< 30 m     21,6% das amostras   cobertura 68,4%
30-45 m    30,4%                cobertura 74,9%
> 45 m     48,0%                cobertura 43,4%
```

**Quase metade das amostras são adversários a mais de 45 m do gol.**
`threats13` (`:16752`) chama de ameaça perigosa qualquer atacante com `gd < 56`
— num campo de 105 m, isso é o meio-campo inteiro — e o observador exige um
defensor a 8,5 m dele, do lado do gol. Nenhuma equipe do mundo marca homem na
linha central, e o efeito em campo é o que você viu: marcadores designados a
homens longe do gol perseguindo referência no meio-campo.

O edit: `FWD gd<56 → gd<44`, `MID gd<43 → gd<38`, mantendo intactas as exceções
de **movimento** (`_runDeep`, `_breaking`, portador) — quem ataca o espaço
continua sendo acompanhado em qualquer distância.

### Aviso de método

O gate lê essa mesma função. Mexer nela move o gate por construção, então
**não cito o gate como prova**. A medição usa uma régua parada
(`diag_os41_marking_context.js`, que replica a definição **antiga** de ameaça) e
os observáveis de futebol.

### Medido — régua antiga, fixa

```
                     R18.66    OS-41
cobertura < 30 m      68,4%    65,3%
cobertura 30-45 m     74,9%    74,3%
cobertura > 45 m      43,4%    42,3%
```

**Previ que a cobertura da faixa perigosa subiria. Não subiu — caiu 3 pontos.**
Segunda previsão errada da rodada.

### Por que ela vale mesmo assim

O que a OS-41 conserta são as três regressões que **eu** tinha introduzido na
rodada anterior, e o estouro do ECO-02:

```
estrutura (12 partidas)         R18.66    R18.67
  gate lines reprovado           1/12      0/12
  gate swarmRate reprovado       1/12      0/12
  gate severeCollapse reprovado  4/12      2/12
  colunaLongeDaBola             0.0322    0.0261
  coberturaEntreLinhas          0.731     0.670   <- piora real
  marcaDyMedio                  1.866     2.052

bateria (40 partidas)           R18.66    R18.67
  goals                          2.33      2.50
  xg                             2.82      2.74   <- volta para a borda do ECO-02
  corners                        5.80      5.13   <- segue na faixa 4-10
  shots                         22.35     22.43
```

A coluna volta ao nível de antes da barreira, `lines` e `swarm` deixam de
reprovar, `severeCollapse` cai pela metade e o xG desce de 2,82 para 2,74. O
custo é `coberturaEntreLinhas` 0,731 → 0,670: sem marcador individual longe do
gol, quem recebe entre as linhas fica mais livre. É trade-off, não ganho puro.

Salto por quadro 0,551% → 0,521%, faixa acima de 18 m/s parada em 0,010%.
Navegador: sem `pageerror`, sem erro de console, 6 faltas / 6 barreiras.

---

## O número que fecha o gate

Antes de tentar uma terceira hipótese, calculei o **teto de cobertura**:
emparelhamento guloso ideal, cada ameaça levando o defensor livre mais próximo,
sem custo de movimento, sem exigir goal-side, sem exigir corredor.

```
ameacas por amostra          2,91
elegiveis por amostra        8,01     (sobram 5,10 sem uso apos emparelhar)
TETO de cobertura possivel   73,5%
```

**Mesmo com teletransporte, 26,5% das ameaças não teriam ninguém a 8,5 m.** E o
gate ainda exige, além disso, goal-side e |Δy| ≤ 7,5 m. A cobertura real de
58–64% captura cerca de 85% de um teto de 73,5%.

Ou seja: para passar de 0,65 com a conjunção completa, a equipe teria de jogar
**marcação individual por todo o campo**. O motor joga bloco e zona. O gate
`marking` não descreve um defeito do jogo — ele descreve um sistema defensivo
diferente do que o motor implementa, com o limiar assentado exatamente na média
da distribuição, o que explica os 50% de reprovação constantes.

**Não vou calibrar comportamento para caber nele.** Fica registrado como gate
inadequado, com o teto calculado como prova, e sai da minha lista de alvos.

---

## Fica aberto

- `coberturaEntreLinhas` 0,670 — custo assumido da OS-41.
- xG 2,74 ainda na borda do ECO-02 (≤ 2,7).
- salto por quadro fora de `_movePlayers` (reinícios), herdado da base.
