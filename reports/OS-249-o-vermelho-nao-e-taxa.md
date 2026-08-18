# OS-249 · `redsPerMatch` não é uma taxa — e por isso nunca fechou

`redsPerMatch` é a métrica que mais flutuou nesta base. Reprovou a OS-211,
quase reprovou a OS-232, apareceu como "0,318 contra teto 0,30" na OS-234 e
como 0,368 hoje. Toda vez a pergunta foi a mesma — *é ruído ou é causa?* — e
toda vez a resposta veio de mais amostra, nunca de mecanismo.

Esta rodada responde pelo mecanismo. E, no caminho, **desmente uma afirmação
minha de duas horas atrás**.

---

## 1. O que o vermelho é, de fato

Lendo `_awardFoul` e cruzando com os agregados que já estavam no repo:

| build | cartões/jogo | 2º amarelo | vermelho direto | % que é 2º amarelo |
|---|---|---|---|---|
| pré-OS-234 · 288 | 4,413 | 0,229 | 0,014 | 94% |
| pré-OS-234 · 576 | 4,526 | 0,252 | 0,017 | 94% |
| atual · 288 | 4,594 | 0,354 | 0,014 | 96% |

**Vermelho direto é 0,014 por jogo e não se move nunca** — é
`chance(CAL.defending.straightRed)` por falta, e falta está parada em 22,5.

Logo `redsPerMatch` **não é uma taxa**: é uma estatística de **concentração**.
Ela pergunta "o mesmo jogador foi advertido duas vezes?", que é de segunda
ordem na taxa de cartão. Tem desvio de Poisson (`dp ≈ √média`) e, a 288
partidas, erro padrão de **0,034**.

Isso sozinho já explica a história inteira: a métrica flutuou em todas as
rodadas porque **a amostra usada nunca foi adequada à natureza do número**.

## 2. A armadilha em que eu caí, medida

A 288 partidas o índice de concentração (2º amarelo observado ÷ esperado se o
cartão caísse em jogador aleatório entre os 22) subia de 0,530 para 0,759 —
+40% com o cartão subindo só 4%. Escrevi que "isso não se explica por amostra".

**Explica.** A bateria usa sementes `i = 0..n−1`, então as 288 partidas são
**subconjunto estrito** das 576. A segunda metade sai por subtração:

| | 1ª metade (288) | 2ª metade (288) | total (576) | dispersão interna |
|---|---|---|---|---|
| build atual | **0,368** | **0,268** | 0,318 | **0,100** |
| controle | 0,243 | 0,295 | 0,269 | 0,052 |

**As duas metades do mesmo build discordam em 0,100 — o dobro da diferença
entre os builds (0,049).** É exatamente a lição da OS-244, onde janelas
pareadas discordaram mais que os tratamentos. O 0,368 era a primeira metade
sendo alta; a segunda metade do próprio build tratado mede 0,268, colada no
controle.

Entre builds, a 576 partidas: 0,318 contra 0,269, diferença 0,049 com erro
padrão combinado 0,032 — **1,5 σ. Não é significativo.**

O índice de concentração, recalculado a 576: 0,554 (controle) contra 0,684
(atual). Ainda subiu, mas herdou o mesmo ruído e não sustenta conclusão.

## 3. Quanta amostra seria preciso

Para resolver uma diferença de 0,049 a 3 σ, com `σ ≈ 0,55`:

```
3 · 0,55 · √(2/n) = 0,049   ->   n ≈ 2270 partidas POR BRAÇO
```

Quatro vezes a maior bateria que este projeto já rodou. **Nenhuma decisão de
288 ou 576 partidas sobre `redsPerMatch` é decidível.** Escrito assim, fica
claro que o problema não é o jogo: é o alvo de design não vir acompanhado do
tamanho de amostra que ele exige.

## 4. O que fica

* A conclusão da OS-234 (**é ruído**) se sustenta a 576. Corrigido apenas o
  argumento: o que recua com a amostra não é "o número andando na direção do
  controle" — é a primeira metade ter sido alta por acaso.
* **`redsPerMatch` 0,318 continua acima do teto de 0,30**, e continua sendo o
  único item de design fora da faixa junto com `onTargetRate` 0,324 (custo
  declarado da OS-212). Não é regressão de nenhuma rodada recente.
* Recomendação para a calibração: um alvo cuja média é 0,3 por partida e cujo
  desvio é √0,3 precisa **declarar a amostra mínima** ao lado da faixa. Sem
  isso, ele reprova e aprova mudanças por sorteio — e já reprovou pelo menos
  uma (a janela de 4,0 s da OS-214, barrada por `blowoutRate` medido a 96).
* Ferramenta nova: `tools/fisica/cartoes.js` mede a concentração direto —
  cartões por jogador, por posição e por terço do campo, e o intervalo entre o
  1º e o 2º amarelo do mesmo jogador — com a semente da bateria.

## 5. A lição de método, outra vez

Eu tinha o número (índice +40%), tinha um mecanismo plausível (menos escanteio
⇒ os mesmos zagueiros seguem defendendo) e escrevi que não se explicava por
amostra. Faltou a verificação mais barata: **as duas metades do próprio build
concordam entre si?**

Não concordavam. Mecanismo plausível mais número grande continua não sendo
evidência — é a mesma forma de erro da OS-233, da OS-244 e da OS-248.
