jQuery(document).ready(function($) {
    'use strict';

    const apiRoot = RankStackData.root;
    const nonce = RankStackData.nonce;

    let currentPage = 1;
    let perPage = 20;
    let totalPages = 1;
    let totalItems = 0;
    let searchQuery = '';
    let searchTimer = null;

    let cachedSerpHistory = [];
    let cachedRankingUrls = [];
    let cachedDomain = 'wpoets.com';

    function initActiveProject() {
        const $select = $('#rs-kw-project-select');
        let activeId = localStorage.getItem('rankstack_active_project') || '';

        if (activeId && $select.find(`option[value="${activeId}"]`).length) {
            const optText = $select.find(`option[value="${activeId}"]`).text().toLowerCase();
            if (optText.indexOf('main website') === -1) {
                $select.val(activeId);
                loadKeywords();
                return;
            }
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
        }

        if ($select.val()) {
            loadKeywords();
        } else {
            loadProjectDropdown();
        }
    }

    initActiveProject();

    function loadProjectDropdown() {
        $.ajax({
            url: apiRoot + 'projects',
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(projects) {
                const $select = $('#rs-kw-project-select');
                if ($select.children('option').length > 1) {
                    loadKeywords();
                    return;
                }
                $select.empty();

                if (!projects || projects.length === 0) {
                    $select.append('<option value="">No Projects Found</option>');
                    return;
                }

                let savedProj = localStorage.getItem('rankstack_active_project') || '';
                const wpoetsProj = projects.find(p => (p.domain && p.domain.toLowerCase().indexOf('wpoets') !== -1) || (p.name && p.name.toLowerCase().indexOf('wpoets') !== -1));

                let defaultProj = '';
                if (savedProj && savedProj !== 'proj_003258cf6942' && projects.some(p => p.id === savedProj)) {
                    defaultProj = savedProj;
                } else if (wpoetsProj) {
                    defaultProj = wpoetsProj.id;
                } else {
                    defaultProj = projects[0].id;
                }

                projects.forEach(function(p) {
                    const sel = (p.id === defaultProj) ? 'selected="selected"' : '';
                    $select.append(`<option value="${p.id}" ${sel}>${p.name} (${p.domain})</option>`);
                });

                $select.val(defaultProj);
                loadKeywords();
            }
        });
    }

    $('#rs-kw-project-select').on('change', function() {
        localStorage.setItem('rankstack_active_project', $(this).val());
        currentPage = 1;
        loadKeywords();
    });

    // Search Input with 300ms Debounce
    $('#rs-kw-search').on('input', function() {
        clearTimeout(searchTimer);
        const val = $(this).val().trim();
        searchTimer = setTimeout(function() {
            searchQuery = val;
            currentPage = 1;
            loadKeywords();
        }, 300);
    });

    // Per-Page Selector
    $('#rs-kw-per-page').on('change', function() {
        perPage = parseInt($(this).val(), 10) || 20;
        currentPage = 1;
        loadKeywords();
    });

    // Pagination Click Handlers
    $('#rs-kw-first').on('click', function() {
        if (currentPage > 1) {
            currentPage = 1;
            loadKeywords();
        }
    });

    $('#rs-kw-prev').on('click', function() {
        if (currentPage > 1) {
            currentPage--;
            loadKeywords();
        }
    });

    $('#rs-kw-next').on('click', function() {
        if (currentPage < totalPages) {
            currentPage++;
            loadKeywords();
        }
    });

    $('#rs-kw-last').on('click', function() {
        if (currentPage < totalPages) {
            currentPage = totalPages;
            loadKeywords();
        }
    });

    function loadKeywords() {
        const projectId = $('#rs-kw-project-select').val();
        if (!projectId) return;

        const $tbody = $('#rs-keywords-tbody');
        $tbody.html('<tr><td colspan="6" class="rs-text-center">Loading keywords...</td></tr>');
        $('#rs-kw-select-all').prop('checked', false);
        updateSelectedCounter();

        const params = new URLSearchParams({
            project_id: projectId,
            page: currentPage,
            per_page: perPage,
            search: searchQuery
        });

        $.ajax({
            url: apiRoot + `keywords?${params.toString()}`,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(res) {
                $tbody.empty();

                // Handle both paginated response object and fallback raw array
                let items = [];
                if (res && res.items) {
                    items = res.items;
                    totalItems = res.total_items || 0;
                    totalPages = res.total_pages || 1;
                    currentPage = res.current_page || 1;
                } else if (Array.isArray(res)) {
                    items = res;
                    totalItems = res.length;
                    totalPages = 1;
                    currentPage = 1;
                }

                updatePaginationUI();

                if (!items || items.length === 0) {
                    const emptyMsg = searchQuery ? 'No keywords match your search query.' : 'No keywords tracked yet. Add your first keyword above.';
                    $tbody.append(`<tr><td colspan="6" class="rs-text-center">${emptyMsg}</td></tr>`);
                    return;
                }

                items.forEach(function(kw) {
                    let tagBadges = '';
                    if (kw.is_branded == 1) tagBadges += '<span class="rs-badge rs-badge-success" style="margin-right:4px;">Branded</span>';
                    if (kw.auto_tags) {
                        kw.auto_tags.split(',').forEach(t => {
                            let cleanT = t.trim();
                            if (cleanT && cleanT !== 'Branded') {
                                tagBadges += `<span class="rs-badge" style="background:#e0f2fe; color:#0369a1; margin-right:4px;">${cleanT}</span>`;
                            }
                        });
                    }
                    if (kw.tags) {
                        kw.tags.split(',').forEach(t => {
                            let cleanT = t.trim();
                            if (cleanT) {
                                tagBadges += `<span class="rs-badge" style="background:#f3e8ff; color:#6b21a8; margin-right:4px;">${cleanT}</span>`;
                            }
                        });
                    }

                    const addedDate = kw.added_date ? kw.added_date.substring(0, 10) : (kw.created_at ? kw.created_at.substring(0, 10) : '—');

                    $tbody.append(`
                        <tr>
                            <td><input type="checkbox" class="rs-kw-chk" data-id="${kw.id}" data-kw="${escapeHtml(kw.keyword)}" /></td>
                            <td>
                                <div class="rs-kw-cell-flex">
                                    <a href="#" class="rs-kw-title-link" data-id="${kw.id}" data-kw="${escapeHtml(kw.keyword)}" data-url="${escapeHtml(kw.target_url || '')}" style="color:#0b57d0; font-weight:600; text-decoration:none;">${escapeHtml(kw.keyword)}</a>
                                    <div class="rs-three-dots-wrap">
                                        <button type="button" class="rs-three-dots-btn" title="Options" data-kw="${escapeHtml(kw.keyword)}" data-id="${kw.id}">&#8942;</button>
                                        <div class="rs-three-dots-menu">
                                            <button type="button" class="rs-menu-item rs-action-serp-history" data-id="${kw.id}" data-kw="${escapeHtml(kw.keyword)}" data-url="${escapeHtml(kw.target_url || '')}">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                                                <span>SERP History</span>
                                            </button>
                                            <a href="https://www.google.com/search?q=${encodeURIComponent(kw.keyword)}" target="_blank" rel="noopener noreferrer" class="rs-menu-item rs-action-google-search">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                                <span>Search on Google</span>
                                            </a>
                                            <div class="rs-menu-divider"></div>
                                            <button type="button" class="rs-menu-item rs-action-copy-kw" data-kw="${escapeHtml(kw.keyword)}">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                <span>Copy Keyword</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td>${tagBadges || '—'}</td>
                            <td><a href="${escapeHtml(kw.target_url || '#')}" target="_blank" style="color:#0b57d0; text-decoration:none;">${escapeHtml(kw.target_url || '—')}</a></td>
                            <td><span style="font-size:12px; color:#64748b;">${addedDate}</span></td>
                            <td>
                                <div style="display:flex; gap:6px; align-items:center;">
                                    <button type="button" class="gsc-btn-action gsc-btn-blue rs-btn-serp-history" data-id="${kw.id}" data-kw="${escapeHtml(kw.keyword)}" data-url="${escapeHtml(kw.target_url || '')}" style="padding:3px 8px; font-size:11px;">SERP History</button>
                                    <button type="button" class="gsc-btn-action gsc-btn-red rs-btn-exclude-single" data-id="${kw.id}" data-kw="${escapeHtml(kw.keyword)}" style="padding:3px 8px; font-size:11px;">Exclude</button>
                                </div>
                            </td>
                        </tr>
                    `);
                });
            },
            error: function() {
                $tbody.html('<tr><td colspan="6" class="rs-text-center rs-text-danger">Failed to load keywords. Please try again.</td></tr>');
            }
        });
    }

    function updatePaginationUI() {
        if (totalItems === 0) {
            $('#rs-kw-showing-count').text('Showing 0 of 0 keywords');
            $('#rs-kw-page-info').text('Page 1 of 1');
            $('#rs-kw-page-display').text('1');
            $('#rs-kw-first, #rs-kw-prev, #rs-kw-next, #rs-kw-last').prop('disabled', true);
            return;
        }

        const startItem = (currentPage - 1) * perPage + 1;
        const endItem = Math.min(currentPage * perPage, totalItems);

        $('#rs-kw-showing-count').text(`Showing ${startItem.toLocaleString()}–${endItem.toLocaleString()} of ${totalItems.toLocaleString()} keywords`);
        $('#rs-kw-page-info').text(`Page ${currentPage.toLocaleString()} of ${totalPages.toLocaleString()}`);
        $('#rs-kw-page-display').text(currentPage.toLocaleString());

        $('#rs-kw-first, #rs-kw-prev').prop('disabled', currentPage <= 1);
        $('#rs-kw-next, #rs-kw-last').prop('disabled', currentPage >= totalPages);
    }

    // Checkbox selection logic
    $(document).on('change', '#rs-kw-select-all', function() {
        const checked = $(this).is(':checked');
        $('.rs-kw-chk').prop('checked', checked);
        updateSelectedCounter();
    });

    $(document).on('change', '.rs-kw-chk', function() {
        updateSelectedCounter();
    });

    function updateSelectedCounter() {
        const count = $('.rs-kw-chk:checked').length;
        $('#rs-kw-selected-count').text(count);
        if (count > 0) {
            $('#rs-btn-bulk-exclude-kw').show();
        } else {
            $('#rs-btn-bulk-exclude-kw').hide();
        }
    }

    // Add Keyword
    $('#rs-btn-add-kw').on('click', function() {
        const projectId = $('#rs-kw-project-select').val();
        const keyword = $('#rs-new-kw-text').val().trim();
        const isBranded = $('#rs-new-kw-branded').is(':checked') ? 1 : 0;

        if (!projectId) return alert('Please select a project first.');
        if (!keyword) return alert('Please enter a keyword.');

        $.ajax({
            url: apiRoot + 'keywords',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({
                project_id: projectId,
                keyword: keyword,
                is_branded: isBranded
            }),
            success: function() {
                $('#rs-new-kw-text').val('');
                currentPage = 1;
                loadKeywords();
            }
        });
    });

    // Single Exclude Action
    $(document).on('click', '.rs-btn-exclude-single', function() {
        const kw = $(this).data('kw');
        const projId = $('#rs-kw-project-select').val();

        if (!confirm(`Are you sure you want to exclude "${kw}" from active rank tracking?`)) return;

        $.ajax({
            url: apiRoot + 'keywords/bulk-exclude',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ project_id: projId, items: [kw] }),
            success: function(res) {
                loadKeywords();
            }
        });
    });

    // Bulk Exclude Selected Action
    $('#rs-btn-bulk-exclude-kw').on('click', function() {
        const projId = $('#rs-kw-project-select').val();
        let selectedKws = [];
        $('.rs-kw-chk:checked').each(function() {
            selectedKws.push($(this).data('kw'));
        });

        if (!selectedKws.length) return alert('Please select keywords to exclude.');

        if (!confirm(`Are you sure you want to exclude ${selectedKws.length} selected keywords? They will be moved to Skipped Keywords and no longer actively tracked.`)) return;

        $.ajax({
            url: apiRoot + 'keywords/bulk-exclude',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ project_id: projId, items: selectedKws }),
            success: function(res) {
                alert(res.message || 'Keywords excluded successfully.');
                loadKeywords();
            }
        });
    });

    // Multiline Paste Bulk Exclusion Modal
    $('#rs-btn-paste-exclude-modal').on('click', function() {
        $('#rs-bulk-modal-textarea').val('');
        $('#rs-bulk-exclude-modal').css('display', 'flex').show();
    });

    $('#rs-bulk-modal-close, #rs-bulk-modal-cancel').on('click', function() {
        $('#rs-bulk-exclude-modal').hide();
    });

    $('#rs-bulk-modal-confirm').on('click', function() {
        const projId = $('#rs-kw-project-select').val();
        if (!projId) return alert('Please select a project first.');

        const rawText = $('#rs-bulk-modal-textarea').val();
        if (!rawText.trim()) return alert('Please paste keywords to exclude.');

        const items = rawText.split('\n').map(s => s.trim()).filter(s => s.length > 0);

        if (!confirm(`Confirm bulk exclusion of ${items.length} keywords?`)) return;

        const $btn = $(this);
        $btn.text('Excluding...').prop('disabled', true);

        $.ajax({
            url: apiRoot + 'keywords/bulk-exclude',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ project_id: projId, items: items }),
            success: function(res) {
                $btn.text('Confirm & Exclude Keywords').prop('disabled', false);
                $('#rs-bulk-exclude-modal').hide();
                alert(res.message || 'Bulk exclusion completed.');
                currentPage = 1;
                loadKeywords();
            },
            error: function() {
                $btn.text('Confirm & Exclude Keywords').prop('disabled', false);
                alert('Bulk exclusion failed.');
            }
        });
    });

    // --- SERP & HISTORY INSPECTOR CONTROLLER ---
    let activeInspectorKeywordId = null;
    let activeInspectorKeywordName = '';
    let activeInspectorTargetUrl = '';
    let activeInspectorCountry = 'IN';
    let activeInspectorRange = '30d';
    let serpHistoryChart = null;

    // Three-dots dropdown toggle
    $(document).on('click', '.rs-three-dots-btn', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const $menu = $(this).siblings('.rs-three-dots-menu');
        $('.rs-three-dots-menu').not($menu).hide();
        $menu.toggle();
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.rs-three-dots-wrap').length) {
            $('.rs-three-dots-menu').hide();
        }
    });

    // Copy keyword action
    $(document).on('click', '.rs-action-copy-kw', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const kw = $(this).data('kw');
        if (!kw) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(kw).then(() => {
                const $span = $(this).find('span');
                const orig = $span.text();
                $span.text('Copied!').css('color', '#16a34a');
                setTimeout(() => {
                    $span.text(orig).css('color', '');
                    $('.rs-three-dots-menu').hide();
                }, 800);
            });
        }
    });

    // Open Inspector on clicking keyword title or "SERP History" button
    $(document).on('click', '.rs-kw-title-link, .rs-btn-serp-history, .rs-action-serp-history', function(e) {
        e.preventDefault();
        $('.rs-three-dots-menu').hide();
        activeInspectorKeywordId = $(this).data('id');
        activeInspectorKeywordName = $(this).data('kw');
        activeInspectorTargetUrl = $(this).data('url') || '';

        $('#rs-serp-kw-title').text(activeInspectorKeywordName);
        $('#rs-serp-country-select').val(activeInspectorCountry);
        $('#rs-serp-range-select').val(activeInspectorRange);

        // Reset tabs to Ranking History
        $('.rs-serp-tab-btn').removeClass('active').css({ 'color': '#64748b', 'border-bottom': '2px solid transparent' });
        $('.rs-serp-tab-btn[data-tab="ranking-history"]').addClass('active').css({ 'color': '#0b57d0', 'border-bottom': '2px solid #0b57d0' });
        $('.rs-serp-pane').hide();
        $('#rs-serp-pane-ranking-history').show();

        const $modal = $('#rs-serp-inspector-modal');
        if ($modal.parent().is(':not(body)')) {
            $modal.appendTo('body');
        }
        $modal.css('display', 'flex').show();
        loadSerpInspectorData();
    });

    // Tab switcher
    $(document).on('click', '.rs-serp-tab-btn', function() {
        const tab = $(this).data('tab');
        $('.rs-serp-tab-btn').removeClass('active').css({ 'color': '#64748b', 'border-bottom': '2px solid transparent' });
        $(this).addClass('active').css({ 'color': '#0b57d0', 'border-bottom': '2px solid #0b57d0' });

        $('.rs-serp-pane').hide();
        $(`#rs-serp-pane-${tab}`).show();

        if (tab === 'ranking-history' && serpHistoryChart) {
            serpHistoryChart.resize();
        }

        if (tab === 'why-moved') {
            populateWhyMovedTab();
        }
    });

    // Country change
    $('#rs-serp-country-select').on('change', function() {
        activeInspectorCountry = $(this).val();
        loadSerpInspectorData();
    });

    // Range change
    $('#rs-serp-range-select').on('change', function() {
        activeInspectorRange = $(this).val();
        loadSerpInspectorData();
    });

    // Close modal handlers
    $('#rs-serp-modal-close, #rs-serp-modal-close-btn').on('click', function() {
        $('#rs-serp-inspector-modal').hide();
    });

    $(document).on('click', '#rs-serp-inspector-modal', function(e) {
        if ($(e.target).is('#rs-serp-inspector-modal')) {
            $('#rs-serp-inspector-modal').hide();
        }
    });

    $(document).on('keydown', function(e) {
        if (e.key === 'Escape' && $('#rs-serp-inspector-modal').is(':visible')) {
            $('#rs-serp-inspector-modal').hide();
        }
    });

    // Fetch and populate Inspector Data
    function loadSerpInspectorData() {
        if (!activeInspectorKeywordId && !activeInspectorKeywordName) return;

        const projectId = $('#rs-kw-project-select').val() || $('#rs-project-select').val() || localStorage.getItem('rankstack_active_project') || '';
        const targetIdentifier = encodeURIComponent(activeInspectorKeywordName || activeInspectorKeywordId);
        const url = apiRoot + `serp-history?keyword=${targetIdentifier}&project_id=${projectId}&country=${activeInspectorCountry}&range=${activeInspectorRange}`;

        $('#rs-serp-kpi-current').text('Loading...');
        $('#rs-serp-kpi-delta').hide();
        $('#rs-serp-kpi-best').text('—');
        $('#rs-serp-kpi-avg').text('—');
        $('#rs-serp-kpi-days').text('—');
        $('#rs-serp-urls-tbody').html('<tr><td colspan="4" class="rs-text-center" style="padding:20px; color:#64748b;">Loading ranking URLs...</td></tr>');
        $('#rs-serp-board-scroll').html('<div style="padding:30px; color:#64748b; font-size:13px;">Loading SERP competitor movement...</div>');

        $.ajax({
            url: url,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(res) {
                if (!res || !res.success) return;

                // Header info
                $('#rs-serp-kw-title').text(res.keyword.name || activeInspectorKeywordName);
                $('#rs-serp-domain-display').text(res.domain || 'wpoets.com');
                $('#rs-serp-active-domain-tag').text(res.domain || 'wpoets.com');

                if (res.kpis && res.kpis.current_rank > 0) {
                    $('#rs-serp-kw-rank-badge').text('Rank #' + res.kpis.current_rank).show();
                } else {
                    $('#rs-serp-kw-rank-badge').text('Not in top 50').show();
                }

                // KPIs
                if (res.kpis) {
                    $('#rs-serp-kpi-current').text(res.kpis.current_rank > 0 ? res.kpis.current_rank : '—');
                    if (res.kpis.rank_change !== 0 && res.kpis.current_rank > 0) {
                        const isUp = res.kpis.rank_change > 0;
                        const deltaSign = isUp ? '+' : '';
                        $('#rs-serp-kpi-delta')
                            .text(deltaSign + res.kpis.rank_change)
                            .css({
                                'background': isUp ? '#dcfce7' : '#fee2e2',
                                'color': isUp ? '#16a34a' : '#dc2626'
                            })
                            .show();
                    } else {
                        $('#rs-serp-kpi-delta').hide();
                    }
                    $('#rs-serp-kpi-best').text(res.kpis.best_rank > 0 ? res.kpis.best_rank : '—');
                    $('#rs-serp-kpi-avg').text(res.kpis.average_rank > 0 ? res.kpis.average_rank : '—');
                    $('#rs-serp-kpi-days').text(res.kpis.days_ranked || '—');
                }

                // Chart.js Inverted Rank Graph
                renderSerpHistoryChart(res.chart);

                // Tab 2: Ranking URLs
                renderRankingUrlsTable(res.ranking_urls);

                // Tab 3: Multi-column SERP Board
                renderSerpHistoryBoard(res.serp_history, res.domain);

                // Cache for Why It Moved tab
                cachedSerpHistory = res.serp_history || [];
                cachedRankingUrls = res.ranking_urls || [];
                cachedDomain = res.domain || 'wpoets.com';

                if ($('.rs-serp-tab-btn[data-tab="why-moved"]').hasClass('active')) {
                    populateWhyMovedTab();
                }

                // Update Live Badge status
                const hasLiveCol = res.serp_history && res.serp_history.some(col => col.is_live);
                if (hasLiveCol) {
                    $('#rs-serp-live-badge').text('Live Google SERP').css({ 'background': '#dcfce7', 'color': '#166534' });
                } else if (res.has_serp_key) {
                    $('#rs-serp-live-badge').text('GSC Baseline (Click Fetch Live)').css({ 'background': '#fef9c3', 'color': '#854d0e' });
                } else {
                    $('#rs-serp-live-badge').text('GSC Baseline (Connect SerpApi in Settings)').css({ 'background': '#f1f5f9', 'color': '#64748b' });
                }
            },
            error: function() {
                $('#rs-serp-kpi-current').text('Error');
                $('#rs-serp-urls-tbody').html('<tr><td colspan="4" class="rs-text-center rs-text-danger" style="padding:20px;">Failed to load ranking data.</td></tr>');
                $('#rs-serp-board-scroll').html('<div style="padding:30px; color:#dc2626; font-size:13px;">Failed to load SERP history.</div>');
            }
        });
    }

    function renderSerpHistoryChart(chartData) {
        const ctx = document.getElementById('rs-serp-history-chart');
        if (!ctx) return;

        if (serpHistoryChart) {
            serpHistoryChart.destroy();
            serpHistoryChart = null;
        }

        const labels = (chartData && chartData.labels) ? chartData.labels : [];
        const positions = (chartData && chartData.positions) ? chartData.positions : [];

        // Find min and max for sensible inverted bounds
        const validRanks = positions.filter(p => p !== null && p > 0);
        const minRank = validRanks.length ? Math.min(...validRanks) : 1;
        const maxRank = validRanks.length ? Math.max(...validRanks) : 30;
        const suggestedMin = Math.max(1, minRank - 2);
        const suggestedMax = Math.min(100, maxRank + 4);

        serpHistoryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Rank Position',
                    data: positions,
                    borderColor: '#0b57d0',
                    backgroundColor: 'rgba(11, 87, 208, 0.06)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#0b57d0',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.3,
                    fill: true,
                    spanGaps: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleColor: '#f8fafc',
                        bodyColor: '#ffffff',
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed.y;
                                return val ? `Rank Position: #${val}` : 'Not in top 50';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        reverse: true, // Inverted Y-axis (Rank 1 at top!)
                        suggestedMin: suggestedMin,
                        suggestedMax: suggestedMax,
                        ticks: {
                            stepSize: 5,
                            callback: function(val) { return '#' + val; },
                            color: '#64748b',
                            font: { size: 11, weight: 600 }
                        },
                        grid: { color: '#f1f5f9' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxTicksLimit: 12,
                            color: '#64748b',
                            font: { size: 11 }
                        }
                    }
                }
            }
        });
    }

    function renderRankingUrlsTable(rankingUrls) {
        const $tbody = $('#rs-serp-urls-tbody');
        $tbody.empty();

        if (!rankingUrls || !rankingUrls.length) {
            $tbody.html('<tr><td colspan="4" class="rs-text-center" style="padding:20px; color:#64748b;">No ranking history recorded for this period.</td></tr>');
            return;
        }

        rankingUrls.forEach(function(item) {
            let rankDisplay = `<span style="font-weight:700; color:#0f172a; font-size:14px;">${item.rank}</span>`;
            if (item.rank_change > 0) {
                rankDisplay += ` <span style="font-size:11px; font-weight:600; color:#16a34a; background:#dcfce7; padding:1px 5px; border-radius:4px; margin-left:4px;">+${item.rank_change}</span>`;
            } else if (item.rank_change < 0) {
                rankDisplay += ` <span style="font-size:11px; font-weight:600; color:#dc2626; background:#fee2e2; padding:1px 5px; border-radius:4px; margin-left:4px;">${item.rank_change}</span>`;
            }

            $tbody.append(`
                <tr>
                    <td style="font-size:12px; color:#475569; font-weight:500;">${item.date}</td>
                    <td>${rankDisplay}</td>
                    <td><a href="${escapeHtml(item.url)}" target="_blank" style="color:#0b57d0; text-decoration:none; font-size:13px;">${escapeHtml(item.url)}</a></td>
                    <td style="text-align:right;">
                        <button type="button" class="gsc-btn-action gsc-btn-gray rs-jump-to-serp" data-date="${item.date}" style="padding:3px 8px; font-size:11px;">View SERP</button>
                    </td>
                </tr>
            `);
        });
    }

    // Switch to Tab 3 on clicking "View SERP" from Ranking URLs
    $(document).on('click', '.rs-jump-to-serp', function() {
        const targetDate = $(this).data('date');
        $('.rs-serp-tab-btn[data-tab="serp-history"]').trigger('click');

        setTimeout(function() {
            const $col = $(`#rs-serp-col-${targetDate}`);
            if ($col.length) {
                const scrollLeft = $col.position().left + $('#rs-serp-board-scroll').scrollLeft() - 20;
                $('#rs-serp-board-scroll').animate({ scrollLeft: scrollLeft }, 300);
                $col.css({ 'border-color': '#0b57d0', 'box-shadow': '0 0 0 2px rgba(11,87,208,0.2)' });
                setTimeout(() => { $col.css({ 'border-color': '#e2e8f0', 'box-shadow': 'none' }); }, 1500);
            }
        }, 150);
    });

    function renderSerpHistoryBoard(serpHistory, targetDomain) {
        const $board = $('#rs-serp-board-scroll');
        $board.empty();

        if (!serpHistory || !serpHistory.length) {
            $board.html('<div style="padding:30px; color:#64748b; font-size:13px;">No SERP snapshots available for this timeframe.</div>');
            return;
        }

        serpHistory.forEach(function(col) {
            const isRanked = col.target_rank && col.target_rank > 0;
            const rankClass = isRanked ? 'is-ranked' : 'not-ranked';

            let itemsHtml = '';
            col.items.forEach(function(item) {
                const targetClass = item.is_target ? 'is-target' : '';
                const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(item.domain)}&sz=32`;

                itemsHtml += `
                    <div class="rs-serp-item ${targetClass}" data-domain="${escapeHtml(item.domain)}" title="${escapeHtml(item.title)}">
                        <span class="rs-serp-pos-num">${item.position}</span>
                        <img src="${favicon}" class="rs-serp-favicon" alt="" onerror="this.style.display='none'" />
                        <span class="rs-serp-url-text">${escapeHtml(item.url)}</span>
                    </div>
                `;
            });

            $board.append(`
                <div class="rs-serp-col" id="rs-serp-col-${col.date}">
                    <div class="rs-serp-col-header">
                        <span class="rs-serp-col-date">${col.date}</span>
                        <span class="rs-serp-col-rank ${rankClass}">${col.status_label}</span>
                    </div>
                    <div class="rs-serp-col-list">
                        ${itemsHtml}
                    </div>
                </div>
            `);
        });
    }

    // Interactive Competitor Tracing across daily columns!
    $(document).on('click', '.rs-serp-item', function(e) {
        const domain = $(this).data('domain');
        if (!domain) return;

        const isAlreadyTraced = $(this).hasClass('is-traced');
        $('.rs-serp-item').removeClass('is-traced');

        if (!isAlreadyTraced) {
            $(`.rs-serp-item[data-domain="${domain}"]`).addClass('is-traced');
        }
    });

    // Live Google SERP Scrape Trigger
    $(document).on('click', '#rs-btn-fetch-live-serp', function(e) {
        e.preventDefault();
        const $btn = $(this);
        const origText = $btn.html();
        const projectId = $('#rs-kw-project-select').val() || $('#rs-project-select').val() || localStorage.getItem('rankstack_active_project') || '';

        $btn.html('<span>Scraping Google...</span>').prop('disabled', true);

        $.ajax({
            url: apiRoot + 'serp/live-fetch',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) {
                if (nonce) xhr.setRequestHeader('X-WP-Nonce', nonce);
            },
            data: JSON.stringify({
                keyword: activeInspectorKeywordName || activeInspectorKeywordId,
                country: activeInspectorCountry,
                project_id: projectId
            }),
            success: function(res) {
                $btn.html(origText).prop('disabled', false);
                if (res.success && res.snapshot) {
                    loadSerpInspectorData();
                }
            },
            error: function(xhr) {
                $btn.html(origText).prop('disabled', false);
                const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'Please configure your SerpApi key in Settings -> SERP Scraping & Competitors to fetch live Google results.';
                alert(msg);
            }
        });
    });

    // --- WHY IT MOVED (CONTENT & INCIDENT DIFF ENGINE) ---

    function populateWhyMovedTab() {
        const $urlSelect = $('#rs-why-url-select');
        $urlSelect.empty();

        const urls = [];
        // Target domain URLs from GSC
        if (cachedRankingUrls && cachedRankingUrls.length) {
            cachedRankingUrls.forEach(u => {
                if (u.url && !urls.some(item => item.url === u.url)) {
                    urls.push({ label: `[Our Site] ${u.url} (Rank #${u.position || '—'})`, url: u.url, isTarget: true, pos: u.position || 0 });
                }
            });
        }

        // Competitors from SERP History / Live Scraping
        if (cachedSerpHistory && cachedSerpHistory.length) {
            cachedSerpHistory.forEach(col => {
                if (col.items && col.items.length) {
                    col.items.forEach(it => {
                        if (it.url && !urls.some(item => item.url === it.url)) {
                            const isOur = it.is_target || (it.domain && it.domain.indexOf(cachedDomain) !== -1);
                            urls.push({
                                label: `[${isOur ? 'Our Site' : (it.domain || 'Competitor')}] ${it.title ? it.title.substring(0, 36) + '... ' : ''}(#${it.position})`,
                                url: it.url,
                                isTarget: isOur,
                                pos: it.position || 0
                            });
                        }
                    });
                }
            });
        }

        if (urls.length === 0) {
            $urlSelect.html('<option value="">No URLs discovered yet. Fetch live SERP first.</option>');
        } else {
            urls.forEach((u, i) => {
                $urlSelect.append(`<option value="${escapeHtml(u.url)}" ${i === 0 ? 'selected' : ''}>${escapeHtml(u.label)}</option>`);
            });
        }

        // Default comparison: 7 days ago to today
        const now = new Date();
        const toDate = now.toISOString().split('T')[0];
        const fromDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
        if (!$('#rs-why-date-from').val()) $('#rs-why-date-from').val(fromDate);
        if (!$('#rs-why-date-to').val()) $('#rs-why-date-to').val(toDate);

        // Auto-run diagnosis if a valid URL is present
        if ($urlSelect.val()) {
            runMovementDiagnosis();
        }
    }

    $(document).on('click', '#rs-btn-run-diagnosis', function(e) {
        e.preventDefault();
        runMovementDiagnosis();
    });

    function runMovementDiagnosis() {
        const url = $('#rs-why-url-select').val();
        const dateFrom = $('#rs-why-date-from').val();
        const dateTo = $('#rs-why-date-to').val();
        const keyword = activeInspectorKeywordName || 'keyword';

        if (!url) {
            alert('Please select a URL to diagnose.');
            return;
        }

        const $res = $('#rs-why-diagnosis-result');
        $res.html(`
            <div style="text-align:center; padding:50px 20px; color:#64748b;">
                <div style="font-size:26px; margin-bottom:12px;">🔍</div>
                <div style="font-size:14px; font-weight:700; color:#1e293b;">Diagnosing Movement, Headings, Word Count & Google Update Impact...</div>
                <div style="font-size:12px; color:#94a3b8; margin-top:6px;">Inspecting: ${escapeHtml(url)}</div>
            </div>
        `);

        $.ajax({
            url: apiRoot + `page-inspector/diff?url=${encodeURIComponent(url)}&query=${encodeURIComponent(keyword)}&date_old=${dateFrom}&date_new=${dateTo}`,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(res) {
                renderMovementDiagnosisResult(res);
            },
            error: function() {
                $res.html(`
                    <div style="padding:20px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; color:#991b1b; font-size:13px;">
                        Failed to retrieve on-page diff diagnostics for this URL. Please verify URL availability or try again.
                    </div>
                `);
            }
        });
    }

    function renderMovementDiagnosisResult(data) {
        const $res = $('#rs-why-diagnosis-result');
        if (!data) return;

        let reasonsHtml = '';
        if (data.reasons && data.reasons.length) {
            reasonsHtml = data.reasons.map(r => `
                <div class="rs-why-reason-card ${r.severity === 'major' ? 'rs-why-major' : ''}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                        <span class="rs-badge rs-why-badge-${r.severity}">${escapeHtml(r.badge)}</span>
                        ${r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" style="font-size:11px; color:#0b57d0; text-decoration:none; font-weight:600;">Official Incident Report &rarr;</a>` : ''}
                    </div>
                    <div style="font-size:14px; font-weight:700; color:#0f172a; margin:8px 0 3px 0;">${escapeHtml(r.title)}</div>
                    <div style="font-size:12px; color:#475569; line-height:1.5;">${escapeHtml(r.detail)}</div>
                </div>
            `).join('');
        } else {
            reasonsHtml = `<div style="padding:16px; color:#64748b; font-size:13px; background:#f8fafc; border-radius:8px;">No anomalous ranking volatility triggers detected during this window.</div>`;
        }

        let diffsRowsHtml = '';
        if (data.diffs && data.diffs.length) {
            diffsRowsHtml = data.diffs.map(d => `
                <tr>
                    <td style="font-weight:600; color:#1e293b;">${escapeHtml(d.element)}</td>
                    <td style="color:#64748b; font-size:12px; background:#fff1f2;">${escapeHtml(d.old_value || '—')}</td>
                    <td style="color:#0f172a; font-size:12px; font-weight:600; background:#f0fdf4;">${escapeHtml(d.new_value || '—')}</td>
                    <td style="font-size:11px; font-weight:600; color:#0b57d0;">${escapeHtml(d.impact || '—')}</td>
                </tr>
            `).join('');
        } else {
            diffsRowsHtml = `<tr><td colspan="4" style="text-align:center; padding:16px; color:#64748b; font-size:12px;">On-page HTML metadata remained consistent between these dates.</td></tr>`;
        }

        const snapOld = data.snap_old || {};
        const snapNew = data.snap_new || {};

        const beforeDate = (data.date_old || (snapOld && snapOld.snapshot_date) || 'Previous Window');
        const afterDate = (data.date_new || (snapNew && snapNew.snapshot_date) || 'Current Window');

        const oldFetchErr = snapOld.fetch_error || (snapOld.http_status >= 400 ? `HTTP ${snapOld.http_status}` : '');
        const newFetchErr = snapNew.fetch_error || (snapNew.http_status >= 400 ? `HTTP ${snapNew.http_status}` : '');

        const wordCountOldHtml = oldFetchErr
            ? `<span style="color:#ef4444; font-weight:600;">Unavailable (${escapeHtml(oldFetchErr)})</span>`
            : `${Number(snapOld.word_count || 0).toLocaleString()} words`;

        const wordCountNewHtml = newFetchErr
            ? `<span style="color:#ef4444; font-weight:600;">Unavailable (${escapeHtml(newFetchErr)})</span>`
            : `${Number(snapNew.word_count || 0).toLocaleString()} words`;

        const schemasOldHtml = oldFetchErr
            ? `<span style="color:#94a3b8;">Unavailable (${escapeHtml(oldFetchErr)})</span>`
            : escapeHtml((snapOld.schemas && snapOld.schemas.length) ? snapOld.schemas.join(', ') : 'None');

        const schemasNewHtml = newFetchErr
            ? `<span style="color:#ef4444; font-weight:600;">Unavailable (${escapeHtml(newFetchErr)})</span>`
            : escapeHtml((snapNew.schemas && snapNew.schemas.length) ? snapNew.schemas.join(', ') : 'None');

        const p = data.pillars || {};
        const pAlgo = p.algorithm_update || { name: 'Google Algorithm update', status: 'No Update', detail: 'SERP baseline calm', active: false };
        const pContent = p.content_changes || { name: 'Content Changes (website Diff)', status: 'Unchanged', add_section: 'Stable', interlinking: 'Stable', active: false };
        const pBacklinks = p.backlinks || { name: 'Backlinks', status: 'Stable', detail: 'Profile stable', active: false };
        const pCluster = p.topic_cluster || { name: 'New Content Published (Topic Cluster)', status: 'Single URL', detail: 'Cluster coverage assessed', active: false };

        const internalLinksOld = snapOld.internal_links_count !== undefined ? `${Number(snapOld.internal_links_count).toLocaleString()} internal links` : '—';
        const internalLinksNew = snapNew.internal_links_count !== undefined ? `${Number(snapNew.internal_links_count).toLocaleString()} internal links` : '—';

        $res.html(`
            <!-- 4-Pillar Ranking Changes Attribution Summary -->
            <div style="margin-bottom:22px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">
                        🎯 Ranking Changes Attribution (4 Pillars)
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <a href="admin.php?page=rankstack-diff-checker&url=${encodeURIComponent(data.url)}&query=${encodeURIComponent(data.query || '')}&date_from=${encodeURIComponent(data.date_old || '')}&date_to=${encodeURIComponent(data.date_new || '')}" target="_blank" style="font-size:11px; font-weight:700; color:#0b57d0; text-decoration:none; background:#eff6ff; border:1px solid #bfdbfe; padding:2px 10px; border-radius:12px;">
                            Open Full Diff Checker &rarr;
                        </a>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px;">
                    <!-- 1. ✨ Google Algorithm update -->
                    <div style="background:#ffffff; border:1px solid ${pAlgo.active ? '#fca5a5' : '#e2e8f0'}; border-radius:8px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="font-size:12px; font-weight:700; color:#1e293b;">✨ Google Algorithm update</span>
                            <span class="rs-badge" style="font-size:10px; background:${pAlgo.active ? '#fee2e2' : '#f1f5f9'}; color:${pAlgo.active ? '#b91c1c' : '#64748b'};">${escapeHtml(pAlgo.status)}</span>
                        </div>
                        <div style="font-size:11px; color:#64748b; line-height:1.4;">${escapeHtml(pAlgo.detail)}</div>
                    </div>

                    <!-- 2. Content Changes (website Diff) -->
                    <div style="background:#ffffff; border:1px solid ${pContent.active ? '#86efac' : '#e2e8f0'}; border-radius:8px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="font-size:12px; font-weight:700; color:#1e293b;">📝 Content Changes (website Diff)</span>
                            <span class="rs-badge" style="font-size:10px; background:${pContent.active ? '#dcfce7' : '#f1f5f9'}; color:${pContent.active ? '#15803d' : '#64748b'};">${escapeHtml(pContent.status)}</span>
                        </div>
                        <div style="font-size:11px; color:#475569; display:flex; flex-direction:column; gap:2px;">
                            <div><span style="font-weight:600; color:#0f172a;">Add new section:</span> ${escapeHtml(pContent.add_section)}</div>
                            <div><span style="font-weight:600; color:#0f172a;">Interlinking:</span> ${escapeHtml(pContent.interlinking)}</div>
                        </div>
                    </div>

                    <!-- 3. Backlinks -->
                    <div style="background:#ffffff; border:1px solid ${pBacklinks.active ? '#93c5fd' : '#e2e8f0'}; border-radius:8px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="font-size:12px; font-weight:700; color:#1e293b;">🔗 Backlinks</span>
                            <span class="rs-badge" style="font-size:10px; background:${pBacklinks.active ? '#e0f2fe' : '#f1f5f9'}; color:${pBacklinks.active ? '#0369a1' : '#64748b'};">${escapeHtml(pBacklinks.status)}</span>
                        </div>
                        <div style="font-size:11px; color:#64748b; line-height:1.4;">${escapeHtml(pBacklinks.detail)}</div>
                    </div>

                    <!-- 4. New Content Published (Topic Cluster) -->
                    <div style="background:#ffffff; border:1px solid ${pCluster.active ? '#fde68a' : '#e2e8f0'}; border-radius:8px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="font-size:12px; font-weight:700; color:#1e293b;">📚 New Content Published</span>
                            <span class="rs-badge" style="font-size:10px; background:${pCluster.active ? '#fef3c7' : '#f1f5f9'}; color:${pCluster.active ? '#b45309' : '#64748b'};">${escapeHtml(pCluster.status)}</span>
                        </div>
                        <div style="font-size:11px; color:#64748b; line-height:1.4;">${escapeHtml(pCluster.detail)}</div>
                    </div>
                </div>
            </div>

            <!-- Top Impact Reason Cards -->
            <div style="margin-bottom:20px;">
                <div style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
                    Root-Cause Diagnosis & Factor Attribution
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
                    ${reasonsHtml}
                </div>
            </div>

            <!-- Side-by-Side HTML & Content Diff Table -->
            <div style="margin-top:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">
                        On-Page Content & HTML Metadata Changes
                    </div>
                    <span style="font-size:11px; color:#94a3b8;">Inspected Page: ${escapeHtml(data.url)}</span>
                </div>
                <table class="rs-table" style="width:100%; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                    <thead>
                        <tr style="background:#f8fafc;">
                            <th style="width:140px;">Element</th>
                            <th>Before (${escapeHtml(beforeDate)})</th>
                            <th>After (${escapeHtml(afterDate)})</th>
                            <th style="width:180px;">SEO Impact</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${diffsRowsHtml}
                        <tr>
                            <td style="font-weight:600; color:#1e293b;">Active Schemas</td>
                            <td style="font-size:11px; color:#64748b;">${schemasOldHtml}</td>
                            <td style="font-size:11px; color:#0f172a; font-weight:600;">${schemasNewHtml}</td>
                            <td style="font-size:11px; color:#64748b;">SERP Rich Snippets Eligibility</td>
                        </tr>
                        <tr>
                            <td style="font-weight:600; color:#1e293b;">Word Count</td>
                            <td style="font-size:12px; color:#64748b;">${wordCountOldHtml}</td>
                            <td style="font-size:12px; color:#0f172a; font-weight:600;">${wordCountNewHtml}</td>
                            <td style="font-size:11px; color:#64748b;">Topical Depth & Coverage</td>
                        </tr>
                        <tr>
                            <td style="font-weight:600; color:#1e293b;">Interlinking (Internal Links)</td>
                            <td style="font-size:12px; color:#64748b;">${internalLinksOld}</td>
                            <td style="font-size:12px; color:#0f172a; font-weight:600;">${internalLinksNew}</td>
                            <td style="font-size:11px; color:#64748b;">Internal Link Equity Flow</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `);
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
});
