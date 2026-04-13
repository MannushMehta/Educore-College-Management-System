<?php
// ============================================================
//  config.php  –  Database connection & global constants
// ============================================================

define('DB_HOST', 'localhost');
define('DB_USER', 'root');          // change to your MySQL user
define('DB_PASS', '');              // change to your MySQL password
define('DB_NAME', 'college_cms');

define('JWT_SECRET', 'EduCore_S3cr3t_K3y_2024!'); // change in production

// Anthropic API key — get yours at https://console.anthropic.com
define('ANTHROPIC_API_KEY', 'YOUR_ANTHROPIC_API_KEY_HERE');

// CORS headers (allow frontend origin)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── DB connection ────────────────────────────────────────────
function getDB(): mysqli {
    static $conn = null;
    if ($conn === null) {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        if ($conn->connect_error) {
            sendError(500, 'Database connection failed: ' . $conn->connect_error);
        }
        $conn->set_charset('utf8mb4');
    }
    return $conn;
}

// ── Response helpers ─────────────────────────────────────────
function sendJSON(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function sendError(int $code, string $message): void {
    sendJSON(['success' => false, 'message' => $message], $code);
}

function sendSuccess($data = null, string $message = 'OK'): void {
    $resp = ['success' => true, 'message' => $message];
    if ($data !== null) $resp['data'] = $data;
    sendJSON($resp);
}

// ── Input helpers ────────────────────────────────────────────
function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function requireFields(array $body, array $fields): void {
    foreach ($fields as $f) {
        if (!isset($body[$f]) || trim((string)$body[$f]) === '') {
            sendError(400, "Missing required field: $f");
        }
    }
}

// ── Simple token helpers (HMAC-based, no external lib needed) ─
function createToken(array $payload): string {
    $header  = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64_encode(json_encode($payload));
    $sig     = base64_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function verifyToken(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    $expected = base64_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(base64_decode($payload), true);
    if (!$data) return null;
    if (isset($data['exp']) && $data['exp'] < time()) return null;
    return $data;
}

function requireAuth(string ...$allowedRoles): array {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($auth, 'Bearer ')) sendError(401, 'No token provided');
    $token = substr($auth, 7);
    $payload = verifyToken($token);
    if (!$payload) sendError(401, 'Invalid or expired token');
    if ($allowedRoles && !in_array($payload['role'], $allowedRoles, true)) {
        sendError(403, 'Insufficient privileges');
    }
    return $payload;
}
