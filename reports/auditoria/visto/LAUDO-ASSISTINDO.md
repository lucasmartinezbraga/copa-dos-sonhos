# O que se vê assistindo — R19.17, 90 minutos gravados

**Método:** nada aqui saiu de agregado, alvo de calibração ou média. Uma partida
foi jogada do apito inicial ao final no build enviado
(`reference/auditado-R19.17.html`, sha256 `b514442f…`), **gravada em vídeo**,
com 183 prints disparados nos lances, e estudada quadro a quadro em folhas de
contato.

```
Bélgica 0 × 5 Inglaterra · 95,1' · 484 s de relógio de parede · botão 3X
183 prints · vídeo de 9m21s · zero erro de script no console
```

Ferramentas: `tools/auditoria/assistir.js` (assiste e grava),
`tools/auditoria/folhas.js` (folhas de contato da gravação).

---

## 1. Nenhum dos 5 gols teve apresentação · **CORRIGIDO**

Os cinco gols saíram sem comemoração, sem flash, sem a rede estufando e **sem
narração**. O único sinal de que houve gol era o número do placar mudando.

`02-gol-sem-comemoracao-ANTES.png` — 1,6 s depois do 2º gol: o jogo já está no
pontapé de saída, a narração ainda fala do lance anterior, nenhum overlay.

**Causa**, encontrada instrumentando `onEvent`:

```js
if (e.type === 'goal' && e.by) {
  const sc = G.cup.scorers;      // G.cup é null fora da Copa → TypeError aqui
```

A primeira linha do tratamento de gol é a tabela de artilharia. Ela estoura, e
morre tudo que vem depois: `goalFlash`, `redeEstufa`, `armShotFx`, o replay, a
comemoração e a narração. Logo abaixo havia a segunda mina, no mesmo lance:
`G.db.byId[myMatch.h].c` — `undefined` sempre que `myMatch` não aponta para o
banco da Copa.

`03-gol-com-comemoracao-DEPOIS.png` — o mesmo lance depois da correção: "GOL",
o nome do goleador, o placar com os nomes dos dois times e o confete.

## 2. A falha era invisível por construção · **CORRIGIDO**

```js
try { this.onEvent(ev); } catch(e){}
```

O motor engole toda exceção da camada de apresentação. Engolir está certo — uma
falha de tela não pode derrubar a partida. Engolir **sem deixar rastro** é o que
permitiu um gol sem comemoração sobreviver quem sabe quantas releases: nenhum
contador, log ou teste do projeto tinha como perceber.

Agora a falha continua sendo engolida e passa a ser contada em
`visualIntegrity.presentationFaults`, com o tipo de evento e a mensagem. Foi
esse contador que entregou a segunda mina do item 1, trinta segundos depois de
existir.

## 3. O campo fica preto em metade dos cartões — **NÃO É BUG**

`01-campo-preto-no-cartao.png` — aos 7'03", durante uma cobrança de falta com
cartão, o campo desaparece por inteiro. Medido nos 183 quadros da partida
(`brilho-por-quadro.json`), varrendo a fração de verde da área do campo:

| minuto | quadro | verde na área do campo |
|---|---|---|
| 7,05' | cartão + 800 ms | **0,0 %** |
| 13,04' | cartão + 800 ms | **0,0 %** |
| 42,78' | cartão + 800 ms | 94,8 % (só escurece) |
| 79,95' | cartão + 800 ms | 93,4 % (só escurece) |

**Eu registrei isto como defeito e estava errado.** Medindo o pixel a cada
quadro por 40 s: 63 quadros pretos em 2.377, em rajadas de ~350 ms, todas
precedidas por `foul` → `falta_cobrada`. É o **corte de câmera da OS-267** — a
camada que o dono pediu com estas palavras: *"veja se é melhor fazer um corte
no lance e voltar com tudo já reajustado"*. Escurece em 240 ms, segura 200 ms
com o campo se reorganizando escondido, e volta em 320 ms.

Os dois cartões que apagam a tela são os que coincidem com uma falta; os dois
que só escurecem são cartões sem corte. Funciona exatamente como projetado.

Fica o número, para decisão de projeto e não de conserto: são ~22 faltas por
partida e o corte custa ~760 ms cada — perto de **17 s de tela escura por
jogo**. Se isso for caro demais, a alavanca é a lista `CORTA` da camada 86.


## 4. O pênalti contava o final antes de acontecer · **CORRIGIDO**

`04-penalti-spoila-o-desfecho.png` — aos 8'55", três textos discordando no
mesmo quadro:

- narração: "🔴 PÊNALTI! David Beckham **vai cobrar**…"
- HUD de bola parada: "**GOL — PÊNALTI CONVERTIDO**"
- placar: já somado

O motor resolve a bola parada no instante em que a anuncia, então `penalty` e
`goal` chegam ao HUD com milissegundos de diferença. A barra de progresso do
anúncio já diz quanto tempo a cerimônia merece; o desfecho passou a esperar
esse tempo (§VISTO-05, `54-cds-os20-setpiece-hud.js`).

## 5. O pontapé de saída não se organizava · **CORRIGIDO**

O adversário ficava dentro do círculo central e os dois times misturados nas
metades erradas. A camada OS-214 (*"o time volta para casa antes do pontapé"*)
foi escrita exatamente para isso e **nunca funcionou** — por ordem de execução:

```js
P.step = function (dt) {
  ...
  const r = oldStep.apply(this, arguments);   // o núcleo consome pendingRestart AQUI
  ...
  else if (num(this.dead) <= 0.05) this.dead = 0.12;   // e só agora segura
```

O núcleo dispara o reinício **dentro** do passo, no quadro em que `dead` chega
a zero. A camada segurava depois — quando o pontapé já tinha saído. O time
continuava voltando para casa com a bola rolando, o relógio da partida parado e
a tela adiantada 3,5×. A auditoria chamava isso de faixa cinzenta.

Agora a janela segura **antes** do passo (como a OS-77 e a OS-83 já faziam) e
morre assim que a bola volta a rolar.

## 6. A falta longe do gol não era batida · **CORRIGIDO**

Medido em 96 partidas: de 2.285 faltas, **1.336 terminavam com o jogador
carregando a bola** (58,5%). O batedor caminhava até o ponto, a bola era posta
no ponto — e o reinício apenas devolvia a posse. Agora ele toca para o
companheiro mais próximo, com a mesma mecânica do ramo `short` do `_freeKick`.

**58,5% → 0,2%** em 200 partidas.

## 7. Outros oito, todos medidos

| | o que era | depois |
|---|---|---|
| nota do atleta | passava de 10 (172.114 quadros em 200 partidas) | limite na própria propriedade — **0** |
| chute acelerando no ar | de 16 para 39 m/s num quadro, 11×/jogo — era o fim da câmera lenta em degrau | rampa de 0,18 s — **0** |
| escanteio | 100% saíam a 2,27 m da bandeirinha (o arco tem 1 m) | 1,53 m — **0 fora da tolerância** |
| gol por fora da trave | 5 gols com a bola cruzando até 4,6 m fora do poste | guarda de geometria no `_goal` — **0** |
| corpos sobrepostos | goleiro e atacante a 1 cm por mais de 1 s | goleiro entra na conta, piso de 0,55 m no duelo |
| expulso no intervalo | espelhado junto com os outros 21 | pulado, como no `_resetPositions` |
| pênalti | a bola nunca visitava a marca da cal | vai para a marca, com bola morta de 0,35 s |
| bola piscando no reinício | 66 recolocações por jogo, até 100 m, nenhuma desenhada | o trajeto é percorrido em até meio segundo |

## 8. A falta perto do gol está boa

`05-falta-perto-do-gol-bem-encenada.png` — vale registrar o que **não** estava
quebrado: barreira armada, arco de 9,15 m, cobrador nomeado, distância e HUD
com barra de tempo. O problema nunca foi a cobrança perto da área.

---

## O placar antes e depois — 200 partidas, mesmas sementes

```
                SEU HTML   CORRIGIDO
  violações      177.254       1.255      -99,3%
  falta carregada  59,8%        0,2%
  faixa cinzenta    7,6 s       1,1 s     por partida
  pior episódio     5,3 s       0,4 s
```

| regra | antes | depois |
|---|---|---|
| `A5` nota fora de 0..10 | 172.114 | **0** |
| `E2` bola acelera no ar | 2.211 | **0** |
| `C10` reinício fora do lugar | 1.142 | 19 |
| `D8` bola morta com o jogo andando | 446 | **0** |
| `C13` corpos sobrepostos | 120 | 35 |
| `C4b` expulso no intervalo | 25 | **0** |
| `C16` gol fora da baliza | 5 | **0** |
| `B8` bola recolocada | 1.189 | 1.201 |

`B8` não muda porque a correção é de **desenho** — a auditoria roda fora do
navegador e não vê o trajeto sendo percorrido. O motor continua recolocando a
bola; o que mudou é que agora se vê ela indo.

### Calibração: nada regrediu, uma métrica entrou

| métrica | seu HTML | corrigido | faixa |
|---|---|---|---|
| gols por partida | 1,855 **fora** | 1,975 **fora** | 2,4 – 3,2 |
| goleadas (`blowoutRate`) | 0,080 **fora** | **0,130 ok** | 0,09 – 0,19 |
| chutes no alvo | 0,314 **fora** | 0,3227 **fora** | 0,34 – 0,47 |
| 0×0 | 0,165 **fora** | 0,180 **fora** | 0,045 – 0,12 |
| empates | 0,315 ok | 0,315 ok | 0,20 – 0,33 |
| passes certos | 0,8116 ok | 0,8169 ok | 0,75 – 0,89 |

**O jogo continua fazendo gol de menos** — isso é anterior às correções e não
foi tocado: mexer nisso é calibração, e calibração não se faz assistindo.

### Uma correção minha que a amostra grande derrubou

Logo depois de fazer a falta virar cobrança, medi 48 partidas: gols de 2,23
para 2,44, três métricas entrando na faixa. Em 200 partidas pareadas o ganho
virou +0,12 e nada disso se sustentou. **Era ruído de amostra pequena** — a
mesma armadilha que o projeto já tinha documentado em `33-cds-r18fix`. O erro
padrão de gols por partida com n=48 é 0,23; o "ganho" cabia inteiro dentro
dele. Fica registrado para não se repetir: placar exige 200+ partidas.
