<?php
// ============================================================
//  auth.php  –  Login / Register / Logout
//  Endpoints:
//    POST /auth.php?action=login
//    POST /auth.php?action=register
//    POST /auth.php?action=change_password
//    GET  /auth.php?action=me          (requires token)
// ============================================================

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

match ($action) {
    'login'           => handleLogin(),
    'register'        => handleRegister(),
    'change_password' => handleChangePassword(),
    'me'              => handleMe(),
    default           => sendError(404, "Unknown action: $action"),
};

// ── LOGIN ────────────────────────────────────────────────────
function handleLogin(): void {
    $body = getBody();
    requireFields($body, ['username', 'password', 'role']);

    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT id, username, password_hash, role, full_name, email
         FROM users WHERE username = ? AND role = ? AND is_active = 1 LIMIT 1'
    );
    $stmt->bind_param('ss', $body['username'], $body['role']);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row || !password_verify($body['password'], $row['password_hash'])) {
        sendError(401, 'Invalid credentials');
    }

    // Fetch extra profile data based on role
    $profile = fetchProfile($db, $row['role'], $row['id']);

    $token = createToken([
        'sub'       => $row['id'],
        'username'  => $row['username'],
        'role'      => $row['role'],
        'full_name' => $row['full_name'],
        'exp'       => time() + 86400 * 7,  // 7-day expiry
    ]);

    sendSuccess([
        'token'    => $token,
        'user'     => [
            'id'        => $row['id'],
            'username'  => $row['username'],
            'role'      => $row['role'],
            'full_name' => $row['full_name'],
            'email'     => $row['email'],
        ],
        'profile'  => $profile,
    ], 'Login successful');
}

function fetchProfile(mysqli $db, string $role, int $userId): ?array {
    if ($role === 'student') {
        $stmt = $db->prepare(
            'SELECT s.*, d.name AS department_name
             FROM students s
             LEFT JOIN departments d ON s.department_id = d.id
             WHERE s.user_id = ? LIMIT 1'
        );
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row;
    }
    if ($role === 'faculty') {
        $stmt = $db->prepare(
            'SELECT f.*, d.name AS department_name
             FROM faculty f
             LEFT JOIN departments d ON f.department_id = d.id
             WHERE f.user_id = ? LIMIT 1'
        );
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row;
    }
    return null;
}

// ── REGISTER ─────────────────────────────────────────────────
function handleRegister(): void {
    $body = getBody();
    requireFields($body, ['username', 'password', 'full_name', 'email', 'role']);

    if (!in_array($body['role'], ['student', 'faculty'], true)) {
        sendError(400, 'Self-registration allowed for student or faculty only');
    }
    if (strlen($body['password']) < 8) {
        sendError(400, 'Password must be at least 8 characters');
    }

    $db = getDB();

    // Check duplicate username / email
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
    $stmt->bind_param('ss', $body['username'], $body['email']);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        sendError(409, 'Username or email already exists');
    }
    $stmt->close();

    $hash = password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]);

    // Insert user with is_active = 0 (pending admin approval)
    $stmt = $db->prepare(
        'INSERT INTO users (username, password_hash, full_name, email, role, is_active)
         VALUES (?, ?, ?, ?, ?, 0)'
    );
    $stmt->bind_param('sssss', $body['username'], $hash, $body['full_name'], $body['email'], $body['role']);
    $stmt->execute();
    $userId = $db->insert_id;
    $stmt->close();

    // Insert into registration_requests
    $phone = $body['phone'] ?? null;
    $deptId = isset($body['department_id']) ? (int)$body['department_id'] : null;
    $stmt = $db->prepare(
        'INSERT INTO registration_requests (user_id, full_name, email, phone, department_id, role, status)
         VALUES (?, ?, ?, ?, ?, ?, "pending")'
    );
    $stmt->bind_param('isssss', $userId, $body['full_name'], $body['email'], $phone, $deptId, $body['role']);
    $stmt->execute();
    $stmt->close();

    sendSuccess(['user_id' => $userId], 'Registration submitted. Await admin approval.');
}

// ── CHANGE PASSWORD ───────────────────────────────────────────
function handleChangePassword(): void {
    $me   = requireAuth();
    $body = getBody();
    requireFields($body, ['old_password', 'new_password']);

    if (strlen($body['new_password']) < 8) {
        sendError(400, 'New password must be at least 8 characters');
    }

    $db   = getDB();
    $stmt = $db->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $me['sub']);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row || !password_verify($body['old_password'], $row['password_hash'])) {
        sendError(401, 'Current password is incorrect');
    }

    $newHash = password_hash($body['new_password'], PASSWORD_BCRYPT, ['cost' => 12]);
    $stmt = $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $stmt->bind_param('si', $newHash, $me['sub']);
    $stmt->execute();
    $stmt->close();

    sendSuccess(null, 'Password changed successfully');
}

// ── ME (verify token & return user info) ─────────────────────
function handleMe(): void {
    $me = requireAuth();
    $db = getDB();
    $stmt = $db->prepare(
        'SELECT id, username, full_name, email, role FROM users WHERE id = ? LIMIT 1'
    );
    $stmt->bind_param('i', $me['sub']);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) sendError(404, 'User not found');
    sendSuccess($row);
}
