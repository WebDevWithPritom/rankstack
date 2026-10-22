<?php
/**
 * Plugin Name:       RankStack - GSC Keyword Rank Tracking
 * Plugin URI:        https://wordpoets.com
 * Description:       Keyword rank tracking engine that mirrors Google Search Console Performance with a fast dashboard for keywords, countries, and date ranges.
 * Version:           1.0.0
 * Author:            RankStack
 * Text Domain:       rank-stack
 */

if (!defined('ABSPATH')) {
    exit;
}

if (function_exists('opcache_reset')) {
    @opcache_reset();
}
if (function_exists('wp_cache_flush')) {
    @wp_cache_flush();
}

define('RANKSTACK_VERSION', time());
define('RANKSTACK_DB_VERSION', '1.0.0');
define('RANKSTACK_FILE', __FILE__);
define('RANKSTACK_PATH', plugin_dir_path(__FILE__));
define('RANKSTACK_URL', plugin_dir_url(__FILE__));

// Require Core Files
require_once RANKSTACK_PATH . 'includes/class-rankstack-activator.php';
require_once RANKSTACK_PATH . 'includes/class-rankstack-crypto.php';
require_once RANKSTACK_PATH . 'includes/class-rankstack-db.php';
require_once RANKSTACK_PATH . 'includes/class-rankstack-gsc.php';
require_once RANKSTACK_PATH . 'includes/class-rankstack-rollups.php';
require_once RANKSTACK_PATH . 'includes/class-rankstack-rest-api.php';
require_once RANKSTACK_PATH . 'includes/class-rankstack-admin.php';

// Activation & Deactivation Hooks
register_activation_hook(__FILE__, array('RankStack_Activator', 'activate'));

/**
 * Main RankStack Plugin Container Class
 */
class RankStack_Plugin {
    private static $instance = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->init();
    }

    private function init() {
        // Initialize REST API
        add_action('rest_api_init', array('RankStack_REST_API', 'register_routes'));

        // Initialize WP Admin Menu & Frontend Assets
        if (is_admin()) {
            RankStack_Admin::init();
        }

        // Register WP Cron for automated GSC Sync
        add_action('rankstack_daily_gsc_sync', array('RankStack_GSC', 'run_scheduled_sync'));
        if (!wp_next_scheduled('rankstack_daily_gsc_sync')) {
            wp_schedule_event(time(), 'daily', 'rankstack_daily_gsc_sync');
        }
    }
}

// Instantiate Plugin
function rankstack() {
    return RankStack_Plugin::instance();
}

add_action('plugins_loaded', 'rankstack');
