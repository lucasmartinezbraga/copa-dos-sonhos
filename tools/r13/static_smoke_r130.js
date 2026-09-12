#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const buildPath = process.argv[2];
const outputPath = process.argv[3] || 'R13.0_SMOKE_ESTATICO.json';
if (!buildPath) throw new Error('uso: static_smoke_r130.js BUILD.html RESULTADO.json');

const html = fs.readFileSync(buildPath, 'utf8');
const scripts = [];
const syntaxErrors = [];
const scriptPattern = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let match;
while ((match = scriptPattern.exec(html))) {
  const attrs = match[1] || '';
  const code = match[2] || '';
  const type = (attrs.match(/type=["']([^"']+)["']/i) || [])[1] || 'text/javascript';
  scripts.push({ type, bytes: Buffer.byteLength(code) });
  if (/json/i.test(type)) continue;
  try { new vm.Script(code, { filename: `script-${scripts.length - 1}.js` }); }
  catch (error) { syntaxErrors.push({ index: scripts.length - 1, message: String(error.message || error) }); }
}

const checks = {
  doctype: /<!doctype html>/i.test(html),
  viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
  utf8: /<meta[^>]+charset=["']?utf-8/i.test(html),
  releaseVersion: /5\.9\.3-R13\.0/.test(html),
  observerLayer: /__CDS_R13__/.test(html) && /PHASE_STATE_MACHINE/.test(html),
  physicalThrowIn: /throw_in/.test(html) && /_startTravel\(taker,[\s\S]{0,180}'throw'/.test(html) && /throwIn:true/.test(html),
  normalSpeed: /\{ k: '1X',\s+v: 1\.0 \}/.test(html) && /speed: 1\.0,\s+screen: 'home'/.test(html),
  speedScale: /\{ k: '2X',\s+v: 1\.8 \}/.test(html) && /\{ k: '4X',\s+v: 3\.6 \}/.test(html),
  throwInNarration: /throw_in:\s+e\s*=>/.test(html),
  throwInStats: /Laterais/.test(html),
  responsiveStyles: /@media\s*\([^)]*max-width/i.test(html),
  scriptsPresent: scripts.length >= 10,
  scriptSyntax: syntaxErrors.length === 0
};

const payload = {
  build: buildPath,
  sha256: crypto.createHash('sha256').update(html).digest('hex'),
  bytes: Buffer.byteLength(html),
  scripts,
  syntaxErrors,
  checks,
  passed: Object.values(checks).filter(Boolean).length,
  total: Object.keys(checks).length,
  status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL'
};
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));
if (payload.status !== 'PASS') process.exitCode = 1;
