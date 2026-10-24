import fs from 'node:fs';
import crypto from 'node:crypto';

const hash = data => crypto.createHash('sha256').update(data).digest('hex');

// Preserve the archive tree, executable flags, links, unpacked entries and per-file
// integrity metadata. No npm downloads or native modules are needed.
export function readAsar(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 16 || bytes.readUInt32LE(0) !== 4) throw Error('不是有效的 ASAR 文件');
  const headerSize = bytes.readUInt32LE(4);
  const jsonSize = bytes.readUInt32LE(12);
  if (headerSize < jsonSize + 8 || 8 + headerSize > bytes.length) throw Error('ASAR 文件头损坏');
  const header = JSON.parse(bytes.subarray(16, 16 + jsonSize).toString('utf8'));
  const dataOffset = 8 + headerSize;
  const entries = new Map();
  function visit(files, prefix = '') {
    for (const [name, entry] of Object.entries(files)) {
      const key = prefix + name;
      if (entry.files) visit(entry.files, key + '/');
      else entries.set(key, entry);
    }
  }
  visit(header.files);
  function get(key) {
    const entry = entries.get(key);
    if (!entry || entry.link || entry.unpacked) throw Error('不支持的归档文件：' + key);
    const start = dataOffset + Number(entry.offset);
    if (!Number.isSafeInteger(start) || start < dataOffset || start + entry.size > bytes.length) throw Error('ASAR 文件范围异常：' + key);
    return bytes.subarray(start, start + entry.size);
  }
  return { header, entries, get };
}

export function writeAsar(archive, replacements, destination) {
  const header = structuredClone(archive.header);
  const chunks = [];
  let offset = 0;
  function visit(files, prefix = '') {
    for (const [name, entry] of Object.entries(files)) {
      const key = prefix + name;
      if (entry.files) { visit(entry.files, key + '/'); continue; }
      if (entry.unpacked || entry.link) continue;
      const bytes = replacements.has(key) ? Buffer.from(replacements.get(key)) : archive.get(key);
      entry.offset = String(offset);
      entry.size = bytes.length;
      if (replacements.has(key) && entry.integrity) {
        const blockSize = entry.integrity.blockSize || 4194304;
        if (entry.integrity.algorithm !== 'SHA256') throw Error('未知的 ASAR 校验算法');
        const blocks = [];
        for (let i = 0; i < bytes.length; i += blockSize) blocks.push(hash(bytes.subarray(i, i + blockSize)));
        entry.integrity = { algorithm: 'SHA256', hash: hash(bytes), blockSize, blocks };
      }
      chunks.push(bytes);
      offset += bytes.length;
    }
  }
  for (const key of replacements.keys()) if (!archive.entries.has(key)) throw Error('归档中找不到：' + key);
  visit(header.files);
  const json = Buffer.from(JSON.stringify(header));
  const payloadSize = Math.ceil((json.length + 4) / 4) * 4;
  const headerBuffer = Buffer.alloc(4 + payloadSize);
  headerBuffer.writeUInt32LE(payloadSize, 0);
  headerBuffer.writeUInt32LE(json.length, 4);
  json.copy(headerBuffer, 8);
  const sizeBuffer = Buffer.alloc(8);
  sizeBuffer.writeUInt32LE(4, 0);
  sizeBuffer.writeUInt32LE(headerBuffer.length, 4);
  fs.writeFileSync(destination, Buffer.concat([sizeBuffer, headerBuffer, ...chunks]));
  const check = readAsar(destination);
  for (const [key, bytes] of replacements) if (!check.get(key).equals(Buffer.from(bytes))) throw Error('写入校验失败：' + key);
}
