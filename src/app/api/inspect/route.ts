import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';
import { getGSCAccessToken } from '@/lib/gsc';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, url } = body;

    if (!projectId || !url) {
      return NextResponse.json({ error: 'Project ID and URL are required' }, { status: 400 });
    }

    const project = await store.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const accessToken = await getGSCAccessToken(projectId);

    // If mock token, return mock response
    if (accessToken === 'mock_access_token_demo') {
      const slug = url.replace(/https?:\/\/(www\.)?wpoets\.com\//, '').replace(/\/$/, '').replace(/\//g, ' > ');
      const name = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'Homepage';

      return NextResponse.json({
        inspectionResult: {
          inspectionResultLink: `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(project.domain)}&id=${encodeURIComponent(url)}`,
          indexStatusResult: {
            verdict: 'PASS',
            coverageState: 'Indexed, not submitted in sitemap',
            robotsTxtState: 'ALLOWED',
            indexingState: 'INDEXING_ALLOWED',
            lastCrawlTime: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
            pageFetchState: 'SUCCESS',
            googleCanonical: url,
            userCanonical: url,
            crawlUserAgent: 'MOBILE'
          },
          mobileUsabilityResult: {
            verdict: 'PASS',
            issues: []
          },
          richResultsResult: {
            verdict: 'PASS',
            detectedItems: [
              {
                name: 'Article',
                items: [{ name: name }]
              },
              {
                name: 'Breadcrumbs',
                items: [{ name: 'Navigation Schema' }]
              }
            ]
          }
        }
      });
    }

    // Call real Google GSC URL Inspection API
    const gscInspectUrl = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
    const response = await fetch(gscInspectUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inspectionUrl: url,
        siteUrl: project.domain
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `GSC Inspection API returned error: ${response.status} - ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('URL Inspection failed:', error);
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
