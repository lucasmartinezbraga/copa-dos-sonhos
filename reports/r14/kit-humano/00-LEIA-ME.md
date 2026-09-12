# Kit humano — R14

São 586 controles que dependem de uma pessoa. Não precisa fazer tudo,
nem de uma vez: **cada linha marcada vira evidência**; o resto continua
`PENDENTE` sem prejuízo.

## Como usar

1. Abra a build em `dist/` e deixe aberta ao lado.
2. Escolha um arquivo `.txt` deste diretório.
3. Para cada linha, siga o `cenário` e confira o `aceite`.
4. Troque `[ ]` por `[x]` (passou), `[!]` (falhou) ou `[?]` (não deu).
5. Rode: `python tools/r14/make_human_kit.py --ler`

## Por onde começar (maior retorno primeiro)

- `01-assistir-partida.txt` — só precisa de um navegador. É o maior grupo
  e destrava a Fase 5, que hoje está parcial.
- `02-aparelho-fisico.txt` — 20 minutos com o celular na mão fecham o
  domínio Mobile inteiro, que nenhuma emulação pode fechar.
- `03-painel-humano.txt` — precisa de 3 pessoas; deixe por último.

## O que acontece com o que você marcar

`[!]` (falhou) é tão útil quanto `[x]`: vira um defeito registrado com o
SHA da build, e eu consigo investigar. Não force `[x]` — auditoria com
item aprovado sem observação não vale nada.
