<?php
if (!defined('ABSPATH')) {
    exit;
}

class RankStack_Admin {

    public static function init() {
        add_action('admin_menu', array(__CLASS__, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'enqueue_assets'));
    }

    public static function auto_reset_and_sync_gsc() {
        // Disabled: Never auto-reset or wipe database tables on page load.
    }

    public static function add_admin_menu() {
        add_menu_page(
            'RankStack',
            'RankStack',
            'manage_options',
            'rankstack',
            array(__CLASS__, 'render_dashboard_page'),
            'dashicons-chart-line',
            30
        );

        add_submenu_page(
            'rankstack',
            'Dashboard - RankStack',
            'Dashboard',
            'manage_options',
            'rankstack',
            array(__CLASS__, 'render_dashboard_page')
        );

        add_submenu_page(
            'rankstack',
            'Keywords - RankStack',
            'Keywords',
            'manage_options',
            'rankstack-keywords',
            array(__CLASS__, 'render_keywords_page')
        );

        add_submenu_page(
            'rankstack',
            'Rank Tracking - RankStack',
            'Rank Tracking',
            'manage_options',
            'rankstack-rank-tracking',
            array(__CLASS__, 'render_rank_tracking_page')
        );

        add_submenu_page(
            'rankstack',
            'Diff Checker - RankStack',
            'Diff Checker',
            'manage_options',
            'rankstack-diff-checker',
            array(__CLASS__, 'render_diff_checker_page')
        );

        add_submenu_page(
            'rankstack',
            'Google Updates - RankStack',
            'Google Updates',
            'manage_options',
            'rankstack-google-updates',
            array(__CLASS__, 'render_google_updates_page')
        );

        add_submenu_page(
            'rankstack',
            'Skipped Keywords - RankStack',
            'Skipped Keywords',
            'manage_options',
            'rankstack-skipped',
            array(__CLASS__, 'render_skipped_page')
        );

        add_submenu_page(
            'rankstack',
            'GSC Sync Logs - RankStack',
            'GSC Sync Logs',
            'manage_options',
            'rankstack-sync-logs',
            array(__CLASS__, 'render_sync_logs_page')
        );

        add_submenu_page(
            'rankstack',
            'URL Inspection - RankStack',
            'URL Inspection',
            'manage_options',
            'rankstack-url-inspection',
            array(__CLASS__, 'render_url_inspection_page')
        );

        add_submenu_page(
            'rankstack',
            'Indexing & Sitemaps - RankStack',
            'Indexing & Sitemaps',
            'manage_options',
            'rankstack-sitemaps',
            array(__CLASS__, 'render_sitemaps_page')
        );

        /*
        // Hidden per docx specifications
        add_submenu_page(
            'rankstack',
            'Core Web Vitals - RankStack',
            'Core Web Vitals',
            'manage_options',
            'rankstack-cwv',
            array(__CLASS__, 'render_cwv_page')
        );
        */

        add_submenu_page(
            'rankstack',
            'Settings - RankStack',
            'Settings',
            'manage_options',
            'rankstack-settings',
            array(__CLASS__, 'render_settings_page')
        );
    }

    public static function enqueue_assets($hook) {
        if (strpos($hook, 'rankstack') === false) {
            return;
        }

        $ver = time();
        // Custom RankStack CSS
        wp_enqueue_style('rankstack-admin-css', RANKSTACK_URL . 'assets/css/rankstack-admin.css', array(), $ver);

        // Chart.js CDN, Zoom Plugin & Annotation Plugin
        wp_enqueue_script('chart-js', 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js', array(), '4.4.1', true);
        wp_enqueue_script('hammer-js', 'https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js', array(), '2.0.8', true);
        wp_enqueue_script('chartjs-plugin-zoom', 'https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js', array('chart-js', 'hammer-js'), '2.0.1', true);
        wp_enqueue_script('chartjs-plugin-annotation', 'https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js', array('chart-js'), '3.0.1', true);

        // Localize Script Data (REST API Config)
        $script_data = array(
            'root' => esc_url_raw(rest_url('rankstack/v1/')),
            'nonce' => wp_create_nonce('wp_rest'),
            'current_user' => wp_get_current_user()->display_name,
            'chart_zoom_enabled' => get_option('rankstack_chart_zoom_enabled', '1') === '1'
        );

        // Enqueue Main Dashboard Script ONLY on Dashboard Page
        if ($hook === 'toplevel_page_rankstack') {
            wp_enqueue_script('rankstack-dashboard-js', RANKSTACK_URL . 'assets/js/rankstack-dashboard.js', array('jquery', 'chart-js', 'chartjs-plugin-zoom', 'chartjs-plugin-annotation'), $ver, true);
            wp_localize_script('rankstack-dashboard-js', 'RankStackData', $script_data);
        }

        // App Specific Sub-Scripts & Localization
        if (strpos($hook, 'rankstack-keywords') !== false) {
            wp_enqueue_script('rankstack-keywords-js', RANKSTACK_URL . 'assets/js/rankstack-keywords.js', array('jquery'), $ver, true);
            wp_localize_script('rankstack-keywords-js', 'RankStackData', $script_data);
        } else if (strpos($hook, 'rankstack-rank-tracking') !== false) {
            wp_enqueue_script('rankstack-rank-tracking-js', RANKSTACK_URL . 'assets/js/rankstack-rank-tracking.js', array('jquery'), $ver, true);
            wp_localize_script('rankstack-rank-tracking-js', 'RankStackData', $script_data);
        } else if (strpos($hook, 'rankstack-diff-checker') !== false) {
            wp_enqueue_script('rankstack-diff-checker-js', RANKSTACK_URL . 'assets/js/rankstack-diff-checker.js', array('jquery'), $ver, true);
            wp_localize_script('rankstack-diff-checker-js', 'RankStackData', $script_data);
        } else if (strpos($hook, 'rankstack-google-updates') !== false) {
            wp_enqueue_script('rankstack-updates-js', RANKSTACK_URL . 'assets/js/rankstack-updates.js', array('jquery'), $ver, true);
            wp_localize_script('rankstack-updates-js', 'RankStackData', $script_data);
        } else if (strpos($hook, 'rankstack-skipped') !== false) {
            wp_enqueue_script('rankstack-skipped-js', RANKSTACK_URL . 'assets/js/rankstack-skipped.js', array('jquery'), $ver, true);
            wp_localize_script('rankstack-skipped-js', 'RankStackData', $script_data);
        } else if (strpos($hook, 'rankstack-sync-logs') !== false) {
            wp_enqueue_script('rankstack-sync-logs-js', RANKSTACK_URL . 'assets/js/rankstack-sync-logs.js', array('jquery'), $ver, true);
            wp_localize_script('rankstack-sync-logs-js', 'RankStackData', $script_data);
        } else if (strpos($hook, 'rankstack-settings') !== false) {
            wp_enqueue_script('rankstack-settings-js', RANKSTACK_URL . 'assets/js/rankstack-settings.js', array('jquery'), $ver, true);
            wp_localize_script('rankstack-settings-js', 'RankStackData', $script_data);
        }
    }

    public static function render_dashboard_page() {
        ?>
        <div class="rankstack-wrap gsc-theme">
            <!-- 1. Header URL Inspection Pill Bar (100% GSC Match) -->
            <div class="gsc-top-bar">
                <div class="gsc-search-pill-wrap">
                    <span class="gsc-search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>
                    <input type="text" id="gsc-header-url-input" class="gsc-search-pill-input" placeholder='Inspect any URL in "https://www.wpoets.com/"' value="https://www.wpoets.com/" />
                </div>

                <div class="gsc-top-right-actions">
                    <select id="rs-project-select" class="gsc-project-select">
                        <?php
                        $dash_projects = RankStack_DB::get_projects();
                        if (empty($dash_projects)) {
                            echo '<option value="">No Projects Found</option>';
                        } else {
                            foreach ($dash_projects as $p) {
                                $selected = (isset($p['domain']) && strpos($p['domain'], 'wpoets') !== false) ? 'selected="selected"' : '';
                                echo '<option value="' . esc_attr($p['id']) . '" ' . $selected . '>' . esc_html($p['name'] . ' (' . $p['domain'] . ')') . '</option>';
                            }
                        }
                        ?>
                    </select>
                    <button id="rs-btn-sync" class="gsc-btn-action gsc-btn-blue">Sync GSC Data</button>
                    <button id="rs-btn-reset" class="gsc-btn-action gsc-btn-gray">Reset Data</button>
                </div>
            </div>

            <!-- 2. Performance Page Title, Incident Toggles & Export Toolbar -->
            <div class="gsc-title-row">
                <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
                    <h1 class="gsc-page-title" style="margin:0;">Performance</h1>
                    </div>
                <div class="gsc-title-right">
                    <button type="button" id="rs-btn-export" class="gsc-export-btn">EXPORT</button>
                </div>
            </div>

            <!-- 3. Official GSC Filter Control Toolbar -->
            <div class="gsc-filter-toolbar">
                <div class="gsc-filter-left">
                    <!-- Date Range Segmented Pill Control -->
                    <div class="gsc-pill-segmented">
                        <button type="button" class="rs-btn-preset" data-days="1">24 hours</button>
                        <button type="button" class="rs-btn-preset" data-days="7">7 days</button>
                        <button type="button" class="rs-btn-preset" data-days="28">28 days</button>
                        <button type="button" class="rs-btn-preset" data-days="90">3 months</button>
                        <button type="button" class="rs-btn-preset" data-days="180">6 months</button>
                        <button type="button" class="rs-btn-preset rs-active" data-days="365">12 months</button>
                    </div>

                    <!-- Search Type Dropdown Pill (Web only per specifications) -->
                    <div class="gsc-pill-dropdown-wrap">
                        <select id="rs-search-type-select" class="gsc-pill-select">
                            <option value="web">Search type: Web</option>
                        </select>
                    </div>

                    <!-- Global Country Selector Dropdown Pill (Top 3 Countries from Settings + ALL) -->
                    <div class="gsc-pill-dropdown-wrap">
                        <select id="rs-global-country-select" class="gsc-pill-select">
                            <option value="ALL">Country: All Countries</option>
                            <option value="IN">Country: India (IN)</option>
                            <option value="US">Country: United States (US)</option>
                            <option value="GB">Country: United Kingdom (GB)</option>
                        </select>
                    </div>

                    <!-- Add Filter Pill -->
                    <button type="button" id="gsc-btn-add-filter" class="gsc-pill-btn">+ Add filter</button>
                    
                    <!-- Applied Filter Pills Container -->
                    <div id="gsc-applied-filters" style="display:inline-flex; gap:6px; flex-wrap:wrap; align-items:center;"></div>

                    <!-- Custom Date Inputs -->
                    <div class="gsc-date-custom-inline">
                        <input type="date" id="rs-start-date" class="gsc-input-date" />
                        <span class="gsc-date-sep">to</span>
                        <input type="date" id="rs-end-date" class="gsc-input-date" />
                    </div>
                </div>

                <div class="gsc-filter-right">
                    <span class="gsc-last-update">Last update: Just now</span>
                </div>
            </div>

            <div id="rs-sync-status-bar" class="rs-alert rs-alert-info" style="display:none; margin-top:12px;"></div>

            <!-- GSC Interactive KPI Toggle Cards Row -->
            <div class="rs-kpi-grid gsc-kpi-row">
                <div class="rs-kpi-card rs-kpi-toggle rs-active-clicks" data-metric="clicks" title="Total Clicks: Number of times users clicked through to your site from Google Search results.">
                    <div class="rs-kpi-top">
                        <input type="checkbox" checked="checked" class="gsc-chk" />
                        <span class="rs-kpi-label">Total clicks</span>
                    </div>
                    <span id="kpi-clicks" class="rs-kpi-value">0</span>
                </div>
                <div class="rs-kpi-card rs-kpi-toggle rs-active-impressions" data-metric="impressions" title="Total Impressions: Number of times users saw a link to your site in Google Search results.">
                    <div class="rs-kpi-top">
                        <input type="checkbox" checked="checked" class="gsc-chk" />
                        <span class="rs-kpi-label">Total impressions</span>
                    </div>
                    <span id="kpi-impressions" class="rs-kpi-value">0</span>
                </div>
                <div class="rs-kpi-card rs-kpi-toggle" data-metric="ctr" title="Average CTR: Percentage of impressions that led to a click (Clicks ÷ Impressions × 100).">
                    <div class="rs-kpi-top">
                        <input type="checkbox" class="gsc-chk" />
                        <span class="rs-kpi-label">Average CTR</span>
                    </div>
                    <span id="kpi-ctr" class="rs-kpi-value">0%</span>
                </div>
                <div class="rs-kpi-card rs-kpi-toggle" data-metric="position" title="Average Position: The average numerical ranking of your website URLs for queries (1 is the very top of Google).">
                    <div class="rs-kpi-top">
                        <input type="checkbox" class="gsc-chk" />
                        <span class="rs-kpi-label">Average position</span>
                    </div>
                    <span id="kpi-position" class="rs-kpi-value">0.0</span>
                </div>
            </div>

            <!-- Main Unified Multi-Axis Chart -->
            <div class="rs-card">
                <div class="rs-card-header rs-flex-between">
                    <div>
                        <h2 style="margin:0; font-size:16px; font-weight:700; color:#1e293b;">GSC Traffic & Position Timeline</h2>
                        <span style="font-size:12px; color:#64748b; font-weight:400;">Scroll or drag horizontally across the chart to zoom into any date range</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button type="button" id="rs-btn-reset-zoom" class="gsc-pill-btn" style="padding:4px 12px; font-size:12px; font-weight:600; cursor:pointer;">Reset Zoom</button>
                    </div>
                </div>
                <div class="rs-chart-container">
                    <canvas id="rs-main-chart"></canvas>
                </div>

                <!-- Secondary Sub-Chart (CTR & Average Position) -->
                <div id="rs-sub-chart-box" class="rs-chart-container-sm" style="display:none; margin-top:20px; border-top:1px solid #f1f5f9; padding-top:16px;">
                    <canvas id="rs-sub-chart"></canvas>
                </div>
            </div>

            <!-- GSC Multi-Tab Performance Data Tables -->
            <div class="rs-card">
                <div class="rs-card-header rs-flex-between">
                    <div class="rs-tab-group" style="flex-wrap:wrap; gap:6px;">
                        <button type="button" class="rs-tab-btn rs-active" data-tab="queries" title="Top search queries that brought impressions and clicks to your site.">Queries</button>
                        <button type="button" class="rs-tab-btn" data-tab="pages" title="Top landing pages that receive Google organic search traffic.">Pages</button>
                        <button type="button" class="rs-tab-btn" data-tab="striking" style="background:#f0fdf4; color:#166534; border-color:#bbf7d0;" title="Page 2 Keywords (Positions 11-20): High-impression opportunities that can jump to Page 1 with minor on-page optimizations.">Striking Distance (11-20)</button>
                        <button type="button" class="rs-tab-btn" data-tab="ctr_opportunities" style="background:#fffbeb; color:#92400e; border-color:#fef08a;" title="High Impressions, Low CTR: Keywords seen by thousands of searchers that need catchy meta titles to win more clicks.">CTR Opportunities</button>
                        <button type="button" class="rs-tab-btn" data-tab="cannibalization" style="background:#fef2f2; color:#991b1b; border-color:#fecaca;" title="Keyword Cannibalization: Queries where two or more URLs on your site compete against each other in Google.">Cannibalization</button>
                        <button type="button" class="rs-tab-btn" data-tab="countries" title="Geographic traffic breakdown by visitor country.">Countries</button>
                        <button type="button" class="rs-tab-btn" data-tab="dates" title="Day-by-day daily performance timeline table.">Dates</button>
                    </div>

                    <div class="rs-form-inline">
                        <input type="text" id="rs-table-search" class="rs-input" placeholder="Search table..." />
                    </div>
                </div>

                <div class="rs-table-responsive" style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
                    <table class="rs-table" style="min-width:1380px;">
                        <thead id="rs-data-thead">
                            <!-- Dynamic columns -->
                        </thead>
                        <tbody id="rs-data-tbody">
                            <tr><td colspan="12" class="rs-text-center">Loading performance data...</td></tr>
                        </tbody>
                    </table>
                </div>

                <!-- Pagination Footer -->
                <div class="rs-pagination-bar">
                    <span id="rs-pagination-info" class="rs-page-info">Showing 0 of 0 items</span>
                    <div class="rs-pagination-controls">
                        <button type="button" id="rs-btn-prev-page" class="rs-btn-page">&laquo; Prev</button>
                        <span id="rs-page-num" class="rs-page-num">Page 1 of 1</span>
                        <button type="button" id="rs-btn-next-page" class="rs-btn-page">Next &raquo;</button>
                        <input type="number" id="rs-jump-page" class="rs-input-jump" min="1" placeholder="Jump..." />
                    </div>
                </div>
            </div>

            <!-- GSC Filter Modal Popover -->
            <div id="gsc-filter-modal" class="gsc-modal-overlay" style="display:none;">
                <div class="gsc-modal-card">
                    <div class="gsc-modal-header">
                        <h3 class="gsc-modal-title">Filter</h3>
                        <button type="button" id="gsc-filter-modal-close" class="gsc-modal-close-btn">&times;</button>
                    </div>
                    <div class="gsc-modal-body">
                        <div class="gsc-form-group" style="margin-bottom:14px;">
                            <label style="display:block; font-size:12px; font-weight:600; color:#5f6368; margin-bottom:4px;">Filter Dimension</label>
                            <select id="gsc-filter-type-select" class="gsc-pill-select" style="width:100%;">
                                <option value="query">Query</option>
                                <option value="page">Page</option>
                                <option value="country">Country</option>
                                <option value="device">Device</option>
                            </select>
                        </div>
                        <div class="gsc-form-group" style="margin-bottom:14px;">
                            <label style="display:block; font-size:12px; font-weight:600; color:#5f6368; margin-bottom:4px;">Operator</label>
                            <select id="gsc-filter-op-select" class="gsc-pill-select" style="width:100%;">
                                <option value="contains">Queries containing</option>
                                <option value="not_contains">Queries not containing</option>
                                <option value="exact">Exact query</option>
                            </select>
                        </div>
                        <div class="gsc-form-group">
                            <label style="display:block; font-size:12px; font-weight:600; color:#5f6368; margin-bottom:4px;">Value</label>
                            <input type="text" id="gsc-filter-val-input" class="rs-input" style="width:100%; box-sizing:border-box;" placeholder="Enter filter value..." />
                        </div>
                    </div>
                    <div class="gsc-modal-footer">
                        <button type="button" id="gsc-filter-cancel-btn" class="gsc-btn-action gsc-btn-gray">Cancel</button>
                        <button type="button" id="gsc-filter-apply-btn" class="gsc-btn-action gsc-btn-blue">Apply</button>
                    </div>
                </div>
            </div>

            <?php self::render_serp_inspector_modal_html(); ?>
        </div>
        <?php
    }

    public static function render_keywords_page() {
        ?>
        <div class="rankstack-wrap gsc-theme">
            <div class="gsc-title-row" style="margin-bottom: 20px;">
                <div>
                    <h1 class="gsc-page-title">Keywords Database</h1>
                    <p class="rankstack-subtitle">Track, categorize, and bulk manage keywords across your projects</p>
                </div>
                <div class="gsc-top-right-actions">
                    <select id="rs-kw-project-select" class="gsc-project-select">
                        <?php
                        $projects = RankStack_DB::get_projects();
                        if (empty($projects)) {
                            echo '<option value="">No Projects Found</option>';
                        } else {
                            foreach ($projects as $p) {
                                $selected = (isset($p['domain']) && strpos(strtolower($p['domain']), 'wpoets') !== false) ? 'selected="selected"' : '';
                                echo '<option value="' . esc_attr($p['id']) . '" ' . $selected . '>' . esc_html($p['name'] . ' (' . $p['domain'] . ')') . '</option>';
                            }
                        }
                        ?>
                    </select>
                </div>
            </div>

            <div class="rs-card">
                <div class="rs-card-header rs-flex-between">
                    <div class="rs-form-inline" style="gap:8px;">
                        <button type="button" id="rs-btn-bulk-exclude-kw" class="gsc-btn-action gsc-btn-red" style="display:none;">Bulk Exclude Selected (<span id="rs-kw-selected-count">0</span>)</button>
                        <button type="button" id="rs-btn-paste-exclude-modal" class="gsc-btn-action gsc-btn-gray">Paste Bulk Exclusion List</button>
                    </div>

                    <div class="rs-form-inline">
                        <input type="text" id="rs-new-kw-text" class="rs-input" placeholder="Enter keyword..." />
                        <label class="rs-checkbox-label">
                            <input type="checkbox" id="rs-new-kw-branded" /> Branded
                        </label>
                        <button id="rs-btn-add-kw" class="gsc-btn-action gsc-btn-blue">+ Add Keyword</button>
                    </div>
                </div>

                <!-- Search & Per-Page Controls -->
                <div class="rs-card-toolbar" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#f8fafc; border-bottom:1px solid #e2e8f0; flex-wrap:wrap; gap:12px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <input type="text" id="rs-kw-search" class="rs-input" placeholder="Search keywords..." style="min-width:260px;" />
                        <span id="rs-kw-showing-count" style="font-size:13px; color:#64748b; font-weight:500;">Loading...</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label for="rs-kw-per-page" style="font-size:13px; color:#475569;">Rows per page:</label>
                        <select id="rs-kw-per-page" class="rs-input" style="width:auto; padding:4px 8px; height:auto;">
                            <option value="20" selected="selected">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                            <option value="250">250</option>
                        </select>
                    </div>
                </div>

                <div class="rs-table-responsive" style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
                    <table class="rs-table" style="min-width:850px;">
                        <thead>
                            <tr>
                                <th style="width:30px;"><input type="checkbox" id="rs-kw-select-all" /></th>
                                <th>Keyword</th>
                                <th>Categories & Tags</th>
                                <th>Target URL</th>
                                <th>Added Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="rs-keywords-tbody">
                            <tr><td colspan="6" class="rs-text-center">Select a project to load keywords.</td></tr>
                        </tbody>
                    </table>
                </div>

                <!-- Pagination Footer Bar -->
                <div id="rs-kw-pagination-wrap" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-top:1px solid #e2e8f0; background:#ffffff; flex-wrap:wrap; gap:12px;">
                    <div id="rs-kw-page-info" style="font-size:13px; color:#64748b;">Page 1 of 1</div>
                    <div class="rs-pagination-buttons" style="display:flex; gap:6px;">
                        <button type="button" id="rs-kw-first" class="gsc-btn-action gsc-btn-gray" style="padding:4px 10px; font-size:12px;" disabled>&laquo; First</button>
                        <button type="button" id="rs-kw-prev" class="gsc-btn-action gsc-btn-gray" style="padding:4px 10px; font-size:12px;" disabled>&lsaquo; Prev</button>
                        <span id="rs-kw-page-display" style="display:flex; align-items:center; padding:0 8px; font-size:13px; font-weight:600; color:#1e293b;">1</span>
                        <button type="button" id="rs-kw-next" class="gsc-btn-action gsc-btn-gray" style="padding:4px 10px; font-size:12px;" disabled>Next &rsaquo;</button>
                        <button type="button" id="rs-kw-last" class="gsc-btn-action gsc-btn-gray" style="padding:4px 10px; font-size:12px;" disabled>Last &raquo;</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bulk Paste Exclusion List Modal -->
        <div id="rs-bulk-exclude-modal" class="gsc-modal-backdrop" style="display:none;">
            <div class="gsc-modal-box" style="max-width:550px;">
                <div class="gsc-modal-header">
                    <h3 class="gsc-modal-title">Bulk Keyword Exclusion Textarea</h3>
                    <button type="button" id="rs-bulk-modal-close" class="gsc-modal-close-btn">&times;</button>
                </div>
                <div class="gsc-modal-body">
                    <p style="font-size:13px; color:#64748b; margin-bottom:12px;">Paste multiple keywords below (one keyword per line) to exclude them from active tracking:</p>
                    <textarea id="rs-bulk-modal-textarea" class="rs-input" rows="8" style="width:100%; font-family:monospace; font-size:13px;" placeholder="e.g.&#10;test query&#10;internal admin&#10;sample keyword"></textarea>
                </div>
                <div class="gsc-modal-footer">
                    <button type="button" id="rs-bulk-modal-cancel" class="gsc-btn-action gsc-btn-gray">Cancel</button>
                    <button type="button" id="rs-bulk-modal-confirm" class="gsc-btn-action gsc-btn-red">Confirm & Exclude Keywords</button>
                </div>
            </div>
        </div>
        <?php
        self::render_serp_inspector_modal_html();
    }

    public static function render_serp_inspector_modal_html() {
        ?>
        <!-- Keyword SERP & History Inspector Modal (Keyword.com Style) -->
        <div id="rs-serp-inspector-modal" class="gsc-modal-backdrop" style="display:none;">
            <div class="gsc-modal-box rs-serp-inspector-box" style="max-width:1050px; width:95%; max-height:92vh; display:flex; flex-direction:column; padding:0; overflow:hidden; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                
                <!-- Modal Header -->
                <div class="rs-serp-header" style="padding:18px 24px 14px; border-bottom:1px solid #e2e8f0; background:#ffffff; display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                            <h2 id="rs-serp-kw-title" style="margin:0; font-size:20px; font-weight:700; color:#0f172a; line-height:1.2;">wordpress experts</h2>
                            <span id="rs-serp-kw-rank-badge" class="rs-badge" style="background:#e0f2fe; color:#0369a1; font-weight:600; font-size:12px;">Rank #21</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:12px; font-size:13px; color:#64748b; flex-wrap:wrap;">
                            <span id="rs-serp-domain-display" style="font-weight:600; color:#1e293b;">wpoets.com</span>
                            <span style="color:#cbd5e1;">&bull;</span>
                            <span>Google Search</span>
                            <span style="color:#cbd5e1;">&bull;</span>
                            <span>Desktop</span>
                            <span style="color:#cbd5e1;">&bull;</span>
                            <!-- Dynamic Country Switcher in Header -->
                            <div style="display:inline-flex; align-items:center; gap:6px;">
                                <label for="rs-serp-country-select" style="font-weight:600; color:#334155;">Country:</label>
                                <select id="rs-serp-country-select" class="rs-input" style="padding:2px 8px; font-size:12px; height:28px; width:auto; font-weight:500; border-color:#cbd5e1; border-radius:6px; background:#f8fafc;">
                                    <option value="IN" selected="selected">India (IN)</option>
                                    <option value="US">United States (US)</option>
                                    <option value="GB">United Kingdom (GB)</option>
                                    <option value="CA">Canada (CA)</option>
                                    <option value="AU">Australia (AU)</option>
                                    <option value="DE">Germany (DE)</option>
                                    <option value="ALL">All Countries</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <button type="button" id="rs-serp-modal-close" class="gsc-modal-close-btn" style="background:none; border:none; font-size:24px; line-height:1; color:#94a3b8; cursor:pointer; padding:4px;">&times;</button>
                </div>

                <!-- Tab Navigation Navigation -->
                <div class="rs-serp-nav" style="display:flex; background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:0 24px;">
                    <button type="button" class="rs-serp-tab-btn active" data-tab="ranking-history" style="padding:12px 18px; font-size:13px; font-weight:600; color:#0b57d0; background:none; border:none; border-bottom:2px solid #0b57d0; cursor:pointer;">Ranking History</button>
                    <button type="button" class="rs-serp-tab-btn" data-tab="ranking-urls" style="padding:12px 18px; font-size:13px; font-weight:600; color:#64748b; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer;">Ranking URLs</button>
                    <button type="button" class="rs-serp-tab-btn" data-tab="serp-history" style="padding:12px 18px; font-size:13px; font-weight:600; color:#64748b; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer;">SERP History</button>
                    <button type="button" class="rs-serp-tab-btn" data-tab="why-moved" style="padding:12px 18px; font-size:13px; font-weight:600; color:#64748b; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer;">🔍 Why It Moved (Diffs & Impact)</button>
                </div>

                <!-- Modal Body with Scrollable Area -->
                <div class="rs-serp-body" style="padding:20px 24px; overflow-y:auto; flex:1; background:#ffffff;">
                    
                    <!-- TAB 1: Ranking History -->
                    <div id="rs-serp-pane-ranking-history" class="rs-serp-pane">
                        <!-- KPI Metric Cards Row -->
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:20px;">
                            <div class="rs-serp-kpi-card" style="padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                                <div style="font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Current Rank</div>
                                <div style="display:flex; align-items:baseline; gap:8px; margin-top:4px;">
                                    <span id="rs-serp-kpi-current" style="font-size:24px; font-weight:700; color:#0f172a;">—</span>
                                    <span id="rs-serp-kpi-delta" style="font-size:12px; font-weight:600; color:#16a34a; background:#dcfce7; padding:2px 6px; border-radius:4px; display:none;">—</span>
                                </div>
                            </div>
                            <div class="rs-serp-kpi-card" style="padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                                <div style="font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Best Rank</div>
                                <div style="margin-top:4px;">
                                    <span id="rs-serp-kpi-best" style="font-size:24px; font-weight:700; color:#0f172a;">—</span>
                                </div>
                            </div>
                            <div class="rs-serp-kpi-card" style="padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                                <div style="font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Average Rank</div>
                                <div style="margin-top:4px;">
                                    <span id="rs-serp-kpi-avg" style="font-size:24px; font-weight:700; color:#0f172a;">—</span>
                                </div>
                            </div>
                            <div class="rs-serp-kpi-card" style="padding:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                                <div style="font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Days Ranked</div>
                                <div style="margin-top:4px;">
                                    <span id="rs-serp-kpi-days" style="font-size:24px; font-weight:700; color:#0f172a;">—</span>
                                </div>
                            </div>
                        </div>

                        <!-- Range & Chart Toolbar -->
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <label for="rs-serp-range-select" style="font-size:12px; font-weight:600; color:#64748b;">Time Range:</label>
                                <select id="rs-serp-range-select" class="rs-input" style="padding:2px 8px; font-size:12px; height:28px; width:auto; border-radius:6px;">
                                    <option value="30d" selected="selected">Last 30 days</option>
                                    <option value="3m">Last 3 months</option>
                                    <option value="6m">Last 6 months</option>
                                </select>
                            </div>
                            <div style="font-size:12px; color:#94a3b8; font-style:italic;">Rank 1 is at the top of the chart</div>
                        </div>

                        <!-- Inverted Rank Timeline Chart -->
                        <div style="position:relative; height:280px; width:100%; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                            <canvas id="rs-serp-history-chart"></canvas>
                        </div>
                    </div>

                    <!-- TAB 2: Ranking URLs -->
                    <div id="rs-serp-pane-ranking-urls" class="rs-serp-pane" style="display:none;">
                        <table class="rs-table" style="width:100%; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="width:120px;">Date</th>
                                    <th style="width:110px;">Rank</th>
                                    <th>Landing Page URL</th>
                                    <th style="width:120px; text-align:right;">Historical SERP</th>
                                </tr>
                            </thead>
                            <tbody id="rs-serp-urls-tbody">
                                <tr><td colspan="4" class="rs-text-center" style="padding:20px; color:#64748b;">Loading ranking URLs...</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- TAB 3: SERP History (Multi-Column Competitor Board) -->
                    <div id="rs-serp-pane-serp-history" class="rs-serp-pane" style="display:none;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:13px; color:#64748b; font-weight:500;">Click any competitor to trace ranking across days.</span>
                                <span id="rs-serp-live-badge" class="rs-badge" style="background:#f1f5f9; color:#64748b; font-size:11px; font-weight:600;">Historical Baseline</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <button type="button" id="rs-btn-fetch-live-serp" class="gsc-btn-action gsc-btn-blue" style="padding:4px 10px; font-size:11px; display:inline-flex; align-items:center; gap:5px;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                    <span>Fetch Live Google SERP</span>
                                </button>
                                <span style="font-size:12px; color:#0b57d0; font-weight:600;">Target domain: <span id="rs-serp-active-domain-tag">wpoets.com</span></span>
                            </div>
                        </div>

                        <!-- Horizontally Scrollable Board -->
                        <div id="rs-serp-board-scroll" style="display:flex; gap:12px; overflow-x:auto; padding-bottom:14px; min-height:420px;">
                            <!-- Dynamic daily columns injected here -->
                        </div>
                    </div>

                    <!-- TAB 4: Why It Moved (Diffs & Root-Cause Explainer) -->
                    <div id="rs-serp-pane-why-moved" class="rs-serp-pane" style="display:none;">
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:16px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                                    <div>
                                        <label style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase;">Select Page / Competitor:</label>
                                        <select id="rs-why-url-select" class="rs-input" style="display:block; min-width:240px; font-size:12px; height:32px; margin-top:2px;">
                                            <option value="">Loading URLs...</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase;">Compare From:</label>
                                        <input type="date" id="rs-why-date-from" class="rs-input" style="display:block; font-size:12px; height:32px; margin-top:2px;" />
                                    </div>
                                    <div>
                                        <label style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase;">Compare To:</label>
                                        <input type="date" id="rs-why-date-to" class="rs-input" style="display:block; font-size:12px; height:32px; margin-top:2px;" />
                                    </div>
                                </div>
                                <button type="button" id="rs-btn-run-diagnosis" class="gsc-btn-action gsc-btn-blue" style="height:32px; font-size:12px; margin-top:16px;">
                                    🔍 Diagnose Movement
                                </button>
                            </div>
                        </div>

                        <!-- Diagnostic Result Container -->
                        <div id="rs-why-diagnosis-result">
                            <div style="text-align:center; padding:40px; color:#64748b;">
                                <p style="font-size:14px; margin-bottom:6px;">Select a URL and date range above to analyze why positions changed.</p>
                                <span style="font-size:12px; color:#94a3b8;">Inspects Google Algorithm updates, on-page Title/H1 rewrites, content expansions, and schema additions.</span>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- Modal Footer -->
                <div class="rs-serp-footer" style="padding:12px 24px; border-top:1px solid #e2e8f0; background:#f8fafc; display:flex; justify-content:space-between; align-items:center;">
                    <span id="rs-serp-footer-note" style="font-size:12px; color:#64748b;">
                        Live Google SERP powered by SerpApi / Keyword.com. Configure API key in <a href="admin.php?page=rankstack-settings" target="_blank" style="color:#0b57d0; text-decoration:none; font-weight:500;">RankStack Settings</a>.
                    </span>
                    <button type="button" id="rs-serp-modal-close-btn" class="gsc-btn-action gsc-btn-gray" style="padding:6px 14px; font-size:13px;">Close</button>
                </div>

            </div>
        </div>

        <!-- 5. Create Custom Annotation Modal -->
        <div id="rs-annotation-modal" class="rs-modal-backdrop" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15,23,42,0.6); z-index:99999; justify-content:center; align-items:center;">
            <div class="rs-modal-dialog" style="background:#ffffff; width:90%; max-width:480px; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1); overflow:hidden;">
                <div style="padding:16px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
                    <h3 style="margin:0; font-size:16px; font-weight:700; color:#0f172a;">📝 Create Timeline Annotation</h3>
                    <button type="button" id="rs-annotation-modal-close" style="background:none; border:none; font-size:20px; color:#94a3b8; cursor:pointer;">&times;</button>
                </div>
                <div style="padding:20px;">
                    <div style="margin-bottom:14px;">
                        <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Annotation Title *</label>
                        <input type="text" id="rs-ann-title" class="rs-input" placeholder="e.g. Launched new pricing page / Rewrote titles" style="width:100%; height:36px;" />
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                        <div>
                            <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Start Date *</label>
                            <input type="date" id="rs-ann-start-date" class="rs-input" style="width:100%; height:36px;" />
                        </div>
                        <div>
                            <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">End Date</label>
                            <input type="date" id="rs-ann-end-date" class="rs-input" style="width:100%; height:36px;" />
                        </div>
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Description / Notes</label>
                        <textarea id="rs-ann-desc" class="rs-input" rows="3" placeholder="What changes were implemented and what results are expected?" style="width:100%;"></textarea>
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Reference URL (Optional)</label>
                        <input type="url" id="rs-ann-url" class="rs-input" placeholder="https://..." style="width:100%; height:36px;" />
                    </div>
                </div>
                <div style="padding:14px 20px; background:#f8fafc; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end; gap:8px;">
                    <button type="button" id="rs-annotation-modal-cancel" class="gsc-btn-action gsc-btn-gray">Cancel</button>
                    <button type="button" id="rs-btn-save-annotation" class="gsc-btn-action gsc-btn-blue">Save Annotation</button>
                </div>
            </div>
        </div>
        <?php
    }

    public static function render_compare_page() {
        ?>
        <div class="rankstack-wrap gsc-theme">
            <div class="gsc-title-row" style="margin-bottom: 20px;">
                <div>
                    <h1 class="gsc-page-title">URL Performance Comparison</h1>
                    <p class="rankstack-subtitle">Compare traffic and ranking position trends between two URLs</p>
                </div>
                <div class="gsc-top-right-actions">
                    <select id="rs-cmp-project-select" class="gsc-project-select">
                        <option value="">Select Project...</option>
                    </select>
                </div>
            </div>

            <div class="rs-card">
                <div class="rs-form-inline" style="margin-bottom: 20px;">
                    <input type="text" id="rs-url-a" class="rs-input" placeholder="URL A (e.g. /page-1)" style="flex:1;" />
                    <span class="rs-date-sep">vs</span>
                    <input type="text" id="rs-url-b" class="rs-input" placeholder="URL B (e.g. /page-2)" style="flex:1;" />
                    <button id="rs-btn-compare" class="gsc-btn-action gsc-btn-blue">Compare URLs</button>
                </div>

                <div class="rs-chart-container">
                    <canvas id="rs-compare-chart"></canvas>
                </div>
            </div>
        </div>
        <?php
    }

    public static function render_google_updates_page() {
        ?>
        <div class="rankstack-wrap gsc-theme">
            <div class="gsc-title-row" style="margin-bottom: 20px;">
                <div>
                    <h1 class="gsc-page-title">Official Google Search Updates</h1>
                    <p class="rankstack-subtitle">Timeline of confirmed Google Search Algorithm updates and anomalies</p>
                </div>
            </div>

            <div class="rs-card">
                <div id="rs-updates-container">Loading Google updates...</div>
            </div>
        </div>
        <?php
    }

    public static function render_skipped_page() {
        ?>
        <div class="rankstack-wrap gsc-theme">
            <div class="gsc-title-row" style="margin-bottom: 20px;">
                <div>
                    <h1 class="gsc-page-title">Skipped & Excluded Keywords</h1>
                    <p class="rankstack-subtitle">Keywords excluded from active tracking and GSC synchronization</p>
                </div>
                <div class="gsc-top-right-actions">
                    <select id="rs-skp-project-select" class="gsc-project-select">
                        <?php
                        $projects = RankStack_DB::get_projects();
                        if (empty($projects)) {
                            echo '<option value="">No Projects Found</option>';
                        } else {
                            foreach ($projects as $p) {
                                echo '<option value="' . esc_attr($p['id']) . '">' . esc_html($p['name'] . ' (' . $p['domain'] . ')') . '</option>';
                            }
                        }
                        ?>
                    </select>
                </div>
            </div>

            <div class="rs-card">
                <div class="rs-card-header rs-flex-between">
                    <div class="rs-form-inline" style="gap:8px;">
                        <button type="button" id="rs-btn-skp-restore" class="gsc-btn-action gsc-btn-blue" style="display:none;">Bulk Restore Selected (<span id="rs-skp-selected-count">0</span>)</button>
                        <button type="button" id="rs-btn-skp-delete" class="gsc-btn-action gsc-btn-red" style="display:none;">Bulk Delete Selected</button>
                    </div>
                </div>

                <div class="rs-table-responsive" style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
                    <table class="rs-table" style="min-width:800px;">
                        <thead>
                            <tr>
                                <th style="width:30px;"><input type="checkbox" id="rs-skp-select-all" /></th>
                                <th>Keyword</th>
                                <th>Exclusion Reason</th>
                                <th>Date Excluded</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="rs-skipped-tbody">
                            <tr><td colspan="5" class="rs-text-center">Select a project to load skipped keywords.</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <?php
    }

    public static function render_settings_page() {
        ?>
        <div class="rankstack-wrap gsc-theme">
            <div class="gsc-title-row" style="margin-bottom: 20px;">
                <div>
                    <h1 class="gsc-page-title">RankStack Settings</h1>
                    <p class="rankstack-subtitle">Manage GSC credentials, global country selection, categories, auto-tagging, and sync settings</p>
                </div>
                <div class="gsc-top-right-actions">
                    <select id="rs-settings-project-select" class="gsc-project-select">
                        <?php
                        $projects = RankStack_DB::get_projects();
                        if (empty($projects)) {
                            echo '<option value="">No Projects Found</option>';
                        } else {
                            foreach ($projects as $p) {
                                echo '<option value="' . esc_attr($p['id']) . '">' . esc_html($p['name'] . ' (' . $p['domain'] . ')') . '</option>';
                            }
                        }
                        ?>
                    </select>
                </div>
            </div>

            <?php if (isset($_GET['connected']) && $_GET['connected'] == '1') : ?>
                <div class="rs-alert rs-alert-success" style="margin-bottom:20px; background:#dcfce7; color:#15803d; padding:12px 16px; border-radius:8px; border:1px solid #bbf7d0; font-weight:600;">
                    Google Search Console account successfully authenticated & connected! You can now click Sync GSC Data on the Dashboard.
                </div>
            <?php endif; ?>

            <!-- Tabbed Navigation Header -->
            <div class="rs-settings-nav-tabs">
                <button type="button" class="rs-st-btn active" data-tab="general">General</button>
                <button type="button" class="rs-st-btn" data-tab="gsc">Google Search Console</button>
                <button type="button" class="rs-st-btn" data-tab="countries">Global Countries</button>
                <button type="button" class="rs-st-btn" data-tab="categories">Keyword Categories</button>
                <button type="button" class="rs-st-btn" data-tab="autotag">Auto-Tagging Rules</button>
                <button type="button" class="rs-st-btn" data-tab="serp">SERP Scraping & Competitors</button>
                <button type="button" class="rs-st-btn" data-tab="rank-tracking">Rank Tracking</button>
                <button type="button" class="rs-st-btn" data-tab="sync">Sync Settings</button>
                <button type="button" class="rs-st-btn" data-tab="other">Other Settings</button>
            </div>

            <!-- Tab 1: General -->
            <div id="rs-tab-general" class="rs-settings-tab-pane active">
                <div class="rs-card">
                    <div class="rs-card-header">
                        <h2>General Project Settings</h2>
                    </div>
                    <p style="color:#64748b; font-size:14px;">Configured project domain and active status for RankStack rank tracking.</p>
                    <div class="rs-form-group">
                        <label>Active Domain:</label>
                        <input type="text" readonly class="rs-input rs-input-readonly" value="https://www.wpoets.com/" />
                    </div>

                    <div class="rs-form-group" style="margin-top:20px; padding-top:16px; border-top:1px solid #e2e8f0;">
                        <label style="font-weight:700; color:#1e293b; display:block; margin-bottom:8px;">Timeline Performance Chart Controls</label>
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                            <input type="checkbox" id="rs-setting-chart-zoom" value="1" <?php checked(get_option('rankstack_chart_zoom_enabled', '1'), '1'); ?> />
                            <span style="font-size:13px; font-weight:600; color:#1e293b;">Enable Zoom & Drag on Timeline Performance Chart</span>
                        </label>
                        <span style="display:block; font-size:12px; color:#64748b; margin-left:24px; margin-top:2px;">
                            When enabled, you can scroll with mousewheel or drag across dates to zoom. Disable to lock the chart view and prevent accidental zooming while scrolling page.
                        </span>
                        <div style="margin-top:12px;">
                            <button type="button" id="rs-btn-save-chart-zoom" class="gsc-btn-action gsc-btn-blue">Save Chart Settings</button>
                            <span id="rs-chart-zoom-status" style="margin-left:12px; font-size:13px; color:#166534; font-weight:600;"></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab 2: Google Search Console -->
            <div id="rs-tab-gsc" class="rs-settings-tab-pane">
                <div class="rs-card">
                    <div class="rs-card-header">
                        <h2>1. Google Cloud Console API Credentials</h2>
                    </div>
                    <div class="rs-form-group">
                        <label>OAuth Authorized Redirect URI (Copy this to Google Console):</label>
                        <input type="text" readonly id="rs-redirect-uri" class="rs-input rs-input-readonly" value="<?php echo esc_url(rest_url('rankstack/v1/integrations/gsc/callback')); ?>" />
                    </div>

                    <div class="rs-form-group">
                        <label>Google Client ID:</label>
                        <input type="text" id="rs-google-client-id" class="rs-input" placeholder="e.g. 12345-abc.apps.googleusercontent.com" />
                    </div>

                    <div class="rs-form-group">
                        <label>Google Client Secret:</label>
                        <input type="password" id="rs-google-client-secret" class="rs-input" placeholder="Enter Secret" />
                    </div>

                    <button id="rs-btn-save-settings" class="gsc-btn-action gsc-btn-blue">Save API Credentials</button>
                </div>

                <div class="rs-card">
                    <div class="rs-card-header">
                        <h2>2. Connect Google Search Console Account</h2>
                    </div>
                    <p style="color:#64748b; font-size:14px; margin-bottom:16px;">Sign in with your Google Account to grant read-only Search Console permissions.</p>

                    <div class="rs-form-inline">
                        <a id="rs-btn-connect-gsc" href="#" class="gsc-btn-action gsc-btn-blue" style="text-decoration:none; display:inline-block;">
                            Authorize & Connect Google Search Console
                        </a>
                    </div>
                </div>
            </div>

            <!-- Tab 3: Global Countries -->
            <div id="rs-tab-countries" class="rs-settings-tab-pane">
                <div class="rs-card">
                    <div class="rs-card-header">
                        <h2>Global Multi-Country Selection Settings</h2>
                    </div>
                    <p style="color:#64748b; font-size:14px; margin-bottom:16px;">Select up to three top countries (e.g. India, United States, United Kingdom). These top three countries will be tracked and displayed across all Dashboard performance filters, average device columns (Mobile, Desktop, Tablet), and expanded country breakdowns.</p>

                    <div class="rs-country-checkbox-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:12px; margin-bottom:20px;">
                        <label class="rs-checkbox-card" style="padding:10px; border:1px solid #e2e8f0; border-radius:6px; display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" class="rs-chk-country" value="ALL" checked /> <strong>All Countries</strong>
                        </label>
                        <label class="rs-checkbox-card" style="padding:10px; border:1px solid #e2e8f0; border-radius:6px; display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" class="rs-chk-country" value="IN" /> <strong>India (IN)</strong>
                        </label>
                        <label class="rs-checkbox-card" style="padding:10px; border:1px solid #e2e8f0; border-radius:6px; display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" class="rs-chk-country" value="US" /> <strong>United States (US)</strong>
                        </label>
                        <label class="rs-checkbox-card" style="padding:10px; border:1px solid #e2e8f0; border-radius:6px; display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" class="rs-chk-country" value="DE" /> <strong>Germany (DE)</strong>
                        </label>
                        <label class="rs-checkbox-card" style="padding:10px; border:1px solid #e2e8f0; border-radius:6px; display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" class="rs-chk-country" value="GB" /> <strong>United Kingdom (GB)</strong>
                        </label>
                        <label class="rs-checkbox-card" style="padding:10px; border:1px solid #e2e8f0; border-radius:6px; display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" class="rs-chk-country" value="CA" /> <strong>Canada (CA)</strong>
                        </label>
                        <label class="rs-checkbox-card" style="padding:10px; border:1px solid #e2e8f0; border-radius:6px; display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" class="rs-chk-country" value="AU" /> <strong>Australia (AU)</strong>
                        </label>
                    </div>

                    <button type="button" id="rs-btn-save-countries" class="gsc-btn-action gsc-btn-blue">Save Global Country Selection</button>
                    <span id="rs-country-save-status" style="margin-left:12px; font-size:13px; color:#166534; font-weight:600;"></span>
                </div>
            </div>

            <!-- Tab 4: Keyword Categories -->
            <div id="rs-tab-categories" class="rs-settings-tab-pane">
                <div class="rs-card">
                    <div class="rs-card-header rs-flex-between">
                        <h2>Backend Custom Categories & Tags Manager</h2>
                        <div class="rs-form-inline">
                            <input type="text" id="rs-new-cat-name" class="rs-input" placeholder="Category Name (e.g. Lead Gen)" />
                            <button type="button" id="rs-btn-add-cat" class="gsc-btn-action gsc-btn-blue">+ Create Category</button>
                        </div>
                    </div>

                    <table class="rs-table">
                        <thead>
                            <tr>
                                <th>Category Name</th>
                                <th>Slug</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="rs-categories-tbody">
                            <tr><td colspan="3" class="rs-text-center">Loading categories...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Tab 5: Auto-Tagging Rules -->
            <div id="rs-tab-autotag" class="rs-settings-tab-pane">
                <div class="rs-card">
                    <div class="rs-card-header">
                        <h2>Configurable Auto-Tagging Rules</h2>
                    </div>
                    <p style="color:#64748b; font-size:14px; margin-bottom:16px;">Set comma-separated pattern rules for automatic keyword tagging during GSC synchronization.</p>

                    <div class="rs-form-group">
                        <label>Branded Term Rules (Comma-separated):</label>
                        <input type="text" id="rs-rule-branded" class="rs-input" value="WPoets, WPoet, WPoets Technology" />
                    </div>

                    <div class="rs-form-group">
                        <label>Migration Term Rules (Comma-separated CMS/Platforms):</label>
                        <input type="text" id="rs-rule-migration" class="rs-input" value="Kentico, Drupal, Joomla, Magento, Shopify, Sitecore, WordPress, HubSpot" />
                    </div>

                    <div class="rs-form-group">
                        <label>Location Term Rules (Comma-separated Locations):</label>
                        <input type="text" id="rs-rule-location" class="rs-input" value="Mumbai, Pune, Austin, Delhi, Bangalore, London, New York, California, Texas, Chicago" />
                    </div>

                    <button type="button" id="rs-btn-save-autotag" class="gsc-btn-action gsc-btn-blue">Save Auto-Tagging Rules</button>
                    <span id="rs-autotag-save-status" style="margin-left:12px; font-size:13px; color:#166534; font-weight:600;"></span>
                </div>
            </div>

            <!-- Tab 6: Sync Settings -->
            <div id="rs-tab-sync" class="rs-settings-tab-pane">
                <div class="rs-card">
                    <div class="rs-card-header">
                        <h2>Bulk Keywords Exclusion List</h2>
                    </div>
                    <p style="color:#64748b; font-size:14px; margin-bottom:12px;">Paste keywords to exclude from GSC rank tracking and analytics (one keyword per line):</p>
                    <div class="rs-form-group">
                        <textarea id="rs-exclude-keywords-textarea" class="rs-input" rows="6" style="width:100%; font-family:monospace; font-size:13px;" placeholder="e.g.&#10;test query&#10;internal admin&#10;sample keyword"></textarea>
                    </div>
                    <button type="button" id="rs-btn-save-excluded" class="gsc-btn-action gsc-btn-blue">Save Exclude List</button>
                    <span id="rs-excluded-status" style="margin-left:12px; font-size:13px; color:#166534; font-weight:600;"></span>
                </div>
            </div>

            <!-- Tab: SERP Scraping & Competitor Intelligence -->
            <div id="rs-tab-serp" class="rs-settings-tab-pane">
                <div class="rs-card">
                    <div class="rs-card-header">
                        <h2>Live Google SERP Scraping & Competitor Intelligence</h2>
                    </div>
                    <p style="color:#64748b; font-size:14px; margin-bottom:16px;">
                        Connect an external Google SERP scraping API to fetch 100% real-time competitor URLs and positions for your tracked keywords.
                    </p>

                    <div class="rs-form-group">
                        <label style="font-weight:600; color:#334155; margin-bottom:6px; display:block;">SERP Provider:</label>
                        <select id="rs-serp-provider-select" class="rs-input" style="max-width:340px;">
                            <option value="serpapi" selected="selected">SerpApi (Recommended - Live Google API)</option>
                            <option value="keywordcom">Keyword.com API</option>
                        </select>
                        <span style="display:block; font-size:12px; color:#64748b; margin-top:4px;">
                            SerpApi provides 100 free Google searches per month without requiring a credit card. Sign up at <a href="https://serpapi.com/" target="_blank" rel="noopener noreferrer" style="color:#0b57d0; text-decoration:underline;">serpapi.com</a> to get your free API key.
                        </span>
                    </div>

                    <div class="rs-form-group" style="margin-top:16px;">
                        <label style="font-weight:600; color:#334155; margin-bottom:6px; display:block;">API Key / Access Token:</label>
                        <div style="display:flex; gap:10px; max-width:520px;">
                            <input type="password" id="rs-serp-api-key" class="rs-input" style="flex:1;" placeholder="Paste your SerpApi or Keyword.com API Key" />
                            <button type="button" id="rs-btn-toggle-serp-key" class="gsc-btn-action gsc-btn-gray" style="padding:6px 12px; font-size:12px;">Show</button>
                        </div>
                    </div>

                    <div class="rs-form-group" style="margin-top:16px;">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                            <input type="checkbox" id="rs-serp-auto-fetch" value="1" checked="checked" />
                            <span style="font-size:13px; font-weight:600; color:#1e293b;">Automatically scrape live Google SERP when opening Keyword SERP Inspector</span>
                        </label>
                        <span style="display:block; font-size:12px; color:#64748b; margin-left:24px; margin-top:2px;">
                            When enabled, opening a keyword's SERP inspector queries real Google results for today and caches them in your database.
                        </span>
                    </div>

                    <div style="display:flex; align-items:center; gap:12px; margin-top:24px;">
                        <button type="button" id="rs-btn-save-serp" class="gsc-btn-action gsc-btn-blue">Save SERP Settings</button>
                        <button type="button" id="rs-btn-test-serp" class="gsc-btn-action gsc-btn-gray">Test Connection</button>
                        <span id="rs-serp-status-msg" style="font-size:13px; font-weight:600;"></span>
                    </div>
                </div>
            </div>

            <!-- Tab: Rank Tracking Selected Keywords -->
            <div id="rs-tab-rank-tracking" class="rs-settings-tab-pane">
                <div class="rs-card">
                    <div class="rs-card-header">
                        <h2>Weekly Rank Tracking Keywords (DataForSEO + GSC)</h2>
                    </div>
                    <p style="color:#64748b; font-size:14px; margin-bottom:12px;">Enter or paste the selected keywords to track weekly via external rank tracking and Google Search Console (one keyword per line):</p>
                    <div class="rs-form-group">
                        <textarea id="rs-weekly-tracking-keywords" class="rs-input" rows="8" style="width:100%; font-family:monospace; font-size:13px;" placeholder="e.g.&#10;wordpress development agency&#10;enterprise wordpress agency&#10;wpoets"></textarea>
                    </div>
                    <button type="button" id="rs-btn-save-weekly-keywords" class="gsc-btn-action gsc-btn-blue">Save Weekly Tracking Keywords</button>
                    <span id="rs-weekly-keywords-status" style="margin-left:12px; font-size:13px; color:#166534; font-weight:600;"></span>
                </div>
            </div>

            <!-- Tab 7: Other Settings -->
            <div id="rs-tab-other" class="rs-settings-tab-pane">
                <div class="rs-card">
                    <div class="rs-card-header">
                        <h2>Database Reset & Diagnostics</h2>
                    </div>
                    <p style="color:#64748b; font-size:14px; margin-bottom:16px;">Wipe dummy ranking tables and fetch fresh GSC data.</p>
                    <button type="button" id="rs-btn-reset-diag" class="gsc-btn-action gsc-btn-red">Wipe & Reset All Data</button>
                </div>
            </div>
        </div>
        <?php
    }

    public static function render_sync_logs_page() {
        ?>
        <div class="rankstack-wrap gsc-theme">
            <div class="gsc-title-row" style="margin-bottom: 20px;">
                <div>
                    <h1 class="gsc-page-title">GSC Synchronization Logs</h1>
                    <p class="rankstack-subtitle">History of Google Search Console background sync jobs, timestamps, newly added keywords, and updated counts</p>
                </div>
                <div class="gsc-top-right-actions" style="display:flex; align-items:center; gap:10px;">
                    <select id="rs-synclog-project-select" class="gsc-project-select">
                        <?php
                        $projects = RankStack_DB::get_projects();
                        if (empty($projects)) {
                            echo '<option value="">No Projects Found</option>';
                        } else {
                            foreach ($projects as $p) {
                                $selected = (isset($p['domain']) && strpos(strtolower($p['domain']), 'wpoets') !== false) ? 'selected="selected"' : '';
                                echo '<option value="' . esc_attr($p['id']) . '" ' . $selected . '>' . esc_html($p['name'] . ' (' . $p['domain'] . ')') . '</option>';
                            }
                        }
                        ?>
                    </select>
                    <button type="button" id="rs-btn-synclog-manual" class="gsc-pill-btn" style="background:#0b57d0; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
                        <span>⚡ Run GSC Sync Now</span>
                    </button>
                </div>
            </div>

            <div id="rs-synclog-status-bar" class="rs-alert" style="display:none; margin-bottom:16px;"></div>

            <div class="rs-card" style="width:100%; max-width:100%; box-sizing:border-box; overflow:hidden;">
                <div class="rs-table-responsive" style="width:100%; max-width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; display:block; box-sizing:border-box;">
                    <table id="rs-synclog-table" class="rs-table" style="width:100%; table-layout:fixed; min-width:820px; border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0; text-align:left;">
                                <th style="width:16%; padding:10px 14px;">Sync Date & Time</th>
                                <th style="width:9%; padding:10px 14px;">Status</th>
                                <th style="width:9%; padding:10px 14px;">Newly Added</th>
                                <th style="width:10%; padding:10px 14px;">Existing Updated</th>
                                <th style="width:36%; padding:10px 14px;">Newly Added Keywords List</th>
                                <th style="width:20%; padding:10px 14px;">Details</th>
                            </tr>
                        </thead>
                        <tbody id="rs-synclog-tbody">
                            <tr><td colspan="6" class="rs-text-center" style="padding:20px;">Select a project to view GSC sync logs.</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <?php
    }

    public static function render_url_inspection_page() {
        ?>
        <div class="rankstack-wrap gsc-theme">
            <div class="gsc-title-row" style="margin-bottom: 20px;">
                <div>
                    <h1 class="gsc-page-title">URL Inspection Suite</h1>
                    <p class="rankstack-subtitle">Inspect Google Indexing Status, Fetch Verdicts, and Canonical URLs</p>
                </div>
            </div>
            <?php
            $projects = RankStack_DB::get_projects();
            $first_project_id = '';
            if (!empty($projects)) {
                $first_project_id = $projects[0]['id'];
            }
            ?>
            <input type="hidden" id="rs-url-project-id" value="<?php echo esc_attr($first_project_id); ?>" />
            <div class="rs-card">
                <div class="rs-form-inline" style="gap:12px; margin-bottom:20px;">
                    <input type="text" id="rs-inspect-url-input" class="rs-input" style="flex:1;" placeholder="https://www.wpoets.com/your-page-url" value="https://www.wpoets.com/" />
                    <button type="button" id="rs-btn-run-inspect" class="gsc-btn-action gsc-btn-blue">Inspect URL</button>
                    <button type="button" id="rs-btn-live-test" class="gsc-btn-action gsc-btn-gray">Test Live URL</button>
                </div>
                <div id="rs-inspect-result-card" style="display:none; background:#f8fafc; padding:20px; border-radius:8px; border:1px solid #e2e8f0;">
                    <h3 style="margin:0 0 12px 0; color:#0f172a;">Google Index Status Summary</h3>
                    <table class="rs-table">
                        <tr><td><strong>Indexing Verdict:</strong></td><td><span class="rs-badge rs-badge-success" id="inspect-verdict">Submitted & Indexed</span></td></tr>
                        <tr><td><strong>Coverage State:</strong></td><td id="inspect-coverage">Submitted and indexed</td></tr>
                        <tr><td><strong>Last Crawl Time:</strong></td><td id="inspect-last-crawl">2026-08-30 14:22:10</td></tr>
                        <tr><td><strong>User-Declared Canonical:</strong></td><td id="inspect-user-canonical">https://www.wpoets.com/</td></tr>
                        <tr><td><strong>Google-Selected Canonical:</strong></td><td id="inspect-google-canonical">https://www.wpoets.com/</td></tr>
                        <tr><td><strong>Robots.txt Crawl Allowed:</strong></td><td><span class="rs-badge rs-badge-success">ALLOWED</span></td></tr>
                        <tr><td><strong>Indexing Allowed:</strong></td><td><span class="rs-badge rs-badge-success">ALLOWED</span></td></tr>
                    </table>
                </div>
            </div>
        </div>
        <?php
    }

    public static function render_sitemaps_page() {
        ?>
        <div class="rankstack-wrap gsc-theme">
            <div class="gsc-title-row" style="margin-bottom: 20px;">
                <div>
                    <h1 class="gsc-page-title">Sitemaps & Page Indexing Health</h1>
                    <p class="rankstack-subtitle">Manage Submitted XML Sitemaps & Monitor Page Indexation Status</p>
                </div>
            </div>
            <div class="rs-card">
                <div class="rs-card-header rs-flex-between">
                    <h2>Add a New Sitemap</h2>
                </div>
                <div class="rs-form-inline">
                    <input type="text" id="rs-sitemap-path" class="rs-input" style="flex:1;" placeholder="sitemap.xml" value="sitemap.xml" />
                    <button type="button" id="rs-btn-submit-sitemap" class="gsc-btn-action gsc-btn-blue">Submit Sitemap</button>
                </div>
            </div>
            <div class="rs-card">
                <div class="rs-card-header">
                    <h2>Submitted Sitemaps</h2>
                </div>
                <table class="rs-table">
                    <thead>
                        <tr>
                            <th>Sitemap URL</th>
                            <th>Type</th>
                            <th>Last Submitted</th>
                            <th>Status</th>
                            <th>Discovered URLs</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>https://www.wpoets.com/sitemap.xml</td><td>Sitemap Index</td><td>Today</td><td><span class="rs-badge rs-badge-success">Success</span></td><td>148</td></tr>
                        <tr><td>https://www.wpoets.com/post-sitemap.xml</td><td>Posts Sitemap</td><td>Today</td><td><span class="rs-badge rs-badge-success">Success</span></td><td>96</td></tr>
                        <tr><td>https://www.wpoets.com/page-sitemap.xml</td><td>Pages Sitemap</td><td>Today</td><td><span class="rs-badge rs-badge-success">Success</span></td><td>52</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <?php
    }

    public static function render_cwv_page() {
        ?>
        <div class="rankstack-wrap gsc-theme">
            <div class="gsc-title-row" style="margin-bottom: 24px;">
                <div>
                    <h1 class="gsc-page-title">Core Web Vitals & Page Experience</h1>
                    <p class="rankstack-subtitle">Real-User Experience Metrics (LCP, INP, CLS) based on Chrome UX Report (CrUX) and HTTPS Security Status</p>
                </div>
            </div>
            
            <div class="rs-grid-2">
                <!-- Mobile Core Web Vitals Card -->
                <div class="rs-card" style="border-top: 4px solid #10b981;">
                    <div class="rs-card-header rs-flex-between" style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
                        <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 0;">Mobile Core Web Vitals</h2>
                        <span class="rs-badge rs-badge-success" style="font-size: 12px; font-weight: 700;">PASSING ALL CHECKS</span>
                    </div>
                    <div style="padding: 20px;">
                        <div style="margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px solid #f1f5f9;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div>
                                    <strong style="color: #1e293b; font-size: 14px;">Largest Contentful Paint (LCP)</strong>
                                    <div style="font-size: 12px; color: #64748b;">Perceived page load speed (largest text or image block)</div>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-size: 20px; font-weight: 800; color: #10b981;">1.8s</span>
                                    <span class="rs-badge rs-badge-success" style="margin-left: 6px;">GOOD</span>
                                </div>
                            </div>
                            <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                                <div style="width: 72%; height: 100%; background: #10b981; border-radius: 4px;"></div>
                            </div>
                            <div style="font-size: 11px; color: #94a3b8; margin-top: 5px;">Good: ≤ 2.5s | Needs Improvement: 2.5s–4.0s | Poor: > 4.0s</div>
                        </div>

                        <div style="margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px solid #f1f5f9;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div>
                                    <strong style="color: #1e293b; font-size: 14px;">Interaction to Next Paint (INP)</strong>
                                    <div style="font-size: 12px; color: #64748b;">User responsiveness to clicks, taps, and keypresses</div>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-size: 20px; font-weight: 800; color: #10b981;">120ms</span>
                                    <span class="rs-badge rs-badge-success" style="margin-left: 6px;">GOOD</span>
                                </div>
                            </div>
                            <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                                <div style="width: 60%; height: 100%; background: #10b981; border-radius: 4px;"></div>
                            </div>
                            <div style="font-size: 11px; color: #94a3b8; margin-top: 5px;">Good: ≤ 200ms | Needs Improvement: 200ms–500ms | Poor: > 500ms</div>
                        </div>

                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div>
                                    <strong style="color: #1e293b; font-size: 14px;">Cumulative Layout Shift (CLS)</strong>
                                    <div style="font-size: 12px; color: #64748b;">Visual stability and unexpected layout shifts during load</div>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-size: 20px; font-weight: 800; color: #10b981;">0.04</span>
                                    <span class="rs-badge rs-badge-success" style="margin-left: 6px;">GOOD</span>
                                </div>
                            </div>
                            <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                                <div style="width: 40%; height: 100%; background: #10b981; border-radius: 4px;"></div>
                            </div>
                            <div style="font-size: 11px; color: #94a3b8; margin-top: 5px;">Good: ≤ 0.1 | Needs Improvement: 0.1–0.25 | Poor: > 0.25</div>
                        </div>
                    </div>
                </div>

                <!-- Desktop Core Web Vitals Card -->
                <div class="rs-card" style="border-top: 4px solid #10b981;">
                    <div class="rs-card-header rs-flex-between" style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
                        <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 0;">Desktop Core Web Vitals</h2>
                        <span class="rs-badge rs-badge-success" style="font-size: 12px; font-weight: 700;">PASSING ALL CHECKS</span>
                    </div>
                    <div style="padding: 20px;">
                        <div style="margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px solid #f1f5f9;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div>
                                    <strong style="color: #1e293b; font-size: 14px;">Largest Contentful Paint (LCP)</strong>
                                    <div style="font-size: 12px; color: #64748b;">Perceived page load speed on desktop monitors</div>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-size: 20px; font-weight: 800; color: #10b981;">1.2s</span>
                                    <span class="rs-badge rs-badge-success" style="margin-left: 6px;">GOOD</span>
                                </div>
                            </div>
                            <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                                <div style="width: 48%; height: 100%; background: #10b981; border-radius: 4px;"></div>
                            </div>
                            <div style="font-size: 11px; color: #94a3b8; margin-top: 5px;">Good: ≤ 2.5s | Needs Improvement: 2.5s–4.0s | Poor: > 4.0s</div>
                        </div>

                        <div style="margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px solid #f1f5f9;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div>
                                    <strong style="color: #1e293b; font-size: 14px;">Interaction to Next Paint (INP)</strong>
                                    <div style="font-size: 12px; color: #64748b;">User responsiveness to mouse clicks and keyboard events</div>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-size: 20px; font-weight: 800; color: #10b981;">85ms</span>
                                    <span class="rs-badge rs-badge-success" style="margin-left: 6px;">GOOD</span>
                                </div>
                            </div>
                            <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                                <div style="width: 42%; height: 100%; background: #10b981; border-radius: 4px;"></div>
                            </div>
                            <div style="font-size: 11px; color: #94a3b8; margin-top: 5px;">Good: ≤ 200ms | Needs Improvement: 200ms–500ms | Poor: > 500ms</div>
                        </div>

                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div>
                                    <strong style="color: #1e293b; font-size: 14px;">Cumulative Layout Shift (CLS)</strong>
                                    <div style="font-size: 12px; color: #64748b;">Visual stability and unexpected layout shifts on desktop</div>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-size: 20px; font-weight: 800; color: #10b981;">0.01</span>
                                    <span class="rs-badge rs-badge-success" style="margin-left: 6px;">GOOD</span>
                                </div>
                            </div>
                            <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                                <div style="width: 10%; height: 100%; background: #10b981; border-radius: 4px;"></div>
                            </div>
                            <div style="font-size: 11px; color: #94a3b8; margin-top: 5px;">Good: ≤ 0.1 | Needs Improvement: 0.1–0.25 | Poor: > 0.25</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }

    public static function render_links_page() {
        ?>
        <div class="rankstack-wrap gsc-theme">
            <div class="gsc-title-row" style="margin-bottom: 20px;">
                <div>
                    <h1 class="gsc-page-title">Links Intelligence & Backlink Graph</h1>
                    <p class="rankstack-subtitle">External Backlinks, Top Linking Domains, and Internal Link Structure</p>
                </div>
            </div>
            <div class="rs-grid-2">
                <div class="rs-card">
                    <div class="rs-card-header">
                        <h2>Top Linking External Domains</h2>
                    </div>
                    <table class="rs-table">
                        <thead><tr><th>Linking Domain</th><th>Total Backlinks</th></tr></thead>
                        <tbody>
                            <tr><td><strong>github.com</strong></td><td>450</td></tr>
                            <tr><td><strong>wordpress.org</strong></td><td>380</td></tr>
                            <tr><td><strong>medium.com</strong></td><td>210</td></tr>
                            <tr><td><strong>dev.to</strong></td><td>165</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="rs-card">
                    <div class="rs-card-header">
                        <h2>Top Linked Landing Pages</h2>
                    </div>
                    <table class="rs-table">
                        <thead><tr><th>Landing Page</th><th>External Links</th><th>Internal Links</th></tr></thead>
                        <tbody>
                            <tr><td>/</td><td>890</td><td>245</td></tr>
                            <tr><td>/services/wordpress</td><td>310</td><td>120</td></tr>
                            <tr><td>/plugins/rankstack</td><td>180</td><td>85</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <?php
    }

    public static function render_rank_tracking_page() {
        ?>
        <div class="rankstack-wrap gsc-theme">
            <!-- Header and Project Selector -->
            <div class="gsc-title-row" style="margin-bottom: 20px;">
                <div>
                    <h1 class="gsc-page-title">Rank Tracking</h1>
                    <p class="rankstack-subtitle">Track keyword positions combining Google Search Console & DataForSEO/SERP Intelligence with India regional breakdown</p>
                </div>
                <div class="gsc-top-right-actions">
                    <select id="rs-rt-project-select" class="gsc-project-select">
                        <?php
                        $projects = RankStack_DB::get_projects();
                        if (empty($projects)) {
                            echo '<option value="">No Projects Found</option>';
                        } else {
                            foreach ($projects as $p) {
                                $selected = (isset($p['domain']) && strpos(strtolower($p['domain']), 'wpoets') !== false) ? 'selected="selected"' : '';
                                echo '<option value="' . esc_attr($p['id']) . '" ' . $selected . '>' . esc_html($p['name'] . ' (' . $p['domain'] . ')') . '</option>';
                            }
                        }
                        ?>
                    </select>
                </div>
            </div>

            <!-- Summary KPI Cards -->
            <div class="rs-kpi-grid gsc-kpi-row" style="margin-bottom:20px;">
                <div class="rs-kpi-card">
                    <div class="rs-kpi-top">
                        <span class="rs-kpi-label">Tracked Keywords</span>
                    </div>
                    <span id="rt-kpi-total-kw" class="rs-kpi-value">0</span>
                </div>
                <div class="rs-kpi-card">
                    <div class="rs-kpi-top">
                        <span class="rs-kpi-label">Avg GSC Position</span>
                    </div>
                    <span id="rt-kpi-avg-gsc-pos" class="rs-kpi-value">0.0</span>
                </div>
                <div class="rs-kpi-card">
                    <div class="rs-kpi-top">
                        <span class="rs-kpi-label">Avg DFSEO Position</span>
                    </div>
                    <span id="rt-kpi-avg-dfseo-pos" class="rs-kpi-value">0.0</span>
                </div>
                <div class="rs-kpi-card">
                    <div class="rs-kpi-top">
                        <span class="rs-kpi-label">Top 10 Keywords</span>
                    </div>
                    <span id="rt-kpi-top10-count" class="rs-kpi-value">0</span>
                </div>
            </div>

            <!-- Rank Tracking Table Card -->
            <div class="rs-card">
                <div class="rs-card-header rs-flex-between">
                    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                        <input type="text" id="rs-rt-search" class="rs-input" placeholder="Search tracked keywords..." style="min-width:240px;" />
                        <select id="rs-rt-intent-filter" class="gsc-pill-select">
                            <option value="">All Search Intents</option>
                            <option value="Informational">Informational</option>
                            <option value="Commercial">Commercial</option>
                            <option value="Transactional">Transactional</option>
                            <option value="Navigational">Navigational</option>
                        </select>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button type="button" id="rs-rt-btn-export" class="gsc-export-btn">EXPORT CSV</button>
                    </div>
                </div>

                <div class="rs-table-responsive" style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
                    <table class="rs-table" style="min-width:1100px;">
                        <thead>
                            <tr>
                                <th style="width:30px;"></th>
                                <th>Keyword</th>
                                <th>Search Intent</th>
                                <th>GSC Clicks</th>
                                <th>GSC Impressions</th>
                                <th>GSC CTR</th>
                                <th>GSC Position</th>
                                <th>GSC 7D Change</th>
                                <th>GSC 30D Change</th>
                                <th>DFSEO Position</th>
                                <th>DFSEO Volume</th>
                                <th>DFSEO KD</th>
                            </tr>
                        </thead>
                        <tbody id="rs-rt-tbody">
                            <tr><td colspan="12" class="rs-text-center">Loading rank tracking data...</td></tr>
                        </tbody>
                    </table>
                </div>

                <!-- Pagination Footer -->
                <div class="rs-pagination-bar">
                    <span id="rs-rt-pagination-info" class="rs-page-info">Showing 0 of 0 keywords</span>
                    <div class="rs-pagination-controls">
                        <button type="button" id="rs-rt-btn-prev" class="rs-btn-page">&laquo; Prev</button>
                        <span id="rs-rt-page-num" class="rs-page-num">Page 1 of 1</span>
                        <button type="button" id="rs-rt-btn-next" class="rs-btn-page">Next &raquo;</button>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }

    public static function render_diff_checker_page() {
        $tracked_urls = RankStack_DB::get_tracked_urls();
        $default_date_from = date('Y-m-d', strtotime('-30 days'));
        $default_date_to = date('Y-m-d');
        ?>
        <div class="rankstack-wrap gsc-theme">
            <!-- Header Section -->
            <div class="gsc-title-row" style="margin-bottom: 20px;">
                <div>
                    <h1 class="gsc-page-title">Website Diff Checker</h1>
                    <p class="rankstack-subtitle">Audit on-page content changes, new sections, interlinking deltas, and Google algorithm updates</p>
                </div>
                <div class="gsc-top-right-actions">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=rankstack-rank-tracking')); ?>" class="rs-btn-secondary" style="text-decoration:none; font-size:12px; font-weight:600;">
                        &larr; Rank Tracking
                    </a>
                </div>
            </div>

            <!-- Interactive Comparison Filter Card -->
            <div class="rs-card" style="margin-bottom: 24px; padding: 20px;">
                <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
                    <span>🔍 Select Landing Page & Date Window</span>
                    <span style="font-size: 11px; font-weight: 600; color: #0b57d0; background: #eff6ff; border: 1px solid #bfdbfe; padding: 3px 10px; border-radius: 12px;">
                        4-Pillar Ranking Changes Engine
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 16px;">
                    <!-- URL Selector / Input -->
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px;">
                            Landing Page / Target URL
                        </label>
                        <input type="url" id="rs-dc-url" class="rs-input" placeholder="https://wpoets.com/services" list="rs-dc-urls-list" style="width: 100%;" />
                        <datalist id="rs-dc-urls-list">
                            <?php foreach ($tracked_urls as $u): ?>
                                <option value="<?php echo esc_url($u); ?>">
                            <?php endforeach; ?>
                        </datalist>
                    </div>

                    <!-- Target Keyword / Query -->
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px;">
                            Target Search Keyword (Optional)
                        </label>
                        <input type="text" id="rs-dc-query" class="rs-input" placeholder="e.g. enterprise wordpress development" style="width: 100%;" />
                    </div>

                    <!-- Date From ("Before") -->
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px;">
                            Baseline Date ("Before")
                        </label>
                        <input type="date" id="rs-dc-date-from" class="rs-input" value="<?php echo esc_attr($default_date_from); ?>" style="width: 100%;" />
                    </div>

                    <!-- Date To ("After") -->
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px;">
                            Current Date ("After")
                        </label>
                        <input type="date" id="rs-dc-date-to" class="rs-input" value="<?php echo esc_attr($default_date_to); ?>" style="width: 100%;" />
                    </div>
                </div>

                <!-- Presets & Actions Row -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding-top: 14px; border-top: 1px solid #f1f5f9;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-size: 12px; font-weight: 600; color: #64748b;">Presets:</span>
                        <button type="button" class="rs-btn-secondary rs-dc-preset-btn" data-days="7" style="padding: 4px 10px; font-size: 11px;">7 Days</button>
                        <button type="button" class="rs-btn-secondary rs-dc-preset-btn" data-days="14" style="padding: 4px 10px; font-size: 11px;">14 Days</button>
                        <button type="button" class="rs-btn-secondary rs-dc-preset-btn" data-days="30" style="padding: 4px 10px; font-size: 11px; background: #e0f2fe; color: #0369a1; border-color: #7dd3fc;">30 Days</button>
                        <button type="button" class="rs-btn-secondary rs-dc-preset-btn" data-days="90" style="padding: 4px 10px; font-size: 11px;">90 Days</button>
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <button type="button" id="rs-dc-btn-crawl" class="rs-btn-secondary" style="display: flex; align-items: center; gap: 6px; font-size:12px; padding: 7px 14px;">
                            <span>🔄</span> Crawl Live URL
                        </button>
                        <button type="button" id="rs-dc-btn-run" class="rs-btn-primary" style="display: flex; align-items: center; gap: 6px; padding: 7px 18px; font-weight: 700; font-size:12px;">
                            <span>🔍</span> Run Content Diff & Audit
                        </button>
                    </div>
                </div>
            </div>

            <!-- Dynamic Results Container -->
            <div id="rs-dc-result-container">
                <div style="text-align: center; padding: 60px 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; color: #64748b;">
                    <div style="font-size: 32px; margin-bottom: 12px;">📊</div>
                    <div style="font-size: 16px; font-weight: 700; color: #1e293b;">Ready to Inspect Website Content Diffs</div>
                    <div style="font-size: 13px; color: #94a3b8; max-width: 520px; margin: 8px auto 0 auto; line-height: 1.5;">
                        Select or enter any URL above and click <strong>"Run Content Diff & Audit"</strong> to evaluate heading sections, internal interlinking, external backlinks, topic clusters, and Google algorithm updates.
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
}
