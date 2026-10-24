import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { readAsar } from '../asar.mjs';
import { buildRuntime, patchArchive, cleanPreload } from '../patch.mjs';
import { outputRoot, fixtureInNewDirectory } from './fixture.mjs';

const root = outputRoot;
const runtime = buildRuntime();
const require = createRequire(import.meta.url);
const modulePath = process.env.PLAYWRIGHT_PATH;
const { chromium } = require(modulePath || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<html><body></body></html>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const results = [];
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.setContent(`<!doctype html><html lang="en"><body>
    <nav><button id="settings"> Settings </button><button id="count">See all (8)</button></nav>
    <input id="input" value="Save" placeholder="Search conversations..." aria-label="Message input">
    <textarea id="textarea" placeholder="Write a comment...">Save</textarea>
    <div contenteditable="true" id="editable"><p id="nested-editable">Save</p></div>
    <div id="prose" data-testid="commentable-content"><p>Save</p><button id="copy">Copy</button><pre>Run</pre></div>
    <div data-testid="user-message-bubble"><p id="user">Default</p></div>
    <div class="md-divider-spacing"><p id="agent-response">Save</p></div>
    <div data-testid="project-header" id="project" title="Settings" aria-label="Settings">Settings</div>
    <div data-testid="conversation-row-sidebar"><a id="convo" href="/c/abc" title="Settings" aria-label="Settings">Settings</a><span id="convo-title">Save</span><button id="pin" aria-label="Pin conversation"></button></div>
    <button id="model" data-testid="model-selector-trigger" aria-label="Select model, current: Gemini 3.8 Flash Medium" title="Default">Default</button>
    <button id="preset" aria-label="Agent permissions preset selector, current: Turbo">Turbo</button>
    <div class="monaco-editor"><span id="code">Run</span></div>
    <div class="xterm"><span id="terminal">Save</span></div>
    <div id="ignored" translate="no">Save</div>
    <span class="google-symbols" id="glyph">search</span>
    <div class="font-mono"><span id="preview-code">name</span></div>
    <span id="slug">automation</span>
    <iframe id="artifact" srcdoc="<p>Save</p>"></iframe>
    <div id="long">Controls whether terminal commands require your approval before running.\n\nNote: A change to this setting will only apply to new messages sent to the agent. In-progress responses will use the previous setting value.</div>
    <div id="dynamic"></div>
  </body></html>`);
  await page.evaluate(runtime);
  const state = await page.evaluate(() => {
    const el = id => document.getElementById(id);
    return { lang: document.documentElement.lang, settings: el('settings').textContent, count: el('count').textContent,
      input: [el('input').value, el('input').placeholder, el('input').getAttribute('aria-label')],
      textarea: [el('textarea').value, el('textarea').placeholder], editable: el('nested-editable').textContent,
      prose: el('prose').querySelector('p').textContent, copy: el('copy').textContent, user: el('user').textContent,
      project: [el('project').textContent, el('project').title, el('project').getAttribute('aria-label')],
      convo: [el('convo').textContent, el('convo').title, el('convo').getAttribute('aria-label'), el('convo-title').textContent],
      pin: el('pin').getAttribute('aria-label'), model: [el('model').textContent, el('model').title, el('model').getAttribute('aria-label')],
      preset: [el('preset').textContent, el('preset').getAttribute('aria-label')],
      protected: ['code', 'terminal', 'ignored', 'glyph'].map(id => el(id).textContent),
      artifact: el('artifact').contentDocument.body.textContent, long: el('long').textContent };
  });
  assert.equal(state.lang, 'zh-CN');
  assert.equal(state.settings, ' 设置 ');
  assert.equal(state.count, '查看全部 (8)');
  assert.deepEqual(state.input, ['Save', '搜索对话...', '消息输入框']);
  assert.deepEqual(state.textarea, ['Save', '撰写评论...']);
  assert.equal(state.editable, 'Save');
  assert.equal(state.prose, 'Save');
  assert.equal(state.user, 'Default');
  assert.equal(await page.locator('#agent-response').textContent(), 'Save');
  assert.equal(state.copy, '复制');
  assert.deepEqual(state.project, ['Settings', 'Settings', 'Settings']);
  assert.deepEqual(state.convo, ['Settings', 'Settings', 'Settings', 'Save']);
  assert.equal(state.pin, '置顶对话');
  assert.deepEqual(state.model, ['Default', 'Default', '选择模型，当前：Gemini 3.8 Flash Medium']);
  assert.deepEqual(state.preset, ['无限制', '选择代理权限预设，当前：无限制']);
  assert.deepEqual(state.protected, ['Run', 'Save', 'Save', 'search']);
  assert.equal(state.artifact, 'Save');
  assert.equal(await page.locator('#preview-code').textContent(), 'name');
  assert.equal(await page.locator('#slug').textContent(), 'automation');
  assert.match(state.long, /^控制终端命令/);
  results.push('初始界面、动态计数、输入框提示、无障碍标签和长说明翻译通过');
  results.push('用户消息、项目名、对话名、模型名、编辑器、终端、图标和 iframe 内容保护通过');

  await page.evaluate(() => {
    document.getElementById('settings').firstChild.nodeValue = 'Save';
    document.getElementById('nested-editable').firstChild.nodeValue = 'Delete';
    document.getElementById('terminal').firstChild.nodeValue = 'Run';
    const dynamic = document.getElementById('dynamic');
    dynamic.innerHTML = '<div><button id="late" title="Close">Run</button><div contenteditable="true"><span id="late-user">Save</span></div></div>';
    document.getElementById('input').setAttribute('placeholder', 'Search workspaces...');
    document.getElementById('input').setAttribute('aria-label', 'Search');
  });
  await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(() => ['settings','nested-editable','terminal','late','late-user'].map(id => document.getElementById(id).textContent)), ['保存','Delete','Run','运行','Save']);
  assert.equal(await page.locator('#late').getAttribute('title'), '关闭');
  assert.equal(await page.locator('#input').getAttribute('placeholder'), '搜索工作区...');
  assert.equal(await page.locator('#input').getAttribute('aria-label'), '搜索');
  const count = await page.evaluate(() => globalThis.__antigravityChineseLocalization.changes);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => globalThis.__antigravityChineseLocalization.changes), count, '观察器不应循环翻译');
  await page.evaluate(runtime);
  assert.equal(await page.evaluate(() => globalThis.__antigravityChineseLocalization.changes), count, '重复注入应无副作用');
  results.push('动态添加节点、现有文本更新、属性更新、编辑区保护和无循环观察器通过');
  const external = await browser.newPage();
  await external.setContent('<button>Save</button>');
  await external.evaluate(runtime);
  assert.equal(await external.locator('button').textContent(), 'Save');
  results.push('非本地应用页面不注入通过');
  await page.screenshot({ path: path.join(root, 'test-result.png'), fullPage: true });

  const app = process.argv[2] || fixtureInNewDirectory('browser-archive-').archive;
  if (app) {
    const output = path.join(root, 'app.test.asar');
    const twice = path.join(root, 'app.test.twice.asar');
    const report = patchArchive(app, output);
    patchArchive(output, twice);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex'), crypto.createHash('sha256').update(fs.readFileSync(twice)).digest('hex'));
    const original = readAsar(app);
    const patched = readAsar(output);
    for (const [key, entry] of original.entries) {
      if (entry.unpacked || entry.link) assert.deepEqual(patched.entries.get(key), entry);
    }
    assert.equal(cleanPreload(patched.get('dist/preload.js').toString()), cleanPreload(original.get('dist/preload.js').toString()));
    assert.equal(cleanPreload('official();\n// Antigravity Chinese Localization Injection\n(function(){})();\n'), 'official();\n');
    results.push(`ASAR 全量未修改文件校验、原始 preload 保留、旧补丁迁移与重复安装幂等性通过（${report.appVersion}）`);
  }
  fs.writeFileSync(path.join(root, 'verification.json'), JSON.stringify({ passed: true, results, verifiedAt: new Date().toISOString() }, null, 2));
  console.log(results.join('\n'));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
