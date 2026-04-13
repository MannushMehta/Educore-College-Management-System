/* ============================================================
   auth.js — Login logic
   Works in demo mode (file://) AND with real PHP backend
   ============================================================ */

const DEMO_USERS = {
  admin:   { id: 1, username: 'admin',     password: 'Admin@123',   full_name: 'Administrator',    role: 'admin'   },
  faculty: { id: 2, username: 'dr_sharma', password: 'Faculty@123', full_name: 'Dr. Rajesh Sharma', role: 'faculty' },
  student: { id: 4, username: 'stu_patel', password: 'Student@123', full_name: 'Aarav Patel',       role: 'student' },
};

document.addEventListener('DOMContentLoaded', () => {

  // ── Role tabs ──────────────────────────────────────────────
  const tabs      = document.querySelectorAll('.role-tab');
  const roleInput = document.getElementById('selectedRole');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      roleInput.value = tab.dataset.role;
    });
  });

  // ── Password toggle ────────────────────────────────────────
  document.getElementById('togglePwd')?.addEventListener('click', () => {
    const pwd = document.getElementById('password');
    pwd.type  = pwd.type === 'password' ? 'text' : 'password';
  });

  // ── Login form ─────────────────────────────────────────────
  document.getElementById('loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const role     = document.getElementById('selectedRole').value;
    const btn      = document.getElementById('loginBtn');
    const errBox   = document.getElementById('loginError');

    // Basic validation
    let valid = true;
    if (!username) { document.getElementById('usernameError').classList.add('visible');    valid = false; }
    else             document.getElementById('usernameError').classList.remove('visible');
    if (!password) { document.getElementById('passwordError').classList.add('visible');    valid = false; }
    else             document.getElementById('passwordError').classList.remove('visible');
    if (!valid) return;

    btn.classList.add('loading');
    errBox.style.display = 'none';

    // ── Try PHP backend first; fall back to demo on ANY error ─
    let loggedInUser = null;

    try {
      const res  = await fetch('../../backend/php/auth.php?action=login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password, role }),
      });
      const text = await res.text();           // read as text first
      const data = JSON.parse(text);           // THEN parse — throws if PHP returned raw source
      if (data.success && data.data && data.data.user) {
        localStorage.setItem('cms_token', data.data.token || '');
        loggedInUser = data.data.user;
      } else {
        throw new Error(data.message || 'Invalid credentials');
      }
    } catch (phpErr) {
      // PHP not available or returned non-JSON — use demo credentials
      const demo = DEMO_USERS[role];
      if (demo && demo.username === username && demo.password === password) {
        loggedInUser = { id: demo.id, username: demo.username, full_name: demo.full_name, role: demo.role };
        localStorage.setItem('cms_token', 'demo-token');
      } else {
        // Check if it was a real auth failure (PHP responded with JSON error)
        const msg = phpErr.message || '';
        const isAuthFail = msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('password');
        btn.classList.remove('loading');
        errBox.textContent = isAuthFail
          ? 'Invalid username or password.'
          : 'Invalid username or password. (Demo: admin / Admin@123)';
        errBox.style.display = 'block';
        return;
      }
    }

    // ── Success ────────────────────────────────────────────
    localStorage.setItem('cms_user', JSON.stringify(loggedInUser));
    sessionStorage.setItem('cms_user', JSON.stringify(loggedInUser));

    const pages = {
      admin:   'admin-dashboard.html',
      faculty: 'faculty-dashboard.html',
      student: 'student-dashboard.html',
    };
    showToast('Login successful! Redirecting…', 'success');
    setTimeout(() => { window.location.href = pages[loggedInUser.role] || 'login.html'; }, 700);
  });
});
