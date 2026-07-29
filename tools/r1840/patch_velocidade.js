/* ============================================================================
 * R18.40 · A VELOCIDADE VOLTA A RESPEITAR O TETO DO PROPRIO MOTOR  (OS-10)
 * ----------------------------------------------------------------------------
 * A camada transacional nao integra velocidade: ela DERIVA da diferenca de
 * posicao, e deriva DEPOIS de clampar o passo.
 *
 *   commitMovement:  maxStep = max(.20, maxSpd*dt*1.18 + .12)
 *                    ... p.vx = (x - s.x) / dt
 *   guarda de frame: max     = max(.30, maxSpd*step*1.28 + .20)
 *                    ... p.vx = (p.x - z[1]) / step
 *
 * A conta, com um jogador de 7 m/s a 30 Hz:
 *   commitMovement -> (7*0,0333*1,18 + 0,12) / 0,0333 = 11,9 m/s
 *   guarda global  -> (7*0,0333*1,28 + 0,20) / 0,0333 = 15,0 m/s
 *
 * Ninguem esta correndo: o passo e limitado corretamente, mas a FOLGA ADITIVA
 * (+0,12 e +0,20) entra na divisao e vira velocidade. Medido na R18.40:
 * maxima 18,28 m/s, com 2,52% das amostras acima de 8 m/s — e o grosso dessas
 * amostras em 8,2-8,4 m/s, que e exatamente maxSpd*1,18 + folga.
 *
 * A CORRECAO e deliberadamente minima: a POSICAO nao muda: o clamp de passo
 * continua identico, entao o movimento visivel e a ecologia do jogo ficam
 * intactos. Muda so a velocidade DERIVADA, que passa a ser saturada no teto do
 * proprio jogador (com 5% de tolerancia numerica). E o invariante que o motor
 * ja afirmava e nao cumpria.
 * ==========================================================================*/
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const a = (n, d) => { const h = process.argv.slice(2).find(x => x.startsWith('--' + n + '=')); return h ? h.slice(n.length + 3) : d; };
const TOL = Number(a('tol', 1.05));

let src = fs.readFileSync(a('in', 'r1840.html'), 'utf8');
const applied = [];
function edit(id, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error('ABORTA [' + id + ']: ancora ' + n + 'x'); process.exit(1); }
  src = src.replace(from, to); applied.push(id);
}

/* 1) commitMovement — a derivada principal. */
edit('r1840-vel-commit',
`p.x=x;p.y=y;if(ctx.dt>0){p.vx=(x-s.x)/ctx.dt;p.vy=(y-s.y)/ctx.dt;}`,
`p.x=x;p.y=y;if(ctx.dt>0){p.vx=(x-s.x)/ctx.dt;p.vy=(y-s.y)/ctx.dt;
      /* §R18.40 · A posicao ja foi limitada acima; o que escapava era a
         VELOCIDADE derivada dela. A folga aditiva do clamp (+0,12) entra na
         divisao por dt e vira 11,9 m/s para um jogador de 7 m/s. Satura no
         teto do proprio jogador. Nao mexe em x/y: o movimento e o mesmo. */
      var _vt=finite(p.maxSpd,7)*${TOL},_vm=Math.hypot(p.vx,p.vy);
      if(_vm>_vt&&_vm>0){var _vq=_vt/_vm;p.vx*=_vq;p.vy*=_vq;dg.velocityClamps=(dg.velocityClamps||0)+1;}}`);

/* 2) guarda global de frame — a segunda barreira, com folga ainda maior. */
edit('r1840-vel-guarda',
`p.vx=(p.x-z[1])/step;p.vy=(p.y-z[2])/step;`,
`p.vx=(p.x-z[1])/step;p.vy=(p.y-z[2])/step;
      /* §R18.40 · mesma correcao na segunda barreira, cuja folga (+0,20) abria
         ate 15,0 m/s. */
      var _gt=finite(p.maxSpd,7)*${TOL},_gm=Math.hypot(p.vx,p.vy);
      if(_gm>_gt&&_gm>0){var _gq=_gt/_gm;p.vx*=_gq;p.vy*=_gq;dg.velocityClamps=(dg.velocityClamps||0)+1;}`);

fs.writeFileSync(a('out', 'r1840v.html'), src, 'utf8');
console.log('patches:', applied.join(', '));
console.log(path.basename(a('out', 'r1840v.html')), '| tol', TOL, '|', crypto.createHash('sha256').update(fs.readFileSync(a('out', 'r1840v.html'))).digest('hex').slice(0, 12));
