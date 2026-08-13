# D19 · Os dois últimos candidatos morreram, e a conversão não tem folga

**Data:** 2026-08-13 · **Sondas:** `tools/fisica/ramo-d19c.js` ·
**Baterias:** 1 × 300 + 5 × 96 · **Resultado: nada entrou, e o motivo mudou.**

Este laudo continua `reports/D19-D20-a-mesma-alavanca.md`, que gastou 4 baterias
e reprovou três tentativas. Ele terminava deixando dois candidatos.

---

## Candidato 1 — já tinha caído

*"O time cansado circula em vez de arriscar."* Refutado em
`reports/PASSES-que-sobem.md`: o passe é igual em comprimento, direção e origem,
e os passes sobem 5,7% (não 17% — era denominador).

## Candidato 2 — REFUTADO aqui, e ao contrário

> *"A decisão de arriscar o passe vertical não muda com o placar nem com o
> relógio — o time perdendo aos 85 joga igual ao time empatando aos 10."*

`ramo-d19c.js`, 48 partidas, decisão a decisão, cruzando estado de placar ×
faixa de minuto, com **minuto de jogo** como denominador:

| | perdendo / 76+ | empatando / 0‑15 | razão |
|---|---|---|---|
| progresso do passe escolhido | 5,142 | 3,338 | **1,54** |
| risco aceito | 0,633 | 0,399 | **1,59** |
| fração de passes verticais | 0,254 | 0,218 | 1,17 |
| decisões por minuto | 4,149 | 4,258 | 0,97 |
| **chutes por minuto** | 0,162 | 0,198 | **0,82** |

**A previsão estava invertida.** O time perdendo no fim arrisca **59% mais** e
joga **54% mais vertical** — e chuta **18% menos**. A máquina de urgência que já
existe (`:923` no chute, `:3172` na posição, `:3756` na IA do treinador)
funciona.

O que falha é converter intenção em **penetração**, que é exatamente o funil:
`velocidade média 0,913` → `em alcance de chute 0,613`. **O alvo do D19 é
físico-espacial, não decisional**, e os dois candidatos que sobravam estão
mortos.

---

## A objeção retirada — e por que valia tentar

A **tentativa 1** do laudo anterior (achatar a fadiga na velocidade,
`staminaF` de `0,70 + ×0,30` para `0,75 + ×0,25`) tinha sido rejeitada por dois
motivos:

1. não atingiu os critérios declarados do D19 (76+ ≥ 20%);
2. **piorou o encurtamento do bloco de 2,8 m para 0,8 m.**

O motivo 2 media o **D20**, que foi **refutado depois**: aqueles 2,8 m vinham de
comparar, no mesmo instante, o time que ataca com o time que defende — foto
transversal lida como filme.

Confirmei em vez de confiar no argumento. `tools/fisica/tela/forma.js`, medição
longitudinal, com a tentativa 1 aplicada:

| | medido | referência real |
|---|---|---|
| encurtamento da recomposição | **7,2 m** | 8–10 m |
| bloco assentado (≥4 s da perda) | **33,0 m** | 25–35 m |

**A objeção não reproduz.** Era artefato.

---

## O que a medição de 300 partidas disse

Os dois portões automáticos **aprovaram**:

- 14 métricas agregadas: **nenhuma** se moveu 2 SE
- placar de design: **12/13**, nenhuma saiu da faixa

E o terceiro placar caiu:

| | antes | depois | faixa do futebol real |
|---|---|---|---|
| **futebol real** | **15/21** | **13/21** | |
| gols | 2,877 | **3,073** | 2,5–3,0 |
| golPorChuteNoAlvo | 0,379 | **0,395** | 0,27–0,38 |
| golsTardios | 0,147 | 0,161 | 0,18–0,30 |
| início/fim por minuto | 1,92× | 1,54× | |

Armadilha **B12**, a mesma do D22: o `aceitar.sh` não vigia o futebol real.

E duas métricas de design ficaram **raspando o limite**: `blowoutRate` 0,190
contra teto 0,19, e `averageEndingStamina` 64,38 contra piso 64,0. A dose
consome toda a folga que existe.

---

## A varredura de dose não resolveu — e o controle explica por quê

Piso varrido de 0,70 a 0,75, 96 partidas cada, contra os três placares:

| piso | real | gols | golPorAlvo | golsTardios | início/fim |
|---|---|---|---|---|---|
| **0,70 (controle)** | **12/21** | **3,20** | 0,403 | 0,173 | 1,74× |
| 0,72 | 13/21 | 2,938 | 0,378 | 0,145 | 2,25× |
| 0,73 | 13/21 | 3,12 | 0,395 | 0,154 | 2,31× |
| 0,74 | 14/21 | 2,969 | 0,385 | 0,161 | 1,99× |
| 0,75 | 13/21 | 3,10 | 0,410 | 0,141 | 1,73× |

**O controle é o estado aceito, e aqui ele lê 12/21 e 3,20 gols — quando as 300
partidas dão 15/21 e 2,877.** Com n=96 o erro-padrão dos gols é ~0,17: a
diferença entre as doses é menor que o ruído, e a contagem do placar oscila
porque depende de métricas cruzarem limiares. **A varredura não distingue nada.**
Armadilha **B7**, terceira vez nesta investigação.

---

## O achado que fica, e é o mais útil

**A conversão do jogo está encostada no teto e não tem folga.**

`golPorChuteNoAlvo` mede **0,379** contra um teto real de **0,38** — um
milésimo. Isso não é acaso: foi a A2 que o trouxe de 0,428 para 0,378 ao
consertar o goleiro, e ele ficou colado no limite.

Consequência direta, e ela restringe todo o D19:

> **Qualquer mudança que acrescente gols sem acrescentar chutes quebra o placar
> do futebol real.**

E é exatamente o que a fadiga achatada faz. Medido em 300 partidas:

| | antes | depois | |
|---|---|---|---|
| chutes | 23,710 | 23,520 | **parado** |
| xG | 3,013 | 2,988 | **parado** |
| gols | 2,877 | 3,073 | sobe |

Chutes parados, xG parado, gols subindo: o jogador cansado mais rápido **não
penetra mais** — ele **converte melhor**. E conversão é o único lugar onde não
há espaço.

> Isso também obriga a ler a tentativa 1 com honestidade: `+0,196` gol está
> **dentro** dos 2 SE (0,312), e por isso o portão disse "ok". O ganho no
> `golsTardios` (0,147 → 0,161) e no início/fim (1,92× → 1,54×) é da mesma ordem
> do ruído. **Não há melhora estatisticamente sólida no D19 — há custo real no
> futebol real.**

---

## O que isto deixa para quem continuar

1. **O D19 precisa de CHUTES no fim da partida, não de gols.** O critério de
   aceite deveria dizer isso: `chutesPorMinuto` na faixa 76+ subindo, com
   `golPorChuteNoAlvo` **parado**.
2. **A fadiga na velocidade está encerrada como alavanca** — quatro doses, três
   rodadas, e o mecanismo comprovadamente entrega conversão, não penetração.
3. **Nenhuma varredura de placar abaixo de ~300 partidas decide nada.** Use a
   varredura para achar o *sinal* de uma métrica direta (impedimento, laterais),
   nunca para contar quantas métricas passam.
4. O que sobra sem descarte: fazer o time **entrar** na faixa de chute mais
   vezes no fim — e o funil diz que ele perde isso por velocidade, que é
   justamente o que não se pode devolver por este caminho.

Ferramenta nova: `tools/fisica/ramo-d19c.js` — decisão a decisão, por estado de
placar e faixa de minuto.
