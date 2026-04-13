/* ============================================================
   utils.js — Shared helpers for EduCore CMS
   ============================================================ */

// ── Toast notification ───────────────────────────────────────
function showToast(message, type = 'info') {
  const icons = {
    success: `<svg class="toast-icon" fill="none" stroke="#22C55E" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error:   `<svg class="toast-icon" fill="none" stroke="#EF4444" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg class="toast-icon" fill="none" stroke="#F5A623" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  };
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<span class="toast-msg">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut .3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── User storage — uses localStorage so it persists across tabs ──
// (sessionStorage was the old approach; localStorage works across all pages)
function getUser() {
  try {
    // Check localStorage first (new), then sessionStorage (fallback)
    const ls = localStorage.getItem('cms_user');
    if (ls) return JSON.parse(ls);
    const ss = sessionStorage.getItem('cms_user');
    if (ss) return JSON.parse(ss);
    return null;
  } catch { return null; }
}

function setUser(user) {
  const str = JSON.stringify(user);
  localStorage.setItem('cms_user', str);
  sessionStorage.setItem('cms_user', str); // keep both in sync
}

function clearUser() {
  localStorage.removeItem('cms_user');
  localStorage.removeItem('cms_token');
  sessionStorage.removeItem('cms_user');
}

function requireAuth(role = null) {
  const user = getUser();
  if (!user) {
    // Last resort: check raw localStorage in case setUser wasn't called
    try {
      const raw = localStorage.getItem('cms_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (!role || u.role === role) return u;
      }
    } catch(e) {}
    window.location.href = 'login.html';
    return null;
  }
  if (role && user.role !== role) { window.location.href = 'login.html'; return null; }
  return user;
}

// ── Get display name (handles full_name or name field) ───────
function getUserName(user) {
  if (!user) return 'User';
  return user.full_name || user.name || user.username || 'User';
}

// ── Modal helpers ────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

document.addEventListener('click', e => {
  if (e.target.matches('[data-close]')) closeModal(e.target.dataset.close);
  if (e.target.matches('.modal-overlay')) closeModal(e.target.id);
});

// ── Sidebar helpers ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearUser();
    showToast('Logged out successfully', 'success');
    setTimeout(() => window.location.href = 'login.html', 700);
  });
});

// ── Utility helpers ──────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function pctColor(pct) {
  if (pct >= 75) return 'good';
  if (pct >= 60) return 'average';
  return 'low';
}

function gradeClass(letter) {
  if (!letter) return '';
  const g = letter.charAt(0).toUpperCase();
  if (g === 'A') return 'grade-A';
  if (g === 'B') return 'grade-B';
  if (g === 'C') return 'grade-C';
  return 'grade-F';
}

function initSidebarNav(activePage) {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === activePage);
  });
}

// ── MOCK data (demo mode — no backend needed) ────────────────
const MOCK = {
  students: [
    { id: 1, roll: 'CS2021001', first: 'Aarav',  last: 'Patel', dept: 'Computer Science', semester: 7, email: 'patel@student.edu', gender: 'male',   status: 'active' },
    { id: 2, roll: 'CS2021002', first: 'Zara',   last: 'Khan',  dept: 'Computer Science', semester: 7, email: 'khan@student.edu',  gender: 'female', status: 'active' },
    { id: 3, roll: 'EE2022001', first: 'Rohan',  last: 'Verma', dept: 'Electronics Eng.',  semester: 5, email: 'verma@student.edu', gender: 'male',   status: 'active' },
    { id: 4, roll: 'ME2023001', first: 'Simran', last: 'Kaur',  dept: 'Mechanical Eng.',   semester: 3, email: 'kaur@student.edu',  gender: 'female', status: 'active' },
  ],
  faculty: [
    { id: 1, empId: 'FAC001', first: 'Rajesh', last: 'Sharma', designation: 'Associate Professor', dept: 'Computer Science', email: 'sharma@college.edu', courses: 2 },
    { id: 2, empId: 'FAC002', first: 'Priya',  last: 'Mehta',  designation: 'Assistant Professor',  dept: 'Electronics Eng.',  email: 'mehta@college.edu',  courses: 1 },
  ],
  courses: [
    { id: 1, code: 'CS401', title: 'Database Systems',         credits: 4, dept: 'Computer Science', faculty: 'Dr. Rajesh Sharma', enrolled: 42, max: 60 },
    { id: 2, code: 'CS402', title: 'Web Technologies',         credits: 3, dept: 'Computer Science', faculty: 'Dr. Rajesh Sharma', enrolled: 38, max: 60 },
    { id: 3, code: 'EE301', title: 'Digital Signal Processing',credits: 4, dept: 'Electronics Eng.',  faculty: 'Prof. Priya Mehta',  enrolled: 28, max: 40 },
  ],
  announcements: [
    { id: 1, title: 'Welcome to Fall 2025!', body: 'Classes begin August 1st. Please check your schedules on the portal.', author: 'Admin', date: '2025-07-28', pinned: true,  audience: 'all' },
    { id: 2, title: 'Database Systems — Lab Schedule', body: 'Lab sessions every Friday 2–4 PM in Lab 1. Attendance mandatory.', author: 'Dr. Sharma', date: '2025-08-02', pinned: false, audience: 'students' },
  ],
  enrollments: [
    { id: 1, student: 'Aarav Patel',  roll: 'CS2021001', course: 'CS401 – Database Systems',         status: 'active' },
    { id: 2, student: 'Aarav Patel',  roll: 'CS2021001', course: 'CS402 – Web Technologies',         status: 'active' },
    { id: 3, student: 'Zara Khan',    roll: 'CS2021002', course: 'CS401 – Database Systems',         status: 'active' },
    { id: 4, student: 'Zara Khan',    roll: 'CS2021002', course: 'EE301 – Digital Signal Processing', status: 'active' },
  ],
  attendance: [
    { course: 'CS401 – Database Systems',        total: 24, present: 22, pct: 92 },
    { course: 'CS402 – Web Technologies',         total: 18, present: 14, pct: 78 },
    { course: 'EE301 – Digital Signal Processing',total: 20, present: 12, pct: 60 },
  ],
  grades: [
    { code: 'CS401', title: 'Database Systems',         internal: 38, external: 72, total: 110, letter: 'A',  points: 9.0 },
    { code: 'CS402', title: 'Web Technologies',         internal: 42, external: 78, total: 120, letter: 'A+', points: 10.0 },
    { code: 'EE301', title: 'Digital Signal Processing',internal: 30, external: 58, total: 88,  letter: 'B+', points: 8.0 },
  ],
  materials: [
    { id: 1, course: 'CS401', title: 'Unit 1 – ER Diagrams',      type: 'PDF',  size: '2.4 MB', date: '2025-08-05', url: '#' },
    { id: 2, course: 'CS401', title: 'SQL Practice Problems',     type: 'PDF',  size: '1.1 MB', date: '2025-08-10', url: '#' },
    { id: 3, course: 'CS402', title: 'Week 1 – HTML & CSS Notes', type: 'PDF',  size: '3.2 MB', date: '2025-08-07', url: '#' },
    { id: 4, course: 'CS402', title: 'JavaScript Basics Slides',  type: 'PPTX', size: '5.6 MB', date: '2025-08-12', url: '#' },
  ],
  // NOTE: registrations intentionally empty here — real ones come from localStorage
  registrations: [],
  timetable: [
    { day: 'Monday',    time: '09:00 – 10:30', course: 'CS401 – Database Systems',         room: 'Room 101', faculty: 'Dr. R. Sharma' },
    { day: 'Tuesday',   time: '11:00 – 12:00', course: 'CS402 – Web Technologies',         room: 'Room 202', faculty: 'Dr. R. Sharma' },
    { day: 'Wednesday', time: '09:00 – 10:30', course: 'CS401 – Database Systems',         room: 'Room 101', faculty: 'Dr. R. Sharma' },
    { day: 'Thursday',  time: '14:00 – 15:30', course: 'EE301 – Digital Signal Processing',room: 'Lab 1',    faculty: 'Prof. P. Mehta'  },
  ]
};
