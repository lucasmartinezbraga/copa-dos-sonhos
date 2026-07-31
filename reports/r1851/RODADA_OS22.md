# OS-22 — a escala de tempo é o denominador de quase tudo

**Baseline:** R18.55 · **Natureza:** candidata medida · **Promoção:** não promovível

## MECANISMO

`CAL.timing.clockRate = 0.24` (`:2717`), aplicado em `:4779`
(`this.minute += dt * clockRate`): 1 s de física vira 14,4 s de relógio.

**Medido na R18.55:** partida de 94,8 min de relógio roda em **459 s de física**,
com **402 s de bola viva**. O futebol real tem 55–60 min de bola em jogo (~3300 s)
— cerca de **8× mais**.

## MEDIÇÃO: clockRate 0,24 → 0,16 (16 partidas pareadas)

| | 0,24 | 0,16 | real |
|---|---|---|---|
| chutes | 15,50 | **23,63** | ~25 |
| gols | 1,94 | **2,69** | ~2,7 |
| passes | 248,75 | 376,00 | ~900 |
| faltas | 8,44 | 12,19 | ~22 |
| xG | 1,97 | **3,02** | ~2,7 |
| **escanteios** | **2,31** | **2,44** | ~10 |

## O QUE ISSO PROVA — E O QUE FALSIFICA

**Prova:** chutes, gols, passes e faltas são limitados por TEMPO, não por
mecanismo. Passei a sessão ajustando taxas de evento quando o limitador era o
denominador.

**Falsifica minha própria hipótese:** eu previ que todas as contagens subiriam
juntas. **Escanteio praticamente não se moveu** (2,31 → 2,44). Logo o déficit de
escanteio é genuinamente mecânico, não temporal — e a OS-05B já tinha apontado
para lá quando reprovou a supressão geométrica.

## GATE

`ECO-02 ≤ 2,7 xG/partida` **REPROVA** em 0,16 (xG 3,02). A candidata não é
promovível como está. Um ponto entre 0,19 e 0,20 provavelmente põe xG na faixa
mantendo chutes perto de 20 — mas isso é interpolação minha, **não medição**.

Mais tempo de jogo multiplica gols junto: a candidata **exige** recalibrar
conversão no mesmo movimento. Não é uma constante isolada.

## ARMADILHA

Ler "chutes 23,63, gols 2,69, ambos no valor real" como sucesso. O xG estourou
o gate no mesmo movimento — os três andam juntos e só dois foram para o lugar
certo.

## PONTO ESCOLHIDO: clockRate 0,20 (medido, 16 partidas)

| | 0,24 (R18.55) | **0,20** | 0,21 | 0,16 | real |
|---|---|---|---|---|---|
| chutes | 15,50 | **18,88** | 16,75 | 23,63 | ~25 |
| gols | 1,94 | **3,00** | 2,81 | 2,69 | ~2,7 |
| xG | 1,97 | **2,38** | 2,12 | 3,02 | ~2,7 |
| passes | 248,75 | **303,06** | 294,88 | 376,00 | ~900 |
| faltas | 8,44 | **11,44** | 9,75 | 12,19 | ~22 |
| escanteios | 2,31 | 2,00 | 2,31 | 2,44 | ~10 |

`ECO-02 ≤ 2,7` **passa** em 0,20 (xG 2,38). Foi o ponto promovido para a cadeia.

### O que continua errado, e eu não vou mascarar

**Gols 3,00 com xG 2,38.** A conversão está acima do xG — o mesmo sinal que
apareceu na R18.51 e que eu já tinha marcado. O modelo de xG e a conversão real
não concordam, e afrouxar o relógio ampliou a discrepância em vez de revelá-la
menor. É o próximo número a atacar, antes de qualquer outro ajuste de escala.

**Escanteio não acompanha em nenhum ponto** — fica entre 2,0 e 2,44 nas quatro
taxas testadas, contra a faixa 4–10 do ECO-05. Confirma que o déficit é
mecânico. A OS-05B já tinha reprovado a supressão geométrica como causa
suficiente; o sítio ainda está aberto.

**Passes e faltas seguem ~3× e ~2× abaixo do real** mesmo no ponto escolhido.
0,20 melhora sem resolver.
