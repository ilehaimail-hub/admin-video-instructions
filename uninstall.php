<?php
/**
 * Uninstall hook — очистка данных при удалении плагина.
 */
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('my_custom_videos');
delete_option('instr_categories');

// Удаляем user meta всех пользователей одним запросом через DELETE
global $wpdb;
$wpdb->delete($wpdb->usermeta, ['meta_key' => 'video_controls_visibility'], ['%s']); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
