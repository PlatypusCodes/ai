/**
 * Platypus AI – script.js
 *
 * Architecture overview:
 *  - AppState          : single source of truth, persisted to localStorage
 *  - sendMessageToAI() : proxies to Cloudflare Worker — no keys in browser
 *  - UI helpers        : render functions, event binders
 */

'use strict';

/* ────────────────────────────────────────────────────────────
   WORKER URL — all API calls go here, keys stay server-side
   ──────────────────────────────────────────────────────────── */
const WORKER_URL = 'https://noisy-breeze-a4b2.detlaffcameron.workers.dev';

/* ────────────────────────────────────────────────────────────
   1.  MODEL DEFINITIONS  (no keyPool — handled by Worker)
   ──────────────────────────────────────────────────────────── */
const MODELS = [
  {
    id:       'gpt-oss-20b',
    name:     'GPT-4o mini',
    provider: 'OpenAI',
    desc:     'Fast and capable — great for most tasks',
    icon:     '🟢',
    color:    '#10a37f',
    apiModel: 'openai/gpt-oss-20b',
  },
  {
    id:       'deepseek-v3',
    name:     'DeepSeek V3',
    provider: 'DeepSeek',
    desc:     'Powerful reasoning and code generation',
    icon:     '🔵',
    color:    '#1a73e8',
    apiModel: 'deepseek/deepseek-chat-v3-5',
  },
  {
    id:       'glm-4-5-air',
    name:     'GLM-4.5 Air',
    provider: 'Zhipu AI',
    desc:     'Efficient multilingual model from Z.ai',
    icon:     '🟣',
    color:    '#6c3fc5',
    apiModel: 'z-ai/glm-4-5-air',
  },
  {
    id:       'grok-4',
    name:     'Grok 4',
    provider: 'xAI',
    desc:     'Real-time knowledge, witty and powerful',
    icon:     '⚫',
    color:    '#1a1a1a',
    apiModel: 'x-ai/grok-4',
  },
  {
    id:       'gemini-flash',
    name:     'Gemini 2.0 Flash',
    provider: 'Google',
    desc:     'Ultra-fast multimodal model from Google',
    icon:     '🟡',
    color:    '#fbbc04',
    apiModel: 'google/gemini-2.0-flash-001',
  },
  {
    id:       'qwen-code-3',
    name:     'Qwen Code 3',
    provider: 'Alibaba',
    desc:     'Specialised code generation and analysis',
    icon:     '🟠',
    color:    '#ff6900',
    apiModel: 'qwen/qwen3-coder',
  },
];

/* ────────────────────────────────────────────────────────────
   2.  APP STATE
   ──────────────────────────────────────────────────────────── */
const LS_KEY = 'platypus_ai_state';

function defaultState() {
  return {
    activeModelId: MODELS[0].id,
    activeChatId:  null,
    chats:         [],
    theme:         'light',
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (!MODELS.find(m => m.id === s.activeModelId)) s.activeModelId = MODELS[0].id;
      return s;
    }
  } catch (e) { /* ignore */ }
  return defaultState();
}

function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

function getActiveModel() {
  return MODELS.find(m => m.id === state.activeModelId) || MODELS[0];
}

function getActiveChat() {
  return state.chats.find(c => c.id === state.activeChatId) || null;
}

/* ────────────────────────────────────────────────────────────
   3.  AI INTEGRATION — proxies to Cloudflare Worker
   ──────────────────────────────────────────────────────────── */
async function sendMessageToAI(messages, model) {
  const res = await fetch(`${WORKER_URL}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId:  model.id,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Worker returned ${res.status}`);
  }

  const data = await res.json();
  return data.reply || '(No response)';
}

/* ────────────────────────────────────────────────────────────
   4.  CHAT MANAGEMENT
   ──────────────────────────────────────────────────────────── */
function createChat(title, modelId) {
  const chat = {
    id:       crypto.randomUUID(),
    title:    title || 'New chat',
    modelId:  modelId || state.activeModelId,
    messages: [],
    created:  Date.now(),
  };
  state.chats.unshift(chat);
  state.activeChatId = chat.id;
  saveState();
  return chat;
}

function deleteChat(chatId) {
  state.chats = state.chats.filter(c => c.id !== chatId);
  if (state.activeChatId === chatId) {
    state.activeChatId = state.chats[0]?.id || null;
  }
  saveState();
}

function renameChat(chatId, newTitle) {
  const chat = state.chats.find(c => c.id === chatId);
  if (chat) { chat.title = newTitle; saveState(); }
}

function addMessage(chatId, role, content, modelId) {
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return;
  chat.messages.push({ id: crypto.randomUUID(), role, content, modelId, ts: Date.now() });
  saveState();
}

function autoTitle(text) {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > 46 ? trimmed.slice(0, 44) + '…' : trimmed;
}

/* ────────────────────────────────────────────────────────────
   5.  RENDER HELPERS
   ──────────────────────────────────────────────────────────── */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarkdown(text) {
  let html = escapeHtml(text);

  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`;
  });

  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<strong>$1</strong>');
  html = html.replace(/^## (.+)$/gm,  '<strong>$1</strong>');
  html = html.replace(/^# (.+)$/gm,   '<strong>$1</strong>');
  html = html.replace(/^[*\-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  html = html.split('\n\n').map(para => {
    if (para.startsWith('<pre') || para.startsWith('<ul') || para.startsWith('<li')) return para;
    return `<p>${para.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

function renderHistory() {
  const el = document.getElementById('chatHistory');
  el.innerHTML = '';

  if (state.chats.length === 0) {
    el.innerHTML = '<p style="font-size:0.80rem;color:var(--text-muted);padding:4px 8px">No conversations yet</p>';
    return;
  }

  state.chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'history-item' + (chat.id === state.activeChatId ? ' active' : '');
    item.setAttribute('role', 'listitem');
    item.dataset.id = chat.id;

    item.innerHTML = `
      <span class="history-item-title" title="${escapeHtml(chat.title)}">${escapeHtml(chat.title)}</span>
      <div class="history-item-actions">
        <button class="history-action-btn rename-btn" title="Rename" aria-label="Rename chat">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.5 2.5l2 2L3 12H1v-2L8.5 2.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="history-action-btn delete-btn" title="Delete" aria-label="Delete chat">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M5 3.5V2.5h3v1M10 3.5l-.75 7H3.75L3 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>`;

    item.addEventListener('click', e => {
      if (e.target.closest('.rename-btn')) { handleRename(chat.id); return; }
      if (e.target.closest('.delete-btn')) { handleDelete(chat.id); return; }
      switchChat(chat.id);
    });

    el.appendChild(item);
  });
}

function handleRename(chatId) {
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return;
  const name = prompt('Rename chat:', chat.title);
  if (name && name.trim()) { renameChat(chatId, name.trim()); renderHistory(); }
}

function handleDelete(chatId) {
  if (!confirm('Delete this conversation?')) return;
  deleteChat(chatId);
  renderHistory();
  renderConversation();
  updateWelcomeVisibility();
}

function renderModelIndicator() {
  const model = getActiveModel();
  const dot  = document.getElementById('modelDot');
  const name = document.getElementById('modelBtnName');
  const hint = document.getElementById('composerModelName');

  dot.style.color  = model.color;
  name.textContent = model.name;
  if (hint) hint.textContent = model.name;
}

function renderModelList() {
  const list = document.getElementById('modelList');
  list.innerHTML = '';

  MODELS.forEach(m => {
    const opt = document.createElement('button');
    opt.className = 'model-option' + (m.id === state.activeModelId ? ' selected' : '');
    opt.setAttribute('role', 'option');
    opt.setAttribute('aria-selected', m.id === state.activeModelId);
    opt.innerHTML = `
      <div class="model-option-icon" style="background:${m.color}1a">${m.icon}</div>
      <div class="model-option-info">
        <div class="model-option-name">${m.name}</div>
        <div class="model-option-desc">${m.desc} · ${m.provider}</div>
      </div>
      <div class="model-option-check"></div>`;

    opt.addEventListener('click', () => {
      state.activeModelId = m.id;
      saveState();
      renderModelIndicator();
      renderModelList();
      closeModal('modelModalBackdrop');
    });

    list.appendChild(opt);
  });
}

function renderConversation() {
  const chat = getActiveChat();
  const el   = document.getElementById('conversation');
  el.innerHTML = '';

  if (!chat || chat.messages.length === 0) {
    el.classList.remove('visible');
    return;
  }

  el.classList.add('visible');

  const group = document.createElement('div');
  group.className = 'message-group';

  chat.messages.forEach(msg => {
    const model = MODELS.find(m => m.id === msg.modelId) || getActiveModel();
    group.appendChild(buildMessageEl(msg.role, msg.content, model));
  });

  el.appendChild(group);
  el.scrollTop = el.scrollHeight;
}

function buildMessageEl(role, content, model) {
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';

  if (role === 'assistant') {
    avatar.classList.add('ai-avatar');
    avatar.innerHTML = `<img src="https://avatars.githubusercontent.com/u/298894342?s=160&v=4" alt="${model.name}" />`;
  } else {
    avatar.classList.add('user-avatar-icon');
    avatar.textContent = 'P';
  }

  const body   = document.createElement('div');
  body.className = 'msg-body';

  const sender = document.createElement('span');
  sender.className = 'msg-sender';
  sender.textContent = role === 'user' ? 'You' : model.name;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = role === 'assistant'
    ? renderMarkdown(content)
    : `<p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>`;

  body.appendChild(sender);
  body.appendChild(bubble);

  if (role === 'assistant') {
    const badge = document.createElement('div');
    badge.className = 'msg-model-badge';
    badge.innerHTML = `<span class="msg-model-dot" style="color:${model.color}"></span>${model.provider}`;
    body.appendChild(badge);
  }

  wrap.appendChild(avatar);
  wrap.appendChild(body);
  return wrap;
}

function appendMessage(role, content, model) {
  const el    = document.getElementById('conversation');
  let   group = el.querySelector('.message-group');

  if (!group) {
    group = document.createElement('div');
    group.className = 'message-group';
    el.appendChild(group);
    el.classList.add('visible');
  }

  group.appendChild(buildMessageEl(role, content, model));
  el.scrollTop = el.scrollHeight;
}

let typingEl = null;

function showTyping() {
  const el    = document.getElementById('conversation');
  let   group = el.querySelector('.message-group');
  if (!group) {
    group = document.createElement('div');
    group.className = 'message-group';
    el.appendChild(group);
    el.classList.add('visible');
  }

  const model  = getActiveModel();
  const wrap   = document.createElement('div');
  wrap.className = 'message ai';
  wrap.id = 'typing-indicator-msg';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar ai-avatar';
  avatar.innerHTML = `<img src="https://avatars.githubusercontent.com/u/298894342?s=160&v=4" alt="${model.name}" />`;

  const body   = document.createElement('div');
  body.className = 'msg-body';

  const sender = document.createElement('span');
  sender.className = 'msg-sender';
  sender.textContent = model.name;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = `<div class="typing-indicator">
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  </div>`;

  body.appendChild(sender);
  body.appendChild(bubble);
  wrap.appendChild(avatar);
  wrap.appendChild(body);
  group.appendChild(wrap);

  typingEl = wrap;
  el.scrollTop = el.scrollHeight;
}

function hideTyping() {
  if (typingEl) { typingEl.remove(); typingEl = null; }
}

function updateWelcomeVisibility() {
  const chat    = getActiveChat();
  const welcome = document.getElementById('welcomeScreen');
  const conv    = document.getElementById('conversation');
  const hasMessages = chat && chat.messages.length > 0;

  if (hasMessages) {
    welcome.classList.add('hidden');
    conv.classList.add('visible');
  } else {
    welcome.classList.remove('hidden');
    conv.classList.remove('visible');
  }
}

/* ────────────────────────────────────────────────────────────
   6.  COMPOSER
   ──────────────────────────────────────────────────────────── */
let isGenerating = false;

function setComposerGenerating(val) {
  isGenerating = val;
  const input  = document.getElementById('composerInput');
  const send   = document.getElementById('composerSend');
  const comp   = document.getElementById('composer');

  input.disabled = val;
  if (val) {
    send.disabled = true;
    comp.classList.add('generating');
  } else {
    updateSendBtn();
    comp.classList.remove('generating');
  }
}

function updateSendBtn() {
  const val  = document.getElementById('composerInput').value.trim();
  document.getElementById('composerSend').disabled = !val || isGenerating;
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
}

/* ────────────────────────────────────────────────────────────
   7.  SEND MESSAGE FLOW
   ──────────────────────────────────────────────────────────── */
async function handleSend() {
  if (isGenerating) return;

  const input   = document.getElementById('composerInput');
  const userMsg = input.value.trim();
  if (!userMsg) return;

  input.value = '';
  autoResize(input);
  updateSendBtn();

  const model = getActiveModel();

  let chat = getActiveChat();
  if (!chat) {
    chat = createChat(autoTitle(userMsg), model.id);
    renderHistory();
  }

  if (chat.messages.length === 0) {
    renameChat(chat.id, autoTitle(userMsg));
    renderHistory();
  }

  addMessage(chat.id, 'user', userMsg, model.id);
  updateWelcomeVisibility();
  appendMessage('user', userMsg, model);

  setComposerGenerating(true);
  showTyping();

  try {
    const currentChat = getActiveChat();
    const apiMessages = currentChat.messages.map(m => ({
      role:    m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    const reply = await sendMessageToAI(apiMessages, model);

    hideTyping();
    addMessage(chat.id, 'assistant', reply, model.id);
    appendMessage('assistant', reply, model);
  } catch (err) {
    hideTyping();
    const errMsg = `Sorry, I couldn't get a response. ${err.message || 'Please try again.'}`;
    addMessage(chat.id, 'assistant', errMsg, model.id);
    appendMessage('assistant', errMsg, model);
    console.error('[Platypus AI] API error:', err);
  } finally {
    setComposerGenerating(false);
    document.getElementById('composerInput').focus();
  }
}

/* ────────────────────────────────────────────────────────────
   8.  MODALS
   ──────────────────────────────────────────────────────────── */
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.getElementById('modelBtn')?.setAttribute('aria-expanded', id === 'modelModalBackdrop' ? 'true' : 'false');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'modelModalBackdrop') document.getElementById('modelBtn')?.setAttribute('aria-expanded', 'false');
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(el => el.classList.remove('open'));
  document.getElementById('modelBtn')?.setAttribute('aria-expanded', 'false');
}

/* ────────────────────────────────────────────────────────────
   9.  SIDEBAR (MOBILE)
   ──────────────────────────────────────────────────────────── */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

/* ────────────────────────────────────────────────────────────
   10.  SETTINGS
   ──────────────────────────────────────────────────────────── */
function renderSettings() {
  const list = document.getElementById('apiKeyList');
  list.innerHTML = `
    <p style="font-size:0.82rem;color:var(--text-muted);padding:4px 0 8px;">
      API keys are managed server-side via the Cloudflare Worker.<br>
      No keys needed here.
    </p>`;
}

/* ────────────────────────────────────────────────────────────
   11.  THEME
   ──────────────────────────────────────────────────────────── */
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  state.theme = theme;
  saveState();
}

function toggleTheme() {
  applyTheme(state.theme === 'light' ? 'dark' : 'light');
}

/* ────────────────────────────────────────────────────────────
   12.  TOAST
   ──────────────────────────────────────────────────────────── */
function showToast(msg, duration = 2500) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  Object.assign(toast.style, {
    position:     'fixed',
    bottom:       '24px',
    left:         '50%',
    transform:    'translateX(-50%)',
    background:   'var(--brown-800)',
    color:        '#fff',
    padding:      '8px 18px',
    borderRadius: 'var(--radius-full)',
    fontSize:     '0.83rem',
    fontFamily:   'var(--font-sans)',
    boxShadow:    'var(--shadow-md)',
    zIndex:       '9999',
    opacity:      '0',
    transition:   'opacity 200ms ease',
  });
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

/* ────────────────────────────────────────────────────────────
   13.  SWITCH CHAT
   ──────────────────────────────────────────────────────────── */
function switchChat(chatId) {
  state.activeChatId = chatId;
  saveState();
  renderHistory();
  renderConversation();
  updateWelcomeVisibility();
  closeSidebar();
}

/* ────────────────────────────────────────────────────────────
   14.  INIT & EVENT BINDINGS
   ──────────────────────────────────────────────────────────── */
function init() {
  applyTheme(state.theme);

  renderModelIndicator();
  renderHistory();
  renderConversation();
  updateWelcomeVisibility();
  renderModelList();
  renderSettings();

  const input = document.getElementById('composerInput');
  const send  = document.getElementById('composerSend');

  input.addEventListener('input', () => { autoResize(input); updateSendBtn(); });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!send.disabled) handleSend();
    }
  });

  send.addEventListener('click', handleSend);

  document.querySelector('.composer-attach')?.addEventListener('click', () => {
    showToast('File attachments coming soon!');
  });

  const newChatFlow = () => {
    state.activeChatId = null;
    saveState();
    renderHistory();
    renderConversation();
    updateWelcomeVisibility();
    closeSidebar();
    input.focus();
  };

  document.getElementById('btnNewChat').addEventListener('click', newChatFlow);
  document.getElementById('mobileNewChat').addEventListener('click', newChatFlow);

  document.getElementById('suggestionGrid').addEventListener('click', e => {
    const card = e.target.closest('.suggestion-card');
    if (card) {
      input.value = card.dataset.prompt || '';
      autoResize(input);
      updateSendBtn();
      input.focus();
      handleSend();
    }
  });

  document.getElementById('modelBtn').addEventListener('click', () => {
    renderModelList();
    openModal('modelModalBackdrop');
  });

  document.getElementById('modalClose').addEventListener('click', () => closeModal('modelModalBackdrop'));

  document.getElementById('modelModalBackdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('modelModalBackdrop')) closeModal('modelModalBackdrop');
  });

  document.getElementById('btnSettings').addEventListener('click', () => {
    renderSettings();
    openModal('settingsModalBackdrop');
  });

  document.getElementById('settingsClose').addEventListener('click', () => closeModal('settingsModalBackdrop'));

  document.getElementById('settingsModalBackdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('settingsModalBackdrop')) closeModal('settingsModalBackdrop');
  });

  document.getElementById('btnClearAll').addEventListener('click', () => {
    if (!confirm('Delete all conversations? This cannot be undone.')) return;
    state.chats = [];
    state.activeChatId = null;
    saveState();
    renderHistory();
    renderConversation();
    updateWelcomeVisibility();
    closeModal('settingsModalBackdrop');
    showToast('All conversations cleared.');
  });

  document.getElementById('btnTheme').addEventListener('click', toggleTheme);

  document.getElementById('hamburger').addEventListener('click', openSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
  });
}

/* Boot */
document.addEventListener('DOMContentLoaded', init);
