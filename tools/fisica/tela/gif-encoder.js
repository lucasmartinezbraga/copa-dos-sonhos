'use strict';
/* CODIFICADOR GIF89a — em JS, para rodar dentro do navegador
   -------------------------------------------------------------------------
   Este ambiente nao tem ffmpeg, ImageMagick, PIL nem sharp. Como o dono pediu
   GIF de comparacao, o caminho e codificar no proprio Chromium: os quadros ja
   estao em canvas, entao falta so quantizar e comprimir.

   · paleta construida a partir dos QUADROS (histograma em 5-5-5, os 255 mais
     frequentes), e nao uma paleta fixa: um gramado tem pouca variedade de
     matiz e muita de luminancia, e paleta fixa borra justamente isso;
   · casamento de cor por busca linear com cache, que a 256 cores e barato;
   · LZW padrao do GIF, com tamanho de codigo variavel e limpeza de dicionario.

   Exporta `window.__cdsGif(quadros, largura, altura, atrasoCs)` -> Uint8Array.
   `quadros` e um array de ImageData.
*/
(function (root) {
  if (root.__cdsGif) return;

  function paleta(quadros) {
    const cont = new Map();
    for (const q of quadros) {
      const d = q.data;
      for (let i = 0; i < d.length; i += 16) {          // amostra 1 em 4 pixels
        const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
        cont.set(k, (cont.get(k) || 0) + 1);
      }
    }
    const top = [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 255);
    const p = [];
    for (const [k] of top) {
      p.push([((k >> 10) & 31) << 3, ((k >> 5) & 31) << 3, (k & 31) << 3]);
    }
    while (p.length < 256) p.push([0, 0, 0]);
    return p;
  }

  function indexar(q, p, cache) {
    const d = q.data, n = q.width * q.height, saida = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const k = ((d[j] >> 3) << 10) | ((d[j + 1] >> 3) << 5) | (d[j + 2] >> 3);
      let idx = cache.get(k);
      if (idx === undefined) {
        let melhor = 0, dist = 1e9;
        const r = d[j], g = d[j + 1], b = d[j + 2];
        for (let c = 0; c < 256; c++) {
          const dr = r - p[c][0], dg = g - p[c][1], db = b - p[c][2];
          const e = dr * dr + dg * dg + db * db;
          if (e < dist) { dist = e; melhor = c; if (!e) break; }
        }
        idx = melhor; cache.set(k, idx);
      }
      saida[i] = idx;
    }
    return saida;
  }

  /* LZW do GIF: dicionario comeca com as cores, +2 codigos de controle */
  function lzw(pixels, minCode) {
    const limpar = 1 << minCode, fim = limpar + 1;
    let tamCodigo = minCode + 1, proximo = fim + 1;
    let dic = new Map();
    const bytes = [], bloco = [];
    let acumulador = 0, bits = 0;

    function emitir(code) {
      acumulador |= code << bits; bits += tamCodigo;
      while (bits >= 8) { bloco.push(acumulador & 255); acumulador >>= 8; bits -= 8; }
      if (bloco.length >= 255) { bytes.push(255, ...bloco.splice(0, 255)); }
    }
    function zerar() {
      dic = new Map(); proximo = fim + 1; tamCodigo = minCode + 1;
    }

    emitir(limpar); zerar();
    let prefixo = pixels[0];
    for (let i = 1; i < pixels.length; i++) {
      const k = pixels[i], chave = prefixo * 4096 + k;
      const achou = dic.get(chave);
      if (achou !== undefined) { prefixo = achou; continue; }
      emitir(prefixo);
      dic.set(chave, proximo);
      if (proximo === (1 << tamCodigo) && tamCodigo < 12) tamCodigo++;
      proximo++;
      if (proximo >= 4096) { emitir(limpar); zerar(); }
      prefixo = k;
    }
    emitir(prefixo); emitir(fim);
    if (bits > 0) { bloco.push(acumulador & 255); }
    while (bloco.length) bytes.push(Math.min(255, bloco.length), ...bloco.splice(0, 255));
    bytes.push(0);
    return bytes;
  }

  root.__cdsGif = function (quadros, W, H, atrasoCs) {
    const p = paleta(quadros), cache = new Map(), out = [];
    const put = (...b) => out.push(...b);
    const put16 = v => out.push(v & 255, (v >> 8) & 255);

    /* cabecalho + descritor logico + paleta global */
    put(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
    put16(W); put16(H);
    put(0xF7, 0, 0);                                   // paleta global de 256
    for (const c of p) put(c[0], c[1], c[2]);
    /* laco infinito (Netscape) */
    put(0x21, 0xFF, 11);
    for (const ch of 'NETSCAPE2.0') put(ch.charCodeAt(0));
    put(3, 1, 0, 0, 0);

    for (const q of quadros) {
      put(0x21, 0xF9, 4, 0x04);                        // controle grafico
      put16(atrasoCs); put(0, 0);
      put(0x2C); put16(0); put16(0); put16(W); put16(H); put(0);
      put(8);
      const idx = indexar(q, p, cache);
      for (const b of lzw(idx, 8)) out.push(b);
    }
    put(0x3B);
    return new Uint8Array(out);
  };
})(typeof window !== 'undefined' ? window : globalThis);
