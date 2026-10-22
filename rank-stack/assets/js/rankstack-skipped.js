jQuery(document).ready(function($) {
    'use strict';

    const apiRoot = RankStackData.root;
    const nonce = RankStackData.nonce;

    loadProjectDropdown();

    function loadProjectDropdown() {
        $.ajax({
            url: apiRoot + 'projects',
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(projects) {
                const $select = $('#rs-skp-project-select');
                $select.empty();

                if (!projects || projects.length === 0) {
                    $select.append('<option value="">No Projects Found</option>');
                    return;
                }

                projects.forEach(function(p) {
                    $select.append(`<option value="${p.id}">${p.name} (${p.domain})</option>`);
                });

                loadSkippedKeywords();
            }
        });
    }

    $('#rs-skp-project-select').on('change', function() {
        loadSkippedKeywords();
    });

    function loadSkippedKeywords() {
        const projectId = $('#rs-skp-project-select').val();
        if (!projectId) return;

        const $tbody = $('#rs-skipped-tbody');
        $tbody.html('<tr><td colspan="5" class="rs-text-center">Loading skipped keywords...</td></tr>');
        $('#rs-skp-select-all').prop('checked', false);
        updateSelectedCounter();

        $.ajax({
            url: apiRoot + `skipped?project_id=${projectId}`,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(skipped) {
                $tbody.empty();

                if (!skipped || skipped.length === 0) {
                    $tbody.append('<tr><td colspan="5" class="rs-text-center">No skipped keywords logged for this project.</td></tr>');
                    return;
                }

                skipped.forEach(function(item) {
                    $tbody.append(`
                        <tr>
                            <td><input type="checkbox" class="rs-skp-chk" data-id="${item.id}" data-kw="${escapeHtml(item.keyword)}" /></td>
                            <td><strong>${escapeHtml(item.keyword)}</strong></td>
                            <td><span class="rs-badge" style="background:#fee2e2; color:#991b1b;">${escapeHtml(item.reason)}</span></td>
                            <td><span style="font-size:12px; color:#64748b;">${escapeHtml(item.date)}</span></td>
                            <td>
                                <button type="button" class="gsc-btn-action gsc-btn-blue rs-btn-skp-restore-single" data-id="${item.id}">Restore Active</button>
                                <button type="button" class="gsc-btn-action gsc-btn-red rs-btn-skp-delete-single" data-id="${item.id}">Delete</button>
                            </td>
                        </tr>
                    `);
                });
            }
        });
    }

    // Checkbox Selection
    $(document).on('change', '#rs-skp-select-all', function() {
        const checked = $(this).is(':checked');
        $('.rs-skp-chk').prop('checked', checked);
        updateSelectedCounter();
    });

    $(document).on('change', '.rs-skp-chk', function() {
        updateSelectedCounter();
    });

    function updateSelectedCounter() {
        const count = $('.rs-skp-chk:checked').length;
        $('#rs-skp-selected-count').text(count);
        if (count > 0) {
            $('#rs-btn-skp-restore, #rs-btn-skp-delete').show();
        } else {
            $('#rs-btn-skp-restore, #rs-btn-skp-delete').hide();
        }
    }

    // Single Actions
    $(document).on('click', '.rs-btn-skp-restore-single', function() {
        const id = $(this).data('id');
        executeBulkAction([id], 'restore');
    });

    $(document).on('click', '.rs-btn-skp-delete-single', function() {
        const id = $(this).data('id');
        if (!confirm('Permanently delete this skipped keyword entry?')) return;
        executeBulkAction([id], 'delete');
    });

    // Bulk Restore Action
    $('#rs-btn-skp-restore').on('click', function() {
        let ids = [];
        $('.rs-skp-chk:checked').each(function() { ids.push($(this).data('id')); });
        if (!ids.length) return alert('Select items to restore.');
        if (!confirm(`Restore ${ids.length} selected keywords to active rank tracking?`)) return;
        executeBulkAction(ids, 'restore');
    });

    // Bulk Delete Action
    $('#rs-btn-skp-delete').on('click', function() {
        let ids = [];
        $('.rs-skp-chk:checked').each(function() { ids.push($(this).data('id')); });
        if (!ids.length) return alert('Select items to delete.');
        if (!confirm(`Permanently delete ${ids.length} selected skipped keyword records?`)) return;
        executeBulkAction(ids, 'delete');
    });

    function executeBulkAction(ids, action) {
        const projId = $('#rs-skp-project-select').val();

        $.ajax({
            url: apiRoot + 'skipped/bulk-action',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ project_id: projId, ids: ids, action: action }),
            success: function(res) {
                loadSkippedKeywords();
            },
            error: function() {
                alert('Action failed.');
            }
        });
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
});
