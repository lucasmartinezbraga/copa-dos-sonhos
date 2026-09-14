# Gates de realismo — proposta

Hoje a auditoria mede **equilíbrio** (nenhum estilo domina) e **integridade**
(nada quebra). Ela **não mede se o jogo parece futebol**. Por isso eu tratei
"gols subiram" como custo em várias decisões sem ter base — erro apontado pelo
usuário e corrigido aqui.

Esta tabela propõe os gates que faltam, com referência do futebol real e do
padrão de simulação tipo FM. Cada faixa é uma proposta a ser aceita ou ajustada
— **não são gates oficiais até você aprovar**.

---

## 1. RESOLVIDO — `perMatch` é a SOMA dos dois times

Verificado na partida 0: chutes `[8,1]` = 9, passes `[77,112]` = 189, e o
relatório mostra 11,80 e 193,4. Todas as faixas abaixo são **totais da partida**.

E isso revela o achado mais importante desta análise: **o motor é
sistematicamente pouco denso**. Não é uma métrica fora da faixa — são todas.

| métrica | real | R14.4 | % do real |
|---|---:|---:|---:|
| gols | 2,7 | 1,76 | **65%** |
| chutes | 25 | 11,8 | **47%** |
| passes | 900 | 193 | **21%** |
| escanteios | 10 | 5,9 | **59%** |
| laterais | 38 | 10,4 | **27%** |
| impedimentos | 4,2 | 1,15 | **27%** |

Nenhuma está acima do real. A partida acontece a uma fração da densidade de
eventos do futebol de verdade — e isso é coerente com a sensação de jogo
"parado" que você relatou desde o começo.

**Consequência para o teste:** subir a densidade é provavelmente mais valioso
que ajustar qualquer faixa individual. E reforça que eu estava errado ao tratar
aumento de gols como custo — o jogo tem gols DE MENOS, não de mais.

---

## 2. Placar e finalização

| métrica | real (elite) | R14.4 atual | faixa proposta | por quê |
|---|---|---:|---|---|
| gols/partida `[?]` | 2,5–2,9 | 1,76 | **2,0–3,2** | abaixo de 2 o jogo parece travado; acima de 3,2 vira arcade |
| chutes/partida `[?]` | 24–27 | 11,8 | **18–30** | volume de finalização é a assinatura mais visível do ritmo |
| chutes no alvo (%) | 32–36% | não medido | **28–40%** | precisa instrumentar |
| gols por chute (%) | 9–12% | ~15% | **8–14%** | conversão alta demais indica defesa/goleiro fracos |
| chutes de fora (%) | 35–40% | não medido | **25–45%** | evita jogo só de área ou só de longe |

## 3. Passe e posse

| métrica | real | R14.4 | faixa proposta | por quê |
|---|---|---:|---|---|
| passes/partida `[?]` | 850–1000 | 193 | **investigar** | gap grande demais para virar gate agora |
| acerto de passe (%) | 80–86% | não medido | **75–88%** | métrica-chave de qualidade; falta instrumentar |
| posse (desvio do 50/50) | ±12 p.p. | não medido | **≤ ±18 p.p.** | um time não pode sumir com a bola |
| passes por posse | 3,5–4,5 | não medido | **2,5–6,0** | mede se há construção ou só chutão |

## 4. Duelo, drible e desarme

| métrica | real | R14.4 | faixa proposta | por quê |
|---|---|---:|---|---|
| dribles tentados/partida `[?]` | 18–24 | 8,7 | **12–26** | drible é onde a habilidade individual aparece |
| dribles certos (%) | 48–56% | não medido | **42–60%** | **o gate central do pedido "habilidade importa"** |
| desarmes/partida `[?]` | 30–38 | 5,9 | **investigar** | possível diferença de definição |
| faltas/partida `[?]` | 20–24 | não medido | **16–28** | jogo sem falta não é futebol |
| cartões amarelos/partida | 3,2–4,2 | não medido | **2,0–5,5** | |
| cartões vermelhos/partida | 0,15–0,30 | não medido | **≤ 0,6** | |

## 5. Bola parada

| métrica | real | R14.4 | faixa proposta | status |
|---|---|---:|---|---|
| escanteios/partida `[?]` | 9–11 | 5,92 | **7–14** | hoje fora da faixa |
| gols de escanteio (% do total) | 8–13% | 4,59% | **3–16%** | dentro |
| laterais/partida `[?]` | 30–45 | 10,44 | **investigar** | gap grande |
| impedimentos/partida `[?]` | 3,5–5,0 | 1,15 | **1,0–5,0** | dentro, no piso |
| tiros de meta/partida | 12–17 | 7,33 | **6–18** | dentro |
| pênaltis/partida | 0,25–0,35 | não medido | **≤ 0,8** | |

## 6. Movimentação — o que o olho humano viu

Nenhuma destas existe hoje. São as que capturam as reclamações reais.

| métrica | alvo | R14.4 | por quê |
|---|---|---:|---|
| velocidade do defensor a 0–2 m da bola | **≥ 3,5 m/s** | 4,19 ✅ | mede se alguém dá bote de verdade |
| defensores a menos de 10 m da bola | **≤ 3,0** | não medido | mede o amontoamento relatado |
| tempo parado (<1 m/s) | **≤ 15%** | 9,3 ✅ | jogo parado não é futebol |
| tempo em sprint (>7 m/s) | **≥ 3%** | 1,3 ❌ | ninguém arranca de verdade |
| comprimento ocupado pelo time | **35–55 m** | 32,5 ❌ | time espremido |
| largura ocupada pelo time | **40–60 m** | 44,8 ✅ | |
| atacantes na área em ataque | **≥ 1,5** | 0,22 ❌ | ninguém entra na área |

## 7. Habilidade individual — o pedido central

**Nenhuma destas existe. É o bloco mais importante a construir.**

| métrica | alvo | por quê |
|---|---|---|
| sucesso de drible: top 20% vs bottom 20% de `drible` | **diferença ≥ 20 p.p.** | prova que craque dribla mais |
| acerto de passe: top vs bottom de `passe` | **diferença ≥ 12 p.p.** | |
| conversão: top vs bottom de `finalizacao` | **diferença ≥ 6 p.p.** | |
| desarme certo: top vs bottom de `desarme` | **diferença ≥ 15 p.p.** | |
| defesas: top vs bottom de goleiro | **diferença ≥ 10 p.p.** | |
| correlação atributo × sucesso | **r ≥ 0,35** em cada eixo | mede se o atributo *ordena* o resultado |

Este é o teste que eu deveria ter feito quando mexi nos clamps de drible e
desarme e não fiz. Sem ele, "habilidade importa" continua sendo hipótese.

## 8. Gates que já existem e devem ser preservados

| gate | limite | R14.4 |
|---|---|---|
| `ppgRange` | ≤ 0,75 | 0,464 ✅ |
| `maxAbsGoalDiffPerMatch` | ≤ 0,65 | 0,250 ✅ |
| `parkIdentity` / `tikiIdentity` | true | PASS ✅ |
| `marking` | cobertura ≥ 0,65 e dist ≤ 8,5 m | ~0,70 / 8,26 ✅ |
| `lines` | amplitude ≤ 10 m, desconexão ≤ 22% | ✅ |
| `ball` | divergência corpo/bola ≤ 10% | 0% ✅ |
| trava da bola | raio 4 m / 3 s | 0 travas ≥10 s ✅ |
| determinismo | mesma seed = mesmo resultado | ✅ |
| R13.0 congelada | byte-idêntica | ✅ |

---

## 9. O que instrumentar para rodar o teste

Em ordem de valor:

1. **Habilidade × sucesso** (bloco 7) — o pedido central, e nada disso existe
2. **Acerto de passe e chute no alvo** — duas métricas básicas ausentes
3. **Faltas e cartões** — nunca medidos
4. **Amontoamento** (defensores perto da bola) — captura a reclamação visual
5. **Confirmar por-time vs por-partida** — sem isso metade da tabela é chute

## 10. Ressalva

As faixas de referência vêm do meu conhecimento de futebol real e de
simuladores do gênero, **não de uma fonte citável que eu tenha consultado
agora**. Trate-as como ponto de partida para discussão, não como verdade
estabelecida. Onde escrevi "investigar", a diferença é grande demais para eu
propor faixa sem entender antes se é defeito ou diferença de definição.
