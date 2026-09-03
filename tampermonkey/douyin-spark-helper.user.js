// ==UserScript==
// @name         Douyin Spark Helper (Local)
// @namespace    https://github.com/zero-k-spark
// @version      0.1.0
// @description  Local conversation selection and dry-run helper for Douyin web messages.
// @match        https://www.douyin.com/*
// @match        https://www.douyin.com/message/*
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
  };

  const SELECTORS = {
    conversationItems: '[data-e2e*="chat"], [class*="conversation"] [role="listitem"]',
    conversationTitle: '[data-e2e*="chat"] h1, [class*="conversation"] h1, [class*="chat"] h1',
    messageInput: '[contenteditable="true"]',
    sendButton: 'button[type="submit"], [data-e2e*="send"]',
  };

  const state = loadState();
  let panel;

  function loadState() {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    }[char]));
  }

  function getConversationNodes() {
    return [...document.querySelectorAll(SELECTORS.conversationItems)]
      .map((node) => ({ node, name: node.innerText.trim().split('\n')[0].trim() }))
      .filter((item) => item.name && item.name.length < 80);
  }

  function resolveMessage(name) {
    return state.template
      .replaceAll('[日期]', new Intl.DateTimeFormat('zh-CN').format(new Date()))
      .replaceAll('[好友昵称]', name)
      .replaceAll('[天数]', '');
  }

  function notify(message, level = 'info') {
    const output = panel?.querySelector('[data-role="status"]');
    if (output) {
      output.textContent = message;
      output.dataset.level = level;
    }
  }

  function renderTargets() {
    const list = panel.querySelector('[data-role="targets"]');
    const conversations = getConversationNodes();
    const names = [...new Set(conversations.map((item) => item.name))];
    list.innerHTML = names.length
      ? names.map((name) => `<label><input type="checkbox" data-name="${escapeHtml(name)}" ${state.targets.includes(name) ? 'checked' : ''}>${escapeHtml(name)}</label>`).join('')
      : '<p>未在当前页面识别到会话。请先打开网页版私信列表后刷新。</p>';
    list.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener('change', () => {
        const name = input.dataset.name;
        state.targets = input.checked
          ? [...new Set([...state.targets, name])]
          : state.targets.filter((target) => target !== name);
        saveState();
      });
    });
  }

  function selectedNodes() {
    const byName = new Map(getConversationNodes().map((item) => [item.name, item.node]));
    return state.targets.map((name) => ({ name, node: byName.get(name) })).filter((item) => item.node);
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

  function activeTitle() {
    const title = document.querySelector(SELECTORS.conversationTitle);
    return title?.textContent?.trim() || '';
  }

  async function run() {
    if (!state.enabled) {
      notify('请先在面板中勾选“启用任务”。', 'warning');
      return;
    }
    const targets = selectedNodes();
    if (!targets.length) {
      notify('没有可执行的已选会话，请刷新会话列表。', 'warning');
      return;
    }

    for (const { name, node } of targets) {
      if (state.sentOn[name] === today()) continue;
      notify(`正在验证会话：${name}`);
      node.click();
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (!activeTitle().includes(name)) {
        notify(`已停止：当前会话标题与“${name}”不一致。`, 'error');
        return;
      }
      const message = resolveMessage(name);
      if (state.dryRun) {
        console.info('[Spark Helper] Dry run:', { recipient: name, message });
        continue;
      }
      const input = await waitFor(() => document.querySelector(SELECTORS.messageInput));
      if (!input) {
        notify(`已停止：未找到“${name}”的消息输入框。`, 'error');
        return;
      }
      input.focus();
      document.execCommand('insertText', false, message);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: message }));
      const sendButton = document.querySelector(SELECTORS.sendButton);
      if (!sendButton) {
        notify(`已停止：未找到“${name}”的发送按钮。`, 'error');
        return;
      }
      sendButton.click();
      state.sentOn[name] = today();
      saveState();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    notify(state.dryRun ? '验证完成：未发送任何消息。' : '任务完成。', 'success');
  }

  function createPanel() {
    const root = document.createElement('section');
    root.id = 'zero-k-spark-panel';
    root.innerHTML = `
      <header><strong>Spark Helper</strong><button data-action="minimize" title="最小化">_</button></header>
      <main>
        <label class="switch"><input data-role="enabled" type="checkbox" ${state.enabled ? 'checked' : ''}>启用任务</label>
        <label class="switch"><input data-role="dry-run" type="checkbox" ${state.dryRun ? 'checked' : ''}>Dry Run</label>
        <label>消息模板<textarea data-role="template" rows="3">${escapeHtml(state.template)}</textarea></label>
        <div class="actions"><button data-action="refresh">刷新会话</button><button data-action="run">立即执行</button></div>
        <div class="targets" data-role="targets"></div>
        <output data-role="status">等待操作</output>
      </main>`;
    document.body.append(root);
    root.querySelector('[data-role="enabled"]').addEventListener('change', (event) => {
      state.enabled = event.target.checked;
      saveState();
    });
    root.querySelector('[data-role="dry-run"]').addEventListener('change', (event) => {
      state.dryRun = event.target.checked;
      saveState();
    });
    root.querySelector('[data-role="template"]').addEventListener('change', (event) => {
      state.template = event.target.value.trim();
      saveState();
    });
    root.querySelector('[data-action="refresh"]').addEventListener('click', renderTargets);
    root.querySelector('[data-action="run"]').addEventListener('click', run);
    root.querySelector('[data-action="minimize"]').addEventListener('click', () => root.classList.toggle('collapsed'));
    panel = root;
    renderTargets();
  }

  const style = document.createElement('style');
  style.textContent = `
    #zero-k-spark-panel { position: fixed; z-index: 2147483647; right: 20px; bottom: 20px; width: 300px; color: #1e293b; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 12px 32px #0003; font: 13px/1.4 Arial, sans-serif; }
    #zero-k-spark-panel header { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; color:#fff; background:#16181d; border-radius:7px 7px 0 0; }
    #zero-k-spark-panel header button { border:0; color:#fff; background:transparent; cursor:pointer; }
    #zero-k-spark-panel main { display:grid; gap:9px; padding:12px; }
    #zero-k-spark-panel.collapsed main { display:none; }
    #zero-k-spark-panel label { display:grid; gap:4px; }
    #zero-k-spark-panel .switch { display:flex; align-items:center; gap:6px; }
    #zero-k-spark-panel textarea { box-sizing:border-box; width:100%; resize:vertical; }
    #zero-k-spark-panel .actions { display:flex; gap:8px; }
    #zero-k-spark-panel button { padding:6px 10px; cursor:pointer; }
    #zero-k-spark-panel .targets { max-height:150px; overflow:auto; border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; padding:7px 0; }
    #zero-k-spark-panel .targets label { display:flex; align-items:center; gap:6px; padding:3px 0; }
    #zero-k-spark-panel output { min-height:18px; color:#475569; }
    #zero-k-spark-panel output[data-level="error"] { color:#b91c1c; }
    #zero-k-spark-panel output[data-level="success"] { color:#15803d; }
  `;
  document.head.append(style);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createPanel);
  else createPanel();
})();
