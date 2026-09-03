// ==UserScript==
// @name         Douyin Spark Helper (Local)
// @namespace    https://github.com/zero-k-spark
// @version      1.0.1
// @description  Local conversation selection and dry-run helper for Douyin web messages.
// @match        https://www.douyin.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'zero-k-spark:tampermonkey:v1';
  const DEFAULTS = {
    enabled: false,
    dryRun: true,
    template: '你好，[好友昵称]，今天也顺顺利利。',
    targets: [],
    sentOn: {},
    panelPosition: null,
  };

  // Centralize target-page selectors so updates do not affect panel behavior.
  const SELECTORS = {
    conversationItems: [
      '[data-e2e*="conversation"]',
      '[data-e2e*="message"] [data-e2e*="item"]',
      '[class*="conversation"] [role="listitem"]',
      '[class*="message-list"] [role="listitem"]',
      '[class*="chat-list"] > *',
      '[class*="conversation-list"] > *',
    ],
    conversationTitle: [
      '[data-e2e*="conversation-title"]',
      '[data-e2e*="chat-title"]',
      '[class*="message-detail"] h1',
      '[class*="message-detail"] h2',
      '[class*="chat-detail"] h1',
      '[class*="chat-detail"] h2',
    ],
    messageInput: '[contenteditable="true"], textarea',
    sendButton: 'button[type="submit"], [data-e2e*="send"], [class*="send-button"]',
  };

  const state = loadState();
  let panel;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        ...DEFAULTS,
        ...saved,
        targets: Array.isArray(saved.targets) ? saved.targets : [],
        sentOn: saved.sentOn && typeof saved.sentOn === 'object' ? saved.sentOn : {},
      };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function today() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    }[char]));
  }

  function isVisible(node) {
    const style = window.getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
  }

  function textLines(node) {
    return (node.getAttribute('aria-label') || node.innerText || node.textContent || '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  function uniqueNodes(nodes) {
    return [...new Set(nodes)].filter((node) => node instanceof Element && !panel?.contains(node) && isVisible(node));
  }

  function displayName(node) {
    return textLines(node).find((line) => (
      line.length <= 48
      && !/^(消息|搜索|置顶|已读|未读|刚刚|昨天|\d{1,2}:\d{2})$/.test(line)
    )) || '';
  }

  function getConversationNodes() {
    const nodes = SELECTORS.conversationItems.flatMap((selector) => [...document.querySelectorAll(selector)]);
    // Some message-list builds do not expose a stable list-item selector. Infer
    // a row from its avatar only when the surrounding text is short enough to be
    // a conversation preview, which keeps page-level containers out of the list.
    document.querySelectorAll('img, [class*="avatar"]').forEach((avatar) => {
      let current = avatar.parentElement;
      for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
        const text = (current.innerText || '').trim();
        const rect = current.getBoundingClientRect();
        if (text && text.length <= 180 && rect.height >= 32 && rect.height <= 180 && rect.width >= 100) {
          nodes.push(current);
          break;
        }
      }
    });
    return uniqueNodes(nodes)
      .map((node) => ({ node, name: displayName(node) }))
      .filter(({ node, name }) => name && node.querySelector('img, [class*="avatar"]'));
  }

  function closestConversationNode(node) {
    let current = node;
    for (let depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
      if (current.matches('a, button, [role="listitem"], li') || current.querySelector('img, [class*="avatar"]')) return current;
    }
    return node;
  }

  function findConversationNode(name) {
    const exact = getConversationNodes().find((item) => item.name === name);
    if (exact) return exact.node;

    // Manual targets use a limited text fallback. Prefer the smallest visible match
    // to avoid treating the entire message page as one conversation.
    const matches = uniqueNodes([...document.querySelectorAll('a, button, [role="listitem"], li, div, span')])
      .filter((node) => textLines(node).includes(name))
      .sort((left, right) => (left.innerText || '').length - (right.innerText || '').length);
    return matches.length ? closestConversationNode(matches[0]) : null;
  }

  function resolveMessage(name) {
    return state.template
      .replaceAll('[日期]', new Intl.DateTimeFormat('zh-CN').format(new Date()))
      .replaceAll('[好友昵称]', name)
      .replaceAll('[天数]', '');
  }

  function notify(message, level = 'info') {
    const output = panel?.querySelector('[data-role="status"]');
    if (!output) return;
    output.textContent = message;
    output.dataset.level = level;
  }

  function updateTargets(names) {
    state.targets = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    saveState();
  }

  function renderTargets() {
    const list = panel.querySelector('[data-role="targets"]');
    const discovered = getConversationNodes().map((item) => item.name);
    const names = [...new Set([...discovered, ...state.targets])];
    list.innerHTML = names.length
      ? names.map((name) => `<label><input type="checkbox" data-name="${escapeHtml(name)}" ${state.targets.includes(name) ? 'checked' : ''}><span>${escapeHtml(name)}</span></label>`).join('')
      : '<p>未识别到会话。可手动输入昵称后添加，再执行定位验证。</p>';
    list.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener('change', () => {
        const name = input.dataset.name;
        updateTargets(input.checked ? [...state.targets, name] : state.targets.filter((target) => target !== name));
      });
    });
    notify(discovered.length ? `已识别 ${discovered.length} 个会话。` : '未自动识别会话，可使用手动添加。');
  }

  function addManualTarget() {
    const input = panel.querySelector('[data-role="manual-target"]');
    const name = input.value.trim();
    if (!name) return notify('请输入好友昵称或备注名。', 'warning');
    updateTargets([...state.targets, name]);
    input.value = '';
    renderTargets();
    notify(`已添加“${name}”，执行时将定位对应会话。`, 'success');
  }

  async function waitFor(check, timeout = 5000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const result = check();
      if (result) return result;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return null;
  }

  function activeTitleMatches(name) {
    const titleNodes = [
      ...SELECTORS.conversationTitle.flatMap((selector) => [...document.querySelectorAll(selector)]),
      ...document.querySelectorAll('h1, h2'),
    ];
    return uniqueNodes(titleNodes).some((node) => textLines(node).some((line) => line.includes(name)));
  }

  function writeMessage(input, message) {
    input.focus();
    if (input.matches('textarea, input')) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
        || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(input, message);
    } else {
      const range = document.createRange();
      range.selectNodeContents(input);
      range.deleteContents();
      range.insertNode(document.createTextNode(message));
    }
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: message }));
  }

  function inputText(input) {
    return (input.value || input.textContent || '').replace(/\s+/g, ' ').trim();
  }

  async function sendMessage(message) {
    const input = await waitFor(() => document.querySelector(SELECTORS.messageInput));
    if (!input) return '未找到消息输入框。';
    writeMessage(input, message);
    const sendButton = await waitFor(() => document.querySelector(SELECTORS.sendButton));
    if (!sendButton) return '未找到发送按钮。';
    sendButton.click();
    const sent = await waitFor(() => inputText(input) !== message.replace(/\s+/g, ' ').trim(), 3000);
    return sent ? '' : '消息未离开输入框，未标记为发送成功。';
  }

  async function run() {
    if (!state.enabled) return notify('请先在面板中勾选“启用任务”。', 'warning');
    const missing = state.targets.filter((name) => !findConversationNode(name));
    if (missing.length) return notify(`未找到会话：${missing.join('、')}。请打开私信列表后刷新。`, 'warning');
    const targets = state.targets
      .filter((name) => state.sentOn[name] !== today())
      .map((name) => ({ name, node: findConversationNode(name) }));
    if (!targets.length) return notify('没有可执行的会话，或所选好友今天已处理。', 'warning');

    for (const { name, node } of targets) {
      notify(`正在验证会话：${name}`);
      node.click();
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (!activeTitleMatches(name)) return notify(`已停止：当前会话标题与“${name}”不一致。`, 'error');
      const message = resolveMessage(name);
      if (state.dryRun) {
        console.info('[Spark Helper] Dry run:', { recipient: name, message });
        continue;
      }
      const error = await sendMessage(message);
      if (error) return notify(`“${name}”发送失败：${error}`, 'error');
      state.sentOn[name] = today();
      saveState();
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    notify(state.dryRun ? '验证完成：未发送任何消息。' : '任务完成。', 'success');
  }

  function applyPanelPosition(root) {
    if (!state.panelPosition) return;
    root.style.left = `${state.panelPosition.left}px`;
    root.style.top = `${state.panelPosition.top}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  }

  function enableDragging(root) {
    const handle = root.querySelector('header');
    let drag = null;
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) return;
      const rect = root.getBoundingClientRect();
      drag = { id: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
      handle.setPointerCapture(event.pointerId);
      root.classList.add('dragging');
      event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const rect = root.getBoundingClientRect();
      const left = Math.min(Math.max(8, event.clientX - drag.offsetX), Math.max(8, innerWidth - rect.width - 8));
      const top = Math.min(Math.max(8, event.clientY - drag.offsetY), Math.max(8, innerHeight - rect.height - 8));
      Object.assign(root.style, { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' });
    });
    const finish = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const rect = root.getBoundingClientRect();
      state.panelPosition = { left: Math.round(rect.left), top: Math.round(rect.top) };
      saveState();
      drag = null;
      root.classList.remove('dragging');
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  }

  function createPanel() {
    if (document.getElementById('zero-k-spark-panel')) return;
    const root = document.createElement('section');
    root.id = 'zero-k-spark-panel';
    root.innerHTML = `
      <header><strong>Spark Helper</strong><button data-action="minimize" title="最小化">_</button></header>
      <main>
        <label class="switch"><input data-role="enabled" type="checkbox" ${state.enabled ? 'checked' : ''}>启用任务</label>
        <label class="switch"><input data-role="dry-run" type="checkbox" ${state.dryRun ? 'checked' : ''}>Dry Run</label>
        <label>消息模板<textarea data-role="template" rows="3">${escapeHtml(state.template)}</textarea></label>
        <div class="manual-target"><input data-role="manual-target" placeholder="好友昵称或备注名"><button data-action="add-target">添加</button></div>
        <div class="actions"><button data-action="refresh">刷新会话</button><button data-action="run">立即执行</button></div>
        <div class="targets" data-role="targets"></div>
        <output data-role="status">等待操作</output>
      </main>`;
    document.body.append(root);
    panel = root;
    applyPanelPosition(root);
    enableDragging(root);
    root.querySelector('[data-role="enabled"]').addEventListener('change', (event) => { state.enabled = event.target.checked; saveState(); });
    root.querySelector('[data-role="dry-run"]').addEventListener('change', (event) => { state.dryRun = event.target.checked; saveState(); });
    root.querySelector('[data-role="template"]').addEventListener('change', (event) => { state.template = event.target.value.trim(); saveState(); });
    root.querySelector('[data-action="refresh"]').addEventListener('click', renderTargets);
    root.querySelector('[data-action="run"]').addEventListener('click', run);
    root.querySelector('[data-action="add-target"]').addEventListener('click', addManualTarget);
    root.querySelector('[data-role="manual-target"]').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); addManualTarget(); }
    });
    root.querySelector('[data-action="minimize"]').addEventListener('click', () => root.classList.toggle('collapsed'));
    renderTargets();
  }

  const style = document.createElement('style');
  style.textContent = `
    #zero-k-spark-panel { position:fixed; z-index:2147483647; right:16px; bottom:16px; display:flex; flex-direction:column; width:min(320px, calc(100vw - 24px)); max-height:calc(100vh - 24px); overflow:hidden; color:#1e293b; background:#fff; border:1px solid #cbd5e1; border-radius:8px; box-shadow:0 12px 32px #0003; font:13px/1.4 Arial,sans-serif; }
    #zero-k-spark-panel header { display:flex; flex:0 0 auto; justify-content:space-between; align-items:center; padding:10px 12px; color:#fff; background:#16181d; border-radius:7px 7px 0 0; cursor:move; touch-action:none; user-select:none; }
    #zero-k-spark-panel.dragging { opacity:.92; } #zero-k-spark-panel header button { border:0; color:#fff; background:transparent; cursor:pointer; }
    #zero-k-spark-panel main { display:grid; min-height:0; gap:9px; overflow:auto; padding:12px; } #zero-k-spark-panel.collapsed main { display:none; }
    #zero-k-spark-panel label { display:grid; gap:4px; } #zero-k-spark-panel .switch { display:flex; align-items:center; gap:6px; }
    #zero-k-spark-panel textarea, #zero-k-spark-panel input { box-sizing:border-box; width:100%; border:1px solid #94a3b8; border-radius:3px; padding:6px; font:inherit; } #zero-k-spark-panel textarea { resize:vertical; }
    #zero-k-spark-panel .actions, #zero-k-spark-panel .manual-target { display:flex; gap:8px; } #zero-k-spark-panel .manual-target input { min-width:0; }
    #zero-k-spark-panel button { flex:0 0 auto; padding:6px 10px; border:1px solid #94a3b8; border-radius:3px; background:#f8fafc; color:#1e293b; cursor:pointer; }
    #zero-k-spark-panel .targets { max-height:150px; overflow:auto; border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; padding:7px 0; } #zero-k-spark-panel .targets label { display:flex; align-items:center; gap:6px; padding:3px 0; } #zero-k-spark-panel .targets input { width:auto; } #zero-k-spark-panel .targets p { margin:0; color:#475569; }
    #zero-k-spark-panel output { min-height:18px; color:#475569; } #zero-k-spark-panel output[data-level="error"] { color:#b91c1c; } #zero-k-spark-panel output[data-level="success"] { color:#15803d; }
  `;
  document.head.append(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createPanel, { once: true });
  else createPanel();
})();
