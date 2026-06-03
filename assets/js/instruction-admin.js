/** Admin Video Instructions — Admin Script */
(function($) {
    'use strict';

    // ════════════════════════════════════════════
    //  КОНСТАНТЫ И УТИЛИТЫ
    // ════════════════════════════════════════════

    var ANIMATION_DURATION = 350;
    var REMOVE_TIMEOUT = 400;
    var AJAX_THROTTLE_MS = 500;
    var lastAjaxTime = 0;

    /**
     * Безопасное создание SVG-элемента из строки через DOM-парсинг.
     * Предотвращает XSS-уязвимости при вставке SVG.
     */
    function createSvgElement(svgString) {
        var template = document.createElement('template');
        template.innerHTML = svgString.trim();
        return template.content.firstChild;
    }

    /**
     * Безопасная вставка SVG в jQuery-элемент.
     * Вместо .html() использует DOM-appendChild.
     */
    function appendSvg($element, svgString) {
        var svgEl = createSvgElement(svgString);
        if (svgEl) {
            $element.each(function() {
                this.appendChild(svgEl.cloneNode(true));
            });
        }
        return $element;
    }

    /**
     * Проверка MIME-типа файла — является ли видео.
     */
    function isVideoMimeType(mime) {
        return mime && mime.indexOf('video/') === 0;
    }

    /**
     * Формирование имени поля для формы отправки.
     */
    function videoFieldName(cat, idx, field) { return 'cat_videos[' + cat + '][' + idx + '][' + field + ']'; }

    /**
     * Парсинг URL внешних видео (YouTube, Vimeo).
     * Возвращает { type: 'youtube'|'vimeo'|null, id: '...', embedUrl: '...' } или null.
     */
    function parseExternalVideoUrl(url) {
        if (!url) return null;
        url = $.trim(url);

        // YouTube: various formats
        var yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (yt) {
            return { type: 'youtube', id: yt[1], embedUrl: 'https://www.youtube.com/embed/' + yt[1] + '?rel=0' };
        }

        // Vimeo
        var vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        if (vm) {
            return { type: 'vimeo', id: vm[1], embedUrl: 'https://player.vimeo.com/video/' + vm[1] };
        }

        return null;
    }

    /**
     * Создание DOM-элемента превью видео (локальное, YouTube или Vimeo).
     * Возвращает jQuery-обёрнутый элемент.
     */
    function renderVideoPreview(url) {
        var ext = parseExternalVideoUrl(url);
        if (ext) {
            var $wrapper = $('<div/>', { 'class': 'video-embed-responsive' });
            $('<iframe/>', {
                src: ext.embedUrl,
                frameborder: '0',
                allowfullscreen: true,
                allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
            }).appendTo($wrapper);
            return $wrapper;
        }
        // Локальное видео
        var $video = $('<video/>', { controls: true, preload: 'none' })
            .append($('<source/>', { src: url, type: 'video/mp4' }))
            .append(document.createTextNode(instrAdminVars.fallback_text));
        return $video;
    }

    /**
     * Установка видео в карточку (обновляет превью, hidden-поля и заголовок).
     */
    function setVideoInEntry($entry, url, title, cat) {
        var idx = $entry.find('.editable-title').data('index');
        if (!cat) cat = $entry.find('.editable-title').data('category');
        $entry.find('input[data-field="url"]').val(url).attr('name', videoFieldName(cat, idx, 'url'));
        $entry.find('.video_preview').empty().append(renderVideoPreview(url));
        if (title) {
            $entry.find('.editable-title').text(title);
            $entry.find('input[data-field="title"]').val(title).attr('name', videoFieldName(cat, idx, 'title'));
        }
    }

    $(function() {
        var $wrap = $('.instr-wrap');
        var $editBtn = $('#edit_videos');
        var isEditing = true;
        // Делаем доступными глобально для обработчиков, вешанных через $(document).on()
        window._instrAjaxUrl = instrAdminVars.ajax_url || window.ajaxurl;
        window._instrAjaxNonce = instrAdminVars.nonce || '';
        var ajaxUrl = window._instrAjaxUrl;
        var ajaxNonce = window._instrAjaxNonce;

        /**
         * Загрузка файла через WP async-upload.
         */
        function uploadVideoFile(file, onSuccess, onError) {
            var formData = new FormData();
            formData.append('action', 'upload-attachment');
            formData.append('_wpnonce', instrAdminVars.upload_nonce || '');
            formData.append('async-upload', file);
            formData.append('name', file.name);

            $.ajax({
                url: window._instrAjaxUrl,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                dataType: 'json',
                success: function(res) {
                    if (res && res.success && res.data) {
                        onSuccess({
                            url: res.data.url || (res.data.sizes && res.data.sizes.full ? res.data.sizes.full.url : ''),
                            title: res.data.title || file.name,
                            mime: res.data.mime || file.type,
                            id: res.data.id
                        });
                    } else {
                        onError((res && res.data && res.data.message) || 'Ошибка загрузки файла.');
                    }
                },
                error: function() {
                    onError('Ошибка сети при загрузке файла.');
                }
            });
        }

        function ajaxPost(action, data, done) {
            // Rate limiting — минимум AJAX_THROTTLE_MS между запросами
            var now = Date.now();
            if (now - lastAjaxTime < AJAX_THROTTLE_MS) {
                return $.Deferred().reject('throttled');
            }
            lastAjaxTime = now;
            return $.post(ajaxUrl, $.extend({ action: action, nonce: ajaxNonce }, data || {}), done, 'json')
                .fail(function() { showAlert('Ошибка сети.'); });
        }

        function sanitizeCategoryName(value) {
            return $.trim(String(value || '').replace(/[\[\]<>"']/g, ''));
        }

        function escSelector(value) {
            return $.escapeSelector ? $.escapeSelector(String(value)) : String(value).replace(/([ #;&,.+*~':"!^$[\]()=>|/@])/g, '\\$1');
        }

        function findPanel(cat) { return $('.instr-cat-panel').filter(function() { return $(this).data('category') === cat; }); }
        function findTab(cat) { return $('.instr-tab:not(.instr-tab--add)').filter(function() { return $(this).data('category') === cat; }); }

        // ════════════════════════════════════════════
        //  ТАБЫ КАТЕГОРИЙ
        // ════════════════════════════════════════════

        $(document).on('click', '.instr-tab:not(.instr-tab--add)', function(e) {
            if ($(e.target).closest('.instr-tab__actions').length) return;
            switchTab($(this));
        });

        function switchTab($tab) {
            var cat = $tab.data('category');
            if (!cat) return;
            $('.instr-tab').removeClass('instr-tab--active');
            $tab.addClass('instr-tab--active');
            $('.instr-cat-panel').removeClass('active');
            findPanel(cat).addClass('active');
        }

        function getActiveTab() { return $('.instr-tab.instr-tab--active:not(.instr-tab--add)'); }
        function getActiveCategory() { var $t = getActiveTab(); return $t.length ? $t.data('category') : null; }

        // ─── Добавление категории (AJAX) ──────────────
        $('#add_category_btn').on('click', function() {
            if (!isEditing) setEditMode();
            showPrompt(instrAdminVars.add_cat_label + ':', '', function(catName) {
                catName = sanitizeCategoryName(catName);
                if (!catName) return;
                ajaxPost('instr_add_category', { cat_name: catName }, function(res) {
                    res.success ? (renderNewTab(res.data.category), renderNewPanel(res.data.category), switchTab(findTab(res.data.category))) : showAlert((res.data && res.data.message) || 'Ошибка при создании категории.');
                });
            });
        });

        function renderNewTab(name) {
            var $tab = $('<div/>', { 'class': 'instr-tab' }).data('category', name);

            var $icon = $('<span/>', { 'class': 'instr-tab__icon' });
            appendSvg($icon, instrAdminVars.folder_svg);
            $tab.append($icon);

            $tab.append($('<span/>', { 'class': 'instr-tab__name', text: name }));
            $tab.append($('<span/>', { 'class': 'instr-tab__count', text: '0' }));

            var $actions = $('<div/>', { 'class': 'instr-tab__actions' });
            var $renameBtn = $('<button/>', { type: 'button', 'class': 'instr-tab__rename', title: 'Переименовать' });
            appendSvg($renameBtn, instrAdminVars.pencil_svg);
            $actions.append($renameBtn);

            var $removeBtn = $('<button/>', { type: 'button', 'class': 'instr-tab__remove', title: 'Удалить категорию' });
            appendSvg($removeBtn, instrAdminVars.trash_svg);
            $actions.append($removeBtn);

            $tab.append($actions).insertBefore('#add_category_btn').hide().fadeIn(250);
        }

        function renderNewPanel(name) {
            var id = 'container_' + name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
            var $panel = $('<div/>', { 'class': 'instr-cat-panel' }).data('category', name).attr('data-category', name);
            $('<input/>', { type: 'hidden', name: 'categories[' + Date.now() + ']', value: name }).appendTo($panel);
            $('<div/>', { 'class': 'instr-cat-container', id: id, 'data-empty-text': instrAdminVars.no_videos_in_cat }).appendTo($panel);
            
            // Footer с кнопками — безопасная вставка SVG
            var $footer = $('<div/>', { 'class': 'instr-cat-footer' });
            
            var $addBtn = $('<button/>', { type: 'button', 'class': 'btn btn--add add_video_button' })
                .data('category', name)
                .append(createSvgElement(instrAdminVars.plus_svg))
                .append(document.createTextNode(' ' + instrAdminVars.add_video_label));
            $footer.append($addBtn);
            
            var $saveBtn = $('<button/>', { type: 'submit', name: 'save_videos', 'class': 'btn btn--primary save_cat_btn' })
                .append(createSvgElement(instrAdminVars.check_svg))
                .append(document.createTextNode(' ' + instrAdminVars.save_label));
            $footer.append($saveBtn);
            
            $footer.appendTo($panel);
            $panel.appendTo('form').hide().fadeIn(300);
            initSortable($('#' + escSelector(id)));
        }

        // ─── Удаление категории (AJAX) ────────────────
        $(document).on('click', '.instr-tab__remove', function(e) {
            e.stopPropagation();
            var $tab = $(this).closest('.instr-tab'), cat = $tab.data('category');
            if (!cat) return;
            showConfirm('Удалить категорию?', '«' + cat + '» и все её видео будут удалены.', function() {
                ajaxPost('instr_remove_category', { cat_name: cat }, function(res) {
                    if (res.success) {
                        findPanel(cat).fadeOut(200, function() { $(this).remove(); });
                        if ($tab.hasClass('instr-tab--active')) { var $n = $('.instr-tab:not(.instr-tab--add)').first(); if ($n.length) switchTab($n); }
                        $tab.fadeOut(200, function() { $(this).remove(); });
                    } else showAlert((res.data && res.data.message) || 'Ошибка при удалении категории.');
                });
            });
        });

        // ─── Переименование категории (AJAX) ──────────
        $(document).on('click', '.instr-tab__rename', function(e) {
            e.stopPropagation();
            var $tab = $(this).closest('.instr-tab'), oldName = $tab.data('category');
            if (!oldName) return;
            showPrompt('Новое имя категории:', oldName, function(newName) {
                newName = sanitizeCategoryName(newName);
                if (!newName || newName === oldName) return;
                ajaxPost('instr_rename_category', { old_name: oldName, new_name: newName }, function(res) {
                    if (res.success) {
                        $tab.find('.instr-tab__name').text(newName).end().data('category', newName);
                        var $panel = findPanel(oldName).attr('data-category', newName).data('category', newName);
                        $panel.find('input[type="hidden"][name^="categories"]').val(newName);
                        $panel.find('.add_video_button').attr('data-category', newName).data('category', newName);
                        $panel.find('.editable-title').attr('data-category', newName).data('category', newName);
                        // Обновляем name у hidden input-ов видео: cat_videos[old_name][idx][...] → cat_videos[new_name][idx][...]
                        $panel.find('.video-entry').each(function() {
                            var $entry = $(this);
                            $entry.find('input[type="hidden"]').each(function() {
                                var oldNameAttr = $(this).attr('name');
                                if (oldNameAttr.indexOf('cat_videos[' + oldName + ']') === 0) {
                                    $(this).attr('name', oldNameAttr.replace('cat_videos[' + oldName + ']', 'cat_videos[' + newName + ']'));
                                }
                            });
                        });
                        $panel.find('.instr-cat-container').attr('id', 'container_' + newName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_'));
                    } else showAlert((res.data && res.data.message) || 'Ошибка при переименовании.');
                });
            });
        });

        // ════════════════════════════════════════════
        //  ВИДЕО (внутри категорий)
        // ════════════════════════════════════════════

        var sortableOpts = {
            handle: '.video-entry__drag',
            axis: 'y',
            opacity: .8,
            placeholder: 'sortable-placeholder',
            forcePlaceholderSize: true,
            tolerance: 'pointer',
            cursor: 'grabbing',
            connectWith: '.instr-cat-container'
        };

        function initSortable($c) {
            if ($c.data('sortable-init')) return;
            $c.sortable($.extend({}, sortableOpts, {
                update: function(e, ui) {
                    var $thisContainer = $(this);
                    var newCat = $thisContainer.closest('.instr-cat-panel').data('category');
                    if (ui.sender) {
                        var oldCat = ui.sender.closest('.instr-cat-panel').data('category');
                        var $entry = ui.item;
                        $entry.find('.editable-title').attr('data-category', newCat).data('category', newCat);
                        var newIdx = $entry.index();
                        $entry.find('input[data-field="title"]').attr('name', videoFieldName(newCat, newIdx, 'title'));
                        $entry.find('input[data-field="url"]').attr('name', videoFieldName(newCat, newIdx, 'url'));
                        updateDropdownOnMove($entry, newCat);
                        reindexCat(oldCat);
                        reindexCat(newCat);
                    } else {
                        reindexCat(newCat);
                    }
                }
            }));
            $c.data('sortable-init', true);
        }

        $('.instr-cat-container').each(function() { initSortable($(this)); });

        function reindexCat(cat) {
            var $panel = findPanel(cat);
            $panel.find('.video-entry').each(function(i) {
                $(this).find('.editable-title').attr('data-index', i);
                $(this).find('input[data-field="title"]').attr('name', videoFieldName(cat, i, 'title'));
                $(this).find('input[data-field="url"]').attr('name', videoFieldName(cat, i, 'url'));
            });
            updateTabCount(cat);
        }

        function updateTabCount(cat) {
            var $tab = findTab(cat);
            var count = findPanel(cat).find('.video-entry').length;
            $tab.find('.instr-tab__count').text(count);
        }

        // ─── Добавление нового видео ──────────────────
        var DRAG_HANDLE_SVG = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="4" r="1.3"/><circle cx="11" cy="4" r="1.3"/><circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/><circle cx="5" cy="12" r="1.3"/><circle cx="11" cy="12" r="1.3"/></svg>';

        $(document).on('click', '.add_video_button', function() {
            if (!isEditing) setEditMode();
            var cat = $(this).data('category');
            if (!cat) return;
            var $container = findPanel(cat).find('.instr-cat-container');
            var idx = $container.find('.video-entry').length;

            var $el = $('<div/>', { 'class': 'video-entry entering' });
            var $header = $('<div/>', { 'class': 'video-entry__header' }).appendTo($el);

            // Drag handle — безопасная вставка SVG
            var $drag = $('<div/>', { 'class': 'video-entry__drag', 'aria-hidden': 'true' });
            appendSvg($drag, DRAG_HANDLE_SVG);
            $header.append($drag);

            // Save button
            var $saveBtn = $('<button/>', { type: 'button', 'class': 'video-entry__save', title: instrAdminVars.save_label });
            appendSvg($saveBtn, instrAdminVars.check_svg);
            $saveBtn.hide().appendTo($header);

            // Title
            $('<h3/>', { 'class': 'editable-title', contenteditable: 'false', text: instrAdminVars.default_title })
                .data({ index: idx, category: cat })
                .attr({ 'data-index': idx, 'data-category': cat })
                .appendTo($header);

            // Hidden inputs
            $('<input/>', { type: 'hidden', name: videoFieldName(cat, idx, 'title'), value: instrAdminVars.default_title })
                .attr('data-field', 'title').appendTo($header);
            $('<input/>', { type: 'hidden', name: videoFieldName(cat, idx, 'url') })
                .attr('data-field', 'url').appendTo($header);

            $('<span/>', { 'class': 'editable-hint', text: instrAdminVars.edit_hint }).appendTo($header);

            // Video preview — безопасная вставка SVG
            var $preview = $('<div/>', { 'class': 'video_preview' });
            var $empty = $('<div/>', { 'class': 'video-empty' });
            appendSvg($empty, instrAdminVars.film_svg);
            $empty.append($('<p/>', { text: instrAdminVars.no_video }));
            $preview.append($empty).appendTo($el);

            // Controls — безопасная вставка SVG
            var $controls = $('<div/>', { 'class': 'video_controls' });

            var $uploadBtn = $('<button/>', { type: 'button', 'class': 'btn btn--upload upload_video_button' });
            appendSvg($uploadBtn, instrAdminVars.upload_svg);
            $uploadBtn.append(document.createTextNode(' ' + instrAdminVars.upload_btn));
            $controls.append($uploadBtn);

            var $pasteBtn = $('<button/>', { type: 'button', 'class': 'btn btn--ghost paste_url_button' });
            $pasteBtn.append(document.createTextNode('🔗 ' + (instrAdminVars.paste_url_btn || 'URL')));
            $controls.append($pasteBtn);

            var $removeBtn = $('<button/>', { type: 'button', 'class': 'btn btn--danger remove_video_button' });
            appendSvg($removeBtn, instrAdminVars.trash_svg);
            $removeBtn.append(document.createTextNode(' ' + instrAdminVars.remove_btn));
            $controls.append($removeBtn);

            $controls.appendTo($el);

            // Move to category — кастомный dropdown (если больше одной категории)
            var allCats = instrAdminVars.categories || [];
            if (allCats.length > 1) {
                var $moveWrap = $('<div/>', { 'class': 'video-move' });
                var $moveLabel = $('<span/>', { 'class': 'video-move__label', text: (instrAdminVars.move_to || 'В категорию:') + ' ' });

                var $dropdown = $('<div/>', { 'class': 'instr-dropdown' }).attr('data-category', cat);
                var $toggle = $('<button/>', { type: 'button', 'class': 'instr-dropdown__toggle' });
                $toggle.append($('<span/>', { 'class': 'instr-dropdown__toggle-text', text: cat }));
                var $arrow = $('<span/>', { 'class': 'instr-dropdown__arrow' });
                appendSvg($arrow, '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>');
                $toggle.append($arrow);
                $dropdown.append($toggle);

                var $menu = $('<div/>', { 'class': 'instr-dropdown__menu' });
                $.each(allCats, function(i, c) {
                    var $item = $('<button/>', { type: 'button', 'class': 'instr-dropdown__item' + (c === cat ? ' is-active' : '') }).attr('data-value', c);
                    var $itemIcon = $('<span/>', { 'class': 'instr-dropdown__item-icon' });
                    appendSvg($itemIcon, instrAdminVars.folder_svg);
                    $item.append($itemIcon).append(document.createTextNode(' ' + c));
                    $menu.append($item);
                });
                $dropdown.append($menu);
                $moveWrap.append($moveLabel).append($dropdown);
                $el.append($moveWrap);
            }

            $el.appendTo($container);

            setTimeout(function() { startTitleEdit($el.find('.editable-title')); }, ANIMATION_DURATION);
            $el.on('animationend webkitAnimationEnd', function() { $(this).removeClass('entering'); });
            updateTabCount(cat);
        });

        // ─── Редактирование заголовка (input) ─────────

        function startTitleEdit($title) {
            var $entry = $title.closest('.video-entry'), $header = $title.closest('.video-entry__header');
            var currentText = $.trim($title.text());
            var $input = $('<input type="text" class="editable-title-input" />').val(currentText);
            $header.addClass('editing-title');
            $title.after($input);
            $entry.find('.video-entry__save').css('display', 'flex');
            $entry.find('.editable-hint').css('opacity', '0');
            var done = false;
            function doFinish() { if (done) return; done = true; finishTitleEditInput($input, $title, $header); }
            $entry.data('title-edit-finish', doFinish);
            $input.focus().select();
            $input.on('keydown.title-edit', function(e) { if (e.key === 'Enter') { e.preventDefault(); doFinish(); triggerSave($entry); } });
            $input.on('blur.title-edit', function() { setTimeout(function() { if (!done && $input.closest('.video-entry').length) doFinish(); }, 200); });
        }

        function finishTitleEditInput($input, $title, $header) {
            $input.off('keydown.title-edit blur.title-edit');
            var title = $.trim($input.val()) || instrAdminVars.default_title;
            var idx = $title.data('index'), cat = $title.data('category'), $entry = $title.closest('.video-entry');
            $title.text(title).show();
            if ($header && $header.length) $header.removeClass('editing-title');
            $input.remove();
            $entry.find('input[data-field="title"]').val(title).attr('name', videoFieldName(cat, idx, 'title'));
            $entry.find('.video-entry__save').css('display', 'none');
            $entry.find('.editable-hint').css('opacity', '');
        }

        // Синхронизация всех заголовков формы перед отправкой
        function syncAllTitles($form) {
            $form.find('.instr-cat-panel').each(function() {
                var cat = $(this).data('category');
                $(this).find('.editable-title').each(function() {
                    var idx = $(this).data('index'), title = $.trim($(this).text()) || instrAdminVars.default_title;
                    $(this).closest('.video-entry').find('input[data-field="title"]').val(title).attr('name', videoFieldName(cat, idx, 'title'));
                });
            });
        }

        function triggerSave($entry) {
            var $form = $entry.closest('form');
            if (!$form.length) return;
            syncAllTitles($form);
            if ($form.find('input[name="save_videos"]').length === 0) $('<input type="hidden" name="save_videos" value="1">').appendTo($form);
            $form[0].submit();
        }

        $(document).on('dblclick', '.editable-title', function(e) { e.preventDefault(); startTitleEdit($(this)); });

        $(document).on('mousedown', '.video-entry__save', function(e) {
            e.preventDefault(); e.stopPropagation();
            var $entry = $(this).closest('.video-entry');
            var fn = $entry.data('title-edit-finish');
            if (typeof fn === 'function') fn();
            triggerSave($entry);
        });

        // ─── Загрузка видео через медиабиблиотеку ──────
        $(document).on('click', '.upload_video_button', function(e) {
            e.preventDefault();
            var $btn = $(this), mediaUploader;
            mediaUploader = wp.media.frames.file_frame = wp.media({ title: instrAdminVars.select_video_title, button: { text: instrAdminVars.select_video_btn }, multiple: false, libraryType: 'video' });
            mediaUploader.on('select', function() {
                var att = mediaUploader.state().get('selection').first().toJSON();
                var $entry = $btn.closest('.video-entry');

                // Валидация MIME-типа
                if (!isVideoMimeType(att.mime) && !parseExternalVideoUrl(att.url)) {
                    showAlert(instrAdminVars.invalid_video || 'Пожалуйста, выберите видеофайл.');
                    return;
                }

                setVideoInEntry($entry, att.url, att.title);
            });
            mediaUploader.open();
        });

        // ─── Вставить URL (YouTube, Vimeo, прямой URL) ──────
        $(document).on('click', '.paste_url_button', function(e) {
            e.preventDefault();
            var $btn = $(this);
            showPrompt(instrAdminVars.paste_url_label || 'Вставьте URL видео:', 'https://', function(url) {
                url = $.trim(url);
                if (!url || url === 'https://') return;

                var $entry = $btn.closest('.video-entry');
                var ext = parseExternalVideoUrl(url);

                if (ext) {
                    // YouTube/Vimeo
                    setVideoInEntry($entry, url, instrAdminVars.external_video || 'Внешнее видео');
                } else if (url.match(/\.(mp4|webm|ogg|ogv|mov)(\?|$)/i)) {
                    // Прямая ссылка на видеофайл
                    setVideoInEntry($entry, url, url.split('/').pop().split('?')[0]);
                } else {
                    showAlert(instrAdminVars.invalid_url || 'Неподдерживаемый URL. Используйте YouTube, Vimeo или прямую ссылку на видеофайл.');
                }
            });
        });

        // ─── Кастомный Dropdown: toggle ──────
        $(document).on('click', '.instr-dropdown__toggle', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var $dropdown = $(this).closest('.instr-dropdown');

            // Закрыть все другие dropdown
            $('.instr-dropdown.is-open').not($dropdown).removeClass('is-open');

            $dropdown.toggleClass('is-open');
        });

        // Закрытие dropdown по клику вне
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.instr-dropdown').length) {
                $('.instr-dropdown.is-open').removeClass('is-open');
            }
        });

        // Закрытие по Escape
        $(document).on('keydown', function(e) {
            if (e.key === 'Escape') {
                $('.instr-dropdown.is-open').removeClass('is-open');
            }
        });

        // ─── Перемещение видео между категориями (dropdown item click) ──────
        $(document).on('click', '.instr-dropdown__item', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var $item = $(this);
            var newCat = $item.data('value');
            var $dropdown = $item.closest('.instr-dropdown');
            var $entry = $dropdown.closest('.video-entry');
            var oldCat = $entry.find('.editable-title').data('category');

            // Закрыть dropdown
            $dropdown.removeClass('is-open');

            if (!newCat || String(newCat) === String(oldCat)) return;

            // Перемещаем DOM-элемент в новый контейнер
            var $newContainer = findPanel(newCat).find('.instr-cat-container');
            $entry.detach().appendTo($newContainer);

            // Обновляем данные
            $entry.find('.editable-title').attr('data-category', newCat).data('category', newCat);

            // Обновляем dropdown: текст и активный элемент
            $dropdown.find('.instr-dropdown__toggle-text').text(newCat);
            $dropdown.find('.instr-dropdown__item').removeClass('is-active');
            $item.addClass('is-active');
            $dropdown.attr('data-category', newCat);

            // Переиндексируем обе категории
            reindexCat(oldCat);
            reindexCat(newCat);
        });

        // Обновление dropdown при drag&drop перемещении
        function updateDropdownOnMove($entry, newCat) {
            var $dropdown = $entry.find('.instr-dropdown');
            if (!$dropdown.length) return;
            $dropdown.find('.instr-dropdown__toggle-text').text(newCat);
            $dropdown.find('.instr-dropdown__item').removeClass('is-active')
                .filter('[data-value="' + newCat + '"]').addClass('is-active');
            $dropdown.attr('data-category', newCat);
        }

        // ─── Drag & Drop загрузка файлов ──────
        $(document).on('dragover', '.video_preview', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (!isEditing) return;
            $(this).addClass('drag-over');
        });

        $(document).on('dragleave', '.video_preview', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).removeClass('drag-over');
        });

        $(document).on('drop', '.video_preview', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).removeClass('drag-over');
            if (!isEditing) return;

            var files = e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.files;
            if (!files || !files.length) return;

            var file = files[0];

            // Проверяем тип файла
            if (!isVideoMimeType(file.type)) {
                showAlert(instrAdminVars.invalid_video || 'Пожалуйста, выберите видеофайл.');
                return;
            }

            var $entry = $(this).closest('.video-entry');
            var $preview = $(this);

            // Показываем индикатор загрузки
            $preview.empty().append($('<div/>', { 'class': 'video-uploading', text: instrAdminVars.uploading || 'Загрузка...' }));

            uploadVideoFile(file, function(result) {
                setVideoInEntry($entry, result.url, result.title);
            }, function(errorMsg) {
                // Восстанавливаем пустое превью при ошибке
                var $empty = $('<div/>', { 'class': 'video-empty' });
                appendSvg($empty, instrAdminVars.film_svg);
                $empty.append($('<p/>', { text: errorMsg }));
                $preview.empty().append($empty);
            });
        });

        // ════════════════════════════════════════════
        //  МОДАЛКИ (унифицированные)
        // ════════════════════════════════════════════

        var svgWarning = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
        var svgInfo = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
        var svgPencil = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>';

        function closeModal($m) { $m.addClass('closing'); setTimeout(function() { $m.remove(); }, 200); }
        function bindClose($m, cb) {
            $m.on('click.modal-overlay', function(e) { if (e.target === this) cb(); });
            $(document).on('keydown.modal-esc', function(e) { if (e.key === 'Escape') { $(document).off('keydown.modal-esc'); $m.off('click.modal-overlay'); cb(); } });
        }
        function cleanModal($m) { $m.off('click.modal-overlay'); $(document).off('keydown.modal-esc'); }

        // Универсальный builder модалки
        function createModal(iconClass, iconSvg, title, bodyHtml, buttons) {
            var $m = $('<div/>', { 'class': 'instr-modal-overlay' });
            var $box = $('<div/>', { 'class': 'instr-modal-box' }).appendTo($m);
            var $modalIcon = $('<div/>', { 'class': 'instr-modal__icon ' + iconClass });
            appendSvg($modalIcon, iconSvg);
            $modalIcon.appendTo($box);
            $('<h3/>', { 'class': 'instr-modal__title', text: title }).appendTo($box);
            if (bodyHtml) bodyHtml.appendTo($box);
            var $actions = $('<div/>', { 'class': 'instr-modal__actions' }).appendTo($box);
            $.each(buttons, function(i, b) { $('<button/>', { type: 'button', 'class': 'instr-modal__btn ' + b.cls, text: b.txt }).appendTo($actions); });
            $m.appendTo('body');
            var closed = false;
            function closeIt() { if (closed) return; closed = true; closeModal($m); cleanModal($m); }
            $.each(buttons, function(i, b) { $m.find('.instr-modal__btn').eq(i).on('click', function() { closeIt(); if (b.fn) b.fn(); }); });
            bindClose($m, function() { cleanModal($m); closeIt(); });
            return $m;
        }

        function modalText(msg) { return $('<p/>', { 'class': 'instr-modal__text', text: msg }); }
        function showConfirm(title, msg, onOk) { createModal('instr-modal__icon--danger', svgWarning, title, modalText(msg), [{ cls: 'instr-modal__btn--cancel', txt: 'Отмена' }, { cls: 'instr-modal__btn--confirm', txt: 'Удалить', fn: onOk }]); }
        function showAlert(msg, title) { createModal('instr-modal__icon--info', svgInfo, title || 'Внимание', modalText(msg), [{ cls: 'instr-modal__btn--ok', txt: 'OK' }]); }

        function showPrompt(label, defVal, onOk) {
            var $input = $('<input/>', { type: 'text', 'class': 'instr-modal__input' }).val(defVal || '');
            var submitted = false;
            function submitPrompt($modal) {
                if (submitted) return;
                submitted = true;
                onOk($input.val());
                cleanModal($modal);
                closeModal($modal);
            }
            var $m = createModal('instr-modal__icon--pencil', svgPencil, label, $input, [
                { cls: 'instr-modal__btn--cancel', txt: 'Отмена' },
                { cls: 'instr-modal__btn--save', txt: 'Сохранить', fn: function() { if (!submitted) onOk($input.val()); } }
            ]);
            var $inp = $m.find('.instr-modal__input');
            $inp.focus().select();
            $inp.on('keydown.prompt-input', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); submitPrompt($m); }
                else if (e.key === 'Escape') { $(this).off('keydown.prompt-input'); cleanModal($m); closeModal($m); }
            });
        }

        // ─── Удаление видео с анимацией ──────────────
        $(document).on('click', '.remove_video_button', function() {
            var $btn = $(this);
            showConfirm('Удалить видео?', 'Это действие нельзя отменить.', function() {
                var $entry = $btn.closest('.video-entry'), cat = $entry.find('.editable-title').data('category');
                $entry.addClass('removing');
                $entry.one('animationend webkitAnimationEnd', function() { $(this).remove(); if (cat) reindexCat(cat); });
                setTimeout(function() { if ($entry.parent().length) { $entry.remove(); if (cat) reindexCat(cat); } }, 400);
            });
        });

        // ════════════════════════════════════════════
        //  TOGGLE: РЕЖИМ РЕДАКТИРОВАНИЯ / ПРОСМОТРА
        // ════════════════════════════════════════════

        function loadEditState() {
            ajaxPost('get_video_controls_visibility', {}, function(r) { r.success && r.data.state === 'hide' ? setViewMode() : setEditMode(); });
        }

        function toggleSortables(enable) {
            $('.instr-cat-container').each(function() { if ($(this).sortable('instance')) $(this).sortable(enable ? 'enable' : 'disable'); });
        }

        function setEditButtonSvg(svgString, label) {
            $editBtn.empty();
            appendSvg($editBtn, svgString);
            $editBtn.append(document.createTextNode(' '));
            $('<span>').text(label).appendTo($editBtn);
        }

        function setEditMode() {
            isEditing = true;
            $wrap.removeClass('editing-disabled');
            toggleSortables(true);
            setEditButtonSvg(instrAdminVars.done_svg, instrAdminVars.done_label);
            $editBtn.removeClass('btn--ghost').addClass('btn--primary');
        }

        function setViewMode() {
            isEditing = false;
            $wrap.addClass('editing-disabled');
            toggleSortables(false);
            setEditButtonSvg(instrAdminVars.edit_svg, instrAdminVars.edit_label);
            $editBtn.removeClass('btn--primary').addClass('btn--ghost');
        }

        if ($editBtn.length) {
            loadEditState();
            $editBtn.click(function() {
                if (isEditing) {
                    $('.editable-title-input').each(function() { var $i = $(this), $h = $i.closest('.video-entry__header'), $t = $i.next('.editable-title'); if ($t.length && $t.is(':hidden')) finishTitleEditInput($i, $t, $h); });
                    setViewMode();
                    ajaxPost('save_video_controls_visibility', { state: 'hide' });
                    syncAllTitles($('form'));
                    var $f = $('form');
                    if ($f.find('input[name="save_videos"]').length === 0) $('<input type="hidden" name="save_videos" value="1">').appendTo($f);
                    $f[0].submit();
                } else { setEditMode(); ajaxPost('save_video_controls_visibility', { state: 'show' }); }
            });
            $('form').on('submit', function() { setViewMode(); ajaxPost('save_video_controls_visibility', { state: 'hide' }); });
        }
    });
})(jQuery);