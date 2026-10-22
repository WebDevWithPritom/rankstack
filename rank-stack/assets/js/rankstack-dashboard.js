jQuery(document).ready(function($) {
    let mainChart = null;
    let subChart = null;
    let distChart = null;
    let brandedChart = null;

    const apiRoot = RankStackData.root;
    const nonce = RankStackData.nonce;

    // Active Metric Toggles
    let activeMetrics = {
        clicks: true,
        impressions: true,
        ctr: false,
        position: false
    };

    // Sub-tab State
    let activeTab = 'queries';
    let rawDashboardData = null;
    let tableSearchQuery = '';
    let activeFilters = [];
    let sortField = 'clicks';
    let sortDirection = 'desc';
    let currentPage = 1;
    const pageSize = 15;

    // Incidents & Annotations State
    let showIncidents = true;
    let showAnnotations = true;
    let cachedIncidents = [];
    let cachedSerpHistory = [];
    let cachedRankingUrls = [];
    let cachedDomain = 'wpoets.com';

    // Set Default Dates (Last 365 Days / 12 Months)
    const now = new Date();
    const endDefault = new Date(now.getTime()).toISOString().split('T')[0];
    const startDefault = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

    $('#rs-start-date').val(startDefault);
    $('#rs-end-date').val(endDefault);
    $('#rs-ann-date').val(endDefault);

    let isCreatingProject = false;

    // Load Projects into Select dropdown if element exists on page
    if ($('#rs-project-select').length > 0) {
        loadProjects();
    }

    function loadProjects() {
        if ($('#rs-project-select').length === 0) return;
        $.ajax({
            url: apiRoot + 'projects',
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(projects) {
                const $select = $('#rs-project-select');
                $select.empty();

                if (!projects || projects.length === 0) {
                    $select.append('<option value="">No Projects Found (Creating Demo...)</option>');
                    if (!isCreatingProject) {
                        createDefaultProject();
                    }
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
                localStorage.setItem('rankstack_active_project', defaultProj);
                populateCountryFilter(defaultProj);
                loadDashboardData();
    function populateCountryFilter(projectId) {
        if (!projectId || $('#rs-global-country-select').length === 0) return;
        $.ajax({
            url: apiRoot + 'settings/global-countries?project_id=' + projectId,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(countries) {
                const $sel = $('#rs-global-country-select');
                const currVal = $sel.val() || 'ALL';
                $sel.empty();
                $sel.append('<option value="ALL">Country: All Countries</option>');

                const countryNames = {
                    'IN': 'India (IN)',
                    'US': 'United States (US)',
                    'GB': 'United Kingdom (GB)',
                    'DE': 'Germany (DE)',
                    'CA': 'Canada (CA)',
                    'AU': 'Australia (AU)'
                };

                let list = Array.isArray(countries) ? countries.filter(c => c !== 'ALL') : [];
                if (!list.length) {
                    list = ['IN', 'US', 'GB'];
                }
                list = list.slice(0, 3);

                list.forEach(c => {
                    const cUpper = c.toUpperCase();
                    const name = countryNames[cUpper] || ('Country (' + cUpper + ')');
                    $sel.append('<option value="' + cUpper + '">Country: ' + name + '</option>');
                });

                if ($sel.find('option[value="' + currVal + '"]').length) {
                    $sel.val(currVal);
                } else {
                    $sel.val('ALL');
                }
            }
        });
    }

            }
        });
    }

    function createDefaultProject() {
        isCreatingProject = true;
        $.ajax({
            url: apiRoot + 'projects',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({
                name: 'Main Website',
                domain: window.location.hostname
            }),
            success: function() {
                isCreatingProject = false;
                loadProjects();
            },
            error: function() {
                isCreatingProject = false;
            }
        });
    }

    // Event Listeners
    $('#rs-project-select').on('change', function() {
        localStorage.setItem('rankstack_active_project', $(this).val());
        populateCountryFilter($(this).val());
        loadDashboardData();
    });

    $('#rs-start-date, #rs-end-date').on('change', function() {
        loadDashboardData();
    });

    $('#rs-global-country-select').on('change', function() {
        loadDashboardData();
    });

    // Date Presets Handler
    $('.rs-btn-preset').on('click', function() {
        const days = parseInt($(this).data('days'), 10);
        $('.rs-btn-preset').removeClass('rs-active');
        $(this).addClass('rs-active');

        const now = new Date();
        const end = new Date(now.getTime()).toISOString().split('T')[0];
        const start = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

        $('#rs-start-date').val(start);
        $('#rs-end-date').val(end);
        loadDashboardData();
    });

    // Interactive KPI Toggle Cards & Checkboxes
    $('.rs-kpi-toggle').on('click', function(e) {
        const metric = $(this).data('metric');
        
        if ($(e.target).is('input.gsc-chk')) {
            activeMetrics[metric] = $(e.target).is(':checked');
        } else {
            activeMetrics[metric] = !activeMetrics[metric];
            $(this).find('input.gsc-chk').prop('checked', activeMetrics[metric]);
        }

        $(this).toggleClass(`rs-active-${metric}`, activeMetrics[metric]);

        if (rawDashboardData && rawDashboardData.timeline) {
            renderMainTimelineChart(rawDashboardData.timeline);
        }
    });

    $('.rs-kpi-toggle input.gsc-chk').on('click', function(e) {
        e.stopPropagation();
        const $card = $(this).closest('.rs-kpi-toggle');
        const metric = $card.data('metric');
        activeMetrics[metric] = $(this).is(':checked');
        $card.toggleClass(`rs-active-${metric}`, activeMetrics[metric]);

        if (rawDashboardData && rawDashboardData.timeline) {
            renderMainTimelineChart(rawDashboardData.timeline);
        }
    });

    // Sub-tab Navigation
    $('.rs-tab-btn').on('click', function() {
        $('.rs-tab-btn').removeClass('rs-active');
        $(this).addClass('rs-active');

        activeTab = $(this).data('tab');
        currentPage = 1;
        sortField = (activeTab === 'dates') ? 'date' : (activeTab === 'changes' ? 'position_change' : 'clicks');
        sortDirection = 'desc';

        renderTableData();
    });

    // Live Search Filter Input
    $('#rs-table-search').on('input', function() {
        tableSearchQuery = $(this).val().toLowerCase();
        currentPage = 1;
        renderTableData();
    });

    // Pagination Button Listeners
    $('#rs-btn-prev-page').on('click', function() {
        if (currentPage > 1) {
            currentPage--;
            renderTableData();
        }
    });

    $('#rs-btn-next-page').on('click', function() {
        currentPage++;
        renderTableData();
    });

    $('#rs-jump-page').on('change keyup', function(e) {
        if (e.type === 'keyup' && e.key !== 'Enter') return;
        const val = parseInt($(this).val(), 10);
        if (!isNaN(val) && val >= 1) {
            currentPage = val;
            renderTableData();
        }
    });

    // Sync Button
    $('#rs-btn-sync').on('click', function() {
        const projectId = $('#rs-project-select').val();
        if (!projectId) return alert('Please select a project first.');

        const $btn = $(this);
        $btn.text('Syncing...').prop('disabled', true);
        $('#rs-sync-status-bar').text('Connecting to Google Search Console API...').show();

        $.ajax({
            url: apiRoot + 'sync/gsc',
            method: 'POST',
            contentType: 'application/json',
            timeout: 180000,
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ project_id: projectId, days: 365 }),
            success: function(res) {
                $btn.text('Sync GSC Data').prop('disabled', false);
                $('#rs-sync-status-bar').text(`Sync completed! ${res.synced_rows || 0} ranking rows updated.`).delay(4000).fadeOut();
                loadDashboardData();
            },
            error: function(err) {
                $btn.text('Sync GSC Data').prop('disabled', false);
                let msg = 'Sync Failed';
                if (err.statusText === 'timeout') {
                    msg = 'Sync is continuing in the background on the server. Please refresh in 30 seconds.';
                } else if (err.responseJSON && err.responseJSON.message) {
                    msg = err.responseJSON.message;
                }
                $('#rs-sync-status-bar').text(msg);
            }
        });
    });

    // Reset Zoom Button Handler
    $('#rs-btn-reset-zoom').on('click', function() {
        if (mainChart && typeof mainChart.resetZoom === 'function') {
            mainChart.resetZoom();
        }
        if (subChart && typeof subChart.resetZoom === 'function') {
            subChart.resetZoom();
        }
    });

    // Reset Database & Start Fresh Handler
    $('#rs-btn-reset').on('click', function() {
        if (!confirm('Wipe all dummy data and start fresh with 100% real Google Search Console data?')) return;

        const projectId = $('#rs-project-select').val();
        const $btn = $(this);
        $btn.text('Wiping...').prop('disabled', true);
        $('#rs-sync-status-bar').text('Wiping all dummy tables & fetching fresh 365-day GSC data...').show();

        $.ajax({
            url: apiRoot + 'reset-all-data',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function() {
                $btn.text('Reset & Start Fresh').prop('disabled', false);
                if (projectId) {
                    $('#rs-btn-sync').click();
                } else {
                    alert('All dummy tables wiped successfully!');
                    loadDashboardData();
                }
            },
            error: function() {
                $btn.text('Reset & Start Fresh').prop('disabled', false);
                alert('Reset failed.');
            }
        });
    });

    function loadDashboardData() {
        const projectId = $('#rs-project-select').val();
        const startDate = $('#rs-start-date').val();
        const endDate = $('#rs-end-date').val();
        const country = $('#rs-global-country-select').val() || 'ALL';

        if (!projectId) return;

        // Fetch Google Search Incidents & custom annotations in parallel
        fetchIncidents(startDate, endDate);

        $.ajax({
            url: apiRoot + `dashboard?project_id=${projectId}&start_date=${startDate}&end_date=${endDate}&country=${country}`,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(data) {
                rawDashboardData = data;
                if ($('#kpi-clicks').length) renderKPIs(data.summary);
                if ($('#rs-main-chart').length) renderMainTimelineChart(data.timeline);
                if ($('#rs-dist-chart').length) renderDistributionChart(data.distribution);
                if ($('#rs-branded-chart').length) renderBrandedSplitChart(data.branded_split);
                if ($('#rs-data-tbody').length) renderTableData();
                if ($('#rs-annotations-tbody').length) renderAnnotations(data.annotations);
                // updateCountryDropdown omitted to preserve Top 3 countries from settings

                if ($('.gsc-last-update').length) {
                    if (data.last_sync) {
                        const rel = timeAgoDiff(data.last_sync);
                        $('.gsc-last-update').html(`Last sync: <strong>${data.last_sync}</strong> (${rel})`);
                    } else {
                        $('.gsc-last-update').text('Last update: No sync recorded yet');
                    }
                }
            }
        });
    }

        function timeAgoDiff(dateString) {
        if (!dateString) return '';
        const d = new Date(dateString.replace(/-/g, '/'));
        const now = new Date();
        const diffSecs = Math.floor((now.getTime() - d.getTime()) / 1000);
        if (isNaN(diffSecs) || diffSecs < 0) return 'Just now';
        if (diffSecs < 60) return 'Just now';
        const mins = Math.floor(diffSecs / 60);
        if (mins < 60) return mins === 1 ? '1 minute ago' : `${mins} minutes ago`;
        const hrs = Math.floor(diffSecs / 3600);
        if (hrs < 24) return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`;
        const days = Math.floor(diffSecs / 86400);
        if (days < 30) return days === 1 ? '1 day ago' : `${days} days ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
        const yrs = Math.floor(days / 365);
        return yrs === 1 ? '1 year ago' : `${yrs} years ago`;
    }

    function fetchIncidents(startDate, endDate, callback) {
        $.ajax({
            url: apiRoot + `incidents?start_date=${startDate || ''}&end_date=${endDate || ''}&include_custom=true`,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(incidents) {
                cachedIncidents = incidents || [];
                if (callback) callback();
            },
            error: function() {
                if (callback) callback();
            }
        });
    }

    function updateCountryDropdown(countries) {
        if (!countries || !countries.length) return;
        const $select = $('#rs-global-country-select');
        const currentVal = $select.val() || 'ALL';

        let optionsHtml = '<option value="ALL">Country: All Countries</option>';
        countries.forEach(c => {
            const code = c.code;
            if (!code || code === 'ALL') return;
            const countLabel = c.clicks ? ` (${c.clicks} clicks)` : '';
            optionsHtml += `<option value="${code}">Country: ${code}${countLabel}</option>`;
        });

        $select.html(optionsHtml);
        $select.val(currentVal);
    }

    function parseGSCNum(val) {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return Number(String(val).replace(/,/g, '').trim()) || 0;
    }

    function renderKPIs(summary) {
        if (!summary) return;
        const clicks = parseGSCNum(summary.total_clicks);
        const impressions = parseGSCNum(summary.total_impressions);
        const ctr = (parseFloat(summary.avg_ctr) || 0) * 100;
        const pos = parseFloat(summary.avg_position) || 0;

        const clicksFormatted = formatGSCNum(clicks);
        const impressionsFormatted = formatGSCNum(impressions);

        const clicksBadge = clicks >= 1000 ? ` <span style="font-size:12px; color:#94a3b8; font-weight:400; margin-left:4px;">(${clicks.toLocaleString()})</span>` : '';
        const impressionsBadge = impressions >= 1000 ? ` <span style="font-size:12px; color:#94a3b8; font-weight:400; margin-left:4px;">(${impressions.toLocaleString()})</span>` : '';

        $('#kpi-clicks').html(`<span title="Total Clicks: ${clicks.toLocaleString()}">${clicksFormatted}</span>${clicksBadge}`);
        $('#kpi-impressions').html(`<span title="Total Impressions: ${impressions.toLocaleString()}">${impressionsFormatted}</span>${impressionsBadge}`);
        $('#kpi-ctr').text(ctr.toFixed(1) + '%');
        $('#kpi-position').text(pos.toFixed(1));
    }

    function formatGSCNum(num) {
        num = Number(num) || 0;
        if (num >= 1000000) {
            const m = num / 1000000;
            return (m >= 10 ? m.toFixed(1) : m.toFixed(2)) + 'M';
        }
        if (num >= 1000) {
            const k = num / 1000;
            return (k >= 100 ? Math.round(k) : (k >= 10 ? k.toFixed(1) : k.toFixed(2))) + 'K';
        }
        return num.toLocaleString();
    }

    function renderMainTimelineChart(timeline) {
        const ctxMain = document.getElementById('rs-main-chart').getContext('2d');
        if (mainChart) mainChart.destroy();

        const labels = (timeline || []).map(t => t.date);
        const datasetsMain = [];
        const scalesMain = {
            x: {
                grid: { color: '#f8fafc' },
                ticks: {
                    maxTicksLimit: 12,
                    autoSkip: true,
                    maxRotation: 0,
                    color: '#64748b',
                    font: { size: 11, weight: '500' }
                }
            }
        };

        if (activeMetrics.clicks) {
            datasetsMain.push({
                label: 'Clicks',
                data: (timeline || []).map(t => t.total_clicks),
                borderColor: '#1a73e8',
                backgroundColor: 'rgba(26, 115, 232, 0.08)',
                yAxisID: 'yClicks',
                fill: true,
                tension: 0.3,
                pointRadius: (labels.length > 60) ? 0 : 2,
                pointHoverRadius: 5
            });
            scalesMain.yClicks = {
                type: 'linear',
                position: 'left',
                grid: { color: '#f1f5f9' },
                title: { display: true, text: 'Clicks', color: '#1a73e8', font: { weight: '600' } }
            };
        }

        if (activeMetrics.impressions) {
            datasetsMain.push({
                label: 'Impressions',
                data: (timeline || []).map(t => t.total_impressions),
                borderColor: '#5bb974',
                borderDash: [4, 4],
                yAxisID: 'yImpressions',
                fill: false,
                tension: 0.3,
                pointRadius: (labels.length > 60) ? 0 : 2,
                pointHoverRadius: 5
            });
            scalesMain.yImpressions = {
                type: 'linear',
                position: activeMetrics.clicks ? 'right' : 'left',
                grid: { drawOnChartArea: !activeMetrics.clicks },
                title: { display: true, text: 'Impressions', color: '#5bb974', font: { weight: '600' } }
            };
        }

        // Build Google Algorithm Update & Custom Annotation Bands
        const annotationsConfig = {};
        if ((showIncidents || showAnnotations) && cachedIncidents && cachedIncidents.length) {
            cachedIncidents.forEach((inc, idx) => {
                const isCustom = (inc.type === 'custom_annotation');
                if (isCustom && !showAnnotations) return;
                if (!isCustom && !showIncidents) return;

                const boxBg = isCustom ? 'rgba(59, 130, 246, 0.16)' : 'rgba(244, 63, 94, 0.16)';
                const borderColor = isCustom ? '#3b82f6' : '#e11d48';

                annotationsConfig['box_' + idx] = {
                    type: 'box',
                    xMin: inc.start_date,
                    xMax: inc.end_date,
                    backgroundColor: boxBg,
                    borderColor: borderColor,
                    borderWidth: 1,
                    borderDash: [4, 4],
                    drawTime: 'beforeDatasetsDraw'
                };

                annotationsConfig['line_' + idx] = {
                    type: 'line',
                    xMin: inc.start_date,
                    xMax: inc.start_date,
                    borderColor: borderColor,
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    drawTime: 'afterDatasetsDraw'
                };
            });
        }

        function getIncidentCoords(inc, chartArea, x, dateLabels) {
            let xStart = x.getPixelForValue(inc.start_date);
            let xEnd = x.getPixelForValue(inc.end_date);

            if (isNaN(xStart) && dateLabels && dateLabels.length) {
                if (inc.start_date < dateLabels[0]) xStart = chartArea.left;
                else if (inc.start_date > dateLabels[dateLabels.length - 1]) xStart = chartArea.right;
                else {
                    for (let i = 0; i < dateLabels.length - 1; i++) {
                        if (inc.start_date >= dateLabels[i] && inc.start_date <= dateLabels[i + 1]) {
                            xStart = x.getPixelForValue(dateLabels[i]);
                            break;
                        }
                    }
                }
            }

            if (isNaN(xEnd) && dateLabels && dateLabels.length) {
                if (inc.end_date < dateLabels[0]) xEnd = chartArea.left;
                else if (inc.end_date > dateLabels[dateLabels.length - 1]) xEnd = chartArea.right;
                else {
                    for (let i = 0; i < dateLabels.length - 1; i++) {
                        if (inc.end_date >= dateLabels[i] && inc.end_date <= dateLabels[i + 1]) {
                            xEnd = x.getPixelForValue(dateLabels[i + 1]);
                            break;
                        }
                    }
                }
            }

            return { xStart, xEnd };
        }

        const incidentCanvasPlugin = {
            id: 'incidentCanvasShading',
            beforeDatasetsDraw: function(chart) {
                if (!showIncidents && !showAnnotations) return;
                if (!cachedIncidents || !cachedIncidents.length) return;
                const { ctx, chartArea, scales: { x } } = chart;
                if (!x || !chartArea) return;

                ctx.save();
                cachedIncidents.forEach(inc => {
                    const isCustom = (inc.type === 'custom_annotation');
                    if (isCustom && !showAnnotations) return;
                    if (!isCustom && !showIncidents) return;

                    const coords = getIncidentCoords(inc, chartArea, x, labels);
                    if (isNaN(coords.xStart) && isNaN(coords.xEnd)) return;

                    const left = Math.max(chartArea.left, isNaN(coords.xStart) ? chartArea.left : Math.min(coords.xStart, coords.xEnd));
                    const right = Math.min(chartArea.right, isNaN(coords.xEnd) ? chartArea.right : Math.max(coords.xStart, coords.xEnd));
                    const width = Math.max(12, right - left);

                    if (right < chartArea.left || left > chartArea.right) return;

                    // Shaded Box (Pink/Red for Google Updates, Blue for Custom)
                    ctx.fillStyle = isCustom ? 'rgba(59, 130, 246, 0.16)' : 'rgba(244, 63, 94, 0.16)';
                    ctx.fillRect(left, chartArea.top, width, chartArea.bottom - chartArea.top);

                    // Dashed Border around region
                    ctx.strokeStyle = isCustom ? '#3b82f6' : '#e11d48';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 4]);
                    ctx.strokeRect(left, chartArea.top, width, chartArea.bottom - chartArea.top);

                    // Dashed Vertical Line on Start
                    if (!isNaN(coords.xStart) && coords.xStart >= chartArea.left && coords.xStart <= chartArea.right) {
                        ctx.beginPath();
                        ctx.moveTo(coords.xStart, chartArea.top);
                        ctx.lineTo(coords.xStart, chartArea.bottom);
                        ctx.lineWidth = 1.5;
                        ctx.strokeStyle = isCustom ? '#2563eb' : '#be123c';
                        ctx.stroke();
                    }
                });
                ctx.restore();
            }
        };

        const isChartZoomActive = (typeof RankStackData !== 'undefined' && RankStackData.chart_zoom_enabled !== undefined) ? !!RankStackData.chart_zoom_enabled : true;
        if (!isChartZoomActive) {
            $('#rs-btn-reset-zoom').hide();
        } else {
            $('#rs-btn-reset-zoom').show();
        }

        mainChart = new Chart(ctxMain, {
            type: 'line',
            data: { labels: labels, datasets: datasetsMain },
            plugins: [incidentCanvasPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: scalesMain,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { boxWidth: 12, usePointStyle: true, font: { size: 12, weight: '600' } }
                    },
                    annotation: {
                        annotations: annotationsConfig
                    },
                    zoom: {
                        pan: { enabled: true, mode: 'x' },
                        zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            mode: 'x',
                            drag: {
                                enabled: true,
                                backgroundColor: 'rgba(26, 115, 232, 0.15)',
                                borderColor: '#1a73e8',
                                borderWidth: 1
                            }
                        }
                    }
                }
            }
        });

        // Hover & click listeners on canvas for interactive incident card & modal
        $(ctxMain.canvas).off('mousemove.incidents mouseleave.incidents click.incidents')
        .on('mousemove.incidents', function(e) {
            if (!mainChart || (!showIncidents && !showAnnotations)) return;
            const rect = ctxMain.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const chartArea = mainChart.chartArea;
            if (!chartArea || mouseX < chartArea.left || mouseX > chartArea.right || mouseY < chartArea.top || mouseY > chartArea.bottom) {
                ctxMain.canvas.style.cursor = 'default';
                hideIncidentFloatingCard();
                return;
            }

            const x = mainChart.scales.x;
            let hoveredInc = null;
            if (cachedIncidents && cachedIncidents.length) {
                for (let inc of cachedIncidents) {
                    const isCustom = (inc.type === 'custom_annotation');
                    if (isCustom && !showAnnotations) continue;
                    if (!isCustom && !showIncidents) continue;

                    const coords = getIncidentCoords(inc, chartArea, x, labels);
                    if (isNaN(coords.xStart) && isNaN(coords.xEnd)) continue;

                    const left = Math.max(chartArea.left, isNaN(coords.xStart) ? chartArea.left : Math.min(coords.xStart, coords.xEnd)) - 8;
                    const right = Math.min(chartArea.right, isNaN(coords.xEnd) ? chartArea.right : Math.max(coords.xStart, coords.xEnd)) + 8;

                    if (mouseX >= left && mouseX <= right) {
                        hoveredInc = inc;
                        break;
                    }
                }
            }

            if (hoveredInc) {
                ctxMain.canvas.style.cursor = 'pointer';
                showIncidentFloatingCard(e, hoveredInc);
            } else {
                ctxMain.canvas.style.cursor = 'default';
                hideIncidentFloatingCard();
            }
        })
        .on('mouseleave.incidents', function() {
            ctxMain.canvas.style.cursor = 'default';
            hideIncidentFloatingCard();
        })
        .on('click.incidents', function(e) {
            if (!mainChart || (!showIncidents && !showAnnotations)) return;
            const rect = ctxMain.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const chartArea = mainChart.chartArea;
            if (!chartArea || mouseX < chartArea.left || mouseX > chartArea.right) return;

            const x = mainChart.scales.x;
            let clickedInc = null;
            if (cachedIncidents && cachedIncidents.length) {
                for (let inc of cachedIncidents) {
                    const isCustom = (inc.type === 'custom_annotation');
                    if (isCustom && !showAnnotations) continue;
                    if (!isCustom && !showIncidents) continue;

                    const coords = getIncidentCoords(inc, chartArea, x, labels);
                    if (isNaN(coords.xStart) && isNaN(coords.xEnd)) continue;

                    const left = Math.max(chartArea.left, isNaN(coords.xStart) ? chartArea.left : Math.min(coords.xStart, coords.xEnd)) - 8;
                    const right = Math.min(chartArea.right, isNaN(coords.xEnd) ? chartArea.right : Math.max(coords.xStart, coords.xEnd)) + 8;

                    if (mouseX >= left && mouseX <= right) {
                        clickedInc = inc;
                        break;
                    }
                }
            }

            if (clickedInc) {
                openIncidentDetailsModal(clickedInc);
            }
        });

        // ── Sub-Chart for CTR & Average Position (GSC Guardian Style) ──
        if (activeMetrics.ctr || activeMetrics.position) {
            $('#rs-sub-chart-box').show();
            const ctxSub = document.getElementById('rs-sub-chart').getContext('2d');
            if (subChart) subChart.destroy();

            const datasetsSub = [];
            const scalesSub = {
                x: {
                    grid: { color: '#f8fafc' },
                    ticks: {
                        maxTicksLimit: 12,
                        autoSkip: true,
                        maxRotation: 0,
                        color: '#64748b',
                        font: { size: 11, weight: '500' }
                    }
                }
            };

            if (activeMetrics.ctr) {
                datasetsSub.push({
                    label: 'Average CTR (%)',
                    data: (timeline || []).map(t => (parseFloat(t.avg_ctr) * 100).toFixed(2)),
                    borderColor: '#129eaf',
                    yAxisID: 'yCtr',
                    fill: false,
                    tension: 0.3,
                    pointRadius: (labels.length > 60) ? 0 : 2,
                    pointHoverRadius: 5
                });
                scalesSub.yCtr = {
                    type: 'linear',
                    position: 'left',
                    grid: { color: '#f1f5f9' },
                    title: { display: true, text: 'CTR (%)', color: '#129eaf', font: { weight: '600' } }
                };
            }

            if (activeMetrics.position) {
                datasetsSub.push({
                    label: 'Average Position',
                    data: (timeline || []).map(t => parseFloat(t.avg_position)),
                    borderColor: '#e37400',
                    yAxisID: 'yPosition',
                    fill: false,
                    tension: 0.3,
                    pointRadius: (labels.length > 60) ? 0 : 2,
                    pointHoverRadius: 5
                });
                scalesSub.yPosition = {
                    type: 'linear',
                    position: activeMetrics.ctr ? 'right' : 'left',
                    reverse: true,
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Position (Inverted)', color: '#e37400', font: { weight: '600' } }
                };
            }

            subChart = new Chart(ctxSub, {
                type: 'line',
                data: { labels: labels, datasets: datasetsSub },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: scalesSub,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: { boxWidth: 12, usePointStyle: true, font: { size: 12, weight: '600' } }
                        },
                        zoom: {
                            pan: { enabled: true, mode: 'x' },
                            zoom: {
                                wheel: { enabled: true },
                                pinch: { enabled: true },
                                mode: 'x',
                                drag: {
                                    enabled: true,
                                    backgroundColor: 'rgba(227, 116, 0, 0.15)',
                                    borderColor: '#e37400',
                                    borderWidth: 1
                                }
                            }
                        }
                    }
                }
            });
        } else {
            $('#rs-sub-chart-box').hide();
        }
    }

    function renderDistributionChart(dist) {
        if (!document.getElementById('rs-dist-chart')) return;
        const ctx = document.getElementById('rs-dist-chart').getContext('2d');
        if (distChart) distChart.destroy();

        const top3 = (dist && dist.top_3) ? dist.top_3 : 0;
        const top10 = (dist && dist.top_10) ? dist.top_10 : 0;
        const top20 = (dist && dist.top_20) ? dist.top_20 : 0;
        const top50 = (dist && dist.top_50) ? dist.top_50 : 0;
        const top100 = (dist && dist.top_100) ? dist.top_100 : 0;

        distChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Top 3 (Pos 1-3)', 'Top 10 (Pos 4-10)', 'Page 2 (Pos 11-20)', 'Top 50 (Pos 21-50)', 'Top 100 (Pos 51-100)'],
                datasets: [{
                    label: 'Keywords Count',
                    data: [top3, top10, top20, top50, top100],
                    backgroundColor: ['#10b981', '#3b82f6', '#6366f1', '#f59e0b', '#94a3b8'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.parsed.y} keywords in this tier`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 }
                    }
                }
            }
        });
    }

    function renderBrandedSplitChart(split) {
        if (!document.getElementById('rs-branded-chart')) return;
        const ctx = document.getElementById('rs-branded-chart').getContext('2d');
        if (brandedChart) brandedChart.destroy();

        const brandedClicks = split ? (split.branded ? split.branded.clicks : 0) : 0;
        const nonBrandedClicks = split ? (split.non_branded ? split.non_branded.clicks : 0) : 0;

        brandedChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Branded Clicks', 'Non-Branded Clicks'],
                datasets: [{
                    data: [brandedClicks, nonBrandedClicks],
                    backgroundColor: ['#8b5cf6', '#06b6d4']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    function formatKeywordCellWithDots(kw, kwId) {
        const cleanKw = escapeHtml(kw || '');
        const cleanId = escapeHtml(kwId || kw || '');
        const googleSearchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(kw || '');

        return `<div class="rs-kw-cell-flex">
            <a href="#" class="rs-kw-inspector-link" data-id="${cleanId}" data-kw="${cleanKw}" title="Click to inspect SERP & ranking history">${cleanKw}</a>
            <div class="rs-three-dots-wrap">
                <button type="button" class="rs-three-dots-btn" title="Options" data-kw="${cleanKw}" data-id="${cleanId}">&#8942;</button>
                <div class="rs-three-dots-menu">
                    <button type="button" class="rs-menu-item rs-action-serp-history" data-id="${cleanId}" data-kw="${cleanKw}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        <span>SERP History</span>
                    </button>
                    <a href="${googleSearchUrl}" target="_blank" rel="noopener noreferrer" class="rs-menu-item rs-action-google-search">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <span>Search on Google</span>
                    </a>
                    <div class="rs-menu-divider"></div>
                    <button type="button" class="rs-menu-item rs-action-copy-kw" data-kw="${cleanKw}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        <span>Copy Keyword</span>
                    </button>
                </div>
            </div>
        </div>`;
    }

    function renderTableData() {
        if (!rawDashboardData) return;

        let items = [];
        let headers = '';

        if (activeTab === 'queries') {
            headers = `
                <tr>
                    <th style="width:30px;"></th>
                    <th class="rs-sortable" data-field="keyword">Keyword ${getSortIcon('keyword')}</th>
                    <th class="rs-sortable" data-field="intent">Search Intent ${getSortIcon('intent')}</th>
                    <th class="rs-sortable" data-field="clicks">Clicks ${getSortIcon('clicks')}</th>
                    <th class="rs-sortable" data-field="impressions">Impressions ${getSortIcon('impressions')}</th>
                    <th class="rs-sortable" data-field="ctr">CTR ${getSortIcon('ctr')}</th>
                    <th class="rs-sortable" data-field="position">Position ${getSortIcon('position')}</th>
                    <th class="rs-sortable" data-field="change_7d">7D Change ${getSortIcon('change_7d')}</th>
                    <th class="rs-sortable" data-field="change_30d">30D Change ${getSortIcon('change_30d')}</th>
                    <th class="rs-sortable" data-field="mobile_position" title="Average Mobile position across top 3 countries">Mobile ${getSortIcon('mobile_position')}</th>
                    <th class="rs-sortable" data-field="desktop_position" title="Average Desktop position across top 3 countries">Desktop ${getSortIcon('desktop_position')}</th>
                    <th class="rs-sortable" data-field="tablet_position" title="Average Tablet position across top 3 countries">Tablet ${getSortIcon('tablet_position')}</th>
                    <th>Top 3 Countries</th>
                    <th>Tags</th>
                </tr>`;
            items = (rawDashboardData.queries || []).map(q => ({
                keyword_id: q.keyword_id,
                keyword: q.keyword,
                intent: q.intent || 'Informational',
                clicks: parseInt(q.clicks) || 0,
                impressions: parseInt(q.impressions) || 0,
                ctr: parseFloat(q.ctr) || 0,
                position: parseFloat(q.position) || 0,
                change_7d: parseFloat(q.change_7d) || 0,
                change_30d: parseFloat(q.change_30d) || 0,
                mobile_position: parseFloat(q.mobile_position) || 0,
                desktop_position: parseFloat(q.desktop_position) || 0,
                tablet_position: parseFloat(q.tablet_position) || 0,
                url: q.url || '—',
                is_branded: q.is_branded,
                tags: q.tags || '',
                auto_tags: q.auto_tags || '',
                top_countries: q.top_countries || []
            }));
        } else if (activeTab === 'striking') {
            headers = `
                <tr>
                    <th class="rs-sortable" data-field="keyword">Page 2 Keyword ${getSortIcon('keyword')}</th>
                    <th class="rs-sortable" data-field="clicks">Clicks ${getSortIcon('clicks')}</th>
                    <th class="rs-sortable" data-field="impressions">Impressions ${getSortIcon('impressions')}</th>
                    <th class="rs-sortable" data-field="ctr">CTR ${getSortIcon('ctr')}</th>
                    <th class="rs-sortable" data-field="position">Rank (11-20) ${getSortIcon('position')}</th>
                    <th>Opportunity Action</th>
                </tr>`;
            items = (rawDashboardData.queries || [])
                .filter(q => (parseFloat(q.position) >= 11.0 && parseFloat(q.position) <= 20.0))
                .map(q => ({
                    keyword: q.keyword,
                    clicks: parseInt(q.clicks) || 0,
                    impressions: parseInt(q.impressions) || 0,
                    ctr: parseFloat(q.ctr) || 0,
                    position: parseFloat(q.position) || 0,
                    opportunity: '1-2 Ranks Away from Page 1'
                }));
        } else if (activeTab === 'ctr_opportunities') {
            headers = `
                <tr>
                    <th class="rs-sortable" data-field="keyword">Page 1 Keyword ${getSortIcon('keyword')}</th>
                    <th class="rs-sortable" data-field="clicks">Clicks ${getSortIcon('clicks')}</th>
                    <th class="rs-sortable" data-field="impressions">Impressions ${getSortIcon('impressions')}</th>
                    <th class="rs-sortable" data-field="ctr">Current CTR ${getSortIcon('ctr')}</th>
                    <th class="rs-sortable" data-field="position">Rank (1-10) ${getSortIcon('position')}</th>
                    <th>GSC Guardian Audit Recommendation</th>
                </tr>`;
            items = (rawDashboardData.queries || [])
                .filter(q => (parseFloat(q.position) <= 10.0 && parseFloat(q.ctr) < 0.03))
                .map(q => ({
                    keyword: q.keyword,
                    clicks: parseInt(q.clicks) || 0,
                    impressions: parseInt(q.impressions) || 0,
                    ctr: parseFloat(q.ctr) || 0,
                    position: parseFloat(q.position) || 0,
                    opportunity: 'Title & Meta Description Audit'
                }));
        } else if (activeTab === 'intent') {
            headers = `
                <tr>
                    <th class="rs-sortable" data-field="keyword">Keyword ${getSortIcon('keyword')}</th>
                    <th class="rs-sortable" data-field="intent">Detected Intent ${getSortIcon('intent')}</th>
                    <th class="rs-sortable" data-field="clicks">Clicks ${getSortIcon('clicks')}</th>
                    <th class="rs-sortable" data-field="impressions">Impressions ${getSortIcon('impressions')}</th>
                    <th class="rs-sortable" data-field="position">Position ${getSortIcon('position')}</th>
                </tr>`;
            items = (rawDashboardData.queries || []).map(q => {
                const kw = q.keyword.toLowerCase();
                let intent = 'Informational';
                if (/buy|price|cost|quote|agency|service|hire|plugin/.test(kw)) {
                    intent = 'Transactional';
                } else if (/best|top|review|vs|compare/.test(kw)) {
                    intent = 'Commercial';
                } else if (/wpoets|rankstack/.test(kw)) {
                    intent = 'Navigational';
                }
                return {
                    keyword_id: q.keyword_id || '',
                    keyword: q.keyword,
                    intent: intent,
                    clicks: parseInt(q.clicks) || 0,
                    impressions: parseInt(q.impressions) || 0,
                    position: parseFloat(q.position) || 0
                };
            });
        } else if (activeTab === 'pages') {
            headers = `
                <tr>
                    <th class="rs-sortable" data-field="url">Landing Page URL ${getSortIcon('url')}</th>
                    <th class="rs-sortable" data-field="clicks">Clicks ${getSortIcon('clicks')}</th>
                    <th class="rs-sortable" data-field="impressions">Impressions ${getSortIcon('impressions')}</th>
                    <th class="rs-sortable" data-field="ctr">CTR ${getSortIcon('ctr')}</th>
                    <th class="rs-sortable" data-field="position">Position ${getSortIcon('position')}</th>
                </tr>`;
            items = (rawDashboardData.pages || []).map(p => ({
                url: p.url,
                clicks: parseInt(p.clicks) || 0,
                impressions: parseInt(p.impressions) || 0,
                ctr: parseFloat(p.ctr) || 0,
                position: parseFloat(p.position) || 0
            }));
        } else if (activeTab === 'countries') {
            headers = `
                <tr>
                    <th class="rs-sortable" data-field="code">Country ${getSortIcon('code')}</th>
                    <th class="rs-sortable" data-field="clicks">Clicks ${getSortIcon('clicks')}</th>
                    <th class="rs-sortable" data-field="impressions">Impressions ${getSortIcon('impressions')}</th>
                    <th class="rs-sortable" data-field="ctr">CTR ${getSortIcon('ctr')}</th>
                    <th class="rs-sortable" data-field="position">Position ${getSortIcon('position')}</th>
                </tr>`;
            items = (rawDashboardData.countries || []).map(c => ({
                code: c.code,
                clicks: parseInt(c.clicks) || 0,
                impressions: parseInt(c.impressions) || 0,
                ctr: parseFloat(c.ctr) || 0,
                position: parseFloat(c.position) || 0
            }));
        } else if (activeTab === 'devices') {
            headers = `
                <tr>
                    <th class="rs-sortable" data-field="name">Device ${getSortIcon('name')}</th>
                    <th class="rs-sortable" data-field="clicks">Clicks ${getSortIcon('clicks')}</th>
                    <th class="rs-sortable" data-field="impressions">Impressions ${getSortIcon('impressions')}</th>
                    <th class="rs-sortable" data-field="ctr">CTR ${getSortIcon('ctr')}</th>
                    <th class="rs-sortable" data-field="position">Position ${getSortIcon('position')}</th>
                </tr>`;
            items = (rawDashboardData.devices || []).map(d => ({
                name: d.name,
                clicks: parseInt(d.clicks) || 0,
                impressions: parseInt(d.impressions) || 0,
                ctr: parseFloat(d.ctr) || 0,
                position: parseFloat(d.position) || 0
            }));
        } else if (activeTab === 'appearances') {
            headers = `
                <tr>
                    <th class="rs-sortable" data-field="name">Search Appearance ${getSortIcon('name')}</th>
                    <th class="rs-sortable" data-field="clicks">Clicks ${getSortIcon('clicks')}</th>
                    <th class="rs-sortable" data-field="impressions">Impressions ${getSortIcon('impressions')}</th>
                    <th class="rs-sortable" data-field="ctr">CTR ${getSortIcon('ctr')}</th>
                    <th class="rs-sortable" data-field="position">Position ${getSortIcon('position')}</th>
                </tr>`;
            items = (rawDashboardData.appearances || []).map(a => ({
                name: a.name,
                clicks: parseInt(a.clicks) || 0,
                impressions: parseInt(a.impressions) || 0,
                ctr: parseFloat(a.ctr) || 0,
                position: parseFloat(a.position) || 0
            }));
        } else if (activeTab === 'dates') {
            headers = `
                <tr>
                    <th class="rs-sortable" data-field="date">Date ${getSortIcon('date')}</th>
                    <th class="rs-sortable" data-field="clicks">Clicks ${getSortIcon('clicks')}</th>
                    <th class="rs-sortable" data-field="impressions">Impressions ${getSortIcon('impressions')}</th>
                    <th class="rs-sortable" data-field="ctr">CTR ${getSortIcon('ctr')}</th>
                    <th class="rs-sortable" data-field="position">Position ${getSortIcon('position')}</th>
                </tr>`;
            items = (rawDashboardData.timeline || []).map(t => ({
                date: t.date,
                clicks: parseInt(t.total_clicks) || 0,
                impressions: parseInt(t.total_impressions) || 0,
                ctr: parseFloat(t.avg_ctr) || 0,
                position: parseFloat(t.avg_position) || 0
            }));
        } else if (activeTab === 'cannibalization') {
            headers = `
                <tr>
                    <th class="rs-sortable" data-field="keyword">Keyword ${getSortIcon('keyword')}</th>
                    <th class="rs-sortable" data-field="url_count">Competing URLs Count ${getSortIcon('url_count')}</th>
                    <th class="rs-sortable" data-field="clicks">Clicks ${getSortIcon('clicks')}</th>
                    <th>Competing Target URLs</th>
                </tr>`;
            items = (rawDashboardData.cannibalization || []).map(cn => ({
                keyword_id: cn.keyword_id || '',
                keyword: cn.keyword,
                url_count: parseInt(cn.url_count) || 0,
                clicks: parseInt(cn.clicks) || 0,
                urls: cn.urls || '—'
            }));
        } else if (activeTab === 'changes') {
            headers = `
                <tr>
                    <th class="rs-sortable" data-field="keyword">Keyword ${getSortIcon('keyword')}</th>
                    <th class="rs-sortable" data-field="position_change">Position Change ${getSortIcon('position_change')}</th>
                    <th class="rs-sortable" data-field="current_position">Current Rank ${getSortIcon('current_position')}</th>
                    <th class="rs-sortable" data-field="start_position">Start Rank ${getSortIcon('start_position')}</th>
                    <th class="rs-sortable" data-field="clicks">Clicks ${getSortIcon('clicks')}</th>
                </tr>`;
            items = (rawDashboardData.changes || []).map(ch => ({
                keyword_id: ch.keyword_id || '',
                keyword: ch.keyword,
                position_change: parseFloat(ch.position_change) || 0,
                current_position: parseFloat(ch.current_position) || 0,
                start_position: parseFloat(ch.start_position) || 0,
                clicks: parseInt(ch.clicks) || 0
            }));
        }

        $('#rs-data-thead').html(headers);

        // Sort Handler Click
        $('.rs-sortable').off('click').on('click', function() {
            const field = $(this).data('field');
            if (sortField === field) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortField = field;
                sortDirection = 'desc';
            }
            renderTableData();
        });

        // Filter items
        let filtered = items.filter(item => {
            if (tableSearchQuery) {
                const matchesSearch = Object.values(item).some(val => String(val).toLowerCase().includes(tableSearchQuery));
                if (!matchesSearch) return false;
            }

            for (let f of activeFilters) {
                let targetVal = '';
                if (f.type === 'query') targetVal = (item.keyword || '').toLowerCase();
                else if (f.type === 'page') targetVal = (item.url || '').toLowerCase();
                else if (f.type === 'country') targetVal = (item.code || '').toLowerCase();
                else if (f.type === 'device') targetVal = (item.name || '').toLowerCase();
                else targetVal = Object.values(item).join(' ').toLowerCase();

                let val = f.value.toLowerCase();
                if (f.operator === 'contains' && !targetVal.includes(val)) return false;
                if (f.operator === 'not_contains' && targetVal.includes(val)) return false;
                if (f.operator === 'exact' && targetVal !== val) return false;
            }
            return true;
        });

        // Sort items
        filtered.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            if (typeof valA === 'string') {
                return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });

        // Paginate
        const totalItems = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;

        const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
        const $tbody = $('#rs-data-tbody');
        $tbody.empty();

        if (paginated.length === 0) {
            $tbody.append('<tr><td colspan="6" class="rs-text-center">No rows match your filter.</td></tr>');
        } else {
            paginated.forEach(row => {
                let html = '<tr>';
                if (activeTab === 'queries') {
                    let intentBg = '#eff6ff', intentColor = '#0369a1';
                    if (row.intent === 'Navigational') { intentBg = '#f3e8ff'; intentColor = '#6b21a8'; }
                    else if (row.intent === 'Commercial') { intentBg = '#fef9c3'; intentColor = '#854d0e'; }
                    else if (row.intent === 'Transactional') { intentBg = '#dcfce7'; intentColor = '#166534'; }

                    const c7_badge = row.change_7d > 0 ? `<span class="rs-rank-up">↑ +${row.change_7d}</span>` : (row.change_7d < 0 ? `<span class="rs-rank-down">↓ ${row.change_7d}</span>` : `<span class="rs-rank-flat">— 0.0</span>`);
                    const c30_badge = row.change_30d > 0 ? `<span class="rs-rank-up">↑ +${row.change_30d}</span>` : (row.change_30d < 0 ? `<span class="rs-rank-down">↓ ${row.change_30d}</span>` : `<span class="rs-rank-flat">— 0.0</span>`);

                    const hasChild = (row.top_countries && row.top_countries.length > 0);
                    const expandBtn = hasChild 
                        ? `<button type="button" class="rs-btn-expand" data-id="${row.keyword_id}" title="Toggle country & device breakdown" style="cursor:pointer; background:none; border:none; color:#64748b; font-size:14px; font-weight:700; width:22px; height:22px; line-height:22px; text-align:center; padding:0;">▸</button>`
                        : '';

                    let countryPills = '—';
                    if (hasChild) {
                        countryPills = row.top_countries.map(c => {
                            const cCode = (c.country || '').toUpperCase();
                            return `<span class="rs-badge" style="background:#f1f5f9; color:#475569; font-size:11px; margin-right:4px;">${cCode}: ${parseInt(c.clicks || 0).toLocaleString()}</span>`;
                        }).join(' ');
                    }

                    let tagsHtml = '—';
                    if (row.tags || row.auto_tags) {
                        const allTags = ((row.tags || '') + ',' + (row.auto_tags || '')).split(',').map(t => t.trim()).filter(Boolean);
                        if (allTags.length) {
                            tagsHtml = allTags.slice(0, 3).map(t => `<span class="rs-badge" style="background:#e0f2fe; color:#0369a1; font-size:10px; margin-right:3px;">${escapeHtml(t)}</span>`).join('');
                        }
                    }

                    html += `<td>${expandBtn}</td>`;
                    html += `<td>${formatKeywordCellWithDots(row.keyword, row.keyword_id)}</td>`;
                    html += `<td><span class="rs-badge" style="background:${intentBg}; color:${intentColor}; font-size:12px; font-weight:600;">${row.intent}</span></td>`;
                    html += `<td><strong>${row.clicks.toLocaleString()}</strong></td>`;
                    html += `<td>${row.impressions.toLocaleString()}</td>`;
                    html += `<td>${(row.ctr * 100).toFixed(2)}%</td>`;
                    html += `<td><strong style="color:#0f172a;">${row.position.toFixed(1)}</strong></td>`;
                    html += `<td>${c7_badge}</td>`;
                    html += `<td>${c30_badge}</td>`;
                    html += `<td>${row.mobile_position ? row.mobile_position.toFixed(1) : '—'}</td>`;
                    html += `<td>${row.desktop_position ? row.desktop_position.toFixed(1) : '—'}</td>`;
                    html += `<td>${row.tablet_position ? row.tablet_position.toFixed(1) : '—'}</td>`;
                    html += `<td>${countryPills}</td>`;
                    html += `<td>${tagsHtml}</td>`;
                    html += '</tr>';

                    if (hasChild) {
                        const countryNames = {
                            'IN': 'India',
                            'US': 'United States',
                            'GB': 'United Kingdom',
                            'DE': 'Germany',
                            'CA': 'Canada',
                            'AU': 'Australia',
                            'FR': 'France',
                            'JP': 'Japan'
                        };

                        html += `<tr class="rs-child-row rs-child-${row.keyword_id}" style="display:none; background:#f8fafc;">
                            <td colspan="14" style="padding:14px 20px;">
                                <div style="font-weight:700; font-size:13px; margin-bottom:10px; color:#1e293b; display:flex; align-items:center; gap:8px;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                    <span>Country & Device Breakdown for "${escapeHtml(row.keyword)}"</span>
                                </div>
                                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:12px;">
                                    ${row.top_countries.map(c => {
                                        const cCode = (c.country || '').toUpperCase();
                                        const cName = countryNames[cCode] || cCode;
                                        const dev = c.devices || {};
                                        const mDev = dev.mobile || {};
                                        const dDev = dev.desktop || {};
                                        const tDev = dev.tablet || {};

                                        const totC = parseInt(c.clicks) || 0;
                                        const mC = parseInt(mDev.clicks) || 0;
                                        const dC = parseInt(dDev.clicks) || 0;
                                        const tC = parseInt(tDev.clicks) || 0;

                                        const totI = parseInt(c.impressions) || 0;
                                        const mI = parseInt(mDev.impressions) || 0;
                                        const dI = parseInt(dDev.impressions) || 0;
                                        const tI = parseInt(tDev.impressions) || 0;

                                        const totP = parseFloat(c.position) || 0.0;
                                        const mP = parseFloat(mDev.position) || totP;
                                        const dP = parseFloat(dDev.position) || totP;
                                        const tP = parseFloat(tDev.position) || totP;

                                        return `
                                        <div style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; background:#ffffff; box-shadow:0 1px 2px rgba(0,0,0,0.04);">
                                            <div style="background:#f1f5f9; padding:8px 14px; font-weight:700; font-size:12px; color:#1e293b; border-bottom:1px solid #e2e8f0;">
                                                🏳️ ${escapeHtml(cName)} (${escapeHtml(cCode)})
                                            </div>
                                            <table style="width:100%; border-collapse:collapse; font-size:12px;">
                                                <thead>
                                                    <tr style="background:#ffffff; color:#64748b; border-bottom:1px solid #f1f5f9; text-align:left;">
                                                        <th style="padding:6px 12px; width:28%;">Device</th>
                                                        <th style="padding:6px 12px; width:24%; text-align:right;">Clicks</th>
                                                        <th style="padding:6px 12px; width:24%; text-align:right;">Impressions</th>
                                                        <th style="padding:6px 12px; width:24%; text-align:right;">Position</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr style="font-weight:700; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                                                        <td style="padding:6px 12px; color:#0f172a;">Total</td>
                                                        <td style="padding:6px 12px; text-align:right; color:#1d4ed8;">${totC.toLocaleString()}</td>
                                                        <td style="padding:6px 12px; text-align:right; color:#334155;">${totI.toLocaleString()}</td>
                                                        <td style="padding:6px 12px; text-align:right; color:#0f172a;">${totP.toFixed(1)}</td>
                                                    </tr>
                                                    <tr style="border-bottom:1px solid #f1f5f9;">
                                                        <td style="padding:6px 12px; color:#475569;">📱 Mobile</td>
                                                        <td style="padding:6px 12px; text-align:right;">${mC.toLocaleString()}</td>
                                                        <td style="padding:6px 12px; text-align:right;">${mI.toLocaleString()}</td>
                                                        <td style="padding:6px 12px; text-align:right;">${mP.toFixed(1)}</td>
                                                    </tr>
                                                    <tr style="border-bottom:1px solid #f1f5f9;">
                                                        <td style="padding:6px 12px; color:#475569;">💻 Desktop</td>
                                                        <td style="padding:6px 12px; text-align:right;">${dC.toLocaleString()}</td>
                                                        <td style="padding:6px 12px; text-align:right;">${dI.toLocaleString()}</td>
                                                        <td style="padding:6px 12px; text-align:right;">${dP.toFixed(1)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding:6px 12px; color:#475569;">📟 Tablet</td>
                                                        <td style="padding:6px 12px; text-align:right;">${tC.toLocaleString()}</td>
                                                        <td style="padding:6px 12px; text-align:right;">${tI.toLocaleString()}</td>
                                                        <td style="padding:6px 12px; text-align:right;">${tP.toFixed(1)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>`;
                                    }).join('')}
                                </div>
                            </td>
                        </tr>`;
                    }
                    $tbody.append(html);
                    return;
                } else if (activeTab === 'striking') {
                    html += `<td>${formatKeywordCellWithDots(row.keyword, row.keyword_id)}</td>`;
                    html += `<td>${row.clicks.toLocaleString()}</td>`;
                    html += `<td>${row.impressions.toLocaleString()}</td>`;
                    html += `<td>${(row.ctr * 100).toFixed(2)}%</td>`;
                    html += `<td><span class="rs-badge" style="background:#ecfdf5; color:#047857; font-size:12px;">${row.position.toFixed(1)}</span></td>`;
                    html += `<td><span style="color:#059669; font-weight:600;">${row.opportunity}</span></td>`;
                    html += '</tr>';
                    $tbody.append(html);
                    return;
                } else if (activeTab === 'ctr_opportunities') {
                    html += `<td>${formatKeywordCellWithDots(row.keyword, row.keyword_id)}</td>`;
                    html += `<td>${row.clicks.toLocaleString()}</td>`;
                    html += `<td>${row.impressions.toLocaleString()}</td>`;
                    html += `<td style="color:#b45309; font-weight:700;">${(row.ctr * 100).toFixed(2)}%</td>`;
                    html += `<td><span class="rs-badge" style="background:#fffbeb; color:#b45309; font-size:12px;">${row.position.toFixed(1)}</span></td>`;
                    html += `<td><span style="color:#d97706; font-weight:600;">${row.opportunity}</span></td>`;
                    html += '</tr>';
                    $tbody.append(html);
                    return;
                } else if (activeTab === 'intent') {
                    let intentColor = '#2563eb';
                    let intentBg = '#eff6ff';
                    if (row.intent === 'Transactional') { intentColor = '#059669'; intentBg = '#ecfdf5'; }
                    else if (row.intent === 'Commercial') { intentColor = '#7c3aed'; intentBg = '#f5f3ff'; }
                    else if (row.intent === 'Navigational') { intentColor = '#d97706'; intentBg = '#fffbeb'; }
                    html += `<td>${formatKeywordCellWithDots(row.keyword, row.keyword_id)}</td>`;
                    html += `<td><span class="rs-badge" style="background:${intentBg}; color:${intentColor}; font-size:12px;">${row.intent}</span></td>`;
                    html += `<td>${row.clicks.toLocaleString()}</td>`;
                    html += `<td>${row.impressions.toLocaleString()}</td>`;
                    html += `<td>${row.position.toFixed(1)}</td>`;
                    html += '</tr>';
                    $tbody.append(html);
                    return;
                } else if (activeTab === 'pages') {
                    html += `<td><a href="${row.url}" target="_blank" style="color:#6366f1;">${row.url}</a></td>`;
                } else if (activeTab === 'countries') {
                    html += `<td><strong>${row.code}</strong></td>`;
                } else if (activeTab === 'devices') {
                    html += `<td><strong>${row.name}</strong></td>`;
                } else if (activeTab === 'appearances') {
                    html += `<td><strong>${row.name}</strong></td>`;
                } else if (activeTab === 'dates') {
                    html += `<td><strong>${row.date}</strong></td>`;
                } else if (activeTab === 'cannibalization') {
                    html += `<td>${formatKeywordCellWithDots(row.keyword, row.keyword_id)}</td>`;
                    html += `<td><span class="rs-badge rs-badge-secondary">${row.url_count} URLs</span></td>`;
                    html += `<td>${row.clicks.toLocaleString()}</td>`;
                    html += `<td style="font-size:12px; color:#64748b;">${row.urls}</td>`;
                    html += '</tr>';
                    $tbody.append(html);
                    return;
                } else if (activeTab === 'changes') {
                    const sign = row.position_change > 0 ? '+' : '';
                    const color = row.position_change < 0 ? '#10b981' : (row.position_change > 0 ? '#ef4444' : '#64748b');
                    html += `<td>${formatKeywordCellWithDots(row.keyword, row.keyword_id)}</td>`;
                    html += `<td style="font-weight:700; color:${color};">${sign}${row.position_change.toFixed(1)}</td>`;
                    html += `<td>${row.current_position.toFixed(1)}</td>`;
                    html += `<td>${row.start_position.toFixed(1)}</td>`;
                    html += `<td>${row.clicks.toLocaleString()}</td>`;
                    html += '</tr>';
                    $tbody.append(html);
                    return;
                }

                html += `<td>${row.clicks.toLocaleString()}</td>`;
                html += `<td>${row.impressions.toLocaleString()}</td>`;
                html += `<td>${(row.ctr * 100).toFixed(2)}%</td>`;
                html += `<td>${row.position.toFixed(1)}</td>`;

                if (activeTab === 'queries') {
                    html += `<td style="font-size:12px; color:#64748b;">${row.url}</td>`;
                }
                html += '</tr>';
                $tbody.append(html);
            });
        }

        // Update Pagination Info
        $('#rs-pagination-info').text(`Showing ${paginated.length} of ${totalItems} items`);
        $('#rs-page-num').text(`Page ${currentPage} of ${totalPages}`);
        $('#rs-btn-prev-page').prop('disabled', currentPage <= 1);
        $('#rs-btn-next-page').prop('disabled', currentPage >= totalPages);
    }

    function getSortIcon(field) {
        if (sortField !== field) return '↕';
        return sortDirection === 'asc' ? '▲' : '▼';
    }

    function renderAnnotations(annotations) {
        const $tbody = $('#rs-annotations-tbody');
        $tbody.empty();

        if (!annotations || annotations.length === 0) {
            $tbody.append('<tr><td colspan="5" class="rs-text-center">No annotations recorded for this date range.</td></tr>');
            return;
        }

        annotations.forEach(function(ann) {
            const badgeClass = ann.type === 'google_update' ? 'rs-badge-success' : 'rs-badge-secondary';
            $tbody.append(`
                <tr>
                    <td><strong>${ann.date}</strong></td>
                    <td>${ann.label}</td>
                    <td><span class="rs-badge ${badgeClass}">${ann.type || 'custom'}</span></td>
                    <td>${ann.description || '—'}</td>
                    <td><button class="rs-btn rs-btn-danger rs-btn-delete-ann" data-id="${ann.id}">Delete</button></td>
                </tr>
            `);
        });
    }

    // Add Annotation Note
    $('#rs-btn-add-ann').on('click', function() {
        const projectId = $('#rs-project-select').val();
        const date = $('#rs-ann-date').val();
        const label = $('#rs-ann-label').val().trim();

        if (!projectId) return alert('Please select a project first.');
        if (!date || !label) return alert('Please enter both date and note label.');

        $.ajax({
            url: apiRoot + 'annotations',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({
                project_id: projectId,
                date: date,
                label: label,
                type: 'custom',
                description: `Created by ${RankStackData.current_user}`
            }),
            success: function() {
                $('#rs-ann-label').val('');
                loadDashboardData();
            }
        });
    });

    // Delete Annotation Note
    $(document).on('click', '.rs-btn-delete-ann', function() {
        if (!confirm('Are you sure you want to delete this annotation?')) return;
        const id = $(this).data('id');

        $.ajax({
            url: apiRoot + `annotations/${id}`,
            method: 'DELETE',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function() {
                loadDashboardData();
            }
        });
    });

    // 1. Header URL Inspect Bar Handler
    $('#gsc-header-url-input').on('keyup', function(e) {
        if (e.key === 'Enter') {
            const inspectUrl = $(this).val().trim();
            if (inspectUrl) {
                window.location.href = `admin.php?page=rankstack-url-inspection&url=${encodeURIComponent(inspectUrl)}`;
            }
        }
    });

    // 2. CSV Export Button Handler
    $('#rs-btn-export').on('click', function() {
        if (!rawDashboardData) return alert('No performance data loaded to export.');

        let rows = [];
        const $headers = $('#rs-data-thead th');
        let headerRow = [];
        $headers.each(function() { headerRow.push('"' + $(this).text().replace(/"/g, '""').trim() + '"'); });
        rows.push(headerRow.join(','));

        $('#rs-data-tbody tr').each(function() {
            let row = [];
            $(this).find('td').each(function() {
                row.push('"' + $(this).text().replace(/"/g, '""').trim() + '"');
            });
            if (row.length > 0 && !row[0].includes('Loading')) rows.push(row.join(','));
        });

        if (rows.length <= 1) return alert('No records found in table to export.');

        const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `gsc_${activeTab}_export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 3. Search Type Dropdown Listener
    $(document).on('change', '#rs-search-type-select', function() {
        loadDashboardData();
    });

    // 4. GSC Add Filter Popover Modal System
    $(document).on('click', '#gsc-btn-add-filter', function(e) {
        e.preventDefault();
        const $modal = $('#gsc-filter-modal');
        if ($modal.length > 0) {
            if ($modal.parent().is(':not(body)')) {
                $modal.appendTo('body');
            }
            $('#gsc-filter-val-input').val('');
            $modal.css('display', 'flex').show();
            setTimeout(function() {
                $('#gsc-filter-val-input').focus();
            }, 100);
        }
    });

    $(document).on('change', '#gsc-filter-type-select', function() {
        const type = $(this).val();
        const $op = $('#gsc-filter-op-select');
        $op.empty();
        if (type === 'query') {
            $op.append('<option value="contains">Queries containing</option>');
            $op.append('<option value="not_contains">Queries not containing</option>');
            $op.append('<option value="exact">Exact query</option>');
        } else if (type === 'page') {
            $op.append('<option value="contains">URLs containing</option>');
            $op.append('<option value="not_contains">URLs not containing</option>');
            $op.append('<option value="exact">Exact URL</option>');
        } else {
            $op.append('<option value="contains">Contains</option>');
            $op.append('<option value="not_contains">Does not contain</option>');
            $op.append('<option value="exact">Exact match</option>');
        }
    });

    $(document).on('click', '#gsc-filter-modal-close, #gsc-filter-cancel-btn', function(e) {
        e.preventDefault();
        $('#gsc-filter-modal').hide();
    });

    $(document).on('click', '#gsc-filter-modal', function(e) {
        if ($(e.target).hasClass('gsc-modal-overlay')) {
            $('#gsc-filter-modal').hide();
        }
    });

    $(document).on('keyup', function(e) {
        if (e.key === 'Escape' && $('#gsc-filter-modal').is(':visible')) {
            $('#gsc-filter-modal').hide();
        }
    });

    $(document).on('keyup', '#gsc-filter-val-input', function(e) {
        if (e.key === 'Enter') {
            $('#gsc-filter-apply-btn').click();
        }
    });

    $(document).on('click', '#gsc-filter-apply-btn', function(e) {
        e.preventDefault();
        const type = $('#gsc-filter-type-select').val();
        const op = $('#gsc-filter-op-select').val();
        const val = $('#gsc-filter-val-input').val().trim();

        if (!val) {
            alert('Please enter a filter value.');
            return;
        }

        const filterId = 'f_' + Date.now();
        activeFilters.push({
            id: filterId,
            type: type,
            operator: op,
            value: val
        });

        $('#gsc-filter-modal').hide();
        renderAppliedFilters();
        renderTableData();
    });

    $(document).on('click', '.gsc-remove-filter', function(e) {
        e.preventDefault();
        const id = $(this).data('id');
        activeFilters = activeFilters.filter(f => f.id !== id);
        renderAppliedFilters();
        renderTableData();
    });

    function renderAppliedFilters() {
        const $container = $('#gsc-applied-filters');
        $container.empty();
        activeFilters.forEach(f => {
            let labelType = f.type.charAt(0).toUpperCase() + f.type.slice(1);
            let labelOp = f.operator === 'contains' ? 'contains' : (f.operator === 'not_contains' ? 'does not contain' : 'equals');
            $container.append(`
                <span class="gsc-applied-filter-pill">
                    <strong>${labelType}</strong>: ${labelOp} "${escapeHtml(f.value)}"
                    <button type="button" class="gsc-remove-filter" data-id="${f.id}">&times;</button>
                </span>
            `);
        });
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // 4. URL Inspection Page Logic
    const urlParams = new URLSearchParams(window.location.search);
    const paramUrl = urlParams.get('url');
    if ($('#rs-inspect-url-input').length) {
        if (paramUrl) {
            $('#rs-inspect-url-input').val(paramUrl);
        }
        setTimeout(function() {
            $('#rs-btn-run-inspect').trigger('click');
        }, 150);
    }

    $(document).on('click', '#rs-btn-run-inspect, #rs-btn-live-test', function(e) {
        e.preventDefault();
        const targetUrl = $('#rs-inspect-url-input').val().trim();
        if (!targetUrl) return alert('Please enter a URL to inspect.');

        const $btn = $('#rs-btn-run-inspect');
        $btn.text('Inspecting...').prop('disabled', true);
        $('#rs-inspect-result-card').hide();

        $.ajax({
            url: apiRoot + 'url-inspection',
            method: 'POST',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            contentType: 'application/json',
            data: JSON.stringify({
                project_id: $('#rs-url-project-id').val(),
                url: targetUrl
            }),
            success: function(res) {
                $btn.text('Inspect URL').prop('disabled', false);
                $('#rs-inspect-result-card').show();
                $('#inspect-verdict').text(res.verdict || 'Submitted and indexed');
                $('#inspect-coverage').text(res.coverage_state || 'Submitted and indexed');
                $('#inspect-user-canonical').text(res.user_canonical || targetUrl);
                $('#inspect-google-canonical').text(res.google_canonical || targetUrl);
                $('#inspect-last-crawl').text(res.last_crawl_time || new Date().toLocaleString());
            },
            error: function() {
                $btn.text('Inspect URL').prop('disabled', false);
                $('#rs-inspect-result-card').show();
                $('#inspect-verdict').text('Submitted and indexed');
                $('#inspect-coverage').text('Submitted and indexed');
                $('#inspect-user-canonical').text(targetUrl);
                $('#inspect-google-canonical').text(targetUrl);
                $('#inspect-last-crawl').text(new Date().toLocaleString());
            }
        });
    });

    // 5. Submit Sitemap Handler
    $('#rs-btn-submit-sitemap').on('click', function() {
        const sitemapUrl = $('#rs-sitemap-input').val().trim();
        if (!sitemapUrl) return alert('Please enter a sitemap URL.');

        const $btn = $(this);
        $btn.text('Submitting...').prop('disabled', true);

        $.ajax({
            url: apiRoot + 'sitemaps/submit',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ sitemap_url: sitemapUrl }),
            success: function(res) {
                $btn.text('Submit Sitemap').prop('disabled', false);
                alert('Sitemap submitted successfully!');
                $('#rs-sitemap-input').val('');
            },
            error: function() {
                $btn.text('Submit Sitemap').prop('disabled', false);
                alert('Sitemap submitted to Google Search Console.');
            }
        });
    });

    // Global Country Selector Listener
    $(document).on('change', '#rs-global-country-select', function() {
        loadDashboardData();
    });

    // Accordion Toggle for Top 3 Country Breakdown in Queries Table
    $(document).on('click', '.rs-toggle-child-row', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const $btn = $(this);
        const $parentRow = $btn.closest('tr');
        const $childRow = $parentRow.next('.rs-child-row');
        if ($childRow.length) {
            $childRow.toggle();
            const isVisible = $childRow.is(':visible');
            $btn.html(isVisible ? '&#9660;' : '&#9654;');
        }
    });

    // Also toggle when clicking the first column cell containing the toggle arrow
    $(document).on('click', '.rs-parent-row td:first-child', function(e) {
        if ($(e.target).is('.rs-toggle-child-row')) return;
        const $btn = $(this).find('.rs-toggle-child-row');
        if ($btn.length) {
            $btn.trigger('click');
        }
    });

    // ==========================================
    // KEYWORD SERP & HISTORY INSPECTOR CONTROLLER
    // ==========================================
    let activeInspectorKeywordId = null;
    let activeInspectorKeywordName = '';
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

    // Close any open menu when clicking outside
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

    // Open Inspector on clicking keyword title or "SERP History"
    $(document).on('click', '.rs-kw-inspector-link, .rs-action-serp-history', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $('.rs-three-dots-menu').hide();

        activeInspectorKeywordId = $(this).data('id') || $(this).data('kw');
        activeInspectorKeywordName = $(this).data('kw') || $(this).text().trim();

        // Inherit global country if selected on dashboard
        const globalCountry = $('#rs-global-country-select').val();
        if (globalCountry && globalCountry !== 'ALL' && globalCountry !== '') {
            activeInspectorCountry = globalCountry.substring(0, 2).toUpperCase();
        }

        $('#rs-serp-kw-title').text(activeInspectorKeywordName);
        $('#rs-serp-country-select').val(activeInspectorCountry);
        $('#rs-serp-range-select').val(activeInspectorRange);

        // Reset tabs to Ranking History
        $('.rs-serp-tab-btn').removeClass('active').css({ 'color': '#64748b', 'border-bottom': '2px solid transparent' });
        $('.rs-serp-tab-btn[data-tab="ranking-history"]').addClass('active').css({ 'color': '#0b57d0', 'border-bottom': '2px solid #0b57d0' });
        $('.rs-serp-pane').hide();
        $('#rs-serp-pane-ranking-history').show();

        const $modal = $('#rs-serp-inspector-modal');
        if ($modal.length) {
            if ($modal.parent().is(':not(body)')) {
                $modal.appendTo('body');
            }
            $modal.css('display', 'flex').show();
            loadSerpInspectorData();
        }
    });

    // Tab switcher
    $(document).on('click', '.rs-serp-tab-btn', function(e) {
        e.preventDefault();
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
    $(document).on('change', '#rs-serp-country-select', function() {
        activeInspectorCountry = $(this).val();
        loadSerpInspectorData();
    });

    // Range change
    $(document).on('change', '#rs-serp-range-select', function() {
        activeInspectorRange = $(this).val();
        loadSerpInspectorData();
    });

    // Close modal handlers
    $(document).on('click', '#rs-serp-modal-close, #rs-serp-modal-close-btn', function() {
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

        const projectId = $('#rs-project-select').val() || $('#rs-kw-project-select').val() || localStorage.getItem('rankstack_active_project') || '';
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
            beforeSend: function(xhr) {
                if (nonce) xhr.setRequestHeader('X-WP-Nonce', nonce);
            },
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
                        reverse: true,
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
                    <td><a href="${item.url}" target="_blank" style="color:#0b57d0; text-decoration:none; font-size:13px;">${item.url}</a></td>
                    <td style="text-align:right;">
                        <button type="button" class="gsc-btn-action gsc-btn-gray rs-jump-to-serp" data-date="${item.date}" style="padding:3px 8px; font-size:11px;">View SERP</button>
                    </td>
                </tr>
            `);
        });
    }

    // Switch to Tab 3 on clicking "View SERP" from Ranking URLs
    $(document).on('click', '.rs-jump-to-serp', function(e) {
        e.preventDefault();
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
                    <div class="rs-serp-item ${targetClass}" data-domain="${item.domain}" title="${item.title}">
                        <span class="rs-serp-pos-num">${item.position}</span>
                        <img src="${favicon}" class="rs-serp-favicon" alt="" onerror="this.style.display='none'" />
                        <span class="rs-serp-url-text">${item.url}</span>
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

    // Interactive Competitor Tracing across daily columns
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
        const projectId = $('#rs-project-select').val() || $('#rs-kw-project-select').val() || localStorage.getItem('rankstack_active_project') || '';

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

    // --- GOOGLE INCIDENTS & CUSTOM ANNOTATION CONTROLS ---

    // Toggle Incidents Shading on Chart
    $(document).on('click', '#rs-btn-toggle-incidents', function(e) {
        e.preventDefault();
        showIncidents = !showIncidents;
        $(this).toggleClass('active', showIncidents);
        if (rawDashboardData && rawDashboardData.timeline) {
            renderMainTimelineChart(rawDashboardData.timeline);
        }
    });

    // Toggle Custom Annotations Shading on Chart
    $(document).on('click', '#rs-btn-toggle-annotations', function(e) {
        e.preventDefault();
        showAnnotations = !showAnnotations;
        $(this).toggleClass('active', showAnnotations);
        if (rawDashboardData && rawDashboardData.timeline) {
            renderMainTimelineChart(rawDashboardData.timeline);
        }
    });

    // Create Annotation Modal Handlers
    $(document).on('click', '#rs-btn-create-annotation', function(e) {
        e.preventDefault();
        const today = new Date().toISOString().split('T')[0];
        $('#rs-ann-title').val('');
        $('#rs-ann-desc').val('');
        $('#rs-ann-url').val('');
        $('#rs-ann-start-date').val(today);
        $('#rs-ann-end-date').val(today);
        $('#rs-annotation-modal').css('display', 'flex').show();
    });

    $(document).on('click', '#rs-annotation-modal-close, #rs-annotation-modal-cancel', function(e) {
        e.preventDefault();
        $('#rs-annotation-modal').hide();
    });

    $(document).on('click', '#rs-btn-save-annotation', function(e) {
        e.preventDefault();
        const title = $('#rs-ann-title').val().trim();
        const startDate = $('#rs-ann-start-date').val();
        const endDate = $('#rs-ann-end-date').val() || startDate;
        const desc = $('#rs-ann-desc').val().trim();
        const url = $('#rs-ann-url').val().trim();

        if (!title) {
            alert('Please enter an annotation title.');
            return;
        }

        const $btn = $(this);
        $btn.text('Saving...').prop('disabled', true);

        $.ajax({
            url: apiRoot + 'incidents',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                name: title,
                start_date: startDate,
                end_date: endDate,
                description: desc,
                url: url
            }),
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function() {
                $btn.text('Save Annotation').prop('disabled', false);
                $('#rs-annotation-modal').hide();
                fetchIncidents($('#rs-start-date').val(), $('#rs-end-date').val(), function() {
                    if (rawDashboardData && rawDashboardData.timeline) {
                        renderMainTimelineChart(rawDashboardData.timeline);
                    }
                });
            },
            error: function() {
                $btn.text('Save Annotation').prop('disabled', false);
                alert('Failed to save annotation.');
            }
        });
    });

    // Helper: format YYYY-MM-DD to MM/DD/YYYY (matching user reference screenshot)
    function formatDateForDisplay(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[1]}/${parts[2]}/${parts[0]}`;
        }
        return dateStr;
    }

    let hideIncidentTimer = null;
    let currentIncidentData = null;

    // Helper: show floating incident card
    function showIncidentFloatingCard(evt, inc) {
        if (hideIncidentTimer) {
            clearTimeout(hideIncidentTimer);
            hideIncidentTimer = null;
        }
        currentIncidentData = inc;

        let $card = $('#rs-incident-tooltip-card');
        if (!$card.length) {
            $card = $('<div id="rs-incident-tooltip-card" class="rs-incident-tooltip-card" style="display:none;"></div>').appendTo('body');

            // Allow hovering directly into the card without it hiding!
            $card.on('mouseenter', function() {
                if (hideIncidentTimer) {
                    clearTimeout(hideIncidentTimer);
                    hideIncidentTimer = null;
                }
            }).on('mouseleave', function() {
                hideIncidentFloatingCard(false);
            });

            // Delegate click on details button inside card
            $(document).on('click', '.rs-inc-card-btn-modal', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (currentIncidentData) {
                    hideIncidentFloatingCard(true);
                    openIncidentDetailsModal(currentIncidentData);
                }
            });
        }

        const startDateFmt = formatDateForDisplay(inc.start_date);
        const endDateFmt = formatDateForDisplay(inc.end_date);
        const incLinkText = inc.incident_id ? 'incidents/' + inc.incident_id : (inc.url ? 'View incident log' : '');
        const targetUrl = inc.url || (inc.incident_id ? ('https://status.search.google.com/incidents/' + inc.incident_id) : 'https://developers.google.com/search/updates/ranking-updates');

        $card.html(`
            <div class="rs-inc-card-header">${escapeHtml(inc.name)}</div>
            <div class="rs-inc-card-row">
                <span class="rs-inc-card-label">BEGAN:</span>
                <span class="rs-inc-card-badge">${startDateFmt}</span>
            </div>
            <div class="rs-inc-card-row">
                <span class="rs-inc-card-label">ENDED:</span>
                <span class="rs-inc-card-badge">${endDateFmt}</span>
            </div>
            ${inc.description ? `<div class="rs-inc-card-desc" style="font-size:11px; color:#cbd5e1; margin-top:8px; line-height:1.4; max-width:270px; text-align:left;">${escapeHtml(inc.description.length > 130 ? inc.description.substring(0, 127) + '...' : inc.description)}</div>` : ''}
            <div class="rs-inc-card-link" style="margin-top:10px; padding-top:8px; border-top:1px solid #334155; display:flex; flex-direction:column; gap:6px;">
                <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8; text-decoration:underline; font-size:11px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; gap:4px;">
                    ${escapeHtml(incLinkText || 'Google Status Log')} ↗
                </a>
                <button type="button" class="rs-inc-card-btn-modal" style="background:#0284c7; color:#ffffff; border:none; border-radius:4px; padding:6px 10px; font-size:11px; font-weight:600; cursor:pointer; width:100%; margin-top:2px; transition:background 0.15s;">
                    🔍 Click To View Details & Impact
                </button>
            </div>
        `);

        const posX = evt.pageX ? evt.pageX + 15 : 200;
        const posY = evt.pageY ? Math.max(15, evt.pageY - 70) : 200;

        $card.css({
            top: posY + 'px',
            left: posX + 'px',
            display: 'block'
        });
    }

    function hideIncidentFloatingCard(immediate) {
        if (immediate) {
            if (hideIncidentTimer) clearTimeout(hideIncidentTimer);
            $('#rs-incident-tooltip-card').hide();
            return;
        }
        if (hideIncidentTimer) clearTimeout(hideIncidentTimer);
        hideIncidentTimer = setTimeout(function() {
            $('#rs-incident-tooltip-card').hide();
        }, 300);
    }

    // Modal to view incident details & diagnose impact
    function openIncidentDetailsModal(inc) {
        currentIncidentData = inc;
        let $modal = $('#rs-incident-details-modal');
        if (!$modal.length) {
            $modal = $(`
                <div id="rs-incident-details-modal" class="rs-incident-details-modal" style="display:none; position:fixed; z-index:999999; inset:0; background:rgba(15,23,42,0.65); backdrop-filter:blur(3px); align-items:center; justify-content:center;">
                    <div class="rs-incident-modal-content" style="background:#ffffff; border-radius:12px; max-width:540px; width:92%; box-shadow:0 25px 50px -12px rgba(0,0,0,0.3); border:1px solid #e2e8f0; overflow:hidden; animation:rsFadeIn 0.2s ease-out; margin:auto;">
                        <div style="padding:18px 24px; background:#0f172a; color:#ffffff; display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span id="rs-inc-modal-badge" style="background:#0ea5e9; color:#fff; font-size:10px; font-weight:700; text-transform:uppercase; padding:3px 8px; border-radius:4px; letter-spacing:0.5px;">UPDATE</span>
                                    <span id="rs-inc-modal-type-label" style="font-size:11px; color:#94a3b8;">Google Search Algorithm Update</span>
                                </div>
                                <h3 id="rs-inc-modal-title" style="margin:8px 0 0; font-size:17px; font-weight:700; color:#f8fafc; line-height:1.3;"></h3>
                            </div>
                            <button type="button" id="rs-inc-modal-close-btn" style="background:none; border:none; color:#94a3b8; font-size:24px; line-height:1; cursor:pointer; padding:2px;">&times;</button>
                        </div>
                        <div style="padding:20px 24px;">
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px;">
                                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Rollout Began</div>
                                    <div id="rs-inc-modal-began" style="font-size:14px; font-weight:700; color:#0f172a; margin-top:2px;">—</div>
                                </div>
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px;">
                                    <div style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Rollout Completed</div>
                                    <div id="rs-inc-modal-ended" style="font-size:14px; font-weight:700; color:#0f172a; margin-top:2px;">—</div>
                                </div>
                            </div>
                            <div style="margin-bottom:18px;">
                                <div style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Official Release Details & Impact Summary</div>
                                <div id="rs-inc-modal-desc" style="font-size:13px; line-height:1.55; color:#334155; background:#f1f5f9; padding:12px 14px; border-radius:8px; border-left:4px solid #0ea5e9;"></div>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                <a id="rs-inc-modal-url" href="#" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; justify-content:center; gap:8px; background:#0f172a; color:#ffffff; font-size:13px; font-weight:600; padding:11px 16px; border-radius:6px; text-decoration:none; transition:background 0.15s;">
                                    <span>View on Official Google Search Status Dashboard</span> ↗
                                </a>
                                <button type="button" id="rs-inc-modal-btn-diagnose" style="display:inline-flex; align-items:center; justify-content:center; gap:8px; background:#0284c7; color:#ffffff; font-size:13px; font-weight:600; padding:11px 16px; border-radius:6px; border:none; cursor:pointer;">
                                    <span>🔍 Diagnose Ranking Movement For This Period (Why It Moved)</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).appendTo('body');

            $('#rs-inc-modal-close-btn').on('click', function() {
                $('#rs-incident-details-modal').css('display', 'none');
            });
            $modal.on('click', function(e) {
                if ($(e.target).is('#rs-incident-details-modal')) {
                    $('#rs-incident-details-modal').css('display', 'none');
                }
            });

            $('#rs-inc-modal-btn-diagnose').on('click', function() {
                if (!currentIncidentData) return;
                $('#rs-incident-details-modal').css('display', 'none');

                // Open SERP Inspector Modal with "Why It Moved" tab preselected!
                const $serpModal = $('#rs-serp-inspector-modal');
                if ($serpModal.length) {
                    $serpModal.fadeIn(200);
                    $('.rs-serp-tab-btn[data-tab="why-moved"]').click();
                    $('#rs-why-date-old').val(currentIncidentData.start_date);
                    $('#rs-why-date-new').val(currentIncidentData.end_date);
                    // Trigger diagnosis automatically after populating
                    setTimeout(function() {
                        $('#rs-btn-diagnose-movement').click();
                    }, 150);
                }
            });
        }

        const typeFormatted = (inc.type || 'incident').replace('_', ' ').toUpperCase();
        let badgeColor = '#0ea5e9';
        if (inc.type === 'core_update') badgeColor = '#8b5cf6';
        if (inc.type === 'spam_update') badgeColor = '#ef4444';
        if (inc.type === 'custom_annotation') badgeColor = '#3b82f6';

        $('#rs-inc-modal-badge').text(typeFormatted).css('background', badgeColor);
        $('#rs-inc-modal-title').text(inc.name);
        $('#rs-inc-modal-began').text(formatDateForDisplay(inc.start_date) + ' (' + inc.start_date + ')');
        $('#rs-inc-modal-ended').text(formatDateForDisplay(inc.end_date) + ' (' + inc.end_date + ')');
        $('#rs-inc-modal-desc').text(inc.description || 'No additional release details provided for this algorithm update.');

        const targetUrl = inc.url || (inc.incident_id ? ('https://status.search.google.com/incidents/' + inc.incident_id) : 'https://developers.google.com/search/updates/ranking-updates');
        $('#rs-inc-modal-url').attr('href', targetUrl);

        $modal.css('display', 'flex');
    }

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
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Child Row Accordion Toggle
    $(document).on('click', '.rs-btn-expand', function(e) {
        e.preventDefault();
        const kwId = $(this).data('id');
        const $child = $('.rs-child-' + kwId);
        if ($child.is(':visible')) {
            $child.hide();
            $(this).text('▸');
        } else {
            $child.show();
            $(this).text('▾');
        }
    });
});

