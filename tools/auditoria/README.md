# tools/auditoria

Suíte de avaliação de bugs. A metodologia — por que cada nível existe, o que
cada um pega e o que nenhum deles pega — está em
[`docs/METODOLOGIA-DE-BUGS.md`](../../docs/METODOLOGIA-DE-BUGS.md).

## Rodada completa (os sete níveis)

```bash
B=dist/index.html
R=reports/auditoria

node tools/auditoria/artefato.js        --build=$B --out=$R/N0-artefato.json
node tools/auditoria/mapa_de_camadas.js --build=$B --out=$R/N1-camadas.json
node tools/auditoria/auditoria.js       --build=$B --partidas=96 --workers=8 --out=$R/N2-simulacao-96.json
node tools/auditoria/auditoria.js       --build=$B --partidas=48 --workers=8 --elenco=paridade --out=$R/N4-paridade-48.json
node tools/auditoria/tela.js            --build=$B --segundos=150 --out=$R/N5-tela-3x.json
node tools/auditoria/tela.js            --build=$B --segundos=90 --velocidade=1 --out=$R/N5-tela-1x.json
node tools/auditoria/tela.js            --build=$B --segundos=90 --velocidade=6 --out=$R/N5-tela-turbo.json
node tools/auditoria/fluxo.js           --build=$B --out=$R/N6-fluxo.json

node tools/auditoria/relatorio.js \
     --auditoria=$R/N2-simulacao-96.json \
     --tela=$R/N5-tela-3x.json --tela1x=$R/N5-tela-1x.json --telaturbo=$R/N5-tela-turbo.json \
     --camadas=$R/N1-camadas.json --n0=$R/N0-artefato.json --n6=$R/N6-fluxo.json \
     --artefato=$B --out=$R/laudo.md
```

## Rodada de commit (~1 min)

```bash
node tools/auditoria/artefato.js --build=dist/index.html
python3 tools/verify.py
node tests/browser_smoke.js dist/index.html
node tools/auditoria/auditoria.js --build=dist/index.html --partidas=8 --workers=8
```

Portão: zero S1, nenhum bloco com erro de carga.

## Assistir a partida (nível N7)

```bash
# joga 90 minutos, grava o vídeo e dispara prints em cima de cada lance
node tools/auditoria/assistir.js --build=dist/index.html --velocidade=3 --ate=95 \
     --dir=reports/auditoria/jogo

# a gravação inteira em folhas de contato: 20 quadros por imagem
node tools/auditoria/folhas.js --video=reports/auditoria/jogo/partida-completa.webm
```

Foi este nível que achou o defeito mais caro da suíte — cinco gols sem
comemoração, sem flash e sem narração — que nenhum agregado veria.

## Perguntas pontuais

```bash
# quem realmente executa este método?
node tools/auditoria/mapa_de_camadas.js --build=$B --metodo=_awardFoul

# me mostre o lance do defeito, quadro a quadro
node tools/auditoria/repro.js --build=$B --partida=3 --regra=E1

# a auditoria está mudando o jogo que ela mede?
node tools/auditoria/auditoria.js --build=$B --verificar-neutralidade

# quem escreveu neste campo, e de qual camada?
node tools/auditoria/quem_escreve.js --build=$B --campo=dead --partida=0 --de=2900 --ate=3000
```

## Opções

| ferramenta | opção | efeito |
|---|---|---|
| `auditoria.js` | `--partidas=N` | tamanho da amostra (padrão 24) |
| | `--workers=W` | processos em paralelo |
| | `--elenco=variado\|paridade` | `variado` percorre o banco (superfície); `paridade` usa o mesmo elenco dos dois lados (medir viés) |
| | `--max-por-regra=N` | quantos exemplos guardar por regra |
| `tela.js` | `--segundos=S` | janela medida |
| | `--velocidade=V` | força o botão (1, 2, 3, 6) |
| `repro.js` | `--partida=I` `--regra=ID` `--quadro=Q` `--janela=N` | |
| `mapa_de_camadas.js` | `--metodo=NOME` | pilha de um método só |
| `quem_escreve.js` | `--campo=CAMINHO` | `dead`, `minute`, `ball.x`, `teams.0.fx.line` |
| | `--de=Q --ate=Q` | janela de quadros |
| | `--so_dead` | só escritas com `sim.dead > 0` |
| `fluxo.js` | `--png=DIR` | onde salvar as capturas |
| `assistir.js` | `--ate=MIN` | até que minuto de jogo assistir |
| | `--velocidade=V` | botão do jogo (1, 2, 3, 6) |
| | `--gravar=nao` | só prints, sem vídeo |
| | `--passo-min=N` | print de rotina a cada N minutos de jogo |
| `folhas.js` | `--intervalo=S` | segundos de vídeo entre quadros |
| | `--colunas=C --linhas=L` | grade da folha |

Todas aceitam `--build=` e `--out=`.
