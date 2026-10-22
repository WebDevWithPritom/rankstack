jQuery(document).ready(function($) {
    const apiRoot = (typeof RankStackData !== 'undefined' && RankStackData.root) ? RankStackData.root : '/wp-json/rankstack/v1/';
    const nonce = (typeof RankStackData !== 'undefined' && RankStackData.nonce) ? RankStackData.nonce : '';

    // Check URL query parameters for auto-running diff from links
    initFromQueryParams();

    // Preset Date Range Click Handler
    $('.rs-dc-preset-btn').on('click', function(e) {
        e.preventDefault();
        $('.rs-dc-preset-btn').removeClass('active').css({ 'background': '', 'color': '', 'border-color': '' });
        $(this).addClass('active').css({ 'background': '#e0f2fe', 'color': '#0369a1', 'border-color': '#7dd3fc' });

        const days = parseInt($(this).data('days'), 10) || 30;
        const now = new Date();
        const fromDate = new Date();
        fromDate.setDate(now.getDate() - days);

        $('#rs-dc-date-to').val(formatDate(now));
        $('#rs-dc-date-from').val(formatDate(fromDate));
    });

    // Run Diff Button Handler
    $('#rs-dc-btn-run').on('click', function(e) {
        e.preventDefault();
        runDiff();
    });

    // Crawl Live Page Button Handler
    $('#rs-dc-btn-crawl').on('click', function(e) {
        e.preventDefault();
        crawlLivePage();
    });

    // Enter key triggers diff on inputs
    $('#rs-dc-url, #rs-dc-query').on('keypress', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            runDiff();
        }
    });

    function initFromQueryParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const paramUrl = urlParams.get('url');
        const paramQuery = urlParams.get('query');
        const paramDateFrom = urlParams.get('date_from');
        const paramDateTo = urlParams.get('date_to');

        if (paramUrl) {
            $('#rs-dc-url').val(paramUrl);
        }
        if (paramQuery) {
            $('#rs-dc-query').val(paramQuery);
        }
        if (paramDateFrom) {
            $('#rs-dc-date-from').val(paramDateFrom);
        }
        if (paramDateTo) {
            $('#rs-dc-date-to').val(paramDateTo);
        }

        // Auto-run if URL is present in query parameters
        if (paramUrl) {
            setTimeout(runDiff, 300);
        }
    }

    function runDiff() {
        const url = $('#rs-dc-url').val().trim();
        const query = $('#rs-dc-query').val().trim();
        const dateFrom = $('#rs-dc-date-from').val();
        const dateTo = $('#rs-dc-date-to').val();

        if (!url) {
            alert('Please select or enter a landing page URL to inspect.');
            $('#rs-dc-url').focus();
            return;
        }

        const $res = $('#rs-dc-result-container');
        $res.html(`
            <div style="text-align:center; padding:70px 20px; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; color:#64748b;">
                <div style="font-size:30px; margin-bottom:12px; animation:spin 1s linear infinite;">🔍</div>
                <div style="font-size:16px; font-weight:700; color:#1e293b;">Running Website Diff & 4-Pillar Ranking Attribution...</div>
                <div style="font-size:12px; color:#94a3b8; margin-top:6px;">Inspecting: <span style="color:#0b57d0; font-weight:600;">${escapeHtml(url)}</span></div>
                <div style="font-size:11px; color:#cbd5e1; margin-top:8px;">Comparing baseline (${escapeHtml(dateFrom)}) &rarr; current (${escapeHtml(dateTo)})</div>
            </div>
        `);

        const apiUrl = apiRoot + `page-inspector/diff?url=${encodeURIComponent(url)}&query=${encodeURIComponent(query)}&date_old=${dateFrom}&date_new=${dateTo}`;

        $.ajax({
            url: apiUrl,
            method: 'GET',
            beforeSend: function(xhr) {
                if (nonce) xhr.setRequestHeader('X-WP-Nonce', nonce);
            },
            success: function(data) {
                renderDiffResults(data);
            },
            error: function(xhr) {
                const msg = (xhr.responseJSON && xhr.responseJSON.message) ? xhr.responseJSON.message : 'Failed to retrieve website diff diagnostics.';
                $res.html(`
                    <div style="padding:24px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; color:#991b1b; font-size:13px;">
                        <div style="font-weight:700; font-size:14px; margin-bottom:6px;">⚠️ Diff Inspection Failed</div>
                        <div>${escapeHtml(msg)}</div>
                        <div style="margin-top:12px;">
                            <button type="button" class="rs-btn-secondary" onclick="jQuery('#rs-dc-btn-crawl').click()" style="font-size:12px;">
                                🔄 Try Crawling Live URL First
                            </button>
                        </div>
                    </div>
                `);
            }
        });
    }

    function crawlLivePage() {
        const url = $('#rs-dc-url').val().trim();
        const query = $('#rs-dc-query').val().trim();
        const dateTo = $('#rs-dc-date-to').val() || formatDate(new Date());

        if (!url) {
            alert('Please select or enter a landing page URL to crawl.');
            $('#rs-dc-url').focus();
            return;
        }

        const $btn = $('#rs-dc-btn-crawl');
        const origText = $btn.html();
        $btn.html('<span>⏳</span> Crawling...').prop('disabled', true);

        $.ajax({
            url: apiRoot + 'page-inspector/analyze',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                url: url,
                query: query,
                date: dateTo
            }),
            beforeSend: function(xhr) {
                if (nonce) xhr.setRequestHeader('X-WP-Nonce', nonce);
            },
            success: function(res) {
                $btn.html(origText).prop('disabled', false);
                runDiff();
            },
            error: function(xhr) {
                $btn.html(origText).prop('disabled', false);
                const msg = (xhr.responseJSON && xhr.responseJSON.message) ? xhr.responseJSON.message : 'Could not crawl URL.';
                alert('Crawl error: ' + msg);
            }
        });
    }

    function renderDiffResults(data) {
        const $res = $('#rs-dc-result-container');
        if (!data) return;

        const p = data.pillars || {};
        const pAlgo = p.algorithm_update || { name: 'Google Algorithm update', status: 'No Update', detail: 'SERP baseline calm', active: false };
        const pContent = p.content_changes || { name: 'Content Changes (website Diff)', status: 'Unchanged', add_section: 'Stable', interlinking: 'Stable', active: false };
        const pBacklinks = p.backlinks || { name: 'Backlinks', status: 'Stable', detail: 'Profile stable', active: false };
        const pCluster = p.topic_cluster || { name: 'New Content Published (Topic Cluster)', status: 'Single URL', detail: 'Cluster coverage assessed', active: false };

        const snapOld = data.snap_old || {};
        const snapNew = data.snap_new || {};

        const beforeDate = (data.date_old || (snapOld && snapOld.snapshot_date) || 'Previous Window');
        const afterDate = (data.date_new || (snapNew && snapNew.snapshot_date) || 'Current Window');

        // Reasons cards
        let reasonsHtml = '';
        if (data.reasons && data.reasons.length) {
            reasonsHtml = data.reasons.map(r => `
                <div class="rs-why-reason-card ${r.severity === 'major' ? 'rs-why-major' : ''}" style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                        <span class="rs-badge rs-why-badge-${r.severity}">${escapeHtml(r.badge)}</span>
                        ${r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" style="font-size:11px; color:#0b57d0; text-decoration:none; font-weight:600;">Official Incident Report &rarr;</a>` : ''}
                    </div>
                    <div style="font-size:14px; font-weight:700; color:#0f172a; margin:8px 0 3px 0;">${escapeHtml(r.title)}</div>
                    <div style="font-size:12px; color:#475569; line-height:1.5;">${escapeHtml(r.detail)}</div>
                </div>
            `).join('');
        } else {
            reasonsHtml = `<div style="padding:16px; color:#64748b; font-size:13px; background:#f8fafc; border-radius:8px; grid-column: 1 / -1;">No anomalous ranking volatility triggers detected during this window.</div>`;
        }

        // Diffs rows
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

        // Heading sections breakdown
        const oldH2List = Array.isArray(snapOld.h2_list) ? snapOld.h2_list : (parseJsonSafe(snapOld.h2_list) || []);
        const newH2List = Array.isArray(snapNew.h2_list) ? snapNew.h2_list : (parseJsonSafe(snapNew.h2_list) || []);

        const addedHeadings = newH2List.filter(h => !oldH2List.includes(h));
        const removedHeadings = oldH2List.filter(h => !newH2List.includes(h));
        const preservedHeadings = newH2List.filter(h => oldH2List.includes(h));

        let headingsDiffHtml = '';
        if (oldH2List.length === 0 && newH2List.length === 0) {
            headingsDiffHtml = `<div style="padding:16px; color:#94a3b8; font-size:12px;">No H2 heading sections detected on this page.</div>`;
        } else {
            headingsDiffHtml = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                    <div>
                        <div style="font-size:12px; font-weight:700; color:#64748b; margin-bottom:8px;">Before (${escapeHtml(beforeDate)}) — ${oldH2List.length} Section(s)</div>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            ${oldH2List.length ? oldH2List.map(h => {
                                const isRemoved = removedHeadings.includes(h);
                                return `
                                    <div style="padding:6px 10px; border-radius:6px; font-size:12px; background:${isRemoved ? '#fee2e2' : '#f8fafc'}; color:${isRemoved ? '#991b1b' : '#334155'}; border:1px solid ${isRemoved ? '#fecaca' : '#e2e8f0'}; display:flex; justify-content:space-between; align-items:center;">
                                        <span>${escapeHtml(h)}</span>
                                        ${isRemoved ? `<span class="rs-badge" style="font-size:10px; background:#ef4444; color:#fff;">REMOVED</span>` : ''}
                                    </div>
                                `;
                            }).join('') : '<div style="color:#94a3b8; font-size:12px;">No headings</div>'}
                        </div>
                    </div>
                    <div>
                        <div style="font-size:12px; font-weight:700; color:#64748b; margin-bottom:8px;">After (${escapeHtml(afterDate)}) — ${newH2List.length} Section(s)</div>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            ${newH2List.length ? newH2List.map(h => {
                                const isAdded = addedHeadings.includes(h);
                                return `
                                    <div style="padding:6px 10px; border-radius:6px; font-size:12px; background:${isAdded ? '#dcfce7' : '#f8fafc'}; color:${isAdded ? '#166534' : '#334155'}; border:1px solid ${isAdded ? '#bbf7d0' : '#e2e8f0'}; display:flex; justify-content:space-between; align-items:center;">
                                        <span>${escapeHtml(h)}</span>
                                        ${isAdded ? `<span class="rs-badge" style="font-size:10px; background:#10b981; color:#fff;">+ ADDED</span>` : ''}
                                    </div>
                                `;
                            }).join('') : '<div style="color:#94a3b8; font-size:12px;">No headings</div>'}
                        </div>
                    </div>
                </div>
            `;
        }

        const internalLinksOld = snapOld.internal_links_count !== undefined ? `${Number(snapOld.internal_links_count).toLocaleString()} links` : '—';
        const internalLinksNew = snapNew.internal_links_count !== undefined ? `${Number(snapNew.internal_links_count).toLocaleString()} links` : '—';

        const wordCountOld = snapOld.word_count !== undefined ? `${Number(snapOld.word_count).toLocaleString()} words` : '—';
        const wordCountNew = snapNew.word_count !== undefined ? `${Number(snapNew.word_count).toLocaleString()} words` : '—';

        const schemasOld = (snapOld.schemas && snapOld.schemas.length) ? (Array.isArray(snapOld.schemas) ? snapOld.schemas.join(', ') : snapOld.schemas) : 'None';
        const schemasNew = (snapNew.schemas && snapNew.schemas.length) ? (Array.isArray(snapNew.schemas) ? snapNew.schemas.join(', ') : snapNew.schemas) : 'None';

        $res.html(`
            <!-- 1. Executive 4-Pillar Ranking Changes Summary -->
            <div class="rs-card" style="margin-bottom:20px; padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                    <div>
                        <h2 style="font-size:15px; font-weight:700; color:#1e293b; margin:0;">🎯 Ranking Changes Attribution (4 Pillars)</h2>
                        <div style="font-size:12px; color:#64748b; margin-top:2px;">Automated evaluation of algorithm shifts, on-page diffs, backlinks, and topic clusters</div>
                    </div>
                    <span style="font-size:11px; font-weight:600; color:#0b57d0; background:#eff6ff; border:1px solid #bfdbfe; padding:3px 10px; border-radius:12px;">
                        Status: Evaluated
                    </span>
                </div>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:12px;">
                    <!-- Pillar 1: ✨ Google Algorithm update -->
                    <div style="background:#ffffff; border:1px solid ${pAlgo.active ? '#fca5a5' : '#e2e8f0'}; border-radius:8px; padding:14px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="font-size:13px; font-weight:700; color:#1e293b;">✨ Google Algorithm update</span>
                            <span class="rs-badge" style="font-size:10px; background:${pAlgo.active ? '#fee2e2' : '#f1f5f9'}; color:${pAlgo.active ? '#b91c1c' : '#64748b'};">${escapeHtml(pAlgo.status)}</span>
                        </div>
                        <div style="font-size:12px; color:#64748b; line-height:1.4;">${escapeHtml(pAlgo.detail)}</div>
                    </div>

                    <!-- Pillar 2: Content Changes (website Diff) -->
                    <div style="background:#ffffff; border:1px solid ${pContent.active ? '#86efac' : '#e2e8f0'}; border-radius:8px; padding:14px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="font-size:13px; font-weight:700; color:#1e293b;">📝 Content Changes (website Diff)</span>
                            <span class="rs-badge" style="font-size:10px; background:${pContent.active ? '#dcfce7' : '#f1f5f9'}; color:${pContent.active ? '#15803d' : '#64748b'};">${escapeHtml(pContent.status)}</span>
                        </div>
                        <div style="font-size:11px; color:#475569; display:flex; flex-direction:column; gap:3px;">
                            <div><span style="font-weight:600; color:#0f172a;">Add new section:</span> ${escapeHtml(pContent.add_section)}</div>
                            <div><span style="font-weight:600; color:#0f172a;">Interlinking:</span> ${escapeHtml(pContent.interlinking)}</div>
                        </div>
                    </div>

                    <!-- Pillar 3: Backlinks -->
                    <div style="background:#ffffff; border:1px solid ${pBacklinks.active ? '#93c5fd' : '#e2e8f0'}; border-radius:8px; padding:14px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="font-size:13px; font-weight:700; color:#1e293b;">🔗 Backlinks</span>
                            <span class="rs-badge" style="font-size:10px; background:${pBacklinks.active ? '#e0f2fe' : '#f1f5f9'}; color:${pBacklinks.active ? '#0369a1' : '#64748b'};">${escapeHtml(pBacklinks.status)}</span>
                        </div>
                        <div style="font-size:12px; color:#64748b; line-height:1.4;">${escapeHtml(pBacklinks.detail)}</div>
                    </div>

                    <!-- Pillar 4: New Content Published (Topic Cluster) -->
                    <div style="background:#ffffff; border:1px solid ${pCluster.active ? '#fde68a' : '#e2e8f0'}; border-radius:8px; padding:14px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <span style="font-size:13px; font-weight:700; color:#1e293b;">📚 New Content Published</span>
                            <span class="rs-badge" style="font-size:10px; background:${pCluster.active ? '#fef3c7' : '#f1f5f9'}; color:${pCluster.active ? '#b45309' : '#64748b'};">${escapeHtml(pCluster.status)}</span>
                        </div>
                        <div style="font-size:12px; color:#64748b; line-height:1.4;">${escapeHtml(pCluster.detail)}</div>
                    </div>
                </div>
            </div>

            <!-- 2. Root-Cause Factor Attribution Cards -->
            <div class="rs-card" style="margin-bottom:20px; padding:20px;">
                <div style="font-size:14px; font-weight:700; color:#1e293b; margin-bottom:12px;">
                    Root-Cause Diagnosis & Specific Triggers
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
                    ${reasonsHtml}
                </div>
            </div>

            <!-- 3. Side-by-Side Content & HTML Metadata Changes Table -->
            <div class="rs-card" style="margin-bottom:20px; padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div style="font-size:14px; font-weight:700; color:#1e293b;">
                        On-Page Content & HTML Metadata Changes
                    </div>
                    <span style="font-size:11px; color:#94a3b8;">Inspected Page: ${escapeHtml(data.url)}</span>
                </div>
                <table class="rs-table" style="width:100%; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                    <thead>
                        <tr style="background:#f8fafc;">
                            <th style="width:180px;">Element</th>
                            <th>Before (${escapeHtml(beforeDate)})</th>
                            <th>After (${escapeHtml(afterDate)})</th>
                            <th style="width:200px;">SEO Impact</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${diffsRowsHtml}
                        <tr>
                            <td style="font-weight:600; color:#1e293b;">Active Schemas</td>
                            <td style="font-size:11px; color:#64748b;">${escapeHtml(schemasOld)}</td>
                            <td style="font-size:11px; color:#0f172a; font-weight:600;">${escapeHtml(schemasNew)}</td>
                            <td style="font-size:11px; color:#64748b;">Rich Snippets SERP Eligibility</td>
                        </tr>
                        <tr>
                            <td style="font-weight:600; color:#1e293b;">Word Count</td>
                            <td style="font-size:12px; color:#64748b;">${escapeHtml(wordCountOld)}</td>
                            <td style="font-size:12px; color:#0f172a; font-weight:600;">${escapeHtml(wordCountNew)}</td>
                            <td style="font-size:11px; color:#64748b;">Topical Depth & Coverage</td>
                        </tr>
                        <tr>
                            <td style="font-weight:600; color:#1e293b;">Interlinking (Internal Links)</td>
                            <td style="font-size:12px; color:#64748b;">${escapeHtml(internalLinksOld)}</td>
                            <td style="font-size:12px; color:#0f172a; font-weight:600;">${escapeHtml(internalLinksNew)}</td>
                            <td style="font-size:11px; color:#64748b;">Internal Link Equity Flow</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 4. Section & Heading (H2) Diff Breakdown -->
            <div class="rs-card" style="padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div>
                        <div style="font-size:14px; font-weight:700; color:#1e293b;">Heading Sections (H2 Structure Diff)</div>
                        <div style="font-size:12px; color:#64748b;">Add new section and section removal detection for topical coverage audits</div>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <span class="rs-badge" style="background:#dcfce7; color:#166534;">+${addedHeadings.length} Added</span>
                        <span class="rs-badge" style="background:#fee2e2; color:#991b1b;">-${removedHeadings.length} Removed</span>
                        <span class="rs-badge" style="background:#f1f5f9; color:#475569;">${preservedHeadings.length} Unchanged</span>
                    </div>
                </div>
                ${headingsDiffHtml}
            </div>
        `);
    }

    function formatDate(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseJsonSafe(val) {
        if (!val) return null;
        try {
            return JSON.parse(val);
        } catch (e) {
            return null;
        }
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
});
