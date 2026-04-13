<?php
// ============================================================
//  ai_proxy.php  –  Server-side proxy for Anthropic Claude API
//  Keeps the API key secret on the server; browser never sees it.
//
//  POST /ai_proxy.php
//  Body: { system: string, messages: [{role, content}] }
//  Returns: { success: true, reply: string }
// ============================================================

require_once __DIR__ . '/config.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError(405, 'Method not allowed');
}

// Must be logged in (any role)
requireAuth();

$body = getBody();

if (empty($body['messages']) || !is_array($body['messages'])) {
    sendError(400, 'Missing messages array');
}

// Validate API key is configured
if (!defined('ANTHROPIC_API_KEY') || ANTHROPIC_API_KEY === 'YOUR_ANTHROPIC_API_KEY_HERE') {
    sendError(503, 'AI service not configured. Please add your Anthropic API key to backend/php/config.php');
}

// Build request to Anthropic
$payload = [
    'model'      => 'claude-sonnet-4-20250514',
    'max_tokens' => 1024,
    'messages'   => $body['messages'],
];

if (!empty($body['system'])) {
    $payload['system'] = $body['system'];
}

// Call Anthropic API server-side
$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: ' . ANTHROPIC_API_KEY,
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_TIMEOUT        => 30,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    sendError(502, 'Could not reach AI service: ' . $curlError);
}

$data = json_decode($response, true);

if ($httpCode !== 200) {
    $errMsg = $data['error']['message'] ?? 'AI service returned an error';
    sendError($httpCode >= 500 ? 502 : 400, $errMsg);
}

if (empty($data['content'][0]['text'])) {
    sendError(502, 'Empty response from AI service');
}

sendSuccess(['reply' => $data['content'][0]['text']], 'OK');
