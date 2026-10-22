jQuery(document).ready(function($) {
    const googleUpdates = [
        { name: 'May 2026 Core Update', type: 'core', date: '2026-05-12 to 2026-05-28', desc: 'A broad core algorithm update focused on enhancing query understanding and rewarding original content.' },
        { name: 'GSC Data Anomaly Incident', type: 'anomaly', date: '2026-05-18 to 2026-05-20', desc: 'Google confirmed an internal search analytics reporting issue resulting in temporary reporting delay.' },
        { name: 'March 2026 Core Update', type: 'core', date: '2026-03-05 to 2026-03-29', desc: 'A major core update aimed at improving search quality, addressing spam, and reducing unoriginal content.' },
        { name: 'November 2025 Core Update', type: 'core', date: '2025-11-14 to 2025-12-04', desc: 'Standard core algorithm optimization focused on refining search query relevance.' },
        { name: 'October 2025 Link Spam Update', type: 'spam', date: '2025-10-20 to 2025-11-05', desc: 'Targeted algorithm designed to identify and nullify link spam networks and PBNs.' },
        { name: 'August 2024 Core Update', type: 'core', date: '2024-08-15 to 2024-09-03', desc: 'Core update developed after feedback from creators, aiming to better showcase independent sites.' }
    ];

    const $container = $('#rs-updates-container');
    $container.empty();

    googleUpdates.forEach(function(upd) {
        const badgeColor = upd.type === 'core' ? 'rs-badge-success' : 'rs-badge-secondary';
        $container.append(`
            <div style="border-bottom: 1px solid #e2e8f0; padding: 16px 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h3 style="margin:0; font-size:16px; color:#0f172a;">${upd.name}</h3>
                    <span class="rs-badge ${badgeColor}">${upd.type}</span>
                </div>
                <div style="font-size:13px; color:#64748b; margin-bottom:6px;">🗓️ ${upd.date}</div>
                <p style="margin:0; font-size:14px; color:#334155; line-height:1.5;">${upd.desc}</p>
            </div>
        `);
    });
});
