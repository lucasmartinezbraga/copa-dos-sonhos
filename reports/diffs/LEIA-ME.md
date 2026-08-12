# O que já foi feito — um patch por defeito

Gerado por `python3 tools/dossie/diffs.py` direto do git, não escrito à
mão. Serve para uma coisa que nenhum outro arquivo do dossiê faz:
**mostrar o tamanho e o formato de uma mudança que foi aceita aqui.**

Repare no padrão, porque ele é o contrato:

- a mudança é pequena e tem um alvo só;
- o comentário no código diz **o que foi medido**, não o que se espera;
- o assunto do commit carrega o ID do defeito (é o que torna este
  arquivo possível);
- quando a medição contrariou a hipótese, o commit **diz isso** em vez de
  ajustar a hipótese.

| defeito | commit | data | linhas | assunto |
|---|---|---|---|---|
| **D01** | `3c8965df` | 2026-08-11 | +201 −7 | fix(D01): a premissa estava errada — a segunda fisica esta em _looseRoll |
| **D03** | `7af210a3` | 2026-08-11 | +154 −225 | feat: fase F1 concluida — D03 e D28 feitos, 176 linhas mortas removidas |
| **D04** | `7c7104a2` | 2026-08-11 | +109 −2 | feat: pacote de entrega para IA — doutor, prompts, AGENTS.md, e D04 feito |
| **D11** | `5a7542dd` | 2026-08-12 | +740 −8 | fix(D11): restaura a janela de 1,15 s do veto — e um portao para o placar de design |
| **D11** | `a743c221` | 2026-08-12 | +61 −24 | fix(D11): funde o dado e o censor do chute contextual num predicado puro |
| **D25** | `d6cc74b0` | 2026-08-11 | +134 −13 | fix: D32 e D25 executados — um conserto vivo e um resultado negativo |
| **D28** | `7af210a3` | 2026-08-11 | +154 −225 | feat: fase F1 concluida — D03 e D28 feitos, 176 linhas mortas removidas |
| **D32** | `d6cc74b0` | 2026-08-11 | +134 −13 | fix: D32 e D25 executados — um conserto vivo e um resultado negativo |

## Como ler um patch daqui

```bash
git show <sha>                    # o commit inteiro, com contexto
git apply --check <arquivo>.patch # o patch ainda aplica?
```

Os arquivos `.patch` são saída de `git show --stat --patch`, então
trazem o `--stat` no topo: dá para ver o tamanho da mudança sem rolar
o diff inteiro.
