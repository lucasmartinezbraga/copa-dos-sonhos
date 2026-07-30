# HANDOFF — continuar a Copa dos Sonhos a partir da R18.44

Não recomece a auditoria. Tudo abaixo foi medido em 3 bases de semente, está
commitado e é verificável.

---

## 0. Leia antes de tocar em nada

**O jogo não vive em `src/scripts/`, e não vive na branch `main`.** O checkout
inicial de uma sessão nova cai em `main`, que é a linhagem Fase 1/2/3 e não tem
nada de R18. A linhagem R18 está em `agent/r18.25-replay-e-entrega` (e a
continuação desta sessão em `claude/handoff-leitura-execucao-qshbb0`). O jogo é
construído de `src/r13/scripts/` via `tools/build_r13.py` e depois transformado
por patches aplicados ao **HTML já construído**. A verdade comportamental é a
build em `dist/`, não o fonte.

**Procure `P.<nome>=function` antes de patchar qualquer método.** Nesta sessão
essa regra impediu um patch inerte: `_defendTarget` tem **seis** definições em
cadeia e o `shiftScale` do bundle base é código morto para DEF e MID.

**Protocolo de ruído.** Um Δ só conta se `|Δ| > banda` **E** existe mecanismo no
código que o explique. 48 sementes pareadas e **3 bases** para promoção, e
pergunte primeiro se a **baseline** cumpre o gate naquela base
(`tools/r1844/multibase44.js`).

**Ambiente:** Linux, `node v22.22.2`, Chromium em
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Bateria n=48 ≈ 2,5 min;
`diag_espaco` n=12 ≈ 45 s; `diag_xg` n=48 ≈ 3 min.

---

## 1. Estado promovido

**R18.44** · `dist/COPA DOS SONHOS - R18.44 - RAIO DO GOLEIRO.html`
SHA `8466fd7bf6b978fb810e5a436bde1ce123c15320a44ee544b9e0a0aee23b3328`

Acumulado: R18.21-RC2, R18.25, R18.31, R18.35, R18.40A, R18.43 (estrutura de
bloco) e R18.44 (raio do goleiro).

Medianas de 3 bases (4200000 / 8400000 / 1260000):

| gate | R18.43 | R18.44 | faixa | |
|---|---:|---:|---|---|
| ECO-01 gols | 3,125 | **2,542** | 2,4–3,2 | ok **em 3/3** |
| ECO-02 xG | 2,421 | 2,495 | 1,8–2,7 | ok |
| ECO-03 chutes | 14,563 | 15,250 | 12–20 | ok |
| ECO-04 no alvo | 5,688 | 5,167 | 4–7 | ok |
| COE-01 gols/xG | 1,313 | **1,019** | 0,90–1,15 | **ok (gate novo)** |
| CAU-03 % gols falha GK | 19,333 | **1,667** | <8 | **ok** |
| ESP-02 bloco | 37,07 | 36,75 m | >35 | ok |
| ESP-03 zaga→ataque | 31,18 | 30,99 m | >30 | ok |
| ESP-04 <20 m da bola | 40,81 | 41,12% | 35–45 | ok |
| ESP-01 campo vazio | 67,88 | 67,97% | <50 | **reprova — alvo inatingível** |

TEC-02 0 · TEC-03 0 erros em Chromium real · TEC-04 8/8 e 8/8 invertido ·
TEC-05 49 ok / 1 erro conhecido · `tools/verify.py` exit 0 · UX-01 **não
verificado** (precisa de aparelho real).

---

## 2. O que você precisa saber antes de planejar

### 2.1 `OS-02` continua bloqueado, mas por um motivo diferente do que se pensava

A folga de `ECO-01` subiu de 0,08 para **0,66**. Mas `ECO-02` segue o gargalo:
folga 0,205 contra os **+0,92 de xG** que a escalação correta vale (medido na
R18.40B).

**E aqui está o reenquadramento que o número obriga.** Futebol real tem xG total
de ~2,7 por partida, igual aos gols (~2,7). Logo o teto de `ECO-02` **está certo
em relação à realidade.** Um XI correto entregando 3,4 de xG não é gate mal
calibrado — é o **resto do motor sendo generoso demais** para suportar um ataque
bem escalado. Re-derivar `ECO-02` para aprovar `OS-02` aprovaria um jogo acima do
futebol real, e isso mata a opção "re-derivar contrato" que dois handoffs
anteriores tratavam como saída legítima.

O caminho é reduzir a generosidade onde ela é injustificada — §2.2.

### 2.2 O cruzamento rasteiro é o próximo alvo, e já está quantificado

`low_cross_shot` é **44,2% de todas as finalizações** e não tem termo posicional
nenhum:

```js
const pGoal=clamp((.16+(finish-keeper)/100*.23+ctx.execution*.09)*.82,.06,.40);
```

Medido no instante do evento, pela posição da **bola**: **25,0 m** de distância
média ao gol, com 46% dos casos em 22–30 m e 24% além de 30 m, recebendo `pGoal`
achatado de 0,19–0,22. A tabela `CAL` vale 0,032 em 22–30 m e 0,015 além de 30 m —
o caminho cobra **~6× o valor posicional**. O sítio tem `atk.x`/`atk.y`
disponíveis e não os usa.

**Previsão registrada para você derrubar com medição:** 6,44 finalizações/partida
× 0,20 = 1,29 de xG hoje. Com termo posicional mais um bônus situacional legítimo
de ~2× (a bola rasteira encontra defesa e goleiro deslocados, então vale mais que
um chute qualquer da mesma distância — mas não 6× mais), ficaria em ~0,10 por
chute = 0,64 de xG, ou seja **−0,65 de xG**. Isso levaria o xG a ~1,85 e abriria
folga de 0,85, onde `OS-02` (+0,92) passa a caber quase exatamente.

Cuidado: `header_shot` (11,4% das finalizações, base fixa 0,105, dtg médio 19,1 m)
tem o mesmo defeito de forma mais branda e converte perto do plausível para
cabeceio. **Não mexa nos dois juntos** — a R18.40B reprovou justamente por medir
escalação e raio no mesmo pacote e não saber de qual metade vinha a reprovação.

### 2.3 O gate que faltava, e por que ele importa

`COE-01` (gols/xG ∈ [0,90; 1,15]) é novo nesta rodada. Ele existe porque **nenhum
gate da matriz forçava a coerência do modelo de xG com os próprios gols** — e foi
por isso que `goal_after_failed_reach` (um caminho que transforma não-gol em gol
sem somar xG) atravessou R18.25, R18.31, R18.35, R18.40A e R18.43 sem nada
reprovar. Mantenha esse gate: ele é o detector de "gol que apareceu do nada".

---

## 3. Fichas abertas

**OS-05 escanteio sem causalidade — a de maior valor visível, e está isolada.**
Não tocada. O diagnóstico anterior continua válido: a direção da OS original está
**errada** (`_clearBall` é chamada **0 vezes** em 12 partidas e manda a bola para
frente, `o.x + dir*25`). O caminho é criar toque defensivo que mande a bola para a
**própria** linha de fundo, no padrão de inversão de causalidade da R18.31.
Instrumentos: `diag_corte.js`, `diag_saida.js`, `diag_pressao.js`. Escanteios
subiram para ~1,4/partida na R18.43 só pela geometria do bloco, contra faixa
`ECO-05` de 4–10 — ainda falta um fator ~3. **Aviso:** levar escanteios à faixa
adiciona ~+0,1 a +0,26 de xG, e a folga hoje é 0,205 — OS-05 provavelmente precisa
de §2.2 antes.

**ESP-01 — alvo inatingível, precisa de decisão do dono da matriz.** `<50%` de
campo vazio é geometricamente impossível: 20 jogadores × disco de raio 8 m =
4 021 m² de 7 140 m², piso teórico **43,7%** exigindo sobreposição zero em todo
quadro. Proposta em `tools/r1843/gate_esp01.md`. Nenhuma das 11 definições
medidas aprova qualquer build — a proposta de aposentar o alvo não é
auto-servente.

**OS-04** poucos corpos no escanteio. Depende de OS-05.

**OS-06** Copa com poucos gols e 19,8% de 0×0. Medir com `window.CUP` no
navegador — `tools/r1843/browser_smoke.js` mostra que `CUP.teamFor` carrega lá e
não no laboratório.

**OS-08** condução 1,0% das ações do portador.

**OS-09** `save_energy`, arquivada em `tools/r1840/patch_folego.js`. O gate que a
excluía (`ECO-03`) agora cumpre em 3/3 por mérito — era exatamente a condição que
`gate_eco03.md` pedia para reavaliar. **Vale reabrir.**

**OS-07** parcialmente resolvida: profundidade do bloco corrigida
(`ESP-02`/`ESP-03` cumprem), cobertura (`ESP-01`) e ocupação de corredores não.
`ESP-04` tem direção **inconsistente** entre bases com piso de faixa em 35% — é o
gate a vigiar em qualquer continuação de espaço.

---

## 4. Missão sugerida

1. **§2.2, o cruzamento rasteiro.** É o maior defeito de finalização por volume,
   tem mecanismo identificado, previsão numérica registrada, e é o que desbloqueia
   `OS-02` sem mexer em faixa nenhuma.
2. **Depois, `OS-02` + escalação** (`tools/r1840/patch_escalacao.js`, RC1 já
   medido: vagas com reserva elegível 6+ melhor 2 397 → 397, e o Pelé sai do
   banco).
3. **`OS-05`**, independente da decisão de contrato e é o que o jogador vê.
4. **Reavaliar `OS-09`** agora que `ECO-03` cumpre.
5. Decidir `ESP-01` com o dono da matriz.

## 5. Erros meus nesta sessão, que valem como aviso

- **Quase patcheei código morto.** O `shiftScale` do bundle base está genuinamente
  invertido em relação ao futebol e a álgebra fecha — e teria saído inerte, porque
  o observer R13 retorna antes para DEF e MID. Só não aconteceu porque procurei
  `P.<nome>=function` primeiro.
- **Propus a hipótese errada sobre a conversão.** Afirmei que o excesso de gols
  vinha de `conversionScale` alta e sugeri atacar `xG/chute` como etapa. O
  instrumento mostrou que, descontada a falha do goleiro, `gols/xG` já era 1,024 —
  a conversão não era o problema, o bug do goleiro era.
- **Comparei grandezas diferentes.** Comparei o `xg` do jogo (que é `pGoal`, taxa
  de conversão) com o xG posicional do futebol real e concluí "1,54× alto". A
  grandeza comparável é o `baseXg`: 0,103 contra ~0,11 real, ou seja **certo**.
- **Quase medi a distância do chute pelo jogador errado**, o que dava 28 m para o
  cruzamento rasteiro. Só passou a valer depois de medir bola, atacante e a
  separação entre eles.
- **Reportei folga em `ECO-01` com uma base só.** Em s1 dava 3,063 (ok); em s3
  dava 3,521 (reprova). Foi pego porque as 3 bases já estavam programadas — mas se
  eu tivesse parado em s1 teria promovido dizendo que havia folga.
- **Os baselines de `ESP-01..04` na matriz não eram reproduzíveis:** o instrumento
  citado (`auditoria_blob`) não existe no repositório. Reconstruí com definições
  escritas; três das quatro caem a ~1,5 do valor da matriz com viés positivo
  uniforme, o que é evidência de reconstrução correta mas **não** é a definição
  original, e isso está declarado.

O padrão dos seis: **número sem mecanismo, ou instrumento medindo a coisa
errada.** Todos caíram porque construí um segundo instrumento contra o primeiro.
Faça isso.
