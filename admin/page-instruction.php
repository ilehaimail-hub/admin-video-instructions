<?php
if (!defined('ABSPATH')) {
    exit;
}

$data       = instr_get_data();
$categories = $data['categories'];
$videos     = $data['videos'];

/**
 * Определение внешнего видео (YouTube/Vimeo) и рендеринг превью.
 */
function instr_render_video_preview($url) {
    if (empty($url)) return '';

    // YouTube
    if (preg_match('/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/', $url, $yt)) {
        return '<div class="video-embed-responsive"><iframe src="https://www.youtube.com/embed/'
            . esc_attr($yt[1]) . '?rel=0" frameborder="0" allowfullscreen'
            . ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>';
    }

    // Vimeo
    if (preg_match('/vimeo\.com\/(?:video\/)?(\d+)/', $url, $vm)) {
        return '<div class="video-embed-responsive"><iframe src="https://player.vimeo.com/video/'
            . esc_attr($vm[1]) . '" frameborder="0" allowfullscreen></iframe></div>';
    }

    // Локальное видео
    return '<video width="620" height="340" controls preload="none"><source src="'
        . esc_url($url) . '" type="video/mp4">'
        . esc_html__('Ваш браузер не поддерживает воспроизведение видео.', 'my-instruction-plugin')
        . '</video>';
}
?>
<div class="instr-wrap">

    <div class="instr-header">
        <div class="instr-header__left">
            <div class="instr-header__icon"><?php echo instr_svg_kses('book'); ?></div>
            <div>
                <h1 class="instr-title"><?php esc_html_e( 'Инструкция', 'my-instruction-plugin' ); ?></h1>
                <p class="instr-subtitle"><?php esc_html_e( 'Видеоматериалы для обучения', 'my-instruction-plugin' ); ?></p>
            </div>
        </div>
        <div class="instr-header__right">
            <button type="button" id="edit_videos" class="btn btn--ghost">
                <?php echo instr_svg_kses('edit'); ?> <span><?php esc_html_e( 'Редактировать', 'my-instruction-plugin' ); ?></span>
            </button>
        </div>
    </div>

    <!-- ─── Табы категорий ───────────────────────────────────── -->
    <div class="instr-tabs">
        <div class="instr-tabs__list" id="categories_tabs">
            <?php foreach ($categories as $index => $cat): ?>
                <div class="instr-tab<?php echo $index === 0 ? ' instr-tab--active' : '' ?>" data-category="<?php echo esc_attr($cat); ?>">
                    <?php if ($index > 0): ?>
                    <span class="instr-tab__icon"><?php echo instr_svg_kses('folder'); ?></span>
                    <?php endif; ?>
                    <span class="instr-tab__name"><?php echo esc_html($cat); ?></span>
                    <?php
                        $count = isset($videos[$cat]) ? count($videos[$cat]) : 0;
                    ?>
                    <span class="instr-tab__count"><?php echo esc_html((string) $count); ?></span>
                    <!-- Кнопки управления (видны в режиме редактирования) -->
                    <div class="instr-tab__actions">
                        <button type="button" class="instr-tab__rename" title="<?php esc_attr_e('Переименовать', 'my-instruction-plugin'); ?>">
                            <?php echo instr_svg_kses('pencil'); ?>
                        </button>
                        <?php if (count($categories) > 1): ?>
                        <button type="button" class="instr-tab__remove" title="<?php esc_attr_e('Удалить категорию', 'my-instruction-plugin'); ?>">
                            <?php echo instr_svg_kses('trash'); ?>
                        </button>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endforeach; ?>
            <div class="instr-tab instr-tab--add" id="add_category_btn">
                <span class="instr-tab__icon"><?php echo instr_svg_kses('plus'); ?></span>
                <span class="instr-tab__name"><?php esc_html_e( 'Добавить', 'my-instruction-plugin' ); ?></span>
            </div>
        </div>
    </div>

    <!-- ─── Контент по категориям ────────────────────────────── -->
    <form method="post" action="">
        <?php wp_nonce_field('instr_save_videos', 'instr_nonce'); ?>

        <?php foreach ($categories as $index => $cat): ?>
            <?php
                $cat_videos = isset($videos[$cat]) ? $videos[$cat] : array();
                if (!is_array($cat_videos)) $cat_videos = array();
                $is_active  = ($index === 0) ? 'active' : '';
            ?>
            <div class="instr-cat-panel <?php echo $is_active; ?>" data-category="<?php echo esc_attr($cat); ?>">

                <!-- Скрытые поля для отправки категорий -->
                <input type="hidden" name="categories[<?php echo $index; ?>]" value="<?php echo esc_attr($cat); ?>"/>

                <div class="instr-cat-container" id="container_<?php echo esc_attr(sanitize_title($cat)); ?>" data-empty-text="<?php esc_attr_e( 'Нет видео — нажмите «Добавить видео», чтобы начать', 'my-instruction-plugin' ); ?>">
                    <?php foreach ($cat_videos as $v_idx => $video): ?>
                        <div class="video-entry">
                            <div class="video-entry__header">
                                <div class="video-entry__drag" aria-hidden="true">
                                    <?php echo wp_kses('<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="4" r="1.3"/><circle cx="11" cy="4" r="1.3"/><circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/><circle cx="5" cy="12" r="1.3"/><circle cx="11" cy="12" r="1.3"/></svg>', instr_svg_allowed_html()); ?>
                                </div>
                                <button type="button" class="video-entry__save" title="<?php esc_attr_e( 'Сохранить', 'my-instruction-plugin' ); ?>" style="display:none;"><?php echo instr_svg_kses('check'); ?></button>
                                <h3 contenteditable="false" class="editable-title" data-index="<?php echo esc_attr($v_idx); ?>" data-category="<?php echo esc_attr($cat); ?>">
                                    <?php echo esc_html($video['title']); ?>
                                </h3>
                                <input type="hidden" data-field="title" name="cat_videos[<?php echo esc_attr($cat); ?>][<?php echo esc_attr($v_idx); ?>][title]" value="<?php echo esc_attr($video['title']); ?>"/>
                                <input type="hidden" data-field="url" name="cat_videos[<?php echo esc_attr($cat); ?>][<?php echo esc_attr($v_idx); ?>][url]" value="<?php echo esc_url($video['url']); ?>"/>
                                <span class="editable-hint"><?php esc_html_e( 'двойной клик — изменить', 'my-instruction-plugin' ); ?></span>
                            </div>

                            <div class="video_preview">
                                <?php if ($video['url']): ?>
                                    <?php echo instr_render_video_preview($video['url']); ?>
                                <?php else: ?>
                                    <div class="video-empty"><?php echo instr_svg_kses('film'); ?><p><?php esc_html_e( 'Видео не загружено', 'my-instruction-plugin' ); ?></p></div>
                                <?php endif; ?>
                            </div>

                            <div class="video_controls">
                                <button type="button" class="btn btn--upload upload_video_button"><?php echo instr_svg_kses('upload'); ?> <?php esc_html_e( 'Загрузить видео', 'my-instruction-plugin' ); ?></button>
                                <button type="button" class="btn btn--ghost paste_url_button">🔗 <?php esc_html_e( 'URL', 'my-instruction-plugin' ); ?></button>
                                <button type="button" class="btn btn--danger remove_video_button"><?php echo instr_svg_kses('trash'); ?> <?php esc_html_e( 'Удалить', 'my-instruction-plugin' ); ?></button>
                            </div>

                            <?php if (count($categories) > 1): ?>
                            <div class="video-move">
                                <span class="video-move__label"><?php esc_html_e('В категорию:', 'my-instruction-plugin'); ?> </span>
                                <div class="instr-dropdown" data-category="<?php echo esc_attr($cat); ?>">
                                    <button type="button" class="instr-dropdown__toggle">
                                        <span class="instr-dropdown__toggle-text"><?php echo esc_html($cat); ?></span>
                                        <span class="instr-dropdown__arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
                                    </button>
                                    <div class="instr-dropdown__menu">
                                        <?php foreach ($categories as $c): ?>
                                            <button type="button" class="instr-dropdown__item<?php echo $c === $cat ? ' is-active' : ''; ?>" data-value="<?php echo esc_attr($c); ?>">
                                                <span class="instr-dropdown__item-icon"><?php echo instr_svg_kses('folder'); ?></span>
                                                <?php echo esc_html($c); ?>
                                            </button>
                                        <?php endforeach; ?>
                                    </div>
                                </div>
                            </div>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>

                <div class="instr-cat-footer">
                    <button type="button" class="btn btn--add add_video_button" data-category="<?php echo esc_attr($cat); ?>"><?php echo instr_svg_kses('plus'); ?> <?php esc_html_e( 'Добавить видео', 'my-instruction-plugin' ); ?></button>
                    <button type="submit" name="save_videos" class="btn btn--primary save_cat_btn"><?php echo instr_svg_kses('check'); ?> <?php esc_html_e( 'Сохранить', 'my-instruction-plugin' ); ?></button>
                </div>

            </div>
        <?php endforeach; ?>


    </form>
</div>