<?php
if (!defined('ABSPATH')) {
    exit;
}

// ═══════════════════════════════════════════════════════════
//  Admin Video Instructions — Core Functions
// ═══════════════════════════════════════════════════════════

/** @var array SVG-иконки плагина */
const INSTR_ICONS = [
    'edit'   => '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    'check'  => '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    'plus'   => '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    'upload' => '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>',
    'trash'  => '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
    'film'   => '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>',
    'book'   => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    'folder' => '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    'pencil' => '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
];

function instr_svg($name) {
    return INSTR_ICONS[$name] ?? '';
}

/** Версия ассетов: меняется вместе с версией плагина. */
function instr_asset_version() {
    return defined('INSTR_PLUGIN_VERSION') ? INSTR_PLUGIN_VERSION : '1.0.0';
}

/** Проверка прав администратора */
function instr_is_admin() {
    return current_user_can('manage_options');
}

/** Общий guard для AJAX-хуков: права + nonce */
function instr_ajax_guard() {
    if (!instr_is_admin()) {
        wp_send_json_error(['message' => esc_html__('Доступ запрещён.', 'my-instruction-plugin')], 403);
    }

    check_ajax_referer('instr_ajax_nonce', 'nonce');
}

/** Стандартная категория по умолчанию (кэшируем в статике) */
function instr_default_cat() {
    static $cat = null;
    return $cat ??= esc_html__('Общее', 'my-instruction-plugin');
}

/** Безопасное имя категории: пригодно и для HTML name="cat_videos[category]". */
function instr_sanitize_category_name($name) {
    $name = sanitize_text_field(wp_unslash($name));
    $name = preg_replace('/[\[\]<>"\']+/', '', $name);
    return trim((string) $name);
}

/** Нормализация одного видео. */
function instr_sanitize_video($video) {
    $video = is_array($video) ? $video : [];

    return [
        'title' => sanitize_text_field(wp_unslash($video['title'] ?? '')),
        'url'   => esc_url_raw(wp_unslash($video['url'] ?? '')),
    ];
}

/** Приведение данных к единой структуре. */
function instr_normalize_data($data) {
    $def        = instr_default_cat();
    $categories = [];
    $videos     = [];

    foreach ((array) ($data['categories'] ?? []) as $category) {
        $category = instr_sanitize_category_name($category);
        if ($category === '') {
            continue;
        }
        if (!in_array($category, $categories, true)) {
            $categories[] = $category;
        }
    }

    if (!$categories) {
        $categories[] = $def;
    }

    foreach ($categories as $category) {
        $videos[$category] = [];
        foreach ((array) ($data['videos'][$category] ?? []) as $video) {
            $clean_video = instr_sanitize_video($video);
            $videos[$category][] = $clean_video;
        }
    }

    return [
        'categories' => $categories,
        'videos'     => $videos,
    ];
}

/** Проверка дубликата категории (нечувствительно к регистру) */
function instr_cat_exists($categories, $name, $exclude = '') {
    $lower = function_exists('mb_strtolower') ? mb_strtolower($name) : strtolower($name);
    foreach ($categories as $c) {
        $category_lower = function_exists('mb_strtolower') ? mb_strtolower($c) : strtolower($c);
        if ($c !== $exclude && $category_lower === $lower) return true;
    }
    return false;
}

// ─── Данные категорий с миграцией ──────────────────────────────

function instr_get_data() {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }

    $data = get_option('instr_categories', null);
    $def  = instr_default_cat();

    // Миграция из старого формата (одноразовая)
    if ($data === null) {
        $old = get_option('my_custom_videos');
        $old = is_array($old) ? $old : [];
        $data = [
            'categories' => [$def],
            'videos'     => [$def => !empty($old) ? $old : []],
        ];
        $data = instr_normalize_data($data);
        update_option('instr_categories', $data, false);
    }

    $cached = instr_normalize_data(is_array($data) ? $data : []);
    return $cached;
}

/** Сброс статического кэша данных (вызывается после изменения данных). */
function instr_invalidate_cache() {
    // Сбрасываем статику через反射: присваиваем null статической переменной
    static $reset = true;
    $reset = false;
    // Простой способ: вызываем instr_get_data с принудительным сбросом
    $ref = new \ReflectionFunction('instr_get_data');
    // Не используем reflection — вместо этого просто перезаписываем опцию
    // и полагаемся на то, что следующий вызов прочитает свежие данные.
    // Статический кэш сбрасывается при следующем HTTP-запросе.
}

function instr_get_categories() {
    return instr_get_data()['categories'];
}

function instr_get_category_videos($category) {
    $data = instr_get_data();
    return $data['videos'][$category] ?? [];
}

/** Разрешенный HTML для встроенных SVG-иконок. */
function instr_svg_allowed_html() {
    return [
        'svg'      => ['width' => true, 'height' => true, 'viewbox' => true, 'viewBox' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true, 'stroke-linecap' => true, 'stroke-linejoin' => true, 'xmlns' => true, 'aria-hidden' => true, 'focusable' => true],
        'path'     => ['d' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true, 'stroke-linecap' => true, 'stroke-linejoin' => true],
        'polyline' => ['points' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true, 'stroke-linecap' => true, 'stroke-linejoin' => true],
        'line'     => ['x1' => true, 'y1' => true, 'x2' => true, 'y2' => true, 'stroke' => true, 'stroke-width' => true, 'stroke-linecap' => true],
        'rect'     => ['x' => true, 'y' => true, 'width' => true, 'height' => true, 'rx' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true],
        'circle'   => ['cx' => true, 'cy' => true, 'r' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true],
    ];
}

function instr_svg_kses($name) {
    return wp_kses(instr_svg($name), instr_svg_allowed_html());
}

// ─── Admin Bar кнопка ──────────────────────────────────────

function instr_admin_bar_menu($wp_admin_bar) {
    if (!instr_is_admin()) return;
    $wp_admin_bar->add_node([
        'id'     => 'custom-instruction',
        'title'  => esc_html__('Инструкция', 'my-instruction-plugin'),
        'href'   => admin_url('admin.php?page=my-custom-instruction-page'),
        'meta'   => ['class' => 'instr-admin-bar-btn'],
    ]);
}
add_action('admin_bar_menu', 'instr_admin_bar_menu', 999);

function instr_admin_bar_css() {
    ?>
    <style>
        #wp-admin-bar-custom-instruction > a {
            background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
            border-radius: 6px; margin: 0 4px;
        }
        #wp-admin-bar-custom-instruction > a:hover { opacity: .9; }
    </style>
    <?php
}
add_action('admin_head', 'instr_admin_bar_css');

// ─── Страница в меню ──────────────────────────────────────

function my_custom_admin_page() {
    $label = esc_html__('Инструкция', 'my-instruction-plugin');
    add_menu_page($label, $label, 'manage_options', 'my-custom-instruction-page', 'my_custom_instruction_page_content', 'dashicons-welcome-learn-more', 99);
}
add_action('admin_menu', 'my_custom_admin_page');

function my_custom_instruction_page_content() {
    if (!instr_is_admin()) return;
    require INSTR_PLUGIN_DIR . 'admin/page-instruction.php';
}

// ─── Стили, скрипты и медиабиблиотека ──────────────────────

function load_wp_media_files($page) {
    if ($page !== 'toplevel_page_my-custom-instruction-page') return;

    wp_enqueue_media();
    wp_enqueue_script('jquery-ui-sortable');
    wp_enqueue_style('instr-admin-css', INSTR_PLUGIN_URL . 'assets/css/instruction.css', [], instr_asset_version());
    wp_enqueue_script('instr-admin-js', INSTR_PLUGIN_URL . 'assets/js/instruction-admin.js', ['jquery', 'jquery-ui-sortable'], instr_asset_version(), true);

    $data = instr_get_data();
    $max_index = 0;
    foreach ($data['videos'] as $v) {
        $c = count($v);
        if ($c > $max_index) $max_index = $c;
    }

    // Собираем все SVG за один проход
    $svgs = [];
    foreach (['film','upload','trash','edit','check','folder','pencil','plus'] as $n) {
        $svgs[$n . '_svg'] = instr_svg($n);
    }
    // done_svg — алиас для check_svg (используется в JS toggle-кнопке)
    $svgs['done_svg'] = instr_svg('check');

    wp_localize_script('instr-admin-js', 'instrAdminVars', array_merge($svgs, [
        'video_index'      => $max_index,
        'ajax_url'         => admin_url('admin-ajax.php'),
        'nonce'            => wp_create_nonce('instr_ajax_nonce'),
        'upload_nonce'     => wp_create_nonce('media-form'),
        'default_title'    => esc_html__('Заголовок видео', 'my-instruction-plugin'),
        'edit_hint'        => esc_html__('двойной клик — изменить', 'my-instruction-plugin'),
        'no_video'         => esc_html__('Видео не загружено', 'my-instruction-plugin'),
        'upload_btn'       => esc_html__('Загрузить видео', 'my-instruction-plugin'),
        'remove_btn'       => esc_html__('Удалить', 'my-instruction-plugin'),
        'select_video_title'=> esc_html__('Выберите видео', 'my-instruction-plugin'),
        'select_video_btn' => esc_html__('Выберите видео', 'my-instruction-plugin'),
        'confirm_remove'   => esc_html__('Удалить это видео?', 'my-instruction-plugin'),
        'fallback_text'    => esc_html__('Ваш браузер не поддерживает воспроизведение видео.', 'my-instruction-plugin'),
        'edit_label'       => esc_html__('Редактировать', 'my-instruction-plugin'),
        'done_label'       => esc_html__('Готово', 'my-instruction-plugin'),
        'categories'       => array_values($data['categories']),
        'add_cat_label'    => esc_html__('Новая категория', 'my-instruction-plugin'),
        'confirm_remove_cat'=> esc_html__('Удалить категорию и все её видео?', 'my-instruction-plugin'),
        'no_videos_in_cat' => esc_html__('Нет видео — нажмите «Добавить видео», чтобы начать', 'my-instruction-plugin'),
        'add_video_label'  => esc_html__('Добавить видео', 'my-instruction-plugin'),
        'save_label'       => esc_html__('Сохранить', 'my-instruction-plugin'),
        'invalid_video'    => esc_html__('Пожалуйста, выберите видеофайл.', 'my-instruction-plugin'),
    ]));
}
add_action('admin_enqueue_scripts', 'load_wp_media_files');

// ─── Admin notice после сохранения ─────────────────────────

function instr_saving_notice() {
    if (!get_transient('instr_videos_saved') || !instr_is_admin()) return;
    delete_transient('instr_videos_saved');
    ?>
    <div class="notice notice-success is-dismissible">
        <p><?php esc_html_e('Видео успешно сохранены.', 'my-instruction-plugin'); ?></p>
    </div>
    <?php
}
add_action('admin_notices', 'instr_saving_notice');

// ─── Сохранение видео с категориями ────────────────────────

function save_my_custom_videos_options() {
    if (!isset($_POST['save_videos'])) return;
    if (!instr_is_admin()) wp_die(esc_html__('Доступ запрещён.', 'my-instruction-plugin'));
    check_admin_referer('instr_save_videos', 'instr_nonce');

    $posted_categories = isset($_POST['categories']) && is_array($_POST['categories']) ? wp_unslash($_POST['categories']) : [];
    $cleaned_cats      = [];

    foreach ($posted_categories as $category) {
        $category = instr_sanitize_category_name($category);
        if (!in_array($category, $cleaned_cats, true)) {
            $cleaned_cats[] = $category;
        }
    }

    if (!$cleaned_cats) {
        $cleaned_cats[] = instr_default_cat();
    }

    $cleaned_vids = [];
    $posted_videos = isset($_POST['cat_videos']) && is_array($_POST['cat_videos']) ? wp_unslash($_POST['cat_videos']) : [];
    if (is_array($posted_videos)) {
        foreach ($posted_videos as $slug => $list) {
            $key = instr_sanitize_category_name($slug);
            $cleaned_vids[$key] = [];
            if (!is_array($list)) continue;
            foreach ($list as $i => $v) {
                $cleaned_vids[$key][(int) $i] = instr_sanitize_video($v);
            }
            ksort($cleaned_vids[$key]);
            $cleaned_vids[$key] = array_values($cleaned_vids[$key]);
        }
    }

    foreach ($cleaned_cats as $category) {
        $cleaned_vids[$category] = $cleaned_vids[$category] ?? [];
    }

    update_option('instr_categories', instr_normalize_data(['categories' => $cleaned_cats, 'videos' => $cleaned_vids]), false);
    set_transient('instr_videos_saved', true, 30);
}
add_action('admin_init', 'save_my_custom_videos_options');

// ─── AJAX: управление категориями ──────────────────────────

function instr_ajax_add_category() {
    instr_ajax_guard();
    $name = instr_sanitize_category_name($_POST['cat_name'] ?? '');
    if ($name === '') wp_send_json_error(['message' => esc_html__('Укажите название категории.', 'my-instruction-plugin')], 400);

    $data = instr_get_data();
    if (instr_cat_exists($data['categories'], $name)) {
        wp_send_json_error(['message' => esc_html__('Категория с таким именем уже существует.', 'my-instruction-plugin')]);
    }

    $data['categories'][] = $name;
    $data['videos'][$name] = [];
    update_option('instr_categories', instr_normalize_data($data), false);
    wp_send_json_success(['category' => $name, 'index' => count($data['categories']) - 1]);
}
add_action('wp_ajax_instr_add_category', 'instr_ajax_add_category');

function instr_ajax_remove_category() {
    instr_ajax_guard();
    $name = instr_sanitize_category_name($_POST['cat_name'] ?? '');
    if ($name === '') wp_send_json_error(['message' => esc_html__('Категория не найдена.', 'my-instruction-plugin')], 404);

    $data = instr_get_data();
    if (count($data['categories']) <= 1) {
        wp_send_json_error(['message' => esc_html__('Нельзя удалить последнюю категорию.', 'my-instruction-plugin')]);
    }

    $key = array_search($name, $data['categories']);
    if ($key === false) {
        wp_send_json_error(['message' => esc_html__('Категория не найдена.', 'my-instruction-plugin')], 404);
    }

    array_splice($data['categories'], $key, 1);
    unset($data['videos'][$name]);
    update_option('instr_categories', instr_normalize_data($data), false);
    wp_send_json_success();
}
add_action('wp_ajax_instr_remove_category', 'instr_ajax_remove_category');

function instr_ajax_rename_category() {
    instr_ajax_guard();
    $old = instr_sanitize_category_name($_POST['old_name'] ?? '');
    $new = instr_sanitize_category_name($_POST['new_name'] ?? '');
    if ($old === '' || $new === '') wp_send_json_error(['message' => esc_html__('Укажите название категории.', 'my-instruction-plugin')], 400);

    $data = instr_get_data();
    if (instr_cat_exists($data['categories'], $new, $old)) {
        wp_send_json_error(['message' => esc_html__('Категория с таким именем уже существует.', 'my-instruction-plugin')]);
    }

    $key = array_search($old, $data['categories']);
    if ($key === false) {
        wp_send_json_error(['message' => esc_html__('Категория не найдена.', 'my-instruction-plugin')], 404);
    }

    $data['categories'][$key] = $new;
    if (isset($data['videos'][$old])) {
        $data['videos'][$new] = $data['videos'][$old];
        unset($data['videos'][$old]);
    }

    update_option('instr_categories', instr_normalize_data($data), false);
    wp_send_json_success(['category' => $new]);
}
add_action('wp_ajax_instr_rename_category', 'instr_ajax_rename_category');

// ─── AJAX: видимость контролов ─────────────────────────────

function save_video_controls_visibility() {
    instr_ajax_guard();
    $state = sanitize_key(wp_unslash($_POST['state'] ?? ''));
    $state = in_array($state, ['show', 'hide'], true) ? $state : 'show';

    update_user_meta(get_current_user_id(), 'video_controls_visibility', $state);
    wp_send_json_success(['state' => $state]);
}
add_action('wp_ajax_save_video_controls_visibility', 'save_video_controls_visibility');

function get_video_controls_visibility() {
    instr_ajax_guard();
    $state = sanitize_key(get_user_meta(get_current_user_id(), 'video_controls_visibility', true));
    $state = in_array($state, ['show', 'hide'], true) ? $state : 'show';

    wp_send_json_success(['state' => $state]);
}
add_action('wp_ajax_get_video_controls_visibility', 'get_video_controls_visibility');
