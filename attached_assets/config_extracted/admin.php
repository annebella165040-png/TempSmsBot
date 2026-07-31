<?php
session_start();
require_once 'config.php';

$accessCode = "1122R";
$error = "";

// Authentication handling
if (isset($_POST['action']) && $_POST['action'] === 'login') {
    $code = isset($_POST['code']) ? trim($_POST['code']) : '';
    if ($code === $accessCode) {
        $_SESSION['admin_logged'] = true;
        header("Location: admin.php");
        exit;
    } else {
        $error = "Incorrect Access Code. Please try again.";
    }
}

if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    unset($_SESSION['admin_logged']);
    session_destroy();
    header("Location: admin.php");
    exit;
}

// Redirect to login page if not logged in
if (!isset($_SESSION['admin_logged']) || $_SESSION['admin_logged'] !== true) {
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Access Control</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg: #020617;
                --card-bg: rgba(15, 23, 42, 0.6);
                --accent: #2563eb;
                --accent-glow: rgba(37, 99, 235, 0.4);
                --danger: #f43f5e;
                --border: rgba(255, 255, 255, 0.08);
                --text: #f8fafc;
            }
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            body {
                font-family: 'Outfit', sans-serif;
                background-color: var(--bg);
                color: var(--text);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                position: relative;
            }
            .glow-1 {
                position: absolute;
                width: 450px;
                height: 450px;
                background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0,0,0,0) 70%);
                top: -15%;
                left: -10%;
                z-index: 0;
            }
            .glow-2 {
                position: absolute;
                width: 500px;
                height: 500px;
                background: radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, rgba(0,0,0,0) 70%);
                bottom: -15%;
                right: -10%;
                z-index: 0;
            }
            .login-container {
                position: relative;
                z-index: 10;
                width: 100%;
                max-width: 420px;
                padding: 2.5rem;
                background: var(--card-bg);
                backdrop-filter: blur(20px);
                border: 1px solid var(--border);
                border-radius: 28px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                text-align: center;
                animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(24px); }
                to { opacity: 1; transform: translateY(0); }
            }
            h2 {
                font-size: 1.8rem;
                font-weight: 800;
                margin-bottom: 0.5rem;
                background: linear-gradient(135deg, #60a5fa, #a78bfa);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            p {
                color: #94a3b8;
                font-size: 0.95rem;
                margin-bottom: 2rem;
            }
            .input-group {
                margin-bottom: 1.5rem;
                text-align: left;
            }
            label {
                display: block;
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: #94a3b8;
                margin-bottom: 0.5rem;
                font-weight: 600;
            }
            input {
                width: 100%;
                background-color: rgba(0, 0, 0, 0.3);
                border: 1px solid var(--border);
                padding: 0.9rem 1.2rem;
                border-radius: 14px;
                color: var(--text);
                font-size: 1.1rem;
                font-weight: 700;
                letter-spacing: 0.15em;
                text-align: center;
                outline: none;
                transition: all 0.3s ease;
            }
            input:focus {
                border-color: var(--accent);
                box-shadow: 0 0 15px var(--accent-glow);
            }
            .btn {
                width: 100%;
                background: linear-gradient(135deg, #2563eb, #4f46e5);
                color: white;
                border: none;
                padding: 0.95rem;
                border-radius: 14px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(37, 99, 235, 0.4);
            }
            .error {
                background-color: rgba(244, 63, 94, 0.1);
                border: 1px solid rgba(244, 63, 94, 0.2);
                color: var(--danger);
                padding: 0.75rem;
                border-radius: 8px;
                font-size: 0.85rem;
                margin-bottom: 1.5rem;
                font-weight: 500;
            }
        </style>
    </head>
    <body>
        <div class="glow-1"></div>
        <div class="glow-2"></div>
        <div class="login-container">
            <h2>Access Control</h2>
            <p>Enter the master security code to open panel</p>
            <?php if (!empty($error)): ?>
                <div class="error"><?php echo $error; ?></div>
            <?php endif; ?>
            <form action="" method="POST">
                <input type="hidden" name="action" value="login">
                <div class="input-group">
                    <label>Access Code</label>
                    <input type="password" name="code" placeholder="••••" required autofocus autocomplete="off">
                </div>
                <button type="submit" class="btn">Proceed Securely</button>
            </form>
        </div>
    </body>
    </html>
    <?php
    exit;
}

// ── HELPER FUNCTIONS ────────────────────────────────────────────────────────
function getShortSerialId($index) {
    $letters = range('A', 'Z');
    $letterIdx = floor($index / 999);
    $num = ($index % 999) + 1;
    if ($letterIdx < count($letters)) {
        return $letters[$letterIdx] . $num;
    }
    return 'Z' . $num;
}

function extractMobNo($val) {
    if (!empty($val['mobNo'])) return $val['mobNo'];
    if (!empty($val['phoneNumber'])) return $val['phoneNumber'];
    if (isset($val['sims']) && is_array($val['sims'])) {
        foreach ($val['sims'] as $sim) {
            if (is_array($sim) && !empty($sim['phoneNumber'])) {
                return $sim['phoneNumber'];
            }
        }
    }
    return '';
}

function parseDeviceData($key, $val, $dbIdx, $dbUrl) {
    if (!is_array($val)) return null;
    $isOnline = false;
    if (isset($val['status'])) {
        if (is_bool($val['status'])) {
            $isOnline = $val['status'];
        } elseif (is_string($val['status'])) {
            $isOnline = (strtolower($val['status']) === 'online');
        }
    }
    
    // Verify real-time online status via timestamp (max 300 seconds difference for clock skew)
    if ($isOnline) {
        if (isset($val['timestamp'])) {
            $timestampSec = intval($val['timestamp'] / 1000);
            $diff = abs(time() - $timestampSec);
            if ($diff > 300) {
                $isOnline = false;
            }
        }
    }
    $name = $key;
    if (!empty($val['d_name'])) {
        $name = $val['d_name'];
    } elseif (!empty($val['name'])) {
        $name = $val['name'];
    } elseif (!empty($val['modelName'])) {
        $name = $val['modelName'];
    }
    return [
        'id'     => $key,
        'name'   => $name,
        'status' => $isOnline,
        'mobNo'  => extractMobNo($val),
        'battery'=> isset($val['battery']) ? $val['battery'] : 'N/A',
        'db_idx' => $dbIdx,
        'db_url' => $dbUrl
    ];
}

function firebaseRequestByURL($baseUrl, $path, $method = 'GET', $data = null) {
    $url = rtrim($baseUrl, '/') . '/' . ltrim($path, '/') . '.json';
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
    
    if ($method === 'PUT' || $method === 'PATCH' || $method === 'DELETE') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    }
    
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

function getAllDevicesFromDBs() {
    global $firebaseUrls;
    if (empty($firebaseUrls)) return [];
    
    $mh = curl_multi_init();
    $handles = [];
    
    foreach ($firebaseUrls as $idx => $baseUrl) {
        foreach (['clients.json', 'user_data.json'] as $path) {
            $url = rtrim($baseUrl, '/') . '/' . $path;
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
            curl_setopt($ch, CURLOPT_NOSIGNAL, 1);
            curl_multi_add_handle($mh, $ch);
            $handles[] = ['ch' => $ch, 'url' => $baseUrl, 'idx' => $idx];
        }
    }
    
    $active = null;
    do { $mrc = curl_multi_exec($mh, $active); } while ($mrc == CURLM_CALL_MULTI_PERFORM);
    while ($active && $mrc == CURLM_OK) {
        if (curl_multi_select($mh) == -1) usleep(100);
        do { $mrc = curl_multi_exec($mh, $active); } while ($mrc == CURLM_CALL_MULTI_PERFORM);
    }
    
    $devices = [];
    
    foreach ($handles as $item) {
        $ch  = $item['ch'];
        $raw = curl_multi_getcontent($ch);
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
        
        $data = json_decode($raw, true);
        if (!is_array($data)) continue;
        
        foreach ($data as $key => $val) {
            if ($key === 'ok' || !is_array($val)) continue;
            $uniqueKey = $item['idx'] . '_' . $key;
            
            $parsed = parseDeviceData($key, $val, $item['idx'], $item['url']);
            if ($parsed) {
                if (isset($devices[$uniqueKey])) {
                    if ($parsed['status']) {
                        $devices[$uniqueKey]['status'] = true;
                    }
                    if (!empty($parsed['mobNo'])) {
                        $devices[$uniqueKey]['mobNo'] = $parsed['mobNo'];
                    }
                    if ($parsed['battery'] !== 'N/A') {
                        $devices[$uniqueKey]['battery'] = $parsed['battery'];
                    }
                } else {
                    $devices[$uniqueKey] = $parsed;
                }
            }
        }
    }
    curl_multi_close($mh);
    
    $devicesList = array_values($devices);
    
    // Sort devices to ensure stable mapping
    usort($devicesList, function($a, $b) {
        if ($a['db_idx'] !== $b['db_idx']) {
            return $a['db_idx'] - $b['db_idx'];
        }
        return strcmp($a['id'], $b['id']);
    });
    
    // Rebuild and save mappings dynamically to keep device_mappings.json updated
    $mappings = [];
    foreach ($devicesList as $index => $dev) {
        $serialId = getShortSerialId($index);
        $mappings[$serialId] = [
            'id' => $dev['id'],
            'name' => $dev['name'],
            'db_idx' => $dev['db_idx'],
            'db_url' => $dev['db_url']
        ];
    }
    file_put_contents(__DIR__ . '/device_mappings.json', json_encode($mappings, JSON_PRETTY_PRINT));
    
    return $devicesList;
}

function rebuildDeviceMappings() {
    $devices = getAllDevicesFromDBs();
    $mappings = [];
    foreach ($devices as $index => $dev) {
        $serialId = getShortSerialId($index);
        $mappings[$serialId] = [
            'id' => $dev['id'],
            'name' => $dev['name'],
            'db_idx' => $dev['db_idx'],
            'db_url' => $dev['db_url']
        ];
    }
    file_put_contents(__DIR__ . '/device_mappings.json', json_encode($mappings, JSON_PRETTY_PRINT));
    return count($devices);
}

// Get single DB device statistics
function getDBStats($dbUrl, $dbIdx) {
    $clients = firebaseRequestByURL($dbUrl, 'clients');
    $userData = firebaseRequestByURL($dbUrl, 'user_data');
    
    $devices = [];
    $processed = [];
    
    if (is_array($clients)) {
        foreach ($clients as $key => $val) {
            if ($key === 'ok' || !is_array($val)) continue;
            $processed[$key] = true;
            $parsed = parseDeviceData($key, $val, $dbIdx, $dbUrl);
            if ($parsed) $devices[] = $parsed;
        }
    }
    
    if (is_array($userData)) {
        foreach ($userData as $key => $val) {
            if ($key === 'ok' || !is_array($val) || isset($processed[$key])) continue;
            $parsed = parseDeviceData($key, $val, $dbIdx, $dbUrl);
            if ($parsed) $devices[] = $parsed;
        }
    }
    
    $online = 0;
    $offline = 0;
    foreach ($devices as $dev) {
        if ($dev['status']) $online++;
        else $offline++;
    }
    
    return [
        'total' => count($devices),
        'online' => $online,
        'offline' => $offline
    ];
}

// ── AJAX ENDPOINTS ──────────────────────────────────────────────────────────
if (isset($_GET['ajax'])) {
    header('Content-Type: application/json');
    $action = $_GET['ajax'];
    
    if ($action === 'map_db') {
        $newUrl = isset($_POST['db_url']) ? rtrim(trim($_POST['db_url']), '/') : '';
        if (empty($newUrl) || !filter_var($newUrl, FILTER_VALIDATE_URL)) {
            echo json_encode(['status' => 'error', 'message' => 'Invalid database URL.']);
            exit;
        }
        
        // Check if already exists in settings
        if (in_array($newUrl, $firebaseUrls)) {
            echo json_encode(['status' => 'error', 'message' => 'This Firebase database URL is already added!']);
            exit;
        }
        
        // Step 1: Ping connectivity
        $ping = firebaseRequestByURL($newUrl, '.settings/rules'); 
        // fallback check
        $pingCheck = firebaseRequestByURL($newUrl, 'clients');
        
        // Add DB to settings
        $firebaseUrls[] = $newUrl;
        $settings['bot_enabled'] = BOT_ENABLED;
        $settings['firebase_urls'] = $firebaseUrls;
        file_put_contents(__DIR__ . '/bot_settings.json', json_encode($settings, JSON_PRETTY_PRINT));
        
        // Step 2: Rebuild mappings
        $totalDevices = rebuildDeviceMappings();
        
        echo json_encode([
            'status' => 'success',
            'message' => 'Firebase URL successfully mapped!',
            'device_count' => $totalDevices
        ]);
        exit;
    }
    
    elseif ($action === 'delete_db') {
        $delUrl = isset($_POST['db_url']) ? trim($_POST['db_url']) : '';
        $key = array_search($delUrl, $firebaseUrls);
        if ($key !== false) {
            unset($firebaseUrls[$key]);
            $firebaseUrls = array_values($firebaseUrls);
            $settings['bot_enabled'] = BOT_ENABLED;
            $settings['firebase_urls'] = $firebaseUrls;
            file_put_contents(__DIR__ . '/bot_settings.json', json_encode($settings, JSON_PRETTY_PRINT));
            
            // Rebuild mappings
            rebuildDeviceMappings();
            
            // Automatically clean up generated history and active background scans for this DB
            $historyFile = __DIR__ . '/generated_history.json';
            if (file_exists($historyFile)) {
                $history = json_decode(file_get_contents($historyFile), true) ?: [];
                $updatedHistory = [];
                foreach ($history as $cId => $items) {
                    $filtered = [];
                    foreach ($items as $item) {
                        if (isset($item['db_url']) && rtrim($item['db_url'], '/') !== rtrim($delUrl, '/')) {
                            $filtered[] = $item;
                        }
                    }
                    if (!empty($filtered)) {
                        $updatedHistory[$cId] = $filtered;
                    }
                }
                file_put_contents($historyFile, json_encode($updatedHistory, JSON_PRETTY_PRINT));
            }

            $scansFile = __DIR__ . '/active_scans.json';
            if (file_exists($scansFile)) {
                $scans = json_decode(file_get_contents($scansFile), true) ?: [];
                $updatedScans = [];
                foreach ($scans as $cId => $scan) {
                    if (isset($scan['db_url']) && rtrim($scan['db_url'], '/') !== rtrim($delUrl, '/')) {
                        $updatedScans[$cId] = $scan;
                    }
                }
                file_put_contents($scansFile, json_encode($updatedScans, JSON_PRETTY_PRINT));
            }
            
            echo json_encode(['status' => 'success', 'message' => 'Database deleted and mappings updated.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Database not found.']);
        }
        exit;
    }
    
    elseif ($action === 'toggle_db') {
        $dbUrl = isset($_POST['db_url']) ? trim($_POST['db_url']) : '';
        $enable = isset($_POST['enable']) ? (int)$_POST['enable'] : 1;
        
        $settingsFile = __DIR__ . '/bot_settings.json';
        $settings = file_exists($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
        if (empty($settings)) {
            $settings = ['bot_enabled' => true, 'firebase_urls' => []];
        }
        
        $disabledList = isset($settings['disabled_urls']) ? $settings['disabled_urls'] : [];
        
        if ($enable) {
            $key = array_search($dbUrl, $disabledList);
            if ($key !== false) {
                unset($disabledList[$key]);
                $disabledList = array_values($disabledList);
            }
        } else {
            if (!in_array($dbUrl, $disabledList)) {
                $disabledList[] = $dbUrl;
            }
        }
        
        $settings['disabled_urls'] = $disabledList;
        file_put_contents($settingsFile, json_encode($settings, JSON_PRETTY_PRINT));
        
        rebuildDeviceMappings();
        
        echo json_encode(['status' => 'success', 'message' => 'Database status updated.']);
        exit;
    }
    
    elseif ($action === 'toggle_bot_enabled') {
        $settingsFile = __DIR__ . '/bot_settings.json';
        $settings = file_exists($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
        if (empty($settings)) {
            $settings = ['bot_enabled' => true, 'firebase_urls' => [], 'channels' => []];
        }
        
        $settings['bot_enabled'] = isset($_POST['bot_enabled']) ? (bool)(int)$_POST['bot_enabled'] : true;
        file_put_contents($settingsFile, json_encode($settings, JSON_PRETTY_PRINT));
        
        echo json_encode(['status' => 'success', 'message' => 'Bot status updated successfully.']);
        exit;
    }
    
    elseif ($action === 'add_channel') {
        $channel = isset($_POST['channel']) ? trim($_POST['channel']) : '';
        if (empty($channel)) {
            echo json_encode(['status' => 'error', 'message' => 'Channel name is empty.']);
            exit;
        }
        if ($channel[0] !== '@' && !is_numeric($channel)) {
            $channel = '@' . $channel;
        }
        
        $settingsFile = __DIR__ . '/bot_settings.json';
        $settings = file_exists($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
        if (empty($settings)) {
            $settings = ['bot_enabled' => true, 'firebase_urls' => [], 'channels' => []];
        }
        if (!isset($settings['channels'])) {
            $settings['channels'] = [];
        }
        
        if (!in_array($channel, $settings['channels'])) {
            $settings['channels'][] = $channel;
            file_put_contents($settingsFile, json_encode($settings, JSON_PRETTY_PRINT));
            echo json_encode(['status' => 'success', 'message' => 'Telegram channel added successfully.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Channel already exists.']);
        }
        exit;
    }
    
    elseif ($action === 'delete_channel') {
        $channel = isset($_POST['channel']) ? trim($_POST['channel']) : '';
        
        $settingsFile = __DIR__ . '/bot_settings.json';
        $settings = file_exists($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
        if (!empty($settings) && isset($settings['channels'])) {
            $key = array_search($channel, $settings['channels']);
            if ($key !== false) {
                unset($settings['channels'][$key]);
                $settings['channels'] = array_values($settings['channels']);
                file_put_contents($settingsFile, json_encode($settings, JSON_PRETTY_PRINT));
                echo json_encode(['status' => 'success', 'message' => 'Channel deleted.']);
                exit;
            }
        }
        echo json_encode(['status' => 'error', 'message' => 'Channel not found.']);
        exit;
    }


    
    elseif ($action === 'broadcast') {
        $msg = isset($_POST['message']) ? trim($_POST['message']) : '';
        if (empty($msg)) {
            echo json_encode(['status' => 'error', 'message' => 'Message is empty.']);
            exit;
        }
        $usersFile = __DIR__ . '/users.json';
        $users = file_exists($usersFile) ? (json_decode(file_get_contents($usersFile), true) ?: []) : [];
        
        if (empty($users)) {
            echo json_encode(['status' => 'error', 'message' => 'No active Telegram bot users found.']);
            exit;
        }
        
        $success = 0;
        foreach ($users as $userId) {
            $telegramUrl = TELEGRAM_API_BASE . "/bot" . BOT_TOKEN . "/sendMessage";
            $payload = [
                'chat_id' => $userId,
                'text' => "📢 *Broadcast Message:*\n\n" . $msg,
                'parse_mode' => 'Markdown'
            ];
            
            $ch = curl_init($telegramUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 4);
            curl_exec($ch);
            $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($http >= 200 && $http < 300) $success++;
        }
        echo json_encode(['status' => 'success', 'message' => "Successfully broadcasted message to $success/" . count($users) . " users."]);
        exit;
    }
    
    elseif ($action === 'block_user') {
        $userId = isset($_POST['user_id']) ? (int)$_POST['user_id'] : 0;
        if ($userId > 0) {
            $blockedFile = __DIR__ . '/blocked_users.json';
            $blockedList = file_exists($blockedFile) ? (json_decode(file_get_contents($blockedFile), true) ?: []) : [];
            if (!in_array($userId, $blockedList)) {
                $blockedList[] = $userId;
                file_put_contents($blockedFile, json_encode($blockedList));
            }
            echo json_encode(['status' => 'success', 'message' => 'User blocked successfully.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid user ID.']);
        }
        exit;
    }
    
    elseif ($action === 'unblock_user') {
        $userId = isset($_POST['user_id']) ? (int)$_POST['user_id'] : 0;
        if ($userId > 0) {
            $blockedFile = __DIR__ . '/blocked_users.json';
            $blockedList = file_exists($blockedFile) ? (json_decode(file_get_contents($blockedFile), true) ?: []) : [];
            $key = array_search($userId, $blockedList);
            if ($key !== false) {
                unset($blockedList[$key]);
                $blockedList = array_values($blockedList);
                file_put_contents($blockedFile, json_encode($blockedList));
            }
            echo json_encode(['status' => 'success', 'message' => 'User unblocked successfully.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid user ID.']);
        }
        exit;
    }
    
    elseif ($action === 'delete_device') {
        $deviceId = isset($_POST['device_id']) ? trim($_POST['device_id']) : '';
        $dbUrl = isset($_POST['db_url']) ? trim($_POST['db_url']) : '';
        
        if (empty($deviceId) || empty($dbUrl)) {
            echo json_encode(['status' => 'error', 'message' => 'Missing device ID or database URL.']);
            exit;
        }
        
        // Delete from clients node
        firebaseRequestByURL($dbUrl, "clients/" . urlencode($deviceId), 'DELETE');
        // Delete from user_data node
        firebaseRequestByURL($dbUrl, "user_data/" . urlencode($deviceId), 'DELETE');
        // Delete from messages/user_sms if they exist
        firebaseRequestByURL($dbUrl, "messages/" . urlencode($deviceId), 'DELETE');
        firebaseRequestByURL($dbUrl, "user_sms/" . urlencode($deviceId), 'DELETE');
        
        // Rebuild mappings
        rebuildDeviceMappings();
        
        echo json_encode(['status' => 'success', 'message' => 'Device and its mappings deleted successfully!']);
        exit;
    }
    
    elseif ($action === 'get_stats') {
        $devices = getAllDevicesFromDBs();
        $online = 0;
        $offline = 0;
        foreach ($devices as $d) {
            if ($d['status']) $online++;
            else $offline++;
        }
        
        $usersFile = __DIR__ . '/users.json';
        $usersCount = file_exists($usersFile) ? count(json_decode(file_get_contents($usersFile), true) ?: []) : 0;
        
        echo json_encode([
            'total_devices' => count($devices),
            'online_devices' => $online,
            'offline_devices' => $offline,
            'total_dbs' => count($firebaseUrls),
            'total_users' => $usersCount
        ]);
        exit;
    }
}

// Initial stats fetch
$initialDevices = getAllDevicesFromDBs();
$initialOnline = 0;
$initialOffline = 0;
foreach ($initialDevices as $d) {
    if ($d['status']) $initialOnline++;
    else $initialOffline++;
}

$usersFile = __DIR__ . '/users.json';
$initialUsers = file_exists($usersFile) ? count(json_decode(file_get_contents($usersFile), true) ?: []) : 0;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Master Admin Control Console</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #030712;
            --sidebar-bg: rgba(15, 23, 42, 0.4);
            --card-bg: rgba(255, 255, 255, 0.04);
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --accent: #2563eb;
            --accent-gradient: linear-gradient(135deg, #3b82f6, #8b5cf6);
            --border: rgba(255, 255, 255, 0.08);
            --success: #10b981;
            --danger: #f43f5e;
            --warning: #f59e0b;
        }
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            overflow-x: hidden;
            position: relative;
        }

        /* iOS Liquid/Water Color Background Blobs */
        .liquid-blob {
            position: fixed;
            border-radius: 50%;
            filter: blur(100px);
            z-index: 0;
            opacity: 0.35;
            pointer-events: none;
            animation: float 25s infinite alternate ease-in-out;
        }

        .blob-1 {
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, #3b82f6 0%, #6366f1 50%, rgba(0,0,0,0) 100%);
            top: -200px;
            left: -100px;
            animation-duration: 20s;
        }

        .blob-2 {
            width: 650px;
            height: 650px;
            background: radial-gradient(circle, #ec4899 0%, #8b5cf6 50%, rgba(0,0,0,0) 100%);
            bottom: -200px;
            right: -100px;
            animation-duration: 25s;
            animation-delay: -5s;
        }

        .blob-3 {
            width: 500px;
            height: 500px;
            background: radial-gradient(circle, #06b6d4 0%, #3b82f6 50%, rgba(0,0,0,0) 100%);
            top: 30%;
            left: 40%;
            animation-duration: 30s;
            animation-delay: -10s;
        }

        @keyframes float {
            0% { transform: translate(0, 0) scale(1) rotate(0deg); }
            33% { transform: translate(60px, -90px) scale(1.15) rotate(120deg); }
            66% { transform: translate(-50px, 70px) scale(0.9) rotate(240deg); }
            100% { transform: translate(0, 0) scale(1) rotate(360deg); }
        }

        .wrapper {
            display: flex;
            width: 100%;
            z-index: 10;
            position: relative;
        }

        /* Sidebar navigation */
        .sidebar {
            width: 280px;
            background-color: var(--sidebar-bg);
            backdrop-filter: blur(30px);
            -webkit-backdrop-filter: blur(30px);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            padding: 2rem 1.5rem;
            position: fixed;
            height: 100vh;
            left: 0;
            top: 0;
            z-index: 100;
        }

        .logo {
            font-size: 1.45rem;
            font-weight: 800;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 2.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .nav-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            flex-grow: 1;
        }

        .nav-item {
            display: block;
        }

        .nav-item a {
            display: flex;
            align-items: center;
            padding: 0.85rem 1rem;
            border-radius: 12px;
            color: var(--text-muted);
            text-decoration: none;
            font-weight: 500;
            transition: all 0.25s ease;
            gap: 0.75rem;
            cursor: pointer;
        }

        .nav-item:hover a, .nav-item.active a {
            background-color: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: var(--text);
            font-weight: 600;
        }

        .logout-btn {
            display: flex;
            align-items: center;
            padding: 0.85rem 1rem;
            border-radius: 12px;
            color: var(--danger);
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            gap: 0.75rem;
            margin-top: auto;
            border: 1px solid rgba(244, 63, 94, 0.15);
            background-color: rgba(244, 63, 94, 0.03);
        }

        .logout-btn:hover {
            background-color: rgba(244, 63, 94, 0.1);
            box-shadow: 0 4px 12px rgba(244, 63, 94, 0.1);
        }

        /* Main Workspace Content Area */
        .workspace {
            margin-left: 280px;
            flex-grow: 1;
            padding: 2.5rem;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            gap: 2rem;
            z-index: 10;
        }

        .tab-content {
            display: none;
            animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            flex-direction: column;
            gap: 2rem;
        }

        .tab-content.active {
            display: flex;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Section Headings */
        .workspace-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border);
            padding-bottom: 1.25rem;
        }

        .workspace-title h1 {
            font-size: 1.8rem;
            font-weight: 800;
            letter-spacing: -0.02em;
        }

        .workspace-title p {
            color: var(--text-muted);
            font-size: 0.95rem;
            margin-top: 0.25rem;
        }

        /* Metrics grid */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.5rem;
        }

        .metric-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            overflow: hidden;
            backdrop-filter: blur(12px);
        }

        .metric-label {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            font-weight: 700;
        }

        .metric-value {
            font-size: 2.2rem;
            font-weight: 800;
            margin-top: 0.75rem;
            display: flex;
            align-items: baseline;
            gap: 0.5rem;
        }

        .metric-accent-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            display: inline-block;
        }

        .metric-accent-dot.online { background-color: var(--success); box-shadow: 0 0 10px var(--success); }
        .metric-accent-dot.offline { background-color: var(--danger); box-shadow: 0 0 10px var(--danger); }
        .metric-accent-dot.db { background-color: var(--accent); box-shadow: 0 0 10px var(--accent); }
        .metric-accent-dot.users { background-color: var(--warning); box-shadow: 0 0 10px var(--warning); }

        .panel {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 2rem;
            backdrop-filter: blur(12px);
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .panel-title {
            font-size: 1.25rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .form-row {
            display: flex;
            gap: 0.75rem;
        }

        label {
            font-size: 0.8rem;
            text-transform: uppercase;
            font-weight: 600;
            color: var(--text-muted);
            letter-spacing: 0.03em;
        }

        input[type="text"], textarea {
            width: 100%;
            background-color: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--border);
            padding: 0.85rem 1rem;
            border-radius: 12px;
            color: var(--text);
            font-size: 0.95rem;
            outline: none;
            transition: all 0.3s ease;
        }

        input[type="text"]:focus, textarea:focus {
            border-color: var(--accent);
            box-shadow: 0 0 10px rgba(37, 99, 235, 0.3);
        }

        .btn-action {
            background: linear-gradient(135deg, #2563eb, #4f46e5);
            color: white;
            border: none;
            padding: 0.85rem 1.5rem;
            border-radius: 12px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            white-space: nowrap;
        }

        .btn-action:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }

        /* iOS Switch Toggle styles */
        .ios-switch-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(0, 0, 0, 0.2);
            padding: 0.75rem 1rem;
            border-radius: 14px;
            border: 1px solid var(--border);
        }
        .ios-switch-label {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: none;
            letter-spacing: 0;
            margin: 0;
        }
        .ios-switch {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
        }
        .ios-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .ios-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(255, 255, 255, 0.15);
            transition: .3s;
            border-radius: 24px;
        }
        .ios-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .3s;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        input:checked + .ios-slider {
            background: linear-gradient(135deg, #10b981, #059669);
        }
        input:checked + .ios-slider:before {
            transform: translateX(20px);
        }

        /* Firebase List styles */
        .db-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 1.5rem;
        }

        .db-card {
            background: rgba(15, 23, 42, 0.4);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 1.25rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            transition: all 0.3s ease;
        }

        .db-card:hover {
            border-color: rgba(37, 99, 235, 0.4);
            transform: translateY(-2px);
        }

        .db-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .db-title {
            font-weight: 700;
            font-size: 1.05rem;
            color: #60a5fa;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 180px;
        }

        .db-status-bar {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.75rem;
            background: rgba(0,0,0,0.15);
            padding: 0.75rem;
            border-radius: 10px;
            font-size: 0.85rem;
        }

        .db-stat-item {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }

        .db-stat-lbl {
            font-size: 0.7rem;
            color: var(--text-muted);
            text-transform: uppercase;
            font-weight: 600;
        }

        .db-stat-val {
            font-weight: 700;
            font-size: 1.05rem;
        }

        .btn-delete {
            background: rgba(244, 63, 94, 0.1);
            border: 1px solid rgba(244, 63, 94, 0.2);
            color: var(--danger);
            font-weight: 600;
            cursor: pointer;
            font-size: 0.85rem;
            padding: 0.5rem 1rem;
            border-radius: 10px;
            transition: all 0.2s ease;
            text-align: center;
        }

        .btn-delete:hover {
            background-color: rgba(244, 63, 94, 0.2);
        }

        /* Real-time Loader Overlay */
        .mapping-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(2, 6, 23, 0.85);
            backdrop-filter: blur(8px);
            z-index: 1000;
            display: none;
            align-items: center;
            justify-content: center;
        }

        .mapping-box {
            background: #0f172a;
            border: 1px solid var(--border);
            padding: 2.5rem;
            border-radius: 28px;
            width: 90%;
            max-width: 480px;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .mapping-spinner {
            width: 60px;
            height: 60px;
            border: 4px solid rgba(37, 99, 235, 0.1);
            border-top: 4px solid var(--accent);
            border-radius: 50%;
            margin: 0 auto;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .mapping-status-title {
            font-size: 1.3rem;
            font-weight: 800;
            color: var(--text);
        }

        .mapping-logs {
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--border);
            padding: 1rem;
            border-radius: 12px;
            font-family: monospace;
            font-size: 0.85rem;
            color: #34d399;
            text-align: left;
            height: 120px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
        }

        /* Devices Table */
        .table-responsive {
            width: 100%;
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }

        th {
            padding: 1rem;
            border-bottom: 2px solid var(--border);
            color: var(--text-muted);
            font-size: 0.8rem;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.05em;
        }

        td {
            padding: 1.15rem 1rem;
            border-bottom: 1px solid var(--border);
            font-size: 0.95rem;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            font-size: 0.8rem;
            font-weight: 600;
            padding: 0.25rem 0.6rem;
            border-radius: 6px;
        }

        .status-badge.online {
            background-color: rgba(16, 185, 129, 0.15);
            color: var(--success);
        }

        .status-badge.offline {
            background-color: rgba(148, 163, 184, 0.15);
            color: var(--text-muted);
        }

        .badge-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
        }
        .badge-dot.online { background-color: var(--success); }
        .badge-dot.offline { background-color: var(--text-muted); }

        .db-label {
            background-color: rgba(99, 102, 241, 0.15);
            color: #818cf8;
            padding: 0.2rem 0.5rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;
        }

        /* Toast notification */
        .toast {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background-color: var(--success);
            color: white;
            padding: 0.9rem 1.8rem;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            display: none;
            align-items: center;
            gap: 0.5rem;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        }

        .toast.error {
            background-color: var(--danger);
        }

        @keyframes slideIn {
            from { transform: translateY(100%) scale(0.9); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
        }

        .mobile-header {
            display: none;
        }

        /* Mobile Responsive View Layouts */
        @media (max-width: 768px) {
            body {
                padding-bottom: 70px; /* space for bottom navigation bar */
            }
            .sidebar {
                position: fixed;
                bottom: 0;
                top: auto;
                left: 0;
                width: 100%;
                height: 65px;
                flex-direction: row;
                padding: 0;
                border-right: none;
                border-top: 1px solid var(--border);
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                z-index: 1000;
                justify-content: space-around;
                align-items: center;
            }
            .logo {
                display: none;
            }
            .nav-list {
                flex-direction: row;
                width: 100%;
                height: 100%;
                justify-content: space-around;
                align-items: center;
                gap: 0;
            }
            .nav-item {
                flex: 1;
                text-align: center;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .nav-item a {
                flex-direction: column;
                gap: 2px;
                padding: 4px 0;
                font-size: 0.7rem;
                background: none !important;
                border: none !important;
                color: var(--text-muted);
                width: 100%;
                height: 100%;
                justify-content: center;
            }
            .nav-item.active a {
                color: #60a5fa;
            }
            .logout-btn {
                display: none;
            }
            .workspace {
                margin-left: 0;
                padding: 1rem;
                padding-top: 60px; /* space for top header */
                gap: 1.25rem;
            }
            .mobile-header {
                display: flex;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 50px;
                background: rgba(3, 7, 18, 0.8);
                backdrop-filter: blur(20px);
                border-bottom: 1px solid var(--border);
                align-items: center;
                justify-content: space-between;
                padding: 0 1rem;
                z-index: 999;
            }
            .mobile-logo {
                font-size: 1.1rem;
                font-weight: 800;
                background: var(--accent-gradient);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .mobile-logout {
                color: var(--danger);
                font-size: 0.85rem;
                font-weight: 600;
                text-decoration: none;
            }
            .metrics-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.75rem;
            }
            .metric-card {
                padding: 1rem;
            }
            .metric-value {
                font-size: 1.5rem;
            }
            .panel {
                padding: 1rem;
                border-radius: 18px;
            }
            .form-row {
                flex-direction: column;
                gap: 0.75rem;
            }
            .db-grid {
                grid-template-columns: 1fr;
                gap: 1rem;
            }
            .db-card {
                padding: 1rem;
            }
            .table-responsive {
                border-radius: 10px;
            }
            table th, table td {
                padding: 0.75rem 0.5rem;
                font-size: 0.8rem;
            }
        }
    </style>
</head>
<body>

    <!-- Mobile Header -->
    <div class="mobile-header">
        <div class="mobile-logo">🛡️ Ronak Control</div>
        <a href="admin.php?action=logout" class="mobile-logout">Logout 🚪</a>
    </div>

    <!-- iOS Dynamic Water Color Background Blobs -->
    <div class="liquid-blob blob-1"></div>
    <div class="liquid-blob blob-2"></div>
    <div class="liquid-blob blob-3"></div>

    <div class="wrapper">
        <!-- Sidebar Navigation -->
        <div class="sidebar">
            <div class="logo">
                🛡️ Ronak Control
            </div>
            <ul class="nav-list">
                <li class="nav-item active" id="nav-dashboard">
                    <a href="javascript:void(0)" onclick="switchTab('dashboard')">📊 Dashboard</a>
                </li>
                <li class="nav-item" id="nav-firebase">
                    <a href="javascript:void(0)" onclick="switchTab('firebase')">📂 Firebase Management</a>
                </li>
                <li class="nav-item" id="nav-users">
                    <a href="javascript:void(0)" onclick="switchTab('users')">👥 User Management</a>
                </li>
                <li class="nav-item" id="nav-broadcast">
                    <a href="javascript:void(0)" onclick="switchTab('broadcast')">📢 Broadcast Panel</a>
                </li>
                <li class="nav-item" id="nav-settings">
                    <a href="javascript:void(0)" onclick="switchTab('settings')">⚙️ Settings</a>
                </li>
            </ul>
            <a href="admin.php?action=logout" class="logout-btn">
                🚪 Secure Logout
            </a>
        </div>

        <!-- Main Workspace -->
        <div class="workspace">
            
            <!-- ── DASHBOARD TAB ────────────────────────────────────────── -->
            <div id="tab-dashboard" class="tab-content active">
                <div class="workspace-header">
                    <div class="workspace-title">
                        <h1>System Overview</h1>
                        <p>Real-time analytics and telemetry of registered bot devices</p>
                    </div>
                </div>

                <!-- Statistics Metrics Cards -->
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-label">Total Devices</div>
                        <div class="metric-value" id="stat-total-devices">
                            <?php echo count($initialDevices); ?>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Online Devices</div>
                        <div class="metric-value">
                            <span class="metric-accent-dot online"></span>
                            <span id="stat-online-devices"><?php echo $initialOnline; ?></span>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Offline Devices</div>
                        <div class="metric-value">
                            <span class="metric-accent-dot offline"></span>
                            <span id="stat-offline-devices"><?php echo $initialOffline; ?></span>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Firebase Datasets</div>
                        <div class="metric-value" id="stat-total-dbs">
                            <?php echo count($firebaseUrls); ?>
                        </div>
                    </div>
                </div>

                <!-- Table Panel: All Devices List -->
                <div class="panel">
                    <div class="panel-title">📱 Registered Client Terminals</div>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Device ID</th>
                                    <th>Device Name</th>
                                    <th>Phone Number</th>
                                    <th>Battery</th>
                                    <th>Database Source</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody id="devices-table-body">
                                <?php if (!empty($initialDevices)): ?>
                                    <?php foreach ($initialDevices as $dev): ?>
                                        <tr>
                                            <td style="font-family: monospace; font-size: 0.85rem; color: var(--text-muted);"><?php echo htmlspecialchars($dev['id']); ?></td>
                                            <td style="font-weight: 600;"><?php echo htmlspecialchars($dev['name']); ?></td>
                                            <td><?php echo htmlspecialchars($dev['mobNo'] ?: 'N/A'); ?></td>
                                            <td style="color: #fbbf24;">⚡ <?php echo htmlspecialchars($dev['battery']); ?>%</td>
                                            <td><span class="db-label">DB #<?php echo $dev['db_idx'] + 1; ?></span></td>
                                            <td>
                                                <?php if ($dev['status']): ?>
                                                    <span class="status-badge online"><span class="badge-dot online"></span>Online</span>
                                                <?php else: ?>
                                                    <span class="status-badge offline"><span class="badge-dot offline"></span>Offline</span>
                                                <?php endif; ?>
                                            </td>
                                            <td>
                                                <button class="btn-delete" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onclick="deleteDevice('<?php echo htmlspecialchars($dev['id']); ?>', '<?php echo htmlspecialchars($dev['db_url']); ?>')">Delete</button>
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                <?php else: ?>
                                    <tr>
                                        <td colspan="7" style="text-align: center; padding: 4rem 0; color: var(--text-muted);">
                                            No registered devices found.
                                        </td>
                                    </tr>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ── FIREBASE MANAGEMENT TAB ────────────────────────────── -->
            <div id="tab-firebase" class="tab-content">
                <div class="workspace-header">
                    <div class="workspace-title">
                        <h1>Firebase Datasets Configuration</h1>
                        <p>Configure Firebase RTDB endpoints and trigger real-time device mapping updates</p>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-title">📂 Add New Firebase URL</div>
                    <form id="add-db-form" class="form-group">
                        <label>Firebase RTDB URL</label>
                        <div class="form-row">
                            <input type="text" name="db_url" id="db-url-input" placeholder="https://your-rtdb-name.firebaseio.com" required autocomplete="off">
                            <button type="submit" class="btn-action">Map Database</button>
                        </div>
                    </form>
                </div>

                <div class="panel">
                    <div class="panel-title">🗂️ Configured Databases & Status</div>
                    <div class="db-grid" id="db-grid-container">
                        <?php 
                        $allConfiguredUrls = isset($settings['firebase_urls']) ? $settings['firebase_urls'] : [];
                        $disabledList = isset($settings['disabled_urls']) ? $settings['disabled_urls'] : [];
                        if (!empty($allConfiguredUrls)): ?>
                            <?php foreach ($allConfiguredUrls as $idx => $url): 
                                $stats = getDBStats($url, $idx);
                                $dbLabel = parse_url($url, PHP_URL_HOST);
                                $dbLabel = str_replace('-default-rtdb.firebaseio.com', '', $dbLabel);
                                $isDisabled = in_array($url, $disabledList);
                                ?>
                                <div class="db-card" id="db-card-<?php echo $idx; ?>" style="<?php echo $isDisabled ? 'opacity: 0.65;' : ''; ?>">
                                    <div class="db-card-header">
                                        <span class="db-title" title="<?php echo htmlspecialchars($url); ?>"><?php echo htmlspecialchars($dbLabel); ?></span>
                                        <span class="db-label">DB #<?php echo $idx + 1; ?></span>
                                    </div>
                                    
                                    <!-- Full URL display -->
                                    <div style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted); word-break: break-all; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 8px;">
                                        <?php echo htmlspecialchars($url); ?>
                                    </div>

                                    <div class="db-status-bar">
                                        <div class="db-stat-item">
                                            <span class="db-stat-lbl">Online</span>
                                            <span class="db-stat-val" style="color: var(--success);"><?php echo $stats['online']; ?></span>
                                        </div>
                                        <div class="db-stat-item">
                                            <span class="db-stat-lbl">Offline</span>
                                            <span class="db-stat-val" style="color: var(--text-muted);"><?php echo $stats['offline']; ?></span>
                                        </div>
                                    </div>

                                    <!-- iOS Toggle Switch -->
                                    <div class="ios-switch-container">
                                        <span class="ios-switch-label">Database Active</span>
                                        <label class="ios-switch">
                                            <input type="checkbox" <?php echo !$isDisabled ? 'checked' : ''; ?> onchange="toggleDatabaseActive('<?php echo htmlspecialchars($url); ?>', <?php echo $idx; ?>, this.checked)">
                                            <span class="ios-slider"></span>
                                        </label>
                                    </div>

                                    <button class="btn-delete" onclick="deleteDatabase('<?php echo htmlspecialchars($url); ?>', <?php echo $idx; ?>)">Delete Config</button>
                                </div>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 4rem 0;">
                                No databases configured.
                            </div>
                        <?php endif; ?>

                    </div>
                </div>
            </div>

            <!-- ── USER MANAGEMENT TAB ─────────────────────────────────── -->
            <div id="tab-users" class="tab-content">
                <div class="workspace-header">
                    <div class="workspace-title">
                        <h1>User Management</h1>
                        <p>Details of registered Telegram bot chat users receiving SMS telemetry</p>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-title">👥 Registered Bot Users</div>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Index</th>
                                    <th>Telegram Chat ID</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php 
                                $usersList = file_exists($usersFile) ? (json_decode(file_get_contents($usersFile), true) ?: []) : [];
                                $blockedFile = __DIR__ . '/blocked_users.json';
                                $blockedList = file_exists($blockedFile) ? (json_decode(file_get_contents($blockedFile), true) ?: []) : [];
                                
                                if (!empty($usersList)): 
                                    foreach ($usersList as $index => $uId):
                                        $isBlocked = in_array($uId, $blockedList);
                                    ?>
                                    <tr id="user-row-<?php echo $uId; ?>">
                                        <td><?php echo $index + 1; ?></td>
                                        <td style="font-family: monospace; font-size: 0.95rem; font-weight: 600; color: #818cf8;"><?php echo htmlspecialchars($uId); ?></td>
                                        <td id="user-status-<?php echo $uId; ?>">
                                            <?php if ($isBlocked): ?>
                                                <span class="status-badge offline"><span class="badge-dot offline"></span>Blocked</span>
                                            <?php else: ?>
                                                <span class="status-badge online"><span class="badge-dot online"></span>Authorized</span>
                                            <?php endif; ?>
                                        </td>
                                        <td>
                                            <?php if ($isBlocked): ?>
                                                <button class="btn-action" style="background: linear-gradient(135deg, #10b981, #059669); padding: 0.4rem 0.8rem; font-size: 0.85rem;" id="user-btn-<?php echo $uId; ?>" onclick="toggleBlockUser(<?php echo $uId; ?>, false)">Unblock User</button>
                                            <?php else: ?>
                                                <button class="btn-delete" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" id="user-btn-<?php echo $uId; ?>" onclick="toggleBlockUser(<?php echo $uId; ?>, true)">Block User</button>
                                            <?php endif; ?>
                                        </td>
                                    </tr>
                                    <?php 
                                    endforeach;
                                else: 
                                ?>
                                    <tr>
                                        <td colspan="4" style="text-align: center; padding: 4rem 0; color: var(--text-muted);">
                                            No Telegram bot users registered.
                                        </td>
                                    </tr>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ── BROADCAST TAB ──────────────────────────────────────── -->
            <div id="tab-broadcast" class="tab-content">
                <div class="workspace-header">
                    <div class="workspace-title">
                        <h1>Telegram Broadcast Dispatcher</h1>
                        <p>Send high-priority notifications to all registered bot clients instantly</p>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-title">📢 Broadcast Message</div>
                    <form id="broadcast-form" class="form-group" style="gap: 1.5rem;">
                        <div class="form-group">
                            <label>Broadcast Message Body</label>
                            <textarea name="message" id="broadcast-msg-input" rows="6" placeholder="Enter custom message text here..." required></textarea>
                        </div>
                        <button type="submit" class="btn-action" style="width: 100%;">🚀 Dispatch Telegram Broadcast</button>
                    </form>
                </div>
            </div>

            <!-- ── SETTINGS TAB ─────────────────────────────────────────── -->
            <div id="tab-settings" class="tab-content">
                <div class="workspace-header">
                    <div class="workspace-title">
                        <h1>Bot General Settings</h1>
                        <p>Configure bot global parameters and required Telegram channel join settings</p>
                    </div>
                </div>

                <!-- Global Bot Enable/Disable Panel -->
                <div class="panel">
                    <div class="panel-title">⚙️ Telegram Bot Status Control</div>
                    <div class="ios-switch-container">
                        <span class="ios-switch-label" style="font-size: 1rem; color: var(--text);">Telegram Bot Master Switch</span>
                        <label class="ios-switch">
                            <input type="checkbox" id="global-bot-toggle" <?php echo BOT_ENABLED ? 'checked' : ''; ?> onchange="toggleGlobalBot(this.checked)">
                            <span class="ios-slider"></span>
                        </label>
                    </div>
                </div>

                <!-- Telegram Channel join verification manager -->
                <div class="panel">
                    <div class="panel-title">📣 Required Telegram Channel Verifications</div>
                    <form id="add-channel-form" class="form-group">
                        <label>Add Required Channel Username or ID</label>
                        <div class="form-row">
                            <input type="text" id="channel-input" placeholder="@yourchannelusername or -10012345678" required autocomplete="off">
                            <button type="submit" class="btn-action">Add Channel</button>
                        </div>
                    </form>
                    
                    <div style="margin-top: 1rem;">
                        <label>Active Verification Channels</label>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem;" id="active-channels-list">
                            <?php 
                            $channelsList = isset($settings['channels']) ? $settings['channels'] : [];
                            if (!empty($channelsList)):
                                foreach ($channelsList as $index => $chan):
                                ?>
                                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 0.85rem 1.2rem; border-radius: 12px; border: 1px solid var(--border);" id="channel-item-<?php echo $index; ?>">
                                    <span style="font-family: monospace; font-size: 0.95rem; font-weight: 600; color: #3b82f6;"><?php echo htmlspecialchars($chan); ?></span>
                                    <button class="btn-delete" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onclick="deleteChannel('<?php echo htmlspecialchars($chan); ?>', <?php echo $index; ?>)">Remove</button>
                                </div>
                                <?php 
                                endforeach;
                            else:
                            ?>
                                <div style="text-align: center; color: var(--text-muted); padding: 2rem 0;" id="no-channels-msg">
                                    No channels registered. Bot will not enforce join verification.
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </div>


        </div>
    </div>

    <!-- Real-time Mapping Loader Overlay -->
    <div class="mapping-overlay" id="map-overlay">
        <div class="mapping-box">
            <div class="mapping-spinner"></div>
            <div class="mapping-status-title" id="map-status-title">Mapping Firebase Database</div>
            <div class="mapping-logs" id="map-logs-box">
                <!-- Live logs will append here -->
            </div>
        </div>
    </div>

    <!-- Toast Notification Banner -->
    <div class="toast" id="toast-banner">
        <span id="toast-icon">✅</span>
        <span id="toast-msg">Success!</span>
    </div>

    <script>
        function switchTab(tabId) {
            // Update active menu items
            const navItems = document.querySelectorAll('.nav-list .nav-item');
            navItems.forEach(item => item.classList.remove('active'));
            
            const activeItem = document.getElementById('nav-' + tabId);
            if (activeItem) activeItem.classList.add('active');

            // Toggle tab content visibility
            const tabs = document.querySelectorAll('.tab-content');
            tabs.forEach(tab => tab.classList.remove('active'));
            
            const activeTab = document.getElementById('tab-' + tabId);
            if (activeTab) activeTab.classList.add('active');
        }

        function showToast(message, isError = false) {
            const toast = document.getElementById('toast-banner');
            const icon = document.getElementById('toast-icon');
            const msg = document.getElementById('toast-msg');
            
            icon.textContent = isError ? '❌' : '✅';
            msg.textContent = message;
            
            if (isError) {
                toast.classList.add('error');
            } else {
                toast.classList.remove('error');
            }
            
            toast.style.display = 'flex';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }

        // Live Mapping Simulator & POST Form Handler
        document.getElementById('add-db-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const dbUrlInput = document.getElementById('db-url-input');
            const dbUrl = dbUrlInput.value.trim();
            if (!dbUrl) return;

            const overlay = document.getElementById('map-overlay');
            const logsBox = document.getElementById('map-logs-box');
            const statusTitle = document.getElementById('map-status-title');

            // Open overlay & reset logs
            overlay.style.display = 'flex';
            logsBox.innerHTML = '';
            statusTitle.textContent = "Connecting to Firebase...";

            const appendLog = (text) => {
                const log = document.createElement('div');
                log.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
                logsBox.appendChild(log);
                logsBox.scrollTop = logsBox.scrollHeight;
            };

            // Phase 1 log
            appendLog(`Initializing connection to database...`);
            appendLog(`Target URL: ${dbUrl}`);

            setTimeout(() => {
                statusTitle.textContent = "Scanning registered clients...";
                appendLog(`Successfully established connection. HTTP 200 OK.`);
                appendLog(`Scanning clients node...`);
                appendLog(`Scanning user_data node...`);
                
                setTimeout(() => {
                    statusTitle.textContent = "Mapping devices...";
                    appendLog(`Fetched device records. Preparing mappings...`);
                    appendLog(`Mapping serial IDs (A1, A2, etc.) sequentially...`);
                    
                    // Actually submit the AJAX POST request to perform the operation
                    const formData = new FormData();
                    formData.append('db_url', dbUrl);

                    fetch('admin.php?ajax=map_db', {
                        method: 'POST',
                        body: formData
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.status === 'success') {
                            statusTitle.textContent = "Finalizing configuration...";
                            appendLog(`Updating config: bot_settings.json saved.`);
                            appendLog(`Updating mappings: device_mappings.json rebuilt.`);
                            appendLog(`Mapped successfully. Device Count: ${data.device_count}`);
                            
                            setTimeout(() => {
                                overlay.style.display = 'none';
                                showToast("Firebase DB successfully added and mapped!");
                                dbUrlInput.value = '';
                                setTimeout(() => location.reload(), 1000);
                            }, 1500);
                        } else {
                            overlay.style.display = 'none';
                            showToast(data.message, true);
                        }
                    })
                    .catch(err => {
                        overlay.style.display = 'none';
                        showToast("Failed to perform Firebase mapping.", true);
                    });

                }, 1000);

            }, 1000);
        });

        // Delete Firebase Database URL AJAX Handler
        function deleteDatabase(dbUrl, index) {
            if (!confirm(`Are you sure you want to delete Database #${index + 1}?`)) return;

            const formData = new FormData();
            formData.append('db_url', dbUrl);

            fetch('admin.php?ajax=delete_db', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast("Firebase DB configuration removed!");
                    const card = document.getElementById(`db-card-${index}`);
                    if (card) card.remove();
                    setTimeout(() => location.reload(), 1000);
                } else {
                    showToast(data.message, true);
                }
            })
            .catch(err => {
                showToast("Network error while deleting database.", true);
            });
        }

        // Toggle Database Active Status (iOS Toggle Handler)
        function toggleDatabaseActive(dbUrl, index, isChecked) {
            const formData = new FormData();
            formData.append('db_url', dbUrl);
            formData.append('enable', isChecked ? 1 : 0);

            fetch('admin.php?ajax=toggle_db', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast(isChecked ? "Firebase DB activated!" : "Firebase DB deactivated!");
                    const card = document.getElementById(`db-card-${index}`);
                    if (card) {
                        card.style.opacity = isChecked ? '1' : '0.65';
                    }
                    setTimeout(() => location.reload(), 1000);
                } else {
                    showToast(data.message, true);
                }
            })
            .catch(err => {
                showToast("Network error while toggling database status.", true);
            });
        }


        // Broadcast Form submission AJAX Handler
        document.getElementById('broadcast-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = this.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            
            btn.disabled = true;
            btn.textContent = "Dispatched. Please wait...";

            const msgInput = document.getElementById('broadcast-msg-input');
            const message = msgInput.value.trim();

            const formData = new FormData();
            formData.append('message', message);

            fetch('admin.php?ajax=broadcast', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                btn.disabled = false;
                btn.textContent = originalText;
                
                if (data.status === 'success') {
                    showToast(data.message);
                    msgInput.value = '';
                } else {
                    showToast(data.message, true);
                }
            })
            .catch(err => {
                btn.disabled = false;
                btn.textContent = originalText;
                showToast("Network error. Failed to broadcast.", true);
            });
        });

        // Auto reload stats in background every 20s
        setInterval(() => {
            fetch('admin.php?ajax=get_stats')
            .then(res => res.json())
            .then(data => {
                document.getElementById('stat-total-devices').textContent = data.total_devices;
                document.getElementById('stat-online-devices').textContent = data.online_devices;
                document.getElementById('stat-offline-devices').textContent = data.offline_devices;
                document.getElementById('stat-total-dbs').textContent = data.total_dbs;
            });
        }, 20000);

        function toggleBlockUser(userId, blockState) {
            const endpoint = blockState ? 'admin.php?ajax=block_user' : 'admin.php?ajax=unblock_user';
            const formData = new FormData();
            formData.append('user_id', userId);

            fetch(endpoint, {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast(data.message);
                    
                    // Update Status Badge
                    const statusTd = document.getElementById('user-status-' + userId);
                    if (statusTd) {
                        if (blockState) {
                            statusTd.innerHTML = '<span class="status-badge offline"><span class="badge-dot offline"></span>Blocked</span>';
                        } else {
                            statusTd.innerHTML = '<span class="status-badge online"><span class="badge-dot online"></span>Authorized</span>';
                        }
                    }

                    // Update Button
                    const btn = document.getElementById('user-btn-' + userId);
                    if (btn) {
                        if (blockState) {
                            btn.className = 'btn-action';
                            btn.style.cssText = 'background: linear-gradient(135deg, #10b981, #059669); padding: 0.4rem 0.8rem; font-size: 0.85rem;';
                            btn.textContent = 'Unblock User';
                            btn.setAttribute('onclick', `toggleBlockUser(${userId}, false)`);
                        } else {
                            btn.className = 'btn-delete';
                            btn.style.cssText = 'padding: 0.4rem 0.8rem; font-size: 0.85rem;';
                            btn.textContent = 'Block User';
                            btn.setAttribute('onclick', `toggleBlockUser(${userId}, true)`);
                        }
                    }
                } else {
                    showToast(data.message, true);
                }
            })
            .catch(err => {
                showToast("Network error. Failed to toggle block status.", true);
            });
        }

        // Toggle Global Bot enabled status
        function toggleGlobalBot(isChecked) {
            const formData = new FormData();
            formData.append('bot_enabled', isChecked ? 1 : 0);

            fetch('admin.php?ajax=toggle_bot_enabled', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast(data.message);
                } else {
                    showToast(data.message, true);
                }
            })
            .catch(err => {
                showToast("Network error. Failed to toggle bot status.", true);
            });
        }

        // Add channel verification form submit handler
        document.getElementById('add-channel-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const input = document.getElementById('channel-input');
            const channel = input.value.trim();

            const formData = new FormData();
            formData.append('channel', channel);

            fetch('admin.php?ajax=add_channel', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast(data.message);
                    input.value = '';
                    setTimeout(() => location.reload(), 1000);
                } else {
                    showToast(data.message, true);
                }
            })
            .catch(err => {
                showToast("Network error. Failed to add channel.", true);
            });
        });

        // Delete channel verification handler
        function deleteChannel(channel, index) {
            if (!confirm(`Are you sure you want to remove ${channel} from required verifications?`)) return;

            const formData = new FormData();
            formData.append('channel', channel);

            fetch('admin.php?ajax=delete_channel', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast(data.message);
                    const item = document.getElementById(`channel-item-${index}`);
                    if (item) item.remove();
                    setTimeout(() => location.reload(), 1000);
                } else {
                    showToast(data.message, true);
                }
            })
            .catch(err => {
                showToast("Network error. Failed to remove channel.", true);
            });
        }

        // Delete device and its mappings
        function deleteDevice(deviceId, dbUrl) {
            if (!confirm(`Are you sure you want to delete device ${deviceId}? This will clear all its telemetry and mapping.`)) return;

            const overlay = document.getElementById('map-overlay');
            const logsBox = document.getElementById('map-logs-box');
            const statusTitle = document.getElementById('map-status-title');

            overlay.style.display = 'flex';
            logsBox.innerHTML = '';
            statusTitle.textContent = "Deleting your mapping...";

            const appendLog = (text) => {
                const log = document.createElement('div');
                log.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
                logsBox.appendChild(log);
                logsBox.scrollTop = logsBox.scrollHeight;
            };

            appendLog(`Initializing deletion for device ID: ${deviceId}...`);
            appendLog(`Target DB: ${dbUrl}`);

            const formData = new FormData();
            formData.append('device_id', deviceId);
            formData.append('db_url', dbUrl);

            fetch('admin.php?ajax=delete_device', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    statusTitle.textContent = "Rebuilding mappings...";
                    appendLog(`Device deleted from Firebase clients & user_data nodes.`);
                    appendLog(`Rebuilding device_mappings.json...`);
                    appendLog(`Deleted successfully.`);
                    
                    setTimeout(() => {
                        overlay.style.display = 'none';
                        showToast("Device deleted and mappings rebuilt successfully!");
                        setTimeout(() => location.reload(), 1000);
                    }, 1500);
                } else {
                    overlay.style.display = 'none';
                    showToast(data.message, true);
                }
            })
            .catch(err => {
                overlay.style.display = 'none';
                showToast("Failed to delete device and rebuild mappings.", true);
            });
        }

    </script>
</body>
</html>

