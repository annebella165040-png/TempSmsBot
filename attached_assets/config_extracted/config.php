<?php
// Telegram Bot Credentials
define('BOT_TOKEN', '8721915738:AAEdVr0jzpqgnbgJ-38CbuAf0Co7mOVHCVs');
define('ADMIN_CHAT_ID', 5701858403);
define('TELEGRAM_API_BASE', 'https://api.telegram.org');

$settingsFile = __DIR__ . '/bot_settings.json';
$settings = [];

if (file_exists($settingsFile)) {
    $settings = json_decode(file_get_contents($settingsFile), true);
}

// Fallback settings if file load fails
if (empty($settings)) {
    $settings = [
        'bot_enabled' => true,
        'firebase_urls' => []
    ];
}

define('BOT_ENABLED', isset($settings['bot_enabled']) ? (bool)$settings['bot_enabled'] : true);
$allUrls = isset($settings['firebase_urls']) ? $settings['firebase_urls'] : [];
$disabledUrls = isset($settings['disabled_urls']) ? $settings['disabled_urls'] : [];
$firebaseUrls = [];
foreach ($allUrls as $url) {
    if (!in_array($url, $disabledUrls)) {
        $firebaseUrls[] = $url;
    }
}

