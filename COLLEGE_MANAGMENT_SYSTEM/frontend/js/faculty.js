/* ============================================================
   faculty.js — Faculty dashboard SPA
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth('faculty');
  if (!user) return;
  document.getElementById('sidebarName').textContent  = user.name;
  document.getElementById('sidebarAvatar').textContent = user.name.charAt(0).toUpperCase();

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      navigateFaculty(item.dataset.page);
    });
  });

  navigateFaculty('dashboard');
});

function navigateFaculty(page) {
  const titles = { dashboard: 'Dashboard', 'my-courses': 'My Courses', attendance: 'Mark Attendance', grades: 'Enter Grades', materials: 'Upload Materials', 'student-list': 'Student List', announcements: 'Announcements' };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  document.getElementById('breadcrumbPage').textContent = titles[page] || page;
  const el = document.getElementById('pageContent');
  el.innerHTML = '';
  ({ dashboard: renderFacultyHome, 'my-courses': renderMyCourses, attendance: renderMarkAttendance, grades: renderEnterGrades, materials: renderMaterials, 'student-list': renderStudentList, announcements: renderFacultyAnnouncements }[page] || (() => {}))(el);
}

// ── FACULTY DASHBOARD ────────────────────────────────────────
function renderFacultyHome(el) {
  el.innerHTML = `
  <div class="page-header">
    <div><h2>Hello, Dr. Sharma 👋</h2><p class="page-desc">Your teaching summary for Fall 2025.</p></div>
    <span class="badge badge-success">Fall 2025 – Active</span>
  </div>
  <div class="stats-grid">
    <div class="stat-card accent-amber">
      <div class="stat-header"><div class="stat-icon amber"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div></div>
      <div class="stat-value">2</div><div class="stat-label">Assigned Courses</div>
    </div>
    <div class="stat-card accent-cyan">
      <div class="stat-header"><div class="stat-icon cyan"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div></div>
      <div class="stat-value">80</div><div class="stat-label">Total Students</div>
    </div>
    <div class="stat-card accent-green">
      <div class="stat-header"><div class="stat-icon green"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div></div>
      <div class="stat-value">87%</div><div class="stat-label">Avg. Attendance</div>
    </div>
    <div class="stat-card accent-navy">
      <div class="stat-header"><div class="stat-icon navy"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div></div>
      <div class="stat-value">4</div><div class="stat-label">Materials Uploaded</div>
    </div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3>My Courses</h3><button class="btn btn-outline btn-sm" onclick="navigateFaculty('my-courses')">View All</button></div>
      <div class="card-body">
        ${MOCK.courses.slice(0,2).map(c => `
        <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <span class="course-code" style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--amber-dim);">${c.code}</span>
              <div style="font-weight:600;margin-top:2px;">${c.title}</div>
            </div>
            <span class="badge badge-info">${c.enrolled} students</span>
          </div>
        </div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Announcements</h3><button class="btn btn-amber btn-sm" onclick="openModal('announcementModal')">+ New</button></div>
      <div class="card-body">
        ${MOCK.announcements.map(a => `
        <div class="announcement-item">
          <div class="ann-icon"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
          <div class="ann-content">
            <div class="ann-title">${a.title}</div>
            <div class="ann-meta"><span>${formatDate(a.date)}</span></div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;

  document.getElementById('saveAnnouncementBtn').onclick = saveAnnouncement;
}

// ── MY COURSES ───────────────────────────────────────────────
function renderMyCourses(el) {
  el.innerHTML = `
  <div class="page-header"><div><h2>My Courses</h2><p class="page-desc">Courses assigned to you this semester.</p></div></div>
  <div class="course-grid">
    ${MOCK.courses.slice(0,2).map(c => `
    <div class="course-card">
      <div class="course-code">${c.code}</div>
      <div class="course-title">${c.title}</div>
      <div style="color:var(--gray-600);font-size:.85rem;">${c.dept}</div>
      <div class="course-meta">
        <span><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>${c.enrolled} students</span>
        <span><strong>${c.credits}</strong> credits</span>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="navigateFaculty('attendance')">Mark Attendance</button>
        <button class="btn btn-outline btn-sm" onclick="navigateFaculty('grades')">Enter Grades</button>
      </div>
    </div>`).join('')}
  </div>`;
}

// ── MARK ATTENDANCE ──────────────────────────────────────────
function renderMarkAttendance(el) {
  el.innerHTML = `
  <div class="page-header"><div><h2>Mark Attendance</h2><p class="page-desc">Record daily student attendance.</p></div></div>
  <div class="card" style="margin-bottom:20px;">
    <div class="card-body">
      <div class="attendance-date-picker">
        <div class="form-group" style="margin:0;">
          <label>Select Course</label>
          <select class="form-control" id="attCourse" style="width:280px;">
            <option value="1">CS401 – Database Systems</option>
            <option value="2">CS402 – Web Technologies</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label>Date</label>
          <input type="date" class="form-control" id="attDate" value="${new Date().toISOString().slice(0,10)}" style="width:180px;">
        </div>
        <button class="btn btn-primary btn-sm" style="align-self:flex-end;" onclick="loadAttendanceList()">Load Students</button>
      </div>
    </div>
  </div>
  <div class="card" id="attendanceListCard" style="display:none;">
    <div class="card-header">
      <h3>Student List</h3>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" onclick="markAll('present')">Mark All Present</button>
        <button class="btn btn-primary btn-sm" onclick="submitAttendance()">Save Attendance</button>
      </div>
    </div>
    <div class="card-body" id="attendanceList"></div>
  </div>`;
}

function loadAttendanceList() {
  const students = [
    { id: 1, roll: 'CS2021001', name: 'Aarav Patel' },
    { id: 2, roll: 'CS2021002', name: 'Zara Khan' },
    { id: 3, roll: 'CS2021003', name: 'Rohan Verma' },
  ];
  const el = document.getElementById('attendanceList');
  el.innerHTML = students.map(s => `
    <div class="student-attendance-row" id="att-row-${s.id}">
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="avatar">${s.name.charAt(0)}</div>
        <div>
          <div style="font-weight:600;">${s.name}</div>
          <div style="font-size:.78rem;color:var(--gray-400);">${s.roll}</div>
        </div>
      </div>
      <div class="att-radio-group">
        <input type="radio" name="att-${s.id}" id="p-${s.id}" value="present" class="att-radio" checked>
        <label for="p-${s.id}" class="att-label present-label">Present</label>
        <input type="radio" name="att-${s.id}" id="a-${s.id}" value="absent" class="att-radio">
        <label for="a-${s.id}" class="att-label absent-label">Absent</label>
        <input type="radio" name="att-${s.id}" id="l-${s.id}" value="late" class="att-radio">
        <label for="l-${s.id}" class="att-label late-label">Late</label>
      </div>
    </div>`).join('');
  document.getElementById('attendanceListCard').style.display = '';
}

function markAll(status) {
  document.querySelectorAll(`input[value="${status}"]`).forEach(r => { r.checked = true; });
}

function submitAttendance() {
  showToast('Attendance saved successfully!', 'success');
}

// ── ENTER GRADES ─────────────────────────────────────────────
function renderEnterGrades(el) {
  const students = [
    { id: 1, roll: 'CS2021001', name: 'Aarav Patel',  internal: 38, external: 72 },
    { id: 2, roll: 'CS2021002', name: 'Zara Khan',    internal: 42, external: 78 },
    { id: 3, roll: 'CS2021003', name: 'Rohan Verma',  internal: 30, external: 58 },
  ];
  el.innerHTML = `
  <div class="page-header"><div><h2>Enter Grades</h2><p class="page-desc">Upload marks for your courses.</p></div></div>
  <div class="card" style="margin-bottom:16px;">
    <div class="card-body">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <div class="form-group" style="margin:0;">
          <label>Course</label>
          <select class="form-control" style="width:280px;">
            <option>CS401 – Database Systems</option>
            <option>CS402 – Web Technologies</option>
          </select>
        </div>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-header">
      <h3>Grade Entry</h3>
      <button class="btn btn-primary btn-sm" onclick="submitGrades()">Save All Grades</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Roll No.</th><th>Student Name</th><th>Internal (50)</th><th>External (100)</th><th>Total</th><th>Grade</th></tr></thead>
        <tbody>
          ${students.map(s => {
            const total = s.internal + s.external;
            const letter = total >= 135 ? 'A+' : total >= 120 ? 'A' : total >= 105 ? 'B+' : total >= 90 ? 'B' : total >= 75 ? 'C' : 'F';
            return `<tr>
              <td><code style="font-size:.8rem;background:var(--gray-100);padding:2px 8px;border-radius:4px;">${s.roll}</code></td>
              <td style="font-weight:600;">${s.name}</td>
              <td><input type="number" class="grade-input" value="${s.internal}" min="0" max="50" id="int-${s.id}" onchange="recalcGrade(${s.id})"></td>
              <td><input type="number" class="grade-input" value="${s.external}" min="0" max="100" id="ext-${s.id}" onchange="recalcGrade(${s.id})"></td>
              <td style="font-weight:700;" id="total-${s.id}">${total}</td>
              <td><span class="${gradeClass(letter)}" id="grade-${s.id}">${letter}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function recalcGrade(id) {
  const int_ = +document.getElementById(`int-${id}`)?.value || 0;
  const ext  = +document.getElementById(`ext-${id}`)?.value || 0;
  const total = int_ + ext;
  const letter = total >= 135 ? 'A+' : total >= 120 ? 'A' : total >= 105 ? 'B+' : total >= 90 ? 'B' : total >= 75 ? 'C' : 'F';
  if (document.getElementById(`total-${id}`)) document.getElementById(`total-${id}`).textContent = total;
  const gradeEl = document.getElementById(`grade-${id}`);
  if (gradeEl) { gradeEl.textContent = letter; gradeEl.className = gradeClass(letter); }
}

function submitGrades() { showToast('Grades saved successfully!', 'success'); }

// ── MATERIALS ────────────────────────────────────────────────
function renderMaterials(el) {
  el.innerHTML = `
  <div class="page-header"><div><h2>Upload Materials</h2><p class="page-desc">Share study materials with your students.</p></div></div>
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3>Upload New Material</h3></div>
      <div class="card-body">
        <div class="form-group">
          <label>Course</label>
          <select class="form-control">
            <option>CS401 – Database Systems</option>
            <option>CS402 – Web Technologies</option>
          </select>
        </div>
        <div class="form-group">
          <label>Title</label>
          <input type="text" class="form-control" placeholder="e.g. Unit 1 Notes">
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea class="form-control" rows="2" placeholder="Brief description"></textarea>
        </div>
        <div class="upload-zone" onclick="showToast('File picker would open here','info')">
          <svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p style="font-weight:600;margin-bottom:4px;">Click to upload file</p>
          <p style="font-size:.8rem;">PDF, PPTX, DOCX, ZIP up to 50 MB</p>
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:14px;" onclick="showToast('Material uploaded!','success')">Upload Material</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Uploaded Materials</h3></div>
      <div class="card-body">
        ${MOCK.materials.map(m => `
        <div class="material-item">
          <div class="material-icon">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div style="flex:1;">
            <div class="material-title">${m.title}</div>
            <div class="material-meta">${m.course} · ${m.type} · ${m.size} · ${formatDate(m.date)}</div>
          </div>
          <button class="material-dl btn btn-danger btn-sm" onclick="showToast('Material deleted','success')">Delete</button>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

// ── STUDENT LIST ─────────────────────────────────────────────
function renderStudentList(el) {
  el.innerHTML = `
  <div class="page-header"><div><h2>Student List</h2><p class="page-desc">Students enrolled in your courses.</p></div></div>
  <div class="card">
    <div class="card-body" style="padding-bottom:0;">
      <div class="table-toolbar">
        <div class="form-group" style="margin:0;">
          <select class="form-control" style="width:260px;">
            <option>CS401 – Database Systems</option>
            <option>CS402 – Web Technologies</option>
          </select>
        </div>
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>#</th><th>Roll No.</th><th>Name</th><th>Attendance</th><th>Grade</th></tr></thead>
        <tbody>
          ${MOCK.students.slice(0,3).map((s, i) => {
            const att = MOCK.attendance[i % MOCK.attendance.length];
            return `<tr>
              <td style="color:var(--gray-400);">${i+1}</td>
              <td><code style="font-size:.8rem;background:var(--gray-100);padding:2px 8px;border-radius:4px;">${s.roll}</code></td>
              <td><div style="display:flex;align-items:center;gap:10px;"><div class="avatar">${s.first.charAt(0)}</div><span style="font-weight:600;">${s.first} ${s.last}</span></div></td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="width:60px;"><div class="progress-bar"><div class="progress-fill ${pctColor(att.pct)}" style="width:${att.pct}%"></div></div></div>
                  <span class="badge ${att.pct>=75?'badge-success':att.pct>=60?'badge-warning':'badge-danger'}">${att.pct}%</span>
                </div>
              </td>
              <td><span class="${gradeClass('A')}">A</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── ANNOUNCEMENTS ────────────────────────────────────────────
function renderFacultyAnnouncements(el) {
  el.innerHTML = `
  <div class="page-header">
    <div><h2>Announcements</h2><p class="page-desc">Manage your course announcements.</p></div>
    <button class="btn btn-primary btn-sm" onclick="openModal('announcementModal')">+ New Announcement</button>
  </div>
  <div class="card">
    <div class="card-body">
      ${MOCK.announcements.map(a => `
      <div class="announcement-item">
        <div class="ann-icon"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
        <div class="ann-content" style="flex:1;">
          <div class="ann-title">${a.title} ${a.pinned ? '<span class="ann-pinned-badge">Pinned</span>' : ''}</div>
          <div class="ann-body">${a.body}</div>
          <div class="ann-meta"><span>${a.author}</span><span>${formatDate(a.date)}</span><span class="badge badge-info">${a.audience}</span></div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="showToast('Deleted','success')">Delete</button>
      </div>`).join('')}
    </div>
  </div>`;

  document.getElementById('saveAnnouncementBtn').onclick = saveAnnouncement;
}

function saveAnnouncement() {
  const title = document.getElementById('annTitle').value.trim();
  const body  = document.getElementById('annBody').value.trim();
  if (!title || !body) { showToast('Title and body required.', 'error'); return; }
  MOCK.announcements.unshift({ id: Date.now(), title, body, author: 'Dr. Sharma', date: new Date().toISOString().slice(0,10), pinned: document.getElementById('annPinned')?.checked || false, audience: document.getElementById('annAudience')?.value || 'students' });
  document.getElementById('announcementForm').reset();
  closeModal('announcementModal');
  showToast('Announcement posted!', 'success');
  renderFacultyAnnouncements(document.getElementById('pageContent'));
}
