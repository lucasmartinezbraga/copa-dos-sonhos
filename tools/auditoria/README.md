# tools/auditoria

Suíte de avaliação de bugs. A metodologia — por que cada nível existe, o que
cada um pega e o que nenhum deles pega — está em
[`docs/METODOLOGIA-DE-BUGS.md`](../../docs/METODOLOGIA-DE-BUGS.md).

## Rodada completa

```bash
B=dist/index.html

node tools/auditoria/mapa_de_camadas.js --build=$B --out=reports/auditoria/N1-camadas.json
node tools/auditoria/auditoria.js       --build=$B --partidas=48 --workers=8 \
     --out=reports/auditoria/N2-simulacao-48.json
node tools/auditoria/tela.js            --build=$B --segundos=150 \
     --out=reports/auditoria/N5-tela-3x.json

node tools/auditoria/relatorio.js \
     --auditoria=reports/auditoria/N2-simulacao-48.json \
     --tela=reports/auditoria/N5-tela-3x.json \
     --camadas=reports/auditoria/N1-camadas.json \
     --out=reports/auditoria/laudo.md
```

## Rodada de commit (~1 min)

```bash
python3 tools/verify.py
node tests/browser_smoke.js dist/index.html
node tools/auditoria/auditoria.js --build=dist/index.html --partidas=8 --workers=8
```

Portão: zero S1, nenhum bloco com erro de carga.

## Perguntas pontuais

```bash
# quem realmente executa este método?
node tools/auditoria/mapa_de_camadas.js --build=$B --metodo=_awardFoul

# me mostre o lance do defeito, quadro a quadro
node tools/auditoria/repro.js --build=$B --partida=3 --regra=E1

# a auditoria está mudando o jogo que ela mede?
node tools/auditoria/auditoria.js --build=$B --verificar-neutralidade
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

Todas aceitam `--build=` e `--out=`.
