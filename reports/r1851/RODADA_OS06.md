# OS-06 — censo de dever defensivo por linha

**Baseline:** R18.50 — PRESERVAR ENERGIA
**Natureza:** somente observacional
**Promoção:** não promovível
**Medições:** ainda não executadas
**Patches na build:** nenhum

**SHA-256 medida:** `495a9d684104b55ec749e43462549667fddb66a93b5d0b0a4cb1ab9d95c0445a`
(a própria build promovida)

## CORREÇÃO DE UMA LEITURA MINHA

Eu afirmei que só zagueiro recebe marcação individual, ancorando em
`dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html:7572`
(`const cbs = tm.players.filter(... === 'CB')`). **Está errado**, e errado
exatamente pelo motivo que este projeto já documentou: li o texto-base em vez
do motor efetivo.

`_assignDefRoles` é sobrescrito quatro vezes: `:16736`, `:20259`, `:21182` e
`:21864`. A camada R13 em `:16736` **não chama a anterior**. Ela zera todo
`_markRef` de todos os jogadores e reatribui a partir de
`eligible = jogadores não-FWD, não-goleiro, não-presser` — ou seja, **DEF e
MID**. O laço de zagueiro em `:7541–7583` é código morto na R18.50.

Meia recebe marcação individual. A pergunta muda de "por que não existe" para
"por que ela não sobrevive".

## MECANISMO

Três camadas empilhadas decidem o dever de cada jogador a cada ciclo.

**Atribuição — R13, `:16736`.** Substitui a base inteira. Calcula ameaças, a
profundidade de linha desejada e liga marcador↔ameaça, gravando `_markRef`,
`_r13MarkClass` (`track` ou `screen`) e `_r13MarkTarget`, e apertando `_react`
do marcador.

**Destruição — R18.17.3, `:21192`.** Toda marca é reavaliada por alcance:
`reach = DEF ? 18.5 : MID ? 16.5 : 14.0`. Se o marcador está mais longe que
isso do seu alvo, `p._markRef=null` e `unreachableMarksConverted++` (`:21196`).
O meia tem o orçamento menor dos dois que marcam — 16,5 contra 18,5 — e é
justamente quem cobre a faixa mais larga.

**Compensação com teto de um — `:21206`.** As marcas destruídas entram num
`screenPool`, que é ordenado e **só o primeiro** vira screen:
`const chosen=screenPool[0]`. O comentário no código assume a escolha: criar um
screen por referência distante "apenas trocaria perseguição impossível por
outro tipo de enxame". Todo o resto do pool cai em `duty='zone'` (`:21229`).

**Cadência — `:7079`.** `_assignDefRoles` roda quando
`this._defRoleT[tm.side] > 0.42`, isto é, a cada 0,42 s por time, e só com o
time defendendo. Os jogadores se movem a 30 Hz. Uma referência pode estar até
420 ms velha.

A hipótese do sintoma, então, não é ausência de marcação no meio: é marca
atribuída, destruída por alcance e não recomposta, sobrando um único screen por
ciclo e zona para o resto.

### O amontoamento é o mesmo mecanismo, visto de fora

**Faixa do marcador — `:16768`.** O alvo de marca do R13 é
`y: lerp(alvo.y, FW/2, .035)`: o marcador se posta em **96,5% da faixa lateral
do alvo**. Marcador e marcado ocupam a mesma faixa por construção. Empilhe três
pares nessa condição e sai uma coluna vertical.

**Única força de separação — `:8087`.** Roda a cada 0,25 s, só atua abaixo de
2,05 m, e o empurrão é `k = min((2.05−d)×0.16, 0.16)` — **no máximo 16 cm por
correção, a 4 Hz**. Isso impede sobreposição; não abre uma coluna.

**E os gates não veem.** O sampler de enxame do R18.17.3 (`:21289`) conta
`dist(p, b)`: defensores a 4, 6 e 9 m **da bola**. `swarmRate` e
`severeCollapseRate` são cegos para uma coluna na lateral longe da bola. Uma
tela com oito jogadores de um time no mesmo corredor passa nos dois gates.

Por isso esta rodada mede espaçamento por conta própria, sem referência à bola:
`corredorMax`, `coluna3/coluna4`, `colunaLongeDaBola`, `discoMax6m` e o
afastamento realizado dos pares de marca (`marcaDyMedio`).

## HIPÓTESE

Em direção, sem percentual:

1. A fração de tempo em `duty='zone'` do MID fica **acima** da do DEF.
2. `fracaoComMarca` do MID fica **abaixo** da do DEF.
3. `entreLinhas_cobertura` fica **abaixo** de `profundas_cobertura` — a ameaça
   entre linhas é a que fica sem referência.
4. `unreachableMarksConverted` por partida fica **acima** de `screensAssigned`
   por partida: a maioria das marcas destruídas não vira screen, cai em zona.
5. O gate `marking` do R13 reprova na maioria das partidas.
6. `marcaDyMedio` fica **abaixo** de 3 m — o marcador vive na faixa do alvo.
7. `colunaLongeDaBola` fica **acima** de zero de forma estável nas três bases,
   enquanto `swarmRate` e `severeCollapseRate` **passam**: os gates existentes
   são cegos para a coluna.
8. Nenhum agregado de jogo sobe ou desce: a rodada não toca a build.

## PATCH

**Nenhum.** A amostragem é feita de fora, no laço do runner, lendo propriedades
que as camadas efetivas já escrevem no jogador: `_r18173Duty` (`:21229`),
`_markRef` (`:16736`), `_r18173ScreenTgt` (`:21206`) e `tm._shadowTgt`. Ler
propriedade não consome RNG, não muda posse e não muda trajetória.

Os audits `getR13Audit()` e `getR18173Audit()` (`:21296`) são chamados **só
depois de `isOver()`**, para que nem uma mutação acidental dentro deles possa
alcançar a partida.

O instrumento é `tools/r1851/diag_os06_marking_duty.js`, com a mesma varredura
determinística de formações/estilos e o mesmo incremento de semente (7919) das
OS-05A e OS-05B, para pareamento partida a partida.

## PREVISÃO REGISTRADA ANTES DE MEDIR

Registradas antes da bateria; não são resultados.

1. `porLinha.MID.fracaoDever.zone` acima de `porLinha.DEF.fracaoDever.zone`.
2. `porLinha.MID.fracaoComMarca` abaixo de `porLinha.DEF.fracaoComMarca`.
3. `ameaca.entreLinhas_cobertura` abaixo de `ameaca.profundas_cobertura`.
4. `r18173_unreachableMarksConverted` acima de `r18173_screensAssigned`.
5. `gatesReprovadosPorPartida.marking` acima de metade das partidas.
6. `espaco.marcaDyMedio` abaixo de 3 m.
7. `espaco.fracaoColunaLongeDaBola` acima de zero nas três bases, com
   `gatesReprovadosPorPartida.swarmRate` e `severeCollapseRate` em zero.
8. Agregados de controle idênticos aos da OS-05A/OS-05B nas mesmas sementes.

Se (3) falhar — se a ameaça entre linhas for coberta tão bem quanto a profunda
— e o gate `marking` passar, a hipótese inteira cai. Nesse caso o sintoma não é
atribuição de marcação, e a rota passa a ser a cadência de 0,42 s em `:7079` ou
o `_react` do marcador, não o alcance.

## MEDIÇÃO

Para cada base `4200000 / 8400000 / 1260000`, 48 partidas:

```bash
node tools/r1851/diag_os06_marking_duty.js \
  --build="dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html" \
  --matches=48 --semente=4200000 --detalhe \
  --out=reports/r1851/os06_s4200000.json
```

Repetir com `8400000` e `1260000`.

## GATE

Rodada observacional, **não promovível**. Ela decide onde a próxima candidata
comportamental tem direito de existir.

**Gate de decisão:** o motor já tem o dele, em `:17188` —
`marking: threatCoverage >= .65 && markerMeanDistance <= 8.5`. Reprovado com
`entreLinhas_cobertura` abaixo de `profundas_cobertura` → a rota é o alcance do
MID em `:21192` e o teto de um screen em `:21206`, e existe candidata de duas
constantes. Aprovado, ou reprovado sem a assimetria entre linhas → a rota é
cadência/reação, e a linhagem do alcance deve parar.

**Gates de integridade da rodada:** `sha256` igual a `495a9d68…`;
`scriptsComErro` pareado com as rodadas anteriores; agregados de controle
idênticos aos da OS-05A/OS-05B nas mesmas sementes. Divergência reprova a
leitura, não o motor.

Gates de promoção de uma candidata futura, além dos herdados: `marking` e
`lines` do R13 (`:17188`), `swarmRate ≤ .08` e `severeCollapseRate ≤ .10` do
R18.17.3 (`:21296`). Uma candidata que conserte a cobertura criando enxame
reprova nos dois últimos.

## ARMADILHA

**A que já me pegou, nesta mesma rodada:** ancorar em `:7572` e medir código
morto. `_assignDefRoles` tem quatro sobrescritas e a R13 não chama a anterior.
Qualquer leitura que parta de `:7541–7583` mede nada. Antes de acreditar em
qualquer sítio nesta build, contar as sobrescritas dele.

**Segunda:** `_r18173Duty` é escrito no ciclo de 0,42 s e amostrado a 0,25 s. Os
dois não são harmônicos, o que evita aliasing, mas o dever lido pode ter até
420 ms de idade. Isso é a latência real do motor, não erro do instrumento — e
as duas coisas não podem ser somadas na mesma conclusão.

**Terceira:** `linhaDe` usa `oopPos || slotPos`, e a camada Fase 4-7 (`:8087`)
reescreve `oopPos` durante a partida. A classificação é a linha defensiva
efetiva no momento, não a da escalação. É o que se quer medir, mas não é
comparável com o slot escalado.

**Quarta:** amostras em que a bola não tem dono são descartadas
(`amostrasDefendendo < amostras`). Ler fração sobre `amostras` em vez de
`jogadores_L` infla o denominador e dilui todos os deveres na mesma proporção.

**Quinta, e ela invalida a leitura ingênua do amontoamento:** `discoMax6m` e
`corredorMax` são **máximos**, não médias. Um máximo alto prova que o estado
existe; não diz com que frequência. A frequência está em `fracaoColuna3`,
`fracaoColuna4` e `fracaoColunaLongeDaBola`. Trocar um pelo outro transforma um
lance raro em diagnóstico estrutural, ou o contrário.

**Sexta:** `screensAssigned` conta screens criados por ciclo, e
`unreachableMarksConverted` conta marcas destruídas por ciclo. São contagens de
ciclo, não de lance. Comparar qualquer uma delas com eventos de partida
(chutes, gols) mistura duas unidades.

## VALIDAÇÃO ESTÁTICA EXECUTADA

- O instrumento carrega a build promovida, encontra `getR13Audit()` e
  `getR18173Audit()`, e o `sha256` lido em execução confere com `495a9d684104…`.
- Fumaça de 2 partidas apenas para provar que os contadores estão vivos e não
  travados em zero, e que o gate `marking` é de fato exercitado. **Não é
  medição**: N=2 não tem significado sob o protocolo de três bases × 48
  partidas, e nenhuma direção deve ser lida daquele par.
- Nenhuma bateria foi executada neste ambiente. Nenhum número deste documento é
  resultado.
