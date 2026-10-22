=== RankStack - GSC Keyword Rank Tracking ===
Contributors: rankstack, wpoets
Tags: seo, keyword tracking, google search console, rank tracker, rankstack
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Keyword rank tracking engine that mirrors Google Search Console Performance with a fast dashboard for keywords, countries, and date ranges.

== Description ==

**RankStack** is a native WordPress plugin converted from Next.js, designed for high-performance Keyword Rank Tracking and Google Search Console Analytics mirroring inside your WordPress Admin.

### 🌟 Key Features

* **GSC Traffic & Position Timeline**: Unified multi-axis Chart.js timeline (Clicks, Impressions, Average Position) with custom date range pickers.
* **Keyword Position Distribution**: Visual breakdown of top 3, top 10, top 20, top 50, and top 100 ranking positions.
* **Branded vs Non-Branded Split**: Automatic keyword classification into Branded vs Non-Branded organic traffic.
* **Timeline Annotations**: Custom notes and confirmed Google Search Algorithm update markers displayed directly on the performance timeline.
* **URL Performance Comparison**: Side-by-side comparative traffic analytics between any two URLs on your website.
* **Skipped Keywords Engine**: Log low-search volume keywords excluded during automated synchronization.
* **Automated Background Sync**: Daily automatic GSC metric synchronization via WP-Cron (`rankstack_daily_gsc_sync`).
* **AES-256-CBC Encryption**: Secure, encrypted storage of Google OAuth refresh tokens and credentials.
* **Instant Demo Data Seeding**: Out-of-the-box 60-day demo metrics generated automatically for instant dashboard visualization.

== Installation ==

1. Upload the `rank-stack` directory to your `/wp-content/plugins/` directory (or upload the `.zip` file via **Plugins ➔ Add New ➔ Upload Plugin**).
2. Activate the plugin through the **Plugins** menu in WordPress.
3. Navigate to **🚀 RankStack** in your WordPress admin sidebar.
4. Go to **Settings** to configure your Google Cloud Console API credentials (Client ID and Client Secret).

== Frequently Asked Questions ==

= How do I get Google Search Console API Credentials? =
Go to the [Google Cloud Console](https://console.cloud.google.com/), enable the **Google Search Console API**, create an **OAuth 2.0 Web Application Client ID**, and set the Authorized Redirect URI to the URL displayed on your **RankStack ➔ Settings** page.

= Can I use RankStack without connecting Google Search Console immediately? =
Yes! RankStack automatically seeds 60 days of realistic demo metrics, keywords, and rollups upon project creation so you can test all dashboard charts out-of-the-box immediately.

== Changelog ==

= 1.0.0 =
* Initial release of RankStack WordPress Plugin (converted from Next.js).
* Added MySQL custom database engine, WP REST API endpoints, Chart.js timeline controller, URL comparison engine, and timeline annotations.
