# OS-09 — o funil da falta: por que não há cobrança nem pênalti

**Baseline:** R18.50 — PRESERVAR ENERGIA
**Natureza:** observacional
**Promoção:** não promovível
**Patches na build:** nenhum

**SHA-256 medida:** `495a9d684104b55ec749e43462549667fddb66a93b5d0b0a4cb1ab9d95c0445a`

## MEDIÇÃO EXECUTADA

8 partidas, base 4200000, incremento 7919, sobre a build promovida. **N=8 não é
o protocolo de três bases × 48**; os números abaixo dimensionam o funil, não
fecham taxa.

| | por partida |
|---|---|
| faltas | 7,13 |
| — dentro da área | **0,00** |
| — fora da área, < 28 m do gol | 2,75 |
| — fora da área, ≥ 28 m do gol | 4,38 |
| cobranças de falta | 0,63 |
| pênaltis | **0,00** |
| cartões amarelos (`stats.yellowCards`) | 0,00 |

O evento `yellow` dispara 1,50 por partida. O contador `stats.yellowCards`
fica em zero.

## MECANISMO

Tudo acontece em `_awardFoul`, `dist/COPA DOS SONHOS - R18.50 - PRESERVAR ENERGIA.html:6706–6712`:

```js
const inBox = (attackDir > 0 ? victim.x > FL-16.5 : victim.x < 16.5) && Math.abs(victim.y - FW/2) < 20;
if (inBox) { this._penalty(victim.team); return; }
// falta perigosa → cobrança direta
if (dtg < 28 && chance(0.42)) { this._freeKick(victim.team, victim.x, victim.y); return; }
// falta comum: reinício com posse
this.dead = 0.82;
this.pendingRestart = () => { this._giveBall(this._nearestFieldMate(victim)); ... };
```

**1. A falta a 28 m ou mais nunca vira cobrança.** Não é probabilidade baixa: é
`dtg < 28` no gate. São 4,38 faltas por partida — 61% de todas — que caem
direto no ramo de baixo. A posição clássica de falta, 25–35 m, está do lado de
fora do gate.

**2. Mesmo dentro dos 28 m, 58% são descartadas** por `chance(0.42)`.

**3. O ramo de baixo não é uma falta.** `this.dead = 0.82` e a bola é entregue
ao companheiro mais próximo. Não há barreira, não há bola parada, não há
cobrança. No futebol, falta **é** a bola parada; aqui a maioria é uma troca de
posse com 0,82 s de pausa. É literalmente o "não rola nada disso".

O funil fecha em 7,13 → 0,63: cerca de **9% das faltas viram cobrança**.

**4. O pênalti não está faltando — está suprimido a montante.** O caminho
existe e funciona (`_penalty` em `:6707`, `penaltiesTaken++` em `:6817`). O que
não acontece é falta dentro da área. A causa está em `:16258`:

```js
foulP = clamp((this._foulProb(d)) * (ownBox ? .55 : 1.30), .022, ownBox ? .095 : .35);
```

Dentro da própria área a probabilidade de falta é multiplicada por **0,55** e
travada em **0,095**; fora, multiplicada por **1,30** com teto de **0,35**. O
teto dentro da área é 3,7× menor. Somado ao fato de que a falta só nasce de
evento de duelo, o resultado medido é 0,00 falta na área em 8 partidas — e
portanto nenhum pênalti.

**5. `stats.yellowCards` e `stats.redCards` nunca são incrementados.** A chave
existe e é lida (`:8590`, `st.yellowCards`), o evento `yellow` dispara 1,50 por
partida, e o cartão aparece no jogador (`p.yellow` na interface do elenco). Só
o agregado não é escrito. Mesmo padrão em `stats.freeKicks`, que fica zerado
enquanto `freeKickDirect` e `freeKickCrossed` somam 0,63.

## HIPÓTESE

Em direção, sem percentual:

1. Removido o corte `dtg < 28`, as cobranças de falta **sobem** e os
   reinícios por posse **descem**, sem mexer no total de faltas.
2. Elevado o teto de `ownBox` em `:16258`, os pênaltis **sobem** a partir de
   zero.
3. Gols **sobem** nos dois casos — bola parada perto da área converte.
4. O total de faltas não muda em nenhum dos dois: os gates são de
   **destino** da falta, não de geração.

## GATE

Observacional, **não promovível**.

**Gate de decisão:** as três constantes de `:6709` (`28`, `0.42`) e `:16258`
(`.55`/`.095`) são o sítio. Se uma candidata que só as move levar cobranças e
pênaltis a patamar de futebol real sem estourar `ECO-02 ≤ 2,7 xG/partida`, a
rota está certa. Se os gols estourarem antes das cobranças chegarem lá, o
problema é a conversão de bola parada, não o funil.

**Gates herdados:** `ECO-02 ≤ 2,7 xG/partida`, determinismo, comparação
pareada nas três bases, e agora também `penaltiesTaken > 0`.

## ARMADILHA

**A que me pegou nesta rodada:** li `stats.yellows` e vi zero, e quase reportei
como bug. A chave é `yellowCards` (`:8522`, `:8590`, `:8776`). O zero era minha
leitura. Só depois de conferir o nome é que o zero virou achado — e virou por
outro motivo, o agregado não escrito.

**Segunda:** contar `freeKicks` em vez de `freeKickDirect + freeKickCrossed +
freeKickShort` dá zero e sugere que não existe cobrança nenhuma. Existe: 0,63.
O agregado é que está morto.

**Terceira:** 0,00 pênalti em 8 partidas **não prova** que o caminho está
quebrado — prova que não foi alcançado nessas 8. O que prova a supressão é o
código de `:16258`, não a contagem. A contagem apenas dimensiona.

**Quarta:** `inBox` em `:6706` usa `Math.abs(victim.y - FW/2) < 20`, ou seja
40 m de largura, enquanto a grande área tem 40,3 m. É coerente. Não confundir
com a caixa de `:16258`, que é a área do **defensor**, outra referência.

## VALIDAÇÃO EXECUTADA

- Medição de 8 partidas sobre a build promovida, `sha256` conferido em
  execução. Sem patch.
- Os gates de `:6709` e `:16258` foram lidos no texto efetivo. `_awardFoul` tem
  um envelope em `:20781` (`_r1835award`) e um hint de auditoria em `:17978`;
  nenhum dos dois substitui o corpo com os gates acima.
- Nenhuma bateria de três bases × 48 partidas foi executada.
