<?php
// ============================================================
//  announcements.php  –  Announcements & Study Materials
//
//  Announcements
//  POST   ?action=post            [admin, faculty]
//  GET    ?action=list            [all]
//  DELETE ?action=delete&id=N     [admin, faculty (own)]
//
//  Materials
//  POST   ?action=upload_material  [faculty]
//  GET    ?action=materials        [all]
//  DELETE ?action=delete_material&id=N [faculty (own), admin]
// ============================================================

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

match ($action) {
    'post'            => postAnnouncement(),
    'list'            => listAnnouncements(),
    'delete'          => deleteAnnouncement(),
    'upload_material' => uploadMaterial(),
    'materials'       => listMaterials(),
    'delete_material' => deleteMaterial(),
    default           => sendError(404, "Unknown action: $action"),
};

// ── POST ANNOUNCEMENT ─────────────────────────────────────────
function postAnnouncement(): void {
    $me = requireAuth('admin', 'faculty');
    $body = getBody();
    requireFields($body, ['title', 'content']);

    $courseId  = isset($body['course_id']) ? (int)$body['course_id'] : null;
    $expiresAt = $body['expires_at'] ?? null;

    $db   = getDB();
    $stmt = $db->prepare(
        'INSERT INTO announcements (title, content, posted_by_user_id, course_id, expires_at)
         VALUES (?,?,?,?,?)'
    );
    $stmt->bind_param('ssiss', $body['title'], $body['content'],
                      $me['sub'], $courseId, $expiresAt);
    $stmt->execute();
    $newId = $db->insert_id;
    $stmt->close();

    sendSuccess(['announcement_id' => $newId], 'Announcement posted');
}

// ── LIST ANNOUNCEMENTS ────────────────────────────────────────
function listAnnouncements(): void {
    $me = requireAuth();
    $db = getDB();

    $courseId = isset($_GET['course_id']) ? (int)$_GET['course_id'] : null;

    // Students only see announcements for their enrolled courses + global ones
    $sql = 'SELECT a.id, a.title, a.content, a.created_at, a.expires_at,
                   u.full_name AS posted_by, u.role AS poster_role,
                   c.code AS course_code, c.title AS course_title
            FROM announcements a
            JOIN users u ON a.posted_by_user_id = u.id
            LEFT JOIN courses c ON a.course_id = c.id
            WHERE (a.expires_at IS NULL OR a.expires_at >= CURDATE())';

    $params = []; $types = '';

    if ($me['role'] === 'student') {
        $sql .= ' AND (a.course_id IS NULL OR a.course_id IN (
                    SELECT e.course_id FROM enrollments e
                    JOIN students s ON e.student_id = s.id
                    WHERE s.user_id = ?
                 ))';
        $params[] = $me['sub']; $types .= 'i';
    } elseif ($courseId) {
        $sql .= ' AND (a.course_id = ? OR a.course_id IS NULL)';
        $params[] = $courseId; $types .= 'i';
    }
    $sql .= ' ORDER BY a.created_at DESC LIMIT 50';

    $stmt = $db->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendSuccess($rows);
}

// ── DELETE ANNOUNCEMENT ───────────────────────────────────────
function deleteAnnouncement(): void {
    $me = requireAuth('admin', 'faculty');
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) sendError(400, 'Missing id');

    $db   = getDB();
    // Faculty can only delete their own; admin can delete any
    if ($me['role'] === 'faculty') {
        $stmt = $db->prepare('DELETE FROM announcements WHERE id=? AND posted_by_user_id=?');
        $stmt->bind_param('ii', $id, $me['sub']);
    } else {
        $stmt = $db->prepare('DELETE FROM announcements WHERE id=?');
        $stmt->bind_param('i', $id);
    }
    $stmt->execute();
    if ($db->affected_rows === 0) sendError(403, 'Not found or permission denied');
    $stmt->close();

    sendSuccess(null, 'Announcement deleted');
}

// ── UPLOAD MATERIAL ───────────────────────────────────────────
// Expects multipart/form-data with fields: course_id, title, description (optional)
// plus a file field named "file"
function uploadMaterial(): void {
    $me = requireAuth('faculty');

    $courseId = (int)($_POST['course_id'] ?? 0);
    $title    = trim($_POST['title'] ?? '');
    if (!$courseId || !$title) sendError(400, 'course_id and title are required');

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        sendError(400, 'No file uploaded or upload error');
    }

    $file      = $_FILES['file'];
    $maxSize   = 20 * 1024 * 1024; // 20 MB
    if ($file['size'] > $maxSize) sendError(400, 'File exceeds 20 MB limit');

    $allowedMime = [
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg', 'image/png', 'text/plain',
        'application/zip',
    ];
    if (!in_array($file['type'], $allowedMime, true)) {
        sendError(400, 'File type not allowed');
    }

    // Store in /uploads/materials/  (create dir if needed)
    $uploadDir = __DIR__ . '/../../uploads/materials/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid('mat_', true) . '.' . strtolower($ext);
    $dest     = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        sendError(500, 'Failed to save file');
    }

    $db   = getDB();
    $desc = $_POST['description'] ?? '';
    $stmt = $db->prepare(
        'INSERT INTO materials (course_id, uploaded_by_user_id, title, description, file_name, file_path, file_size, mime_type)
         VALUES (?,?,?,?,?,?,?,?)'
    );
    $filePath = 'uploads/materials/' . $filename;
    $stmt->bind_param('iissssis', $courseId, $me['sub'], $title, $desc,
                      $filename, $filePath, $file['size'], $file['type']);
    $stmt->execute();
    $newId = $db->insert_id;
    $stmt->close();

    sendSuccess(['material_id' => $newId, 'file_path' => $filePath], 'Material uploaded');
}

// ── LIST MATERIALS ────────────────────────────────────────────
function listMaterials(): void {
    requireAuth();
    $db = getDB();
    $courseId = isset($_GET['course_id']) ? (int)$_GET['course_id'] : null;

    $sql = 'SELECT m.id, m.title, m.description, m.file_name, m.file_path,
                   m.file_size, m.mime_type, m.created_at,
                   u.full_name AS uploaded_by, c.code AS course_code, c.title AS course_title
            FROM materials m
            JOIN users u ON m.uploaded_by_user_id = u.id
            JOIN courses c ON m.course_id = c.id
            WHERE 1=1';

    $params = []; $types = '';
    if ($courseId) {
        $sql .= ' AND m.course_id = ?';
        $params[] = $courseId; $types .= 'i';
    }
    $sql .= ' ORDER BY m.created_at DESC';

    $stmt = $db->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Format file size for display
    foreach ($rows as &$r) {
        $r['file_size_formatted'] = formatBytes((int)$r['file_size']);
    }

    sendSuccess($rows);
}

// ── DELETE MATERIAL ───────────────────────────────────────────
function deleteMaterial(): void {
    $me = requireAuth('faculty', 'admin');
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) sendError(400, 'Missing id');

    $db   = getDB();
    $stmt = $db->prepare('SELECT file_path, uploaded_by_user_id FROM materials WHERE id=? LIMIT 1');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) sendError(404, 'Material not found');
    if ($me['role'] === 'faculty' && $row['uploaded_by_user_id'] !== $me['sub']) {
        sendError(403, 'You can only delete your own materials');
    }

    // Remove physical file
    $abs = __DIR__ . '/../../' . $row['file_path'];
    if (file_exists($abs)) unlink($abs);

    $stmt = $db->prepare('DELETE FROM materials WHERE id=?');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();

    sendSuccess(null, 'Material deleted');
}

function formatBytes(int $bytes): string {
    if ($bytes >= 1048576) return round($bytes / 1048576, 1) . ' MB';
    if ($bytes >= 1024)    return round($bytes / 1024, 1) . ' KB';
    return $bytes . ' B';
}
