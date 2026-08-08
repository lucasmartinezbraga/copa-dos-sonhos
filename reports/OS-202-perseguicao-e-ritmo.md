# OS-202 · A perseguição do marcador, e quanto tempo dura uma partida

## O problema herdado

Depois da OS-201 sobrava **uma** métrica fora da faixa de design: faltas, 15,3
por partida contra um mínimo de 16. Duas tentativas já tinham falhado (subir
`foulBase`, criar falta na disputa aérea), e as duas apontavam para a mesma
conclusão: **o volume de faltas não sai da probabilidade por duelo, sai de
quantos duelos acontecem.**

## O funil do duelo

Medido em 10 partidas completas:

```
quadros de simulação por partida     40.830
  com bola dominada                  11.520  (28,2% do jogo)
    bloqueados por 'settle'           1.790
    presser FORA do raio              7.641   ← 66% do tempo útil
    presser no raio, mas em cooldown    345
    presser no raio e liberado        1.744   ← só aqui pode haver duelo

distância média presser → portador    7,55 m
raio de bote                          3,01 m
```

O marcador designado passa o jogo a **7,55 m** do portador enquanto o bote só
acontece dentro de **3,01 m**. Ele é escolhido, é mandado, e não chega.

## Por que não chegava

O alvo dele era a posição da bola deslocada 1,25 m para o lado do próprio gol.
Isso é **perseguição pura**: mirar onde o portador *está*. Contra alguém de
velocidade parecida a distância não fecha nunca — é a corrida do cachorro atrás
do carro. Defensor de verdade mira onde o portador **vai estar**.

## Onde a correção tinha que morar (e onde eu errei primeiro)

No core, `_defendTarget` tem um ramo `if (p === presser) return [b.x, b.y]` que
parece exatamente o lugar certo. **Não é.** A camada R13 intercepta o presser
antes e retorna sem chamar o core.

Editei o core, medi, e os números vieram **idênticos** — o mesmo tipo de engano
que já tinha aparecido com o arrasto da R13 na OS-200. Só percebi porque o
critério de aceitação (mesmas sementes, agregados idênticos) tornou o silêncio
visível. Deixei um aviso no core apontando para cá.

Houve um segundo erro no caminho: a primeira versão da antecipação usava o
tempo cheio de aproximação e mandava o marcador para um ponto **9,3 m adiante
da bola** — isso é passar batido, não cortar o ângulo. O corte real é curto,
meio segundo de leitura.

## Resultado do funil

| | antes | depois |
|---|---|---|
| Distância presser → portador | 7,55 m | **7,15 m** |
| Quadros com duelo possível | 1.744 | **1.916** |
| Duelos por partida | 39,3 | **44,3** |
| Faltas por partida (sonda de 10) | 13,1 | **15,9** |

## Placar contra os alvos de design

120 partidas. A métrica que resistia a três tentativas entrou:

| Métrica | OS-201 | OS-202 | faixa |
|---|---|---|---|
| **Faltas por partida** | 15,3 ❌ | **16,1** ✓ | 16 – 28 |
| Gols por partida | 2,89 ✓ | 2,76 ✓ | 2,4 – 3,2 (alvo 2,8) |
| Finalizações | 21,2 ✓ | 21,3 ✓ | 20 – 30 |
| xG | 2,93 ✓ | 2,90 ✓ | 2,3 – 3,5 (alvo 2,9) |
| Escanteios | 9,72 ✓ | 10,05 ✓ | 5 – 11,5 |
| Amarelos | 4,66 ✓ | 5,17 ✓ | 2,4 – 5,6 |
| Empates | 29,2% ✓ | 25,8% ✓ | 20 – 33% |
| Goleadas | 17,5% ✓ | 17,5% ✓ | 9 – 19% |
| Acerto ao alvo | 0,351 ✓ | 0,339 ❌ | 0,34 – 0,47 |
| Stamina final | 64,2 ✓ | 63,6 ❌ | 64 – 83 |

**11/13.** Mais duelos significam mais corrida e mais gasto, então a stamina
recuou; e o acerto ao alvo caiu 0,001 abaixo do mínimo. As duas são falhas de
casa decimal, dentro do ruído de 120 partidas — e as duas foram medidas em
configurações alternativas sem que nenhuma resolvesse ambas ao mesmo tempo.

Parei de ajustar aqui de propósito: passei a oscilar entre configurações
equivalentes dentro do ruído, que é o sintoma clássico de estar calibrando
contra a amostra e não contra o jogo.

## Quanto tempo dura uma partida

Pergunta que veio junto: *"o jogo ficou demorado demais — um FM demora
quanto?"*

**Onde vai o tempo** (1.361 s de simulação por partida):

| | segundos | % |
|---|---|---|
| Bola **voando** | 757 | 55,6% |
| Bola dominada | 387 | 28,4% |
| Bola morta/parada | 166 | 12,2% |
| Bola solta | 51 | 3,8% |

**Os botões de velocidade mentiam.** "2X" aplicava 1,8; "4X" aplicava 3,6.
Nenhum batia com o próprio nome — e é justamente esse número que alguém usa
para decidir quanto tempo vai gastar. Agora o rótulo **é** o multiplicador.

| botão | multiplicador | minutos por partida |
|---|---|---|
| 1X | 1,0 | 22,8 |
| 2X | 2,0 | 11,4 |
| **3X (padrão)** | **3,0** | **7,6** |
| TURBO | 6,0 | 3,8 |

O padrão passou de 1,8 para 3,0. A partida sai de 12,6 para **7,6 minutos** —
mais curta até que os ~8,2 min de antes da mudança de relógio, e na faixa de
*key highlights* do Football Manager (5–8 min; *extended* 10–15;
*comprehensive* 15–20; partida completa ~45).

### Uma distinção que eu tinha embaralhado

Ao apresentar a varredura da OS-201 como "minutos assistindo", misturei duas
coisas independentes:

- **`clockRate`** decide *quanto futebol acontece* numa partida;
- **a velocidade** decide *quão rápido você assiste* aquilo.

Encurtar a partida subindo o `clockRate` desfaria o conserto da OS-201 — está
medido que em 0,13 o jogo entrega 13 chutes e 25% de 0 a 0. **Tempo de tela se
resolve na velocidade, não no relógio.**

## Ainda aberto

- **Stamina 63,6 e acerto ao alvo 0,339**, ambos na casa decimal do mínimo.
- **12,2% da partida é bola parada.** Adiantar automaticamente esse trecho
  cortaria ~1 minuto sem tirar nada de futebol — é o que o Football Manager faz
  ao pular para os destaques. Não implementado.
- **55,6% do tempo a bola está viajando.** É consequência de física real, mas
  vale investigar se o motor passa mais do que deveria.
