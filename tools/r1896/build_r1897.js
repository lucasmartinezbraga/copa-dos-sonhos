#!/usr/bin/env node
'use strict';
/*
 * CADEIA DE BUILD DA R18.97
 * =========================
 * BASE = R18.86 promovida (sha f920ae1a…)
 *
 *   + OS-84  patch_os84_shot_verdict.js    -> R18.87  desfecho do chute visivel
 *   + OS-87  patch_os87_falta.js           -> R18.88  o cobrador chega na bola
 *   + OS-88  patch_os88_momento_falta.js   -> R18.89  o momento da falta
 *   + OS-89  patch_os89_desfecho_falta.js  -> R18.90  defesa/fora recalibrado
 *   + OS-90  patch_os90_goleiro_falta.js   -> R18.91  goleiro se posiciona
 *   + OS-92  patch_os92_chute_fora.js      -> R18.92  o chute fora SAI de fato
 *   + OS-98  patch_os98_decidet_vincula.js -> R18.93  o dominio responde
 *   + OS-100 patch_os100_lateral_entrega.js-> R18.94  o lateral e cobrado
 *   + OS-101 patch_os101_gol_de_falta.js   -> R18.95  o gol de falta direta
 *   + OS-106 patch_os106_camera_lenta_...  -> R18.96  camera lenta em todo chute
 *   + OS-107 patch_os107_bloco_bola_...    -> R18.97  o time vai para o lance
 *
 * A OS-107 foi promovida com o preco medido e aceito pelo dono do projeto:
 * chutes 19,13 -> 17,59 por partida (negativo nas seis bases), em troca de
 * 0,656 -> 2,233 atacante dentro da area no escanteio e 0,262 -> 4,468
 * defensor dentro da propria area na falta cruzada. Ela passa nos tres gates
 * na bateria de 48 x 6: gols 2,0070 (pior 1,8125), xG 2,1139, escanteios
 * 4,9305. O que ficou aberto esta na PROXIMA_RODADA: -1,13 chute no jogo
 * corrido, causado pelo pino, com o canal ainda nao isolado.
 *
 * FORA DA CADEIA, medidas e falsificadas -- ficam no repositorio como registro:
 *   OS-84B  tres versoes, todas derrubadas. O achado que sobrou virou a OS-92.
 *   OS-89C  teto da barreira: a regua estava errada; a correcao piorou o numero.
 *   OS-93   lateral: matou o teleporte de 4,5 m e fez a bola reaparecer a 4,6 m
 *           do ponto de saida. Trocou um defeito por outro.
 *
 * Uso: node build_r1897.js [saida.html] --base=<R18.86.html>
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AQUI = __dirname;
const TMP = path.join(AQUI, '_build');
/* A base pode estar em lugares diferentes conforme quem roda. Procura pelos
   nomes conhecidos, na pasta do script e um nivel acima, e aceita --base=. */
const argBase = (process.argv.slice(2).find(a => a.startsWith('--base=')) || '').slice(7);
const CANDIDATOS = argBase ? [argBase] : [
  path.resolve(AQUI, '..', 'BASE_R18.86.html'),
  path.resolve(AQUI, 'BASE_R18.86.html'),
  path.resolve(AQUI, 'COPA DOS SONHOS - R18.86 - JOGO DE FUTEBOL.html'),
  path.resolve(AQUI, '..', 'COPA DOS SONHOS - R18.86 - JOGO DE FUTEBOL.html'),
];
const BASE = CANDIDATOS.find(p => fs.existsSync(p)) || CANDIDATOS[0];
const SAIDA = (process.argv[2] && !process.argv[2].startsWith('--'))
  ? process.argv[2] : path.resolve(AQUI, '..', 'R18.97.html');
const NODE = process.execPath;

const CADEIA = [
  ['OS-84', 'patch_os84_shot_verdict.js'],
  ['OS-87', 'patch_os87_falta.js'],
  ['OS-88', 'patch_os88_momento_falta.js'],
  ['OS-89', 'patch_os89_desfecho_falta.js'],
  ['OS-90', 'patch_os90_goleiro_falta.js'],
  ['OS-92', 'patch_os92_chute_fora.js'],
  ['OS-98', 'patch_os98_decidet_vincula.js', ['--espera=0.28']],
  ['OS-100', 'patch_os100_lateral_entrega.js'],
  ['OS-101', 'patch_os101_gol_de_falta.js', ['--base=0.048', '--fator=2.20', '--teto=0.130']],
  /* OS-104 (chute por cima, dentro do patch_os92) e OS-105 (conducao) foram
     MEDIDAS E NAO PROMOVIDAS -- ver RODADA_OS104_OS106.md. Ficam no repositorio,
     fora da cadeia, com o numero que as derrubou no cabecalho.
     ['OS-105', 'patch_os105_conducao.js'], */
  ['OS-106', 'patch_os106_camera_lenta_chute.js'],
  ['OS-107', 'patch_os107_bloco_bola_parada.js'],
];

if (!fs.existsSync(BASE)) { console.error('ABORTA: base nao encontrada -> ' + BASE); process.exit(1); }
const shaBase = crypto.createHash('sha256').update(fs.readFileSync(BASE)).digest('hex');
const SHA_ESPERADO_BASE = 'f920ae1a64564347785262d2d95834ac2d8b8133f13cc8a342acd31cfac6f8f0';
if (shaBase !== SHA_ESPERADO_BASE) {
  console.error('ABORTA: a base nao e a R18.86 promovida.');
  console.error('  esperado ' + SHA_ESPERADO_BASE);
  console.error('  achado   ' + shaBase);
  process.exit(1);
}
console.log('base R18.86 conferida  sha256 ' + shaBase.slice(0, 16));

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

let entrada = BASE;
CADEIA.forEach(([id, script, extra], i) => {
  const saida = path.join(TMP, String(i + 1).padStart(2, '0') + '.html');
  const p = path.join(AQUI, script);
  if (!fs.existsSync(p)) { console.error('ABORTA: patch ausente -> ' + script); process.exit(1); }
  process.stdout.write('  ' + id.padEnd(7));
  const out = execFileSync(NODE, [p, entrada, saida].concat(extra || []), { encoding: 'utf8' });
  const ok = (out.match(/^\s+ok /gm) || []).length;
  console.log(String(ok).padStart(2) + ' ancoras  ->  ' + path.basename(saida));
  entrada = saida;
});

fs.copyFileSync(entrada, SAIDA);
const sha = crypto.createHash('sha256').update(fs.readFileSync(SAIDA)).digest('hex');
console.log('\nsaida   ' + SAIDA);
console.log('bytes   ' + fs.statSync(SAIDA).size);
console.log('sha256  ' + sha);
