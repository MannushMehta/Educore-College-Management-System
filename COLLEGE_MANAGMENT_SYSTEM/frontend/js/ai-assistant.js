/**
 * EduCore AI Assistant
 * Works in two modes:
 *   1. PHP mode  — calls ai_proxy.php (API key stays on server, secure)
 *   2. Direct mode — user pastes their key into the widget (no server needed)
 */

(function () {
  const PROXY_URL   = '../../backend/php/ai_proxy.php';
  const LS_KEY_NAME = 'cms_anthropic_key';

  // ── Inject CSS ──────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #ai-fab {
      position:fixed;bottom:28px;right:28px;z-index:9999;
      width:60px;height:60px;border-radius:50%;
      background:linear-gradient(135deg,#0B1D3A,#1a3560);
      border:none;cursor:pointer;box-shadow:0 6px 24px rgba(11,29,58,.40);
      display:flex;align-items:center;justify-content:center;
      transition:transform .2s,box-shadow .2s;
    }
    #ai-fab:hover{transform:scale(1.08);box-shadow:0 10px 32px rgba(11,29,58,.55);}
    #ai-fab svg{width:28px;height:28px;}

    #ai-window {
      position:fixed;bottom:100px;right:28px;z-index:9998;
      width:390px;max-height:580px;
      background:#fff;border-radius:18px;
      box-shadow:0 12px 48px rgba(11,29,58,.22);
      display:flex;flex-direction:column;
      transform:scale(.92) translateY(16px);opacity:0;pointer-events:none;
      transition:transform .25s cubic-bezier(.34,1.56,.64,1),opacity .2s;
      overflow:hidden;
    }
    #ai-window.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}

    #ai-header{
      background:linear-gradient(135deg,#0B1D3A,#1a3560);
      padding:16px 18px;display:flex;align-items:center;gap:12px;
    }
    #ai-header .avatar{
      width:38px;height:38px;border-radius:50%;
      background:rgba(245,166,35,.22);
      display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.2rem;
    }
    #ai-header .info{flex:1}
    #ai-header .info .name{color:#fff;font-family:'Sora',sans-serif;font-weight:600;font-size:.95rem;}
    #ai-header .info .status{color:rgba(255,255,255,.6);font-size:.75rem;display:flex;align-items:center;gap:5px;margin-top:2px;}
    #ai-header .info .status::before{content:'';width:7px;height:7px;border-radius:50%;background:#2D9D5C;flex-shrink:0;}
    #ai-header .close-btn{
      background:rgba(255,255,255,.12);border:none;border-radius:8px;
      width:30px;height:30px;cursor:pointer;color:#fff;
      display:flex;align-items:center;justify-content:center;font-size:1rem;transition:background .15s;
    }
    #ai-header .close-btn:hover{background:rgba(255,255,255,.22);}

    /* API Key setup banner */
    #ai-key-banner{
      background:#FFF8EC;border-bottom:1px solid #F5A623;
      padding:10px 14px;font-size:.8rem;color:#7A4F00;
      display:none;align-items:flex-start;gap:8px;
    }
    #ai-key-banner.show{display:flex;}
    #ai-key-banner strong{display:block;margin-bottom:4px;}
    #ai-key-input-row{display:flex;gap:6px;margin-top:6px;}
    #ai-key-input-row input{
      flex:1;padding:6px 10px;border:1.5px solid #F5A623;border-radius:6px;
      font-size:.8rem;outline:none;
    }
    #ai-key-input-row button{
      padding:6px 12px;background:#F5A623;border:none;border-radius:6px;
      font-size:.8rem;font-weight:600;color:#0B1D3A;cursor:pointer;
    }

    #ai-chips{
      padding:10px 14px;display:flex;gap:7px;flex-wrap:wrap;
      border-bottom:1px solid #EEF0F7;background:#FAFBFF;
    }
    .ai-chip{
      padding:5px 12px;border-radius:20px;border:1.5px solid #DDE3F0;
      background:#fff;font-size:.75rem;color:#1C2B4A;cursor:pointer;
      transition:.15s;white-space:nowrap;font-family:'DM Sans',sans-serif;
    }
    .ai-chip:hover{border-color:#0B1D3A;background:#0B1D3A;color:#fff;}

    #ai-messages{
      flex:1;overflow-y:auto;padding:14px;
      display:flex;flex-direction:column;gap:10px;min-height:0;
    }
    #ai-messages::-webkit-scrollbar{width:4px;}
    #ai-messages::-webkit-scrollbar-thumb{background:#DDE3F0;border-radius:4px;}

    .ai-msg{display:flex;gap:8px;max-width:93%;}
    .ai-msg.user{align-self:flex-end;flex-direction:row-reverse;}
    .ai-msg .bubble{
      padding:10px 14px;border-radius:16px;
      font-size:.875rem;line-height:1.55;
      font-family:'DM Sans',sans-serif;color:#1C2B4A;
    }
    .ai-msg.bot  .bubble{background:#F0F3FA;border-bottom-left-radius:4px;}
    .ai-msg.user .bubble{background:linear-gradient(135deg,#0B1D3A,#1a3560);color:#fff;border-bottom-right-radius:4px;}
    .ai-msg .msg-avatar{
      width:28px;height:28px;border-radius:50%;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;font-size:.8rem;margin-top:2px;
    }
    .ai-msg.bot  .msg-avatar{background:#EBF0FF;}
    .ai-msg.user .msg-avatar{background:rgba(245,166,35,.2);}

    .typing-dots{display:flex;gap:4px;padding:6px 2px;}
    .typing-dots span{
      width:7px;height:7px;border-radius:50%;background:#9AA5C4;
      animation:ai-bounce 1.2s infinite;
    }
    .typing-dots span:nth-child(2){animation-delay:.2s;}
    .typing-dots span:nth-child(3){animation-delay:.4s;}
    @keyframes ai-bounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-7px);}}

    #ai-input-row{
      padding:12px 14px;border-top:1px solid #EEF0F7;
      display:flex;gap:8px;background:#fff;
    }
    #ai-input{
      flex:1;border:1.5px solid #DDE3F0;border-radius:24px;
      padding:10px 16px;font-family:'DM Sans',sans-serif;font-size:.875rem;
      outline:none;resize:none;max-height:100px;
      color:#1C2B4A;background:#FAFBFF;line-height:1.4;transition:border-color .15s;
    }
    #ai-input:focus{border-color:#0B1D3A;}
    #ai-send{
      width:40px;height:40px;border-radius:50%;flex-shrink:0;
      background:linear-gradient(135deg,#F5A623,#D4891C);
      border:none;cursor:pointer;display:flex;
      align-items:center;justify-content:center;
      transition:transform .15s,opacity .15s;align-self:flex-end;
    }
    #ai-send:hover{transform:scale(1.08);}
    #ai-send:disabled{opacity:.45;cursor:not-allowed;transform:none;}
    #ai-send svg{width:18px;height:18px;}

    @media(max-width:440px){
      #ai-window{width:calc(100vw - 20px);right:10px;bottom:90px;}
      #ai-fab{right:16px;bottom:20px;}
    }
  `;
  document.head.appendChild(style);

  // ── Build HTML ────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="ai-fab" title="AI Assistant" onclick="window.__aiToggle()">
      <svg viewBox="0 0 24 24" fill="none" stroke="#F5A623" stroke-width="1.8">
        <path d="M12 2a7 7 0 0 1 7 7c0 4-3 6.5-3 9H8c0-2.5-3-5-3-9a7 7 0 0 1 7-7z"/>
        <line x1="9" y1="21" x2="15" y2="21"/><line x1="9.5" y1="18" x2="14.5" y2="18"/>
      </svg>
    </button>

    <div id="ai-window">
      <div id="ai-header">
        <div class="avatar">🤖</div>
        <div class="info">
          <div class="name">EduCore AI Assistant</div>
          <div class="status">Powered by Claude</div>
        </div>
        <button class="close-btn" onclick="window.__aiToggle()">✕</button>
      </div>

      <!-- API key setup banner (shown when no key configured) -->
      <div id="ai-key-banner">
        <span>🔑</span>
        <div style="flex:1">
          <strong>Anthropic API Key Required</strong>
          Enter your key from <a href="https://console.anthropic.com" target="_blank" style="color:#D4891C">console.anthropic.com</a> to enable AI chat.
          <div class="ai-key-input-row" id="ai-key-input-row">
            <input id="ai-key-field" type="password" placeholder="sk-ant-..." />
            <button onclick="window.__aiSaveKey()">Save</button>
          </div>
        </div>
      </div>

      <div id="ai-chips">
        <button class="ai-chip" onclick="window.__aiChip(this)">📅 My Schedule</button>
        <button class="ai-chip" onclick="window.__aiChip(this)">📊 My Grades</button>
        <button class="ai-chip" onclick="window.__aiChip(this)">📋 Attendance</button>
        <button class="ai-chip" onclick="window.__aiChip(this)">📚 Study Tips</button>
        <button class="ai-chip" onclick="window.__aiChip(this)">🧮 GPA Calculator</button>
        <button class="ai-chip" onclick="window.__aiClearKey()" style="color:#c00;border-color:#c00" title="Reset API Key">🔑 Change Key</button>
      </div>

      <div id="ai-messages">
        <div class="ai-msg bot">
          <div class="msg-avatar">🤖</div>
          <div class="bubble">
            Hi! I'm <strong>EduCore AI</strong> 👋<br><br>
            I can help with schedules, grades, attendance, study tips, GPA calculations and more.<br><br>
            <em>Enter your Anthropic API key above to get started.</em>
          </div>
        </div>
      </div>

      <div id="ai-input-row">
        <textarea id="ai-input" rows="1" placeholder="Ask me anything…"></textarea>
        <button id="ai-send" onclick="window.__aiSend()" title="Send">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // ── State ────────────────────────────────────────────────
  let isOpen    = false;
  let isWaiting = false;
  const history = [];

  // ── Key management ────────────────────────────────────────
  function getSavedKey() {
    return localStorage.getItem(LS_KEY_NAME) || '';
  }

  function checkKeyBanner() {
    const banner = document.getElementById('ai-key-banner');
    if (!getSavedKey()) {
      banner.classList.add('show');
    } else {
      banner.classList.remove('show');
    }
  }

  window.__aiSaveKey = function () {
    const val = document.getElementById('ai-key-field').value.trim();
    if (!val || !val.startsWith('sk-ant-')) {
      document.getElementById('ai-key-field').style.borderColor = '#E53E3E';
      document.getElementById('ai-key-field').placeholder = 'Must start with sk-ant-...';
      return;
    }
    localStorage.setItem(LS_KEY_NAME, val);
    document.getElementById('ai-key-field').value = '';
    checkKeyBanner();
    appendMsg('bot', '✅ API key saved! I\'m ready to help. What would you like to know?');
  };

  window.__aiClearKey = function () {
    localStorage.removeItem(LS_KEY_NAME);
    checkKeyBanner();
  };

  // ── System prompt ─────────────────────────────────────────
  function buildSystemPrompt() {
    const user = JSON.parse(localStorage.getItem('cms_user') || '{}');
    const role = user.role || 'user';
    const name = user.full_name || user.name || 'there';
    return `You are EduCore AI, a friendly assistant embedded in the EduCore College Management System.
The current user is: ${name} (role: ${role}).
Help with: academics, grades, attendance, schedules, GPA calculations, study tips, college processes.
Be concise, warm, and use bullet points for lists. Use emojis sparingly. Stay focused on college/academic topics.`;
  }

  // ── Toggle ────────────────────────────────────────────────
  window.__aiToggle = function () {
    isOpen = !isOpen;
    document.getElementById('ai-window').classList.toggle('open', isOpen);
    if (isOpen) {
      checkKeyBanner();
      setTimeout(() => document.getElementById('ai-input').focus(), 300);
    }
  };

  // ── Chip ─────────────────────────────────────────────────
  window.__aiChip = function (btn) {
    const text = btn.textContent.replace(/^[^\w]+/, '').trim();
    document.getElementById('ai-input').value = text;
    window.__aiSend();
  };

  // ── Append message ────────────────────────────────────────
  function appendMsg(role, text) {
    const msgs = document.getElementById('ai-messages');
    const div  = document.createElement('div');
    div.className = `ai-msg ${role}`;
    div.innerHTML = `
      <div class="msg-avatar">${role === 'bot' ? '🤖' : '🎓'}</div>
      <div class="bubble">${fmt(text)}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const msgs = document.getElementById('ai-messages');
    const div  = document.createElement('div');
    div.className = 'ai-msg bot'; div.id = 'ai-typing';
    div.innerHTML = `<div class="msg-avatar">🤖</div><div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function hideTyping() { document.getElementById('ai-typing')?.remove(); }

  function fmt(t) {
    return t
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/`(.+?)`/g,'<code style="background:#F0F3FA;padding:1px 5px;border-radius:4px;font-size:.85em">$1</code>')
      .replace(/^[-•]\s+(.+)$/gm,'• $1')
      .replace(/\n/g,'<br>');
  }

  // ── Send ──────────────────────────────────────────────────
  window.__aiSend = async function () {
    const input = document.getElementById('ai-input');
    const send  = document.getElementById('ai-send');
    const text  = input.value.trim();
    if (!text || isWaiting) return;

    const apiKey = getSavedKey();
    if (!apiKey) {
      checkKeyBanner();
      appendMsg('bot', '⚠️ Please enter your Anthropic API key first (see the banner above).');
      return;
    }

    input.value = '';
    input.style.height = 'auto';
    isWaiting = true;
    send.disabled = true;

    appendMsg('user', text);
    history.push({ role: 'user', content: text });
    showTyping();

    try {
      // ── Step 1: try PHP proxy (works when PHP server is running) ──
      let reply = null;

      try {
        const token = localStorage.getItem('cms_token') || '';
        const proxyRes = await fetch(PROXY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({ system: buildSystemPrompt(), messages: history }),
        });
        if (proxyRes.ok) {
          const pd = await proxyRes.json();
          if (pd?.success && pd?.data?.reply) reply = pd.data.reply;
        }
      } catch (_) { /* proxy not available, fall through */ }

      // ── Step 2: direct Anthropic call (works if CORS is allowed or using a local dev server) ──
      if (!reply) {
        const directRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: buildSystemPrompt(),
            messages: history,
          }),
        });
        const dd = await directRes.json();
        if (dd?.content?.[0]?.text) {
          reply = dd.content[0].text;
        } else {
          throw new Error(dd?.error?.message || 'No response from AI');
        }
      }

      hideTyping();
      history.push({ role: 'assistant', content: reply });
      appendMsg('bot', reply);

    } catch (err) {
      hideTyping();
      appendMsg('bot',
        '⚠️ **Could not reach AI.** Two options to fix this:\n\n' +
        '**Option A (Recommended):** Start the PHP server:\n`php -S localhost:8000`\nthen open the site at `http://localhost:8000`\n\n' +
        '**Option B:** Some browsers block direct API calls. Try Chrome or disable CORS restrictions.'
      );
    }

    isWaiting = false;
    send.disabled = false;
    input.focus();
  };

  // ── Enter to send ─────────────────────────────────────────
  document.getElementById('ai-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.__aiSend(); }
  });

  // ── Auto-grow textarea ────────────────────────────────────
  document.getElementById('ai-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });

  // Init banner state on load
  checkKeyBanner();
})();
