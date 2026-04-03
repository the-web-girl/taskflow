<?php
/**
 * TaskFlow – API de synchronisation PHP/MySQL
 * Fichier : api/sync.php
 */

// ─── CONFIGURATION ────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'taskflow');
define('DB_USER', 'taskflow_user');  // À modifier
define('DB_PASS', 'MOT_DE_PASSE');   // À modifier
define('DB_CHARSET', 'utf8mb4');

// Clé secrète pour sécuriser les échanges (changez-la !)
define('SECRET_KEY', 'CHANGEZ_CETTE_CLE_SECRETE_32_CHARS');

// ─── HEADERS CORS & JSON ──────────────────────────────
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// Autoriser uniquement les requêtes du même domaine
$allowed_origins = [
    'https://votre-domaine.com',  // Remplacez par votre domaine
    'http://localhost',
    'http://localhost:8080',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── SESSION UTILISATEUR ──────────────────────────────
session_start();

// Identifiant unique de session (simplifié – sans auth complète)
if (empty($_SESSION['user_id'])) {
    $_SESSION['user_id'] = 'user_' . bin2hex(random_bytes(8));
}
$userId = $_SESSION['user_id'];

// ─── CONNEXION PDO ────────────────────────────────────
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = sprintf(
                'mysql:host=%s;dbname=%s;charset=%s',
                DB_HOST, DB_NAME, DB_CHARSET
            );
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            jsonError('Connexion base de données impossible: ' . $e->getMessage(), 500);
        }
    }
    return $pdo;
}

// ─── HELPERS ──────────────────────────────────────────
function jsonResponse(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function jsonError(string $message, int $code = 400): void {
    jsonResponse(['error' => $message], $code);
}

function sanitizeJson(string $json): ?array {
    $data = json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE) return null;
    return $data;
}

// ─── INITIALISATION TABLE ─────────────────────────────
function ensureTableExists(): void {
    $pdo = getDB();
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS taskflow_states (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            user_id      VARCHAR(64)  NOT NULL,
            state_data   LONGTEXT     NOT NULL,
            updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
}

// ─── ROUTAGE ──────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    ensureTableExists();

    if ($method === 'GET' && $action === 'load') {
        handleLoad();
    } elseif ($method === 'POST') {
        handleSave();
    } else {
        jsonError('Méthode non autorisée', 405);
    }
} catch (Exception $e) {
    jsonError('Erreur serveur: ' . $e->getMessage(), 500);
}

// ─── CHARGEMENT ───────────────────────────────────────
function handleLoad(): void {
    global $userId;
    $pdo = getDB();

    $stmt = $pdo->prepare(
        'SELECT state_data, updated_at FROM taskflow_states WHERE user_id = ? LIMIT 1'
    );
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    if (!$row) {
        jsonResponse(['data' => null, 'message' => 'Aucune donnée sauvegardée']);
    }

    $data = sanitizeJson($row['state_data']);
    if ($data === null) {
        jsonError('Données corrompues en base', 500);
    }

    jsonResponse([
        'data'       => $data,
        'updated_at' => $row['updated_at'],
        'user_id'    => $userId,
    ]);
}

// ─── SAUVEGARDE ───────────────────────────────────────
function handleSave(): void {
    global $userId;

    $rawBody = file_get_contents('php://input');
    if (empty($rawBody)) {
        jsonError('Corps de la requête vide');
    }

    $payload = sanitizeJson($rawBody);
    if ($payload === null) {
        jsonError('JSON invalide');
    }

    if (!isset($payload['data']) || !is_array($payload['data'])) {
        jsonError('Format de données incorrect');
    }

    // Validation basique de la taille (max 5 Mo)
    if (strlen($rawBody) > 5 * 1024 * 1024) {
        jsonError('Données trop volumineuses (max 5 Mo)', 413);
    }

    // Nettoyer les données sensibles avant de stocker
    $stateToStore = $payload['data'];
    // Ne jamais stocker les clés API Google en base
    if (isset($stateToStore['google'])) {
        unset($stateToStore['google']['apiKey']);
        // Conserver clientId et calendarId
    }

    $json = json_encode($stateToStore, JSON_UNESCAPED_UNICODE);

    $pdo = getDB();
    $stmt = $pdo->prepare("
        INSERT INTO taskflow_states (user_id, state_data)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
            state_data = VALUES(state_data),
            updated_at = CURRENT_TIMESTAMP
    ");
    $stmt->execute([$userId, $json]);

    jsonResponse([
        'success'    => true,
        'message'    => 'Données sauvegardées',
        'updated_at' => date('Y-m-d H:i:s'),
    ]);
}
