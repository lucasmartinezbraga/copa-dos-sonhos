# A3 · Tentado e revertido — e o que ele ensinou

Resultado negativo. O código saiu; o achado fica.

## O plano estava errado, e a medição mostrou antes de eu escrever a camada

O `PLANO-v4` dizia: *"A3 — deixar o arremesso da r13 acontecer · alvo: laterais
16,5 → 33–48."*

**Os dois consertos são coisas diferentes e eu tinha juntado.** A métrica
`laterais` é `stats[team].throwIns`, incrementado pela `r13` em **toda saída
pela linha lateral** — arremessada ou não. Deixar o arremesso acontecer não
move o contador em nada.

## Por que a bola sai tão pouco (medido)

```
saidas pela LATERAL          9,2 por partida   (futebol real ~40)
saidas pela linha de fundo  19,7
coletas de bola solta      314,8   distancia media do coletor 1,51 m
  com o mais proximo a MAIS DE 3 m   21,3
  bola a menos de 2,5 m da linha      0,5   <- resgate na beira quase nao existe
```

Não é que a bola vá para a linha e seja resgatada: **ela quase nunca vai.** Todo
desvio, rebote e corte é mirado num ponto *dentro* do campo — `_deflectTo`
recebe alvos com `clamp(..., 2, FL-2)` em praticamente todos os pontos de
chamada, e a bola solta é coletada pelo mais próximo sem limite de distância.

**O conserto de `laterais` é dar física real ao desvio** (`_deflectTo` não cria
plano físico e ainda integra com g = 20 m/s²), não mexer no arremesso.

## A camada que eu escrevi, e por que ela saiu

Camada 91: deixa a máquina de bola parada rodar inteira e, se ao fim a bola
estiver no pé do cobrador, arremessa de verdade em vez de entregar.

Funcionou no que se propôs:

```
arremessos com trajetoria integrada   6,3 por partida
  distancia mediana   10,9 m
  APICE mediano        2,88 m     <- arremessado de verdade
  duracao mediana      1,36 s
```

E falhou no critério de aceite:

| | |
|---|---|
| `throwIns` | 15,82 → **13,13**, d/SE **−3,83** |
| cobertura | só 6,3 dos ~13 laterais (o resto cai no `_giveBall`) |
| altura de saída | 0,12 m, não 1,72 m — sai do pé, não da cabeça |

A altura tem explicação estrutural: a camada 07 lê `b.z` no momento de planejar
o segmento, e a `r13` só escreve `b.z = 1.72` **depois** de chamar a cadeia. O
plano físico já saiu com 0,12. É o padrão 4 outra vez, agora me mordendo.

O primeiro item sozinho já reprova: **mover 2 SE, para pior, a métrica que já
era a pior do painel**, sem ter declarado que ia mexer nela. É exatamente o
critério que eu escrevi no plano e que serve justamente para me impedir de
enfeitar o jogo com uma mudança que soa boa.

Revertido. O build voltou byte a byte (`ff808761f5797656`).

## O que fazer no lugar

1. **`_deflectTo` cria plano físico** com g = 9,81 e alvo que pode sair do
   campo. É o conserto de `laterais`, e de quebra acaba com a segunda física
   que ainda governa rebote, bloqueio e corte de cabeça.
2. **Só depois** o arremesso, e aí de uma vez: origem na cabeça (exige ordenar
   `b.z` antes do plano da camada 07) e cobertura de todos os laterais.

## Nota

Três consertos nesta sequência, três resultados diferentes: A1 acertou o alvo,
A2 nasceu de uma hipótese errada que produziu resultado invertido, e A3 foi
revertido pelo próprio critério. O que os três têm em comum é que a medição
veio antes da opinião — inclusive quando ela contrariou o plano que eu mesmo
tinha escrito duas horas antes.
