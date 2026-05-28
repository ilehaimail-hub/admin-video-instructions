<?php
/**
 * Plugin Name: Admin Video Instructions
 * Description: Видеоматериалы для обучения — страница инструкции в админке WordPress.
 * Version: 1.0.1
 * Author: Allvisio
 * License: GPL v2 or later
 * Text Domain: my-instruction-plugin
 */

if (!defined('ABSPATH')) {
    exit;
}

// ─── Константы путей ──────────────────────────────────────────────
define('INSTR_PLUGIN_VERSION', '1.0.1');
define('INSTR_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('INSTR_PLUGIN_URL', plugin_dir_url(__FILE__));

// Подключаем основной файл функций
require_once INSTR_PLUGIN_DIR . 'includes/functions.php';
