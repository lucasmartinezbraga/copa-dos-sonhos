# OS-13 — o pênalti não é um gate de falta, é um gate de posse na área

**Baseline:** R18.50 — PRESERVAR ENERGIA
**Natureza:** observacional, com uma hipótese minha falsificada
**Promoção:** não promovível

## O QUE EU ERREI

Na OS-09 escrevi que o pênalti estava suprimido por `:16258`, onde a
probabilidade de falta dentro da própria área é multiplicada por `.55` e travada
em `.095`, contra `1.30` e teto `.35` fora. Construí o patch, elevei para
`1.00` e teto `.20`, medi — e **os pênaltis continuaram em 0,00**.

A hipótese estava errada. O multiplicador não é o gargalo.

## MEDIÇÃO EXECUTADA

8 partidas, base 4200000, sobre a build OS-10 (já com o funil da falta aberto).
**N=8 não é o protocolo de três bases × 48.**

| | por partida |
|---|---|
| `_awardFoul` chamado | 8,63 |
| — com a vítima **dentro da área** | **0,00** |
| eventos `tackle` | 8,13 |
| — com a vítima dentro da área | 0,25 |
| amostras de posse na área (2 Hz) | 2,63 |

## MECANISMO REAL

A falta na área não acontece porque **o atacante quase nunca está com a bola na
área**. A 2 Hz de amostragem, 2,63 amostras por partida equivalem a cerca de
**1,3 segundo de posse dentro da área, por partida, somando os dois times**.

Sobre essa base, o duelo na área é 0,25 por partida. Mesmo com o teto de falta
elevado a `.20`, a expectativa é 0,25 × 0,20 ≈ 0,05 falta na área por partida —
indistinguível de zero em qualquer bateria de 48.

O pênalti não está desligado nem suprimido: `_penalty` (`:6707`) e
`penaltiesTaken++` (`:6817`) funcionam. Falta o evento que os alimenta.

E a causa disso é a mesma da levantada sem alvo da OS-12: o motor **encerra a
jogada antes de alguém entrar na área**. O portador finaliza, cruza ou perde a
bola no limite; ninguém conduz para dentro. A OS-12 mede o outro lado do mesmo
buraco — `inBox` vazio no momento do cruzamento.

## HIPÓTESE

Em direção, sem percentual:

1. Qualquer candidata que aumente o tempo de posse dentro da área faz os
   pênaltis **subirem** a partir de zero, sem tocar em `_foulProb`.
2. Mexer só no multiplicador de `:16258` **não muda** os pênaltis. Já medido:
   não mudou.
3. A mesma candidata faz `inBox` da OS-12 deixar de ser vazio, e portanto
   reduz a levantada sem alvo.

## GATE

`penaltiesTaken > 0` de forma estável nas três bases. Enquanto a posse na área
ficar em ~1,3 s por partida, nenhuma constante de falta alcança esse gate.

O sítio a atacar **não** é `_awardFoul` nem `_foulProb`. É a decisão que faz o
portador finalizar/cruzar em vez de conduzir para dentro da área — a mesma
região que a OS-12 toca em `:5155`.

## O QUE FICA DO PATCH DE `:16258`

A de-supressão continua defensável por si só: não há razão futebolística para o
teto de falta na área ser 3,7× menor que fora. Mas ela é **necessária e não
suficiente**, e sozinha não é candidata — não move o gate que diz ter movido.
Fica registrada aqui e fora da OS-10, que ficou com um mecanismo só, medido e
funcionando.

## ARMADILHA

**A que me pegou:** encontrei um multiplicador suspeito, ele explicava o
sintoma de forma plausível, e eu escrevi que era a causa antes de medir. O
patch aplicou, a build carregou, a âncora casou uma vez — e o número não se
mexeu. Âncora correta e patch limpo não são evidência de causa.

**Segunda:** 0,00 falta na área poderia ser lido como "o caminho do pênalti está
quebrado". Não está. O que falta é a entrada, não a saída — e a diferença muda
completamente qual sítio se ataca.

## VALIDAÇÃO EXECUTADA

- Medição sobre a build OS-10, `sha256` conferido em execução.
- A instrumentação envolve `_awardFoul` e `_emit` na instância, sem tocar no
  protótipo compartilhado e sem consumir RNG.
- Nenhuma bateria de três bases × 48 partidas foi executada.
