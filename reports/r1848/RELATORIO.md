# R18.48 — OS-08: diagnóstico sólido, e um ganho meu que era artefato

**Status: NÃO PROMOVIDA.** O diagnóstico da condução está firme e reproduz a
matriz exatamente. O conserto que eu escrevi produziu um ganho grande que **não
era real** — e só um gate pegou.

Baseline R18.44 (`8466fd7bf6b9`) · Instrumento `tools/r1848/diag_conducao.js`
Patch `tools/r1848/patch_conducao.js`

---

## A. O diagnóstico, e ele reproduz a matriz

`INT-01` medido: **1,182%** das ações do portador. A matriz registra **1,18%**.
Bate exatamente, o que confirma a definição (chamadas de `_carry` sobre o total de
ações do portador: `_carry + _pass + _shoot + _cross + _dribble + _clearBall`).

Mix de ações por partida, R18.44:

| ação | por partida | % |
|---|---:|---:|
| `pass` | 472,7 | 85,1% |
| `dribble` | 34,0 | 6,1% |
| `cross` | 29,1 | 5,2% |
| `shoot` | 12,0 | 2,2% |
| **`carry`** | **6,6** | **1,18%** |
| `clearBall` | 1,0 | 0,2% |

E o número que dá o mecanismo:

| | valor |
|---|---:|
| alvo que `_carry` fixa (`reach = 8 + min(6,espaço)·0,6`) | 8 a 11,6 m |
| **metros que o corpo percorre por condução** | **2,301 m** |
| metros conduzidos por partida | 15,10 m |

**A condução não é uma ação sustentada.** `CAL.timing.decisionInterval = 0,28`:
o portador redecide a cada 0,28 s, o que a ~5 m/s são ~1,4 m. A condução dura um
ou dois ciclos e é substituída antes de chegar a qualquer lugar.

A coluna "Dependência" de OS-08 na matriz diz literalmente **"Janela de
compromisso"**. Cheguei ao mesmo mecanismo pela medição — é a única leitura
possível de 2,3 m medidos contra 8–11,6 m pretendidos.

`INT-02` **não** reproduz: minha definição (metros por posse, posse = período
contíguo do mesmo time com portador) dá 0,056 m contra os 0,66 m da matriz, com
271,8 posses por partida. A definição original de "posse" está perdida. Declaro em
vez de forçar: uso `metros_por_conducao` como série de trabalho, porque ela separa
"conduz pouco" de "conduz raro", que é a distinção que importa.

## B. O conserto que eu escrevi, e o ganho aparente

Janela de compromisso: quando a decisão escolhe conduzir, o portador não redecide
por até `JANELA` segundos. Quebra por pressão (<2,6 m), por entrada em faixa de
chute (dtg ≤ 20), por alvo alcançado e por expiração.

Base s1, n=48:

| variante | INT-01% | m/condução | posse TF | gols | xG | chutes | no alvo |
|---|---:|---:|---:|---:|---:|---:|---:|
| R18.44 | 1,182 | 2,301 | 8,01% | 2,500 | 2,475 | 14,60 | 4,667 |
| janela 0,9 s | 1,243 | 5,400 | 8,64% | 3,083 | 2,411 | 14,06 | 5,083 |
| **janela 1,4 s** | 1,313 | **6,699** | **9,79%** | 3,021 | 2,344 | 13,83 | 5,250 |
| janela 0,9 s, pressão 2,0 | 1,189 | 6,184 | 8,94% | 3,042 | 2,500 | 14,04 | 5,000 |

As duas previsões que eu registrei **antes** de medir se confirmaram:
`metros_por_conducao` subiria para 4–7 (deu 5,4–6,7) e `INT-01` subiria pouco
(1,182 → 1,19–1,31).

E todos os gates de ecologia ficam na faixa. Eu tinha em mãos um resultado
apresentável: **condução +191%, posse no terço final +22%, ECO-01..04 verdes.**

## C. `COE-01` pegou

| variante | gols | xG | **gols/xG** |
|---|---:|---:|---:|
| R18.44 | 2,500 | 2,475 | **1,010** |
| janela 1,4 s | 3,021 | 2,344 | **1,289** |

`COE-01` exige `gols/xG` em [0,90; 1,15]. Os gols subiram enquanto o xG **caiu**:
~0,68 gols por partida aparecendo sem xG.

E não era o caminho do goleiro: `pct_dos_gols_por_falha_do_goleiro` foi de 1,67%
para 2,07% (irrelevante), e `gols_menos_falhas_sobre_xg` = 1,262. O preço por
chute não mudou (`xg_por_chute` 0,1695 → 0,1694) e o `pGoal` médio de cada tipo de
finalização ficou igual. Ou seja: nem mais chances, nem chances melhores, nem o
bug do goleiro. Gols do nada.

## D. O culpado era minha implementação

A camada retornava de `_decide` **sem chamar `oldDecide`** — pulando a cadeia
inteira, que tem camadas posteriores fazendo contabilidade de chute
(`beginShot`/`finishShot` do bloco `cds-r122`, entre outras). Testei uma segunda
implementação que roda a cadeia completa e só depois restaura o alvo da condução:

| implementação | gols | xG | gols/xG | m/condução | posse TF | chutes |
|---|---:|---:|---:|---:|---:|---:|
| R18.44 | 2,500 | 2,475 | 1,010 | 2,301 | 8,01% | 14,60 |
| **atalho** (retorna antes) | 3,021 | 2,344 | **1,289** | **6,699** | 9,79% | 13,83 |
| **sobrepor** (roda a cadeia) | 2,250 | 2,394 | **0,940** | 2,789 | 8,00% | 14,21 |

**Conclusivo.** Com a cadeia rodando, a coerência volta (0,940, dentro de
`COE-01`) e o ganho de condução **quase desaparece** (2,789 m contra 2,301 —
apenas +21%). Os 6,7 m e os +22% de terço final eram efeito de pular a decisão,
não de conduzir melhor.

Por que o ganho desaparece: em modo `sobrepor` a cadeia redecide e escolhe passe —
que é 85% das ações — e minha restauração cede legitimamente. A janela quebra na
hora. Ou seja **suprimir a decisão não é compromisso; é só suprimir a decisão.**

## E. O que isto ensina sobre OS-08

Uma janela de compromisso de verdade tem de mudar a **decisão**, não contorná-la:
fazer a condução ganhar do passe quando conduzir é a jogada certa. Os dois lugares
são conhecidos e ambos estão **dentro** de `_evaluateShotDecision` e do dispatch:

1. `cone === 0` — a condução exige **zero** adversários num cone de 9 m × 4,5–5,5 m.
   Um único defensor no cone proíbe conduzir. No futebol se conduz *contornando*
   defensor.
2. A ordem do dispatch põe o passe de progressão (`progressM > 3 && score > 0.6`)
   **antes** da condução, com barra baixa.

Nenhum dos dois foi tocado nesta rodada, de propósito: eu queria testar o
compromisso isolado, e o teste falhou por defeito meu, não do mecanismo.

Isto também dá contexto ao aviso que está no próprio código —
*"Condução com propósito foi testada e regrediu: precisa da reação defensiva"*.
Se aquela tentativa também forçou ou contornou a decisão, o resultado teria sido
do mesmo tipo: número bonito, mecanismo falso.

## F. O valor de `COE-01`

Este é o gate que criei na R18.44 porque nenhum gate da matriz forçava a coerência
entre os gols do jogo e o modelo de xG do jogo. Nesta rodada ele foi o **único**
sinal de que um resultado com quatro gates verdes e duas previsões confirmadas
estava errado. Sem ele, a R18.48 teria sido promovida como "OS-08 resolvida".

## G. Recomendação

1. **Não promover.** A R18.44 segue promovida.
2. **OS-08 continua aberta**, agora com mecanismo localizado com precisão
   (`decisionInterval` 0,28 s contra alvo de 8–11,6 m) e com dois levers nomeados
   (§E) que atacam a decisão em vez de contorná-la.
3. **Regra para a próxima tentativa:** qualquer camada que envolva `_decide` deve
   chamar a cadeia inteira. Um `return` antes de `oldDecide` quebra contabilidade
   de outras camadas e produz ganho falso — medido, não suposto.

## H. Arquivos

```
tools/r1848/diag_conducao.js       instrumento de INT-01/INT-02 e mix de acoes
tools/r1848/patch_conducao.js      o patch, com --modo=atalho|sobrepor
reports/r1848/cond_r1844_s1.json                    baseline
reports/r1848/cond_{j*,sobrepor_j1.4}_s1.json       varredura
reports/r1848/bat_{j*,sobrepor_j1.4}_s1.json        bateria
reports/r1848/xg_j1.4_s1.json                       coerencia do modo atalho
```
