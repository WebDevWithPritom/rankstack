<?php
if (!defined('ABSPATH')) {
    exit;
}

class RankStack_GSC {

    public static function get_client_id() {
        return get_option('rankstack_google_client_id', '');
    }

    public static function get_client_secret() {
        return get_option('rankstack_google_client_secret', '');
    }

    public static function get_auth_url($project_id = '') {
        $client_id = self::get_client_id();
        if (empty($client_id)) {
            return '';
        }

        $redirect_uri = rest_url('rankstack/v1/integrations/gsc/callback');
        $scopes = array('https://www.googleapis.com/auth/webmasters.readonly');

        $params = array(
            'client_id' => $client_id,
            'redirect_uri' => $redirect_uri,
            'response_type' => 'code',
            'scope' => implode(' ', $scopes),
            'access_type' => 'offline',
            'prompt' => 'consent',
            'state' => $project_id
        );

        return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params);
    }

    public static function exchange_code($code) {
        $client_id = self::get_client_id();
        $client_secret = self::get_client_secret();
        $redirect_uri = rest_url('rankstack/v1/integrations/gsc/callback');

        $response = wp_remote_post('https://oauth2.googleapis.com/token', array(
            'body' => array(
                'code' => $code,
                'client_id' => $client_id,
                'client_secret' => $client_secret,
                'redirect_uri' => $redirect_uri,
                'grant_type' => 'authorization_code'
            )
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (!isset($body['access_token'])) {
            return new WP_Error('gsc_auth_error', isset($body['error_description']) ? $body['error_description'] : 'Failed to exchange token');
        }

        return $body;
    }

    public static function refresh_access_token($refresh_token) {
        $client_id = self::get_client_id();
        $client_secret = self::get_client_secret();

        $response = wp_remote_post('https://oauth2.googleapis.com/token', array(
            'body' => array(
                'client_id' => $client_id,
                'client_secret' => $client_secret,
                'refresh_token' => $refresh_token,
                'grant_type' => 'refresh_token'
            )
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        return isset($body['access_token']) ? $body['access_token'] : null;
    }

    public static function get_valid_access_token($project_id) {
        $integration = RankStack_DB::get_integration($project_id, 'gsc');
        if (!$integration || empty($integration['refresh_token'])) {
            return null;
        }

        $expires = strtotime($integration['expires_at']);
        if ($expires > (time() + 300) && !empty($integration['access_token'])) {
            return $integration['access_token'];
        }

        // Token expired, refresh it
        $new_access_token = self::refresh_access_token($integration['refresh_token']);
        if ($new_access_token) {
            RankStack_DB::save_integration($project_id, 'gsc', array(
                'refresh_token' => $integration['refresh_token'],
                'access_token' => $new_access_token,
                'expires_at' => date('Y-m-d H:i:s', time() + 3500),
                'connected_account' => $integration['connected_account']
            ));
            return $new_access_token;
        }

        return null;
    }

    public static function get_user_gsc_sites($access_token) {
        $response = wp_remote_get('https://www.googleapis.com/webmasters/v3/sites', array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $access_token
            ),
            'timeout' => 30
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        return isset($body['siteEntry']) ? $body['siteEntry'] : array();
    }

    public static function query_gsc_analytics($access_token, $property_url, $start_date, $end_date, $dimensions = array('date', 'query', 'country', 'page'), $search_type = 'web', $dimension_filters = array()) {
        $encoded_property = urlencode($property_url);
        $url = "https://www.googleapis.com/webmasters/v3/sites/{$encoded_property}/searchAnalytics/query";

        $payload = array(
            'startDate' => $start_date,
            'endDate' => $end_date,
            'dimensions' => $dimensions,
            'type' => strtolower($search_type),
            'dataState' => 'all',
            'rowLimit' => 25000
        );

        if (!empty($dimension_filters)) {
            $payload['dimensionFilterGroups'] = array(
                array(
                    'filters' => $dimension_filters
                )
            );
        }

        $response = wp_remote_post($url, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $access_token,
                'Content-Type' => 'application/json'
            ),
            'body' => json_encode($payload),
            'timeout' => 60
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 400) {
            $err_msg = isset($body['error']['message']) ? $body['error']['message'] : "HTTP {$code} error from Google Search Console API";
            return new WP_Error('gsc_api_error', $err_msg);
        }

        return isset($body['rows']) ? $body['rows'] : array();
    }

    public static function inspect_url($access_token, $site_url, $inspection_url) {
        $url = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

        $response = wp_remote_post($url, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $access_token,
                'Content-Type' => 'application/json'
            ),
            'body' => json_encode(array(
                'inspectionUrl' => $inspection_url,
                'siteUrl' => $site_url
            )),
            'timeout' => 30
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        return isset($body['inspectionResult']) ? $body['inspectionResult'] : array();
    }

    public static function get_sitemaps($access_token, $site_url) {
        $encoded_site = urlencode($site_url);
        $url = "https://www.googleapis.com/webmasters/v3/sites/{$encoded_site}/sitemaps";

        $response = wp_remote_get($url, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $access_token
            )
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        return isset($body['sitemap']) ? $body['sitemap'] : array();
    }

    public static function submit_sitemap($access_token, $site_url, $feedpath) {
        $encoded_site = urlencode($site_url);
        $encoded_feed = urlencode($feedpath);
        $url = "https://www.googleapis.com/webmasters/v3/sites/{$encoded_site}/sitemaps/{$encoded_feed}";

        $response = wp_remote_post($url, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $access_token
            ),
            'method' => 'PUT'
        ));

        if (is_wp_error($response)) {
            return $response;
        }

        return true;
    }

    public static function sync_project_data($project_id, $days = 90) {
        $project = RankStack_DB::get_project($project_id);
        if (!$project) {
            $msg = 'Project record not found in database for ID: ' . $project_id;
            RankStack_DB::add_sync_log($project_id, 'failed', $msg);
            return new WP_Error('invalid_project', $msg);
        }

        $access_token = self::get_valid_access_token($project_id);
        if (!$access_token) {
            $msg = '🔑 Authentication Error: Google Search Console account not connected or OAuth token expired. Please connect Search Console in Settings > Google Search Console.';
            RankStack_DB::add_sync_log($project_id, 'failed', $msg);
            return new WP_Error('no_token', $msg);
        }

        // Auto-discover exact GSC Property URL from user's connected Search Console account
        $sites = self::get_user_gsc_sites($access_token);
        if (is_wp_error($sites)) {
            $msg = 'Failed to fetch sites from Google Search Console: ' . $sites->get_error_message();
            RankStack_DB::add_sync_log($project_id, 'failed', $msg);
            return $sites;
        }

        $matched_property = '';

        if (!empty($sites)) {
            $domain_clean = str_replace(array('https://', 'http://', 'www.', '/'), '', strtolower($project['domain']));
            
            foreach ($sites as $site) {
                $site_url = strtolower($site['siteUrl']);
                if (strpos($site_url, $domain_clean) !== false) {
                    $matched_property = $site['siteUrl'];
                    // Prefer exact www or sc-domain match
                    if (strpos($site_url, 'www.' . $domain_clean) !== false || strpos($site_url, 'sc-domain:' . $domain_clean) !== false) {
                        break;
                    }
                }
            }
        }

        $property_url = !empty($matched_property) ? $matched_property : (!empty($project['gsc_property']) ? $project['gsc_property'] : 'https://www.wpoets.com/');

        // Save matched property URL back to project record
        if (!empty($matched_property) && $matched_property !== $project['gsc_property']) {
            RankStack_DB::save_project(array(
                'id' => $project_id,
                'name' => $project['name'],
                'domain' => $project['domain'],
                'gsc_property' => $matched_property
            ));
        }

        $end_date = date('Y-m-d'); // Fetch up to current date with dataState: all (includes 24-48h fresh data)
        $start_date = date('Y-m-d', strtotime("-{$days} days", strtotime($end_date)));

        // 1. Fetch Daily Timeline Totals Directly from GSC
        $timeline_rows = self::query_gsc_analytics($access_token, $property_url, $start_date, $end_date, array('date'));
        if (is_wp_error($timeline_rows)) {
            $msg = 'GSC Daily Timeline Query Failed: ' . $timeline_rows->get_error_message();
            RankStack_DB::add_sync_log($project_id, 'failed', $msg);
            return $timeline_rows;
        }

        // 2. Fetch Detailed Query & URL Breakdown from GSC with Device Dimension
        $has_device_dim = true;
        $detail_rows = self::query_gsc_analytics($access_token, $property_url, $start_date, $end_date, array('date', 'query', 'country', 'device', 'page'));
        if (is_wp_error($detail_rows)) {
            // Fallback to 4 dimensions if device dimension query cannot be completed
            $has_device_dim = false;
            $detail_rows = self::query_gsc_analytics($access_token, $property_url, $start_date, $end_date, array('date', 'query', 'country', 'page'));
        }
        if (is_wp_error($detail_rows)) {
            $msg = 'GSC Detailed Queries Query Failed: ' . $detail_rows->get_error_message();
            RankStack_DB::add_sync_log($project_id, 'failed', $msg);
            return $detail_rows;
        }

        global $wpdb;
        $table_rankings = RankStack_DB::get_table('rankings');
        $table_rollups = RankStack_DB::get_table('rollups');

        // Overwrite old demo rows with real GSC data
        if (!empty($timeline_rows) || !empty($detail_rows)) {
            $wpdb->query($wpdb->prepare("DELETE FROM $table_rankings WHERE project_id = %s AND date >= %s AND date <= %s", $project_id, $start_date, $end_date));
            $wpdb->query($wpdb->prepare("DELETE FROM $table_rollups WHERE project_id = %s AND date >= %s AND date <= %s", $project_id, $start_date, $end_date));
        }

        // Save exact GSC Daily Rollups
        foreach ($timeline_rows as $t_row) {
            $date = isset($t_row['keys'][0]) ? $t_row['keys'][0] : '';
            if ($date) {
                RankStack_DB::save_rollup($project_id, $date, array(
                    'total_clicks' => intval($t_row['clicks']),
                    'total_impressions' => intval($t_row['impressions']),
                    'avg_ctr' => floatval($t_row['ctr']),
                    'avg_position' => floatval($t_row['position']),
                    'top_3' => 0,
                    'top_10' => 0,
                    'top_20' => 0,
                    'top_50' => 0,
                    'top_100' => 0
                ));
            }
        }

        // Map tracked keywords for this project
        $keywords = RankStack_DB::get_keywords($project_id);
        $keyword_map = array();
        foreach ($keywords as $kw) {
            $keyword_map[strtolower(trim($kw['keyword']))] = $kw['id'];
        }

        $rankings_to_save = array();
        $new_keywords_added = array();
        $updated_keywords_seen = array();

        // Run auto-hygiene cleanup on any pre-existing spam/garbage queries in database
        RankStack_DB::cleanup_spam_keywords($project_id);

        if (is_array($detail_rows)) {
            foreach ($detail_rows as $row) {
                $date = isset($row['keys'][0]) ? $row['keys'][0] : '';
                $query = isset($row['keys'][1]) ? strtolower(trim($row['keys'][1])) : '';
                $country = isset($row['keys'][2]) ? strtoupper($row['keys'][2]) : 'US';
                if ($has_device_dim && isset($row['keys'][3]) && isset($row['keys'][4])) {
                    $device = strtoupper($row['keys'][3]);
                    $page = $row['keys'][4];
                } else {
                    $device = 'ALL';
                    $page = isset($row['keys'][3]) ? $row['keys'][3] : '';
                }

                if (!empty($query)) {
                    // Check if keyword is in Bulk Exclusion list
                    if (RankStack_DB::is_keyword_excluded($project_id, $query)) {
                        RankStack_DB::add_skipped_keyword($project_id, $query, 'Excluded via Bulk Exclude List', $date);
                        continue;
                    }

                    // Auto-hygiene filter: route paragraph-length text, copy-pasted comments, or URL spam directly to Skipped Keywords
                    $is_long_query = (mb_strlen($query) > 120 || str_word_count($query) > 18);
                    $has_url_spam = (bool) preg_match('/https?:\/\/|www\.|\.cc\b|\.xyz\b|\.top\b|\.ru\b|\.click\b|\.buzz\b/i', $query);

                    if ($is_long_query || $has_url_spam) {
                        $skip_reason = $has_url_spam ? 'Auto-filtered: URL / Spam phrase query' : 'Auto-filtered: Long paragraph query (>120 chars)';
                        RankStack_DB::add_skipped_keyword($project_id, $query, $skip_reason, $date);
                        continue;
                    }

                    if (!isset($keyword_map[$query])) {
                        $auto_tags = RankStack_DB::auto_tag_keyword($project_id, $query);
                        $is_brand = (strpos($query, 'wpoets') !== false || strpos($query, strtolower($project['name'])) !== false) ? 1 : 0;
                        $new_kw_id = RankStack_DB::add_keyword($project_id, $query, $page, $is_brand, $auto_tags);
                        $keyword_map[$query] = $new_kw_id;
                        $new_keywords_added[] = $query;
                    } else {
                        $updated_keywords_seen[$query] = true;
                    }

                    $rankings_to_save[] = array(
                        'keyword_id' => $keyword_map[$query],
                        'date' => $date,
                        'country' => $country,
                        'device' => $device,
                        'clicks' => intval($row['clicks']),
                        'impressions' => intval($row['impressions']),
                        'ctr' => floatval($row['ctr']),
                        'position' => floatval($row['position']),
                        'url' => $page
                    );
                }
            }
        }

        if (!empty($rankings_to_save)) {
            RankStack_DB::save_rankings_batch($project_id, $rankings_to_save);
        }

        $unique_new = array_values(array_unique($new_keywords_added));
        $new_count = count($unique_new);
        $updated_count = !empty($updated_keywords_seen) ? count($updated_keywords_seen) : max(0, count($keyword_map) - $new_count);

        RankStack_DB::add_sync_log($project_id, 'success', array(
            'rows_synced' => count($rankings_to_save),
            'timeline_days' => count($timeline_rows),
            'property_used' => $property_url,
            'date_range' => "{$start_date} to {$end_date}"
        ), $new_count, $updated_count, $unique_new);

        return array(
            'success' => true,
            'synced_rows' => count($rankings_to_save),
            'new_keywords_count' => $new_count,
            'updated_keywords_count' => $updated_count,
            'property_used' => $property_url
        );
    }

    public static function run_scheduled_sync() {
        $projects = RankStack_DB::get_projects();
        foreach ($projects as $proj) {
            self::sync_project_data($proj['id'], 7);
        }
    }
}
