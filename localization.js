/* Antigravity Chinese Localization v2. Only local application chrome is translated. */
(function () {
  'use strict';
  const VERSION = '2.1.0';
  const dictionary = /*__DICTIONARY__*/ {};
  if (window.top !== window || !['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) return;
  if (globalThis.__antigravityChineseLocalization) return;

  const normalize = value => value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().replace(/…/g, '...');
  const exactWords = new Map(Object.entries(dictionary).map(([en, zh]) => [normalize(en), zh]));
  const words = new Map(Object.entries(dictionary).map(([en, zh]) => [normalize(en).toLowerCase(), zh]));
  const HARD = 'script,style,noscript,code,pre,kbd,samp,svg,math,iframe,webview,.font-mono,.shiki,.google-symbols,.material-icons,.material-symbols-outlined,.codicon,[data-icon],.monaco-editor,.xterm,.cm-editor,.view-lines,[translate="no"],.notranslate,[data-antigravity-zh-ignore]';
  const EDITABLE = 'textarea,input,[contenteditable]:not([contenteditable="false"])';
  const CONTENT = '[data-testid="commentable-content"],[data-testid="user-message-bubble"],[data-testid="artifact-view"],[data-testid="sidecar-logs-content"],.md-divider-spacing,.rendered-markdown,.markdown-body,.markdown-content,.md-table-scroll,.notebook-cell,[data-message-author-role]';
  const NAMES = '[data-testid="project-header"],[data-testid="project-selector-trigger"],[data-testid="project-selector-item"],[data-testid="model-selector-trigger"],[data-testid="model-selector-item"],[data-testid="model-selector-custom-item"],[data-testid="file-title-name"],[data-testid="subagent-tab-header-title"],[data-testid="conversation-row-sidebar"],[data-testid="conversation-row"],a[href*="/c/"],[data-project-label]';
  const CONTROL = 'button,[role="button"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';
  const ATTRS = ['title', 'aria-label', 'aria-description', 'placeholder', 'data-placeholder'];
  let changes = 0;

  function translate(value) {
    if (typeof value !== 'string' || !value.trim()) return value;
    const key = normalize(value);
    // Lowercase slugs such as "automation" and "plugin" are identifiers, not labels.
    let result = exactWords.get(key) || (/^[A-Z]/.test(key) ? words.get(key.toLowerCase()) : undefined);
    if (!result) {
      let m;
      if ((m = /^(See all|Show more|Show less|Comments|Conversations|Files Changed|Background Tasks|Subagents|Artifacts|Terminals|Projects)\s*\((\d+)\)$/i.exec(key))) {
        const prefix = words.get(m[1].toLowerCase());
        if (prefix) result = `${prefix} (${m[2]})`;
      } else if ((m = /^(Select project|Select model|Agent permissions preset selector), current: (.+)$/i.exec(key))) {
        const prefix = { 'select project': '选择项目', 'select model': '选择模型', 'agent permissions preset selector': '选择代理权限预设' }[m[1].toLowerCase()];
        const current = m[1].toLowerCase().startsWith('agent') ? translate(m[2]) : m[2];
        result = `${prefix}，当前：${current}`;
      } else if ((m = /^Settings - (Account|General|Application|App|Appearance|Notifications|Models|Customizations|Developer|Editor|Browser)$/i.exec(key))) {
        result = `设置 - ${translate(m[1])}`;
      } else if ((m = /^Manage (Antigravity|Gemini|Jetski) app settings\.$/.exec(key))) {
        result = `管理 ${m[1]} 应用设置。`;
      } else if ((m = /^(\d+) (second|minute|hour|day|week)s? ago$/i.exec(key))) {
        result = `${m[1]}${{ second: '秒', minute: '分钟', hour: '小时', day: '天', week: '周' }[m[2].toLowerCase()]}前`;
      } else if ((m = /^You have used some of your weekly limit, it will fully refresh in ([\d\s,a-z]+)\.$/.exec(key))) {
        const duration = m[1].replace(/(\d+) (days?|hours?|minutes?|seconds?)/g, (_, n, unit) => n + ({ day: '天', hour: '小时', minute: '分钟', second: '秒' }[unit.replace(/s$/, '')])).replace(/,\s*/g, ' ');
        result = `你已使用部分每周配额，将在 ${duration}后全部重置。`;
      } else if ((m = /^Show (\d+) breakdowns?$/.exec(key))) {
        result = `显示 ${m[1]} 项明细`;
      }
    }
    return result ? value.replace(/^\s*.*?\s*$/s, match => match.match(/^\s*/)[0] + result + match.match(/\s*$/)[0]) : value;
  }

  function textIsProtected(el) {
    if (!el || el.closest(HARD + ',' + EDITABLE)) return true;
    const control = el.closest(CONTROL);
    const name = el.closest(NAMES);
    if (name && (!control || name === control || !name.contains(control))) return true;
    return !!el.closest(CONTENT) && !control;
  }

  function text(node) {
    if (textIsProtected(node.parentElement)) return;
    const instruction = normalize(node.nodeValue).toLowerCase() === 'type' && node.parentElement.querySelector('code') && /and select|并选择/.test(node.parentElement.textContent);
    const next = instruction ? node.nodeValue.replace(/Type/i, '输入') : translate(node.nodeValue);
    if (next !== node.nodeValue) { node.nodeValue = next; changes++; }
  }

  function attributes(el) {
    if (el.closest(HARD)) return;
    // Conversation/project names are also exposed through title and aria-label.
    // Only actual UI controls inside those rows may have their labels translated.
    const name = el.closest(NAMES);
    const control = el.closest(CONTROL);
    const isSelector = el.matches('[data-testid="project-selector-trigger"],[data-testid="model-selector-trigger"]');
    if (name && !isSelector && (!control || name === control || !name.contains(control))) return;
    if (el.closest(CONTENT) && !control) return;
    for (const attr of ATTRS) {
      const old = el.getAttribute(attr);
      if (old === null) continue;
      // Selector titles can be user-defined names; only the structured aria label is UI.
      if (isSelector && attr !== 'aria-label') continue;
      const next = translate(old);
      if (next !== old) { el.setAttribute(attr, next); changes++; }
    }
  }

  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) { text(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE || root.matches(HARD)) return;
    attributes(root);
    if (root.matches(EDITABLE)) return;
    for (let child = root.firstChild; child; child = child.nextSibling) walk(child);
  }

  function start() {
    if (!document.body) return;
    document.documentElement.lang = 'zh-CN';
    const pending = new Set();
    let timer;
    const flush = () => {
      timer = undefined;
      const roots = [...pending];
      pending.clear();
      // Deduplicate nested additions without rescanning the entire document.
      const rootSet = new Set(roots);
      for (const root of roots) {
        if (!root.isConnected) continue;
        let parent = root.parentNode;
        while (parent && !rootSet.has(parent)) parent = parent.parentNode;
        if (!parent) walk(root);
      }
    };
    walk(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes') attributes(record.target);
        else if (record.type === 'characterData') text(record.target);
        else for (const node of record.addedNodes) pending.add(node);
      }
      if (pending.size && timer === undefined) timer = setTimeout(flush, 16);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    Object.defineProperty(globalThis, '__antigravityChineseLocalization', {
      value: Object.freeze({ version: VERSION, entries: words.size, get changes() { return changes; } }),
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
