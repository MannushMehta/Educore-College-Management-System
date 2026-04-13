-- ============================================================
--  COLLEGE MANAGEMENT SYSTEM — MySQL Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS college_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE college_cms;

-- ─────────────────────────────────────────────
--  USERS  (auth layer shared by all roles)
-- ─────────────────────────────────────────────
CREATE TABLE users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(60)  NOT NULL UNIQUE,
    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin','faculty','student') NOT NULL,
    is_active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
--  DEPARTMENTS
-- ─────────────────────────────────────────────
CREATE TABLE departments (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(120) NOT NULL UNIQUE,
    code       VARCHAR(10)  NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
--  STUDENTS
-- ─────────────────────────────────────────────
CREATE TABLE students (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id       INT UNSIGNED NOT NULL UNIQUE,
    roll_number   VARCHAR(20)  NOT NULL UNIQUE,
    first_name    VARCHAR(60)  NOT NULL,
    last_name     VARCHAR(60)  NOT NULL,
    dob           DATE,
    gender        ENUM('male','female','other'),
    phone         VARCHAR(15),
    address       TEXT,
    department_id INT UNSIGNED,
    semester      TINYINT UNSIGNED DEFAULT 1,
    batch_year    YEAR,
    photo_url     VARCHAR(255),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)       REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
--  FACULTY
-- ─────────────────────────────────────────────
CREATE TABLE faculty (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id       INT UNSIGNED NOT NULL UNIQUE,
    employee_id   VARCHAR(20)  NOT NULL UNIQUE,
    first_name    VARCHAR(60)  NOT NULL,
    last_name     VARCHAR(60)  NOT NULL,
    designation   VARCHAR(80),
    department_id INT UNSIGNED,
    phone         VARCHAR(15),
    joining_date  DATE,
    photo_url     VARCHAR(255),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)       REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
--  SEMESTERS
-- ─────────────────────────────────────────────
CREATE TABLE semesters (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(40) NOT NULL,
    start_date DATE        NOT NULL,
    end_date   DATE        NOT NULL,
    is_current TINYINT(1)  NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
--  COURSES
-- ─────────────────────────────────────────────
CREATE TABLE courses (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code          VARCHAR(15)  NOT NULL UNIQUE,
    title         VARCHAR(120) NOT NULL,
    description   TEXT,
    credits       TINYINT UNSIGNED DEFAULT 3,
    department_id INT UNSIGNED,
    semester_id   INT UNSIGNED,
    max_students  SMALLINT UNSIGNED DEFAULT 60,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (semester_id)   REFERENCES semesters(id)   ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
--  COURSE–FACULTY  (many-to-many)
-- ─────────────────────────────────────────────
CREATE TABLE course_faculty (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    course_id  INT UNSIGNED NOT NULL,
    faculty_id INT UNSIGNED NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_course_faculty (course_id, faculty_id),
    FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES faculty(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
--  ENROLLMENTS
-- ─────────────────────────────────────────────
CREATE TABLE enrollments (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_id   INT UNSIGNED NOT NULL,
    course_id    INT UNSIGNED NOT NULL,
    enrolled_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status       ENUM('active','dropped','completed') DEFAULT 'active',
    UNIQUE KEY uq_enrollment (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
--  SCHEDULES / CLASSROOMS
-- ─────────────────────────────────────────────
CREATE TABLE classrooms (
    id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name     VARCHAR(40) NOT NULL,
    capacity SMALLINT UNSIGNED DEFAULT 60,
    building VARCHAR(60)
) ENGINE=InnoDB;

CREATE TABLE schedules (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    course_id    INT UNSIGNED NOT NULL,
    classroom_id INT UNSIGNED,
    day_of_week  TINYINT UNSIGNED NOT NULL COMMENT '1=Mon … 7=Sun',
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    FOREIGN KEY (course_id)    REFERENCES courses(id)    ON DELETE CASCADE,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
--  ATTENDANCE
-- ─────────────────────────────────────────────
CREATE TABLE attendance (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT UNSIGNED NOT NULL,
    marked_by    INT UNSIGNED NOT NULL COMMENT 'faculty.id',
    class_date   DATE        NOT NULL,
    status       ENUM('present','absent','late') DEFAULT 'present',
    remarks      VARCHAR(120),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_attendance (enrollment_id, class_date),
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
    FOREIGN KEY (marked_by)     REFERENCES faculty(id)     ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
--  GRADES
-- ─────────────────────────────────────────────
CREATE TABLE grades (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT UNSIGNED NOT NULL UNIQUE,
    internal_marks  DECIMAL(5,2),
    external_marks  DECIMAL(5,2),
    total_marks     DECIMAL(5,2) GENERATED ALWAYS AS (internal_marks + external_marks) STORED,
    grade_letter    VARCHAR(3),
    grade_points    DECIMAL(3,1),
    remarks         VARCHAR(120),
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
--  STUDY MATERIALS
-- ─────────────────────────────────────────────
CREATE TABLE materials (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    course_id   INT UNSIGNED NOT NULL,
    uploaded_by INT UNSIGNED NOT NULL COMMENT 'faculty.id',
    title       VARCHAR(120) NOT NULL,
    description TEXT,
    file_url    VARCHAR(255) NOT NULL,
    file_type   VARCHAR(20),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id)   REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES faculty(id)  ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
--  ANNOUNCEMENTS
-- ─────────────────────────────────────────────
CREATE TABLE announcements (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    posted_by   INT UNSIGNED NOT NULL COMMENT 'users.id',
    title       VARCHAR(160) NOT NULL,
    body        TEXT         NOT NULL,
    audience    ENUM('all','students','faculty') DEFAULT 'all',
    course_id   INT UNSIGNED COMMENT 'NULL = global',
    is_pinned   TINYINT(1) DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (posted_by) REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id)  ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
--  REGISTRATION APPROVALS
-- ─────────────────────────────────────────────
CREATE TABLE registration_requests (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      INT UNSIGNED NOT NULL,
    status       ENUM('pending','approved','rejected') DEFAULT 'pending',
    reviewed_by  INT UNSIGNED COMMENT 'admin users.id',
    reviewed_at  TIMESTAMP NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
--  SEED DATA
-- ============================================================

-- Departments
INSERT INTO departments (name, code) VALUES
  ('Computer Science',       'CS'),
  ('Electronics Engineering','EE'),
  ('Mechanical Engineering', 'ME'),
  ('Business Administration','BA');

-- Semesters
INSERT INTO semesters (name, start_date, end_date, is_current) VALUES
  ('Spring 2025', '2025-01-15', '2025-05-30', 0),
  ('Fall 2025',   '2025-08-01', '2025-12-20', 1);

-- Admin user  (password: Admin@123)
INSERT INTO users (username, email, password_hash, role) VALUES
  ('admin', 'admin@college.edu',
   '$2y$12$Kx5TZ2mQwKjH0L9vN8pQueJdO3Fk1Gy7iRbBnLVkPcMsWaXtUy4ei',
   'admin');

-- Faculty users  (password: Faculty@123)
INSERT INTO users (username, email, password_hash, role) VALUES
  ('dr_sharma',  'sharma@college.edu',
   '$2y$12$Kx5TZ2mQwKjH0L9vN8pQueJdO3Fk1Gy7iRbBnLVkPcMsWaXtUy4ei', 'faculty'),
  ('prof_mehta', 'mehta@college.edu',
   '$2y$12$Kx5TZ2mQwKjH0L9vN8pQueJdO3Fk1Gy7iRbBnLVkPcMsWaXtUy4ei', 'faculty');

-- Faculty profiles
INSERT INTO faculty (user_id, employee_id, first_name, last_name, designation, department_id, joining_date) VALUES
  (2, 'FAC001', 'Rajesh',  'Sharma', 'Associate Professor', 1, '2018-07-01'),
  (3, 'FAC002', 'Priya',   'Mehta',  'Assistant Professor', 2, '2020-01-10');

-- Student users  (password: Student@123)
INSERT INTO users (username, email, password_hash, role) VALUES
  ('stu_patel',  'patel@student.edu',
   '$2y$12$Kx5TZ2mQwKjH0L9vN8pQueJdO3Fk1Gy7iRbBnLVkPcMsWaXtUy4ei', 'student'),
  ('stu_khan',   'khan@student.edu',
   '$2y$12$Kx5TZ2mQwKjH0L9vN8pQueJdO3Fk1Gy7iRbBnLVkPcMsWaXtUy4ei', 'student');

-- Student profiles
INSERT INTO students (user_id, roll_number, first_name, last_name, dob, gender, department_id, semester, batch_year) VALUES
  (4, 'CS2021001', 'Aarav',  'Patel', '2003-04-12', 'male',   1, 7, 2021),
  (5, 'CS2021002', 'Zara',   'Khan',  '2003-09-25', 'female', 1, 7, 2021);

-- Courses
INSERT INTO courses (code, title, description, credits, department_id, semester_id, max_students) VALUES
  ('CS401', 'Database Systems',        'Relational databases and SQL',          4, 1, 2, 60),
  ('CS402', 'Web Technologies',        'HTML, CSS, JS and modern frameworks',   3, 1, 2, 60),
  ('EE301', 'Digital Signal Processing','Signals, systems and DSP algorithms',  4, 2, 2, 40);

-- Course–Faculty assignments
INSERT INTO course_faculty (course_id, faculty_id) VALUES (1, 1),(2, 1),(3, 2);

-- Classrooms
INSERT INTO classrooms (name, capacity, building) VALUES
  ('Room 101', 60, 'Block A'),
  ('Room 202', 40, 'Block B'),
  ('Lab 1',    30, 'Block C');

-- Schedules
INSERT INTO schedules (course_id, classroom_id, day_of_week, start_time, end_time) VALUES
  (1, 1, 1, '09:00', '10:30'),
  (1, 1, 3, '09:00', '10:30'),
  (2, 2, 2, '11:00', '12:00'),
  (3, 3, 4, '14:00', '15:30');

-- Enrollments
INSERT INTO enrollments (student_id, course_id, status) VALUES
  (1, 1, 'active'),(1, 2, 'active'),
  (2, 1, 'active'),(2, 3, 'active');

-- Sample attendance
INSERT INTO attendance (enrollment_id, marked_by, class_date, status) VALUES
  (1, 1, '2025-08-05', 'present'),
  (1, 1, '2025-08-07', 'absent'),
  (2, 1, '2025-08-06', 'present');

-- Sample grades
INSERT INTO grades (enrollment_id, internal_marks, external_marks, grade_letter, grade_points) VALUES
  (1, 38.00, 72.00, 'A',  9.0),
  (2, 42.00, 78.00, 'A+', 10.0);

-- Announcements
INSERT INTO announcements (posted_by, title, body, audience, is_pinned) VALUES
  (1, 'Welcome to Fall 2025!',
     'Classes begin August 1st. Please check your schedules on the portal.',
     'all', 1),
  (2, 'Database Systems — Lab Schedule',
     'Lab sessions every Friday 2–4 PM in Lab 1. Attendance mandatory.',
     'students', 0);
