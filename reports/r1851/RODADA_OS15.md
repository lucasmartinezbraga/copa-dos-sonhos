# OS-15 — a condução não existe, e o medidor de decisão está quebrado

**Baseline:** R18.50 — PRESERVAR ENERGIA
**Natureza:** observacional
**Promoção:** não promovível
**Patches na build:** nenhum

**SHA-256 medida:** `495a9d684104b55ec749e43462549667fddb66a93b5d0b0a4cb1ab9d95c0445a`

## POR QUE ESTA RODADA EXISTE

Três sintomas medidos nas rodadas anteriores convergiam para o mesmo lugar sem
que eu soubesse qual:

- pênalti travado em ~0,04/partida mesmo com a supressão de falta removida
  (OS-14), por falta de duelo na área;
- posse dentro da área em ~1,75 s por partida, somando os dois times (OS-13);
- cruzamento saindo com a área vazia em 68% dos casos antes da OS-12.

Todos pedem a mesma coisa: alguém precisa **entrar** na área com a bola.

## MEDIÇÃO EXECUTADA

12 partidas, base 4200000, sobre a build promovida, leitura de
`stats.decisions` e `stats.decisionQuality`. **N=12 não é o protocolo.**

| ação real | por partida | share |
|---|---|---|
| `pass` | 250,8 | **90,6%** |
| `cross` | 12,3 | 4,5% |
| `carry` | 7,3 | **2,6%** |
| `shoot` | 6,2 | 2,2% |
| `clear` | 0,3 | 0,1% |

`_decide` é chamado 94,4 vezes por partida, mas as ações somam 277 — a maioria
das ações não nasce de `_decide`, e sim de atalhos (primeira batida, passe
automático, segunda fase).

## ACHADO 1 — a condução é 2,6% das ações

Conduzir a bola praticamente não existe: **7,3 conduções por partida contra 12,3
cruzamentos**. O motor cruza quase duas vezes mais do que conduz.

Isso fecha a conta dos três sintomas. Ninguém entra na área porque a ação de
entrar na área não é escolhida. Não adianta mexer em constante de falta
(OS-14), nem em geometria de escanteio (OS-05B), nem em raio de separação
(OS-11): todas operam sobre populações que a decisão nunca cria.

O candidato de `carry` em `context()` (`:8079`) recebe
`fit = carryMore ? .72 : .4` e `space = nd > 5 ? .4 : .1`. Com `carryMore`
falso no preset padrão, a condução entra com o menor `fit` de todos os
candidatos ofensivos e só ganha espaço com o adversário a mais de 5 m.

## ACHADO 2 — `decisionQuality` não é uma taxa

`agreement / count` deu **134,8%**. O medidor está malformado:

- `count` é incrementado uma vez por `_decide` (94,4/partida), em `:8084`;
- `agreement` é incrementado em `rec()` (`:8086`), que dispara em **toda**
  chamada de `_pass`/`_carry`/`_dribble`/`_cross`/`_shoot`/`_clearBall` —
  277/partida.

São denominadores diferentes. O número não pode ser lido como concordância, e
qualquer gate construído sobre ele é inválido. `decisionNonBest / count` (45,1%)
tem o mesmo problema de denominador para a fração de ações, embora `nonBest` e
`count` sejam ambos por `_decide` — esse par é legítimo.

## HIPÓTESE

Em direção, sem percentual:

1. Elevar o `fit` da condução em `context()` faz `carry` **subir** e `cross`
   **descer**.
2. Com mais condução, a posse dentro da área **sobe**, e com ela os duelos na
   área — que é a população que falta ao pênalti da OS-14.
3. `xG` **sobe**, e é aí que a candidata pode reprovar: `ECO-02 ≤ 2,7`.
4. O share de `pass` **desce** de 90,6%, que já é alto demais para futebol.

## GATE

`ECO-02 ≤ 2,7 xG/partida` é o gate que aperta aqui, não os de bola parada. Uma
candidata que faça o atacante conduzir para dentro da área e não estoure o xG
resolve pênalti, cruzamento sem alvo e posse na área de uma vez. Se estourar, a
rota é ajustar conversão antes de ajustar decisão.

O medidor `decisionQuality.agreement` **não pode** ser usado como gate enquanto
os denominadores não forem os mesmos.

## ARMADILHA

**A que me pegou três vezes nesta linhagem:** achar um multiplicador que explica
o sintoma de forma plausível e patchá-lo antes de medir a população sobre a qual
ele opera. Foi assim na OS-09 (`:16258`), na OS-13 (repeti) e no edit 3 da
OS-14, que caiu num ramo que dispara 0,25 vez por partida. Constante só importa
se existir população.

**Segunda:** `stats.decisions` conta ações, `decisionQuality.count` conta
decisões. Misturar os dois produziu 134,8% e teria produzido qualquer conclusão
que eu quisesse.

## VALIDAÇÃO EXECUTADA

- Medição sobre a build promovida, `sha256` conferido em execução, sem patch.
- Nenhuma bateria de três bases × 48 partidas foi executada.
