jQuery(document).ready(function($) {
    'use strict';

    const config = (typeof RankStackData !== 'undefined') ? RankStackData : ((typeof rankstackData !== 'undefined') ? rankstackData : {});
    const apiRoot = config.root || config.apiRoot || '/wp-json/rankstack/v1/';
    const nonce = config.nonce || '';

    function loadSyncLogs(projectId) {
        if (!projectId) return;

        const $tbody = $('#rs-synclog-tbody');
        $tbody.html('<tr><td colspan="6" class="rs-text-center">Loading GSC sync logs...</td></tr>');

        $.ajax({
            url: apiRoot + 'sync-logs?project_id=' + encodeURIComponent(projectId) + '&_t=' + Date.now(),
            method: 'GET',
            cache: false,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            },
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(res) {
                if (!res || !res.length) {
                    $tbody.html('<tr><td colspan="6" class="rs-text-center">No GSC sync logs recorded yet for this project. Click <strong>⚡ Run GSC Sync Now</strong> above to initiate your first sync.</td></tr>');
                    return;
                }

                let html = '';
                res.forEach((log, index) => {
                    let newCount = log.new_keywords_count || 0;
                    let updatedCount = log.updated_keywords_count || 0;
                    let newListRaw = log.new_keywords_list || '[]';
                    let newList = [];
                    try {
                        newList = typeof newListRaw === 'string' ? JSON.parse(newListRaw) : newListRaw;
                    } catch(e) {
                        newList = [];
                    }

                    let kwListFormatted = '<span style="color:#94a3b8; font-size:12px;">None</span>';
                    if (newList && newList.length) {
                        const itemsHtml = newList.map((kw, i) => {
                            const kwStr = String(kw || '').trim();
                            const isLong = kwStr.length > 70;
                            const badge = `<span style="background:#e0e7ff; color:#3730a3; font-weight:700; font-size:11px; padding:2px 6px; border-radius:4px; flex-shrink:0; line-height:1.2;">#${i + 1}</span>`;
                            const tagBadge = isLong ? `<span style="background:#fef3c7; color:#92400e; font-size:10px; font-weight:600; padding:1px 5px; border-radius:3px; margin-left:6px; flex-shrink:0; white-space:nowrap;">Long Query</span>` : '';
                            return `
                                <div style="display:flex; align-items:flex-start; gap:8px; padding:6px 8px; border-bottom:1px solid #f1f5f9; font-size:12px; line-height:1.45; color:#1e293b; background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                                    ${badge}
                                    <div style="flex:1; word-break:break-word; overflow-wrap:anywhere;">
                                        ${escapeHtml(kwStr)} ${tagBadge}
                                    </div>
                                </div>
                            `;
                        }).join('');

                        kwListFormatted = `
                            <details style="background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; overflow:hidden; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                                <summary style="cursor:pointer; color:#0b57d0; font-weight:600; font-size:12px; padding:6px 10px; background:#f8fafc; border-bottom:1px solid #e2e8f0; user-select:none; display:flex; align-items:center; justify-content:space-between;">
                                    <span><strong>${newList.length} new queries discovered</strong></span>
                                    <span style="font-size:11px; color:#64748b; font-weight:normal;">click to toggle</span>
                                </summary>
                                <div style="max-height:170px; overflow-y:auto; -webkit-overflow-scrolling:touch;">
                                    ${itemsHtml}
                                </div>
                            </details>
                        `;
                    }

                    const isSuccess = log.status === 'success';
                    let statusBadge = isSuccess 
                        ? '<span class="rs-badge rs-badge-success" style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:4px; font-weight:600;">SUCCESS</span>' 
                        : '<span class="rs-badge rs-badge-danger" style="background:#fee2e2; color:#991b1b; padding:4px 8px; border-radius:4px; font-weight:600;">' + escapeHtml((log.status || 'FAILED').toUpperCase()) + '</span>';

                    const relTime = timeAgo(log.timestamp);

                    // Calculate difference with next row (chronologically previous sync)
                    let prevDiffHtml = '';
                    if (index < res.length - 1) {
                        const prevLog = res[index + 1];
                        const diffText = diffBetweenDates(prevLog.timestamp, log.timestamp);
                        if (diffText) {
                            prevDiffHtml = `<div style="font-size:11px; color:#0369a1; background:#e0f2fe; display:inline-block; padding:1px 6px; border-radius:3px; margin-top:3px; font-weight:500;">+${escapeHtml(diffText)} after prev sync</div>`;
                        }
                    }

                    html += `
                        <tr>
                            <td>
                                <strong>${escapeHtml(log.timestamp)}</strong>
                                <div style="font-size:11px; color:#64748b; margin-top:2px;">${escapeHtml(relTime)}</div>
                                ${prevDiffHtml}
                            </td>
                            <td>${statusBadge}</td>
                            <td><strong style="color:#0b57d0; font-size:14px;">${newCount}</strong></td>
                            <td><strong style="color:#166534; font-size:14px;">${updatedCount}</strong></td>
                            <td>${kwListFormatted}</td>
                            <td>${formatLogDetails(log.details)}</td>
                        </tr>
                    `;
                });

                $tbody.html(html);
            },
            error: function() {
                $tbody.html('<tr><td colspan="6" class="rs-text-center rs-text-danger">Failed to load sync logs. Please refresh the page.</td></tr>');
            }
        });
    }

    function formatLogDetails(detailsStr) {
        if (!detailsStr) return '<span style="color:#94a3b8;">—</span>';
        let data = null;
        try {
            data = typeof detailsStr === 'string' ? JSON.parse(detailsStr) : detailsStr;
        } catch(e) {
            data = null;
        }

        if (data && typeof data === 'object') {
            const rowsSynced = data.rows_synced ? Number(data.rows_synced).toLocaleString() + ' rows' : '';
            const timelineDays = data.timeline_days ? data.timeline_days + 'd' : '';
            const range = data.date_range ? data.date_range : '';

            return `
                <div style="font-size:12px; line-height:1.4; width:100%; word-break:break-word; overflow-wrap:anywhere;">
                    <div style="font-weight:600; color:#1e293b;">${rowsSynced} ${timelineDays ? '• ' + timelineDays : ''}</div>
                    ${range ? `<div style="font-size:11px; color:#64748b; margin-top:2px;">📅 ${escapeHtml(range)}</div>` : ''}
                    <details style="margin-top:4px;">
                        <summary style="cursor:pointer; font-size:11px; color:#0b57d0; font-weight:500;">Raw JSON</summary>
                        <pre style="margin:4px 0 0 0; font-size:10px; white-space:pre-wrap; word-break:break-all; overflow-wrap:anywhere; width:100%; max-height:85px; overflow-y:auto; background:#f8fafc; padding:6px; border-radius:4px; border:1px solid #e2e8f0; color:#334155; font-family:monospace; box-sizing:border-box;">${escapeHtml(typeof detailsStr === 'string' ? detailsStr : JSON.stringify(detailsStr))}</pre>
                    </details>
                </div>
            `;
        }

        return `<div style="width:100%; font-size:12px; word-break:break-all; overflow-wrap:anywhere; color:#334155;">${escapeHtml(detailsStr)}</div>`;
    }

    function timeAgo(dateString) {
        if (!dateString) return '';
        const d = new Date(dateString.replace(/-/g, '/'));
        const now = new Date();
        const diffSecs = Math.floor((now.getTime() - d.getTime()) / 1000);
        if (isNaN(diffSecs) || diffSecs < 0) return 'Just now';
        if (diffSecs < 60) return 'Just now';
        const mins = Math.floor(diffSecs / 60);
        if (mins < 60) return mins === 1 ? '1 minute ago' : `${mins} minutes ago`;
        const hrs = Math.floor(diffSecs / 60);
        if (hrs < 24) return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`;
        const days = Math.floor(hrs / 24);
        if (days < 30) return days === 1 ? '1 day ago' : `${days} days ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
        const yrs = Math.floor(days / 365);
        return yrs === 1 ? '1 year ago' : `${yrs} years ago`;
    }

    function diffBetweenDates(olderDateStr, newerDateStr) {
        if (!olderDateStr || !newerDateStr) return '';
        const dOld = new Date(olderDateStr.replace(/-/g, '/'));
        const dNew = new Date(newerDateStr.replace(/-/g, '/'));
        const diffSecs = Math.floor((dNew.getTime() - dOld.getTime()) / 1000);
        if (isNaN(diffSecs) || diffSecs <= 0) return '';
        const mins = Math.floor(diffSecs / 60);
        if (mins < 60) return `${mins} mins`;
        const hrs = Math.floor(diffSecs / 3600);
        if (hrs < 24) return `${hrs} hours`;
        const days = Math.floor(diffSecs / 86400);
        return days === 1 ? '1 day' : `${days} days`;
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Restore active project selection from localStorage if saved
    const savedProj = localStorage.getItem('rankstack_active_project');
    if (savedProj && $(`#rs-synclog-project-select option[value="${savedProj}"]`).length) {
        $('#rs-synclog-project-select').val(savedProj);
    }

    const initialProj = $('#rs-synclog-project-select').val();
    if (initialProj) {
        loadSyncLogs(initialProj);
    }

    $('#rs-synclog-project-select').on('change', function() {
        const val = $(this).val();
        if (val) localStorage.setItem('rankstack_active_project', val);
        loadSyncLogs(val);
    });

    // Manual Sync Button Handler
    $('#rs-btn-synclog-manual').on('click', function() {
        const projectId = $('#rs-synclog-project-select').val();
        if (!projectId) {
            alert('Please select a project first.');
            return;
        }

        const $btn = $(this);
        const $status = $('#rs-synclog-status-bar');

        $btn.prop('disabled', true).html('<span>⏳ Connecting to GSC...</span>');
        $status.removeClass('rs-alert-danger rs-alert-success')
               .addClass('rs-alert-info')
               .css({ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '10px 14px', borderRadius: '6px' })
               .text('Connecting to Google Search Console and fetching ranking updates...')
               .show();

        $.ajax({
            url: apiRoot + 'sync/gsc',
            method: 'POST',
            contentType: 'application/json',
            timeout: 180000,
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ project_id: projectId, days: 365 }),
            success: function(res) {
                $btn.prop('disabled', false).html('<span>⚡ Run GSC Sync Now</span>');
                $status.removeClass('rs-alert-info')
                       .addClass('rs-alert-success')
                       .css({ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' })
                       .text(`Sync completed successfully! ${res.synced_rows || 0} rows synced. ${res.new_keywords_count || 0} new keywords added. ${res.updated_keywords_count || 0} existing keywords updated.`)
                       .delay(5000).fadeOut();
                loadSyncLogs(projectId);
            },
            error: function(xhr) {
                $btn.prop('disabled', false).html('<span>⚡ Run GSC Sync Now</span>');
                let errText = 'Sync request failed.';
                if (xhr.statusText === 'timeout') {
                    errText = 'Sync request is continuing in the background on the server. Please check logs in 30 seconds.';
                } else if (xhr.responseJSON && xhr.responseJSON.message) {
                    errText = xhr.responseJSON.message;
                }
                $status.removeClass('rs-alert-info')
                       .addClass('rs-alert-danger')
                       .css({ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' })
                       .html(`<strong>Sync Notice:</strong> ${escapeHtml(errText)}`);
                setTimeout(() => { loadSyncLogs(projectId); }, 500);
            }
        });
    });
});
