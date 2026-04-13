
EduCore — College Management System
> A full-stack, multi-role College Management System built with **HTML5 / CSS3 / Vanilla JS** (frontend), **PHP 8+** (REST API), **Python 3.11+** (analytics micro-services), and **MySQL 8** (database).
---
📁 Project Structure
```
college-management-system/
│
├── frontend/
│   ├── css/
│   │   └── styles.css                  # Global design system
│   ├── js/
│   │   ├── utils.js                    # Shared helpers + MOCK data
│   │   ├── auth.js                     # Login logic
│   │   ├── admin.js                    # Admin SPA router & pages
│   │   ├── faculty.js                  # Faculty SPA router & pages
│   │   └── student.js                  # Student SPA router & pages
│   └── pages/
│       ├── login.html                  # Login page (role tabs)
│       ├── register.html               # Self-registration page
│       ├── admin-dashboard.html        # Admin dashboard shell
│       ├── faculty-dashboard.html      # Faculty dashboard shell
│       └── student-dashboard.html      # Student dashboard shell
│
├── backend/
│   ├── php/
│   │   ├── config.php                  # DB connection, JWT, helpers
│   │   ├── auth.php                    # Login / Register / Change-password
│   │   ├── manage_students.php         # Student CRUD + enrollments
│   │   ├── manage_faculty.php          # Faculty CRUD + approvals
│   │   ├── manage_courses.php          # Course CRUD + faculty assignment
│   │   ├── attendance.php              # Mark & report attendance
│   │   ├── grades.php                  # Enter & report grades
│   │   └── announcements.php           # Posts + study materials
│   │
│   └── python/
│       ├── requirements.txt
│       ├── attendance_service.py       # FastAPI — analytics (port 8001)
│       └── grade_processing.py         # FastAPI — transcripts (port 8002)
│
├── database/
│   └── schema.sql                      # Full MySQL schema + seed data
│
└── uploads/
    └── materials/                      # Faculty-uploaded study files
```
---
🚀 Quick Start
Prerequisites
Tool	Minimum version
PHP	8.1
MySQL	8.0
Python	3.11
Web server	Apache / Nginx / PHP built-in server
---
1 — Database Setup
```bash
# Log in to MySQL
mysql -u root -p

# Create the database and import the schema
CREATE DATABASE college_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

mysql -u root -p college_cms < database/schema.sql
```
The schema creates all tables and inserts demo seed data:
Role	Username	Password
Admin	`admin`	`Admin@123`
Faculty	`dr_sharma`	`Faculty@123`
Student	`stu_patel`	`Student@123`
---
2 — PHP Backend
a) Edit credentials
Open `backend/php/config.php` and set:
```php
define('DB_HOST', 'localhost');
define('DB_USER', 'your_mysql_user');
define('DB_PASS', 'your_mysql_password');
define('DB_NAME', 'college_cms');
define('JWT_SECRET', 'change_this_to_a_long_random_string');
```
b) Start PHP server (development)
```bash
cd college-management-system
php -S localhost:8000
```
The PHP API is now at `http://localhost:8000/backend/php/`
c) Apache / Nginx (production)
Point your document root to the project root.  
Enable `mod_rewrite` (Apache) and ensure PHP can write to `uploads/`.
```bash
chmod -R 755 uploads/
```
---
3 — Python Micro-services
```bash
cd backend/python

# Create a virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start attendance analytics (port 8001)
uvicorn attendance_service:app --port 8001 --reload &

# Start grade processing (port 8002)
uvicorn grade_processing:app --port 8002 --reload &
```
Interactive API docs are available at:
`http://localhost:8001/docs`  (attendance)
`http://localhost:8002/docs`  (grades)
---
4 — Open the App
Simply open the file in your browser:
```
http://localhost:8000/frontend/pages/login.html
```
Or double-click `frontend/pages/login.html` if running without a server  
(the frontend uses MOCK data by default and works offline).
---
🔑 Authentication Flow
```
Browser → POST /backend/php/auth.php?action=login
        ← { token, user, profile }

All subsequent requests:
  Authorization: Bearer <token>
```
Tokens are HMAC-SHA256 signed, 7-day expiry.  
For production use, switch to a proper JWT library (e.g., `firebase/php-jwt`).
---
📡 PHP API Reference
All endpoints return JSON: `{ success: bool, message: string, data: ... }`
auth.php
Method	Action	Description	Auth
POST	`login`	Log in, returns token	—
POST	`register`	Self-register (pending approval)	—
POST	`change_password`	Change own password	Any
GET	`me`	Return current user info	Any
manage_students.php
Method	Action	Auth
GET	`list`	Admin, Faculty
GET	`get&id=N`	Admin, Faculty
POST	`create`	Admin
PUT	`update&id=N`	Admin
DELETE	`delete&id=N`	Admin
GET	`enrollments&student_id=N`	Admin, Faculty, Student
POST	`enroll`	Admin
DELETE	`drop`	Admin
GET	`my_profile`	Student
manage_faculty.php
Method	Action	Auth
GET	`list`	Admin
POST	`create`	Admin
PUT	`update&id=N`	Admin
DELETE	`delete&id=N`	Admin
GET	`registrations`	Admin
POST	`approve&req_id=N`	Admin
POST	`reject&req_id=N`	Admin
GET	`my_profile`	Faculty
manage_courses.php
Method	Action	Auth
GET	`list`	Any
POST	`create`	Admin
PUT	`update&id=N`	Admin
DELETE	`delete&id=N`	Admin
GET	`my_courses`	Faculty
POST	`assign_faculty`	Admin
DELETE	`unassign_faculty`	Admin
GET	`departments`	Any
GET	`semesters`	Any
attendance.php
Method	Action	Auth
POST	`mark` body: `{course_id, date, records:[]}`	Faculty
GET	`session&course_id=N&date=YYYY-MM-DD`	Faculty, Admin
GET	`course_report&course_id=N`	Faculty, Admin
GET	`my_attendance`	Student
GET	`summary`	Faculty, Admin
grades.php
Method	Action	Auth
POST	`upsert` body: `{course_id, semester_id, grades:[]}`	Faculty
GET	`course_grades&course_id=N`	Faculty, Admin
GET	`my_grades`	Student
GET	`report`	Admin
announcements.php
Method	Action	Auth
POST	`post`	Admin, Faculty
GET	`list`	Any
DELETE	`delete&id=N`	Admin, Faculty
POST	`upload_material` (multipart)	Faculty
GET	`materials`	Any
DELETE	`delete_material&id=N`	Faculty, Admin
---
🐍 Python Services Reference
attendance_service.py (port 8001)
Method	Endpoint	Description
GET	`/health`	DB connectivity check
GET	`/attendance/low-attendance?threshold=75`	Students below threshold
GET	`/attendance/monthly-trend?course_id=1&year=2024`	Month-by-month %
GET	`/attendance/heatmap?course_id=1&weeks=12`	Day-level heatmap data
POST	`/attendance/bulk-import`	Import JSON array of records
GET	`/attendance/export/csv?course_id=1`	Download CSV
grade_processing.py (port 8002)
Method	Endpoint	Description
GET	`/health`	DB connectivity check
GET	`/grades/course-stats?course_id=1`	Mean, median, std-dev, pass rate
GET	`/grades/semester-report?semester_id=1`	Per-course stats for semester
GET	`/grades/student-transcript?student_id=1`	Full transcript + CGPA
GET	`/grades/topper-list?course_id=1&top_n=10`	Ranked top students
GET	`/grades/export/csv?course_id=1`	Download grade CSV
POST	`/grades/recalculate`	Recompute letter grades from totals
---
🔒 Security Checklist
Feature	Implementation
Password hashing	`password_hash()` with bcrypt cost 12
SQL injection prevention	Prepared statements everywhere
Auth	HMAC-SHA256 signed tokens (7-day)
Role-based access	`requireAuth('admin','faculty')` guard
CORS	Configurable `Access-Control-Allow-Origin`
File uploads	MIME-type allowlist + 20 MB size cap
Input validation	Both PHP-side and client-side
> **Production hardening:** Replace HMAC tokens with `firebase/php-jwt`, add HTTPS, set `Access-Control-Allow-Origin` to your domain only, and store the JWT secret in an environment variable.
---
🎨 UI Demo Mode
All dashboards work without a backend using MOCK data in `frontend/js/utils.js`.
To switch to real API calls, uncomment the `apiCall()` sections in:
`auth.js` → `handleLogin()`
`admin.js`, `faculty.js`, `student.js` → each page loader function
---
🗄️ Database Schema Overview
```
users           ← central auth table (all roles)
 ├── students   ← student profiles (FK → users, departments)
 ├── faculty    ← faculty profiles (FK → users, departments)
 └── registration_requests ← pending approvals

departments
courses         ← FK → departments
course_faculty  ← many-to-many: courses ↔ faculty ↔ semesters
semesters

enrollments     ← students ↔ courses ↔ semesters
attendance      ← per student, per course, per date
grades          ← internal + external + total + letter grade
materials       ← uploaded files (FK → courses, users)
announcements   ← FK → users; optional FK → courses
schedules       ← timetable slots (FK → courses, classrooms, faculty)
classrooms
```
---
📦 Extending the System
Email notifications — add PHPMailer/SwiftMailer in `manage_faculty.php:approveRegistration()`
Real-time announcements — replace polling with WebSockets or Server-Sent Events
Mobile app — the REST API is fully consumable by React Native / Flutter
Reports PDF — call the Python services and render with `weasyprint` or `reportlab`
OAuth — add Google/Microsoft login in `auth.php`
---
📄 License
MIT — free to use for academic and commercial projects.
