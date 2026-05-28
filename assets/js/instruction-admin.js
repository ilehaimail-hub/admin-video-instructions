/** Admin Video Instructions — Admin Script */
(function($) {
    'use strict';

    $(function() {
        var $wrap = $('.instr-wrap');
        var $editBtn = $('#edit_videos');
        var isEditing = true;
        var ajaxUrl = instrAdminVars.ajax_url || window.ajaxurl;
        var ajaxNonce = instrAdminVars.nonce || '';

        function ajaxPost(action, data, done) {
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
        function videoFieldName(cat, idx, field) { return 'cat_videos[' + cat + '][' + idx + '][' + field + ']'; }

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
            $('<div/>', { 'class': 'instr-tab' }).data('category', name)
                .append($('<span/>', { 'class': 'instr-tab__icon', html: instrAdminVars.folder_svg }))
                .append($('<span/>', { 'class': 'instr-tab__name', text: name }))
                .append($('<span/>', { 'class': 'instr-tab__count', text: '0' }))
                .append($('<div/>', { 'class': 'instr-tab__actions' })
                    .append($('<button/>', { type: 'button', 'class': 'instr-tab__rename', title: 'Переименовать', html: instrAdminVars.pencil_svg }))
                    .append($('<button/>', { type: 'button', 'class': 'instr-tab__remove', title: 'Удалить категорию', html: instrAdminVars.trash_svg })))
                .insertBefore('#add_category_btn').hide().fadeIn(250);
        }

        function renderNewPanel(name) {
            var id = 'container_' + name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_');
            var $panel = $('<div/>', { 'class': 'instr-cat-panel' }).data('category', name).attr('data-category', name);
            $('<input/>', { type: 'hidden', name: 'categories[' + Date.now() + ']', value: name }).appendTo($panel);
            $('<div/>', { 'class': 'instr-cat-container', id: id, 'data-empty-text': instrAdminVars.no_videos_in_cat }).appendTo($panel);
            $('<div/>', { 'class': 'instr-cat-footer' })
                .append($('<button/>', { type: 'button', 'class': 'btn btn--add add_video_button' }).data('category', name).html(instrAdminVars.plus_svg + ' ' + instrAdminVars.add_video_label))
                .append($('<button/>', { type: 'submit', name: 'save_videos', 'class': 'btn btn--primary save_cat_btn', html: instrAdminVars.check_svg + ' ' + instrAdminVars.save_label }))
                .appendTo($panel);
            $panel.appendTo('form').hide().fadeIn(300);
            $('#' + escSelector(id)).sortable($.extend({}, sortableOpts, { update: function() { reindexCat(name); } }));
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

        var sortableOpts = { handle: '.video-entry__drag', axis: 'y', opacity: .8, placeholder: 'sortable-placeholder', forcePlaceholderSize: true, tolerance: 'pointer', cursor: 'grabbing' };

        $('.instr-cat-container').each(function() {
            var $c = $(this);
            if (!$c.data('sortable-init')) {
                $c.sortable($.extend({}, sortableOpts, { update: function() { reindexCat($c.closest('.instr-cat-panel').data('category')); } }));
                $c.data('sortable-init', true);
            }
        });

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
        $(document).on('click', '.add_video_button', function() {
            if (!isEditing) setEditMode();
            var cat = $(this).data('category');
            if (!cat) return;
            var $container = findPanel(cat).find('.instr-cat-container');
            var idx = $container.find('.video-entry').length;
            var dragSvg = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="4" r="1.3"/><circle cx="11" cy="4" r="1.3"/><circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/><circle cx="5" cy="12" r="1.3"/><circle cx="11" cy="12" r="1.3"/></svg>';
            var $el = $('<div/>', { 'class': 'video-entry entering' });
            var $header = $('<div/>', { 'class': 'video-entry__header' }).appendTo($el);
            $('<div/>', { 'class': 'video-entry__drag', html: dragSvg }).appendTo($header);
            $('<button/>', { type: 'button', 'class': 'video-entry__save', html: instrAdminVars.check_svg }).hide().appendTo($header);
            $('<h3/>', { 'class': 'editable-title', contenteditable: 'false', text: instrAdminVars.default_title }).data({ index: idx, category: cat }).attr({ 'data-index': idx, 'data-category': cat }).appendTo($header);
            $('<input/>', { type: 'hidden', name: videoFieldName(cat, idx, 'title'), value: instrAdminVars.default_title }).attr('data-field', 'title').appendTo($header);
            $('<input/>', { type: 'hidden', name: videoFieldName(cat, idx, 'url') }).attr('data-field', 'url').appendTo($header);
            $('<span/>', { 'class': 'editable-hint', text: instrAdminVars.edit_hint }).appendTo($header);
            $('<div/>', { 'class': 'video_preview' }).append($('<div/>', { 'class': 'video-empty' }).append(instrAdminVars.film_svg).append($('<p/>', { text: instrAdminVars.no_video }))).appendTo($el);
            $('<div/>', { 'class': 'video_controls' })
                .append($('<button/>', { type: 'button', 'class': 'btn btn--upload upload_video_button', html: instrAdminVars.upload_svg + ' ' + instrAdminVars.upload_btn }))
                .append($('<button/>', { type: 'button', 'class': 'btn btn--danger remove_video_button', html: instrAdminVars.trash_svg + ' ' + instrAdminVars.remove_btn }))
                .appendTo($el);
            $el.appendTo($container);
            setTimeout(function() { startTitleEdit($el.find('.editable-title')); }, 350);
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
            if (mediaUploader) { mediaUploader.open(); return; }
            mediaUploader = wp.media.frames.file_frame = wp.media({ title: instrAdminVars.select_video_title, button: { text: instrAdminVars.select_video_btn }, multiple: false, libraryType: 'video' });
            mediaUploader.on('select', function() {
                var att = mediaUploader.state().get('selection').first().toJSON();
                var $entry = $btn.closest('.video-entry');
                var idx = $entry.find('.editable-title').data('index'), cat = $entry.find('.editable-title').data('category');
                $entry.find('input[data-field="url"]').val(att.url).attr('name', videoFieldName(cat, idx, 'url'));
                var $video = $('<video/>', { controls: true, preload: 'metadata' }).append($('<source/>', { src: att.url, type: att.mime || 'video/mp4' })).append(document.createTextNode(instrAdminVars.fallback_text));
                $entry.find('.video_preview').empty().append($video);
                var $t = $entry.find('.editable-title');
                if ($t.length) { $t.text(att.title); $entry.find('input[data-field="title"]').val(att.title).attr('name', videoFieldName(cat, idx, 'title')); }
            });
            mediaUploader.open();
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
            $('<div/>', { 'class': 'instr-modal__icon ' + iconClass, html: iconSvg }).appendTo($box);
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

        function setEditMode() {
            isEditing = true; $wrap.removeClass('editing-disabled'); toggleSortables(true);
            $editBtn.html(instrAdminVars.done_svg + ' <span>' + instrAdminVars.done_label + '</span>');
            $editBtn.removeClass('btn--ghost').addClass('btn--primary');
        }

        function setViewMode() {
            isEditing = false; $wrap.addClass('editing-disabled'); toggleSortables(false);
            $editBtn.html(instrAdminVars.edit_svg + ' <span>' + instrAdminVars.edit_label + '</span>');
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