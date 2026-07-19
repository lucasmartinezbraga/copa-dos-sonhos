'use strict';
const assert=require('assert'),fs=require('fs');
const p=process.argv[2];if(!p)throw new Error('Informe o relatório JSON');
const r=JSON.parse(fs.readFileSync(p,'utf8')),o=r.overall;
assert.strictEqual(r.engineVersion,'4.3.2');
assert(Math.abs(r.dt-1/60)<1e-12,`dt oficial inválido: ${r.dt}`);
const broad={goalsPerMatch:[2.1,3.5],shotsPerMatch:[18,33],xgPerMatch:[2.0,3.8],onTargetRate:[.30,.50],passCompletion:[.72,.91],foulsPerMatch:[13,30],yellowsPerMatch:[1.8,6.2],redsPerMatch:[0,.4],cornersPerMatch:[4,12],drawRate:[.15,.42],zeroZeroRate:[.02,.16],blowoutRate:[.01,.16],averageEndingStamina:[60,85]};
for(const [k,[lo,hi]] of Object.entries(broad)){assert(Number.isFinite(o[k]),`${k} inválido`);assert(o[k]>=lo&&o[k]<=hi,`${k}=${o[k]} fora de ${lo}-${hi}`);}
const sb=r.features&&r.features.sideBias;
assert(sb&&sb.decisiveGames>=100,'amostra de viés de lado insuficiente');
assert(sb.sideAWinShare>=.46&&sb.sideAWinShare<=.54,`viés de lado ${sb.sideAWinShare}`);
const metricFailures=Object.entries(r.calibration.checks).filter(([,v])=>v.status!=='ok');
assert.deepStrictEqual(metricFailures,[],`métricas fora da faixa: ${JSON.stringify(metricFailures)}`);
const styleFailures=Object.entries(r.styleExpectationChecks||{}).filter(([,v])=>v.status!=='ok');
assert.deepStrictEqual(styleFailures,[],`estilos fora da identidade: ${JSON.stringify(styleFailures)}`);
assert(r.calibration.score>=90,`nota de calibração insuficiente: ${r.calibration.score}`);
assert.strictEqual(r.matches,214);
console.log(JSON.stringify({ok:true,score:r.calibration.score,matches:r.matches,sideBias:sb},null,2));
