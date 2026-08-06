#!/usr/bin/env python3
"""Divide um HTML monolitico do Copa dos Sonhos em template + blocos.

O documento e percorrido com um scanner que respeita comentarios HTML, porque
o cabecalho do jogo contem a string "<style>" DENTRO de um comentario. Um
split ingenuo por regex quebra exatamente ali.

A garantia deste modulo e o round-trip: template + blocos remontados devem
reproduzir o arquivo de origem byte a byte. O importador so grava se essa
igualdade valer.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

TOKEN = "/*__CDS_BLOCK_%d__*/"
TOKEN_RE = re.compile(r"/\*__CDS_BLOCK_(\d+)__\*/")


@dataclass
class Block:
    kind: str  # "script" | "style"
    open_tag: str
    content: str
    ident: str  # id="..." quando existir, senao ""


def _scan(html: str) -> list[tuple[int, int, str]]:
    """Devolve (inicio_conteudo, fim_conteudo, kind) para cada bloco real.

    Comentarios HTML sao pulados por completo, entao tags citadas dentro deles
    nunca viram blocos.
    """
    out: list[tuple[int, int, str]] = []
    i, n = 0, len(html)
    while i < n:
        if html.startswith("<!--", i):
            end = html.find("-->", i + 4)
            i = n if end < 0 else end + 3
            continue
        if html.startswith("<script", i) or html.startswith("<style", i):
            kind = "script" if html.startswith("<script", i) else "style"
            gt = html.find(">", i)
            if gt < 0:
                break
            close = "</%s>" % kind
            end = html.find(close, gt + 1)
            if end < 0:
                break
            out.append((gt + 1, end, kind))
            i = end + len(close)
            continue
        i += 1
    return out


def split(html: str) -> tuple[str, list[Block]]:
    spans = _scan(html)
    blocks: list[Block] = []
    parts: list[str] = []
    cursor = 0
    for idx, (start, end, kind) in enumerate(spans):
        open_start = html.rfind("<" + kind, cursor, start)
        open_tag = html[open_start:start]
        m = re.search(r'id="([^"]+)"', open_tag)
        blocks.append(
            Block(kind=kind, open_tag=open_tag, content=html[start:end], ident=m.group(1) if m else "")
        )
        parts.append(html[cursor:start])
        parts.append(TOKEN % idx)
        cursor = end
    parts.append(html[cursor:])
    return "".join(parts), blocks


def join(template: str, contents: list[str]) -> str:
    return TOKEN_RE.sub(lambda m: contents[int(m.group(1))], template)


def verify_roundtrip(html: str) -> bool:
    template, blocks = split(html)
    return join(template, [b.content for b in blocks]) == html
