<?php
// ============================================================
//  manage_students.php  –  Student CRUD API
//  All endpoints require a valid JWT token.
//
//  GET    ?action=list   [admin, faculty]
//  GET    ?action=get&id=N
//  POST   ?action=create [admin]
//  PUT    ?action=update&id=N [admin]
//  DELETE ?action=delete&id=N [admin]
//  GET    ?action=enrollments&student_id=N
//  POST   ?action=enroll  [admin]   body: {student_id, course_id, semester_id}
//  DELETE ?action=drop    [admin]   body: {student_id, course_id}
//  GET    ?action=my_profile  [student] – returns own profile
// ============================================================

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

match (true) {
    $action === 'list'       => listStudents(),
    $action === 'get'        => getStudent(),
    $action === 'create'     => createStudent(),
    $action === 'update'     => updateStudent(),
    $action === 'delete'     => deleteStudent(),
    $action === 'enrollments'=> getEnrollments(),
    $action === 'enroll'     => enrollStudent(),
    $action === 'drop'       => dropEnrollment(),
    $action === 'my_profile' => myProfile(),
    default                  => sendError(404, "Unknown action: $action"),
};

// ── LIST ─────────────────────────────────────────────────────
function listStudents(): void {
    requireAuth('admin', 'faculty');
    $db = getDB();

    $search = isset($_GET['search']) ? '%' . $db->real_escape_string($_GET['search']) . '%' : null;
    $deptId = isset($_GET['department_id']) ? (int)$_GET['department_id'] : null;

    $sql = 'SELECT s.id, s.roll_number, s.user_id,
                   u.full_name, u.email, u.username,
                   d.name AS department_name,
                   s.batch_year, s.current_semester, s.cgpa, s.is_active
            FROM students s
            JOIN users u    ON s.user_id = u.id
            LEFT JOIN departments d ON s.department_id = d.id
            WHERE 1=1';

    $params = []; $types = '';

    if ($search) {
        $sql .= ' AND (u.full_name LIKE ? OR s.roll_number LIKE ? OR u.email LIKE ?)';
        array_push($params, $search, $search, $search);
        $types .= 'sss';
    }
    if ($deptId) {
        $sql .= ' AND s.department_id = ?';
        $params[] = $deptId;
        $types .= 'i';
    }
    $sql .= ' ORDER BY u.full_name';

    $stmt = $db->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendSuccess($rows);
}

// ── GET SINGLE ───────────────────────────────────────────────
function getStudent(): void {
    requireAuth('admin', 'faculty');
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) sendError(400, 'Missing id');

    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT s.*, u.full_name, u.email, u.username, d.name AS department_name
         FROM students s
         JOIN users u ON s.user_id = u.id
         LEFT JOIN departments d ON s.department_id = d.id
         WHERE s.id = ? LIMIT 1'
    );
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) sendError(404, 'Student not found');
    sendSuccess($row);
}

// ── CREATE ───────────────────────────────────────────────────
function createStudent(): void {
    requireAuth('admin');
    $body = getBody();
    requireFields($body, ['username', 'password', 'full_name', 'email',
                          'roll_number', 'department_id', 'batch_year']);

    $db = getDB();

    // Check duplicate
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
    $stmt->bind_param('ss', $body['username'], $body['email']);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) sendError(409, 'Username or email already exists');
    $stmt->close();

    $stmt = $db->prepare('SELECT id FROM students WHERE roll_number = ? LIMIT 1');
    $stmt->bind_param('s', $body['roll_number']);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) sendError(409, 'Roll number already exists');
    $stmt->close();

    $db->begin_transaction();
    try {
        $hash = password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $db->prepare(
            'INSERT INTO users (username, password_hash, full_name, email, role, is_active)
             VALUES (?, ?, ?, ?, "student", 1)'
        );
        $stmt->bind_param('ssss', $body['username'], $hash, $body['full_name'], $body['email']);
        $stmt->execute();
        $userId = $db->insert_id;
        $stmt->close();

        $sem  = $body['current_semester'] ?? 1;
        $stmt = $db->prepare(
            'INSERT INTO students (user_id, roll_number, department_id, batch_year, current_semester)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->bind_param('isiii', $userId, $body['roll_number'],
                          $body['department_id'], $body['batch_year'], $sem);
        $stmt->execute();
        $studentId = $db->insert_id;
        $stmt->close();

        $db->commit();
        sendSuccess(['student_id' => $studentId], 'Student created');
    } catch (\Throwable $e) {
        $db->rollback();
        sendError(500, 'Failed to create student: ' . $e->getMessage());
    }
}

// ── UPDATE ───────────────────────────────────────────────────
function updateStudent(): void {
    requireAuth('admin');
    $id   = (int)($_GET['id'] ?? 0);
    if (!$id) sendError(400, 'Missing id');
    $body = getBody();

    $db = getDB();

    // Fetch user_id
    $stmt = $db->prepare('SELECT user_id FROM students WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) sendError(404, 'Student not found');
    $userId = $row['user_id'];

    $db->begin_transaction();
    try {
        if (!empty($body['full_name']) || !empty($body['email'])) {
            $name  = $body['full_name'] ?? null;
            $email = $body['email'] ?? null;
            if ($name && $email) {
                $stmt = $db->prepare('UPDATE users SET full_name=?, email=? WHERE id=?');
                $stmt->bind_param('ssi', $name, $email, $userId);
            } elseif ($name) {
                $stmt = $db->prepare('UPDATE users SET full_name=? WHERE id=?');
                $stmt->bind_param('si', $name, $userId);
            } else {
                $stmt = $db->prepare('UPDATE users SET email=? WHERE id=?');
                $stmt->bind_param('si', $email, $userId);
            }
            $stmt->execute();
            $stmt->close();
        }

        if (!empty($body['department_id']) || !empty($body['current_semester']) || isset($body['cgpa'])) {
            $deptId = $body['department_id']       ?? null;
            $sem    = $body['current_semester']     ?? null;
            $cgpa   = isset($body['cgpa']) ? (float)$body['cgpa'] : null;

            $stmt = $db->prepare(
                'UPDATE students SET
                    department_id     = COALESCE(?, department_id),
                    current_semester  = COALESCE(?, current_semester),
                    cgpa              = COALESCE(?, cgpa)
                 WHERE id = ?'
            );
            $stmt->bind_param('iidd', $deptId, $sem, $cgpa, $id);
            $stmt->execute();
            $stmt->close();
        }

        if (isset($body['is_active'])) {
            $active = (int)(bool)$body['is_active'];
            $stmt = $db->prepare('UPDATE users SET is_active=? WHERE id=?');
            $stmt->bind_param('ii', $active, $userId);
            $stmt->execute();
            $stmt->close();
        }

        $db->commit();
        sendSuccess(null, 'Student updated');
    } catch (\Throwable $e) {
        $db->rollback();
        sendError(500, 'Update failed: ' . $e->getMessage());
    }
}

// ── DELETE ───────────────────────────────────────────────────
function deleteStudent(): void {
    requireAuth('admin');
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) sendError(400, 'Missing id');

    $db   = getDB();
    $stmt = $db->prepare('SELECT user_id FROM students WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) sendError(404, 'Student not found');

    // Soft-delete by deactivating user
    $stmt = $db->prepare('UPDATE users SET is_active=0 WHERE id=?');
    $stmt->bind_param('i', $row['user_id']);
    $stmt->execute();
    $stmt->close();

    sendSuccess(null, 'Student deactivated');
}

// ── ENROLLMENTS ───────────────────────────────────────────────
function getEnrollments(): void {
    requireAuth('admin', 'faculty', 'student');
    $sid = (int)($_GET['student_id'] ?? 0);
    if (!$sid) sendError(400, 'Missing student_id');

    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT e.*, c.code, c.title, c.credits,
                f.user_id AS faculty_user_id, uf.full_name AS faculty_name,
                sm.name AS semester_name
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         LEFT JOIN course_faculty cf ON cf.course_id = c.id AND cf.semester_id = e.semester_id
         LEFT JOIN faculty f ON cf.faculty_id = f.id
         LEFT JOIN users uf ON f.user_id = uf.id
         JOIN semesters sm ON e.semester_id = sm.id
         WHERE e.student_id = ?
         ORDER BY sm.start_date DESC, c.title'
    );
    $stmt->bind_param('i', $sid);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendSuccess($rows);
}

// ── ENROLL ────────────────────────────────────────────────────
function enrollStudent(): void {
    requireAuth('admin');
    $body = getBody();
    requireFields($body, ['student_id', 'course_id', 'semester_id']);

    $db = getDB();

    // Check duplicate enrollment
    $stmt = $db->prepare(
        'SELECT id FROM enrollments WHERE student_id=? AND course_id=? AND semester_id=? LIMIT 1'
    );
    $stmt->bind_param('iii', $body['student_id'], $body['course_id'], $body['semester_id']);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) sendError(409, 'Student already enrolled in this course');
    $stmt->close();

    $stmt = $db->prepare(
        'INSERT INTO enrollments (student_id, course_id, semester_id) VALUES (?,?,?)'
    );
    $stmt->bind_param('iii', $body['student_id'], $body['course_id'], $body['semester_id']);
    $stmt->execute();
    $newId = $db->insert_id;
    $stmt->close();

    sendSuccess(['enrollment_id' => $newId], 'Student enrolled successfully');
}

// ── DROP ENROLLMENT ───────────────────────────────────────────
function dropEnrollment(): void {
    requireAuth('admin');
    $body = getBody();
    requireFields($body, ['student_id', 'course_id']);

    $db   = getDB();
    $stmt = $db->prepare(
        'DELETE FROM enrollments WHERE student_id=? AND course_id=?'
    );
    $stmt->bind_param('ii', $body['student_id'], $body['course_id']);
    $stmt->execute();
    $stmt->close();

    sendSuccess(null, 'Enrollment dropped');
}

// ── MY PROFILE (student self) ─────────────────────────────────
function myProfile(): void {
    $me = requireAuth('student');
    $db = getDB();

    $stmt = $db->prepare(
        'SELECT s.*, u.full_name, u.email, u.username,
                d.name AS department_name
         FROM students s
         JOIN users u ON s.user_id = u.id
         LEFT JOIN departments d ON s.department_id = d.id
         WHERE s.user_id = ? LIMIT 1'
    );
    $stmt->bind_param('i', $me['sub']);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) sendError(404, 'Profile not found');
    sendSuccess($row);
}
