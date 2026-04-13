<?php
// ============================================================
//  manage_courses.php  –  Course & Faculty-Assignment CRUD
//
//  GET    ?action=list
//  GET    ?action=get&id=N
//  POST   ?action=create         [admin]
//  PUT    ?action=update&id=N    [admin]
//  DELETE ?action=delete&id=N    [admin]
//  GET    ?action=my_courses      [faculty]
//  POST   ?action=assign_faculty  [admin]   body: {faculty_id, course_id, semester_id}
//  DELETE ?action=unassign_faculty[admin]   body: same
//  GET    ?action=departments
//  GET    ?action=semesters
// ============================================================

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

match ($action) {
    'list'             => listCourses(),
    'get'              => getCourse(),
    'create'           => createCourse(),
    'update'           => updateCourse(),
    'delete'           => deleteCourse(),
    'my_courses'       => myCourses(),
    'assign_faculty'   => assignFaculty(),
    'unassign_faculty' => unassignFaculty(),
    'departments'      => listDepartments(),
    'semesters'        => listSemesters(),
    default            => sendError(404, "Unknown action: $action"),
};

// ── LIST COURSES ─────────────────────────────────────────────
function listCourses(): void {
    requireAuth();
    $db  = getDB();
    $semId = isset($_GET['semester_id']) ? (int)$_GET['semester_id'] : null;
    $deptId = isset($_GET['department_id']) ? (int)$_GET['department_id'] : null;

    $sql = 'SELECT c.id, c.code, c.title, c.credits, c.description,
                   d.name AS department_name, c.is_active,
                   GROUP_CONCAT(DISTINCT uf.full_name ORDER BY uf.full_name SEPARATOR ", ") AS faculty_names
            FROM courses c
            LEFT JOIN departments d ON c.department_id = d.id
            LEFT JOIN course_faculty cf ON cf.course_id = c.id
            LEFT JOIN faculty f ON cf.faculty_id = f.id
            LEFT JOIN users uf ON f.user_id = uf.id
            WHERE 1=1';

    $params = []; $types = '';

    if ($semId) {
        $sql .= ' AND (cf.semester_id = ? OR cf.semester_id IS NULL)';
        $params[] = $semId; $types .= 'i';
    }
    if ($deptId) {
        $sql .= ' AND c.department_id = ?';
        $params[] = $deptId; $types .= 'i';
    }
    $sql .= ' GROUP BY c.id ORDER BY c.title';

    $stmt = $db->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendSuccess($rows);
}

// ── GET SINGLE COURSE ─────────────────────────────────────────
function getCourse(): void {
    requireAuth();
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) sendError(400, 'Missing id');

    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT c.*, d.name AS department_name
         FROM courses c
         LEFT JOIN departments d ON c.department_id = d.id
         WHERE c.id = ? LIMIT 1'
    );
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $course = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$course) sendError(404, 'Course not found');

    // Attached faculty
    $stmt = $db->prepare(
        'SELECT cf.faculty_id, cf.semester_id, uf.full_name, sm.name AS semester_name
         FROM course_faculty cf
         JOIN faculty f ON cf.faculty_id = f.id
         JOIN users uf ON f.user_id = uf.id
         JOIN semesters sm ON cf.semester_id = sm.id
         WHERE cf.course_id = ?'
    );
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $course['faculty'] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendSuccess($course);
}

// ── CREATE ───────────────────────────────────────────────────
function createCourse(): void {
    requireAuth('admin');
    $body = getBody();
    requireFields($body, ['code', 'title', 'credits', 'department_id']);

    $db = getDB();
    $stmt = $db->prepare('SELECT id FROM courses WHERE code = ? LIMIT 1');
    $stmt->bind_param('s', $body['code']);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) sendError(409, 'Course code already exists');
    $stmt->close();

    $desc    = $body['description'] ?? '';
    $credits = (int)$body['credits'];
    $deptId  = (int)$body['department_id'];
    $stmt = $db->prepare(
        'INSERT INTO courses (code, title, description, credits, department_id) VALUES (?,?,?,?,?)'
    );
    $stmt->bind_param('sssii', $body['code'], $body['title'], $desc, $credits, $deptId);
    $stmt->execute();
    $newId = $db->insert_id;
    $stmt->close();

    sendSuccess(['course_id' => $newId], 'Course created');
}

// ── UPDATE ───────────────────────────────────────────────────
function updateCourse(): void {
    requireAuth('admin');
    $id   = (int)($_GET['id'] ?? 0);
    if (!$id) sendError(400, 'Missing id');
    $body = getBody();

    $db   = getDB();
    $stmt = $db->prepare(
        'UPDATE courses SET
            code        = COALESCE(?, code),
            title       = COALESCE(?, title),
            description = COALESCE(?, description),
            credits     = COALESCE(?, credits),
            department_id = COALESCE(?, department_id),
            is_active   = COALESCE(?, is_active)
         WHERE id = ?'
    );

    $code    = $body['code']          ?? null;
    $title   = $body['title']         ?? null;
    $desc    = $body['description']   ?? null;
    $credits = isset($body['credits']) ? (int)$body['credits'] : null;
    $deptId  = isset($body['department_id']) ? (int)$body['department_id'] : null;
    $active  = isset($body['is_active']) ? (int)(bool)$body['is_active'] : null;

    $stmt->bind_param('sssiiiii', $code, $title, $desc, $credits, $deptId, $active, $id);
    $stmt->execute();
    $stmt->close();

    sendSuccess(null, 'Course updated');
}

// ── DELETE (soft) ─────────────────────────────────────────────
function deleteCourse(): void {
    requireAuth('admin');
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) sendError(400, 'Missing id');

    $db   = getDB();
    $stmt = $db->prepare('UPDATE courses SET is_active=0 WHERE id=?');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();

    sendSuccess(null, 'Course deactivated');
}

// ── MY COURSES (faculty) ─────────────────────────────────────
function myCourses(): void {
    $me = requireAuth('faculty');
    $db = getDB();

    $stmt = $db->prepare(
        'SELECT c.id, c.code, c.title, c.credits,
                sm.name AS semester_name, sm.id AS semester_id,
                d.name AS department_name,
                (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.semester_id = sm.id) AS enrolled_count
         FROM course_faculty cf
         JOIN courses c ON cf.course_id = c.id
         JOIN semesters sm ON cf.semester_id = sm.id
         LEFT JOIN departments d ON c.department_id = d.id
         JOIN faculty f ON cf.faculty_id = f.id
         WHERE f.user_id = ?
         ORDER BY sm.start_date DESC, c.title'
    );
    $stmt->bind_param('i', $me['sub']);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendSuccess($rows);
}

// ── ASSIGN FACULTY ────────────────────────────────────────────
function assignFaculty(): void {
    requireAuth('admin');
    $body = getBody();
    requireFields($body, ['faculty_id', 'course_id', 'semester_id']);

    $db = getDB();
    $stmt = $db->prepare(
        'SELECT id FROM course_faculty WHERE faculty_id=? AND course_id=? AND semester_id=? LIMIT 1'
    );
    $stmt->bind_param('iii', $body['faculty_id'], $body['course_id'], $body['semester_id']);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) sendError(409, 'Faculty already assigned');
    $stmt->close();

    $stmt = $db->prepare(
        'INSERT INTO course_faculty (faculty_id, course_id, semester_id) VALUES (?,?,?)'
    );
    $stmt->bind_param('iii', $body['faculty_id'], $body['course_id'], $body['semester_id']);
    $stmt->execute();
    $stmt->close();

    sendSuccess(null, 'Faculty assigned to course');
}

// ── UNASSIGN FACULTY ──────────────────────────────────────────
function unassignFaculty(): void {
    requireAuth('admin');
    $body = getBody();
    requireFields($body, ['faculty_id', 'course_id', 'semester_id']);

    $db   = getDB();
    $stmt = $db->prepare(
        'DELETE FROM course_faculty WHERE faculty_id=? AND course_id=? AND semester_id=?'
    );
    $stmt->bind_param('iii', $body['faculty_id'], $body['course_id'], $body['semester_id']);
    $stmt->execute();
    $stmt->close();

    sendSuccess(null, 'Faculty unassigned');
}

// ── DEPARTMENTS ───────────────────────────────────────────────
function listDepartments(): void {
    requireAuth();
    $db   = getDB();
    $stmt = $db->prepare('SELECT id, code, name FROM departments ORDER BY name');
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendSuccess($rows);
}

// ── SEMESTERS ─────────────────────────────────────────────────
function listSemesters(): void {
    requireAuth();
    $db   = getDB();
    $stmt = $db->prepare('SELECT * FROM semesters ORDER BY start_date DESC');
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendSuccess($rows);
}
