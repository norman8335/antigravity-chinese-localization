import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readAsar, writeAsar } from './asar.mjs';

export const VERSION = '2.1.0';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BEGIN = '// BEGIN ANTIGRAVITY CHINESE LOCALIZATION';
const END = '// END ANTIGRAVITY CHINESE LOCALIZATION';
const LEGACY = '// Antigravity Chinese Localization Injection';
const PRELOAD = 'dist/preload.js';
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function loadDictionary() {
  const entries = {};
  const source = fs.readFileSync(path.join(ROOT, 'translations.txt'), 'utf8');
  for (const [i, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim() || line.startsWith('#')) continue;
    const split = line.indexOf('|');
    if (split < 1 || !line.slice(split + 1).trim()) throw Error(`词库第 ${i + 1} 行格式错误`);
    const en = line.slice(0, split).replace(/\\n/g, '\n');
    const zh = line.slice(split + 1);
    if (entries[en] && entries[en] !== zh) throw Error('词库中有冲突的译文：' + en);
    entries[en] = zh;
  }
  return entries;
}

export function buildRuntime() {
  const template = fs.readFileSync(path.join(ROOT, 'localization.js'), 'utf8');
  if (!template.includes('/*__DICTIONARY__*/ {}')) throw Error('汉化模板缺少词库插槽');
  const code = template.replace('/*__DICTIONARY__*/ {}', JSON.stringify(loadDictionary()));
  new vm.Script(code, { filename: 'antigravity-zh.js' });
  return code;
}

export function cleanPreload(source) {
  const begin = source.indexOf(BEGIN);
  if (begin >= 0) {
    const end = source.indexOf(END, begin);
    if (end < 0) throw Error('已有汉化标记不完整，拒绝覆盖原文件');
    source = source.slice(0, begin).trimEnd() + source.slice(end + END.length);
  }
  const legacy = source.indexOf(LEGACY);
  if (legacy >= 0) {
    const tail = source.slice(legacy);
    if (!tail.trimEnd().endsWith('})();')) throw Error('旧汉化结构异常，请先还原后再安装');
    source = source.slice(0, legacy);
  }
  return source.trimEnd() + '\n';
}

export function patchArchive(input, output) {
  const archive = readAsar(input);
  const pkg = JSON.parse(archive.get('package.json').toString());
  if (pkg.name !== 'antigravity' || pkg.main !== 'dist/main.js') throw Error('目标不是兼容的 Antigravity 桌面应用');
  const original = archive.get(PRELOAD).toString('utf8');
  if (!original.includes('contextBridge.exposeInMainWorld')) throw Error('不兼容的 preload.js，未修改应用');
  const content = cleanPreload(original) + '\n' + BEGIN + '\n' + buildRuntime() + '\n' + END + '\n';
  new vm.Script(content, { filename: PRELOAD });
  const replacements = new Map([[PRELOAD, Buffer.from(content)]]);
  // Translate fixed native menu/dialog labels only, never IDs, role keys or handlers.
  // The renderer's custom titlebar menus are handled by localization.js.
  const dictionary = loadDictionary();
  for (const key of ['dist/main.js', 'dist/menu.js', 'dist/tray.js', 'dist/ipcHandlers.js']) {
    if (!archive.entries.has(key)) continue;
    let code = archive.get(key).toString('utf8');
    if (key.endsWith('.js')) {
      code = code.replace(/\b(label|title|buttonLabel): (['"])([^'"\n]+)\2/g, (whole, property, quote, en) => {
        return dictionary[en] ? `${property}: ${JSON.stringify(dictionary[en])}` : whole;
      });
      if (key === 'dist/main.js') code = code.replace('label: `Open ${electron_1.app.getName()}`', 'label: `打开 ${electron_1.app.getName()}`');
      if (key === 'dist/tray.js') code = code.replace(/\(count > 0 \? `\$\{count\}` : 'No'\)\s*\+\s*' agent'\s*\+\s*\(count === 1 \? '' : 's'\)\s*\+\s*' running'/, '(count > 0 ? `${count} 个代理正在运行` : "没有正在运行的代理")');
      new vm.Script(code, { filename: key });
    }
    if (code !== archive.get(key).toString('utf8')) replacements.set(key, Buffer.from(code));
  }
  writeAsar(archive, replacements, output);
  const check = readAsar(output);
  // Check every untouched entry byte-for-byte, including the reference to unpacked native modules.
  for (const [key, entry] of archive.entries) {
    if (entry.unpacked || entry.link || replacements.has(key)) continue;
    if (!archive.get(key).equals(check.get(key))) throw Error('归档校验失败：' + key);
  }
  return { appVersion: pkg.version, localizationVersion: VERSION, entries: Object.keys(dictionary).length, modified: [...replacements.keys()] };
}

function resourcesPath(explicit) {
  const candidates = [explicit, process.env.ANTIGRAVITY_RESOURCES,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'antigravity', 'resources'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Antigravity', 'resources'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'antigravity', 'resources'),
  ].filter(Boolean);
  if (explicit || process.env.ANTIGRAVITY_RESOURCES) return path.resolve(candidates[0]);
  const found = candidates.find(p => fs.existsSync(path.join(p, 'app.asar')));
  if (!found) throw Error('找不到 Antigravity。请使用 --resources 指定 resources 目录。');
  return found;
}

function ensureClosed(resources) {
  if (process.platform !== 'win32') return;
  // Archive fixtures and offline build directories have no runnable application.
  if (!fs.existsSync(path.join(path.dirname(resources), 'Antigravity.exe'))) return;
  const running = execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq Antigravity.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
  if (/"Antigravity\.exe"/i.test(running)) throw Error('请先完全退出 Antigravity（包括系统托盘中的后台进程），再运行此脚本。不会强制结束你的任务。');
}

function replaceFile(from, to) {
  // Use rename on the same volume; an interrupted copy never leaves a partial app.asar.
  const temp = to + '.zh-staging';
  try {
    fs.copyFileSync(from, temp, fs.constants.COPYFILE_EXCL);
    if (sha(from) !== sha(temp)) throw Error('文件复制校验失败');
    fs.renameSync(temp, to);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

export function install(resources) {
  ensureClosed(resources);
  const target = path.join(resources, 'app.asar');
  const metadata = path.join(resources, 'antigravity-zh-backup.json');
  const archive = readAsar(target);
  const preload = archive.get(PRELOAD).toString();
  const version = JSON.parse(archive.get('package.json').toString()).version;
  let meta = fs.existsSync(metadata) ? JSON.parse(fs.readFileSync(metadata, 'utf8')) : undefined;
  const patched = preload.includes(BEGIN) || preload.includes(LEGACY);
  const currentHash = sha(target);
  if (!patched) {
    const backupName = `app.asar.zh-original-${version}-${currentHash.slice(0, 12)}.backup`;
    const backup = path.join(resources, backupName);
    if (!fs.existsSync(backup)) fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
    if (sha(backup) !== currentHash) throw Error('原版备份校验失败');
    meta = { appVersion: version, backupName, originalSha256: currentHash };
  } else if (!meta || meta.appVersion !== version || !meta.backupName || !fs.existsSync(path.join(resources, path.basename(meta.backupName)))) {
    // Migrate a legacy backup only when the application version matches.
    const legacy = path.join(resources, 'app.asar.backup');
    if (!fs.existsSync(legacy)) throw Error('已有补丁但找不到同版本原版备份，请先用官方安装包修复后重试。');
    const old = readAsar(legacy);
    if (JSON.parse(old.get('package.json').toString()).version !== version || /Antigravity Chinese Localization|BEGIN ANTIGRAVITY CHINESE/.test(old.get(PRELOAD).toString())) throw Error('旧备份不是同版本原版，未修改应用。');
    meta = { appVersion: version, backupName: 'app.asar.backup', originalSha256: sha(legacy) };
  }
  const temp = path.join(resources, `app.asar.zh-build-${process.pid}`);
  try {
    const report = patchArchive(target, temp);
    // Persist backup metadata before replacement so a failed install can still restore.
    fs.writeFileSync(metadata, JSON.stringify({ ...meta, localizationVersion: VERSION, installedAt: new Date().toISOString(), patchedSha256: sha(temp) }, null, 2) + '\n');
    replaceFile(temp, target);
    console.log('汉化已安装，启动 Antigravity 即可生效。');
    console.log(JSON.stringify({ ...report, backup: path.join(resources, meta.backupName) }, null, 2));
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

export function restore(resources) {
  ensureClosed(resources);
  const target = path.join(resources, 'app.asar');
  const metadata = path.join(resources, 'antigravity-zh-backup.json');
  const current = readAsar(target);
  const version = JSON.parse(current.get('package.json').toString()).version;
  let backup;
  if (fs.existsSync(metadata)) {
    const meta = JSON.parse(fs.readFileSync(metadata, 'utf8'));
    if (meta.appVersion !== version) throw Error('软件已更新，旧备份不适用于当前版本。请先重新安装汉化以建立当前版本备份。');
    backup = path.join(resources, path.basename(meta.backupName));
    if (sha(backup) !== meta.originalSha256) throw Error('原版备份校验失败，未修改应用。');
  } else backup = path.join(resources, 'app.asar.backup');
  const original = readAsar(backup);
  if (JSON.parse(original.get('package.json').toString()).version !== version) throw Error('备份版本与当前软件不一致，拒绝降级还原。');
  if (original.get(PRELOAD).toString().includes(BEGIN) || original.get(PRELOAD).toString().includes(LEGACY)) throw Error('备份中包含汉化，无法作为原版还原。');
  replaceFile(backup, target);
  console.log('已还原当前版本的官方原版。备份保留，可随时重新安装汉化。');
}

function status(resources) {
  const archive = readAsar(path.join(resources, 'app.asar'));
  const preload = archive.get(PRELOAD).toString();
  console.log(JSON.stringify({ resources, appVersion: JSON.parse(archive.get('package.json').toString()).version,
    localization: preload.includes(BEGIN) ? '已安装新版汉化' : preload.includes(LEGACY) ? '已安装旧版汉化' : '未安装',
    availableVersion: VERSION, dictionaryEntries: Object.keys(loadDictionary()).length }, null, 2));
}

function main() {
  const args = process.argv.slice(2);
  const action = args.shift() || 'status';
  if (!['install', 'restore', 'status', 'build', 'runtime'].includes(action)) throw Error('用法：node patch.mjs install|restore|status|build|runtime [--resources 路径] [--output 路径]');
  const options = {};
  while (args.length) {
    const key = args.shift();
    if (!['--resources', '--output'].includes(key) || !args.length) throw Error('未知参数：' + key);
    options[key] = args.shift();
  }
  if (action === 'runtime') {
    if (!options['--output']) throw Error('runtime 需要 --output');
    fs.writeFileSync(options['--output'], buildRuntime());
    return;
  }
  const resources = resourcesPath(options['--resources']);
  if (action === 'build') {
    if (!options['--output']) throw Error('build 需要 --output');
    if (path.resolve(options['--output']) === path.join(resources, 'app.asar')) throw Error('build 不能直接覆盖应用，请使用 install。');
    console.log(JSON.stringify(patchArchive(path.join(resources, 'app.asar'), options['--output']), null, 2));
  } else if (action === 'install') install(resources);
  else if (action === 'restore') restore(resources);
  else status(resources);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error('[错误]', error.message); process.exitCode = 1; }
}
