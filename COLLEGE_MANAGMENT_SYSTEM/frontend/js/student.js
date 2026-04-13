/* ============================================================
   student.js — Student portal SPA
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth('student');
  if (!user) return;
  document.getElementById('sidebarName').textContent  = user.name;
  document.getElementById('sidebarAvatar').textContent = user.name.charAt(0).toUpperCase();

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      navigateStudent(item.dataset.page);
    });
  });

  navigateStudent('dashboard');
});

function navigateStudent(page) {
  const titles = { dashboard: 'Dashboard', 'my-courses': 'My Courses', attendance: 'My Attendance', grades: 'My Grades', materials: 'Study Materials', timetable: 'Timetable', announcements: 'Announcements', profile: 'My Profile' };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  document.getElementById('breadcrumbPage').textContent = titles[page] || page;
  const el = document.getElementById('pageContent');
  el.innerHTML = '';
  ({ dashboard: renderStudentHome, 'my-courses': renderStudentCourses, attendance: renderStudentAttendance, grades: renderStudentGrades, materials: renderStudentMaterials, timetable: renderStudentTimetable, announcements: renderStudentAnnouncements, profile: renderStudentProfile }[page] || (() => {}))(el);
}

// ── STUDENT HOME ─────────────────────────────────────────────
function renderStudentHome(el) {
  const overallAtt = Math.round(MOCK.attendance.reduce((s, a) => s + a.pct, 0) / MOCK.attendance.length);
  const cgpa = (MOCK.grades.reduce((s, g) => s + g.points, 0) / MOCK.grades.length).toFixed(1);

  el.innerHTML = `
  <div class="page-header">
    <div><h2>Hello, Aarav 👋</h2><p class="page-desc">Your academic overview for Fall 2025.</p></div>
    <span class="badge badge-info">Roll No: CS2021001</span>
  </div>
  <div class="stats-grid">
    <div class="stat-card accent-amber">
      <div class="stat-header"><div class="stat-icon amber"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div></div>
      <div class="stat-value">${MOCK.courses.length}</div><div class="stat-label">Enrolled Courses</div>
    </div>
    <div class="stat-card accent-green">
      <div class="stat-header"><div class="stat-icon green"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div></div>
      <div class="stat-value">${overallAtt}%</div><div class="stat-label">Overall Attendance</div>
    </div>
    <div class="stat-card accent-cyan">
      <div class="stat-header"><div class="stat-icon cyan"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div></div>
      <div class="stat-value">${cgpa}</div><div class="stat-label">Current CGPA</div>
    </div>
    <div class="stat-card accent-navy">
      <div class="stat-header"><div class="stat-icon navy"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg></div></div>
      <div class="stat-value">${MOCK.materials.length}</div><div class="stat-label">Materials Available</div>
    </div>
  </div>

  <!-- Attendance overview + Announcements -->
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3>Attendance Overview</h3><button class="btn btn-outline btn-sm" onclick="navigateStudent('attendance')">Details</button></div>
      <div class="card-body">
        <div class="attendance-grid">
          ${MOCK.attendance.map(a => {
            const cls = pctColor(a.pct);
            return `<div class="attendance-card">
              <div class="course-name">${a.course.split('–')[0].trim()}</div>
              <div class="pct ${cls}">${a.pct}%</div>
              <div style="font-size:.75rem;color:var(--gray-400);">${a.present}/${a.total} classes</div>
              <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${a.pct}%"></div></div>
              ${a.pct < 75 ? '<div style="font-size:.72rem;color:var(--danger);font-weight:600;margin-top:4px;">⚠ Below 75% — Risk!</div>' : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Announcements</h3><button class="btn btn-outline btn-sm" onclick="navigateStudent('announcements')">View All</button></div>
      <div class="card-body">
        ${MOCK.announcements.map(a => `
        <div class="announcement-item">
          <div class="ann-icon"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
          <div class="ann-content">
            <div class="ann-title">${a.title} ${a.pinned ? '<span class="ann-pinned-badge">Pinned</span>' : ''}</div>
            <div class="ann-body">${a.body.substring(0,80)}…</div>
            <div class="ann-meta"><span>${a.author}</span><span>${formatDate(a.date)}</span></div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

// ── MY COURSES ───────────────────────────────────────────────
function renderStudentCourses(el) {
  el.innerHTML = `
  <div class="page-header"><div><h2>My Courses</h2><p class="page-desc">Your enrolled courses this semester.</p></div></div>
  <div class="course-grid">
    ${MOCK.courses.map(c => `
    <div class="course-card">
      <div class="course-code">${c.code}</div>
      <div class="course-title">${c.title}</div>
      <div style="color:var(--gray-600);font-size:.85rem;">${c.dept}</div>
      <div class="course-meta">
        <span><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${c.faculty}</span>
        <span><strong>${c.credits}</strong> credits</span>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" onclick="navigateStudent('materials')">Materials</button>
        <button class="btn btn-primary btn-sm" onclick="navigateStudent('attendance')">Attendance</button>
      </div>
    </div>`).join('')}
  </div>`;
}

// ── ATTENDANCE ───────────────────────────────────────────────
function renderStudentAttendance(el) {
  el.innerHTML = `
  <div class="page-header"><div><h2>My Attendance</h2><p class="page-desc">Detailed attendance record per course.</p></div></div>
  <div class="card" style="margin-bottom:20px;">
    <div class="card-body">
      <div class="attendance-grid">
        ${MOCK.attendance.map(a => {
          const cls = pctColor(a.pct);
          return `<div class="attendance-card">
            <div class="course-name">${a.course.split('–')[0].trim()}</div>
            <div class="pct ${cls}">${a.pct}%</div>
            <div style="font-size:.78rem;color:var(--gray-600);">${a.present} present · ${a.total - a.present} absent</div>
            <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${a.pct}%"></div></div>
            <span class="badge ${cls === 'good' ? 'badge-success' : cls === 'low' ? 'badge-danger' : 'badge-warning'}" style="align-self:start;">
              ${cls === 'good' ? '✓ Safe' : cls === 'low' ? '✗ Critical' : '⚠ Low'}
            </span>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><h3>Attendance History — CS401</h3></div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Date</th><th>Course</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>05 Aug 2025</td><td>CS401 – Database Systems</td><td><span class="badge badge-success">Present</span></td></tr>
          <tr><td>07 Aug 2025</td><td>CS401 – Database Systems</td><td><span class="badge badge-danger">Absent</span></td></tr>
          <tr><td>12 Aug 2025</td><td>CS401 – Database Systems</td><td><span class="badge badge-success">Present</span></td></tr>
          <tr><td>14 Aug 2025</td><td>CS401 – Database Systems</td><td><span class="badge badge-warning">Late</span></td></tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── GRADES ───────────────────────────────────────────────────
function renderStudentGrades(el) {
  const cgpa = (MOCK.grades.reduce((s, g) => s + g.points, 0) / MOCK.grades.length).toFixed(2);
  el.innerHTML = `
  <div class="page-header">
    <div><h2>My Grades</h2><p class="page-desc">Grade card for Fall 2025.</p></div>
    <div style="text-align:right;">
      <div style="font-size:.78rem;color:var(--gray-400);text-transform:uppercase;letter-spacing:.06em;">Cumulative GPA</div>
      <div style="font-family:'Sora',sans-serif;font-size:2rem;font-weight:800;color:var(--success);">${cgpa}</div>
    </div>
  </div>
  <div class="course-grid" style="margin-bottom:24px;">
    ${MOCK.grades.map(g => `
    <div class="grade-card">
      <div class="course-code">${g.code}</div>
      <div class="course-name">${g.title}</div>
      <div class="marks-row">
        <div class="mark-box">
          <div class="mark-label">Internal</div>
          <div class="mark-val" style="color:var(--navy);">${g.internal}</div>
        </div>
        <div class="mark-box">
          <div class="mark-label">External</div>
          <div class="mark-val" style="color:var(--navy);">${g.external}</div>
        </div>
        <div class="mark-box">
          <div class="mark-label">Total</div>
          <div class="mark-val" style="color:var(--navy);">${g.total}</div>
        </div>
        <div class="mark-box" style="background:rgba(245,166,35,.08);">
          <div class="mark-label">Grade</div>
          <div class="mark-val ${gradeClass(g.letter)}">${g.letter}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.8rem;color:var(--gray-600);margin-top:8px;">
        <span>Grade Points</span><span style="font-weight:700;color:var(--gray-800);">${g.points}</span>
      </div>
    </div>`).join('')}
  </div>`;
}

// ── MATERIALS ────────────────────────────────────────────────
function renderStudentMaterials(el) {
  el.innerHTML = `
  <div class="page-header"><div><h2>Study Materials</h2><p class="page-desc">Download course materials shared by your faculty.</p></div></div>
  <div class="table-toolbar">
    <select class="form-control" style="width:260px;" id="matCourseFilter" onchange="filterMaterials(this.value)">
      <option value="">All Courses</option>
      <option value="CS401">CS401 – Database Systems</option>
      <option value="CS402">CS402 – Web Technologies</option>
    </select>
  </div>
  <div class="card">
    <div class="card-body" id="materialsList">
      ${renderMaterialsList(MOCK.materials)}
    </div>
  </div>`;
}

function renderMaterialsList(mats) {
  if (!mats.length) return `<div class="empty-state"><p>No materials available.</p></div>`;
  return mats.map(m => `
  <div class="material-item">
    <div class="material-icon">
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        ${m.type === 'PPTX'
          ? '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'
          : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'}
      </svg>
    </div>
    <div style="flex:1;">
      <div class="material-title">${m.title}</div>
      <div class="material-meta">${m.course} · <span class="badge badge-navy" style="font-size:.65rem;">${m.type}</span> · ${m.size} · ${formatDate(m.date)}</div>
    </div>
    <button class="btn btn-primary btn-sm" onclick="showToast('Downloading ${m.title}…','info')">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download
    </button>
  </div>`).join('');
}

function filterMaterials(course) {
  const filtered = course ? MOCK.materials.filter(m => m.course === course) : MOCK.materials;
  const el = document.getElementById('materialsList');
  if (el) el.innerHTML = renderMaterialsList(filtered);
}

// ── TIMETABLE ────────────────────────────────────────────────
function renderStudentTimetable(el) {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  el.innerHTML = `
  <div class="page-header"><div><h2>My Timetable</h2><p class="page-desc">Your weekly class schedule.</p></div></div>
  <div class="card">
    <div class="table-wrap">
      <table class="timetable">
        <thead><tr>${days.map(d => `<th>${d}</th>`).join('')}</tr></thead>
        <tbody>
          <tr>
            ${days.map(day => {
              const slot = MOCK.timetable.find(t => t.day === day);
              return `<td>${slot ? `
                <div class="class-pill">${slot.time}</div>
                <div style="font-weight:600;margin-top:6px;font-size:.85rem;">${slot.course.split('–')[0].trim()}</div>
                <div style="font-size:.75rem;color:var(--gray-400);margin-top:2px;">${slot.room}</div>
                <div style="font-size:.73rem;color:var(--gray-600);margin-top:1px;">${slot.faculty}</div>
              ` : '<span style="color:var(--gray-400);font-size:.8rem;">—</span>'}</td>`;
            }).join('')}
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="card" style="margin-top:20px;">
    <div class="card-header"><h3>All Classes</h3></div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Day</th><th>Time</th><th>Course</th><th>Room</th><th>Faculty</th></tr></thead>
        <tbody>
          ${MOCK.timetable.map(t => `
          <tr>
            <td style="font-weight:600;">${t.day}</td>
            <td><span class="badge badge-navy">${t.time}</span></td>
            <td>${t.course}</td>
            <td style="color:var(--gray-600);">${t.room}</td>
            <td style="color:var(--gray-600);">${t.faculty}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── ANNOUNCEMENTS ────────────────────────────────────────────
function renderStudentAnnouncements(el) {
  document.getElementById('unreadBadge').textContent = '0';
  el.innerHTML = `
  <div class="page-header"><div><h2>Announcements</h2><p class="page-desc">Notices from administration and faculty.</p></div></div>
  <div class="card">
    <div class="card-body">
      ${MOCK.announcements.map(a => `
      <div class="announcement-item">
        <div class="ann-icon"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
        <div class="ann-content">
          <div class="ann-title">${a.title} ${a.pinned ? '<span class="ann-pinned-badge">Pinned</span>' : ''}</div>
          <div class="ann-body">${a.body}</div>
          <div class="ann-meta"><span>${a.author}</span><span>${formatDate(a.date)}</span><span class="badge badge-info">${a.audience}</span></div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

// ── PROFILE ──────────────────────────────────────────────────
function renderStudentProfile(el) {
  el.innerHTML = `
  <div class="page-header"><div><h2>My Profile</h2><p class="page-desc">Your student information.</p></div></div>
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3>Personal Information</h3></div>
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:18px;margin-bottom:24px;">
          <div style="width:72px;height:72px;border-radius:50%;background:var(--navy);display:grid;place-items:center;color:var(--amber);font-family:'Sora',sans-serif;font-size:1.8rem;font-weight:800;">A</div>
          <div>
            <h3 style="margin:0;">Aarav Patel</h3>
            <div style="color:var(--gray-600);font-size:.85rem;">CS2021001 · Semester 7</div>
          </div>
        </div>
        ${[['Email','patel@student.edu'],['Phone','+91 98765 43210'],['Department','Computer Science'],['Batch Year','2021'],['Date of Birth','12 Apr 2003'],['Gender','Male']].map(([l,v]) => `
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--gray-100);">
          <span style="color:var(--gray-600);font-size:.875rem;">${l}</span>
          <span style="font-weight:600;font-size:.875rem;">${v}</span>
        </div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Change Password</h3></div>
      <div class="card-body">
        <div class="form-group"><label>Current Password</label><input type="password" class="form-control" placeholder="••••••••"></div>
        <div class="form-group"><label>New Password</label><input type="password" class="form-control" placeholder="Min 8 characters"></div>
        <div class="form-group"><label>Confirm New Password</label><input type="password" class="form-control" placeholder="Repeat new password"></div>
        <button class="btn btn-primary" style="width:100%;" onclick="showToast('Password updated!','success')">Update Password</button>
      </div>
    </div>
  </div>`;
}
