<?php
// ============================================================
//  manage_faculty.php  –  Faculty CRUD + Registration Approvals
//
//  GET    ?action=list                [admin]
//  GET    ?action=get&id=N            [admin]
//  POST   ?action=create              [admin]
//  PUT    ?action=update&id=N         [admin]
//  DELETE ?action=delete&id=N         [admin]
//  GET    ?action=registrations       [admin] – pending approvals
//  POST   ?action=approve&req_id=N    [admin]
//  POST   ?action=reject&req_id=N     [admin]
//  GET    ?action=my_profile          [faculty]
// ============================================================

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

match ($action) {
    'list'          => listFaculty(),
    'get'           => getFaculty(),
    'create'        => createFaculty(),
    'update'        => updateFaculty(),
    'delete'        => deleteFaculty(),
    'registrations' => listRegistrations(),
    'approve'       => approveRegistration(),
    'reject'        => rejectRegistration(),
    'my_profile'    => myProfile(),
    default         => sendError(404, "Unknown action: $action"),
};

// ── LIST ─────────────────────────────────────────────────────
function listFaculty(): void {
    requireAuth('admin');
    $db = getDB();

    $search = isset($_GET['search']) ? '%' . $db->real_escape_string($_GET['search']) . '%' : null;

    $sql = 'SELECT f.id, f.employee_id, f.designation, f.qualification,
                   u.full_name, u.email, u.username, u.is_active,
                   d.name AS department_name,
                   (SELECT COUNT(*) FROM course_faculty cf WHERE cf.faculty_id = f.id) AS course_count
            FROM faculty f
            JOIN users u ON f.user_id = u.id
            LEFT JOIN departments d ON f.department_id = d.id
            WHERE 1=1';

    $params = []; $types = '';
    if ($search) {
        $sql .= ' AND (u.full_name LIKE ? OR f.employee_id LIKE ? OR u.email LIKE ?)';
        array_push($params, $search, $search, $search);
        $types .= 'sss';
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
function getFaculty(): void {
    requireAuth('admin');
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) sendError(400, 'Missing id');

    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT f.*, u.full_name, u.email, u.username, u.is_active,
                d.name AS department_name
         FROM faculty f
         JOIN users u ON f.user_id = u.id
         LEFT JOIN departments d ON f.department_id = d.id
         WHERE f.id = ? LIMIT 1'
    );
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) sendError(404, 'Faculty not found');

    // Assigned courses
    $stmt = $db->prepare(
        'SELECT c.code, c.title, sm.name AS semester
         FROM course_faculty cf
         JOIN courses c ON cf.course_id = c.id
         JOIN semesters sm ON cf.semester_id = sm.id
         WHERE cf.faculty_id = ?
         ORDER BY sm.start_date DESC'
    );
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row['courses'] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendSuccess($row);
}

// ── CREATE ───────────────────────────────────────────────────
function createFaculty(): void {
    requireAuth('admin');
    $body = getBody();
    requireFields($body, ['username', 'password', 'full_name', 'email',
                          'employee_id', 'department_id', 'designation']);

    $db = getDB();
    $stmt = $db->prepare('SELECT id FROM users WHERE username=? OR email=? LIMIT 1');
    $stmt->bind_param('ss', $body['username'], $body['email']);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) sendError(409, 'Username or email exists');
    $stmt->close();

    $stmt = $db->prepare('SELECT id FROM faculty WHERE employee_id=? LIMIT 1');
    $stmt->bind_param('s', $body['employee_id']);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) sendError(409, 'Employee ID already exists');
    $stmt->close();

    $db->begin_transaction();
    try {
        $hash = password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $db->prepare(
            'INSERT INTO users (username, password_hash, full_name, email, role, is_active)
             VALUES (?,?,?,?,"faculty",1)'
        );
        $stmt->bind_param('ssss', $body['username'], $hash, $body['full_name'], $body['email']);
        $stmt->execute();
        $userId = $db->insert_id;
        $stmt->close();

        $qual = $body['qualification'] ?? '';
        $stmt = $db->prepare(
            'INSERT INTO faculty (user_id, employee_id, department_id, designation, qualification)
             VALUES (?,?,?,?,?)'
        );
        $stmt->bind_param('isiss', $userId, $body['employee_id'],
                          $body['department_id'], $body['designation'], $qual);
        $stmt->execute();
        $facId = $db->insert_id;
        $stmt->close();

        $db->commit();
        sendSuccess(['faculty_id' => $facId], 'Faculty created');
    } catch (\Throwable $e) {
        $db->rollback();
        sendError(500, 'Failed: ' . $e->getMessage());
    }
}

// ── UPDATE ───────────────────────────────────────────────────
function updateFaculty(): void {
    requireAuth('admin');
    $id   = (int)($_GET['id'] ?? 0);
    if (!$id) sendError(400, 'Missing id');
    $body = getBody();

    $db   = getDB();
    $stmt = $db->prepare('SELECT user_id FROM faculty WHERE id=? LIMIT 1');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) sendError(404, 'Faculty not found');

    $db->begin_transaction();
    try {
        if (!empty($body['full_name']) || !empty($body['email'])) {
            $name  = $body['full_name'] ?? null;
            $email = $body['email']     ?? null;
            if ($name && $email) {
                $s = $db->prepare('UPDATE users SET full_name=?, email=? WHERE id=?');
                $s->bind_param('ssi', $name, $email, $row['user_id']);
            } elseif ($name) {
                $s = $db->prepare('UPDATE users SET full_name=? WHERE id=?');
                $s->bind_param('si', $name, $row['user_id']);
            } else {
                $s = $db->prepare('UPDATE users SET email=? WHERE id=?');
                $s->bind_param('si', $email, $row['user_id']);
            }
            $s->execute(); $s->close();
        }

        $desg  = $body['designation']  ?? null;
        $qual  = $body['qualification'] ?? null;
        $deptId = isset($body['department_id']) ? (int)$body['department_id'] : null;
        $stmt  = $db->prepare(
            'UPDATE faculty SET
                designation   = COALESCE(?, designation),
                qualification = COALESCE(?, qualification),
                department_id = COALESCE(?, department_id)
             WHERE id=?'
        );
        $stmt->bind_param('ssii', $desg, $qual, $deptId, $id);
        $stmt->execute(); $stmt->close();

        if (isset($body['is_active'])) {
            $a = (int)(bool)$body['is_active'];
            $s = $db->prepare('UPDATE users SET is_active=? WHERE id=?');
            $s->bind_param('ii', $a, $row['user_id']);
            $s->execute(); $s->close();
        }

        $db->commit();
        sendSuccess(null, 'Faculty updated');
    } catch (\Throwable $e) {
        $db->rollback();
        sendError(500, 'Update failed: ' . $e->getMessage());
    }
}

// ── DELETE (soft) ─────────────────────────────────────────────
function deleteFaculty(): void {
    requireAuth('admin');
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) sendError(400, 'Missing id');

    $db   = getDB();
    $stmt = $db->prepare('SELECT user_id FROM faculty WHERE id=? LIMIT 1');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) sendError(404, 'Faculty not found');

    $stmt = $db->prepare('UPDATE users SET is_active=0 WHERE id=?');
    $stmt->bind_param('i', $row['user_id']);
    $stmt->execute();
    $stmt->close();

    sendSuccess(null, 'Faculty deactivated');
}

// ── PENDING REGISTRATIONS ─────────────────────────────────────
function listRegistrations(): void {
    requireAuth('admin');
    $db   = getDB();
    $status = $_GET['status'] ?? 'pending';
    $stmt = $db->prepare(
        'SELECT rr.*, u.username
         FROM registration_requests rr
         JOIN users u ON rr.user_id = u.id
         WHERE rr.status = ?
         ORDER BY rr.created_at DESC'
    );
    $stmt->bind_param('s', $status);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendSuccess($rows);
}

// ── APPROVE ───────────────────────────────────────────────────
function approveRegistration(): void {
    requireAuth('admin');
    $reqId = (int)($_GET['req_id'] ?? 0);
    if (!$reqId) sendError(400, 'Missing req_id');

    $db   = getDB();
    $stmt = $db->prepare('SELECT * FROM registration_requests WHERE id=? LIMIT 1');
    $stmt->bind_param('i', $reqId);
    $stmt->execute();
    $req = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$req || $req['status'] !== 'pending') sendError(404, 'Request not found or already processed');

    $db->begin_transaction();
    try {
        // Activate user account
        $stmt = $db->prepare('UPDATE users SET is_active=1 WHERE id=?');
        $stmt->bind_param('i', $req['user_id']);
        $stmt->execute(); $stmt->close();

        // Create role-specific profile row if needed
        if ($req['role'] === 'student') {
            // Check if student row already exists
            $s = $db->prepare('SELECT id FROM students WHERE user_id=? LIMIT 1');
            $s->bind_param('i', $req['user_id']);
            $s->execute();
            if ($s->get_result()->num_rows === 0) {
                $s->close();
                $roll = 'S' . date('Y') . str_pad($req['user_id'], 4, '0', STR_PAD_LEFT);
                $s = $db->prepare(
                    'INSERT INTO students (user_id, roll_number, department_id, batch_year) VALUES (?,?,?,?)'
                );
                $s->bind_param('isis', $req['user_id'], $roll, $req['department_id'], date('Y'));
                $s->execute();
            }
            $s->close();
        } elseif ($req['role'] === 'faculty') {
            $s = $db->prepare('SELECT id FROM faculty WHERE user_id=? LIMIT 1');
            $s->bind_param('i', $req['user_id']);
            $s->execute();
            if ($s->get_result()->num_rows === 0) {
                $s->close();
                $empId = 'F' . str_pad($req['user_id'], 5, '0', STR_PAD_LEFT);
                $s = $db->prepare(
                    'INSERT INTO faculty (user_id, employee_id, department_id, designation) VALUES (?,?,?,"Lecturer")'
                );
                $s->bind_param('isi', $req['user_id'], $empId, $req['department_id']);
                $s->execute();
            }
            $s->close();
        }

        // Mark request approved
        $stmt = $db->prepare('UPDATE registration_requests SET status="approved", processed_at=NOW() WHERE id=?');
        $stmt->bind_param('i', $reqId);
        $stmt->execute(); $stmt->close();

        $db->commit();
        sendSuccess(null, 'Registration approved');
    } catch (\Throwable $e) {
        $db->rollback();
        sendError(500, 'Approval failed: ' . $e->getMessage());
    }
}

// ── REJECT ────────────────────────────────────────────────────
function rejectRegistration(): void {
    requireAuth('admin');
    $reqId = (int)($_GET['req_id'] ?? 0);
    if (!$reqId) sendError(400, 'Missing req_id');

    $db   = getDB();
    $stmt = $db->prepare(
        'UPDATE registration_requests SET status="rejected", processed_at=NOW() WHERE id=? AND status="pending"'
    );
    $stmt->bind_param('i', $reqId);
    $stmt->execute();
    if ($db->affected_rows === 0) sendError(404, 'Request not found or already processed');
    $stmt->close();

    // Also deactivate user
    $stmt = $db->prepare(
        'UPDATE users SET is_active=0
         WHERE id = (SELECT user_id FROM registration_requests WHERE id=?)'
    );
    $stmt->bind_param('i', $reqId);
    $stmt->execute(); $stmt->close();

    sendSuccess(null, 'Registration rejected');
}

// ── MY PROFILE (faculty self) ─────────────────────────────────
function myProfile(): void {
    $me = requireAuth('faculty');
    $db = getDB();

    $stmt = $db->prepare(
        'SELECT f.*, u.full_name, u.email, u.username, d.name AS department_name
         FROM faculty f
         JOIN users u ON f.user_id = u.id
         LEFT JOIN departments d ON f.department_id = d.id
         WHERE f.user_id = ? LIMIT 1'
    );
    $stmt->bind_param('i', $me['sub']);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) sendError(404, 'Profile not found');
    sendSuccess($row);
}
