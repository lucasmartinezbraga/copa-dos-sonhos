# OS-07 — censo de efeito tático

**Baseline:** R18.50 — PRESERVAR ENERGIA
**Natureza:** somente observacional
**Promoção:** não promovível
**Patches na build:** nenhum

**SHA-256 medida:** `495a9d684104b55ec749e43462549667fddb66a93b5d0b0a4cb1ab9d95c0445a`
(a própria build promovida)

## A PERGUNTA, SEPARADA EM DUAS

"As alterações táticas mudam o futebol?" mistura duas perguntas com métodos
diferentes:

**A · ALCANCE** — o campo chega ao motor? É uma pergunta **estática e
exaustiva**. Não precisa de semente, não precisa de bateria, não tem ruído. Ou
o campo altera estado que o motor lê, ou não altera. A resposta é binária e
completa.

**B · EFEITO** — o campo que chega ao motor muda o jogo apresentado de forma
consistente? Essa sim precisa de bateria pareada.

Rodar B sem A é desperdício: mede-se variância de campo morto.

## MECANISMO

Toda instrução passa por `apply(tm)` em
`dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html:8079`, que traduz os
campos em multiplicadores de `tm.fx`. O escore de decisão em `context(sim,p)`
(`:8079`) lê diretamente mais três campos (`verticality`, `carryMore`,
`earlyShots`). Um terceiro caminho existe e é fácil de perder: `:8087` grava
flags no jogador (`_overlapping`, `_underlapping`) que são lidas muito depois,
no escore de passe (`:5652`).

Portanto um campo é vivo se muda `fx`, **ou** entra no escore de decisão, **ou**
vira flag que alguém lê. Testar só `fx` produz falso negativo — foi o que
aconteceu na primeira versão deste instrumento.

## RESULTADO DA PARTE A

Enumeração completa das 27 folhas de `DEFAULT_INSTRUCTIONS`, cada uma
perturbada em todo o seu vocabulário, com um `MatchSim` novo por medição.

**19 vivas. 8 mortas.**

| campo morto | onde aparece | o que é |
|---|---|---|
| `inPossession.buildup.useGoalkeeper` | `:8288` | só escrita da IA |
| `inPossession.finalThird.underlap` | `:8087` | flag gravada, nunca lida |
| `transition.goalkeeperDistribution` | `:8287`, `:8288` | só escrita da IA |
| `outOfPossession.orientation` | `:8067` | só aviso de coerência |
| `outOfPossession.marking` | `:8295` | só escrita da IA |
| `outOfPossession.preventCross` | `:8281`, `:8282`, `:8295`, `:8351` | só escritas |
| `outOfPossession.protectBox` | `:8281`, `:8282`, `:8295`, `:8351` | só escritas |
| `outOfPossession.offsideTrap` | `:8064`, `:8067` | normalize e aviso |

Três consequências, e nenhuma delas é opinião:

**1. O controle de marcação não existe.** `outOfPossession.marking`, com
vocabulário `zonal | man | mixed`, não é lido por nada que mude comportamento.
Toda ocorrência do nome fora do bloco Fase 4-7 é contador (`markingSwitches`,
`:16357` e `:16775`), rótulo (`:17214`), comentário (`:17613`) ou chave de gate
de auditoria (`:17188`, `:21298`). O comportamento de marcação é inteiramente
fixo em R13 e R18.17.3. Isso fecha o circuito com o sintoma do meio-campo: não
adianta procurar a instrução que corrige a marcação — ela não está ligada.

**2. Cinco dos oito campos mortos são escritos pela IA de treinador**
(`:8281`, `:8282`, `:8287`, `:8288`, `:8295`, `:8351`). A IA faz ajustes
táticos que não podem alterar nada. Do lado de fora, ela "reage"; do lado de
dentro, não há efeito.

**3. `underlap` é o único morto puro** — a flag `_underlapping` é gravada em
`:8087` e não é lida em lugar nenhum da build. `overlap`, ao lado dela na mesma
linha, é lida em nove sítios (`:4971`, `:5652`, `:5679`, `:7368`, `:7371`,
`:7396`, `:7416`, `:7590`, `:16186`). O par foi escrito junto e só metade foi
conectada.

## RESULTADO DA PARTE C — `oopRole` é código morto

A troca de função defensiva de um jogador produziu partida **idêntica** em
todas as sementes tentadas. Fui verificar se era artefato do instrumento e não
é: `setPlayerPhaseRole` funciona e realmente grava
`oopRole: 'press_mid' → 'track_wide'`.

A causa é estrutural, não estatística. `oopRole` de jogador de linha é lido em
exatamente três pontos — `:7535` e `:7536`, dentro do `_defendTarget` **base**:

```js
if (p.oopRole==='track_wide') ty=lerp(ty,b.y,.12);
if (p.oopRole==='screen' || p.oopRole==='anchor') tx=lerp(tx,tm.goal.x,.05);
```

E o `_defendTarget` base é código morto: a camada R13 (`:16845`) sobrescreve
`_defendTarget` e **não chama `oldDefend13` nenhuma vez**. O único `oopRole`
que sobrevive é o do goleiro, em `:6002` (`gk2.oopRole === 'sweeper'`).

Mesmo padrão de `_assignDefRoles` na OS-06: R13 substitui a base inteira sem
encadear, e o que ficou para trás continua parecendo funcional na leitura do
texto. `oopPos` continua vivo — a **posição** defensiva importa; a **função**
não.

## HIPÓTESE PARA A PARTE B

Em direção, sem percentual, para os campos vivos:

1. `progression.tempo` 0→100: passes por partida **sobem**.
2. `progression.width` 0→100: a ocupação máxima de um corredor **desce**.
3. `outOfPossession.pressing` 0→100: desarmes **sobem**.
4. `outOfPossession.defensiveLine` 0→100: a linha média **sobe** no campo.
5. `finalThird.crossType` cutback→high: cruzamentos **sobem**.
6. `finalThird.earlyShots` false→true: chutes **sobem**.
7. Nenhum eixo vivo produz impressão idêntica em todas as sementes.
8. Trocar a função de um jogador (`oopRole`, `ipDuty`) não produz impressão
   idêntica em todas as sementes.

## PATCH

**Nenhum.** `setTeamInstructions`, `setPlayerPhaseRole` e
`getTacticalCoherence` são públicos (`:8085`–`:8086`). A parte A não simula
partida alguma; as partes B e C usam a API pública sobre a build promovida.

Instrumento: `tools/r1851/diag_os07_tactical_effect.js`.

## MEDIÇÃO

A parte A é determinística e já está completa — não depende de semente e não
precisa das três bases:

```bash
node tools/r1851/diag_os07_tactical_effect.js \
  --build="dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html" \
  --somenteAlcance --out=reports/r1851/os07_alcance.json
```

Partes B e C, para cada base `4200000 / 8400000 / 1260000`:

```bash
node tools/r1851/diag_os07_tactical_effect.js \
  --build="dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html" \
  --matches=48 --semente=4200000 --out=reports/r1851/os07_s4200000.json
```

## GATE

Observacional, **não promovível**.

**Gate da parte A — já decidido, e é binário.** Campo que não muda `fx`, não
entra no escore de decisão e não vira flag lida é morto. Oito campos são
mortos. Não há bateria capaz de mudar isso e não há o que medir neles.

**Gate da parte C — decidido, e estrutural.** `oopRole` de jogador de linha não
é lido por nenhum código alcançável. Bateria não muda isso.

**Gate da parte B:** `inerte === true` (impressão idêntica em todas as
sementes) reprova o campo, mesmo ele sendo vivo na parte A — significa que
altera `fx` numa amplitude que nunca chega a mudar um desfecho. Candidata a
morto funcional.

**Gates de integridade:** `sha256` igual a `495a9d68…`; `scriptsComErro`
pareado com as rodadas anteriores; parte A idêntica entre execuções, já que não
consome semente.

## ARMADILHA

**A que me pegou duas vezes nesta rodada**, e as duas correções estão no
instrumento:

*Primeira* — `apply(tm)` (`:8079`) **compõe sobre `tm.baseFx`**:
`fx.ritmo`, `fx.drible`, `fx.shoot`, `fx.cross`, `fx.far` e `fx.drain` são
multiplicados sobre o valor anterior, e o resultado vira o novo `baseFx`.
Chamar `setTeamInstructions` duas vezes no mesmo `MatchSim` faz o `fx` derivar
sozinho, **independentemente do campo alterado**. A primeira versão do
instrumento reusava um sim e por isso deu "27 de 27 campos vivos" — todo campo
parecia vivo porque nenhum era. Cada medição precisa de um sim novo.

*Segunda* — testar só `fx` chamaria `finalThird.overlap` de morto, e ele é
vivo por outro caminho (flag em `:8087`, leitura em `:5652`). Por isso o
instrumento marca `verificar` em vez de `decorativo` quando o nome da folha
aparece fora do bloco Fase 4-7, e a adjudicação é manual.

**Terceira:** o vocabulário dos campos de texto não pode sair só dos presets.
`orientation` e `marking` têm um único valor em todos os presets — testados
assim, seriam "não variados", não "sem efeito". Os valores extras vêm do
próprio código (`:8067` para `orientation==='outside'`, `:8295` para as
escritas da IA).

**Quarta, e ela invalida a leitura ingênua da parte B:** mudar instrução muda
`fx`, que muda o caminho de consumo de RNG. Duas configurações diferentes na
mesma semente divergem por **caos**, não por efeito. Impressão diferente **não
é** evidência de efeito. Só o contrário vale: impressão idêntica prova inércia.
Efeito exige direção consistente sobre muitas sementes.

**Quinta:** `offsideTrap` (instrução, singular) e `offsideTraps` (contador de
partida, plural, `:16338` e `:16702`) são coisas distintas. Uma busca por
substring encontra o contador e conclui que a instrução é lida. Não é.

## VALIDAÇÃO EXECUTADA

- Parte A executada por completo sobre a build promovida: 27 folhas, `sha256`
  conferido em execução com `495a9d684104…`. É determinística e não consome
  semente, então é resultado, não fumaça.
- A adjudicação dos oito campos `verificar` foi manual, linha a linha, e está
  na tabela acima.
- Parte C: o veredito acima é **estático** (`_defendTarget` base inalcançável),
  não estatístico, e por isso não depende da bateria.
- Parte B: instrumento exercitado com 4 sementes apenas para provar que roda.
  Dois eixos apareceram inertes nessas 4 (`finalThird.crossType` e a troca de
  `oopRole`), e vale lembrar a assimetria: impressão idêntica é evidência de
  inércia, impressão diferente não é evidência de efeito. Ainda assim, **4
  sementes não são o protocolo**: a bateria de três bases × 48 partidas não foi
  executada e nenhuma taxa da parte B deve ser citada.
- Verificado à parte que `finalThird.crossType` de fato altera `fx.cross`
  (1,071 em `cutback` contra 1,1025 em `high`), ou seja, o eixo é vivo na parte
  A e a inércia observada é de amplitude, não de ligação.
