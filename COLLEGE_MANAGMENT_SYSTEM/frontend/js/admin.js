/* ============================================================
   admin.js — Admin dashboard SPA routing and page rendering
   ============================================================ */

let currentPage = 'dashboard';
let editingStudentId = null;
let editingFacultyId = null;
let editingCourseId  = null;

document.addEventListener('DOMContentLoaded', () => {
  const user = requireAuth('admin');
  if (!user) return;

  // Set user info in sidebar
  const displayName = getUserName(user);
  document.getElementById('sidebarName').textContent = displayName;
  document.getElementById('sidebarAvatar').textContent = displayName.charAt(0).toUpperCase();

  // Sidebar nav routing
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      navigateTo(item.dataset.page);
    });
  });

  navigateTo('dashboard');

  // Update pending badge from localStorage on page load
  updatePendingBadge();
});

function navigateTo(page) {
  currentPage = page;
  const titles = {
    'dashboard':         'Dashboard',
    'students':          'Students',
    'faculty':           'Faculty',
    'courses':           'Courses',
    'enrollments':       'Enrollments',
    'schedules':         'Schedules',
    'attendance-report': 'Attendance Report',
    'grades-report':     'Grades Report',
    'registrations':     'Registration Approvals',
    'announcements':     'Announcements',
    'settings':          'Settings'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  document.getElementById('breadcrumbPage').textContent = titles[page] || page;

  const content = document.getElementById('pageContent');
  content.innerHTML = '';

  const pages = {
    'dashboard':         renderAdminDashboard,
    'students':          renderStudentsPage,
    'faculty':           renderFacultyPage,
    'courses':           renderCoursesPage,
    'enrollments':       renderEnrollmentsPage,
    'attendance-report': renderAttendanceReport,
    'grades-report':     renderGradesReport,
    'registrations':     renderRegistrations,
    'announcements':     renderAnnouncementsPage,
  };

  if (pages[page]) pages[page](content);
  else content.innerHTML = `<div class="empty-state"><p>Page not yet implemented.</p></div>`;
}

// ── DASHBOARD ────────────────────────────────────────────────
function renderAdminDashboard(el) {
  el.innerHTML = `
  <div class="page-header">
    <div>
      <h2>Good morning, Admin 👋</h2>
      <p class="page-desc">Here's what's happening at your institution today.</p>
    </div>
    <span class="badge badge-success">Fall 2025 – Active</span>
  </div>

  <div class="stats-grid">
    <div class="stat-card accent-amber">
      <div class="stat-header">
        <div class="stat-icon amber">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <span class="stat-change up">▲ 12%</span>
      </div>
      <div class="stat-value">${MOCK.students.length}</div>
      <div class="stat-label">Total Students</div>
    </div>

    <div class="stat-card accent-cyan">
      <div class="stat-header">
        <div class="stat-icon cyan">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <span class="stat-change up">▲ 4%</span>
      </div>
      <div class="stat-value">${MOCK.faculty.length}</div>
      <div class="stat-label">Faculty Members</div>
    </div>

    <div class="stat-card accent-green">
      <div class="stat-header">
        <div class="stat-icon green">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        </div>
        <span class="stat-change up">▲ 2</span>
      </div>
      <div class="stat-value">${MOCK.courses.length}</div>
      <div class="stat-label">Active Courses</div>
    </div>

    <div class="stat-card accent-danger">
      <div class="stat-header">
        <div class="stat-icon danger">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <span class="stat-change" style="color:var(--warning)">● Pending</span>
      </div>
      <div class="stat-value">${getRegistrations().filter(r=>r.status==="pending").length || 0}</div>
      <div class="stat-label">Pending Approvals</div>
    </div>
  </div>

  <div class="grid-2">
    <!-- Recent Announcements -->
    <div class="card">
      <div class="card-header">
        <h3>Recent Announcements</h3>
        <button class="btn btn-outline btn-sm" onclick="navigateTo('announcements')">View All</button>
      </div>
      <div class="card-body">
        ${MOCK.announcements.map(a => `
          <div class="announcement-item">
            <div class="ann-icon">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div class="ann-content">
              <div class="ann-title">${a.title} ${a.pinned ? '<span class="ann-pinned-badge">Pinned</span>' : ''}</div>
              <div class="ann-body">${a.body.substring(0,80)}…</div>
              <div class="ann-meta"><span>${a.author}</span><span>${formatDate(a.date)}</span><span class="badge badge-info">${a.audience}</span></div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Enrollment Overview -->
    <div class="card">
      <div class="card-header">
        <h3>Course Enrollment</h3>
        <button class="btn btn-outline btn-sm" onclick="navigateTo('courses')">Manage</button>
      </div>
      <div class="card-body">
        ${MOCK.courses.map(c => {
          const pct = Math.round((c.enrolled / c.max) * 100);
          return `
          <div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
              <span style="font-weight:600;font-size:.875rem;">${c.code} – ${c.title}</span>
              <span style="font-size:.8rem;color:var(--gray-600);">${c.enrolled}/${c.max}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill ${pct >= 90 ? 'danger' : pct >= 70 ? 'average' : 'good'}"
                   style="width:${pct}%"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

// ── STUDENTS PAGE ────────────────────────────────────────────
function renderStudentsPage(el) {
  el.innerHTML = `
  <div class="page-header">
    <div><h2>Students</h2><p class="page-desc">Manage all student records.</p></div>
    <button class="btn btn-primary btn-sm" id="addStudentBtn">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Student
    </button>
  </div>
  <div class="card">
    <div class="card-body" style="padding-bottom:0;">
      <div class="table-toolbar">
        <div class="search-input">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search by name or roll number…" id="studentSearch">
        </div>
        <select id="deptFilter">
          <option value="">All Departments</option>
          <option>Computer Science</option>
          <option>Electronics Eng.</option>
          <option>Mechanical Eng.</option>
          <option>Business Administration</option>
        </select>
        <select id="semFilter">
          <option value="">All Semesters</option>
          ${[1,2,3,4,5,6,7,8].map(s => `<option value="${s}">Semester ${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table" id="studentsTable">
        <thead>
          <tr>
            <th>#</th>
            <th>Roll No.</th>
            <th>Name</th>
            <th>Department</th>
            <th>Semester</th>
            <th>Email</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="studentsBody"></tbody>
      </table>
    </div>
  </div>`;

  renderStudentsTable(MOCK.students);

  document.getElementById('addStudentBtn').addEventListener('click', () => {
    editingStudentId = null;
    document.getElementById('studentModalTitle').textContent = 'Add Student';
    document.getElementById('studentForm').reset();
    document.getElementById('passwordField').style.display = '';
    openModal('studentModal');
  });

  document.getElementById('studentSearch').addEventListener('input', function() {
    const q = this.value.toLowerCase();
    renderStudentsTable(MOCK.students.filter(s =>
      `${s.first} ${s.last}`.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q)));
  });

  document.getElementById('saveStudentBtn').addEventListener('click', saveStudent);
}

function renderStudentsTable(students) {
  const tbody = document.getElementById('studentsBody');
  if (!tbody) return;
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><p>No students found.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = students.map((s, i) => `
    <tr>
      <td style="color:var(--gray-400);font-size:.8rem;">${i+1}</td>
      <td><code style="font-size:.8rem;background:var(--gray-100);padding:2px 8px;border-radius:4px;">${s.roll}</code></td>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="avatar">${s.first.charAt(0)}${s.last.charAt(0)}</div>
          <div>
            <div style="font-weight:600;">${s.first} ${s.last}</div>
            <div style="font-size:.75rem;color:var(--gray-400);">${s.gender}</div>
          </div>
        </div>
      </td>
      <td>${s.dept}</td>
      <td><span class="badge badge-navy">Sem ${s.semester}</span></td>
      <td style="color:var(--gray-600);font-size:.85rem;">${s.email}</td>
      <td><span class="badge badge-success">${s.status}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="editStudent(${s.id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteStudent(${s.id})">Delete</button>
        </div>
      </td>
    </tr>`).join('');
}

function editStudent(id) {
  const s = MOCK.students.find(x => x.id === id);
  if (!s) return;
  editingStudentId = id;
  document.getElementById('studentModalTitle').textContent = 'Edit Student';
  document.getElementById('sFirstName').value = s.first;
  document.getElementById('sLastName').value  = s.last;
  document.getElementById('sRollNo').value    = s.roll;
  document.getElementById('sEmail').value     = s.email;
  document.getElementById('sSemester').value  = s.semester;
  document.getElementById('sGender').value    = s.gender;
  document.getElementById('passwordField').style.display = 'none';
  openModal('studentModal');
}

function deleteStudent(id) {
  if (!confirm('Delete this student? This action cannot be undone.')) return;
  const idx = MOCK.students.findIndex(s => s.id === id);
  if (idx > -1) { MOCK.students.splice(idx, 1); renderStudentsTable(MOCK.students); }
  showToast('Student deleted successfully.', 'success');
}

function saveStudent() {
  const first = document.getElementById('sFirstName').value.trim();
  const last  = document.getElementById('sLastName').value.trim();
  if (!first || !last) { showToast('Name is required.', 'error'); return; }
  if (editingStudentId) {
    const s = MOCK.students.find(x => x.id === editingStudentId);
    if (s) { s.first = first; s.last = last; s.semester = +document.getElementById('sSemester').value; }
    showToast('Student updated successfully.', 'success');
  } else {
    MOCK.students.push({ id: Date.now(), roll: document.getElementById('sRollNo').value, first, last, dept: 'Computer Science', semester: +document.getElementById('sSemester').value, email: document.getElementById('sEmail').value, gender: document.getElementById('sGender').value || 'male', status: 'active' });
    showToast('Student added successfully.', 'success');
  }
  closeModal('studentModal');
  renderStudentsTable(MOCK.students);
}

// ── FACULTY PAGE ─────────────────────────────────────────────
function renderFacultyPage(el) {
  el.innerHTML = `
  <div class="page-header">
    <div><h2>Faculty</h2><p class="page-desc">Manage faculty members and assignments.</p></div>
    <button class="btn btn-primary btn-sm" id="addFacultyBtn">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Faculty
    </button>
  </div>
  <div class="card">
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>#</th><th>Emp ID</th><th>Name</th><th>Designation</th><th>Department</th><th>Email</th><th>Courses</th><th>Actions</th></tr></thead>
        <tbody>
          ${MOCK.faculty.map((f, i) => `
          <tr>
            <td style="color:var(--gray-400);font-size:.8rem;">${i+1}</td>
            <td><code style="font-size:.8rem;background:var(--gray-100);padding:2px 8px;border-radius:4px;">${f.empId}</code></td>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                <div class="avatar" style="background:var(--navy-light);">${f.first.charAt(0)}${f.last.charAt(0)}</div>
                <div style="font-weight:600;">${f.first} ${f.last}</div>
              </div>
            </td>
            <td style="color:var(--gray-600);">${f.designation}</td>
            <td>${f.dept}</td>
            <td style="color:var(--gray-600);font-size:.85rem;">${f.email}</td>
            <td><span class="badge badge-info">${f.courses} courses</span></td>
            <td>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-outline btn-sm" onclick="editFaculty(${f.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteFaculty(${f.id})">Delete</button>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  document.getElementById('addFacultyBtn').addEventListener('click', () => {
    editingFacultyId = null;
    document.getElementById('facultyModalTitle').textContent = 'Add Faculty';
    document.getElementById('facultyForm').reset();
    document.getElementById('fPasswordField').style.display = '';
    openModal('facultyModal');
  });

  document.getElementById('saveFacultyBtn').onclick = saveFaculty;
}

function editFaculty(id) {
  const f = MOCK.faculty.find(x => x.id === id);
  if (!f) return;
  editingFacultyId = id;
  document.getElementById('facultyModalTitle').textContent = 'Edit Faculty';
  document.getElementById('fFirstName').value    = f.first;
  document.getElementById('fLastName').value     = f.last;
  document.getElementById('fEmpId').value        = f.empId;
  document.getElementById('fEmail').value        = f.email;
  document.getElementById('fDesignation').value  = f.designation;
  document.getElementById('fPasswordField').style.display = 'none';
  openModal('facultyModal');
}

function deleteFaculty(id) {
  if (!confirm('Delete this faculty member?')) return;
  const idx = MOCK.faculty.findIndex(f => f.id === id);
  if (idx > -1) MOCK.faculty.splice(idx, 1);
  showToast('Faculty deleted successfully.', 'success');
  renderFacultyPage(document.getElementById('pageContent'));
}

function saveFaculty() {
  const first = document.getElementById('fFirstName').value.trim();
  const last  = document.getElementById('fLastName').value.trim();
  if (!first || !last) { showToast('Name is required.', 'error'); return; }
  if (editingFacultyId) {
    const f = MOCK.faculty.find(x => x.id === editingFacultyId);
    if (f) { f.first = first; f.last = last; f.designation = document.getElementById('fDesignation').value; }
    showToast('Faculty updated successfully.', 'success');
  } else {
    MOCK.faculty.push({ id: Date.now(), empId: document.getElementById('fEmpId').value, first, last, designation: document.getElementById('fDesignation').value, dept: 'Computer Science', email: document.getElementById('fEmail').value, courses: 0 });
    showToast('Faculty added successfully.', 'success');
  }
  closeModal('facultyModal');
  renderFacultyPage(document.getElementById('pageContent'));
}

// ── COURSES PAGE ─────────────────────────────────────────────
function renderCoursesPage(el) {
  el.innerHTML = `
  <div class="page-header">
    <div><h2>Courses</h2><p class="page-desc">Manage all courses and faculty assignments.</p></div>
    <button class="btn btn-primary btn-sm" id="addCourseBtn">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Course
    </button>
  </div>
  <div class="course-grid" id="courseGrid">
    ${MOCK.courses.map(c => `
    <div class="course-card">
      <div class="course-code">${c.code}</div>
      <div class="course-title">${c.title}</div>
      <div style="font-size:.8rem;color:var(--gray-600);">${c.dept}</div>
      <div class="course-meta">
        <span>
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${c.faculty}
        </span>
        <span>
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          ${c.enrolled}/${c.max} students
        </span>
        <span><strong>${c.credits}</strong> credits</span>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" onclick="editCourse(${c.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCourse(${c.id})">Delete</button>
      </div>
    </div>`).join('')}
  </div>`;

  document.getElementById('addCourseBtn').addEventListener('click', () => {
    editingCourseId = null;
    document.getElementById('courseModalTitle').textContent = 'Add Course';
    document.getElementById('courseForm').reset();
    openModal('courseModal');
  });
  document.getElementById('saveCourseBtn').onclick = saveCourse;
}

function editCourse(id) {
  const c = MOCK.courses.find(x => x.id === id);
  if (!c) return;
  editingCourseId = id;
  document.getElementById('courseModalTitle').textContent = 'Edit Course';
  document.getElementById('cCode').value  = c.code;
  document.getElementById('cTitle').value = c.title;
  document.getElementById('cCredits').value = c.credits;
  openModal('courseModal');
}

function deleteCourse(id) {
  if (!confirm('Delete this course?')) return;
  const idx = MOCK.courses.findIndex(c => c.id === id);
  if (idx > -1) MOCK.courses.splice(idx, 1);
  showToast('Course deleted.', 'success');
  renderCoursesPage(document.getElementById('pageContent'));
}

function saveCourse() {
  const code  = document.getElementById('cCode').value.trim();
  const title = document.getElementById('cTitle').value.trim();
  if (!code || !title) { showToast('Code and title are required.', 'error'); return; }
  if (editingCourseId) {
    const c = MOCK.courses.find(x => x.id === editingCourseId);
    if (c) { c.code = code; c.title = title; c.credits = +document.getElementById('cCredits').value; }
    showToast('Course updated.', 'success');
  } else {
    MOCK.courses.push({ id: Date.now(), code, title, credits: +document.getElementById('cCredits').value, dept: 'Computer Science', faculty: 'Unassigned', enrolled: 0, max: +document.getElementById('cMaxStudents').value });
    showToast('Course added.', 'success');
  }
  closeModal('courseModal');
  renderCoursesPage(document.getElementById('pageContent'));
}

// ── ENROLLMENTS PAGE ─────────────────────────────────────────
function renderEnrollmentsPage(el) {
  el.innerHTML = `
  <div class="page-header"><div><h2>Enrollments</h2><p class="page-desc">View and manage course enrollments.</p></div></div>
  <div class="card">
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>#</th><th>Student</th><th>Roll No.</th><th>Course</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          ${MOCK.enrollments.map((e, i) => `
          <tr>
            <td style="color:var(--gray-400);font-size:.8rem;">${i+1}</td>
            <td style="font-weight:600;">${e.student}</td>
            <td><code style="font-size:.8rem;background:var(--gray-100);padding:2px 8px;border-radius:4px;">${e.roll}</code></td>
            <td>${e.course}</td>
            <td><span class="badge badge-success">${e.status}</span></td>
            <td><button class="btn btn-danger btn-sm" onclick="showToast('Enrollment dropped.','success')">Drop</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── ATTENDANCE REPORT ────────────────────────────────────────
function renderAttendanceReport(el) {
  el.innerHTML = `
  <div class="page-header"><div><h2>Attendance Report</h2><p class="page-desc">Course-wise attendance overview.</p></div></div>
  <div class="card">
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Student</th><th>Course</th><th>Total Classes</th><th>Present</th><th>Absent</th><th>Percentage</th></tr></thead>
        <tbody>
          ${MOCK.attendance.map(a => {
            const absent = a.total - a.present;
            const cls = pctColor(a.pct);
            return `<tr>
              <td style="font-weight:600;">Aarav Patel</td>
              <td>${a.course}</td>
              <td>${a.total}</td>
              <td style="color:var(--success);font-weight:600;">${a.present}</td>
              <td style="color:var(--danger);font-weight:600;">${absent}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="width:80px;"><div class="progress-bar"><div class="progress-fill ${cls}" style="width:${a.pct}%"></div></div></div>
                  <span class="badge ${cls === 'good' ? 'badge-success' : cls === 'low' ? 'badge-danger' : 'badge-warning'}">${a.pct}%</span>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── GRADES REPORT ────────────────────────────────────────────
function renderGradesReport(el) {
  el.innerHTML = `
  <div class="page-header"><div><h2>Grades Report</h2><p class="page-desc">Student grade overview across all courses.</p></div></div>
  <div class="card">
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Student</th><th>Course</th><th>Internal</th><th>External</th><th>Total</th><th>Grade</th><th>Points</th></tr></thead>
        <tbody>
          ${MOCK.grades.map(g => `
          <tr>
            <td style="font-weight:600;">Aarav Patel</td>
            <td>${g.code} – ${g.title}</td>
            <td>${g.internal}</td>
            <td>${g.external}</td>
            <td style="font-weight:700;">${g.total}</td>
            <td><span class="${gradeClass(g.letter)}">${g.letter}</span></td>
            <td style="font-weight:700;">${g.points}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── REGISTRATION APPROVALS ───────────────────────────────────
// ── Registration helpers — localStorage only ─────────────────
function getRegistrations() {
  try {
    return JSON.parse(localStorage.getItem('cms_registrations') || '[]');
  } catch(e) { return []; }
}
function saveRegistrations(list) {
  localStorage.setItem('cms_registrations', JSON.stringify(list));
}
function updatePendingBadge() {
  const count = getRegistrations().filter(r => r.status === 'pending').length;
  const badge = document.getElementById('pendingBadge');
  if (badge) badge.textContent = count > 0 ? count : '';
}

function renderRegistrations(el) {
  const regs = getRegistrations();
  const pending = regs.filter(r => r.status === 'pending');

  el.innerHTML = `
  <div class="page-header">
    <div>
      <h2>Registration Approvals</h2>
      <p class="page-desc">Review and approve pending user registrations.</p>
    </div>
  </div>
  <div class="card">
    <div class="table-wrap">
      <table class="data-table" id="regTable">
        <thead>
          <tr>
            <th>#</th><th>Name</th><th>Email</th><th>Username</th>
            <th>Role</th><th>Department</th><th>Date</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${regs.length === 0
            ? '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--gray-400);">No registration requests yet.</td></tr>'
            : regs.map((r, i) => `
          <tr id="reg-${r.id}" style="${r.status !== 'pending' ? 'opacity:.55' : ''}">
            <td style="color:var(--gray-400);font-size:.8rem;">${i+1}</td>
            <td style="font-weight:600;">${r.name}</td>
            <td style="font-size:.85rem;color:var(--gray-600);">${r.email}</td>
            <td style="font-size:.82rem;">${r.username || '—'}</td>
            <td><span class="badge badge-navy">${r.role}</span></td>
            <td style="font-size:.82rem;">${r.department || '—'}</td>
            <td style="font-size:.8rem;color:var(--gray-400);">${r.date || ''}</td>
            <td>
              <span class="badge ${r.status === 'pending' ? 'badge-warning' : r.status === 'approved' ? 'badge-success' : 'badge-danger'}">
                ${r.status}
              </span>
            </td>
            <td>
              ${r.status === 'pending' ? `
              <div style="display:flex;gap:6px;">
                <button class="btn btn-sm" style="background:var(--success);color:white;" onclick="approveReg('${r.id}')">✓ Approve</button>
                <button class="btn btn-danger btn-sm" onclick="rejectReg('${r.id}')">✕ Reject</button>
              </div>` : `<span style="color:var(--gray-400);font-size:.8rem;">${r.status}</span>`}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  const badge = document.getElementById('pendingBadge');
  if (badge) badge.textContent = pending.length || '';
}

function approveReg(id) {
  const list = getRegistrations();
  const reg  = list.find(r => String(r.id) === String(id));
  if (reg) reg.status = 'approved';
  saveRegistrations(list);
  updatePendingBadge();
  showToast(`✅ ${reg?.name || 'User'} approved!`, 'success');
  renderRegistrations(document.getElementById('pageContent'));
}

function rejectReg(id) {
  const list = getRegistrations();
  const reg  = list.find(r => String(r.id) === String(id));
  if (reg) reg.status = 'rejected';
  saveRegistrations(list);
  updatePendingBadge();
  showToast(`Registration rejected.`, 'error');
  renderRegistrations(document.getElementById('pageContent'));
}

// ── ANNOUNCEMENTS ────────────────────────────────────────────
function renderAnnouncementsPage(el) {
  el.innerHTML = `
  <div class="page-header">
    <div><h2>Announcements</h2><p class="page-desc">Post notices and updates for students and faculty.</p></div>
    <button class="btn btn-primary btn-sm" onclick="openModal('announcementModal')">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      New Announcement
    </button>
  </div>
  <div class="card">
    <div class="card-body">
      ${MOCK.announcements.map(a => `
      <div class="announcement-item">
        <div class="ann-icon">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
        <div class="ann-content" style="flex:1;">
          <div class="ann-title">${a.title} ${a.pinned ? '<span class="ann-pinned-badge">Pinned</span>' : ''}</div>
          <div class="ann-body">${a.body}</div>
          <div class="ann-meta"><span>${a.author}</span><span>${formatDate(a.date)}</span><span class="badge badge-info">${a.audience}</span></div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="showToast('Announcement deleted.','success')">Delete</button>
      </div>`).join('')}
    </div>
  </div>`;
  
  // Reuse faculty announcement modal if present
  document.getElementById('saveAnnouncementBtn')?.addEventListener('click', () => {
    const title = document.getElementById('annTitle').value.trim();
    const body  = document.getElementById('annBody').value.trim();
    if (!title || !body) { showToast('Title and body are required.', 'error'); return; }
    MOCK.announcements.unshift({ id: Date.now(), title, body, author: 'Admin', date: new Date().toISOString().slice(0,10), pinned: document.getElementById('annPinned')?.checked || false, audience: document.getElementById('annAudience')?.value || 'all' });
    closeModal('announcementModal');
    showToast('Announcement posted!', 'success');
    renderAnnouncementsPage(document.getElementById('pageContent'));
  });
}

// ── SCHEDULES ────────────────────────────────────────────────
function renderSchedulesPage(el) {
  el.innerHTML = `
  <div class="page-header"><div><h2>Schedules</h2><p class="page-desc">Weekly class timetable.</p></div></div>
  <div class="card">
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Day</th><th>Time</th><th>Course</th><th>Room</th><th>Faculty</th></tr></thead>
        <tbody>
          ${MOCK.timetable.map(t => `<tr>
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
