jQuery(document).ready(function($) {
    let compareChart = null;
    const apiRoot = RankStackData.root;
    const nonce = RankStackData.nonce;

    loadProjects();

    function loadProjects() {
        $.ajax({
            url: apiRoot + 'projects',
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(projects) {
                const $select = $('#rs-cmp-project-select');
                $select.empty();

                if (!projects || projects.length === 0) {
                    $select.append('<option value="">No Projects Found</option>');
                    return;
                }

                projects.forEach(function(p) {
                    $select.append(`<option value="${p.id}">${p.name} (${p.domain})</option>`);
                });
            }
        });
    }

    $('#rs-btn-compare').on('click', function() {
        const projectId = $('#rs-cmp-project-select').val();
        const urlA = $('#rs-url-a').val().trim();
        const urlB = $('#rs-url-b').val().trim();

        if (!projectId) return alert('Please select a project first.');
        if (!urlA || !urlB) return alert('Please enter both URL A and URL B to compare.');

        fetchAndRenderComparison(projectId, urlA, urlB);
    });

    function fetchAndRenderComparison(projectId, urlA, urlB) {
        const $btn = $('#rs-btn-compare');
        $btn.text('Comparing...').prop('disabled', true);

        $.ajax({
            url: apiRoot + `compare?project_id=${projectId}&url_a=${encodeURIComponent(urlA)}&url_b=${encodeURIComponent(urlB)}`,
            method: 'GET',
            beforeSend: function(xhr) { xhr.setRequestHeader('X-WP-Nonce', nonce); },
            success: function(data) {
                $btn.text('Compare URLs').prop('disabled', false);
                renderComparisonChart(data);
            },
            error: function() {
                $btn.text('Compare URLs').prop('disabled', false);
                alert('Failed to fetch comparison data for specified URLs.');
            }
        });
    }

    function renderComparisonChart(data) {
        const ctx = document.getElementById('rs-compare-chart').getContext('2d');
        if (compareChart) compareChart.destroy();

        const timeline = data.timeline || [];
        const labels = timeline.map(t => t.date);
        const clicksA = timeline.map(t => t.clicks_a);
        const clicksB = timeline.map(t => t.clicks_b);

        compareChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['No Data'],
                datasets: [
                    {
                        label: `URL A: ${data.url_a}`,
                        data: clicksA.length > 0 ? clicksA : [0],
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: `URL B: ${data.url_b}`,
                        data: clicksB.length > 0 ? clicksB : [0],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Clicks' }
                    }
                }
            }
        });
    }
});
