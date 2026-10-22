jQuery(document).ready(function($) {
    'use strict';

    const config = (typeof RankStackData !== 'undefined') ? RankStackData : ((typeof rankstackData !== 'undefined') ? rankstackData : {});
    const apiRoot = config.root || config.apiRoot || '/wp-json/rankstack/v1/';
    const nonce = config.nonce || '';

    let allKeywords = [];
    let filteredKeywords = [];
    let currentPage = 1;
    const pageSize = 20;
    let searchQuery = '';
    let intentFilter = '';
    let sortField = 'gsc_clicks';
    let sortDir = 'desc';

    function initProject() {
        const $select = $('#rs-rt-project-select');
        let savedProj = localStorage.getItem('rankstack_active_project') || '';

        if (savedProj && savedProj !== 'proj_003258cf6942' && $select.find(`option[value="${savedProj}"]`).length) {
            $select.val(savedProj);
            loadData(savedProj);
            return;
        }

        let wpoetsId = '';
        $select.find('option').each(function() {
            if ($(this).text().toLowerCase().indexOf('wpoets') !== -1) {
                wpoetsId = $(this).val();
            }
        });

        if (wpoetsId) {
            $select.val(wpoetsId);
            localStorage.setItem('rankstack_active_project', wpoetsId);
            loadData(wpoetsId);
        } else if ($select.val()) {
            loadData($select.val());
        }
    }

    initProject();

    $('#rs-rt-project-select').on('change', function() {
        const pid = $(this).val();
        localStorage.setItem('rankstack_active_project', pid);
        loadData(pid);
    });

    function loadData(projectId) {
        if (!projectId) return;

        const $tbody = $('#rs-rt-tbody');
        $tbody.html('<tr><td colspan="12" class="rs-text-center">Loading rank tracking intelligence...</td></tr>');

        $.ajax({
            url: apiRoot + 'rank-tracking?project_id=' + projectId,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(data) {
                allKeywords = Array.isArray(data) ? data : [];
                updateKpis(allKeywords);
                applyFilters();
            },
            error: function() {
                $tbody.html('<tr><td colspan="12" class="rs-text-center rs-text-danger">Failed to load rank tracking data.</td></tr>');
            }
        });
    }

    function updateKpis(items) {
        $('#rt-kpi-total-kw').text(items.length.toLocaleString());

        let totalGscPos = 0, countGsc = 0;
        let totalDfseoPos = 0, countDfseo = 0;
        let top10Count = 0;

        items.forEach(item => {
            const gPos = parseFloat(item.gsc_position) || 0;
            const dPos = parseFloat(item.dfseo_position) || 0;

            if (gPos > 0) {
                totalGscPos += gPos;
                countGsc++;
                if (gPos <= 10) top10Count++;
            }
            if (dPos > 0) {
                totalDfseoPos += dPos;
                countDfseo++;
            }
        });

        const avgGsc = countGsc > 0 ? (totalGscPos / countGsc).toFixed(1) : '0.0';
        const avgDfseo = countDfseo > 0 ? (totalDfseoPos / countDfseo).toFixed(1) : '0.0';

        $('#rt-kpi-avg-gsc-pos').text(avgGsc);
        $('#rt-kpi-avg-dfseo-pos').text(avgDfseo);
        $('#rt-kpi-top10-count').text(top10Count.toLocaleString());
    }

    function applyFilters() {
        filteredKeywords = allKeywords.filter(item => {
            if (searchQuery) {
                const kw = (item.keyword || '').toLowerCase();
                if (kw.indexOf(searchQuery.toLowerCase()) === -1) return false;
            }
            if (intentFilter) {
                if (item.intent !== intentFilter) return false;
            }
            return true;
        });

        // Sorting
        filteredKeywords.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        currentPage = 1;
        renderTable();
    }

    function renderTable() {
        const $tbody = $('#rs-rt-tbody');
        $tbody.empty();

        const total = filteredKeywords.length;
        if (total === 0) {
            $tbody.html('<tr><td colspan="12" class="rs-text-center">No keywords match your search or filter.</td></tr>');
            $('#rs-rt-pagination-info').text('Showing 0 of 0 keywords');
            $('#rs-rt-page-num').text('Page 1 of 1');
            $('#rs-rt-btn-prev, #rs-rt-btn-next').prop('disabled', true);
            return;
        }

        const totalPages = Math.ceil(total / pageSize);
        const startIdx = (currentPage - 1) * pageSize;
        const pageItems = filteredKeywords.slice(startIdx, startIdx + pageSize);

        $('#rs-rt-pagination-info').text(`Showing ${(startIdx + 1).toLocaleString()}–${Math.min(startIdx + pageSize, total).toLocaleString()} of ${total.toLocaleString()} keywords`);
        $('#rs-rt-page-num').text(`Page ${currentPage} of ${totalPages}`);
        $('#rs-rt-btn-prev').prop('disabled', currentPage <= 1);
        $('#rs-rt-btn-next').prop('disabled', currentPage >= totalPages);

        pageItems.forEach(row => {
            let intentBg = '#eff6ff', intentColor = '#0369a1';
            if (row.intent === 'Navigational') { intentBg = '#f3e8ff'; intentColor = '#6b21a8'; }
            else if (row.intent === 'Commercial') { intentBg = '#fef9c3'; intentColor = '#854d0e'; }
            else if (row.intent === 'Transactional') { intentBg = '#dcfce7'; intentColor = '#166534'; }

            const c7 = parseFloat(row.gsc_change_7d) || 0;
            const c30 = parseFloat(row.gsc_change_30d) || 0;
            const c7Badge = c7 > 0 ? `<span class="rs-rank-up">↑ +${c7}</span>` : (c7 < 0 ? `<span class="rs-rank-down">↓ ${c7}</span>` : `<span class="rs-rank-flat">— 0.0</span>`);
            const c30Badge = c30 > 0 ? `<span class="rs-rank-up">↑ +${c30}</span>` : (c30 < 0 ? `<span class="rs-rank-down">↓ ${c30}</span>` : `<span class="rs-rank-flat">— 0.0</span>`);

            // KD Badge
            const kd = parseInt(row.dfseo_kd) || 0;
            let kdBg = '#dcfce7', kdColor = '#166534', kdLabel = 'Easy';
            if (kd >= 60) {
                kdBg = '#fee2e2'; kdColor = '#991b1b'; kdLabel = 'Hard';
            } else if (kd >= 30) {
                kdBg = '#fef9c3'; kdColor = '#854d0e'; kdLabel = 'Med';
            }

            const india = row.india || {};
            const inClicks = parseInt(india.gsc_clicks) || 0;
            const inImp = parseInt(india.gsc_impressions) || 0;
            const inCtr = parseFloat(india.gsc_ctr) || 0;
            const inPos = parseFloat(india.gsc_position) || 0;
            const inDfseoPos = parseFloat(india.dfseo_position) || inPos;
            const inDfseoVol = parseInt(india.dfseo_volume) || 0;

            const weeklyStar = row.is_weekly ? '<span title="Tracked Weekly" style="color:#eab308; margin-right:4px;">★</span>' : '';

            let html = `
                <tr class="rs-rt-parent-row" data-id="${row.id}">
                    <td style="text-align:center;">
                        <button type="button" class="rs-rt-toggle-btn" data-id="${row.id}" style="background:none; border:none; cursor:pointer; font-weight:bold; color:#0b57d0; font-size:12px;">▶</button>
                    </td>
                    <td>
                        <div style="display:flex; align-items:center; gap:6px;">
                            ${weeklyStar}
                            <strong style="color:#1e293b; font-size:13px;">${escapeHtml(row.keyword)}</strong>
                        </div>
                    </td>
                    <td><span class="rs-badge" style="background:${intentBg}; color:${intentColor}; font-weight:600; font-size:11px; padding:2px 8px; border-radius:4px;">${escapeHtml(row.intent)}</span></td>
                    <td><strong style="color:#0b57d0;">${(parseInt(row.gsc_clicks) || 0).toLocaleString()}</strong></td>
                    <td>${(parseInt(row.gsc_impressions) || 0).toLocaleString()}</td>
                    <td>${((parseFloat(row.gsc_ctr) || 0) * 100).toFixed(2)}%</td>
                    <td><strong>${(parseFloat(row.gsc_position) || 0).toFixed(1)}</strong></td>
                    <td>${c7Badge}</td>
                    <td>${c30Badge}</td>
                    <td><strong style="color:#4338ca;">#${(parseFloat(row.dfseo_position) || 0).toFixed(1)}</strong></td>
                    <td>${(parseInt(row.dfseo_volume) || 0).toLocaleString()}</td>
                    <td>
                        <span class="rs-badge" style="background:${kdBg}; color:${kdColor}; font-weight:700; font-size:11px; padding:3px 8px; border-radius:12px;" title="Keyword Difficulty: ${kd}/100 (${kdLabel})">
                            ${kd} ${kdLabel}
                        </span>
                    </td>
                </tr>
                <tr class="rs-rt-child-row rs-rt-child-${row.id}" style="display:none; background:#f8fafc;">
                    <td colspan="12" style="padding:12px 20px;">
                        <div style="font-weight:700; font-size:13px; margin-bottom:8px; color:#1e293b;">
                            🇮🇳 India (IN) Regional Rank Tracking Breakdown for "${escapeHtml(row.keyword)}":
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; background:#ffffff; padding:12px 16px; border:1px solid #e2e8f0; border-radius:6px; box-shadow:0 1px 2px rgba(0,0,0,0.04);">
                            <div>
                                <span style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700; display:block;">India GSC Clicks</span>
                                <strong style="font-size:16px; color:#0b57d0;">${inClicks.toLocaleString()}</strong>
                            </div>
                            <div>
                                <span style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700; display:block;">India GSC Impressions</span>
                                <strong style="font-size:16px; color:#475569;">${inImp.toLocaleString()}</strong>
                            </div>
                            <div>
                                <span style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700; display:block;">India GSC CTR</span>
                                <strong style="font-size:16px; color:#475569;">${(inCtr * 100).toFixed(2)}%</strong>
                            </div>
                            <div>
                                <span style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700; display:block;">India GSC Position</span>
                                <strong style="font-size:16px; color:#059669;">#${inPos.toFixed(1)}</strong>
                            </div>
                            <div>
                                <span style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700; display:block;">India DFSEO Position</span>
                                <strong style="font-size:16px; color:#4338ca;">#${inDfseoPos.toFixed(1)}</strong>
                            </div>
                            <div>
                                <span style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700; display:block;">India Search Volume</span>
                                <strong style="font-size:16px; color:#d97706;">${inDfseoVol.toLocaleString()}/mo</strong>
                            </div>
                        </div>
                    </td>
                </tr>
            `;

            $tbody.append(html);
        });
    }

    // Toggle Child Row
    $(document).on('click', '.rs-rt-toggle-btn', function() {
        const id = $(this).data('id');
        const $child = $(`.rs-rt-child-${id}`);
        if ($child.is(':visible')) {
            $child.hide();
            $(this).text('▶');
        } else {
            $child.show();
            $(this).text('▼');
        }
    });

    // Search and Filter Handlers
    let searchTimeout = null;
    $('#rs-rt-search').on('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchQuery = $(this).val().trim();
            applyFilters();
        }, 300);
    });

    $('#rs-rt-intent-filter').on('change', function() {
        intentFilter = $(this).val();
        applyFilters();
    });

    // Pagination
    $('#rs-rt-btn-prev').on('click', function() {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    $('#rs-rt-btn-next').on('click', function() {
        const totalPages = Math.ceil(filteredKeywords.length / pageSize);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    // Export CSV
    $('#rs-rt-btn-export').on('click', function() {
        if (!filteredKeywords.length) return alert('No keywords to export.');

        let csv = 'Keyword,Search Intent,GSC Clicks,GSC Impressions,GSC CTR %,GSC Position,GSC 7D Change,GSC 30D Change,DFSEO Position,DFSEO Volume,DFSEO KD,India GSC Clicks,India GSC Impressions,India GSC Position,India DFSEO Position,India Volume\n';

        filteredKeywords.forEach(row => {
            const india = row.india || {};
            const line = [
                `"${(row.keyword || '').replace(/"/g, '""')}"`,
                `"${row.intent || ''}"`,
                parseInt(row.gsc_clicks) || 0,
                parseInt(row.gsc_impressions) || 0,
                ((parseFloat(row.gsc_ctr) || 0) * 100).toFixed(2),
                parseFloat(row.gsc_position) || 0,
                parseFloat(row.gsc_change_7d) || 0,
                parseFloat(row.gsc_change_30d) || 0,
                parseFloat(row.dfseo_position) || 0,
                parseInt(row.dfseo_volume) || 0,
                parseInt(row.dfseo_kd) || 0,
                parseInt(india.gsc_clicks) || 0,
                parseInt(india.gsc_impressions) || 0,
                parseFloat(india.gsc_position) || 0,
                parseFloat(india.dfseo_position) || 0,
                parseInt(india.dfseo_volume) || 0
            ].join(',');
            csv += line + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `rankstack-rank-tracking-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
});
