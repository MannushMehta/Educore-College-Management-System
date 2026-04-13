<?php
// ============================================================
//  grades.php  –  Grade Entry, Update, and Retrieval
//
//  POST ?action=upsert           [faculty]  enter/update grades
//  GET  ?action=course_grades    [faculty, admin]
//  GET  ?action=my_grades        [student]
//  GET  ?action=report           [admin]  all courses summary
// ============================================================

require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

match ($action) {
    'upsert'        => upsertGrades(),
    'course_grades' => courseGrades(),
    'my_grades'     => myGrades(),
    'report'        => gradesReport(),
    default         => sendError(404, "Unknown action: $action"),
};

// ── UPSERT GRADES ─────────────────────────────────────────────
// Body: { course_id, semester_id, grades: [{student_id, internal, external}] }
function upsertGrades(): void {
    $me = requireAuth('faculty');
    $body = getBody();
    requireFields($body, ['course_id', 'semester_id', 'grades']);

    $db       = getDB();
    $courseId = (int)$body['course_id'];
    $semId    = (int)$body['semester_id'];

    // Verify faculty teaches this course
    $stmt = $db->prepare(
        'SELECT cf.id FROM course_faculty cf
         JOIN faculty f ON cf.faculty_id = f.id
         WHERE f.user_id = ? AND cf.course_id = ? AND cf.semester_id = ? LIMIT 1'
    );
    $stmt->bind_param('iii', $me['sub'], $courseId, $semId);
    $stmt->execute();
    if ($stmt->get_result()->num_rows === 0) sendError(403, 'Not assigned to this course');
    $stmt->close();

    $saved = 0;
    $db->begin_transaction();
    try {
        foreach ($body['grades'] as $g) {
            $sid      = (int)($g['student_id'] ?? 0);
            $internal = isset($g['internal']) ? (float)$g['internal'] : null;
            $external = isset($g['external']) ? (float)$g['external'] : null;
            if (!$sid) continue;

            // Calculate total and letter grade
            $total = ($internal !== null && $external !== null)
                   ? $internal + $external
                   : null;
            $letter = gradeFromTotal($total);

            $stmt = $db->prepare(
                'INSERT INTO grades (student_id, course_id, semester_id, internal_marks, external_marks, total_marks, grade)
                 VALUES (?,?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE
                    internal_marks = VALUES(internal_marks),
                    external_marks = VALUES(external_marks),
                    total_marks    = VALUES(total_marks),
                    grade          = VALUES(grade)'
            );
            $stmt->bind_param('iiiddds', $sid, $courseId, $semId,
                              $internal, $external, $total, $letter);
            $stmt->execute();
            $saved++;
            $stmt->close();
        }
        $db->commit();
        sendSuccess(['saved' => $saved], 'Grades saved');
    } catch (\Throwable $e) {
        $db->rollback();
        sendError(500, 'Failed: ' . $e->getMessage());
    }
}

function gradeFromTotal(?float $total): ?string {
    if ($total === null) return null;
    return match (true) {
        $total >= 90 => 'O',
        $total >= 80 => 'A+',
        $total >= 70 => 'A',
        $total >= 60 => 'B+',
        $total >= 50 => 'B',
        $total >= 40 => 'C',
        default      => 'F',
    };
}

// ── COURSE GRADES (faculty / admin view) ─────────────────────
function courseGrades(): void {
    requireAuth('faculty', 'admin');
    $courseId = (int)($_GET['course_id'] ?? 0);
    $semId    = (int)($_GET['semester_id'] ?? 0);
    if (!$courseId) sendError(400, 'Missing course_id');

    $db  = getDB();
    $sql = 'SELECT g.*, s.roll_number, u.full_name,
                   sm.name AS semester_name
            FROM grades g
            JOIN students s ON g.student_id = s.id
            JOIN users u ON s.user_id = u.id
            JOIN semesters sm ON g.semester_id = sm.id
            WHERE g.course_id = ?';
    $params = [$courseId]; $types = 'i';

    if ($semId) {
        $sql .= ' AND g.semester_id = ?';
        $params[] = $semId; $types .= 'i';
    }
    $sql .= ' ORDER BY u.full_name';

    $stmt = $db->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendSuccess($rows);
}

// ── MY GRADES (student) ───────────────────────────────────────
function myGrades(): void {
    $me = requireAuth('student');
    $db = getDB();

    $stmt = $db->prepare('SELECT id FROM students WHERE user_id=? LIMIT 1');
    $stmt->bind_param('i', $me['sub']);
    $stmt->execute();
    $stu = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$stu) sendError(404, 'Student profile not found');

    $stmt = $db->prepare(
        'SELECT g.*, c.code, c.title, c.credits, sm.name AS semester_name
         FROM grades g
         JOIN courses c ON g.course_id = c.id
         JOIN semesters sm ON g.semester_id = sm.id
         WHERE g.student_id = ?
         ORDER BY sm.start_date DESC, c.title'
    );
    $stmt->bind_param('i', $stu['id']);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Calculate GPA per semester
    $semGpa = [];
    foreach ($rows as $g) {
        $sn = $g['semester_name'];
        if (!isset($semGpa[$sn])) $semGpa[$sn] = ['total_credits' => 0, 'weighted' => 0];
        $gp = gradeToPoints($g['grade']);
        $semGpa[$sn]['total_credits'] += $g['credits'];
        $semGpa[$sn]['weighted']      += $gp * $g['credits'];
    }
    $gpas = [];
    foreach ($semGpa as $sem => $data) {
        $gpas[$sem] = $data['total_credits'] > 0
            ? round($data['weighted'] / $data['total_credits'], 2)
            : 0;
    }

    sendSuccess(['grades' => $rows, 'semester_gpa' => $gpas]);
}

function gradeToPoints(?string $grade): float {
    return match ($grade) {
        'O'  => 10.0,
        'A+' => 9.0,
        'A'  => 8.0,
        'B+' => 7.0,
        'B'  => 6.0,
        'C'  => 5.0,
        default => 0.0,
    };
}

// ── ADMIN REPORT ──────────────────────────────────────────────
function gradesReport(): void {
    requireAuth('admin');
    $semId = isset($_GET['semester_id']) ? (int)$_GET['semester_id'] : null;

    $db  = getDB();
    $sql = 'SELECT c.id AS course_id, c.code, c.title,
                   sm.name AS semester_name,
                   COUNT(g.id) AS graded_count,
                   ROUND(AVG(g.total_marks), 1) AS avg_total,
                   SUM(g.grade="F") AS fail_count,
                   SUM(g.grade IN ("O","A+","A")) AS distinction_count
            FROM grades g
            JOIN courses c ON g.course_id = c.id
            JOIN semesters sm ON g.semester_id = sm.id
            WHERE 1=1';

    $params = []; $types = '';
    if ($semId) {
        $sql .= ' AND g.semester_id = ?';
        $params[] = $semId; $types .= 'i';
    }
    $sql .= ' GROUP BY g.course_id, g.semester_id ORDER BY c.title';

    $stmt = $db->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendSuccess($rows);
}
