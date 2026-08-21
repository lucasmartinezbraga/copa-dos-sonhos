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

## 3. O campo fica preto em metade dos cartões

`01-campo-preto-no-cartao.png` — aos 7'03", durante uma cobrança de falta com
cartão, o campo **desaparece por inteiro**: sem grama, sem linhas, sem os 22.
Sobram um arco pontilhado, o rótulo do cobrador e um círculo.

Medido nos 183 quadros da partida (`brilho-por-quadro.json`), varrendo o brilho
e a fração de verde da área do campo:

| minuto | quadro | verde na área do campo |
|---|---|---|
| 7,05' | cartão + 800 ms | **0,0 %** |
| 13,04' | cartão + 800 ms | **0,0 %** |
| 42,78' | cartão + 800 ms | 94,8 % (escurecido, como deve ser) |
| 79,95' | cartão + 800 ms | 93,4 % (escurecido, como deve ser) |

Dois dos quatro cartões apagam a tela; os dois que apagam são os que coincidem
com a cena de falta. Não é artefato de captura: o placar, o painel lateral e o
HUD desenham normalmente no mesmo quadro — só o campo some.

Não corrigido nesta rodada: mexer no desenho da cena de falta pede sonda de
tela própria antes e depois, e não quis fazer isso no escuro.

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

## 5. O pontapé de saída não se organiza

Visível em `02-...ANTES.png` e em todo reinício após gol: o adversário fica
**dentro do círculo central**, encostado no batedor, e jogadores dos dois times
ficam na metade errada. É o defeito que a própria OS-214/OS-264 diagnosticou e
não conseguiu embarcar.

Não corrigido: mudar posição no pontapé mexe no jogo, não só na tela, e isso
pede a bateria rodando antes e depois.

## 6. A falta perto do gol está boa

`05-falta-perto-do-gol-bem-encenada.png` — vale registrar o que **não** está
quebrado: barreira armada, arco de 9,15 m desenhado, cobrador nomeado,
distância ("17 m do gol"), HUD com barra de tempo e narração coerente. O
problema das faltas não é a cobrança perto da área; é a falta longe, que não
vira cobrança nenhuma.

---

## As correções não tocaram o jogo

As três correções são de apresentação. A prova é a própria auditoria, com a
mesma amostra antes e depois:

```
placares iguais : True
agregado igual  : True
violações iguais: True   3173 -> 3173
```

## O que ficou pendente

| | por que não mexi |
|---|---|
| campo preto no cartão | é desenho de cena; precisa de sonda de tela antes/depois |
| pontapé de saída | mexe em posição, e posição mexe em placar |
| falta longe do gol sem cobrança | mesma razão: muda o jogo, não a tela |
