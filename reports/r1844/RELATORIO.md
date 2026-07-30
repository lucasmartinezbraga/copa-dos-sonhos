# R18.44 — O RAIO DO GOLEIRO, MEDIDO SOZINHO

**Build** `dist/COPA DOS SONHOS - R18.44 - RAIO DO GOLEIRO.html`
SHA `8466fd7bf6b978fb810e5a436bde1ce123c15320a44ee544b9e0a0aee23b3328`
**Baseline** R18.43 (`0062c2eaad18`) · **Patch** `tools/r1840/patch_gkraio.js --raio=1.95`

---

## A. Por que esta rodada existe

A R18.43 fechou com `ECO-01` no topo (mediana 3,125, estourando 3,521 na base
s3) e com a folga de `ECO-02` reduzida a 0,14–0,32 — sem espaço para `OS-02`. Eu
havia proposto atacar `xG/chute` como próxima etapa, supondo conversão calibrada
alta.

**A instrumentação derrubou minha própria hipótese.** `tools/r1843/diag_xg.js`
mostrou que o excesso de gols não vinha da conversão, e sim de um caminho de gol
que não passa pelo modelo de xG. Diagnóstico completo em
`reports/r1844/DIAGNOSTICO_FINALIZACAO.md`; o essencial:

Em `_gkResolveSave`, quando `_physicalContactValid(gk, 1.95, z)` reprova, um
chute que o `chance(pGoal)` **já decidiu como não-gol** é convertido em gol por
`_goal(o, false)` — **sem somar xG nenhum**. Medido: **19,0% / 19,3% / 24,9%** dos
gols nas três bases. O relatório da R18.40A media `CAU-03` em 17,75% por um
caminho totalmente diferente; dois instrumentos independentes concordando.

E a prova de que era só isso: descontando esses gols, `gols/xG` da R18.43 dá
**1,024** — o modelo já era coerente. Não existia "motor convertendo 26% acima do
modelo"; existia um bug.

O conserto **já estava escrito e nunca foi medido sozinho**:
`tools/r1840/patch_gkraio.js`. A R18.40B o mediu junto com `patch_escalacao.js` e
o par reprovou — por gols/xG inflados **pela escalação**, não pelo raio. Isolado,
ele deveria baixar gols. É o que esta rodada testa.

## B. O mecanismo

Os três sítios de chute planejam a interceptação do goleiro com `radius = 3.0`,
e `_gkResolveSave` valida o contato com `_physicalContactValid(gk, 1.95, z)`.
Como `required = max(0, dist − radius)`, um ponto a 3 m dá `required = 0`: o plano
declara o goleiro já no lugar, o corpo nunca recebe ordem de andar, a bola chega,
e a checagem de 1,95 m reprova. Vira `goal_after_failed_reach`.

Quem introduziu foi `tools/r1821/build_rc1.js` (~linha 128), que trocou 1,95 por
3,0 nos sítios de chute de propósito (a preocupação era a rota do cruzamento
rasteiro) e deixou falta e pênalti em 1,95. A checagem nunca foi acompanhada.

O patch devolve o plano a 1,95, igual à checagem. Bola parada não é tocada.

## C. Medição em 3 bases (n=48 por base)

### C.1 Validade dos gates na baseline R18.43

| gate | s1 4200000 | s2 8400000 | s3 1260000 | válido |
|---|---:|---:|---:|---|
| ECO-01 gols | 3,063 ok | 3,125 ok | **3,521 REP** | 2/3 frágil |
| ECO-02 xG | 2,421 ok | 2,380 ok | 2,557 ok | 3/3 |
| ECO-03 chutes | 14,563 ok | 14,542 ok | 15,417 ok | 3/3 |
| ECO-04 no alvo | 5,688 ok | 5,667 ok | 6,083 ok | 3/3 |
| COE-01 gols/xG | 1,265 REP | 1,313 REP | 1,377 REP | **0/3** |
| CAU-03 % gols falha GK | 19,05 REP | 19,33 REP | 24,85 REP | **0/3** |

### C.2 Efeito do raio isolado

| gate | s1 | s2 | s3 | mediana | faixa | |
|---|---:|---:|---:|---:|---|---|
| ECO-01 gols | 2,500 | 2,542 | 2,875 | **2,542** | 2,4–3,2 | CUMPRE **em 3/3** |
| ECO-02 xG | 2,475 | 2,495 | 2,562 | **2,495** | 1,8–2,7 | CUMPRE |
| ECO-03 chutes | 14,604 | 15,313 | 15,250 | **15,250** | 12–20 | CUMPRE |
| ECO-04 no alvo | 4,667 | 5,167 | 5,208 | **5,167** | 4–7 | CUMPRE |
| COE-01 gols/xG | 1,010 | 1,019 | 1,122 | **1,019** | 0,90–1,15 | **CUMPRE** |
| CAU-03 % falha GK | 1,667 | 2,459 | 1,449 | **1,667** | <8 | **CUMPRE** |

**Nenhum gate válido perdido. Três gates ganhos:** `ECO-01` (que a base s3
estourava), `COE-01` e `CAU-03`.

`CAU-03` sai de 19,3% para 1,667% — o handoff previa 1,24% e a ordem de grandeza
confere. Direção consistente nas três bases em todos os gates exceto `ECO-03`,
cuja variação (+0,3% / +5,3% / −1,1%) fica dentro da banda de 7% e é ruído.

`ECO-04` cai 8,8–18% e **permanece na faixa**: é esperado e correto — parte do que
era contado como "no alvo" eram chutes que só terminavam em gol porque o goleiro
não conseguia validar contato.

### C.3 Dois gates novos, e por que não são auto-serventes

`COE-01` (gols/xG ∈ [0,90; 1,15]) e `CAU-03` (<8%) foram propostos **no
diagnóstico, antes de medir a candidata**, e `CAU-03` já era alvo da matriz. A
faixa de `COE-01` vem de futebol real, onde o xG é calibrado contra gols e a
razão fica ~1,0 — não da saída do motor. Ambos reprovam na baseline em 3/3, e é
justamente essa a razão de existirem: **nenhum gate da matriz forçava a coerência
do modelo, e é por isso que um caminho de gol sem xG atravessou várias rodadas
promovidas sem nada reprovar.**

## D. Integridade

| gate | resultado |
|---|---|
| TEC-02 NaN/infinito | 0 |
| TEC-03 erros de console | **0** em Chromium real; camada R18.43 e `CUP` intactas |
| TEC-04 determinismo | **8/8** e **8/8** em ordem inversa |
| TEC-05 completude | 49 ok / 1 erro conhecido, `motorVerificado: true` |
| ESP-02 bloco | 37,07 → 36,75 m (alvo >35) — preservado |
| ESP-03 zaga→ataque | 31,18 → 30,99 m (alvo >30) — preservado |
| ESP-04 <20 m da bola | 40,81 → 41,12% (35–45) — preservado |
| `tools/verify.py` | exit 0 |

## E. O que isto muda para OS-02, com número

Folga que sobra até os tetos, mediana de 3 bases:

| | R18.43 | R18.44 |
|---|---:|---:|
| folga em ECO-01 (teto 3,2) | 0,075 | **0,658** |
| folga em ECO-02 (teto 2,7) | 0,205 | 0,205 |

`ECO-01` respira. Mas **`ECO-02` continua sendo o gargalo de `OS-02`**, e é
preciso dizer com clareza: a escalação correta vale +0,92 de xG (medido na
R18.40B), então levaria o xG a ~3,4 — contra teto de 2,7.

E aqui há um reenquadramento que o número obriga: futebol real tem xG total de
**~2,7 por partida** (igual aos gols, ~2,7). Logo o teto de `ECO-02` **está certo**
em relação à realidade. Um XI correto entregando 3,4 de xG não é gate mal
calibrado — é o **resto do motor sendo generoso demais** para suportar um ataque
bem escalado. Re-derivar `ECO-02` para aprovar `OS-02` seria aprovar um jogo acima
do futebol real.

O lugar onde o motor é demonstravelmente generoso sem justificativa posicional já
está medido e é o assunto da próxima rodada — ver §F.

## F. Próxima rodada: o cruzamento rasteiro

`low_cross_shot` é **44,2% de todas as finalizações** e não tem termo posicional
nenhum:

```js
const pGoal=clamp((.16+(finish-keeper)/100*.23+ctx.execution*.09)*.82,.06,.40);
```

Medido no instante do evento, pela posição da bola: **25,0 m** de distância média
ao gol, com 46% dos casos em 22–30 m e 24% além de 30 m, recebendo `pGoal` achatado
de 0,19–0,22. A tabela `CAL` vale 0,032 em 22–30 m e 0,015 além de 30 m — o caminho
cobra **~6× o valor posicional**.

Estimativa de efeito, para a rodada seguinte poder falsificá-la: 6,44
finalizações/partida × 0,20 = 1,29 de xG hoje. Com termo posicional mais um bônus
situacional legítimo de ~2× (a bola rasteira encontra defesa e goleiro
deslocados, então vale mais que um chute qualquer da mesma distância — mas não 6×
mais), ficaria em ~0,10 por chute = 0,64 de xG. Isso é **−0,65 de xG**, levando o
xG a ~1,85 e abrindo folga de 0,85 até o teto — onde `OS-02` (+0,92) passa a
caber quase exatamente.

**Esta é uma previsão, não um resultado.** Está escrita aqui para que a próxima
rodada possa derrubá-la com medição, que é o padrão que o handoff pede.

## G. Arquivos

```
dist/COPA DOS SONHOS - R18.44 - RAIO DO GOLEIRO.html   8466fd7bf6b9
tools/r1843/diag_xg.js       instrumento de finalizacao (5 caminhos, bandas, coerencia)
tools/r1844/multibase44.js   decisao em 3 bases, com COE-01 e CAU-03
reports/r1844/DIAGNOSTICO_FINALIZACAO.md
reports/r1844/xg_{b43,gk}_s{1,2,3}.json    coerencia, n=48, 3 bases
reports/r1844/bat_gk_s{1,2,3}.json         bateria, n=48, 3 bases
reports/r1844/esp_gk_s1.json               regressao de espaco
```

## H. Erros meus nesta rodada

- **Propus a hipótese errada.** Afirmei que o excesso de gols vinha de conversão
  calibrada alta e sugeri atacar `xG/chute`. O instrumento mostrou que, descontada
  a falha do goleiro, `gols/xG` já era 1,024 — a conversão não era o problema.
- **Comparei grandezas diferentes.** Comparei o `xg` do jogo (que é `pGoal`, uma
  taxa de conversão) com o xG posicional do futebol real e concluí "1,54× alto".
  A grandeza comparável é o `baseXg`, que dá 0,103 contra ~0,11 real — ou seja,
  certo.
- **Quase medi a distância do chute pelo jogador errado.** A primeira versão do
  instrumento media pela posição do atacante e dava 28,0 m para o cruzamento
  rasteiro. Só passou a valer depois de medir bola, atacante e a separação entre
  eles (3,1 m no rasteiro, 0,17 m no cabeceio) e confirmar que o atacante está na
  bola.

Os três foram pegos por construir um segundo instrumento contra o primeiro, que é
o que o §6 do handoff R18.40B manda fazer.
