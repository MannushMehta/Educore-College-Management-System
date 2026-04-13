<?php
// ============================================================
//  attendance.php  –  Attendance Marking & Reports
//
//  POST ?action=mark          [faculty]  bulk mark for a session
//  GET  ?action=session       [faculty]  get one session's records
//  GET  ?action=course_report [admin, faculty]  full report for course
//  GET  ?action=my_attendance [student]  own records
//  GET  ?action=summary       [faculty, admin]  pct per student per course
// ============================================================

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

match ($action) {
    'mark'          => markAttendance(),
    'session'       => getSession(),
    'course_report' => courseReport(),
    'my_attendance' => myAttendance(),
    'summary'       => attendanceSummary(),
    default         => sendError(404, "Unknown action: $action"),
};

// ── MARK ATTENDANCE ──────────────────────────────────────────
// Body: { course_id, date, records: [{student_id, status}] }
// status: 'present' | 'absent' | 'late'
function markAttendance(): void {
    $me = requireAuth('faculty');
    $body = getBody();
    requireFields($body, ['course_id', 'date', 'records']);

    if (!is_array($body['records']) || empty($body['records'])) {
        sendError(400, 'records must be a non-empty array');
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $body['date'])) {
        sendError(400, 'Invalid date format (expected YYYY-MM-DD)');
    }

    $db = getDB();
    $courseId = (int)$body['course_id'];

    // Verify this faculty teaches the course
    $stmt = $db->prepare(
        'SELECT cf.id FROM course_faculty cf
         JOIN faculty f ON cf.faculty_id = f.id
         WHERE f.user_id = ? AND cf.course_id = ? LIMIT 1'
    );
    $stmt->bind_param('ii', $me['sub'], $courseId);
    $stmt->execute();
    if ($stmt->get_result()->num_rows === 0) {
        sendError(403, 'You are not assigned to this course');
    }
    $stmt->close();

    $validStatuses = ['present', 'absent', 'late'];
    $inserted = 0; $updated = 0;

    $db->begin_transaction();
    try {
        foreach ($body['records'] as $rec) {
            $sid    = (int)($rec['student_id'] ?? 0);
            $status = $rec['status'] ?? '';
            if (!$sid || !in_array($status, $validStatuses, true)) continue;

            // Upsert
            $stmt = $db->prepare(
                'INSERT INTO attendance (student_id, course_id, date, status)
                 VALUES (?,?,?,?)
                 ON DUPLICATE KEY UPDATE status = VALUES(status)'
            );
            $stmt->bind_param('iiss', $sid, $courseId, $body['date'], $status);
            $stmt->execute();
            if ($db->affected_rows === 1) $inserted++;
            else $updated++;
            $stmt->close();
        }
        $db->commit();
        sendSuccess(['inserted' => $inserted, 'updated' => $updated], 'Attendance saved');
    } catch (\Throwable $e) {
        $db->rollback();
        sendError(500, 'Failed: ' . $e->getMessage());
    }
}

// ── GET SESSION RECORDS ───────────────────────────────────────
function getSession(): void {
    requireAuth('faculty', 'admin');
    $courseId = (int)($_GET['course_id'] ?? 0);
    $date     = $_GET['date'] ?? '';
    if (!$courseId || !$date) sendError(400, 'Missing course_id or date');

    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT a.id, a.student_id, a.status,
                u.full_name, s.roll_number
         FROM attendance a
         JOIN students s ON a.student_id = s.id
         JOIN users u ON s.user_id = u.id
         WHERE a.course_id = ? AND a.date = ?
         ORDER BY u.full_name'
    );
    $stmt->bind_param('is', $courseId, $date);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendSuccess($rows);
}

// ── FULL COURSE REPORT ────────────────────────────────────────
function courseReport(): void {
    requireAuth('faculty', 'admin');
    $courseId = (int)($_GET['course_id'] ?? 0);
    if (!$courseId) sendError(400, 'Missing course_id');

    $db = getDB();

    // Distinct dates for this course
    $stmt = $db->prepare(
        'SELECT DISTINCT date FROM attendance WHERE course_id=? ORDER BY date'
    );
    $stmt->bind_param('i', $courseId);
    $stmt->execute();
    $dates = array_column($stmt->get_result()->fetch_all(MYSQLI_ASSOC), 'date');
    $stmt->close();

    // All enrolled students
    $stmt = $db->prepare(
        'SELECT s.id AS student_id, s.roll_number, u.full_name
         FROM enrollments e
         JOIN students s ON e.student_id = s.id
         JOIN users u ON s.user_id = u.id
         WHERE e.course_id = ?
         ORDER BY u.full_name'
    );
    $stmt->bind_param('i', $courseId);
    $stmt->execute();
    $students = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Attendance records
    $stmt = $db->prepare(
        'SELECT student_id, date, status FROM attendance WHERE course_id=?'
    );
    $stmt->bind_param('i', $courseId);
    $stmt->execute();
    $raw = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Index records
    $index = [];
    foreach ($raw as $r) {
        $index[$r['student_id']][$r['date']] = $r['status'];
    }

    // Build matrix
    $report = [];
    foreach ($students as $stu) {
        $row = [
            'student_id'  => $stu['student_id'],
            'roll_number' => $stu['roll_number'],
            'full_name'   => $stu['full_name'],
            'dates'       => [],
            'present'     => 0,
            'absent'      => 0,
            'late'        => 0,
            'total'       => count($dates),
        ];
        foreach ($dates as $d) {
            $st = $index[$stu['student_id']][$d] ?? 'not_marked';
            $row['dates'][$d] = $st;
            if ($st === 'present') $row['present']++;
            elseif ($st === 'absent') $row['absent']++;
            elseif ($st === 'late')   $row['late']++;
        }
        $row['percentage'] = $row['total'] > 0
            ? round(($row['present'] + $row['late']) / $row['total'] * 100, 1)
            : 0;
        $report[] = $row;
    }

    sendSuccess(['dates' => $dates, 'report' => $report]);
}

// ── MY ATTENDANCE (student) ───────────────────────────────────
function myAttendance(): void {
    $me = requireAuth('student');
    $db = getDB();

    // Get student id
    $stmt = $db->prepare('SELECT id FROM students WHERE user_id=? LIMIT 1');
    $stmt->bind_param('i', $me['sub']);
    $stmt->execute();
    $stu = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$stu) sendError(404, 'Student profile not found');
    $sid = $stu['id'];

    // Per-course summary
    $stmt = $db->prepare(
        'SELECT c.id AS course_id, c.code, c.title,
                COUNT(a.id) AS total_classes,
                SUM(a.status IN ("present","late")) AS attended,
                SUM(a.status = "absent") AS absences,
                ROUND(SUM(a.status IN ("present","late")) / COUNT(a.id) * 100, 1) AS percentage
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         LEFT JOIN attendance a ON a.student_id = ? AND a.course_id = c.id
         WHERE e.student_id = ?
         GROUP BY c.id
         ORDER BY c.title'
    );
    $stmt->bind_param('ii', $sid, $sid);
    $stmt->execute();
    $summary = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Detailed records (last 30 entries)
    $courseId = isset($_GET['course_id']) ? (int)$_GET['course_id'] : null;
    $detailSql = 'SELECT a.date, a.status, c.code, c.title
                  FROM attendance a
                  JOIN courses c ON a.course_id = c.id
                  WHERE a.student_id = ?';
    $params = [$sid]; $types = 'i';
    if ($courseId) {
        $detailSql .= ' AND a.course_id = ?';
        $params[] = $courseId; $types .= 'i';
    }
    $detailSql .= ' ORDER BY a.date DESC LIMIT 60';

    $stmt = $db->prepare($detailSql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $details = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendSuccess(['summary' => $summary, 'details' => $details]);
}

// ── SUMMARY (attendance % per student per course) ─────────────
function attendanceSummary(): void {
    requireAuth('faculty', 'admin');
    $courseId = isset($_GET['course_id']) ? (int)$_GET['course_id'] : null;

    $db  = getDB();
    $sql = 'SELECT c.id AS course_id, c.code, c.title,
                   s.id AS student_id, u.full_name, s.roll_number,
                   COUNT(a.id) AS total,
                   SUM(a.status IN ("present","late")) AS attended,
                   ROUND(SUM(a.status IN ("present","late")) / COUNT(a.id) * 100, 1) AS percentage
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            JOIN students s ON e.student_id = s.id
            JOIN users u ON s.user_id = u.id
            LEFT JOIN attendance a ON a.student_id = s.id AND a.course_id = c.id
            WHERE 1=1';

    $params = []; $types = '';
    if ($courseId) {
        $sql .= ' AND c.id = ?';
        $params[] = $courseId; $types .= 'i';
    }
    $sql .= ' GROUP BY c.id, s.id ORDER BY c.title, u.full_name';

    $stmt = $db->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendSuccess($rows);
}
