<?php
/**
 * Plugin Name: Admin Video Instructions
 * Description: Видеоматериалы для обучения — страница инструкции в админке WordPress.
 * Version: 1.1.0
 * Author: Allvisio
 * License: GPL v2 or later
 * Text Domain: my-instruction-plugin
 */

if (!defined('ABSPATH')) {
    exit;
}

// ─── Константы путей ──────────────────────────────────────────────
define('INSTR_PLUGIN_VERSION', '1.1.0');
define('INSTR_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('INSTR_PLUGIN_URL', plugin_dir_url(__FILE__));

// Подключаем основной файл функций
require_once INSTR_PLUGIN_DIR . 'includes/functions.php';

// ─── Activation / Deactivation hooks ──────────────────────────────

register_activation_hook(__FILE__, 'instr_activate_plugin');
register_deactivation_hook(__FILE__, 'instr_deactivate_plugin');

/**
 * Активация плагина: проверяем PHP и создаём данные по умолчанию.
 */
function instr_activate_plugin() {
    if (version_compare(PHP_VERSION, '7.4', '<')) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die(
            esc_html__('Admin Video Instructions требует PHP 7.4 или выше.', 'my-instruction-plugin'),
            esc_html__('Ошибка активации', 'my-instruction-plugin'),
            ['back_link' => true]
        );
    }
    // Инициализируем данные по умолчанию (сработает миграция в instr_get_data)
    instr_get_data();
    flush_rewrite_rules();
}

/**
 * Деактивация плагина: очистка transient.
 */
function instr_deactivate_plugin() {
    delete_transient('instr_videos_saved');
}
