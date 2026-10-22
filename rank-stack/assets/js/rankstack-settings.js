jQuery(document).ready(function($) {
    'use strict';

    const apiRoot = RankStackData.root;
    const nonce = RankStackData.nonce;

    // 1. Settings Tab Switcher
    $(document).on('click', '.rs-st-btn', function() {
        const tab = $(this).data('tab');
        $('.rs-st-btn').removeClass('active');
        $(this).addClass('active');

        $('.rs-settings-tab-pane').removeClass('active');
        $('#rs-tab-' + tab).addClass('active');

        if (tab === 'rank-tracking') {
            loadWeeklyTrackingKeywords(getSelectedProject());
        }
    });

    loadSettings();

    function getSelectedProject() {
        return $('#rs-settings-project-select').val();
    }

    function loadSettings() {
        const projId = getSelectedProject();

        // API Credentials & Chart Zoom
        $.ajax({
            url: apiRoot + 'settings',
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(res) {
                if (res.google_client_id) $('#rs-google-client-id').val(res.google_client_id);
                if (res.google_client_secret) $('#rs-google-client-secret').val(res.google_client_secret);
                if (res.chart_zoom_enabled !== undefined) {
                    $('#rs-setting-chart-zoom').prop('checked', !!res.chart_zoom_enabled);
                }
            }
        });

        if (projId) {
            loadGlobalCountries(projId);
            loadCategories(projId);
            loadAutoTaggingRules(projId);
            loadExcludedKeywords(projId);
            loadWeeklyTrackingKeywords(projId);
        }
    }

    $('#rs-settings-project-select').on('change', function() {
        const selectedAuthUrl = $(this).find('option:selected').data('authurl');
        if (selectedAuthUrl) {
            $('#rs-btn-connect-gsc').attr('href', selectedAuthUrl);
        }
        loadSettings();
    });

    // 2. Save API Credentials
    $('#rs-btn-save-settings').on('click', function() {
        const clientId = $('#rs-google-client-id').val().trim();
        const clientSecret = $('#rs-google-client-secret').val().trim();
        const $btn = $(this);

        $btn.text('Saving...').prop('disabled', true);
        $.ajax({
            url: apiRoot + 'settings',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ google_client_id: clientId, google_client_secret: clientSecret }),
            success: function() {
                $btn.text('Save API Credentials').prop('disabled', false);
                alert('API Credentials saved successfully!');
            },
            error: function() {
                $btn.text('Save API Credentials').prop('disabled', false);
                alert('Failed to save API credentials.');
            }
        });
    });

    // 3. Global Multi-Countries
    function loadGlobalCountries(projId) {
        $.ajax({
            url: apiRoot + 'settings/global-countries?project_id=' + projId,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(res) {
                $('.rs-chk-country').prop('checked', false);
                if (Array.isArray(res) && res.length) {
                    res.forEach(c => {
                        $(`.rs-chk-country[value="${c}"]`).prop('checked', true);
                    });
                } else {
                    $(`.rs-chk-country[value="ALL"]`).prop('checked', true);
                }
            }
        });
    }

    $('#rs-btn-save-countries').on('click', function() {
        const projId = getSelectedProject();
        if (!projId) return alert('Please select a project first.');

        let selected = [];
        $('.rs-chk-country:checked').each(function() {
            selected.push($(this).val());
        });

        let nonAll = selected.filter(c => c !== 'ALL');
        if (nonAll.length > 3) {
            alert('Please select a maximum of 3 top countries (e.g. India, United States, United Kingdom).');
            return;
        }

        if (!selected.length) selected = ['ALL'];

        const $btn = $(this);
        const $status = $('#rs-country-save-status');
        $btn.text('Saving...').prop('disabled', true);
        $status.text('');

        $.ajax({
            url: apiRoot + 'settings/global-countries',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ project_id: projId, countries: selected }),
            success: function() {
                $btn.text('Save Global Country Selection').prop('disabled', false);
                $status.text('Global country selection saved! Dashboard analytics updated.');
                setTimeout(() => $status.text(''), 4000);
            },
            error: function() {
                $btn.text('Save Global Country Selection').prop('disabled', false);
                alert('Failed to save country settings.');
            }
        });
    });

    // 4. Custom Categories & Tags Manager
    function loadCategories(projId) {
        const $tbody = $('#rs-categories-tbody');
        $tbody.html('<tr><td colspan="3" class="rs-text-center">Loading categories...</td></tr>');

        $.ajax({
            url: apiRoot + 'categories?project_id=' + projId,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(res) {
                if (!res || !res.length) {
                    $tbody.html('<tr><td colspan="3" class="rs-text-center">No custom categories created yet.</td></tr>');
                    return;
                }

                let html = '';
                res.forEach(cat => {
                    html += `
                        <tr>
                            <td><strong>${escapeHtml(cat.name)}</strong></td>
                            <td><code>${escapeHtml(cat.slug)}</code></td>
                            <td>
                                <button type="button" class="gsc-btn-action gsc-btn-gray rs-btn-del-cat" data-id="${cat.id}">Delete</button>
                            </td>
                        </tr>
                    `;
                });
                $tbody.html(html);
            }
        });
    }

    $('#rs-btn-add-cat').on('click', function() {
        const projId = getSelectedProject();
        const name = $('#rs-new-cat-name').val().trim();
        if (!projId || !name) return alert('Please enter a category name.');

        const $btn = $(this);
        $btn.text('Creating...').prop('disabled', true);

        $.ajax({
            url: apiRoot + 'categories',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ project_id: projId, name: name }),
            success: function() {
                $btn.text('+ Create Category').prop('disabled', false);
                $('#rs-new-cat-name').val('');
                loadCategories(projId);
            },
            error: function() {
                $btn.text('+ Create Category').prop('disabled', false);
                alert('Failed to create category.');
            }
        });
    });

    $(document).on('click', '.rs-btn-del-cat', function() {
        const catId = $(this).data('id');
        const projId = getSelectedProject();
        if (!confirm('Delete this category?')) return;

        $.ajax({
            url: apiRoot + 'categories?id=' + catId,
            method: 'DELETE',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function() {
                loadCategories(projId);
            }
        });
    });

    // 5. Configurable Auto-Tagging Rules
    function loadAutoTaggingRules(projId) {
        $.ajax({
            url: apiRoot + 'settings/auto-tagging-rules?project_id=' + projId,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(res) {
                if (res) {
                    if (res.branded) $('#rs-rule-branded').val(res.branded);
                    if (res.migration) $('#rs-rule-migration').val(res.migration);
                    if (res.location) $('#rs-rule-location').val(res.location);
                }
            }
        });
    }

    $('#rs-btn-save-autotag').on('click', function() {
        const projId = getSelectedProject();
        if (!projId) return alert('Please select a project first.');

        const branded = $('#rs-rule-branded').val().trim();
        const migration = $('#rs-rule-migration').val().trim();
        const location = $('#rs-rule-location').val().trim();

        const $btn = $(this);
        const $status = $('#rs-autotag-save-status');
        $btn.text('Saving...').prop('disabled', true);
        $status.text('');

        $.ajax({
            url: apiRoot + 'settings/auto-tagging-rules',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ project_id: projId, branded: branded, migration: migration, location: location }),
            success: function() {
                $btn.text('Save Auto-Tagging Rules').prop('disabled', false);
                $status.text('Auto-tagging pattern rules saved successfully!');
                setTimeout(() => $status.text(''), 4000);
            },
            error: function() {
                $btn.text('Save Auto-Tagging Rules').prop('disabled', false);
                alert('Failed to save auto-tagging rules.');
            }
        });
    });

    // 6. Excluded Keywords List
    function loadExcludedKeywords(projId) {
        $.ajax({
            url: apiRoot + 'settings/excluded-keywords?project_id=' + projId,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(res) {
                if (res && res.excluded_text !== undefined) {
                    $('#rs-exclude-keywords-textarea').val(res.excluded_text);
                }
            }
        });
    }

    $('#rs-btn-save-excluded').on('click', function() {
        const projId = getSelectedProject();
        if (!projId) return alert('Please select a project first.');

        const text = $('#rs-exclude-keywords-textarea').val();
        const $btn = $(this);
        const $status = $('#rs-excluded-status');
        $btn.text('Saving...').prop('disabled', true);

        $.ajax({
            url: apiRoot + 'settings/excluded-keywords',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ project_id: projId, excluded_text: text }),
            success: function() {
                $btn.text('Save Exclude List').prop('disabled', false);
                $status.text('Exclude list saved successfully!');
                setTimeout(() => $status.text(''), 4000);
            }
        });
    });

    // 6b. Chart Zoom Settings Handler
    $('#rs-btn-save-chart-zoom').on('click', function() {
        const zoomEnabled = $('#rs-setting-chart-zoom').is(':checked') ? 1 : 0;
        const $btn = $(this);
        const $status = $('#rs-chart-zoom-status');
        $btn.text('Saving...').prop('disabled', true);

        $.ajax({
            url: apiRoot + 'settings',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ chart_zoom_enabled: zoomEnabled }),
            success: function() {
                $btn.text('Save Chart Settings').prop('disabled', false);
                $status.text('Chart zoom settings saved successfully!').css('color', '#166534');
                setTimeout(() => $status.text(''), 4000);
            },
            error: function() {
                $btn.text('Save Chart Settings').prop('disabled', false);
                $status.text('Failed to save settings.').css('color', '#dc2626');
            }
        });
    });

    // 6c. Weekly Tracking Keywords Handler
    function loadWeeklyTrackingKeywords(projId) {
        const url = projId ? (apiRoot + 'rank-tracking/keywords?project_id=' + encodeURIComponent(projId)) : (apiRoot + 'rank-tracking/keywords');
        $.ajax({
            url: url,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(res) {
                if (res && res.keywords_text !== undefined) {
                    $('#rs-weekly-tracking-keywords').val(res.keywords_text);
                }
            }
        });
    }

    $('#rs-btn-save-weekly-keywords').on('click', function() {
        const projId = getSelectedProject() || '';
        const text = $('#rs-weekly-tracking-keywords').val();
        const $btn = $(this);
        const $status = $('#rs-weekly-keywords-status');
        $btn.text('Saving...').prop('disabled', true);

        $.ajax({
            url: apiRoot + 'rank-tracking/keywords',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ project_id: projId, keywords_text: text }),
            success: function() {
                $btn.text('Save Weekly Tracking Keywords').prop('disabled', false);
                $status.text('Weekly tracking keywords saved successfully!').css('color', '#166534');
                setTimeout(() => $status.text(''), 4000);
            },
            error: function() {
                $btn.text('Save Weekly Tracking Keywords').prop('disabled', false);
                $status.text('Failed to save tracking keywords.').css('color', '#dc2626');
            }
        });
    });

    // 7. Reset & Diagnostics
    $('#rs-btn-reset-diag').on('click', function() {
        if (!confirm('Wipe all dummy tables and fetch fresh GSC data?')) return;
        $.ajax({
            url: apiRoot + 'reset-all-data',
            method: 'POST',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function() {
                alert('Database wiped and reset successfully!');
                location.reload();
            }
        });
    });

    // 8. SERP Scraping & Competitor Intelligence Settings
    function loadSerpSettings() {
        $.ajax({
            url: apiRoot + 'serp/settings',
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(res) {
                if (res.provider) $('#rs-serp-provider-select').val(res.provider);
                if (res.api_key) $('#rs-serp-api-key').val(res.api_key);
                $('#rs-serp-auto-fetch').prop('checked', res.auto_fetch == 1);
            }
        });
    }
    loadSerpSettings();

    $('#rs-btn-toggle-serp-key').on('click', function() {
        const $input = $('#rs-serp-api-key');
        const isPassword = $input.attr('type') === 'password';
        $input.attr('type', isPassword ? 'text' : 'password');
        $(this).text(isPassword ? 'Hide' : 'Show');
    });

    $('#rs-btn-save-serp').on('click', function() {
        const provider = $('#rs-serp-provider-select').val();
        const apiKey = $('#rs-serp-api-key').val().trim();
        const autoFetch = $('#rs-serp-auto-fetch').is(':checked') ? 1 : 0;
        const $btn = $(this);
        const $status = $('#rs-serp-status-msg');

        $btn.text('Saving...').prop('disabled', true);
        $status.text('').css('color', '#166534');

        $.ajax({
            url: apiRoot + 'serp/settings',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ provider: provider, api_key: apiKey, auto_fetch: autoFetch }),
            success: function(res) {
                $btn.text('Save SERP Settings').prop('disabled', false);
                $status.text(res.message || 'Settings saved successfully!');
                setTimeout(() => $status.text(''), 4000);
            },
            error: function() {
                $btn.text('Save SERP Settings').prop('disabled', false);
                $status.text('Failed to save SERP settings.').css('color', '#dc2626');
            }
        });
    });

    $('#rs-btn-test-serp').on('click', function() {
        const provider = $('#rs-serp-provider-select').val();
        const apiKey = $('#rs-serp-api-key').val().trim();
        const $btn = $(this);
        const $status = $('#rs-serp-status-msg');

        $btn.text('Testing...').prop('disabled', true);
        $status.text('Connecting to ' + provider + '...').css('color', '#0b57d0');

        $.ajax({
            url: apiRoot + 'serp/test',
            method: 'POST',
            contentType: 'application/json',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            data: JSON.stringify({ provider: provider, api_key: apiKey }),
            success: function(res) {
                $btn.text('Test Connection').prop('disabled', false);
                if (res.success) {
                    $status.text(res.message).css('color', '#166534');
                } else {
                    $status.text(res.message).css('color', '#dc2626');
                }
            },
            error: function() {
                $btn.text('Test Connection').prop('disabled', false);
                $status.text('Connection failed. Please check network.').css('color', '#dc2626');
            }
        });
    });

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
});
