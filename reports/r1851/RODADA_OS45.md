# RODADA OS-45 — o cruzamento pode ser ruim

Depois da OS-42/43/44 o cruzamento virou jogada disputada, mas o censo mostrou
que as categorias **saturam** (R18.69, 10 partidas):

```
cruzamentos           17,90
  finalizacao   8,0    44,7%   (real ~25%)
  corte         6,8    38,0%   (real ~50%)
  defesa do GK  3,9    22%
```

Somando, praticamente todo cruzamento encontra alguém. E o motivo está na
entrega — o ramo aéreo (`:5411`) mira:

```js
this._startTravel(o, {x: atk.x, y: atk.y}, 'pass', ...)
```

A cabeça do atacante, exatamente, sempre. **A precisão do cruzamento era 100%**,
independente de quem cruza, de que distância e sob que pressão. No futebol real
25 a 30% dos cruzamentos não acham ninguém.

## Dois edits, um por ramo

**Aéreo** — rolagem de precisão antes do duelo:

```
pOk = clamp(0.34 + crossSkill/260 + (nearByline?+.08:0) + (setPiece?+.14:0), .40, .82)
```

Falhando, a bola vai para um ponto errado — além do segundo pau ou curta demais
— e **segue viva** como bola solta, exatamente como o ramo de cruzamento livre
(R18.31) já faz. Quem estiver perto disputa; ninguém perto, ela sai pela linha e
o reinício nasce de `_ballOut`. Nada de desfecho decretado.

**Rasteiro** — o segundo edit é uma linha que estava invertida:

```js
if(!lowCrossWon && !physicalCrossBlock) lowCrossWon = true;
```

O defensor vencia o duelo, não alcançava fisicamente, e isso era convertido em
**vitória do atacante**. É a mesma classe de defeito que a OS-38 e a OS-39
encontraram: uma checagem física transformando sucesso defensivo em sucesso
ofensivo. Agora vira entrega errada, que é o que é.

Só o ramo aéreo foi corrigido na primeira tentativa, e a medição pegou:
`cross_ruim` ficou em 16% dos cruzamentos contra os ~39% que a fórmula prevê,
porque metade dos cruzamentos vai pelo rasteiro e escapava da checagem.

## Previsão registrada antes de medir

- `cruzamento -> chute` 44,7%: DESCE
- chutes 20,07: DESCEM
- gols 2,42: DESCEM — o risco da rodada
- escanteios 6,40: DESCEM um pouco; **não podem cair abaixo de 4,0**
- xG 2,45: DESCE
- recusa se gols < 1,8 ou escanteios < 4,0

## Medido — 40 partidas, mesmas sementes

```
                 R18.69   R18.70
goals             2.42     2.35
xg                2.45     2.29
shots            20.07    18.02
onTarget          6.97     6.30
corners           6.40     5.08    <- segue na faixa ECO-05
passes          364.88   368.55

10 partidas
cruzamento sem alvo (cross_ruim + cross_livre)   0%  ->  22,3%
cadeias por chute                                5,9 ->  8,2   (real ~8 a 10)
cadeia terminando em finalizacao                 17% ->  12%   (real ~10 a 12%)
```

Todas as previsões se cumpriram, e o número que abriu esta linha de investigação
entrou na faixa: **8,2 posses por finalização**, contra 5,9 quando comecei e
8–10 no futebol real.

## Estrutura

```
                          R18.69   R18.70
gate marking reprovado     7/12     7/12
gate lines reprovado       0/12     0/12
gate swarmRate reprovado   0/12     0/12
gate severeCollapse        2/12     1/12
salto acima de 12 m/s     0.527%   0.550%
```

Navegador: sem `pageerror`, sem erro de console, 8 faltas / 7 barreiras armadas.

## Onde a linhagem chegou

```
                   R18.63    R18.70
corners             2.90      5.08     ECO-05 (4-10) cumprido
goals               3.27      2.35
xg                  2.84      2.29     ECO-02 (<=2,7) cumprido
shots              22.77     18.02
cadeias por chute    5,9       8,2     faixa real
blocked             0.33      ~2,3
falta               sem barreira        barreira de 9,15 m
falta direta        57% em nada         0% em nada
cruzamento          100% preciso        22% sem alvo
```

## Fica aberto

- chutes em 18,02 — a faixa real de dois times somados fica perto de 24; agora
  está do lado baixo.
- gols 2,35 contra ~2,7 reais.
- gate `marking` 7/12, já registrado como inadequado (teto calculado 73,5%).
- salto por quadro fora de `_movePlayers`, herdado da base.
