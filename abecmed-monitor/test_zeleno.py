#!/usr/bin/env python3
"""Testes da leitura do catálogo da Zeleno.

Os trechos abaixo reproduzem a estrutura real das páginas em 19/08/2026. O caso
que mais importa é o primeiro: na Zeleno, produto fora de estoque **não sai da
página, vira comentário HTML**. Quando isto foi escrito, `flores1.html` trazia
122 produtos dos quais 1 estava ativo. Um parser que ignore os comentários
anuncia 122 disponíveis e transforma o monitor em gerador de alarme falso.

Rodar:  python3 abecmed-monitor/test_zeleno.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import zeleno as Z  # noqa: E402

LISTA = """<body>
  <div class="produtos-container" id="lista-produtos">
    <!-- ================= PRODUTOS ATIVOS ================= -->
    <div class="produto">
        <div class="selos"><span class="selo selo--novidades">Novidades</span></div>
        <a href="207-(power-plant).html"><img src="power plant horizontal.png" alt="Power Plant" /></a>
        <h2>Power Plant</h2>
        <p class="genetica">Híbrida (+sativa)</p>
        <p class="preco">R$93,00/g</p>
        <p>*min 5g</p>
        <a href="207-(power-plant).html" class="botao-saiba-mais">Saiba Mais</a>
    </div>

    <!-- ============ INATIVOS / FORA DE ESTOQUE ============ -->
    <!-- <div class="produto">
        <a href="198-(notorious-thc).html"><img src="notorious thc horizontal.png" alt="Notorious THC" /></a>
        <h2>Notorious THC</h2>
        <p class="genetica">Híbrida (+índica)</p>
        <p class="preco">R$50,00/g</p>
        <a href="198-(notorious-thc).html" class="botao-saiba-mais">Saiba Mais</a>
    </div> -->

    <!-- <div class="produto">
        <h2>Hindu Kush</h2>
        <p class="preco">R$50,00/g</p>
        <a href="144 (hindu kush).html" class="botao-saiba-mais">Saiba Mais</a>
    </div> -->
  </div>
</body></html>"""

FICHA_NUMERICA = """<body>
  <a href="index.html"><img src="cannabis-01.png" alt="Logo Zeleno"></a>
  <div class="subtitle-bar">Flores</div>
  <span class="selo">Novidades</span>
  <h1>Power Plant</h1>
  <img src="power plant strain.png" alt="Power Plant">
  <div class="preco">R$ 93,00/g</div><span>*mínimo 5g</span>
  <div><span>Genética</span><span>Híbrida (+sativa)</span></div>
  <div><span>Concentração</span><span>20,5% </span><span>THC</span></div>
  <div><span>Efeitos</span><span>Criativo, Eufórico</span></div>
  <div><span>Sabor</span><span>Herbal</span></div>
</body></html>"""

# O extrato não publica número: diz "Alto em THC". Exigir dígito descartava a
# informação inteira e o produto ficava sem ficha nenhuma.
FICHA_QUALITATIVA = """<body>
  <a href="index.html"><img src="cannabis-01.png" alt="Logo Zeleno"></a>
  <h1>La Kush Cake</h1>
  <img src="La Kush Cake extrato_concentrado.png" alt="La Kush Cake">
  <div class="preco">R$ 190,00/g</div>
  <div><span>Tipo</span><span>Extrato/Concentrado</span></div>
  <div><span>Concentração</span><span>Alto em</span><span>THC</span></div>
  <div><span>Efeitos</span><span>Relaxante, Empolgante</span></div>
</body></html>"""

falhas = []


def checar(condicao, descricao):
    if condicao:
        print(f"  ok   {descricao}")
    else:
        print(f"  FALHA {descricao}")
        falhas.append(descricao)


print("fora de estoque é comentário HTML")
produtos = Z.extrair_produtos(LISTA)
checar(len(produtos) == 1, f"só o produto ativo é lido (achou {len(produtos)} de 3 no arquivo)")
checar(produtos[0]["nome"] == "Power Plant", "e é o que está fora do comentário")
nomes = [p["nome"] for p in produtos]
checar("Notorious THC" not in nomes, "produto comentado não entra no catálogo")
checar("Hindu Kush" not in nomes, "nem o segundo comentado")

print("\ndados do produto na lista")
p = produtos[0]
checar(p["preco"] == 93.0, f"preço 93.0 (achou {p['preco']})")
checar(p["por"] == "/g", "guarda que o preço é por grama")
checar(p["categoria"] == "Híbrida (+sativa)", "guarda a genética")
checar(p["link"] == "207-(power-plant).html", "guarda o link da ficha")
checar(p["selo"] == "Novidades", "guarda o selo")

print("\npreços em formatos da Zeleno")
checar(Z.preco_e_unidade("R$93,00/g") == (93.0, "/g"), "'R$93,00/g' sem espaço")
checar(Z.preco_e_unidade("R$ 490,00") == (490.0, ""), "óleo não é por grama")
checar(Z.preco_e_unidade("R$ 1.234,50/g") == (1234.5, "/g"), "milhar com ponto")
checar(Z.preco_e_unidade("sem preço") == (None, ""), "sem preço não quebra")

print("\nficha com concentração numérica")
f = Z.extrair_ficha(FICHA_NUMERICA)
checar(f["thc"] == "20,5%", f"THC numérico (achou {f['thc']!r})")
checar(any("Genética" in d for d in f["detalhes"]), "traz a genética")
checar(any("Criativo" in d for d in f["detalhes"]), "traz os efeitos")
checar(any("Herbal" in d for d in f["detalhes"]), "traz o sabor")
checar(f["foto_url"] and "power%20plant%20strain.png" in f["foto_url"], f"foto do produto (achou {f['foto_url']})")
checar(f["foto_url"] and "cannabis-01" not in f["foto_url"], "não devolve o logo como foto")

print("\nficha com concentração qualitativa")
f2 = Z.extrair_ficha(FICHA_QUALITATIVA)
checar(f2["thc"] == "Alto em THC", f"junta rótulo e valor (achou {f2['thc']!r})")
checar(any("Relaxante" in d for d in f2["detalhes"]), "traz os efeitos")
checar(f2["foto_url"] and "La%20Kush%20Cake" in f2["foto_url"], "foto com espaço no nome vira URL válida")

print("\nlista vazia")
vazia = Z.extrair_produtos("<body><div class='produtos-container'></div></body></html>")
checar(vazia == [], "página sem produto ativo devolve lista vazia, não erro")
so_comentado = Z.extrair_produtos(
    '<body><!-- <div class="produto"><h2>X</h2><p class="preco">R$1,00/g</p></div> --></body></html>'
)
checar(so_comentado == [], "página com tudo comentado devolve vazio")

print()
if falhas:
    print(f"{len(falhas)} teste(s) falharam:")
    for x in falhas:
        print(f"  - {x}")
    sys.exit(1)
print("todos os testes passaram")
