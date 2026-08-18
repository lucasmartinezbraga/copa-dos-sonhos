# OS-250 · Reprovada: segurar a janela não conserta o salto do batedor

Quinta hipótese reprovada por medição nesta base, junto com a OS-233
(constantes do escanteio), a OS-244 (aceleração da câmera) e a OS-248 (o
batedor voltando para casa).

## O diagnóstico estava certo

`tools/fisica/tela/deriva-do-batedor.js` separou duas famílias que pedem
consertos opostos, e a assinatura era inequívoca — uma reta perfeita, cortada
antes do fim:

```
0s:12,43  0,3s:10,92  0,6s:9,42  0,9s:7,92  1,2s:6,41
1,5s:4,91  1,8s:3,40  2,1s:1,90  2,4s:0,52   FIM:0,44
```

Ele anda a ~4,5 m/s sem parar um quadro e a bola rola faltando 0,33 a 0,44 m —
dois a três quadros. Não é velocidade nem escritor concorrente: é o relógio.

## A correção não corrigiu

A camada devolvia até 0,45 s a `dead` enquanto o batedor marcado ainda tinha
caminho. Medido com `tools/fisica/lances.js`, **48 partidas por braço, 1450
cobranças de falta cada** (contra 19 da sonda de tela):

| invariante | controle | com OS-250 |
|---|---|---|
| F6 batedor não salta | 1117/1450 · **77,0%** [74,8–79,1] | 1109/1452 · **76,4%** [74,1–78,5] |
| F7 nenhum salto visível (≤2 m) | 1450/1450 · **100%** | 1449/1452 · 99,8% · **pior 7,77 m** |
| F3 batedor na bola | 98,8% · pior 6,39 m | 98,0% · pior **32,98 m** |
| E2 escanteio não salta | 71,6% [67,8–75,2] | 75,1% [71,5–78,4] |

**Os intervalos de F6 se sobrepõem inteiramente.** Pela regra escrita na própria
ferramenta, isso é "não diferem" — a camada é inerte no número que ela existia
para mover.

E não é só inerte. O controle **nunca** produz salto visível em 1450 cobranças;
o build tratado produz três, o pior de 7,77 m, e o pior caso de F3 vai de 6,39
para 32,98 m. Segurar a bola morta aberta dá tempo para outra máquina
re-mirar o batedor — troca um defeito submétrico e invisível por um raro e
gritante.

A bateria de 288 partidas tinha dito 12/13 contra 11/13 do controle, e isso
**não** foi usado a favor dela: a única métrica que mudou de faixa foi
`redsPerMatch`, e a OS-249 provou no mesmo dia que ela não é resolvível a 288
partidas.

## O que a medição revelou de graça

* **F6 ≈ 77% e E2 ≈ 72% são a linha de base**, não um defeito recente. Um em
  cada quatro lances de bola parada termina com um ajuste submétrico do
  batedor.
* **F7 e E4 são 100%**: esse ajuste **nunca** é visível. O F6 mede rigor de uma
  passada (~0,16 m); o F7 mede o que o dono vê (2 m). Os dois juntos separam
  rigor de relevância — e dizem que este item, sozinho, não é o que incomoda
  na falta.
* **F2 falha em 0,8% das cobranças, com pior caso de 71,21 m.** Esse sim é
  visível e grave: a bola termina longe do ponto da falta. É o próximo alvo.

## A lição

Diagnóstico certo não garante conserto certo. A reta cortada era real e a
explicação — "falta relógio" — continua sendo a leitura correta da série. O que
não se seguiu é que devolver relógio resolvesse: o sistema usa o tempo extra
para outra coisa.
