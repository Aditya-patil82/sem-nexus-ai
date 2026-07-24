const SUPABASE_URL = CONFIG.supabaseUrl;
const SUPABASE_KEY = CONFIG.supabaseKey;
const CHAT_PROXY = CONFIG.chatProxy;
const PISTON_URL = '/api/code';
const AGENTS = {};
_agents.forEach(a => { AGENTS[a.id] = a; });
const BOILERPLATE = {
  c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  python: 'print("Hello, World!")',
};
let isLogin = true;
let currentUser = null;
let chatHistory = {};
let currentAgent = null;
let isSending = false;
let abortController = null;

async function supabaseAuth(endpoint, body) {
  try {
    const res = await fetch(`/api/auth?path=${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { throw new Error('Server error'); }
    if (!res.ok) throw new Error(data.error_description || data.msg || data.error_code || 'Auth failed');
    return data;
  } catch (err) { throw err; }
}

function saveSession(data) {
  localStorage.setItem('sn_access', data.access_token);
  localStorage.setItem('sn_refresh', data.refresh_token);
  localStorage.setItem('sn_user', JSON.stringify(data.user));
  currentUser = data.user;
}
function loadSession() {
  const t = localStorage.getItem('sn_access'), u = localStorage.getItem('sn_user');
  if (t && u) { currentUser = JSON.parse(u); return true; }
  return false;
}
function clearSession() {
  localStorage.removeItem('sn_access'); localStorage.removeItem('sn_refresh'); localStorage.removeItem('sn_user');
  currentUser = null;
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('code-editor').value = BOILERPLATE.python;
  setTimeout(() => {
    document.getElementById('splash').classList.add('fade-out');
    setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      if (loadSession()) showApp(); else document.getElementById('auth').classList.remove('hidden');
    }, 800);
  }, 3000);
  document.getElementById('auth-form').addEventListener('submit', handleAuth);
});

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim(), pass = document.getElementById('password').value;
  const btn = document.getElementById('auth-btn'); btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    const data = isLogin ? await supabaseAuth('token?grant_type=password', { email, password: pass }) : await supabaseAuth('signup', { email, password: pass });
    saveSession(data); showApp();
  } catch (err) { alert(err.message); }
  finally { btn.disabled = false; btn.textContent = isLogin ? 'Sign In' : 'Sign Up'; }
}
function toggleAuthMode(e) {
  e.preventDefault(); isLogin = !isLogin;
  document.getElementById('auth-title').textContent = isLogin ? 'Welcome Back' : 'Create Account';
  document.getElementById('auth-subtitle').textContent = isLogin ? 'Sign in to continue learning' : 'Join the learning community';
  document.getElementById('auth-btn').textContent = isLogin ? 'Sign In' : 'Sign Up';
  document.getElementById('toggle-text').textContent = isLogin ? "Don't have an account? " : 'Already have an account? ';
}
function togglePassword() {
  const inp = document.getElementById('password'), ico = document.getElementById('eye-icon');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  ico.textContent = inp.type === 'password' ? 'visibility_off' : 'visibility';
}
function showApp() {
  document.getElementById('auth').classList.add('hidden'); document.getElementById('app').classList.remove('hidden');
  if (currentUser) {
    const e = currentUser.email || '-';
    document.getElementById('profile-email').textContent = e;
    document.getElementById('profile-email2').textContent = e;
    document.getElementById('profile-uid').textContent = (currentUser.id || '-').substring(0, 16) + '...';
  }
}
function signOut() {
  clearSession(); document.getElementById('app').classList.add('hidden'); document.getElementById('auth').classList.remove('hidden');
  isLogin = true; document.getElementById('auth-title').textContent = 'Welcome Back';
  document.getElementById('auth-subtitle').textContent = 'Sign in to continue learning';
  document.getElementById('auth-btn').textContent = 'Sign In';
  document.getElementById('email').value = ''; document.getElementById('password').value = '';
}

// ═══ TAB NAV ═══
function switchTab(tab) {
  if (abortController) { abortController.abort(); abortController = null; }
  isSending = false;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('bottom-nav').style.display = 'flex';
}

// ═══ CHAT ═══
function openChat(agentId) {
  if (abortController) { abortController.abort(); abortController = null; }
  currentAgent = AGENTS[agentId]; isSending = false;
  if (!chatHistory[agentId]) chatHistory[agentId] = [];
  document.getElementById('chat-agent-icon').textContent = currentAgent.icon;
  document.getElementById('chat-agent-name').textContent = currentAgent.name;
  document.getElementById('chat-empty-icon').textContent = currentAgent.icon;
  document.getElementById('chat-empty-name').textContent = currentAgent.name;
  document.getElementById('chat-empty-desc').textContent = currentAgent.desc;
  const input = document.getElementById('chat-input'); input.value = ''; input.disabled = false;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-chat').classList.add('active');
  document.getElementById('bottom-nav').style.display = 'none';
  renderChat(agentId);
  setTimeout(() => input.focus(), 100);
}
function closeChat() {
  if (abortController) { abortController.abort(); abortController = null; }
  currentAgent = null; isSending = false;
  switchTab('ai');
}
function renderChat(agentId) {
  const c = document.getElementById('chat-messages'), msgs = chatHistory[agentId] || [];
  c.innerHTML = '';
  if (msgs.length === 0) {
    c.innerHTML = `<div class="chat-empty"><span class="empty-emoji">${currentAgent.icon}</span><h3>${currentAgent.name}</h3><p>${currentAgent.desc}</p></div>`;
    return;
  }
  msgs.forEach(m => { c.insertAdjacentHTML('beforeend', `<div class="msg ${m.role}">${fmt(m.content)}</div>`); });
  c.scrollTop = c.scrollHeight;
}
function fmt(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```([\s\S]*?)```/g,'<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\n/g,'<br>');
}
function handleChatKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }

async function sendChatMessage() {
  if (isSending) return;
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !currentAgent) return;
  const agentId = currentAgent.id;
  isSending = true; input.value = ''; input.disabled = true;
  if (!chatHistory[agentId]) chatHistory[agentId] = [];
  chatHistory[agentId].push({ role: 'user', content: text });
  renderChat(agentId);
  const c = document.getElementById('chat-messages');
  const typing = document.createElement('div');
  typing.className = 'typing'; typing.id = 'typing-indicator';
  typing.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  c.appendChild(typing); c.scrollTop = c.scrollHeight;
  let fullContent = '';
  try {
    abortController = new AbortController();
    const apiMsgs = chatHistory[agentId].map(m => ({ role: m.role, content: m.content }));
    const response = await fetch(CHAT_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, messages: apiMsgs }),
      signal: abortController.signal,
    });
    if (!response.ok) { const err = await response.text(); throw new Error(err.substring(0, 300)); }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let isFirstChunk = true;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() || '';
      for (const line of parts) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            if (isFirstChunk) {
              const el = document.getElementById('typing-indicator');
              if (el) el.remove();
              c.insertAdjacentHTML('beforeend', `<div id="stream-msg" class="msg assistant"></div>`);
              isFirstChunk = false;
            }
            const el = document.getElementById('stream-msg');
            if (el) el.innerHTML = fmt(fullContent) + '<span class="stream-cursor">|</span>';
            c.scrollTop = c.scrollHeight;
          }
        } catch(e) {}
      }
    }
    const el = document.getElementById('stream-msg');
    if (el) el.innerHTML = fmt(fullContent);
    const th = document.getElementById('typing-indicator');
    if (th) th.remove();
    if (fullContent) chatHistory[agentId].push({ role: 'assistant', content: fullContent });
    if (!fullContent && chatHistory[agentId].length > 1) {
      const last = chatHistory[agentId][chatHistory[agentId].length - 1];
      if (last.role === 'user') {
        chatHistory[agentId].push({ role: 'assistant', content: 'No response generated.' });
      }
    }
    renderChat(agentId);
  } catch (err) {
    if (err.name === 'AbortError') return;
    const el = document.getElementById('typing-indicator'); if (el) el.remove();
    const msg = document.getElementById('stream-msg'); if (msg) msg.remove();
    chatHistory[agentId].push({ role: 'assistant', content: 'Error: ' + err.message });
    renderChat(agentId);
  } finally {
    isSending = false; abortController = null;
    const inp = document.getElementById('chat-input');
    if (inp) { inp.disabled = false; inp.focus(); }
  }
}

// ═══ CODE LAB ═══
function onLangChange() {
  const lang = document.getElementById('lang-select').value;
  document.getElementById('code-editor').value = BOILERPLATE[lang] || '';
  document.getElementById('editor-label').textContent = lang.charAt(0).toUpperCase() + lang.slice(1) + ' Editor';
  document.getElementById('terminal-panel').classList.add('hidden');
}
function copyCode() { navigator.clipboard.writeText(document.getElementById('code-editor').value); }
async function runCode() {
  const btn = document.getElementById('run-btn'); btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="border-top-color:#FFF"></div><span>Running...</span>';
  const panel = document.getElementById('terminal-panel'); panel.classList.remove('hidden');
  document.getElementById('terminal-output').textContent = 'Compiling and running...';
  document.getElementById('terminal-output').className = 'term-out';
  document.getElementById('exec-status').textContent = ''; document.getElementById('exec-status').className = 'badge';
  const lang = document.getElementById('lang-select').value, code = document.getElementById('code-editor').value;
  try {
    const res = await fetch(PISTON_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: lang, code: code }) });
    const data = await res.json(); const run = data.run || {};
    const out = (run.stdout || '') + (run.stderr ? '\n\nError:\n' + run.stderr : '');
    document.getElementById('terminal-output').textContent = out || 'No output.';
    const b = document.getElementById('exec-status');
    if (run.code === 0 && !run.stderr) {
      document.getElementById('terminal-output').className = 'term-out'; b.textContent = 'Success'; b.className = 'badge success';
    } else {
      document.getElementById('terminal-output').className = 'term-out err'; b.textContent = 'Error'; b.className = 'badge error';
    }
  } catch (err) {
    document.getElementById('terminal-output').textContent = 'Network error: ' + err.message;
    document.getElementById('terminal-output').className = 'term-out err';
    document.getElementById('exec-status').textContent = 'Error'; document.getElementById('exec-status').className = 'badge error';
  }
  btn.disabled = false; btn.innerHTML = '<span class="material-icons-outlined">play_arrow</span><span>Run Code</span>';
}