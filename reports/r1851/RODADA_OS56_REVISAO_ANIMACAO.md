# REVISÃO DA ANIMAÇÃO — o que os números dizem, o que a tela mostra, e uma hipótese minha falsificada

Pedido: revisar como está a animação do jogo. Fiz os dois: censo e **captura de
tela de partida real**, usando o atalho de desenvolvimento `window.__quickMatch`
que já existe no jogo.

## Números (R18.75)

Cobertura por evento — quando a jogada acontece, existe pose própria?

```
chute       20 eventos  -> 100,0%
defesa      14           -> 100,0%
drible     101           -> 100,0%
bloqueio     3           -> 100,0%
cabeceio    24           ->  50,0%   <- unico buraco
```

Distribuição por quadro (273.900 amostras):

```
run 40,59% | jog 33,90% | walk 11,56% | gk_ready 8,94% | idle 1,71% | sprint 1,04%
carry 0,69% | pass_* 1,31% | resto < 0,1% cada
```

**87% locomoção** é o esperado: futebol é correr sem a bola. As ações têm pose e
duram frações de segundo, então ocupam pouco tempo — isso não é defeito.

## O que a tela mostra e nenhum censo mostrava

Três coisas só aparecem na imagem:

1. **Os atletas são pequenos.** Numa visão de campo inteiro, o jogador tem ~20 px
   de altura. Todo o trabalho de pernas, passada, inclinação e giro cabe em
   poucos pixels. Nada disso é bug — é a consequência de mostrar 105 × 68 m numa
   tela. Uma animação legível como a de FIFA exige **câmera que segue a bola**, e
   isso é uma feature de porte, não um ajuste.
2. **Jogadores se sobrepõem.** A separação mínima do anti-aglomeração é 2,05 m,
   que nessa escala dá ~19 px — quase exatamente a largura do boneco. Dois
   jogadores no limite legal desenham colados.
3. **O nome do cobrador caía fora do campo** numa falta junto à linha lateral de
   cima.

## A hipótese que eu levantei e que está falsificada

Achei que a camada de bola parada (OS-21) estivesse **projetando errado**, porque
ela reconstrói a transformação do campo a partir de constantes copiadas
(`CW=1024, CH=500`) enquanto o canvas do jogo tem backing store de **973 × 475** e
desenha sob uma matriz de câmera. Cheguei a escrever o patch que substituía a
reconstrução por uma tabela publicada pelo renderer.

Antes de promover, medi o erro dessa reconstrução contra a posição real:

```
erro medio 1,2 px | erro maximo 2,4 px   (22 jogadores)
```

**A projeção estava certa.** `973 = 1024 × 0,95` e a matriz é exatamente
`scale(0,95)` — as duas escalas se cancelam. O refactor foi **descartado**:
consertava nada e adicionava risco, que é exatamente a crítica que eu venho
fazendo a mim mesmo a sessão inteira.

## O que era de verdade

O chip do nome é desenhado num deslocamento **fixo** acima do anel
(`ay = pt.y - R0 - 6`), sem nenhuma verificação de borda. Cobrador perto da linha
de cima, nome fora do campo. Agora o rótulo vira para baixo quando não cabe e
fica preso dentro do canvas na horizontal — a regra de qualquer tooltip.

## Fica aberto

- **cabeceio em 50%** de cobertura: o cabeceio de cruzamento passa por caminhos
  que não emitem `header_shot`/`header_clear`.
- **escala do boneco**: a animação existe e é rica, mas não é legível em visão de
  campo inteiro. O caminho é câmera que acompanha a bola.
- **sobreposição** de atletas no limite dos 2,05 m.
