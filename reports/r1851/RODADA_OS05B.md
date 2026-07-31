# OS-05B — censo de origem e supressão do escanteio

**Baseline:** R18.50 — PRESERVAR ENERGIA
**Natureza:** somente observacional
**Promoção:** não promovível
**Medições:** ainda não executadas
**Patches na build:** nenhum

**SHA-256 medida:** `495a9d684104b55ec749e43462549667fddb66a93b5d0b0a4cb1ab9d95c0445a`
(a própria build promovida — não há build instrumentada nesta rodada)

## ONDE O DIAGNÓSTICO DA OS-05 ESTÁ ERRADO

Duas coisas, e as duas saem dos artefatos da OS-05A, não de suposição.

**1. O sítio da OS-05 não tem o volume.** Somando `open_seen + setpiece_seen`
nas três bases medidas: 0,583 / 0,583 / 0,813 por partida. A previsão registrada
para o total de `header_clear` era 0,9–1,4. As três bases ficaram **abaixo** da
banda. Escanteios medidos: 1,104 / 1,229 / 1,563 — média ≈ 1,30. O piso do
ECO-05 é 4. A lacuna é ≈ 2,7 escanteios por partida. Convertendo **100%** do
sítio em escanteio, o teto é ≈ 0,58–0,81 — no melhor caso cobre menos de um
terço da lacuna. Nenhum ajuste nessa linha alcança o gate.

**2. A premissa do sítio é falsa no motor efetivo.** `open_clean` = **0** nas
três bases (previsão registrada: 0,2–0,6). O comentário no trecho da OS-05 —
"`_turnover(def)` entrega a bola a ele no mesmo quadro. A bola não viaja... e
nunca cruza a própria linha" — descreve o texto-base, não o que roda. A camada
R18.18.2 (`:21771`) já fisicaliza esse corte. `open_endline` fica em
0,354–0,500 por partida: a bola já é mandada em direção à linha de fundo. O
patch da OS-05 refaria o que o motor já faz.

Três das quatro previsões registradas erraram, **todas para baixo**. Isso é erro
sistemático de modelo, não ruído: o sítio é menor e já está fisicalizado.

Uma terceira correção, no cabeçalho do trecho: "_ballOut, a ÚNICA fonte de
escanteio por geometria" não se sustenta. `_ballOut` é sobrescrito cinco vezes
(`:16581`, `:20828`, `:21596`, `:21868`, `:22086`) e existem nove sítios de
chamada de `_setCorner` além dele.

## MECANISMO

Os escanteios não estão faltando na origem. Estão sendo **recusados na saída**,
por duas camadas empilhadas que reabritram toda chamada de `_setCorner`.

**R18.18.2 —** `dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html:21763`.
Se a chamada chega até 0,24 s depois de um bloqueio físico, lança
`blockRay(this,q,18.5,8.8)` (`:21764`; a função está em `:21691`). Só há
escanteio se o raio alcançar uma linha de fundo **dentro de 18,5 m**. Fora
disso: `randomCornerPathsSuppressed++` e `_turnover(def)` — o escanteio é
apagado.

**R18.18.3 —** `:22050`, instalada depois, portanto a mais externa. Sua "última
barreira": se `lastTouch` é do time atacante ou é nulo → `unprovenSuppressed++`
e tiro de meta. Se a bola ainda não passou da linha e o último toque foi do
defensor → novo raio, e só vira escanteio se a linha de fundo estiver **dentro
de 13,5 m** (`:22062`); fora disso, `unprovenSuppressed++` e `_looseBall`.

O orçamento de 13,5 m é o número que interessa. Um bloqueio na entrada da área
acontece a ~16–18 m da linha de fundo. É exatamente a distância mais comum de
bloqueio no futebol real, e é a que a barreira recusa.

Todas as probabilidades de escanteio do motor-base entram nesse funil e são
re-arbitradas: `shotBlockCorner` 0,66 (`:6194`), `aerialBlockCorner` 0,70
(`:5443`), `shotSaveCorner` 0,68 (`:6332`), `aerialSaveCorner` 0,58,
`lowCrossSaveCorner` 0,55 (`:5367`), `freeKickSaveCorner` 0,68 (`:6784`), o
`.42` do bloqueio de cruzamento (`:5345`), o `.30` do soco do goleiro
(`:7059`) e o `.16` do corte afobado (`:5529`). Constantes em `:2775–2782`.

Há ainda um vazamento a montante, que muda quantas chamadas chegam a existir:
em `:6172`, o chute sorteado para a fatia de bloqueio
(`CAL.shooting.blockedShare` = 0,18, `:2766`) vira `miss` → tiro de meta quando
nenhum defensor está a menos de 2,2 m da linha do chute. A fatia é alocada e
depois descartada.

## HIPÓTESE

Em direção, sem percentual:

1. A supressão por partida (`randomCornerPathsSuppressed` + `unprovenSuppressed`)
   fica **acima** da lacuna do ECO-05 (≈ 2,7/partida).
2. `cornersResolved` fica **abaixo** do total de `corners` — parte dos ~1,3 vem
   de rotas que não passam pela resolução geométrica.
3. `physicalBlockDecisions` fica **baixo** em relação a `shots`, por causa do
   vazamento de `:6172`.
4. A contribuição do sítio da OS-05 **desce** ainda mais do que a OS-05A já
   mostrou.
5. Nenhum agregado de jogo sobe ou desce: a rodada não toca a build.

## PATCH

**Nenhum.** É o ponto da rodada.

As duas camadas já mantêm todos os contadores necessários e já os expõem:
`P.getR18182Audit()` em `:21877` e `P.getR18183Audit()` em `:22088`. O
instrumento é `tools/r1851/diag_os05b_corner_origin.js`, que lê os dois no fim
de cada partida — mesma varredura determinística de formações/estilos e mesmo
incremento de semente (7919) da OS-05A, para pareamento partida a partida.

O `edit()` que eu **recusei** escrever é o que taggearia os sítios de chamada
para descobrir a origem:

```js
edit(
  'os05b-tag-corner-origin',
  `if(chance(CAL.restarts.shotBlockCorner))this._setCorner(o.team);`,
  `if(chance(CAL.restarts.shotBlockCorner)){this.__os05bOrigin='shot_block';this._setCorner(o.team);}`
);
```

A âncora casa uma vez e a edição é inócua. Mas ela é desnecessária — a
informação já existe em `cornerCause` (`:21905`) — e toda edição na build gera
uma identidade nova que precisa de bateria pareada só para provar que não mudou
nada. Medir a build promovida, sem patch, elimina essa classe inteira de
verificação. Foi essa classe que consumiu a OS-05A.

## PREVISÃO REGISTRADA ANTES DE MEDIR

Registradas antes da bateria; não são resultados.

1. `l2_randomCornerPathsSuppressed` + `s_unprovenSuppressed`: acima de 2,7 por
   partida nas três bases.
2. `e_cornersResolved` menor que `corners` medidos na mesma partida.
3. `causa_block` maior que `causa_save`, `causa_punch` e `causa_clearance`.
4. `r_blockResolutions` abaixo de 2,0 por partida, contra ~14,9 chutes.
5. Agregados de controle idênticos aos da OS-05A nas mesmas sementes — mesma
   build, mesma varredura, nenhum patch.

Se (1) falhar e a supressão ficar **abaixo** da lacuna, a hipótese inteira cai:
o gargalo é a montante, no volume de bloqueio e de chute (14,9/partida contra
~25 reais), e nenhum ajuste na ecologia de escanteio alcança o ECO-05.

## MEDIÇÃO

Para cada base `4200000 / 8400000 / 1260000`, 48 partidas:

```bash
node tools/r1851/diag_os05b_corner_origin.js \
  --build="dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html" \
  --matches=48 --semente=4200000 --detalhe \
  --out=reports/r1851/os05b_s4200000.json
```

Repetir com `8400000` e `1260000`.

## GATE

Esta rodada é observacional e **não é promovível**. Ela não disputa o ECO-05;
ela decide onde a próxima candidata comportamental tem direito de existir.

**Gate de decisão:** `supressaoPorPartida ≥ (4 − corners medidos)`.
Verdadeiro → a rota é a geometria de supressão em `:21764` e `:22062`, e existe
uma candidata de uma constante com gate real. Falso → a rota é o volume a
montante, e a linhagem do escanteio deve parar.

**Gates de integridade da rodada:** `sha256` igual a `495a9d68…`;
`scriptsComErro` pareado com a OS-05A (1, `document is not defined` em
`script-2`); agregados de controle idênticos aos da OS-05A nas mesmas sementes.
Qualquer divergência reprova a leitura, não o motor.

Os gates de promoção de uma candidata futura continuam: `ECO-05` 4–10
escanteios/partida, `ECO-02` ≤ 2,7 xG/partida, `corner === corner_delivery`,
determinismo, comparação pareada nas três bases e diferença acima da banda de
ruído de 31% para escanteios.

## ARMADILHA

**A que mais provavelmente me pega:** somar os dois contadores de supressão como
se fossem disjuntos. R18.18.3 (`:22050`) é a camada externa; R18.18.2
(`:21763`) só executa quando a externa cai em
`oldSetCorner.apply`. As duas se sombreiam mutuamente e nenhuma das duas conhece
a outra. A soma é um teto, não uma contagem. Só o `--detalhe` com os `events[]`
das duas camadas separa lance a lance — e é por isso que `--detalhe` não é
opcional nesta rodada.

**Segunda:** `events[]` é truncado em 320 entradas (`:21909`). Serve para
auditar sequência, nunca como contagem.

**Terceira, e ela contamina a leitura da OS-05A:** `classify()` do censo
anterior deriva `endline`/`touchline` de `b.target`, e `_turnover` não limpa
`b.target` — `_ballGlue` (`:6504`) só reescreve `x/y/z/vx/vy`, e `b.target` só é
reescrito em `_startTravel`/`_deflectTo` (`:6521`). Então `open_endline` pode
ser o alvo velho do cruzamento, não uma trajetória nova de corte. É justamente o
número que mais parece dizer "o sítio já produz escanteio". A OS-05B não herda
essa ambiguidade: conta saída resolvida em `_ballOut` com `__r18183OutCause`
(`:22086`), não alvo inferido.

**Quarta:** `open_return_true` = `open_seen` nas três bases. O discriminador de
valor de retorno da OS-05A não carregou informação nenhuma. Não repetir a
construção.

## VALIDAÇÃO ESTÁTICA EXECUTADA

- O instrumento carrega a build promovida e encontra `getR18182Audit()` e
  `getR18183Audit()`; `sha256` lido em execução confere com `495a9d684104…`.
- Fumaça de 2 partidas apenas para provar que os contadores estão vivos e não
  travados em zero. **Não é medição e não deve ser lida como resultado**: N=2
  não tem significado, e os agregados de controle desse par não batem com os de
  48 partidas.
- Nenhuma bateria foi executada neste ambiente. Nenhum número deste documento é
  resultado novo: os valores por partida citados na seção de diagnóstico vêm dos
  artefatos `os05a_s4200000.json`, `os05a_s8400000.json` e `os05a_s1260000.json`.
