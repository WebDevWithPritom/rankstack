<?php
if (!defined('ABSPATH')) {
    exit;
}

class RankStack_Activator {

    public static function activate() {
        global $wpdb;
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');

        $charset_collate = $wpdb->get_charset_collate();

        // 1. Projects Table
        $table_projects = $wpdb->prefix . 'rankstack_projects';
        $sql_projects = "CREATE TABLE $table_projects (
            id varchar(64) NOT NULL,
            name varchar(255) NOT NULL,
            domain varchar(255) NOT NULL,
            gsc_property varchar(255) DEFAULT '' NOT NULL,
            target_country varchar(10) DEFAULT 'US' NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id)
        ) $charset_collate;";
        dbDelta($sql_projects);

        // 2. Keywords Table
        $table_keywords = $wpdb->prefix . 'rankstack_keywords';
        $sql_keywords = "CREATE TABLE $table_keywords (
            id varchar(64) NOT NULL,
            project_id varchar(64) NOT NULL,
            keyword varchar(255) NOT NULL,
            target_url text DEFAULT '' NOT NULL,
            tags text DEFAULT '' NOT NULL,
            auto_tags varchar(255) DEFAULT '' NOT NULL,
            is_branded tinyint(1) DEFAULT 0 NOT NULL,
            status varchar(20) DEFAULT 'active' NOT NULL,
            added_date datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY project_id (project_id)
        ) $charset_collate;";
        dbDelta($sql_keywords);

        // 3. Rankings Table
        $table_rankings = $wpdb->prefix . 'rankstack_rankings';
        $sql_rankings = "CREATE TABLE $table_rankings (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            project_id varchar(64) NOT NULL,
            keyword_id varchar(64) NOT NULL,
            date date NOT NULL,
            country varchar(10) DEFAULT 'US' NOT NULL,
            device varchar(20) DEFAULT 'ALL' NOT NULL,
            clicks int(11) DEFAULT 0 NOT NULL,
            impressions int(11) DEFAULT 0 NOT NULL,
            ctr float DEFAULT 0 NOT NULL,
            position float DEFAULT 0 NOT NULL,
            url text DEFAULT '' NOT NULL,
            PRIMARY KEY  (id),
            KEY proj_date (project_id, date),
            KEY kw_date (keyword_id, date)
        ) $charset_collate;";
        dbDelta($sql_rankings);

        // 4. Integrations Table
        $table_integrations = $wpdb->prefix . 'rankstack_integrations';
        $sql_integrations = "CREATE TABLE $table_integrations (
            id varchar(64) NOT NULL,
            project_id varchar(64) NOT NULL,
            service varchar(50) DEFAULT 'gsc' NOT NULL,
            refresh_token text DEFAULT '' NOT NULL,
            access_token text DEFAULT '' NOT NULL,
            expires_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            connected_account varchar(255) DEFAULT '' NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY project_id (project_id)
        ) $charset_collate;";
        dbDelta($sql_integrations);

        // 5. Sync Logs Table
        $table_sync_logs = $wpdb->prefix . 'rankstack_sync_logs';
        $sql_sync_logs = "CREATE TABLE $table_sync_logs (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            project_id varchar(64) NOT NULL,
            timestamp datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            status varchar(20) DEFAULT 'info' NOT NULL,
            details text DEFAULT '' NOT NULL,
            new_keywords_count int(11) DEFAULT 0 NOT NULL,
            updated_keywords_count int(11) DEFAULT 0 NOT NULL,
            new_keywords_list longtext DEFAULT '' NOT NULL,
            PRIMARY KEY  (id),
            KEY project_id (project_id)
        ) $charset_collate;";
        dbDelta($sql_sync_logs);

        // 5b. Custom Categories Table
        $table_categories = $wpdb->prefix . 'rankstack_categories';
        $sql_categories = "CREATE TABLE $table_categories (
            id varchar(64) NOT NULL,
            project_id varchar(64) NOT NULL,
            name varchar(255) NOT NULL,
            slug varchar(255) NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY project_id (project_id)
        ) $charset_collate;";
        dbDelta($sql_categories);

        // 6. Sync Jobs Table
        $table_sync_jobs = $wpdb->prefix . 'rankstack_sync_jobs';
        $sql_sync_jobs = "CREATE TABLE $table_sync_jobs (
            id varchar(64) NOT NULL,
            project_id varchar(64) NOT NULL,
            status varchar(50) DEFAULT 'pending' NOT NULL,
            progress int(11) DEFAULT 0 NOT NULL,
            total int(11) DEFAULT 0 NOT NULL,
            started_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            finished_at datetime NULL,
            error text DEFAULT '' NOT NULL,
            PRIMARY KEY  (id),
            KEY project_id (project_id)
        ) $charset_collate;";
        dbDelta($sql_sync_jobs);

        // 7. Rollups Table
        $table_rollups = $wpdb->prefix . 'rankstack_rollups';
        $sql_rollups = "CREATE TABLE $table_rollups (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            project_id varchar(64) NOT NULL,
            date date NOT NULL,
            total_clicks int(11) DEFAULT 0 NOT NULL,
            total_impressions int(11) DEFAULT 0 NOT NULL,
            avg_ctr float DEFAULT 0 NOT NULL,
            avg_position float DEFAULT 0 NOT NULL,
            top_3 int(11) DEFAULT 0 NOT NULL,
            top_10 int(11) DEFAULT 0 NOT NULL,
            top_20 int(11) DEFAULT 0 NOT NULL,
            top_50 int(11) DEFAULT 0 NOT NULL,
            top_100 int(11) DEFAULT 0 NOT NULL,
            PRIMARY KEY  (id),
            KEY proj_date (project_id, date)
        ) $charset_collate;";
        dbDelta($sql_rollups);

        // 8. Annotations Table
        $table_annotations = $wpdb->prefix . 'rankstack_annotations';
        $sql_annotations = "CREATE TABLE $table_annotations (
            id varchar(64) NOT NULL,
            project_id varchar(64) NOT NULL,
            date date NOT NULL,
            label varchar(255) NOT NULL,
            type varchar(50) DEFAULT 'custom' NOT NULL,
            description text DEFAULT '' NOT NULL,
            PRIMARY KEY  (id),
            KEY proj_date (project_id, date)
        ) $charset_collate;";
        dbDelta($sql_annotations);

        // 9. Sync Skipped Table
        $table_skipped = $wpdb->prefix . 'rankstack_sync_skipped';
        $sql_skipped = "CREATE TABLE $table_skipped (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            project_id varchar(64) NOT NULL,
            keyword varchar(255) NOT NULL,
            reason text DEFAULT '' NOT NULL,
            date date NOT NULL,
            PRIMARY KEY  (id),
            KEY proj_kw (project_id, keyword)
        ) $charset_collate;";
        dbDelta($sql_skipped);

        // 10. URL Inspections Table
        $table_url_inspections = $wpdb->prefix . 'rankstack_url_inspections';
        $sql_url_inspections = "CREATE TABLE $table_url_inspections (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            project_id varchar(64) NOT NULL,
            url text NOT NULL,
            verdict varchar(50) DEFAULT 'NEUTRAL' NOT NULL,
            coverage_state varchar(100) DEFAULT '' NOT NULL,
            indexing_state varchar(100) DEFAULT '' NOT NULL,
            last_crawl_time datetime NULL,
            user_canonical text DEFAULT '' NOT NULL,
            google_canonical text DEFAULT '' NOT NULL,
            crawl_allowed varchar(20) DEFAULT 'ALLOWED' NOT NULL,
            indexing_allowed varchar(20) DEFAULT 'ALLOWED' NOT NULL,
            page_fetch_state varchar(50) DEFAULT 'SUCCESSFUL' NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY project_id (project_id)
        ) $charset_collate;";
        dbDelta($sql_url_inspections);

        // 11. Sitemaps Table
        $table_sitemaps = $wpdb->prefix . 'rankstack_sitemaps';
        $sql_sitemaps = "CREATE TABLE $table_sitemaps (
            id varchar(64) NOT NULL,
            project_id varchar(64) NOT NULL,
            path text NOT NULL,
            type varchar(50) DEFAULT 'sitemap' NOT NULL,
            last_submitted datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            last_downloaded datetime NULL,
            status varchar(50) DEFAULT 'Success' NOT NULL,
            discovered_urls int(11) DEFAULT 0 NOT NULL,
            errors_count int(11) DEFAULT 0 NOT NULL,
            PRIMARY KEY  (id),
            KEY project_id (project_id)
        ) $charset_collate;";
        dbDelta($sql_sitemaps);

        // 12. Removals Table
        $table_removals = $wpdb->prefix . 'rankstack_removals';
        $sql_removals = "CREATE TABLE $table_removals (
            id varchar(64) NOT NULL,
            project_id varchar(64) NOT NULL,
            url text NOT NULL,
            type varchar(50) DEFAULT 'temporary_removal' NOT NULL,
            status varchar(50) DEFAULT 'Processing' NOT NULL,
            requested_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            expires_at datetime NULL,
            PRIMARY KEY  (id),
            KEY project_id (project_id)
        ) $charset_collate;";
        dbDelta($sql_removals);

        // 13. Experience / Core Web Vitals Table
        $table_experience = $wpdb->prefix . 'rankstack_experience';
        $sql_experience = "CREATE TABLE $table_experience (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            project_id varchar(64) NOT NULL,
            device varchar(20) DEFAULT 'MOBILE' NOT NULL,
            lcp_val float DEFAULT 0 NOT NULL,
            lcp_status varchar(20) DEFAULT 'GOOD' NOT NULL,
            inp_val float DEFAULT 0 NOT NULL,
            inp_status varchar(20) DEFAULT 'GOOD' NOT NULL,
            cls_val float DEFAULT 0 NOT NULL,
            cls_status varchar(20) DEFAULT 'GOOD' NOT NULL,
            overall_verdict varchar(20) DEFAULT 'GOOD' NOT NULL,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            PRIMARY KEY  (id),
            KEY proj_device (project_id, device)
        ) $charset_collate;";
        dbDelta($sql_experience);

        // 14. Enhancements / Structured Data Table
        $table_enhancements = $wpdb->prefix . 'rankstack_enhancements';
        $sql_enhancements = "CREATE TABLE $table_enhancements (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            project_id varchar(64) NOT NULL,
            name varchar(100) NOT NULL,
            valid_items int(11) DEFAULT 0 NOT NULL,
            invalid_items int(11) DEFAULT 0 NOT NULL,
            issues_count int(11) DEFAULT 0 NOT NULL,
            PRIMARY KEY  (id),
            KEY project_id (project_id)
        ) $charset_collate;";
        dbDelta($sql_enhancements);

        // 15. Links Table
        $table_links = $wpdb->prefix . 'rankstack_links';
        $sql_links = "CREATE TABLE $table_links (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            project_id varchar(64) NOT NULL,
            type varchar(20) DEFAULT 'EXTERNAL' NOT NULL,
            source_url text DEFAULT '' NOT NULL,
            target_url text NOT NULL,
            anchor_text varchar(255) DEFAULT '' NOT NULL,
            discovered_date date NOT NULL,
            PRIMARY KEY  (id),
            KEY proj_type (project_id, type)
        ) $charset_collate;";
        dbDelta($sql_links);

        // Store database version
        update_option('rankstack_db_version', RANKSTACK_DB_VERSION);
    }
}
