# R18.40A — O TETO DE VELOCIDADE E O GOLEIRO QUE VAI AO PONTO

**Status: `PROMOVÍVEL`** · base R18.35 (`8cfb1668283a`) · entrega `65933257de25`
Branch `agent/r18.25-replay-e-entrega` · base HEAD `9688e11`

Fecha a rodada R18.40 interrompida. Sete subconjuntos foram medidos com bateria
pareada n=48; **um** passa todos os gates de ecologia e é o que está aqui.

---

## A. O que entrou

| Item | Gate | Antes | Depois |
|---|---|---:|---:|
| **OS-10** velocidade derivada satura no teto do jogador | TEC-01 | 18,28 m/s | **8,98 m/s** |
| **OS-01** o goleiro caminha até o ponto de contato planejado | CAU-03 | 21,34% | **17,75%** (alvo 8% — **PARCIAL**) |

`OS-10` — `commitMovement` e a guarda global de quadro derivavam velocidade da
diferença de posição **depois** de clampar o passo, e a folga aditiva do clamp
(`+0,12` e `+0,20`) entrava na divisão por `dt`: 11,9 e 15,0 m/s para um jogador
de 7 m/s. A posição não é tocada — só a velocidade derivada passa a saturar em
`maxSpd * 1,05`.

`OS-01` — `_gkInterceptTarget` planeja o ponto de contato, a camada R10 rebaseia
a bola para esse ponto, e **ninguém levava o goleiro até lá**: `_goalkeeperTarget`
posicionava por bissetriz e `_gkAI.wait` congelava o alvo por até 0,25 s. Agora,
enquanto um chute viaja com este goleiro como ator do plano, o alvo de movimento
é o ponto planejado.

## B. Correção de rumo importante

Na primeira medição eu reportei `21,9% → 10,8%` para CAU-03. **Era ruído de
semente única.** Com o protocolo de 5 sementes (60 partidas) o número honesto é
**21,34% → 17,75%**, com amplitude entre sementes de 12,1% a 30,0%. `OS-01`
**não** está concluída e está rotulada `PARCIAL`.

## C. O mecanismo verdadeiro de OS-01 — achado, medido, e adiado

`patch_gkparidade.js` (baixar a promessa de velocidade do planejador de 8,53 para
`maxSpd` 6,05) saiu **inerte**: bateria byte-idêntica e mesmo hash na sequência de
retorno. Motivo: existem **duas** definições de `_gkInterceptTarget`. A do bundle
base é sobrescrita por `P._gkInterceptTarget=function(...)` do bloco
`cds-physics-timeline-581` — que é o `20-physics-timeline.js` que a própria ficha
OS-01 citava. O patch caiu na cópia sombreada.

O mecanismo real não é velocidade, é **raio**:

```
required = max(0, dist(gk, ponto) - radius)     // radius = argumento do plano
```

Os três sítios de chute chamam o plano com **`radius = 3.0`**, e
`_gkResolveSave` valida o contato com **`_physicalContactValid(gk, 1.95, z)`**.
Um ponto a 3 m do goleiro tem `required = 0`: o plano declara que ele já está
lá, o corpo não recebe ordem de andar, a bola chega e a checagem de 1,95 m
reprova. Vira `goal_after_failed_reach`.

Quem introduziu: `tools/r1821/build_rc1.js` (~linha 128) troca 1.95 por 3.0 nos
sítios de chute de propósito, e deixa falta e pênalti em 1,95. A checagem nunca
acompanhou. No `src/r13/scripts/10-base-bundle.js` os sítios ainda estão em
1,90/1,95 — a divergência nasce na cadeia de patches.

Restaurar a paridade (`patch_gkraio.js`) leva **CAU-03 de 21,34% para 1,24%**
(2 gols em 161, amplitude 0–3,8%) — o alvo de 8% é atingido com folga. **E
reprova a ecologia**: gols 2,667 → **2,021** e chutes no alvo 4,604 → **3,750**,
ambos abaixo do piso. A razão é estrutural: em `_gkResolveSave`, contato válido
**nunca** concede gol — todos os ramos retornam defesa. O jogo está escorado
nesse vazamento para produzir cerca de 20% dos seus gols. Vai para a R18.40B
junto com a recalibração de finalização.

## D. O que não entrou, e por quê

| Item | Medido | Motivo de ficar fora |
|---|---|---|
| **OS-09** `save_energy` | INT-05 atingido: 73 → 3,56%, 74 → 5,73% | corta `pressReach` em 0,52 e derruba chutes: 11,958 e 11,771 contra 12,042 sem ele. Piso de 12 é estrito |
| **CAU-04** paridade de raio | CAU-03 → 1,24% | gols 2,021 e no alvo 3,750, fora da faixa (seção C) |
| **OS-02** escalação | 2 397 → 397 vagas, gap 14,3 → 9,5 | gols 3,729 e xG 3,008. Pelé (98) sai do banco e a finalização precisa de recalibração |

`OS-09` e `ECO-03` **não fecham juntos com este mecanismo**: gatilho 70 daria
1,77%, abaixo do mínimo de INT-05. É um conflito real, não uma calibração
faltando.

## E. Bateria pareada n=48

Mesmas sementes (`4200000 + i·7919`), 17 formações, 7 estilos.

| métrica | R18.35 | R18.40A | Δ | banda | faixa |
|---|---:|---:|---:|---:|---|
| chutes | 12,458 | 12,042 | −3,3% | 7% | 12–20 **ok** |
| no alvo | 4,604 | 4,604 | 0,0% | 7% | 4–7 **ok** |
| gols | 2,667 | 2,729 | +2,3% | 30% | 2,4–3,2 **ok** |
| xG | 2,059 | 2,067 | +0,4% | 7% | 1,8–2,7 **ok** |
| escanteios | 1,333 | 1,125 | −15,6% | 31% | ECO-05 é R18.41 |
| desarmes | 8,292 | 8,104 | −2,3% | 22% | — |
| passes | 236,833 | 237,604 | +0,3% | 2% | — |
| impedimentos | 1,146 | 1,792 | **+56,4%** | 17% | ver seção F |

Nenhuma faixa perdida. Todos os quatro gates de ecologia da R18.40A passam.

## F. Impedimento: a regra foi verificada, não só a contagem

Impedimentos sobem 56,4%, acima da banda de 17%. A matriz já avisava a
dependência de `OS-10` ("movimento realimentado", "proteger linhas/impedimentos"),
porque `p.vx` realimenta a integração de posição no quadro seguinte — o clamp
muda o movimento, e minha afirmação inicial de que ele era neutro no movimento
estava errada.

`diag_impedimento.js` recalcula a linha do segundo-último defensor no instante de
cada marcação e confere o veredito contra a geometria:

| | R18.35 | R18.40A |
|---|---:|---:|
| concordância com a geometria | **100%** (35/35) | **100%** (33/33) |
| casos claros (margem > 0,5 m) | 100% (35) | 100% (32) |
| margem mediana | 2,43 m | 2,53 m |
| marcações por partida (evento) | 4,78 | 4,78 |

A **lei está intacta**. A contagem de `stats.offsides` sobe, e a direção é para o
futebol real (baseline 1,146 contra 2–3 reais). Fica registrado como
comportamento medido, não como regressão de regra — e nenhum gate da matriz
governa a contagem.

## G. TEC-05 — o laboratório parou de mentir

O harness engolia `document is not defined` e a bateria contava o bloco falho
como `scriptsOk++`. Por isso **todos** os relatórios promovidos anteriores
(R18.25, R18.31, R18.35) diziam `scriptsComErro: 0`.

`diag_harness.js` localizou o ponto: `script-2`, **linha 7583 de 12182 (62,3%)**,
em `document.addEventListener('click', …)` — fiação de interface, logo depois de
`window.UI = {…}`.

Verificado que a medição do simulador continua válida: depois daquela linha há
**zero** atribuições a `MatchSim.prototype`, **zero** mutações de `CAL`, **zero**
reatribuições de `autoLineup`. As 11 exportações seguintes são UI, boot, save e
ponte de timeline. O que o laboratório perde é a UI e a Copa — exatamente o que a
Ordem de Serviço já declarava como não medido.

`tools/r1840/bateria.js` agora reporta `48 ok / 1 erro`, registra bloco/linha/
mensagem e **aborta** se faltar qualquer um de 13 símbolos do motor.

**Prova de neutralidade:** a baseline R18.35 re-medida com o harness corrigido
(mesmo sha `8cfb1668283a`) devolveu agregados **idênticos** nas 14 métricas × 7
campos. A correção não mexeu em nenhum número.

Decisão registrada: **não** injetar um `document` completo. Faria o bundle inteiro
rodar, mas mudaria o que está carregado em relação a todas as baterias promovidas
anteriores, e a comparação pareada perderia sentido. Copa e UI se medem no
navegador, que é onde elas existem.

## H. Integridade

| verificação | resultado |
|---|---|
| partida completa no navegador | ok (2×3, 13 mil passos) |
| NaN / infinito | **0** |
| erros de console | **0** |
| `vmax` no navegador | 8,56 m/s |
| carga do bundle | 48 ok / 1 erro, `motorVerificado: true` |
| sha da build medida = sha da promovida | **sim** (`65933257de25`) |

## H2. ECO-03 não é robusto à semente — e isso invalida parte da minha seleção

Depois de promover, testei a aprovação numa segunda base de sementes
(`8400000`, mesmo n=48, mesmo script). Resultado:

| | semente 4200000 | semente 8400000 | faixa |
|---|---:|---:|---|
| chutes R18.35 | 12,458 | **11,854** | 12–20 |
| chutes R18.40A | 12,042 | **11,438** | 12–20 |
| no alvo R18.40A | 4,604 | 4,417 | 4–7 ok |
| xG R18.40A | 2,067 | 1,882 | 1,8–2,7 ok |
| gols R18.40A | 2,729 | 2,646 | 2,4–3,2 ok |

**A baseline R18.35, já promovida, reprova ECO-03 na segunda base.** O piso de 12
não é uma propriedade do jogo: é uma propriedade da semente 4200000. Os outros
três gates de ecologia passam nas duas bases.

Isto tem uma consequência direta sobre a decisão desta rodada, e ela é
desfavorável ao que eu fiz: **a OS-09 foi excluída por ECO-03**, com 11,958
(gatilho 73) e 11,771 (gatilho 74) contra 12,042 do subconjunto promovido. As
três diferenças são menores que a banda de ruído de chutes (7% = ±0,87), e o
piso não se sustenta nem na baseline. Escolher `sub_b` em vez de `sub_a` por
esse critério foi, na prática, promover sobre ruído — o que a regra da rodada
proíbe explicitamente.

O que **é** reprodutível: a R18.40A custa cerca de 3,4% de chutes nas duas bases
(−3,3% e −3,5%). Efeito consistente em direção, dentro do ruído em magnitude, e
sem mecanismo isolado — portanto **não** deve ser tratado como regressão nem
como melhoria.

Encaminhamento: `ECO-03` precisa ser reespecificado antes de voltar a decidir
promoção. Duas opções, ambas para a matriz e não para o código:
1. piso derivado de várias bases de semente (por exemplo, mediana de 5 bases),
   em vez de um valor único;
2. piso mais baixo, coerente com o que o jogo realmente entrega (~11,4 a 12,5).

Enquanto isso, **a inclusão da OS-09 fica reaberta**: ela atinge INT-05 e o único
motivo para tê-la deixado fora não resistiu ao teste de robustez.

## I. Próximos passos — R18.40B

1. **Recalibrar finalização** com o vazamento do goleiro fechado. `patch_gkraio.js`
   já existe e está medido: CAU-03 cai para 1,24%. Falta compensar gols e chutes
   no alvo, que caem para 2,021 e 3,750. O lever é `CAL.shooting`.
2. **Entrar com OS-02** na mesma bateria: os dois empurram gols em direções
   opostas (raio para baixo, escalação para cima) e podem se encontrar dentro da
   faixa. Medir juntos, com bisecção se reprovar.
3. **Reespecificar `ECO-03` antes de qualquer nova promoção** (seção H2). A
   baseline R18.35 reprova o piso de 12 na base de sementes 8400000, então o
   gate não discrimina candidatas nesta vizinhança. Sem isso, toda decisão de
   promoção que dependa de chutes é decisão sobre ruído.
4. **Reabrir a OS-09.** Ela atinge INT-05 (3,56% com gatilho 73) e o único motivo
   para tê-la deixado fora — ECO-03 — não resistiu ao teste de robustez. Medir
   `vel+folego73+goleiro` em pelo menos três bases de semente e decidir por
   mecanismo, não por limiar.
4. **OS-05** segue REDIAGNOSTICADO: `_clearBall` é chamado 0 vezes em 12 partidas
   e manda a bola para frente, então não gera escanteio por geometria. O caminho é
   toque defensivo que mande a bola para a própria linha de fundo, no padrão de
   inversão de causalidade da R18.31. ECO-05 é R18.41.

## J. Arquivos

**Patches** (`tools/r1840/`) — `patch_velocidade.js`, `patch_goleiro.js`
(promovidos); `patch_folego.js`, `patch_escalacao.js`, `patch_gkraio.js`,
`patch_gkparidade.js` (medidos, não promovidos); `patch_identidade.js`.

**Instrumentos** — `bateria.js` (harness corrigido), `avalia.js`, `recon.js`,
`micro_goleiro.js`, `diag_harness.js`, `diag_impedimento.js`, `diag_gkplano.js`,
`diag_corte.js`, `diag_saida.js`, `diag_pressao.js`, `diag_escalacao.js`,
`diag_treinador.js`, `server.js`.

**Baterias** (`reports/r1840/`) — `bateria48_R18.40A.json` (promovida),
`verif_r1835_harness.json` (prova de neutralidade), `sub_a`…`sub_g`,
`cand_vfg.json`, `bisect_*`, `micro_goleiro_*`, `imped_*`.
