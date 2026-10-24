import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readAsar, writeAsar } from '../asar.mjs';
import { patchArchive, cleanPreload, loadDictionary, VERSION } from '../patch.mjs';
import { fixtureInNewDirectory } from './fixture.mjs';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

test('patch preserves packed bytes, metadata and correct integrity blocks', () => {
  const { directory, archive: source } = fixtureInNewDirectory();
  const destination = path.join(directory, 'patched.asar');
  const report = patchArchive(source, destination);
  assert.equal(report.localizationVersion, VERSION);
  assert.equal(report.entries, Object.keys(loadDictionary()).length);
  const original = readAsar(source);
  const patched = readAsar(destination);
  for (const [key, entry] of original.entries) {
    if (entry.unpacked || entry.link) assert.deepEqual(patched.entries.get(key), entry);
    else if (!report.modified.includes(key)) assert.ok(original.get(key).equals(patched.get(key)), key);
    if (entry.executable) assert.equal(patched.entries.get(key).executable, true);
  }
  assert.match(patched.get('dist/main.js').toString(), /设置/);
  assert.match(patched.get('dist/tray.js').toString(), /个代理正在运行/);
  const bytes = patched.get('dist/preload.js');
  const integrity = patched.entries.get('dist/preload.js').integrity;
  assert.equal(integrity.hash, sha(bytes));
  assert.deepEqual(integrity.blocks, Array.from({ length: Math.ceil(bytes.length / integrity.blockSize) }, (_, i) => sha(bytes.subarray(i * integrity.blockSize, (i + 1) * integrity.blockSize))));
  assert.equal(cleanPreload(bytes.toString()), original.get('dist/preload.js').toString());
  // Inspect the pickle header independently of readAsar's get() offsets.
  const raw = fs.readFileSync(destination);
  assert.equal(raw.readUInt32LE(0), 4);
  assert.equal(raw.readUInt32LE(8) + 4, raw.readUInt32LE(4));
  const header = JSON.parse(raw.subarray(16, 16 + raw.readUInt32LE(12)).toString());
  const entry = header.files.assets.files['unchanged.bin'];
  const start = 8 + raw.readUInt32LE(4) + Number(entry.offset);
  assert.ok(raw.subarray(start, start + entry.size).equals(original.get('assets/unchanged.bin')));
  const twice = path.join(directory, 'twice.asar');
  patchArchive(destination, twice);
  assert.equal(sha(fs.readFileSync(destination)), sha(fs.readFileSync(twice)));
});

test('legacy injection migration and malformed marker protection', () => {
  assert.equal(cleanPreload('official();\n// Antigravity Chinese Localization Injection\n(function(){})();\n'), 'official();\n');
  assert.throws(() => cleanPreload('official();\n// BEGIN ANTIGRAVITY CHINESE LOCALIZATION\nbroken'), /标记不完整/);
  assert.throws(() => cleanPreload('official();\n// Antigravity Chinese Localization Injection\nbroken'), /结构异常/);
});

test('incompatible app is rejected without creating a patched archive', () => {
  const { directory, archive: source } = fixtureInNewDirectory();
  const incompatible = path.join(directory, 'incompatible.asar');
  writeAsar(readAsar(source), new Map([['package.json', Buffer.from(JSON.stringify({ name: 'other', main: 'dist/main.js', version: '1' }))]]), incompatible);
  const destination = path.join(directory, 'rejected.asar');
  assert.throws(() => patchArchive(incompatible, destination), /不是兼容/);
  assert.equal(fs.existsSync(destination), false);
});
