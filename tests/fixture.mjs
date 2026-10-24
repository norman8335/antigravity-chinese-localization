import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeAsar } from '../asar.mjs';

export const outputRoot = fileURLToPath(new URL('../.test-output/', import.meta.url));
fs.mkdirSync(outputRoot, { recursive: true });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// Entirely synthetic input: no vendor code, account data or installed application.
export function createFixture(destination) {
  const contents = new Map([
    ['package.json', Buffer.from(JSON.stringify({ name: 'antigravity', version: '0.0.0-test', main: 'dist/main.js' }))],
    ['dist/preload.js', Buffer.from('const contextBridge = { exposeInMainWorld() {} };\ncontextBridge.exposeInMainWorld("fixture", {});\n')],
    ['dist/main.js', Buffer.from('const menu = { label: "Settings", title: "Open", buttonLabel: "Save" };\n')],
    ['dist/menu.js', Buffer.from('const menu = { label: "Quit" };\n')],
    ['dist/tray.js', Buffer.from("const count = 2;\nconst label = (count > 0 ? `${count}` : 'No') + ' agent' + (count === 1 ? '' : 's') + ' running';\n")],
    ['dist/ipcHandlers.js', Buffer.from('const dialog = { buttonLabel: "Open" };\n')],
    ['assets/unchanged.bin', Buffer.from([0, 255, 128, 42, 0])],
    ['bin/fixture', Buffer.from('#!/bin/sh\nexit 0\n')],
  ]);
  const header = { files: {} };
  const entries = new Map();
  let offset = 0;
  for (const [key, bytes] of contents) {
    const parts = key.split('/');
    let files = header.files;
    for (const part of parts.slice(0, -1)) files = (files[part] ??= { files: {} }).files;
    const blockSize = 32;
    const entry = {
      size: bytes.length, offset: String(offset),
      integrity: {
        algorithm: 'SHA256', hash: sha(bytes), blockSize,
        blocks: Array.from({ length: Math.ceil(bytes.length / blockSize) }, (_, i) => sha(bytes.subarray(i * blockSize, (i + 1) * blockSize))),
      },
    };
    if (key === 'bin/fixture') entry.executable = true;
    files[parts.at(-1)] = entry;
    entries.set(key, entry);
    offset += bytes.length;
  }
  const unpacked = { size: 4, unpacked: true };
  const link = { link: 'assets/unchanged.bin' };
  header.files.native = { files: { 'fixture.node': unpacked } };
  header.files['fixture-link'] = link;
  entries.set('native/fixture.node', unpacked);
  entries.set('fixture-link', link);
  writeAsar({ header, entries, get: key => contents.get(key) }, new Map(), destination);
  return contents;
}

export function fixtureInNewDirectory(prefix = 'fixture-') {
  const directory = fs.mkdtempSync(path.join(outputRoot, prefix));
  const archive = path.join(directory, 'app.asar');
  createFixture(archive);
  return { directory, archive };
}
