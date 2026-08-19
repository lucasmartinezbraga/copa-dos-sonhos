#!/usr/bin/env python3
"""Monitor de catálogo de associações de cannabis medicinal.

Duas fontes, bem diferentes entre si:

  ABECMED (bot.abecmed.com.br) — Typebot, exige CPF, descrito abaixo.
  Zeleno  (catalogoassociativo.zelenomeds.com) — páginas estáticas, sem
          login; a leitura está em `zeleno.py`.

O que as junta é `SECOES`: cada seção declara sua fonte, e comparação,
exibição, histórico e sugestão percorrem esse dicionário em vez de nomes
fixos. Somar uma associação nova é acrescentar linhas lá.

O assistente da ABECMED em https://bot.abecmed.com.br é um Typebot. O widget do
navegador conversa com o servidor por uma API JSON pública, e é essa API que
usamos aqui — nada de Playwright. A diferença é grande: uma verificação leva
~5 segundos em vez de ~60, não precisa de Chromium instalado no runner e não
quebra quando o CSS ou o rótulo de um botão muda de lugar.

Fluxo que este script percorre (mapeado contra o site real em 18/08/2026):

    startChat                        -> "Sou Paciente"
    "Por favor, informe seu CPF"     -> CPF (vem de ABECMED_CPF, nunca do código)
    aviso sobre validade da receita  -> "Estou ciente"
    menu do paciente                 -> "Quero adquirir flores!"   -> lista
                                     -> "VOLTAR"
                                     -> "Quero adquirir concentrados!"
    aviso sobre etiqueta             -> "Estou ciente!"            -> lista

O script para na listagem. Ele nunca escolhe quantidade nem confirma pedido:
`INTENCOES_PERMITIDAS` é uma allowlist e qualquer botão fora dela faz o script
abortar em vez de clicar em algo desconhecido. Isso é deliberado — um clique
errado aqui viraria um pedido real no nome do paciente.

Uso:
    ABECMED_CPF=... python3 monitor.py                 # verifica e notifica se mudou
    ABECMED_CPF=... python3 monitor.py --forcar        # notifica mesmo sem mudança
    ABECMED_CPF=... python3 monitor.py --sem-estado    # só imprime o catálogo
"""

import argparse
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import zeleno

BASE = "https://bot.abecmed.com.br"
PUBLIC_ID = "pix-pagamento"
AQUI = Path(__file__).resolve().parent
ESTADO = AQUI / "state.json"

# Fuso de Brasília. zoneinfo existe no runner do GitHub, mas se a tzdata faltar
# o -03:00 fixo entrega a mesma hora para o que interessa aqui.
try:
    from zoneinfo import ZoneInfo

    TZ = ZoneInfo("America/Sao_Paulo")
except Exception:  # pragma: no cover - depende da imagem do runner
    TZ = timezone(timedelta(hours=-3))

# Allowlist de navegação. Cada entrada é (intenção, regex do rótulo do botão).
# Só clicamos em botões que casem com uma destas — ver docstring do módulo.
INTENCOES_PERMITIDAS = {
    "paciente": re.compile(r"^\s*sou\s+paciente", re.I),
    "ciente": re.compile(r"estou\s+ciente", re.I),
    "flores": re.compile(r"adquirir\s+flores", re.I),
    "concentrados": re.compile(r"adquirir\s+concentrados", re.I),
    "voltar": re.compile(r"^\s*voltar\s*$", re.I),
}

# Cada seção declara de qual associação vem. O resto do código percorre este
# dicionário em vez de nomes fixos, então acrescentar uma fonte nova é
# acrescentar linhas aqui — não sair caçando laços espalhados.
SECOES = {
    "flores": {
        "fonte": "abecmed",
        "intencao": "flores",
        "titulo": "🌿 Flores · ABECMED",
        "limite_rx": r"limite mensal para flores[^.]*",
    },
    "concentrados": {
        "fonte": "abecmed",
        "intencao": "concentrados",
        "titulo": "🍯 Concentrados · ABECMED",
        "limite_rx": r"limite mensal para concentrados[^.]*",
    },
    "zeleno_flores": {"fonte": "zeleno", "titulo": "🌿 Flores · Zeleno"},
    "zeleno_extratos": {"fonte": "zeleno", "titulo": "🧪 Extratos · Zeleno"},
    "zeleno_oleos": {"fonte": "zeleno", "titulo": "💧 Óleos · Zeleno"},
}

SECOES_ABECMED = [k for k, v in SECOES.items() if v["fonte"] == "abecmed"]


class ErroDeFluxo(RuntimeError):
    """O bot respondeu algo que não sabemos navegar com segurança."""


# ---------------------------------------------------------------- HTTP


def _post(url, payload, tentativas=3):
    """POST JSON com backoff. A API do Typebot dá 5xx esporádico."""
    ultimo = None
    for n in range(tentativas):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    # Identificação honesta: é um monitor, não um navegador.
                    "User-Agent": "abecmed-catalog-monitor/1.0 (paciente associado; verificacao de disponibilidade)",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            corpo = e.read().decode("utf-8", "replace")[:300]
            ultimo = f"HTTP {e.code}: {corpo}"
            if e.code < 500 and e.code != 429:
                break  # erro nosso, repetir não adianta
        except Exception as e:  # rede, DNS, timeout
            ultimo = f"{type(e).__name__}: {e}"
        if n < tentativas - 1:
            time.sleep((2 ** n) + random.uniform(0, 0.6))
    raise ErroDeFluxo(f"falha ao chamar {url.rsplit('/', 1)[-1]} — {ultimo}")


# ------------------------------------------------------- leitura das mensagens


def _rich_para_texto(no):
    """Achata o richText do Typebot (árvore estilo Slate) em texto puro."""
    if isinstance(no, str):
        return no
    if isinstance(no, list):
        return "".join(_rich_para_texto(x) for x in no)
    if isinstance(no, dict):
        if "text" in no and "children" not in no:
            return no["text"]
        dentro = _rich_para_texto(no.get("children", []))
        if no.get("type") in ("p", "li", "h1", "h2", "h3", "blockquote"):
            return dentro + "\n"
        return dentro
    return ""


def texto_das_mensagens(data):
    partes = []
    for m in data.get("messages", []) or []:
        c = m.get("content") or {}
        if m.get("type") == "text":
            partes.append(_rich_para_texto(c["richText"]) if "richText" in c else (c.get("plainText") or ""))
    return "\n".join(partes)


def foto_das_mensagens(data):
    """URL da imagem da ficha. Flores vêm como 'image', concentrados como
    'embed' — o mesmo dado em dois tipos de bloco."""
    for m in data.get("messages", []) or []:
        if m.get("type") in ("image", "embed", "video"):
            url = (m.get("content") or {}).get("url")
            if url:
                return url
    return None


def botoes(data):
    inp = data.get("input") or {}
    return [str(i.get("content", "")) for i in (inp.get("items") or [])]


def tipo_de_entrada(data):
    return ((data.get("input") or {}).get("type") or "")


def achar_botao(data, intencao):
    rx = INTENCOES_PERMITIDAS[intencao]
    for rotulo in botoes(data):
        if rx.search(rotulo):
            return rotulo
    return None


# ---------------------------------------------------------------- sessão


class Sessao:
    def __init__(self):
        self.id = None
        self.ultimo_texto = ""

    def iniciar(self):
        data = _post(f"{BASE}/api/v1/typebots/{PUBLIC_ID}/startChat", {"isStreamEnabled": False})
        self.id = data.get("sessionId")
        if not self.id:
            raise ErroDeFluxo("startChat não devolveu sessionId")
        self.ultimo_texto = texto_das_mensagens(data)
        return data

    def responder(self, mensagem):
        data = _post(f"{BASE}/api/v1/sessions/{self.id}/continueChat", {"message": mensagem})
        self.ultimo_texto = texto_das_mensagens(data)
        return data

    def clicar(self, data, intencao):
        rotulo = achar_botao(data, intencao)
        if rotulo is None:
            raise ErroDeFluxo(
                f"botão '{intencao}' não apareceu (opções: {botoes(data) or 'nenhuma'})"
            )
        return self.responder(rotulo)


# ---------------------------------------------------------------- parsing

RX_CATEGORIA = re.compile(r"^\s*(THC|CBD|CBG)\s*:\s*$", re.I)
# "Velvet Runtz (indoor) - R$ 85.00" / "Extrato Live Rosin – R$ 350,00"
RX_PRODUTO = re.compile(r"^\s*[•●·*]?\s*(.{2,90}?)\s*[-–—]\s*R\$\s*([0-9][0-9.,]*)\s*$", re.I)
RX_SEM_DISPONIBILIDADE = re.compile(r"sem\s+disponibilidade|no\s+momento\s+n[ãa]o\s+(?:temos|h[áa])|indispon[íi]vel", re.I)


def para_reais(bruto):
    """'85.00' -> 85.0 ; '1.234,56' -> 1234.56 ; '90,00' -> 90.0"""
    s = bruto.strip().replace(" ", "")
    if "," in s and "." in s:
        # o separador decimal é o que aparece por último
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(".", "").replace(",", ".")
    return round(float(s), 2)


def extrair_produtos(texto):
    """Lê 'CATEGORIA:' seguida de linhas 'Nome - R$ preço'."""
    categoria = None
    produtos, vistos = [], set()
    for linha in texto.splitlines():
        m = RX_CATEGORIA.match(linha)
        if m:
            categoria = m.group(1).upper()
            continue
        m = RX_PRODUTO.match(linha)
        if not m:
            continue
        nome = re.sub(r"\s+", " ", m.group(1)).strip()
        # linhas de aviso que por acaso tenham um "R$" no meio
        if re.search(r"limite mensal|total pode|valores s[ãa]o|deseja adquirir", nome, re.I):
            continue
        chave = (nome.lower(), categoria)
        if chave in vistos:
            continue
        vistos.add(chave)
        produtos.append({"nome": nome, "preco": para_reais(m.group(2)), "categoria": categoria})
    produtos.sort(key=lambda p: (p["categoria"] or "", p["nome"].lower()))
    return produtos


RX_THC = re.compile(r"THC\s*:\s*([^\n]+)", re.I)
RX_CATEGORIA_BOTAO = re.compile(r"^\s*(THC|CBD|CBG)\s*$", re.I)


def extrair_ficha(texto, foto):
    """Lê a ficha do produto.

    Flores trazem 'Genética: ... - THC: até 15%' e uma linha de terpenos;
    concentrados trazem só 'THC: 74%'. O mesmo regex serve para os dois porque
    o THC aparece rotulado nos dois formatos.
    """
    thc = None
    m = RX_THC.search(texto)
    if m:
        thc = re.sub(r"\s+", " ", m.group(1)).strip(" -–—.")
    detalhes = [
        re.sub(r"\s+", " ", l).strip()
        for l in texto.splitlines()
        if re.match(r"\s*(gen[ée]tica|terpenos)", l, re.I)
    ]
    return {"thc": thc, "detalhes": detalhes, "foto_url": foto}


def extrair_limite(texto, rx):
    m = re.search(rx, texto, re.I)
    if not m:
        return None
    return re.sub(r"\s+", " ", m.group(0)).strip()


# ---------------------------------------------------------------- navegação


def ir_ate_o_menu(sessao, cpf):
    """startChat -> Sou Paciente -> CPF -> avisos -> menu do paciente."""
    data = sessao.iniciar()
    for _ in range(12):
        if achar_botao(data, "flores"):
            return data  # chegamos ao menu do paciente

        tipo = tipo_de_entrada(data)
        if tipo == "text input":
            if not re.search(r"CPF", sessao.ultimo_texto, re.I):
                raise ErroDeFluxo(f"campo de texto inesperado: {sessao.ultimo_texto[:160]!r}")
            data = sessao.responder(cpf)
            texto = sessao.ultimo_texto
            if re.search(r"n[ãa]o (?:foi )?(?:encontrado|localizado)|inv[áa]lido|n[ãa]o consta", texto, re.I):
                raise ErroDeFluxo(f"a ABECMED não aceitou o CPF: {texto[:200]!r}")
            continue

        for intencao in ("paciente", "ciente"):
            if achar_botao(data, intencao):
                data = sessao.clicar(data, intencao)
                break
        else:
            raise ErroDeFluxo(
                f"não sei seguir daqui (botões: {botoes(data) or 'nenhum'}; texto: {sessao.ultimo_texto[:160]!r})"
            )
    raise ErroDeFluxo("o menu do paciente não apareceu depois de 12 passos")


def ler_secao(sessao, data, chave):
    """Abre flores/concentrados, atravessa avisos e devolve a listagem."""
    cfg = SECOES[chave]
    data = sessao.clicar(data, cfg["intencao"])
    acumulado = sessao.ultimo_texto

    # Concentrados abre com um aviso ("erro de impressão na etiqueta"); flores
    # não. Em vez de fixar a diferença, atravessamos qualquer "Estou ciente".
    for _ in range(4):
        if achar_botao(data, "voltar") or RX_SEM_DISPONIBILIDADE.search(acumulado):
            break
        if achar_botao(data, "ciente"):
            data = sessao.clicar(data, "ciente")
            acumulado += "\n" + sessao.ultimo_texto
            continue
        break

    produtos = extrair_produtos(acumulado)
    secao = {
        "disponivel": bool(produtos),
        "limite": extrair_limite(acumulado, cfg["limite_rx"]),
        "produtos": produtos,
    }
    return data, secao


def consultar(cpf):
    """Uma verificação completa: flores + concentrados."""
    sessao = Sessao()
    menu = ir_ate_o_menu(sessao, cpf)

    data, flores = ler_secao(sessao, menu, "flores")

    # Voltar ao menu para a segunda seção. Se o VOLTAR sumir, refazemos a
    # sessão do zero — é mais lento, mas nunca clica em algo não previsto.
    if achar_botao(data, "voltar"):
        data = sessao.clicar(data, "voltar")
    if not achar_botao(data, "concentrados"):
        sessao = Sessao()
        data = ir_ate_o_menu(sessao, cpf)

    _, concentrados = ler_secao(sessao, data, "concentrados")

    catalogo = {"flores": flores, "concentrados": concentrados}

    # A Zeleno é site estático e não depende de sessão nem de CPF. Se ela cair,
    # a ABECMED — que é a fonte principal e a que exige login — não pode cair
    # junto: o catálogo dela já está lido a esta altura.
    try:
        catalogo.update(zeleno.consultar())
    except zeleno.ErroZeleno as e:
        print(f"AVISO: Zeleno indisponível: {e}", file=sys.stderr)

    return catalogo


def ler_ficha(sessao, data, categoria, nome):
    """Da lista ([CATEGORIA, VOLTAR]) abre a ficha do produto e volta para a lista.

    A ficha é o único ponto de todo o fluxo onde aparece um botão "Continuar" —
    o caminho que leva a montar pedido. A saída daqui é sempre pelo "Voltar", e
    se o "Voltar" não estiver lá a consulta aborta em vez de improvisar.
    """
    if not RX_CATEGORIA_BOTAO.match(categoria or "") or categoria not in botoes(data):
        return data, None

    data = sessao.responder(categoria)
    disponiveis = botoes(data)
    if not disponiveis:
        raise ErroDeFluxo(f"a categoria {categoria!r} não listou produtos")

    if nome not in disponiveis:
        # O produto saiu do ar entre a listagem e agora. Aqui não existe botão
        # de voltar: abrir uma ficha qualquer (que é só leitura) é o jeito de
        # recuperar o "Voltar" e seguir sem derrubar a sessão.
        data = sessao.responder(disponiveis[0])
        if achar_botao(data, "voltar"):
            data = sessao.clicar(data, "voltar")
        return data, None

    data = sessao.responder(nome)
    ficha = extrair_ficha(sessao.ultimo_texto, foto_das_mensagens(data))
    if not achar_botao(data, "voltar"):
        raise ErroDeFluxo(f"a ficha de {nome!r} não ofereceu 'Voltar' (botões: {botoes(data)})")
    data = sessao.clicar(data, "voltar")
    return data, ficha


def enriquecer(cpf, pedidos, limite=6):
    """Busca THC, genética, terpenos e foto dos produtos indicados.

    Roda em sessão própria e depois da listagem, de propósito: o catálogo já
    está capturado quando isto começa, então qualquer problema aqui não derruba
    a verificação — no pior caso o produto fica sem ficha e tenta de novo
    depois.

    Cada ficha custa três idas ao servidor, então isto só roda para produto que
    ainda não está em cache, com teto por rodada. Em regime normal não roda.
    """
    fichas = {}
    if not any(pedidos.values()):
        return fichas

    sessao = Sessao()
    data = ir_ate_o_menu(sessao, cpf)
    restantes = limite

    for chave in SECOES_ABECMED:
        alvos = pedidos.get(chave) or []
        if not alvos or restantes <= 0:
            continue
        data, _ = ler_secao(sessao, data, chave)
        for categoria, nome in alvos:
            if restantes <= 0:
                break
            data, ficha = ler_ficha(sessao, data, categoria, nome)
            restantes -= 1
            if ficha:
                fichas[nome.lower()] = ficha
        if chave == "flores" and achar_botao(data, "voltar"):
            data = sessao.clicar(data, "voltar")

    return fichas


def fichas_faltando(catalogo, cache):
    """Produtos sem ficha guardada, separados por fonte.

    Cada associação entrega ficha de um jeito: na ABECMED é navegar o bot, na
    Zeleno é baixar a página do produto. Quem chama decide o que fazer com cada
    grupo — aqui só se responde "quem ainda falta".
    """
    pedidos = {"abecmed": {}, "zeleno": []}
    for chave, cfg in SECOES.items():
        for p in (catalogo.get(chave) or {}).get("produtos") or []:
            if p["nome"].lower() in cache:
                continue
            if cfg["fonte"] == "abecmed":
                pedidos["abecmed"].setdefault(chave, []).append((p.get("categoria") or "THC", p["nome"]))
            else:
                pedidos["zeleno"].append((p.get("link"), p["nome"]))
    return pedidos


# ---------------------------------------------------------------- comparação


def registrar_historico(estado, catalogo, agora, teto=800):
    """Anota o preço de cada produto sempre que ele muda.

    Só o preço novo entra: repetir a cada 5 minutos o mesmo valor encheria o
    arquivo e faria o workflow commitar sem parar. Isto é a matéria-prima do
    gráfico de preços — sem registrar agora, o passado não volta.
    """
    hist = estado.setdefault("historico", [])
    ultimo = {}
    for e in hist:
        ultimo[e["produto"]] = e["preco"]
    for chave in SECOES:
        for p in (catalogo.get(chave) or {}).get("produtos") or []:
            if ultimo.get(p["nome"]) != p["preco"]:
                hist.append(
                    {
                        "quando": agora.strftime("%Y-%m-%d %H:%M"),
                        "produto": p["nome"],
                        "preco": p["preco"],
                    }
                )
    if len(hist) > teto:
        del hist[:-teto]
    return hist


def _mapa(secao):
    return {(p["nome"].lower(), p.get("categoria")): p for p in secao.get("produtos", [])}


def comparar(antigo, novo):
    """Lista legível do que mudou entre duas consultas."""
    mudancas = []
    for chave in SECOES:
        titulo = SECOES[chave]["titulo"]
        a, n = antigo.get(chave) or {}, novo.get(chave) or {}
        ma, mn = _mapa(a), _mapa(n)

        for k in sorted(mn.keys() - ma.keys()):
            p = mn[k]
            mudancas.append(f"🆕 {titulo} — {p['nome']}: {preco_txt(p)}")
        for k in sorted(ma.keys() - mn.keys()):
            mudancas.append(f"❌ {titulo} — {ma[k]['nome']} saiu do catálogo")
        for k in sorted(mn.keys() & ma.keys()):
            if mn[k]["preco"] != ma[k]["preco"]:
                mudancas.append(
                    f"💰 {titulo} — {mn[k]['nome']}: {preco_txt(ma[k])} → {preco_txt(mn[k])}"
                )

        if a and bool(a.get("disponivel")) != bool(n.get("disponivel")):
            mudancas.append(
                f"{titulo}: {'voltou a ter disponibilidade' if n.get('disponivel') else 'ficou indisponível'}"
            )
        if a.get("limite") and n.get("limite") and a["limite"] != n["limite"]:
            mudancas.append(f"ℹ️ {titulo} — {n['limite']}")
    return mudancas


# ---------------------------------------------------------------- formatação


def reais(v):
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def preco_txt(produto):
    """Preço com a unidade junto.

    A Zeleno cobra por grama e a ABECMED por unidade. Mostrar "R$ 93,00" para
    algo que custa R$ 93,00/g com mínimo de 5 g não é um detalhe de formatação:
    é informar o preço errado por um fator de cinco.
    """
    return f"{reais(produto['preco'])}{produto.get('por') or ''}"


def escapar(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_catalogo(catalogo, fichas=None):
    fichas = fichas or {}
    linhas = []
    for chave in SECOES:
        # Só o que veio no catálogo recebido. Isso é o que permite pedir só uma
        # associação: sem esta linha, o recorte da Zeleno vinha acompanhado das
        # seções da ABECMED anunciadas como indisponíveis.
        if chave not in (catalogo or {}):
            continue
        sec = catalogo.get(chave) or {}
        titulo = SECOES[chave]["titulo"]
        limite = f" — {sec['limite']}" if sec.get("limite") else ""
        linhas.append(f"<b>{escapar(titulo)} disponíveis</b>{escapar(limite)}")
        produtos = sec.get("produtos") or []
        if not produtos:
            linhas.append("• sem disponibilidade no momento")
        else:
            atual = object()
            for p in produtos:
                if p.get("categoria") != atual:
                    atual = p.get("categoria")
                    if atual:
                        linhas.append(f"<i>{escapar(atual)}</i>")
                thc = (fichas.get(p["nome"].lower()) or {}).get("thc")
                # Alguns valores já vêm com a sigla ("Alto em THC", "216mg THC");
                # prefixar de novo produzia "THC Alto em THC".
                rotulo = thc if (thc and "thc" in thc.lower()) else (f"THC {thc}" if thc else "")
                selo = f"  <i>{escapar(rotulo)}</i>" if rotulo else ""
                linhas.append(f"• {escapar(p['nome'])} — {escapar(preco_txt(p))}{selo}")
        linhas.append("")
    return "\n".join(linhas).strip()


def render_mensagem(mudancas, catalogo, agora, fichas=None):
    cab = "🚨 <b>ABECMED — o catálogo mudou</b>" if mudancas else "✅ <b>ABECMED — sem mudanças</b>"
    partes = [cab, f"🕐 {agora.strftime('%d/%m/%Y %H:%M')} (Brasília)", ""]
    if mudancas:
        partes.append("<b>O que mudou</b>")
        partes += [escapar(m) for m in mudancas]
        partes.append("")
    partes.append(render_catalogo(catalogo, fichas))
    texto = "\n".join(partes)
    return texto[:4000]  # limite do Telegram, com folga


# ---------------------------------------------------------------- notificação


# Um botão por associação. A versão anterior tinha "Ver catálogo agora" e
# "Fotos e THC" separados, e nenhum dos dois dizia de qual associação era —
# quem toca quer ver o catálogo de um lugar, não escolher entre lista e foto.
BOTAO_ABECMED = "🌿 ABECMED"
BOTAO_ZELENO = "🏪 Zeleno"
BOTAO_GUIA = "💡 O que usar hoje?"
BOTAO_STATUS = "📊 Status"

# Teclado fixo na conversa: os botões só mandam esse texto de volta, e a
# execução seguinte responde. É o mais perto de "rodar sob demanda" que dá para
# fazer sem manter um servidor ligado ouvindo o Telegram.
TECLADO = {
    "keyboard": [
        [{"text": BOTAO_ABECMED}, {"text": BOTAO_ZELENO}],
        [{"text": BOTAO_GUIA}],
        [{"text": BOTAO_STATUS}],
    ],
    "resize_keyboard": True,
    "is_persistent": True,
}

AJUDA = (
    "❓ <b>Como isto funciona</b>\n\n"
    "Eu consulto o catálogo da ABECMED de 5 em 5 minutos, comparo com a consulta "
    "anterior e só te chamo quando alguma coisa muda: produto novo, produto que "
    "saiu, preço alterado ou seção que ficou sem estoque.\n\n"
    "Roda no GitHub Actions — seu celular e seu computador podem ficar desligados.\n\n"
    f"<b>{BOTAO_ABECMED}</b> e <b>{BOTAO_ZELENO}</b> — o catálogo daquela "
    "associação: a lista com preço e THC, e depois a foto de cada produto.\n"
    f"<b>{BOTAO_GUIA}</b> — sugere o que combina com cada atividade.\n"
    f"<b>{BOTAO_STATUS}</b> — diz se está tudo funcionando.\n\n"
    "Pode escrever o que vai fazer — <i>“vou treinar”</i>, <i>“preciso dormir”</i>, "
    "<i>“dor nas costas”</i> — que eu comparo com os terpenos da ficha e respondo.\n\n"
    "Não existe um servidor ouvindo o tempo todo (isso custaria dinheiro), então "
    "o toque no botão é atendido na próxima verificação: até ~5 minutos.\n"
    "Para uma consulta na hora, use <b>Run workflow</b> em\n"
    "github.com/lucasmartinezbraga/copa-dos-sonhos/actions"
)


def enviar_telegram(token, chat, texto):
    _post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        {
            "chat_id": chat,
            "text": texto,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
            "reply_markup": TECLADO,
        },
    )


# ------------------------------------------------- recomendação por atividade
#
# Isto não é um modelo de linguagem: é um casamento entre o que a pessoa quer
# fazer e o que a própria ABECMED publica na ficha de cada produto — terpenos,
# proporção índica/sativa e teor de THC. A vantagem de não usar LLM aqui não é
# só o custo: a resposta sai sempre do dado real da ficha, então não tem como
# inventar um terpeno que o produto não tem.
#
# As associações entre terpeno e efeito são as descritas na literatura de
# cannabis e são GERAIS. Não é orientação médica, e toda resposta diz isso.

PERFIS = {
    "dormir": {
        "rotulo": "🛏️ Dormir e descansar",
        "chaves": ("dormir", "sono", "insonia", "insônia", "noite", "descansar", "relaxar"),
        "terpenos": {"mirceno": 3, "linalol": 3, "cariofileno": 1, "humuleno": 1},
        "indica": 5.0,
        "thc": "alto",
    },
    "foco": {
        "rotulo": "💼 Trabalhar e concentrar",
        "chaves": ("trabalh", "foco", "concentr", "estudar", "estudo", "produtiv", "reunião", "reuniao"),
        "terpenos": {"pineno": 3, "limoneno": 2, "terpinoleno": 1},
        "sativa": 5.0,
        "thc": "baixo",
    },
    "disposicao": {
        "rotulo": "🏃 Exercício e disposição",
        "chaves": ("exerc", "treino", "treinar", "corr", "academia", "esporte", "caminhada", "disposi", "energia"),
        "terpenos": {"limoneno": 3, "pineno": 2, "ocimeno": 2},
        "sativa": 5.0,
        "thc": "baixo",
    },
    "criatividade": {
        "rotulo": "🎨 Criatividade e lazer",
        "chaves": ("criativ", "criar", "arte", "música", "musica", "escrever", "lazer", "passear", "diversão", "diversao"),
        "terpenos": {"terpinoleno": 3, "limoneno": 3, "pineno": 1},
        "sativa": 3.0,
        "thc": None,
    },
    "corpo": {
        "rotulo": "🌿 Alívio no corpo",
        "chaves": ("dor", "corpo", "muscul", "inflama", "tensão", "tensao", "cólica", "colica"),
        "terpenos": {"cariofileno": 3, "mirceno": 3, "humuleno": 2},
        "indica": 3.0,
        "thc": "alto",
    },
    "calma": {
        "rotulo": "😌 Acalmar a cabeça",
        "chaves": ("ansiedade", "ansios", "acalmar", "calma", "estresse", "estress", "nervos"),
        "terpenos": {"linalol": 3, "cariofileno": 3, "mirceno": 1},
        "indica": 2.5,
        "thc": "baixo",
    },
}

# A Zeleno publica "Efeitos" explicitamente — a ABECMED não. Onde existe, é o
# sinal mais direto que há: é a própria associação dizendo para que serve.
EFEITOS = {
    "sedativ": {"dormir": 4},
    "relaxante": {"dormir": 3, "calma": 3, "corpo": 2},
    "calmante": {"calma": 3, "dormir": 2},
    "analg": {"corpo": 4},
    "criativ": {"criatividade": 4},
    "eufóric": {"disposicao": 3, "criatividade": 2},
    "euforic": {"disposicao": 3, "criatividade": 2},
    "empolgante": {"disposicao": 3, "criatividade": 2},
    "energ": {"disposicao": 4},
    "estimulante": {"disposicao": 3, "foco": 2},
    "focad": {"foco": 4},
    "concentra": {"foco": 3},
}

for _chave, _perfil in PERFIS.items():
    _perfil["chave"] = _chave

RX_PROPORCAO = re.compile(r"(\d{1,3})\s*%\s*(sativa|[íi]ndica)\s*/\s*(\d{1,3})\s*%\s*(sativa|[íi]ndica)", re.I)


def thc_numero(thc):
    """'até 26%' -> 26.0 ; '44,9%' -> 44.9 ; None quando não dá para ler."""
    if not thc:
        return None
    m = re.search(r"(\d+(?:[.,]\d+)?)", str(thc))
    return float(m.group(1).replace(",", ".")) if m else None


def perfil_do_produto(ficha):
    """Extrai da ficha o que serve para recomendar."""
    texto = " ".join(ficha.get("detalhes") or [])
    indica = sativa = None
    m = RX_PROPORCAO.search(texto)
    if m:
        a, ta, b, tb = m.group(1), m.group(2).lower(), m.group(3), m.group(4).lower()
        valores = {("sativa" if t.startswith("sativa") else "indica"): int(v) / 100 for v, t in ((a, ta), (b, tb))}
        indica, sativa = valores.get("indica"), valores.get("sativa")
    elif re.search(r"predomin\w*\s+[íi]ndica", texto, re.I):
        indica, sativa = 0.7, 0.3
    elif re.search(r"predomin\w*\s+sativa", texto, re.I):
        indica, sativa = 0.3, 0.7
    # A Zeleno escreve "Híbrida (+sativa)": inclinação, não predominância forte.
    elif re.search(r"\(\s*\+\s*sativa", texto, re.I):
        indica, sativa = 0.4, 0.6
    elif re.search(r"\(\s*\+\s*[íi]ndica", texto, re.I):
        indica, sativa = 0.6, 0.4

    achados = [t for t in ("mirceno", "limoneno", "pineno", "cariofileno", "linalol",
                           "terpinoleno", "humuleno", "ocimeno")
               if re.search(t, texto, re.I)]
    # Campo a campo, não sobre os detalhes juntados: no texto colado o ".+"
    # atravessava para o campo seguinte e "Eufórico" virava
    # "eufórico sabor: herbal", que não casa com efeito nenhum.
    efeitos = []
    for d in ficha.get("detalhes") or []:
        m = re.match(r"\s*efeitos\s*:\s*(.+)", d, re.I)
        if m:
            efeitos = [e.strip().lower() for e in re.split(r"[,;/]", m.group(1)) if e.strip()]
            break

    return {
        "terpenos": achados,
        "efeitos": efeitos,
        "indica": indica,
        "sativa": sativa,
        "thc": thc_numero(ficha.get("thc")),
    }


def pontuar(perfil, alvo):
    """Nota do produto para uma atividade, mais o porquê em texto."""
    nota, motivos = 0.0, []

    for efeito in perfil.get("efeitos") or []:
        for pedaco, pesos in EFEITOS.items():
            if pedaco in efeito and alvo.get("chave") in pesos:
                nota += pesos[alvo["chave"]]
                motivos.append(efeito.capitalize())
                break

    casados = [t for t in perfil["terpenos"] if t in alvo["terpenos"]]
    for t in casados:
        nota += alvo["terpenos"][t]
    if casados:
        motivos.append(", ".join(t.capitalize() for t in casados))

    if alvo.get("indica") and perfil.get("indica"):
        nota += alvo["indica"] * perfil["indica"]
        if perfil["indica"] >= 0.6:
            motivos.append(f"{round(perfil['indica'] * 100)}% índica")
    if alvo.get("sativa") and perfil.get("sativa"):
        nota += alvo["sativa"] * perfil["sativa"]
        if perfil["sativa"] >= 0.6:
            motivos.append(f"{round(perfil['sativa'] * 100)}% sativa")

    thc = perfil.get("thc")
    if thc is not None and alvo.get("thc"):
        # Concentrado passa de 40%: comparar com flor pela mesma régua não faz
        # sentido, então a régua é relativa à faixa de cada um.
        forte = thc >= 40 or (thc >= 22 and thc < 40)
        if alvo["thc"] == "alto" and forte:
            nota += 1.5
            motivos.append(f"THC {thc:g}%")
        elif alvo["thc"] == "baixo" and not forte:
            nota += 1.5
            motivos.append(f"THC mais leve ({thc:g}%)")
    return nota, motivos


def recomendar(catalogo, fichas, atividade, quantos=2):
    alvo = PERFIS[atividade]
    ranking = []
    for chave in SECOES:
        for p in (catalogo.get(chave) or {}).get("produtos") or []:
            ficha = (fichas or {}).get(p["nome"].lower())
            if not ficha:
                continue
            nota, motivos = pontuar(perfil_do_produto(ficha), alvo)
            if nota > 0:
                ranking.append((nota, p, motivos, chave))
    ranking.sort(key=lambda x: (-x[0], x[1]["nome"]))
    return ranking[:quantos]


def atividade_do_texto(texto):
    t = texto.strip().lower()
    for nome, perfil in PERFIS.items():
        if any(c in t for c in perfil["chaves"]):
            return nome
    return None


AVISO_MEDICO = (
    "<i>Isto compara os terpenos e a proporção que a própria ABECMED publica na "
    "ficha. É informação geral, não orientação médica — quem decide o que e "
    "quanto usar é o seu prescritor.</i>"
)


def render_recomendacao(catalogo, fichas, atividade, agora):
    alvo = PERFIS[atividade]
    itens = recomendar(catalogo, fichas, atividade)
    linhas = [f"<b>{escapar(alvo['rotulo'])}</b>", f"🕐 {agora.strftime('%d/%m %H:%M')}", ""]
    if not itens:
        linhas.append(
            "Ainda não tenho ficha suficiente dos produtos para sugerir. "
            "As fichas são lidas quando o produto aparece no catálogo."
        )
    else:
        for i, (_, p, motivos, _c) in enumerate(itens, 1):
            marca = "🥇" if i == 1 else "🥈"
            linhas.append(f"{marca} <b>{escapar(p['nome'])}</b> — {reais(p['preco'])}")
            if motivos:
                linhas.append(f"    {escapar(' · '.join(motivos))}")
        linhas.append("")
    linhas.append(AVISO_MEDICO)
    return "\n".join(linhas)


def render_guia(catalogo, fichas, agora):
    """Uma sugestão para cada atividade, de uma vez só.

    De propósito tudo numa mensagem: cada ida e volta no Telegram custa até 5
    minutos aqui, então perguntar "para qual atividade?" e esperar a resposta
    levaria dez.
    """
    linhas = ["💡 <b>O que combina com cada atividade</b>", f"🕐 {agora.strftime('%d/%m/%Y %H:%M')}", ""]
    algum = False
    for nome, alvo in PERFIS.items():
        itens = recomendar(catalogo, fichas, nome, quantos=1)
        if not itens:
            continue
        algum = True
        _, p, motivos, _c = itens[0]
        linhas.append(f"{escapar(alvo['rotulo'])}")
        linhas.append(f"→ <b>{escapar(p['nome'])}</b> — {reais(p['preco'])}")
        if motivos:
            linhas.append(f"   <i>{escapar(' · '.join(motivos))}</i>")
        linhas.append("")
    if not algum:
        return (
            "💡 Ainda não tenho as fichas dos produtos para sugerir nada.\n"
            "Elas são lidas quando o produto aparece no catálogo — tente de novo mais tarde."
        )
    linhas.append("Pode também escrever o que vai fazer — <i>“vou treinar”</i>, "
                  "<i>“preciso dormir”</i>, <i>“trabalhar”</i> — que eu respondo com o que combina.")
    linhas.append("")
    linhas.append(AVISO_MEDICO)
    return "\n".join(linhas)


def enviar_foto(token, chat, foto, legenda):
    """Envia a foto do produto e devolve o file_id do Telegram.

    A URL que a ABECMED entrega é assinada e expira em ~40 minutos, então ela
    não serve para guardar. O Telegram, ao receber a foto, devolve um file_id
    permanente: é ele que fica no estado, e a partir do segundo envio a foto
    sai sem tocar no servidor deles.
    """
    r = _post(
        f"https://api.telegram.org/bot{token}/sendPhoto",
        {"chat_id": chat, "photo": foto, "caption": legenda[:1024], "parse_mode": "HTML"},
    )
    tamanhos = ((r.get("result") or {}).get("photo") or [])
    return tamanhos[-1].get("file_id") if tamanhos else None


def legenda_produto(nome, preco, ficha):
    linhas = [f"<b>{escapar(nome)}</b>", escapar(preco) if isinstance(preco, str) else (reais(preco) if preco is not None else "")]
    if ficha.get("thc"):
        linhas.append(f"🧪 THC: {escapar(ficha['thc'])}")
    for d in ficha.get("detalhes") or []:
        linhas.append(escapar(d))
    return "\n".join(l for l in linhas if l)


def secoes_da_fonte(catalogo, fonte):
    """Recorta o catálogo, deixando só as seções de uma associação."""
    return {
        chave: sec
        for chave, sec in (catalogo or {}).items()
        if SECOES.get(chave, {}).get("fonte") == fonte
    }


def achar_produto(catalogo, nome):
    for chave in SECOES:
        for p in (catalogo.get(chave) or {}).get("produtos") or []:
            if p["nome"].lower() == nome.lower():
                return p
    return None


def enviar_fotos(estado, catalogo, nomes):
    """Manda a foto de cada produto pedido. Falha de uma não impede as outras."""
    token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    chat = estado.get("telegram_chat_id") or os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat:
        return 0
    fichas = estado.get("fichas") or {}
    enviadas = 0
    for nome in nomes:
        ficha = fichas.get(nome.lower())
        if not ficha:
            continue
        foto = ficha.get("foto_id") or ficha.get("foto_url")
        if not foto:
            continue
        produto = achar_produto(catalogo, nome)
        try:
            fid = enviar_foto(
                token, chat, foto,
                legenda_produto(nome, preco_txt(produto) if produto else None, ficha),
            )
            if fid:
                ficha["foto_id"] = fid
            enviadas += 1
        except Exception as e:
            print(f"AVISO: foto de {nome!r} não saiu: {e}", file=sys.stderr)
    return enviadas


def garantir_fotos(cpf, estado, catalogo, nomes):
    """Rebusca a ficha de quem ainda não tem file_id, para haver o que enviar."""
    fichas = estado.setdefault("fichas", {})
    alvo = {n.lower() for n in nomes}
    pedidos = {"abecmed": {}, "zeleno": []}
    for chave, cfg in SECOES.items():
        for p in (catalogo.get(chave) or {}).get("produtos") or []:
            f = fichas.get(p["nome"].lower()) or {}
            if p["nome"].lower() not in alvo or f.get("foto_id") or f.get("foto_url"):
                continue
            if cfg["fonte"] == "abecmed":
                pedidos["abecmed"].setdefault(chave, []).append((p.get("categoria") or "THC", p["nome"]))
            else:
                pedidos["zeleno"].append((p.get("link"), p["nome"]))

    if cpf and pedidos["abecmed"]:
        try:
            for nome, ficha in enriquecer(cpf, pedidos["abecmed"], limite=12).items():
                fichas.setdefault(nome, {}).update(ficha)
        except ErroDeFluxo as e:
            print(f"AVISO: não consegui buscar fotos na ABECMED: {e}", file=sys.stderr)
    if pedidos["zeleno"]:
        try:
            for nome, ficha in zeleno.ler_fichas(pedidos["zeleno"]).items():
                fichas.setdefault(nome, {}).update(ficha)
        except Exception as e:
            print(f"AVISO: não consegui buscar fotos na Zeleno: {e}", file=sys.stderr)


def produtos_novos(antigo, novo):
    """Nomes que passaram a existir entre duas consultas."""
    novos = []
    for chave in SECOES:
        antes = {p["nome"].lower() for p in (antigo.get(chave) or {}).get("produtos") or []}
        for p in (novo.get(chave) or {}).get("produtos") or []:
            if p["nome"].lower() not in antes:
                novos.append(p["nome"])
    return novos


def responder_comando(texto, catalogo, estado, agora, ao_vivo):
    """Traduz o que a pessoa mandou na resposta correspondente."""
    t = texto.strip().lower().lstrip("/")

    if t.startswith(("catalogo", "catálogo")):
        if not catalogo:
            return "⚠️ Ainda não tenho um catálogo guardado. Tente de novo no próximo ciclo."
        quando = "consultado agora" if ao_vivo else "última consulta que deu certo"
        return (
            f"📋 <b>Catálogo completo</b>\n"
            f"🕐 {agora.strftime('%d/%m/%Y %H:%M')} (Brasília) — {quando}\n\n"
            + render_catalogo(catalogo, estado.get("fichas"))
        )

    if t.startswith("status") or texto.strip() == BOTAO_STATUS:
        falhas = int(estado.get("falhas_seguidas", 0))
        saude = "✅ funcionando" if falhas == 0 else f"⚠️ {falhas} falha(s) seguida(s)"
        cat = catalogo or {}
        nf = len((cat.get("flores") or {}).get("produtos") or [])
        nc = len((cat.get("concentrados") or {}).get("produtos") or [])
        linhas = [
            "📊 <b>Status do monitor</b>",
            f"🕐 {agora.strftime('%d/%m/%Y %H:%M')} (Brasília)",
            "",
            f"Estado: {saude}",
            f"Verificação: a cada 5 minutos, 24h por dia",
            f"🌿 Flores: {nf} produto(s)",
            f"🍯 Concentrados: {nc} produto(s)",
        ]
        if estado.get("ultima_mudanca_em"):
            linhas.append(f"Última mudança detectada: {estado['ultima_mudanca_em'][:16].replace('T', ' ')}")
        if estado.get("ultima_falha"):
            linhas.append(f"Último erro: {escapar(str(estado['ultima_falha'])[:150])}")
        return "\n".join(linhas)

    if t.startswith("start"):
        return (
            "👋 <b>Pronto, estou de olho!</b>\n\n"
            "A partir de agora eu te aviso sozinho quando o catálogo da ABECMED "
            "mudar — flores, concentrados, preços e disponibilidade.\n\n"
            "Os botões aqui embaixo pedem o catálogo fora de hora. Eles não são "
            "instantâneos: como não há servidor ligado 24h só para me ouvir, "
            "respondo na verificação seguinte — <b>até ~5 minutos</b>."
        )

    if t.startswith(("ajuda", "help")):
        return AJUDA

    if texto.strip() == BOTAO_GUIA or t.startswith(("guia", "sugest", "recomend", "o que usar")):
        return render_guia(catalogo or {}, estado.get("fichas"), agora)

    # Texto livre: "vou treinar", "preciso dormir", "dor nas costas".
    atividade = atividade_do_texto(texto)
    if atividade:
        return render_recomendacao(catalogo or {}, estado.get("fichas"), atividade, agora)

    return None  # mensagem solta: não responde nada


def atender_comandos(estado, catalogo, agora, ao_vivo, cpf=None, espera=0):
    """Lê o que chegou no bot e responde.

    `espera` liga o long polling do Telegram: em vez de perguntar "chegou algo?"
    e voltar na hora, a chamada fica pendurada até `espera` segundos e retorna
    no instante em que a mensagem chega. É o que faz a resposta ser imediata
    sem existir servidor — quem segura a conexão é a execução que já está no ar.

    O offset guardado no estado marca o que já foi atendido, senão a mesma
    mensagem seria respondida para sempre.
    """
    token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    dono = estado.get("telegram_chat_id") or os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not token or not dono:
        return 0

    url = f"https://api.telegram.org/bot{token}/getUpdates?timeout={int(espera)}&limit=20"
    if estado.get("telegram_offset"):
        url += f"&offset={int(estado['telegram_offset'])}"
    try:
        # A leitura tem de sobreviver ao tempo que o Telegram segura a conexão.
        with urllib.request.urlopen(url, timeout=int(espera) + 20) as r:
            data = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 409:
            # O Telegram entrega cada update a um leitor só. 409 significa que
            # outra execução já está escutando este bot — o que é normal na
            # virada de um ciclo para o outro. Quem está no ar responde; este
            # aqui recua em vez de brigar pela fila.
            print("AVISO: outra execução já está escutando o bot (409); recuando.", file=sys.stderr)
        else:
            print(f"AVISO: não consegui ler mensagens do Telegram: {e}", file=sys.stderr)
        return 0
    except Exception as e:
        print(f"AVISO: não consegui ler mensagens do Telegram: {e}", file=sys.stderr)
        return 0

    atendidos = 0
    for upd in data.get("result") or []:
        estado["telegram_offset"] = int(upd["update_id"]) + 1
        msg = upd.get("message") or {}
        texto = msg.get("text") or ""
        chat = str((msg.get("chat") or {}).get("id") or "")
        # O bot é público: qualquer pessoa pode achá-lo e mandar mensagem. Só o
        # dono recebe resposta — os outros são consumidos e ignorados.
        if not texto or chat != str(dono):
            continue

        limpo = texto.strip()
        pedido = limpo.lower().lstrip("/")

        fonte = None
        if limpo == BOTAO_ABECMED or pedido.startswith(("abecmed", "abcmed")):
            fonte = ("abecmed", "🌿", "ABECMED")
        elif limpo == BOTAO_ZELENO or pedido.startswith(("zeleno", "zelano", "zelendo")):
            fonte = ("zeleno", "🏪", "Zeleno")

        if fonte:
            chave_fonte, emoji, nome_fonte = fonte
            secoes = secoes_da_fonte(catalogo, chave_fonte)
            nomes = [p["nome"] for sec in secoes.values() for p in (sec.get("produtos") or [])]
            if not nomes:
                enviar_telegram(
                    token, chat,
                    f"{emoji} <b>{nome_fonte}</b>\n\nNenhum produto disponível no momento.",
                )
            else:
                enviar_telegram(
                    token,
                    chat,
                    f"{emoji} <b>Catálogo {nome_fonte}</b>\n"
                    f"🕐 {agora.strftime('%d/%m/%Y %H:%M')} (Brasília)\n\n"
                    + render_catalogo(secoes, estado.get("fichas")),
                )
                # A foto vai depois do texto: a legenda de cada uma traz preço,
                # THC e efeitos, então a lista serve de índice e as fotos, de ficha.
                garantir_fotos(cpf, estado, catalogo or {}, nomes)
                enviar_fotos(estado, catalogo or {}, nomes)
            print(f"[{datetime.now(TZ).strftime('%H:%M:%S')}] respondido: {nome_fonte}", flush=True)
            atendidos += 1
            continue

        resposta = responder_comando(texto, catalogo, estado, agora, ao_vivo)
        if not resposta:
            # Silêncio é o pior desfecho: quem toca num botão que o código ainda
            # não conhece — porque a execução no ar é anterior ao deploy — conclui
            # que está quebrado. Uma resposta curta já diz que o bot está vivo.
            resposta = (
                "🤔 Não entendi esse pedido.\n\n"
                f"Use os botões abaixo, ou escreva o que vai fazer "
                f"(<i>“vou treinar”</i>, <i>“preciso dormir”</i>) que eu sugiro algo."
            )
        try:
            enviar_telegram(token, chat, resposta)
            atendidos += 1
            # Hora da resposta no log: sem isso não dá para distinguir "o botão
            # demora" de "não havia ninguém escutando na hora do toque", que
            # são problemas diferentes e têm soluções diferentes.
            print(f"[{datetime.now(TZ).strftime('%H:%M:%S')}] respondido: {texto[:28]!r}", flush=True)
        except Exception as e:
            print(f"AVISO: falha ao responder '{texto[:20]}': {e}", file=sys.stderr)
    return atendidos


def telegram_chat_id(token, cacheado):
    """Descobre o chat pelo /start que o usuário mandou ao bot."""
    if os.environ.get("TELEGRAM_CHAT_ID"):
        return os.environ["TELEGRAM_CHAT_ID"].strip()
    if cacheado:
        return cacheado
    try:
        with urllib.request.urlopen(
            f"https://api.telegram.org/bot{token}/getUpdates?limit=10", timeout=30
        ) as r:
            data = json.loads(r.read().decode())
    except Exception as e:
        raise ErroDeFluxo(f"não consegui falar com o Telegram: {e}")
    for upd in reversed(data.get("result") or []):
        msg = upd.get("message") or upd.get("channel_post") or {}
        chat = msg.get("chat") or {}
        if chat.get("id"):
            return str(chat["id"])
    raise ErroDeFluxo(
        "o bot do Telegram ainda não recebeu nenhuma mensagem — abra o bot no "
        "celular e toque em INICIAR (/start) uma vez"
    )


def notificar(texto, estado):
    """Manda a notificação. Telegram se houver token, ntfy se houver tópico."""
    enviados, erros = [], []

    token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    if token:
        try:
            chat = telegram_chat_id(token, estado.get("telegram_chat_id"))
            enviar_telegram(token, chat, texto)
            estado["telegram_chat_id"] = chat
            enviados.append("telegram")
        except Exception as e:
            erros.append(f"telegram: {e}")

    topico = (os.environ.get("NTFY_TOPIC") or "").strip()
    if topico:
        try:
            simples = re.sub(r"<[^>]+>", "", texto)
            req = urllib.request.Request(
                f"https://ntfy.sh/{topico}",
                data=simples.encode("utf-8"),
                headers={"Title": "ABECMED - catalogo", "Priority": "default", "Tags": "herb"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=30).read()
            enviados.append("ntfy")
        except Exception as e:
            erros.append(f"ntfy: {e}")

    if not token and not topico:
        erros.append("nenhum canal configurado (falta o Secret TELEGRAM_BOT_TOKEN)")
    return enviados, erros


# ---------------------------------------------------------------- estado


def carregar_credenciais():
    """Aceita um Secret único `ABECMED_CONFIG` com CPF e token juntos.

    Criar Secret é a única coisa aqui que só a pessoa dona do repositório pode
    fazer — o token de um agente não recebe essa permissão, de propósito. Então
    o mínimo que dá para fazer é exigir um cadastro em vez de dois, e sumir com
    o passo "fiz um e esqueci o outro".

    Não importa a ordem: CPF é o pedaço com 11 dígitos, token de bot é o que
    tem ':'. Dois Secrets separados continuam funcionando e têm prioridade.

    O GitHub mascara Secret pelo valor exato, então o valor combinado sai do log
    sozinho, mas as partes não — por isso o ::add-mask:: de cada uma.
    """
    bruto = (os.environ.get("ABECMED_CONFIG") or "").strip()
    if not bruto:
        return
    for parte in (p.strip() for p in re.split(r"[|\n;,\s]+", bruto) if p.strip()):
        digitos = re.sub(r"\D", "", parte)
        if len(digitos) == 11 and not os.environ.get("ABECMED_CPF"):
            os.environ["ABECMED_CPF"] = digitos
            print(f"::add-mask::{digitos}")
        elif ":" in parte and not os.environ.get("TELEGRAM_BOT_TOKEN"):
            os.environ["TELEGRAM_BOT_TOKEN"] = parte
            print(f"::add-mask::{parte}")


def ler_estado():
    try:
        return json.loads(ESTADO.read_text(encoding="utf-8"))
    except Exception:
        return {}


def gravar_estado(estado):
    # A URL da foto é assinada e expira em ~40 minutos: guardá-la só encheria o
    # arquivo de lixo que não funciona depois. O que fica é o file_id do
    # Telegram, que não expira.
    limpo = dict(estado)
    if estado.get("fichas"):
        limpo["fichas"] = {
            nome: {k: v for k, v in ficha.items() if k != "foto_url"}
            for nome, ficha in estado["fichas"].items()
        }
    ESTADO.write_text(json.dumps(limpo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def escutar(estado, catalogo, cpf, segundos):
    """Fica atendendo o Telegram até a janela acabar, respondendo na hora.

    A verificação do catálogo acontece uma vez por execução; isto aqui só
    conversa com o Telegram, então não gera nenhuma requisição a mais para a
    ABECMED. Como o long polling dorme enquanto não chega nada, o laço fica
    parado a maior parte do tempo em vez de ficar perguntando.

    O estado é gravado a cada resposta: se o runner for interrompido no meio, o
    offset já está no disco e a mensagem não é respondida duas vezes.
    """
    # Sem canal configurado o long polling nem sai: o laço giraria em vazio
    # queimando CPU do runner até a janela acabar.
    if not (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip():
        return 0
    if not (estado.get("telegram_chat_id") or os.environ.get("TELEGRAM_CHAT_ID", "").strip()):
        return 0

    fim = time.time() + segundos
    total = 0
    seguidas = 0
    while True:
        restante = fim - time.time()
        if restante <= 1:
            break
        inicio = time.time()
        n = atender_comandos(
            estado,
            catalogo,
            datetime.now(TZ),
            ao_vivo=False,
            cpf=cpf,
            espera=min(25, int(restante)),
        )
        if n:
            total += n
            gravar_estado(estado)
        # Chamada que volta na hora é chamada que falhou: Telegram fora do ar,
        # ou 409 porque outra execução está escutando. Sem recuo o laço vira uma
        # tempestade de tentativas — na janela de 9 minutos que motivou isto,
        # foram centenas de 409 seguidos e nenhuma mensagem respondida.
        # O recuo cresce até 30s para o caso de o outro leitor demorar a sair.
        if time.time() - inicio < 1:
            seguidas += 1
            time.sleep(min(2 * seguidas, 30))
        else:
            seguidas = 0
    return total


# ---------------------------------------------------------------- principal


def main():
    ap = argparse.ArgumentParser(description="Monitor do catálogo da ABECMED")
    ap.add_argument("--forcar", action="store_true", help="notifica mesmo sem mudança")
    ap.add_argument("--sem-estado", action="store_true", help="só consulta e imprime, não grava nada")
    ap.add_argument(
        "--escutar",
        type=int,
        default=0,
        metavar="SEGUNDOS",
        help="depois de verificar, fica respondendo o Telegram por este tempo",
    )
    args = ap.parse_args()

    carregar_credenciais()
    agora = datetime.now(TZ)
    estado = ler_estado()
    anterior = estado.get("catalogo") or {}

    cpf = re.sub(r"\D", "", os.environ.get("ABECMED_CPF", ""))
    if len(cpf) != 11:
        print("ERRO: ABECMED_CPF ausente ou inválido (esperado 11 dígitos).", file=sys.stderr)
        print("      Configure o Secret ABECMED_CPF no repositório.", file=sys.stderr)
        # Sem CPF não dá para consultar, mas os botões continuam respondendo com
        # o último catálogo guardado. Ficar mudo aqui foi o que fez o bot
        # parecer quebrado quando os Secrets ainda não existiam.
        if not args.sem_estado:
            atender_comandos(estado, anterior, agora, ao_vivo=False)
            if args.escutar > 0:
                escutar(estado, anterior, None, args.escutar)
            gravar_estado(estado)
        return 2

    try:
        catalogo = consultar(cpf)
    except ErroDeFluxo as e:
        # Falha transitória não vira alerta: só depois de várias seguidas. O
        # contador satura em 6 (o limiar do aviso) e a falha é gravada sem
        # horário, senão o state.json mudaria a cada tentativa e o workflow
        # ficaria commitando de 5 em 5 minutos enquanto o site estivesse fora.
        falhas = min(int(estado.get("falhas_seguidas", 0)) + 1, 6)
        print(f"FALHA ({falhas}x seguidas): {e}", file=sys.stderr)
        if not args.sem_estado:
            estado["falhas_seguidas"] = falhas
            estado["ultima_falha"] = str(e)
            if falhas == 6 and not estado.get("falha_avisada"):
                estado["falha_avisada"] = True
                notificar(
                    "⚠️ <b>ABECMED — monitor com problema</b>\n"
                    f"🕐 {agora.strftime('%d/%m/%Y %H:%M')} (Brasília)\n\n"
                    f"Já são {falhas} verificações seguidas sem resposta útil.\n"
                    f"Último erro: {escapar(str(e))}",
                    estado,
                )
            # Mesmo sem conseguir consultar, os botões continuam respondendo —
            # com o último catálogo bom e o aviso de que ele não é de agora.
            atender_comandos(estado, estado.get("catalogo"), agora, ao_vivo=False, cpf=cpf)
            gravar_estado(estado)
        return 1

    if args.sem_estado:
        print(json.dumps(catalogo, ensure_ascii=False, indent=2))
        return 0

    mudancas = comparar(anterior, catalogo) if anterior else []
    novos = produtos_novos(anterior, catalogo) if anterior else []
    recuperou = bool(estado.get("falha_avisada"))

    # Fichas (THC, genética, terpenos, foto) só para quem ainda não tem. Em
    # regime normal isto não faz nenhuma requisição extra.
    cache = estado.setdefault("fichas", {})
    pedidos = fichas_faltando(catalogo, cache)
    # Ficha é enfeite: o catálogo e o alerta valem mais do que ela, e uma fonte
    # com problema não pode levar a outra junto.
    if pedidos["abecmed"]:
        try:
            cache.update(enriquecer(cpf, pedidos["abecmed"]))
        except ErroDeFluxo as e:
            print(f"AVISO: não consegui ler fichas da ABECMED: {e}", file=sys.stderr)
    if pedidos["zeleno"]:
        try:
            cache.update(zeleno.ler_fichas(pedidos["zeleno"]))
        except Exception as e:
            print(f"AVISO: não consegui ler fichas da Zeleno: {e}", file=sys.stderr)

    # De propósito não gravamos o horário exato da verificação: ele mudaria a
    # cada 5 minutos e o workflow commitaria o state.json 288 vezes por dia. Só
    # o dia entra — muda uma vez por dia, o que mantém o repositório ativo (o
    # GitHub desliga agendamentos após 60 dias parados) sem poluir o histórico.
    # A hora exata vai na notificação e fica no log da execução.
    estado["verificado_dia"] = agora.strftime("%Y-%m-%d")
    estado["catalogo"] = catalogo
    estado["falhas_seguidas"] = 0
    registrar_historico(estado, catalogo, agora)
    estado.pop("falha_avisada", None)
    estado.pop("ultima_falha", None)
    if mudancas:
        estado["ultima_mudanca_em"] = agora.isoformat(timespec="seconds")

    if mudancas or args.forcar or recuperou:
        texto = render_mensagem(mudancas, catalogo, agora, cache)
        if recuperou and not mudancas:
            texto = "✅ <b>ABECMED — monitor normalizado</b>\n" + texto.split("\n", 1)[1]
        enviados, erros = notificar(texto, estado)
        for e in erros:
            print(f"AVISO: {e}", file=sys.stderr)
        print(f"NOTIFICADO={','.join(enviados) or 'nenhum'}")
        if not enviados:
            gravar_estado(estado)
            return 3  # houve o que avisar e não saiu — o job deve falhar

        # Foto só de quem entrou agora. Mandar o álbum inteiro a cada mudança
        # de preço encheria a conversa — para ver tudo existe o botão de fotos.
        if novos:
            print(f"FOTOS={enviar_fotos(estado, catalogo, novos)}")

    atendidos = atender_comandos(estado, catalogo, agora, ao_vivo=True, cpf=cpf)
    gravar_estado(estado)
    print(f"MUDANCAS={len(mudancas)}")
    for m in mudancas:
        print(f"  {m}")

    if args.escutar > 0:
        atendidos += escutar(estado, catalogo, cpf, args.escutar)
        gravar_estado(estado)
    if atendidos:
        print(f"COMANDOS_ATENDIDOS={atendidos}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
