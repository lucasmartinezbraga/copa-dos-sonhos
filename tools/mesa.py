#!/usr/bin/env python3
"""A MESA — todas as validacoes num comando so, com um veredito so.

Por que isto existe
-------------------
Por uma rodada inteira a maquina de estados de animacao esteve DESLIGADA: um
`ReferenceError` por quadro, engolido por um `catch` mudo. Nenhuma das
validacoes que eu rodava por habito acusou nada — porque cada uma media coisas
que continuavam certas, e as que teriam pegado (`gesto-perdido.js`,
`arbitro.js`) simplesmente nao foram rodadas naquele dia.

Sonda que existe e nao roda vale zero. A Mesa junta o ritual inteiro:

    build -> verify -> smoke -> sanidade -> arbitro -> validacao de lance

Cada etapa tem codigo de saida de verdade. Se qualquer uma reprovar, a Mesa
reprova, e diz qual.

Uso:
    python3 tools/mesa.py               # ritual completo
    python3 tools/mesa.py --rapido      # sem as sondas longas de tela
    python3 tools/mesa.py --segundos=90 # encurta as sondas de tela
"""
import subprocess
import sys
import time
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def arg(nome, padrao):
    for a in sys.argv[1:]:
        if a.startswith('--' + nome + '='):
            return a.split('=', 1)[1]
    return padrao


RAPIDO = '--rapido' in sys.argv
# §OS-266 · O ORCAMENTO DAS SONDAS DE TELA E EM PAREDE, E O JOGO FICOU MAIS
# LENTO EM PAREDE DE PROPOSITO.
# A OS-263 poe a cerimonia da bola parada em tempo real: a falta passou de
# 300 ms para ~1,9 s e o gol de 733 ms para ~3,7 s. Isso e o objetivo -- e o
# efeito colateral e que, nos mesmos 150 s de parede, a sonda passou a ver ~30%
# menos futebol. Resultado medido: o Arbitro reprovou por `defesa: 0 de 0` (sem
# amostra, que pela doutrina da OS-247 NAO e aprovacao) e `lances` reportou a
# falta em 73,3% sobre denominador 15 -- enquanto a mesma sonda em 120 partidas
# da 99,5% sobre 2655 cobrancas.
# Nao se afrouxa o limiar nem a doutrina: aumenta-se a janela. E a mesma licao
# da OS-260, pela terceira vez -- quem orca no relogio errado mede outra coisa.
SEGUNDOS = arg('segundos', '230')


def etapa(rotulo, cmd, obrigatoria=True):
    print('\n' + '─' * 78)
    print('▶ ' + rotulo)
    print('  ' + ' '.join(cmd))
    print('─' * 78)
    t0 = time.time()
    r = subprocess.run(cmd, cwd=RAIZ)
    dt = time.time() - t0
    ok = (r.returncode == 0)
    print('  → %s em %.0f s (saida %d)' % ('PASSOU' if ok else 'REPROVOU', dt, r.returncode))
    return (rotulo, ok, r.returncode, dt, obrigatoria)


def main():
    resultados = []
    resultados.append(etapa('build — remonta dist/ a partir de src/',
                            [sys.executable, 'tools/build.py']))
    resultados.append(etapa('verify — sintaxe, presenca e reprodutibilidade',
                            [sys.executable, 'tools/verify.py']))
    resultados.append(etapa('smoke — o jogo sobe num Chromium de verdade',
                            ['node', 'tests/browser_smoke.js']))
    if not RAPIDO:
        # O PORTAO SE PROVA ANTES DE JULGAR. Injeta a pane da OS-247 (publicacao
        # de estado desligada) e exige que o Arbitro reprove. Sonda que nunca
        # reprovou nada nao e portao, e enfeite — e foi enfeite que deixou uma
        # rodada inteira passar com a animacao morta.
        resultados.append(etapa('autoteste — o Arbitro pega a pane da OS-247?',
                                ['node', 'tools/fisica/tela/arbitro.js',
                                 'dist/index.html', '--segundos=45', '--autoteste']))
        resultados.append(etapa('sanidade — o que nunca pode acontecer',
                                ['node', 'tools/fisica/tela/sanidade.js',
                                 'dist/index.html', '--segundos=' + SEGUNDOS]))
        resultados.append(etapa('arbitro — o lance e futebol de verdade?',
                                ['node', 'tools/fisica/tela/arbitro.js',
                                 'dist/index.html', '--segundos=' + SEGUNDOS]))
        # Falta, barreira e escanteio sao RAROS: numa janela de 120 s a sonda ve
        # duas ou tres de cada, e limiar de 90% sobre denominador 2 mede ruido.
        # Esta etapa roda com o dobro do tempo das outras, no minimo 300 s.
        seg_lances = str(max(460, int(SEGUNDOS) * 2))
        resultados.append(etapa('lances — falta, desarme, lateral, escanteio, saida de bola',
                                ['node', 'tools/fisica/tela/validar-lances.js',
                                 'dist/index.html', '--segundos=' + seg_lances]))

    print('\n' + '=' * 78)
    print('A MESA')
    print('=' * 78)
    ruins = []
    for rotulo, ok, cod, dt, obr in resultados:
        print('  [%s] %-58s %5.0f s' % (' ok ' if ok else 'FALHA', rotulo[:58], dt))
        if not ok and obr:
            ruins.append(rotulo)
    print('=' * 78)
    if ruins:
        print('VEREDITO: REPROVADO — %d etapa(s):' % len(ruins))
        for m in ruins:
            print('   · ' + m)
        print('\nNao faca commit assim. Leia a saida da etapa que reprovou:')
        print('ela nomeia o defeito e da o exemplo, nao so o numero.')
        return 1
    print('VEREDITO: APROVADO em todas as etapas.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
