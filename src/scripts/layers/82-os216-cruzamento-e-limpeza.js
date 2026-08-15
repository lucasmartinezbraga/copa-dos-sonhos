
(function (root) {
'use strict';
/* OS-216 · O CRUZAMENTO VOLTA A SER CRUZAMENTO
   ===========================================================================
   RELATO: "melhore a trajetoria da bola durante cruzamentos".

   A OS-200 ja tem o perfil do cruzamento escrito, e ele e bom:

       anguloDe()          pk === 'cross'  ->  0,48 rad (~27 graus)
       classe de voo       pk === 'cross'  ->  ALTA (projetil que pousa no alvo)

   So que `_cross` lanca a bola com `this._startTravel(o, target, 'pass', ...)`
   — **kind 'pass', e sem passKind**. E `anguloDe` faz `pk = passKind || kind`.
   Ou seja: o cruzamento inteiro do jogo sai com o perfil de PASSE, rasteiro e
   tenso, e o ramo dedicado a ele nunca e alcancado.

   E o mesmo padrao que ja apareceu tres vezes nesta base: um conceito e
   escrito, e lido, e nao pode acontecer. Aqui o preco e visivel — a bola de
   cruzamento viaja esticada em vez de subir, cair e morrer na area.

   A correcao nao toca em `_cross`, que e longo e cheio de ramos: marca a
   entrega enquanto ela acontece e etiqueta a viagem que sair dali. O alvo, a
   escolha do alvo, a forca e o duelo continuam exatamente os mesmos — muda o
   PERFIL DE VOO, que e o que o dono esta vendo.

   O cruzamento rasteiro (`delivery === 'low'`) fica de fora de proposito: ele
   e rasteiro por escolha do motor, e levanta-lo seria desfazer a OS-12.

   ---------------------------------------------------------------------------
   E A POLUICAO VISUAL DO CAMPO

   RELATO, depois da OS-215: "ainda sinto poluicao visual no campo".

   O balanco #anti-cardume desloca a posicao DESENHADA de todo atleta, a cada
   quadro, com amplitude ate 2,2 px e frequencia de 14 a 24 rad/s. Ele nasceu
   para quebrar o "bloco andando junto", e naquele momento era a unica coisa
   que fazia isso.

   Hoje nao e mais: cada atleta ja tem constante de reacao propria (`p.react`,
   0,062 a 0,27, §movimento), fator de deslize individual (`p._slideF`) e fase
   de passada propria. O bloco ja se desfaz sozinho, por fisica.

   O que sobrou do balanco e o que ele sempre foi: ruido de alta frequencia em
   22 corpos ao mesmo tempo. A OS-207 ja o tinha desligado na bola parada
   (tremor de 7,69% para 5,32%) e a OS-215 mostrou que ele realimentava a
   propria passada. Desligado por inteiro, o campo para de vibrar.
   =========================================================================== */
const M = root && root.MatchSim;
if (!M || !M.prototype || M.prototype.__OS216__) return;
const P = M.prototype; P.__OS216__ = true;

const oldCross = P._cross;
if (typeof oldCross === 'function') {
  P._cross = function (o) {
    this.__os216Cruzando = true;
    try { return oldCross.apply(this, arguments); }
    finally { this.__os216Cruzando = false; }
  };
}

/* O `delivery` escolhido pelo motor chega no evento; so o aereo e etiquetado. */
const oldEmit = P._emit;
P._emit = function (type, data) {
  if (type === 'cross' && data) this.__os216Aereo = data.delivery !== 'low';
  return oldEmit.apply(this, arguments);
};

const oldStartTravel = P._startTravel;
if (typeof oldStartTravel === 'function') {
  P._startTravel = function (o, target, kind, cb, receiver, style, meta) {
    if (this.__os216Cruzando && this.__os216Aereo && kind === 'pass' && !style) {
      /* etiqueta a viagem: a OS-200 le `passKind` antes de `kind` e so entao
         escolhe o angulo de saida e a classe de voo */
      arguments[5] = 'cross';
      return oldStartTravel.call(this, o, target, kind, cb, receiver, 'cross', meta);
    }
    return oldStartTravel.apply(this, arguments);
  };
}

root.CDS_OS216 = Object.freeze({
  versao: 'OS-216', instalado: true,
  feature: 'CROSS_USES_ITS_OWN_FLIGHT_PROFILE',
  rngAdded: false, xgChange: false
});
root.CDS_BUILD_ID = 'R19.13'; root.CDS_VERSION = '5.80.4-R19.13';
try { document.title = 'Copa dos Sonhos — R19.13'; } catch (_) { }
})(typeof window !== 'undefined' ? window : globalThis);
