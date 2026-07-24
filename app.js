// ─── CONFIG ───
const SUPABASE_URL = CONFIG.supabaseUrl;
const SUPABASE_KEY = CONFIG.supabaseKey;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

const AGENTS = {};
_agents.forEach(a => { AGENTS[a.id] = a; });

const BOILERPLATE = {
  c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  python: 'print("Hello, World!")',
};

// ─── STATE ───
let isLogin = true;
let currentUser = null;
let chatHistory = {};
let currentAgent = null;

// ─── SUPABASE AUTH ───
const AUTH_PROXY = '/api/auth';

async function supabaseAuth(endpoint, body) {
  const url = `${AUTH_PROXY}?path=${endpoint}`;
  console.log('Auth request:', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log('Auth response:', res.status, text);
    let data;
    try { data = JSON.parse(text); } catch(e) { throw new Error('Server returned: ' + text.substring(0, 200)); }
    if (!res.ok) throw new Error(data.error_description || data.msg || data.error_code || 'Auth failed');
    return data;
  } catch (err) {
    console.error('Auth error:', err);
    throw err;
  }
}

function saveSession(data) {
  localStorage.setItem('sn_access', data.access_token);
  localStorage.setItem('sn_refresh', data.refresh_token);
  currentUser = data.user;
}

function loadSession() {
  const token = localStorage.getItem('sn_access');
  const user = localStorage.getItem('sn_user');
  if (token && user) {
    currentUser = JSON.parse(user);
    return true;
  }
  return false;
}

function clearSession() {
  localStorage.removeItem('sn_access');
  localStorage.removeItem('sn_refresh');
  localStorage.removeItem('sn_user');
  currentUser = null;
}

// ─── INIT ───
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('code-editor').value = BOILERPLATE.python;

  // Splash
  setTimeout(() => {
    document.getElementById('splash').classList.add('fade-out');
    setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      if (loadSession()) {
        showApp();
      } else {
        document.getElementById('auth').classList.remove('hidden');
      }
    }, 800);
  }, 3000);

  document.getElementById('auth-form').addEventListener('submit', handleAuth);
});

// ─── AUTH ───
async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const pass = document.getElementById('password').value;
  const btn = document.getElementById('auth-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';

  try {
    const data = isLogin
      ? await supabaseAuth('token?grant_type=password', { email, password: pass })
      : await supabaseAuth('signup', { email, password: pass });
    saveSession(data);
    localStorage.setItem('sn_user', JSON.stringify(data.user));
    showApp();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = isLogin ? 'Sign In' : 'Sign Up';
  }
}

function toggleAuthMode(e) {
  e.preventDefault();
  isLogin = !isLogin;
  document.getElementById('auth-title').textContent = isLogin ? 'Welcome Back' : 'Create Account';
  document.getElementById('auth-subtitle').textContent = isLogin ? 'Sign in to continue learning' : 'Join the learning community';
  document.getElementById('auth-btn').textContent = isLogin ? 'Sign In' : 'Sign Up';
  document.getElementById('toggle-text').textContent = isLogin ? "Don't have an account? " : 'Already have an account? ';
}

function togglePassword() {
  const inp = document.getElementById('password');
  const icon = document.getElementById('eye-icon');
  if (inp.type === 'password') { inp.type = 'text'; icon.textContent = 'visibility'; }
  else { inp.type = 'password'; icon.textContent = 'visibility_off'; }
}

function showApp() {
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  if (currentUser) {
    document.getElementById('profile-email').textContent = currentUser.email || '-';
    document.getElementById('profile-email2').textContent = currentUser.email || '-';
    document.getElementById('profile-uid').textContent = (currentUser.id || '-').substring(0, 16) + '...';
  }
}

function signOut() {
  clearSession();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth').classList.remove('hidden');
  isLogin = true;
  document.getElementById('auth-title').textContent = 'Welcome Back';
  document.getElementById('auth-subtitle').textContent = 'Sign in to continue learning';
  document.getElementById('auth-btn').textContent = 'Sign In';
  document.getElementById('email').value = '';
  document.getElementById('password').value = '';
}

// ─── NAV ───
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('bottom-nav').style.display = tab === 'chat' ? 'none' : 'flex';
}

// ─── CHAT ───
function openChat(agentId) {
  currentAgent = AGENTS[agentId];
  if (!chatHistory[agentId]) chatHistory[agentId] = [];

  document.getElementById('chat-agent-icon').textContent = currentAgent.icon;
  document.getElementById('chat-agent-name').textContent = currentAgent.name;
  document.getElementById('chat-empty-icon').textContent = currentAgent.icon;
  document.getElementById('chat-empty-name').textContent = currentAgent.name;
  document.getElementById('chat-empty-desc').textContent = currentAgent.desc;

  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-chat').classList.add('active');
  document.getElementById('bottom-nav').style.display = 'none';

  renderChatHistory(agentId);
}

function closeChat() {
  currentAgent = null;
  document.getElementById('tab-chat').classList.remove('active');
  document.getElementById('tab-ai').classList.add('active');
  document.getElementById('bottom-nav').style.display = 'flex';
}

function renderChatHistory(agentId) {
  const container = document.getElementById('chat-messages');
  const msgs = chatHistory[agentId] || [];
  container.innerHTML = '';

  if (msgs.length === 0) {
    container.innerHTML = `
      <div class="chat-empty">
        <span class="chat-empty-emoji">${currentAgent.icon}</span>
        <h3>${currentAgent.name}</h3>
        <p>${currentAgent.desc}</p>
      </div>`;
    return;
  }

  msgs.forEach(m => {
    container.insertAdjacentHTML('beforeend',
      `<div class="msg ${m.role}">${formatMsg(m.content)}</div>`);
  });
  container.scrollTop = container.scrollHeight;
}

function formatMsg(text) {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  return html;
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !currentAgent) return;

  input.value = '';
  const agentId = currentAgent.id;

  chatHistory[agentId] = chatHistory[agentId] || [];
  chatHistory[agentId].push({ role: 'user', content: text });
  renderChatHistory(agentId);

  const container = document.getElementById('chat-messages');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'typing';
  typingDiv.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;

  try {
    const apiMessages = [
      { role: 'system', content: currentAgent.sys },
      ...chatHistory[agentId].map(m => ({ role: m.role, content: m.content })),
    ];

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAgent.key}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Sem Nexus AI',
      },
      body: JSON.stringify({ model: currentAgent.model, messages: apiMessages, max_tokens: 2048, temperature: 0.7 }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'AI request failed');

    const reply = data.choices[0].message.content;
    chatHistory[agentId].push({ role: 'assistant', content: reply });
  } catch (err) {
    chatHistory[agentId].push({ role: 'assistant', content: 'Sorry, an error occurred. Please try again.\n\n' + err.message });
  }

  renderChatHistory(agentId);
}

// ─── CODE LAB ───
function onLangChange() {
  const lang = document.getElementById('lang-select').value;
  document.getElementById('code-editor').value = BOILERPLATE[lang] || '';
  document.getElementById('editor-label').textContent =
    lang.charAt(0).toUpperCase() + lang.slice(1) + ' Editor';
  document.getElementById('terminal-panel').classList.add('hidden');
}

function copyCode() {
  navigator.clipboard.writeText(document.getElementById('code-editor').value);
}

async function runCode() {
  const btn = document.getElementById('run-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="border-top-color:#121212"></div><span>Running...</span>';

  const panel = document.getElementById('terminal-panel');
  panel.classList.remove('hidden');
  document.getElementById('terminal-output').textContent = 'Compiling and running...';
  document.getElementById('terminal-output').className = 'terminal-output';
  document.getElementById('exec-status').textContent = '';
  document.getElementById('exec-status').className = 'exec-badge';

  const lang = document.getElementById('lang-select').value;
  const code = document.getElementById('code-editor').value;

  const fileNames = { c:'main.c', cpp:'main.cpp', java:'Main.java', python:'main.py' };

  try {
    const res = await fetch(PISTON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang, files: [{ name: fileNames[lang], content: code }] }),
    });
    const data = await res.json();
    const run = data.run || {};
    const output = (run.output || '') + (run.stderr ? '\n\nError:\n' + run.stderr : '');

    const termOut = document.getElementById('terminal-output');
    termOut.textContent = output || 'No output.';
    const badge = document.getElementById('exec-status');

    if (run.code === 0 && !run.stderr) {
      termOut.className = 'terminal-output';
      badge.textContent = 'Success';
      badge.className = 'exec-badge success';
    } else {
      termOut.className = 'terminal-output has-error';
      badge.textContent = 'Error';
      badge.className = 'exec-badge error';
    }
  } catch (err) {
    document.getElementById('terminal-output').textContent = 'Network error: ' + err.message;
    document.getElementById('terminal-output').className = 'terminal-output has-error';
    document.getElementById('exec-status').textContent = 'Error';
    document.getElementById('exec-status').className = 'exec-badge error';
  }

  btn.disabled = false;
  btn.innerHTML = '<span class="material-icons-outlined">play_arrow</span><span>Run Code</span>';
}
