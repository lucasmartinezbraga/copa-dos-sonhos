#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || 'COPA_DOS_SONHOS_P0-6_R13.0_PACOTE_COMPLETO');
const output = path.join(root, 'COPA_DOS_SONHOS_P0-6_R13.0_MANIFESTO.json');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    if (absolute === output) return [];
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const files = walk(root).sort().map(absolute => {
  const data = fs.readFileSync(absolute);
  return {
    path: path.relative(root, absolute).split(path.sep).join('/'),
    bytes: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex')
  };
});

const manifest = {
  release: 'COPA DOS SONHOS P0-6 R13.0',
  version: '5.9.3-R13.0',
  generatedOn: '2026-07-21',
  fileCount: files.length,
  totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  htmlSha256: '363d9a915a732ae99a889dab05e7f01485d58b140d64e4778ad8d5825f9818a8',
  github: {
    repository: 'lucasmartinezbraga/copa-dos-sonhos',
    branch: 'codex/r13-futebol-cadenciado',
    pullRequest: 9,
    htmlCommit: '79f95f27b34ea6456c5ecf3c27eb70f3f1f4c3bb',
    headAtPackaging: '9600d71f5d24e83c048916968ae215de20456743'
  },
  files
};

fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ output, fileCount: manifest.fileCount, totalBytes: manifest.totalBytes }, null, 2));
