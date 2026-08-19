#!/usr/bin/env python3
"""Leitura do catálogo da Zeleno (https://catalogoassociativo.zelenomeds.com).

Nada a ver com a ABECMED: aqui não há bot, sessão nem CPF. São páginas HTML
estáticas — `flores1.html`, `extratos1.html`, `óleos1.html` — e cada produto é
um `<div class="produto">`.

O detalhe que decide tudo: **produto fora de estoque não é removido da página,
é comentado**. Os arquivos trazem 122 flores e 27 extratos, dos quais um de
cada estava ativo quando isto foi escrito. Um parser ingênuo leria os 149 e
diria que está tudo disponível; por isso o primeiro passo é apagar os
comentários HTML e só então procurar produto.

É também o que torna esta fonte interessante de monitorar: a volta de um
produto ao estoque é literalmente alguém descomentando um bloco.
"""

import re
import urllib.parse
import urllib.request

BASE = "https://catalogoassociativo.zelenomeds.com"
UA = "abecmed-catalog-monitor/1.0 (paciente associado; verificacao de disponibilidade)"

PAGINAS = {
    "zeleno_flores": "flores1.html",
    "zeleno_extratos": "extratos1.html",
    "zeleno_oleos": "%C3%B3leos1.html",  # óleos1.html
}


class ErroZeleno(RuntimeError):
    pass


def baixar(caminho, tentativas=3):
    url = caminho if caminho.startswith("http") else f"{BASE}/{caminho}"
    ultimo = None
    for n in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            ultimo = f"{type(e).__name__}: {e}"
    raise ErroZeleno(f"não consegui baixar {caminho} — {ultimo}")


def _sem_comentarios(html):
    """Tira os blocos comentados: é neles que mora o que está fora de estoque."""
    corpo = re.search(r"<body.*?</html>", html, re.S)
    corpo = corpo.group(0) if corpo else html
    return re.sub(r"<!--.*?-->", "", corpo, flags=re.S)


def _texto(html):
    """HTML -> linhas de texto, uma por elemento."""
    s = re.sub(r"<(script|style).*?</\1>", " ", html, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", "\n", s)
    s = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&#39;", "'")
    return [l.strip() for l in s.splitlines() if l.strip()]


def preco_e_unidade(bruto):
    """'R$93,00/g' -> (93.0, '/g') ; 'R$ 490,00' -> (490.0, '')"""
    m = re.search(r"R\$\s*([0-9][0-9.,]*)", bruto)
    if not m:
        return None, ""
    s = m.group(1)
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    unidade = "/g" if re.search(r"/\s*g\b", bruto) else ""
    return round(float(s), 2), unidade


def extrair_produtos(html):
    """Só os produtos ativos, na ordem em que a página os mostra."""
    ativo = _sem_comentarios(html)
    produtos = []
    for bloco in re.split(r'<div class="produto">', ativo)[1:]:
        nome = re.search(r"<h2>(.*?)</h2>", bloco, re.S)
        if not nome:
            continue
        nome = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", nome.group(1))).strip()
        if not nome:
            continue
        bruto_preco = re.search(r'class="preco"[^>]*>(.*?)<', bloco, re.S)
        preco, unidade = preco_e_unidade(bruto_preco.group(1) if bruto_preco else "")
        if preco is None:
            continue
        genetica = re.search(r'class="genetica"[^>]*>(.*?)<', bloco, re.S)
        link = re.search(r'href="([^"]+)"[^>]*class="botao-saiba-mais"', bloco)
        # 'selo[^"]*' casava primeiro com o contêiner class="selos", cujo
        # conteúdo imediato é outra tag — o selo vinha sempre vazio.
        selo = re.search(r'class="selo(?:[ -][^"]*)?"[^>]*>(.*?)<', bloco, re.S)
        produtos.append(
            {
                "nome": nome,
                "preco": preco,
                "por": unidade,
                "categoria": (genetica.group(1).strip() if genetica else None) or None,
                "link": link.group(1) if link else None,
                "selo": (selo.group(1).strip() or None) if selo else None,
            }
        )
    produtos.sort(key=lambda p: p["nome"].lower())
    return produtos


def extrair_ficha(html):
    """Lê THC, genética, efeitos e sabor da página do produto.

    Devolve no mesmo formato da ficha da ABECMED (thc / detalhes / foto_url)
    para que a comparação, a exibição e a sugestão por atividade não precisem
    saber de qual associação veio o produto.
    """
    corpo = re.search(r"<body.*?</html>", html, re.S)
    corpo = corpo.group(0) if corpo else html
    linhas = _texto(corpo)

    def depois_de(rotulo, quantos=1):
        for i, l in enumerate(linhas):
            if re.fullmatch(rotulo, l, re.I):
                return [x for x in linhas[i + 1 : i + 1 + quantos]]
        return []

    # A concentração vem em duas formas: numérica ("20,5%" seguido de "THC") ou
    # qualitativa ("Alto em" seguido de "THC"). Exigir número descartava a
    # segunda e o produto ficava sem informação nenhuma.
    thc = None
    conc = depois_de(r"concentra[çc][ãa]o", 2)
    if conc:
        valor = re.sub(r"\s+", " ", conc[0]).strip()
        if re.search(r"\d", valor):
            thc = valor
        elif len(conc) > 1 and len(valor) <= 30:
            thc = f"{valor} {conc[1].strip()}".strip()

    detalhes = []
    for rotulo, titulo in ((r"gen[ée]tica", "Genética"), (r"efeitos", "Efeitos"), (r"sabor", "Sabor")):
        v = depois_de(rotulo)
        if v and not re.fullmatch(r"(gen[ée]tica|efeitos|sabor|concentra[çc][ãa]o)", v[0], re.I):
            detalhes.append(f"{titulo}: {v[0]}")

    # A primeira <img> da página é sempre o logo; a foto do produto é a
    # seguinte. Pegar a primeira devolvia o logo para todo mundo.
    foto = None
    for m in re.finditer(r'<img[^>]+src="([^"]+)"', corpo):
        src = m.group(1)
        if re.search(r"cannabis-01|logo|icon|favicon", src, re.I):
            continue
        foto = src if src.startswith("http") else f"{BASE}/{urllib.parse.quote(src)}"
        break

    return {"thc": thc, "detalhes": detalhes, "foto_url": foto}


def consultar():
    """Uma leitura das três páginas. Devolve as seções já no formato do monitor."""
    secoes = {}
    for chave, pagina in PAGINAS.items():
        produtos = extrair_produtos(baixar(pagina))
        secoes[chave] = {"disponivel": bool(produtos), "limite": None, "produtos": produtos}
    return secoes


def ler_fichas(pedidos):
    """Baixa a ficha dos produtos pedidos: [(link, nome), ...]."""
    fichas = {}
    for link, nome in pedidos:
        if not link:
            continue
        try:
            fichas[nome.lower()] = extrair_ficha(baixar(urllib.parse.quote(link, safe="/:%")))
        except ErroZeleno as e:
            print(f"AVISO: ficha Zeleno de {nome!r}: {e}")
    return fichas
