// ==UserScript==
// @name         Douyin Spark Helper (Local)
// @namespace    https://github.com/zero-k-spark
// @version      1.0.12
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
    messageEntry: [
      '[data-e2e="im-entry"]',
      'div.iLNqted2.DiddnkXT[data-e2e="something-button"]',
      '[data-e2e="something-button"]',
    ],
    messageDialog: '[data-e2e="im-dialog"]',
    conversationBackControls: [
      '[data-e2e="im-dialog"] [data-e2e*="back"]',
      '[data-e2e="im-dialog"] [aria-label*="返回"]',
      '[data-e2e="im-dialog"] [aria-label*="Back"]',
      '[data-e2e="im-dialog"] [class*="ChatHeader"] [class*="back"]',
      '[data-e2e="im-dialog"] [class*="chat-header"] [class*="back"]',
    ],
    conversationItems: [
      '[data-e2e="conversation-item"]',
      '[data-e2e*="conversation"]',
      '[data-e2e*="message"] [data-e2e*="item"]',
      '[class*="conversation"] [role="listitem"]',
      '[class*="message-list"] [role="listitem"]',
      '[class*="chat-list"] > *',
      '[class*="conversation-list"] > *',
    ],
    conversationTitle: [
      '.StackLayoutStackChatHeadertitle',
      '[data-e2e*="conversation-title"]',
      '[data-e2e*="chat-title"]',
      '[class*="message-detail"] h1',
      '[class*="message-detail"] h2',
      '[class*="chat-detail"] h1',
      '[class*="chat-detail"] h2',
      '[class*="message-header"] [class*="title"]',
      '[class*="chat-header"] [class*="title"]',
      '[class*="message-detail"] [class*="title"]',
    ],
    messageInputs: [
      '[data-e2e="msg-input"] [contenteditable="true"]',
      '[contenteditable="true"]',
      'textarea',
    ],
    sendControls: [
      'svg.messageMsgInputpublishBtn.e2e-send-msg-btn',
      'svg.messageMsgInputpublishBtn.messageMsgInputpublishRedBtn',
      '[data-e2e="msg-input"] .e2e-send-msg-btn',
      '[data-e2e="msg-input"] .messageMsgInputpublishBtn',
      'button[type="submit"]',
      '[data-e2e*="send"]',
      '[class*="send-button"]',
    ],
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

  function messageDialog() {
    const dialog = document.querySelector(SELECTORS.messageDialog);
    return dialog && isVisible(dialog) ? dialog : null;
  }

  function displayName(node) {
    return textLines(node).find((line) => (
      line.length <= 48
      && !/^(消息|搜索|置顶|已读|未读|刚刚|昨天|\d{1,2}:\d{2})$/.test(line)
    )) || '';
  }

  function getConversationNodes() {
    const dialog = messageDialog();
    const scope = dialog || document;
    const exactRows = uniqueNodes([...scope.querySelectorAll('[data-e2e="conversation-item"]')]);
    const rows = exactRows.length
      ? exactRows
      : dialog
        ? uniqueNodes(SELECTORS.conversationItems.flatMap((selector) => [...dialog.querySelectorAll(selector)]))
        : [];
    return rows
      .map((node) => {
        const title = node.querySelector('.conversationConversationItemtitle, [data-e2e*="conversation-title"]');
        return { node, name: title ? textLines(title)[0] : displayName(node) };
      })
      .filter(({ name }) => name);
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
    const dialog = messageDialog();
    if (!dialog) return null;
    const matches = uniqueNodes([...dialog.querySelectorAll('a, button, [role="listitem"], li, div, span')])
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
    const dialog = messageDialog();
    if (!dialog) return false;
    const titleNodes = [
      ...SELECTORS.conversationTitle.flatMap((selector) => [...dialog.querySelectorAll(selector)]),
      ...dialog.querySelectorAll('h1, h2'),
    ];
    return uniqueNodes(titleNodes).some((node) => textLines(node).some((line) => line.includes(name)));
  }

  function visibleMessageInput() {
    const dialog = messageDialog() || document;
    for (const selector of SELECTORS.messageInputs) {
      const input = uniqueNodes([...dialog.querySelectorAll(selector)])[0];
      if (input) return input;
    }
    return null;
  }

  function visibleSendControl() {
    // The current Douyin send SVG is rendered beside the message drawer rather
    // than beneath its data-e2e wrapper, so search the page when that wrapper
    // is absent. uniqueNodes still excludes this script's panel.
    const dialog = messageDialog() || document;
    for (const selector of SELECTORS.sendControls) {
      const control = uniqueNodes([...dialog.querySelectorAll(selector)])[0];
      if (control) return control;
    }
    return null;
  }

  function validateComposer() {
    return { input: visibleMessageInput(), sendControl: visibleSendControl() };
  }

  function clickElement(node) {
    const target = node.closest('button, [role="button"], .messageMsgInputpublishBtn, [data-e2e*="send"]') || node;
    if (window.PointerEvent) {
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    }
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    if (window.PointerEvent) {
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    }
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    // The message entry is a normal HTML div and its native click path opens the
    // drawer. The send control is SVG, which has no reliable .click() method.
    if (target instanceof HTMLElement) target.click();
    else target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }

  function visibleFirst(selectors, root = document) {
    for (const selector of selectors) {
      const node = uniqueNodes([...root.querySelectorAll(selector)])[0];
      if (node) return node;
    }
    return null;
  }

  function findMessageEntry() {
    // The verified markup nests the actionable `something-button` inside the
    // `im-entry` wrapper. Clicking the wrapper does not dispatch into its child.
    const imEntries = uniqueNodes([...document.querySelectorAll('[data-e2e="im-entry"]')]);
    for (const entry of imEntries) {
      const button = uniqueNodes([...entry.querySelectorAll('[data-e2e="something-button"]')])
        .find((node) => textLines(node).includes('消息'));
      if (button) return button;
    }

    const entries = SELECTORS.messageEntry.flatMap((selector) => [...document.querySelectorAll(selector)]);
    const directEntry = uniqueNodes(entries).find((node) => textLines(node).includes('消息'));
    if (directEntry) return directEntry;

    // Resolve from the label if CSS-module classes on the button change.
    const label = uniqueNodes([...document.querySelectorAll('p.phl13lpd')])
      .find((node) => textLines(node).includes('消息'));
    return label?.closest('[data-e2e="something-button"]') || label?.parentElement || null;
  }

  async function ensureMessageDialogOpen() {
    if (messageDialog()) return true;
    const entry = findMessageEntry();
    if (!entry) return false;
    clickElement(entry);
    if (await waitFor(() => messageDialog() || getConversationNodes().length, 2500)) return true;

    // Some current layouts bind the opening handler to the parent wrapper
    // instead of the visible `something-button` child.
    const wrapper = entry.parentElement;
    if (!wrapper || !isVisible(wrapper)) return false;
    clickElement(wrapper);
    return Boolean(await waitFor(() => messageDialog() || getConversationNodes().length, 3000));
  }

  async function ensureConversationListOpen() {
    if (getConversationNodes().length) return true;
    const dialog = messageDialog();
    if (!dialog) return false;
    const back = findConversationBackControl(dialog);
    if (!back) return false;
    clickElement(back);
    return Boolean(await waitFor(() => getConversationNodes().length, 3500));
  }

  function findConversationBackControl(dialog) {
    const knownControl = visibleFirst(SELECTORS.conversationBackControls, dialog);
    if (knownControl) return knownControl;

    // Current Douyin chat headers expose the title but not a stable back-button data attribute.
    // The only visible interactive icon positioned to the title's left is the conversation-list back control.
    const title = uniqueNodes([...dialog.querySelectorAll('.StackLayoutStackChatHeadertitle')])[0];
    if (!title) return null;
    const titleRect = title.getBoundingClientRect();
    const candidates = uniqueNodes([...dialog.querySelectorAll('button, [role="button"], svg')])
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.right <= titleRect.left && rect.bottom >= titleRect.top && rect.top <= titleRect.bottom;
      })
      .sort((left, right) => right.getBoundingClientRect().right - left.getBoundingClientRect().right);
    return candidates[0] || null;
  }

  async function openConversation(name, node) {
    clickElement(node);
    return waitFor(() => activeTitleMatches(name), 3500);
  }

  function selectComposerContent(input) {
    const range = document.createRange();
    range.selectNodeContents(input);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function writeMessage(input, message) {
    input.focus();
    if (input.matches('textarea, input')) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
        || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(input, message);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      selectComposerContent(input);
      document.execCommand?.('delete', false);
      const inserted = document.execCommand?.('insertText', false, message);
      // Slate only synchronizes its message model through the browser edit path.
      // Do not mutate textContent as a fallback: it looks filled but sends an empty message.
      if (!inserted) return false;
    }
    return inputText(input) === normalizeMessage(message);
  }

  function normalizeMessage(message) {
    return String(message).replace(/[\s\u200B]+/g, ' ').trim();
  }

  function inputText(input) {
    return normalizeMessage(input.value || input.textContent || '');
  }

  async function sendMessage(message) {
    notify('正在写入消息');
    const input = await waitFor(visibleMessageInput);
    if (!input) return '未找到消息输入框。';
    const written = writeMessage(input, message);
    const ready = written || await waitFor(() => inputText(input) === normalizeMessage(message), 1000);
    if (!ready) return '消息未写入输入框，已取消发送。';
    notify('正在确认发送控件');
    const sendControl = await waitFor(visibleSendControl);
    if (!sendControl) return '未找到发送控件。';
    if (sendControl.matches('[disabled], [aria-disabled="true"]') || sendControl.closest('[disabled], [aria-disabled="true"]')) {
      return '发送控件当前不可用，已取消发送。';
    }
    notify('正在点击发送');
    clickElement(sendControl);
    const sent = await waitFor(() => inputText(input) === '', 3000);
    return sent ? '' : '消息未离开输入框，未标记为发送成功。';
  }

  async function run() {
    if (!state.enabled) return notify('请先在面板中勾选“启用任务”。', 'warning');
    notify('正在打开私信列表');
    if (!await ensureMessageDialogOpen()) {
      return notify('未能打开私信抽屉，请确认页面已登录且“消息”入口可见。', 'error');
    }
    if (!await ensureConversationListOpen()) {
      return notify('未能打开会话列表。请先从当前聊天返回会话列表后重试。', 'error');
    }
    const missing = state.targets.filter((name) => !findConversationNode(name));
    if (missing.length) return notify(`未找到会话：${missing.join('、')}。请打开私信列表后刷新。`, 'warning');
    const targets = state.targets
      .filter((name) => state.sentOn[name] !== today())
      .map((name) => ({ name, node: findConversationNode(name) }));
    if (!targets.length) return notify('没有可执行的会话，或所选好友今天已处理。', 'warning');

    try {
      for (const { name, node } of targets) {
        notify(`正在打开会话：${name}`);
        const opened = await openConversation(name, node);
        if (!opened) return notify(`已停止：会话标题未确认是“${name}”，为防止错发未继续。`, 'error');
        const message = resolveMessage(name);
        if (state.dryRun) {
          notify(`正在验证输入区和发送控件：${name}`);
          const composer = validateComposer();
          if (!composer.input) return notify(`“${name}”验证失败：未找到聊天输入区。`, 'error');
          if (!composer.sendControl) return notify(`“${name}”验证失败：未找到发送控件。`, 'error');
          console.info('[Spark Helper] Dry run:', { recipient: name, message });
          continue;
        }
        const error = await sendMessage(message);
        if (error) return notify(`“${name}”发送失败：${error}`, 'error');
        state.sentOn[name] = today();
        saveState();
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    } catch (error) {
      console.error('[Spark Helper] Task failed:', error);
      return notify(`执行异常：${error instanceof Error ? error.message : String(error)}`, 'error');
    }
    notify(state.dryRun ? '验证完成：已检查会话、输入区和发送控件，未发送任何消息。' : '任务完成。', 'success');
  }

  async function refreshConversationList() {
    notify('正在打开私信列表');
    if (!await ensureMessageDialogOpen() || !await ensureConversationListOpen()) {
      return notify('未能打开会话列表，请确认页面已登录。', 'error');
    }
    renderTargets();
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
        <label class="switch"><input data-role="dry-run" type="checkbox" ${state.dryRun ? 'checked' : ''}>Dry Run（仅验证，不发送）</label>
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
    root.querySelector('[data-action="refresh"]').addEventListener('click', refreshConversationList);
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
    #zero-k-spark-panel textarea, #zero-k-spark-panel input:not([type="checkbox"]) { box-sizing:border-box; width:100%; border:1px solid #94a3b8; border-radius:3px; padding:6px; font:inherit; } #zero-k-spark-panel textarea { resize:vertical; }
    #zero-k-spark-panel input[type="checkbox"] { box-sizing:border-box; width:16px; height:16px; margin:0; padding:0; accent-color:#1677ff; }
    #zero-k-spark-panel .actions, #zero-k-spark-panel .manual-target { display:flex; gap:8px; } #zero-k-spark-panel .manual-target input { min-width:0; }
    #zero-k-spark-panel button { flex:0 0 auto; padding:6px 10px; border:1px solid #94a3b8; border-radius:3px; background:#f8fafc; color:#1e293b; cursor:pointer; }
    #zero-k-spark-panel .targets { max-height:150px; overflow:auto; border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; padding:7px 0; } #zero-k-spark-panel .targets label { display:flex; align-items:center; gap:6px; padding:3px 0; } #zero-k-spark-panel .targets p { margin:0; color:#475569; }
    #zero-k-spark-panel output { min-height:18px; color:#475569; } #zero-k-spark-panel output[data-level="error"] { color:#b91c1c; } #zero-k-spark-panel output[data-level="success"] { color:#15803d; }
  `;
  document.head.append(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createPanel, { once: true });
  else createPanel();
})();
