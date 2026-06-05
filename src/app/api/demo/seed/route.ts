import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as store from '@/lib/store';
import { Project, Keyword, Ranking, Integration, SyncLog, Annotation } from '@/lib/types';
import { encrypt } from '@/lib/crypto';
import { computeProjectRollups } from '@/lib/rollups';

const DEMO_KEYWORDS_TEMPLATE = [
  // Branded
  { keyword: 'wpoets', category: 'Branded', intent: 'Navigational', countries: ['US', 'IN', 'GB'] },
  { keyword: 'wpoets wordpress development', category: 'Branded', intent: 'Navigational', countries: ['US', 'IN'] },
  { keyword: 'wpoets agency reviews', category: 'Branded', intent: 'Navigational', countries: ['US'] },
  
  // Service
  { keyword: 'wordpress development agency', category: 'Service', intent: 'Commercial', countries: ['US', 'IN', 'GB'] },
  { keyword: 'hire wordpress developers', category: 'Service', intent: 'Commercial', countries: ['US', 'IN', 'CA'] },
  { keyword: 'custom wordpress theme design', category: 'Service', intent: 'Commercial', countries: ['US', 'CA'] },
  { keyword: 'headless wordpress developers', category: 'Service', intent: 'Commercial', countries: ['US', 'GB'] },
  { keyword: 'wordpress site speed optimization', category: 'Service', intent: 'Commercial', countries: ['US', 'IN', 'GB'] },
  
  // Location
  { keyword: 'wordpress developers near me', category: 'Location', intent: 'Navigational', countries: ['US', 'IN'] },
  { keyword: 'wordpress agency london', category: 'Location', intent: 'Commercial', countries: ['GB'] },
  { keyword: 'wordpress development company india', category: 'Location', intent: 'Commercial', countries: ['IN'] },
  { keyword: 'wordpress dev mumbai', category: 'Location', intent: 'Commercial', countries: ['IN'] },

  // Migration
  { keyword: 'drupal to wordpress migration service', category: 'Migration', intent: 'Transactional', countries: ['US', 'CA'] },
  { keyword: 'wix to wordpress redirect guide', category: 'Migration', intent: 'Transactional', countries: ['US', 'GB'] },
  { keyword: 'migrate joomla to wordpress without losing seo', category: 'Migration', intent: 'Informational', countries: ['US', 'IN'] },

  // Blog
  { keyword: 'wordpress vs nextjs for blog seo', category: 'Blog', intent: 'Informational', countries: ['US', 'IN', 'GB', 'CA'] },
  { keyword: 'why is my wordpress site slow loading', category: 'Blog', intent: 'Informational', countries: ['US', 'IN'] },
  { keyword: 'how to build custom gutenberg block', category: 'Blog', intent: 'Informational', countries: ['US', 'IN'] },
  { keyword: 'best cheap managed wordpress hosting', category: 'Blog', intent: 'Informational', countries: ['US'] },
  { keyword: 'wordpress api nextjs integration example', category: 'Blog', intent: 'Informational', countries: ['IN', 'CA'] }
];

export async function POST() {
  try {
    const db = await store.readDb();

    // 1. Create / Find Demo Project
    let project = db.projects.find(p => p.name === 'WPoets (Demo)');
    if (!project) {
      project = {
        id: `proj_demo_${Math.random().toString(36).substr(2, 6)}`,
        name: 'WPoets (Demo)',
        domain: 'https://www.wpoets.com/',
        created_at: new Date().toISOString()
      };
      db.projects.push(project);
    }
    const projectId = project.id;

    // Delete existing demo rankings directory if it exists to seed fresh data
    const projRankingsDir = path.join(process.cwd(), '.data', 'rankings', projectId);
    if (fs.existsSync(projRankingsDir)) {
      try {
        fs.rmSync(projRankingsDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Failed to clean demo rankings directory:', e);
      }
    }

    // 2. Generate Keywords
    const nowStr = new Date().toISOString();
    const createdKeywords: Keyword[] = [];

    for (const temp of DEMO_KEYWORDS_TEMPLATE) {
      for (const country of temp.countries) {
        // Check if keyword already exists
        let kw = db.keywords.find(k => k.project_id === projectId && k.keyword === temp.keyword && k.country === country);
        if (!kw) {
          kw = {
            id: `kw_demo_${Math.random().toString(36).substr(2, 9)}`,
            project_id: projectId,
            keyword: temp.keyword,
            country: country,
            category: temp.category,
            intent: temp.intent,
            is_excluded: false,
            created_at: nowStr,
            updated_at: nowStr
          };
          db.keywords.push(kw);
        }
        createdKeywords.push(kw);
      }
    }

    // 3. Generate Rankings for the last 90 days
    const end = new Date();
    end.setDate(end.getDate() - 2); // 2 days lag
    const dates: string[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const newRankings: Ranking[] = [];

    // Identify target keywords to simulate cannibalization on
    const cannibalizedKeywords = createdKeywords.filter(k => 
      k.keyword === 'wordpress development agency' || 
      k.keyword === 'wordpress site speed optimization'
    );

    for (const kw of createdKeywords) {
      // Establish baseline rank between 1.5 and 45.0
      let basePos = Math.random() * 35 + 2.5;

      // Deduplicate rankings is handled by clearing the folder before seeding

      const isCannibalCandidate = cannibalizedKeywords.some(ck => ck.id === kw.id);

      for (const date of dates) {
        // Random walk change: -1.5 to +1.5 positions
        const delta = (Math.random() * 3) - 1.5;
        // Gradual trend: slightly improve rankings over time (SEO work!)
        const seoImprovement = -0.05; 
        
        basePos = Math.max(1.1, Math.min(85, basePos + delta + seoImprovement));
        const finalPos = Math.round(basePos * 100) / 100;

        // Base traffic on ranking position
        let baseImps = 5;
        if (finalPos <= 1.5) baseImps = Math.floor(Math.random() * 500) + 400;
        else if (finalPos <= 3) baseImps = Math.floor(Math.random() * 200) + 150;
        else if (finalPos <= 10) baseImps = Math.floor(Math.random() * 100) + 40;
        else if (finalPos <= 30) baseImps = Math.floor(Math.random() * 30) + 10;
        else baseImps = Math.floor(Math.random() * 8) + 1;

        // Add variance on week-ends
        const dayOfWeek = new Date(date).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const impressions = isWeekend ? Math.round(baseImps * 0.4) : baseImps;

        // Click-through rate based on position
        let ctr = 0.01;
        if (finalPos <= 1.2) ctr = Math.random() * 0.15 + 0.25; // 25%-40%
        else if (finalPos <= 3) ctr = Math.random() * 0.08 + 0.12; // 12%-20%
        else if (finalPos <= 10) ctr = Math.random() * 0.04 + 0.02; // 2%-6%
        else if (finalPos <= 20) ctr = Math.random() * 0.01 + 0.005; // 0.5%-1.5%
        else ctr = Math.random() * 0.002; // <0.2%

        const clicks = Math.round(impressions * ctr);

        const slug = kw.keyword.replace(/\s+/g, '-').toLowerCase();
        let rankingUrl = `https://www.wpoets.com/blog/${slug}`;
        if (kw.category === 'Service') {
          rankingUrl = `https://www.wpoets.com/services/${slug}`;
        } else if (kw.category === 'Branded') {
          rankingUrl = 'https://www.wpoets.com/';
        }

        // Primary URL ranking entry
        newRankings.push({
          keyword_id: kw.id,
          date,
          position: finalPos,
          clicks,
          impressions,
          ctr: impressions > 0 ? clicks / impressions : 0,
          ranking_url: rankingUrl,
          source: 'gsc'
        });

        // Seed cannibalization: add a competing secondary page ranking on the same day for specific queries
        if (isCannibalCandidate && Math.random() > 0.3) {
          const secondaryPos = Math.round((finalPos + (Math.random() * 5 + 3)) * 100) / 100;
          const secondaryImps = Math.round(impressions * 0.6);
          const secondaryClicks = Math.round(secondaryImps * (ctr * 0.2));
          const secondaryUrl = `https://www.wpoets.com/blog/${slug}-competing-guide`;

          newRankings.push({
            keyword_id: kw.id,
            date,
            position: secondaryPos,
            clicks: secondaryClicks,
            impressions: secondaryImps,
            ctr: secondaryImps > 0 ? secondaryClicks / secondaryImps : 0,
            ranking_url: secondaryUrl,
            source: 'gsc'
          });
        }
      }
    }

    // Save rankings
    await store.saveRankings(projectId, newRankings);

    // 3.5 Generate Property Totals for the project (simulating privacy filtering discrepancy)
    const propTotalsMap = new Map<string, { date: string; country: string; clicks: number; impressions: number; weightedPosSum: number; count: number }>();
    const kwToCountryMap = new Map<string, string>();
    for (const kw of createdKeywords) {
      kwToCountryMap.set(kw.id, kw.country);
    }
    
    for (const r of newRankings) {
      const country = kwToCountryMap.get(r.keyword_id) || 'US';
      const key = `${r.date}||${country}`;
      const existing = propTotalsMap.get(key);
      if (existing) {
        existing.clicks += r.clicks;
        existing.impressions += r.impressions;
        existing.weightedPosSum += r.position * r.impressions;
        existing.count += 1;
      } else {
        propTotalsMap.set(key, {
          date: r.date,
          country,
          clicks: r.clicks,
          impressions: r.impressions,
          weightedPosSum: r.position * r.impressions,
          count: 1
        });
      }
    }
    
    const propertyTotals: any[] = [];
    for (const item of Array.from(propTotalsMap.values())) {
      const scaledClicks = Math.round(item.clicks * 2.1);
      const scaledImpressions = Math.round(item.impressions * 2.2);
      const avgPos = item.impressions > 0 ? (item.weightedPosSum / item.impressions) : 20;
      const finalPos = Math.max(1.0, Math.round(avgPos * 0.7 * 100) / 100);
      
      propertyTotals.push({
        project_id: projectId,
        date: item.date,
        country: item.country,
        clicks: scaledClicks,
        impressions: scaledImpressions,
        position: finalPos
      });
    }
    
    db.property_totals = (db.property_totals || []).filter(t => t.project_id !== projectId);
    db.property_totals.push(...propertyTotals);

    // 3.8 Generate Mock Annotations to showcase the SEO A/B Tracker
    // Seed one annotation 30 days ago, and another 15 days ago
    const annDate1 = dates[Math.max(0, dates.length - 30)];
    const annDate2 = dates[Math.max(0, dates.length - 15)];

    db.annotations = (db.annotations || []).filter(a => a.project_id !== projectId);
    db.annotations.push(
      {
        id: `ann_seed_1`,
        project_id: projectId,
        date: annDate1,
        title: 'Optimized Meta Titles & Headings on Core Services',
        description: 'Updated meta titles and descriptions on service landing pages to boost search CTR and solve minor duplicate headings.',
        created_at: nowStr
      },
      {
        id: `ann_seed_2`,
        project_id: projectId,
        date: annDate2,
        title: 'Redirection of Thin Migrated Content',
        description: 'Redirected several legacy joomla/wix thin pages into our primary WordPress developer hiring guides to clear cannibalization.',
        created_at: nowStr
      }
    );

    // 4. Create Mock GSC Integration
    const integrationIndex = db.integrations.findIndex(i => i.project_id === projectId && i.type === 'gsc');
    const mockOAuthMetadata = {
      access_token: 'mock_access_token_demo',
      refresh_token: 'mock_refresh_token_demo',
      expiry_date: Date.now() + 3600 * 1000 // 1 hour
    };

    const integration: Integration = {
      project_id: projectId,
      type: 'gsc',
      is_active: true,
      metadata: encrypt(JSON.stringify(mockOAuthMetadata))
    };

    if (integrationIndex >= 0) {
      db.integrations[integrationIndex] = integration;
    } else {
      db.integrations.push(integration);
    }

    // 5. Add Seed Log
    const syncLog: SyncLog = {
      id: `log_seed_${Date.now()}`,
      project_id: projectId,
      date: dates[dates.length - 1],
      status: 'success',
      message: `Demo seed complete. Added ${createdKeywords.length} keywords, cannibalized rankings, and mock A/B annotations.`,
      type: 'quick',
      created_at: nowStr
    };
    db.sync_logs.push(syncLog);

    await store.writeDb(db);

    // 6. Precompute Rollups for the project
    await computeProjectRollups(projectId);

    return NextResponse.json({
      success: true,
      projectId,
      keywordsCount: createdKeywords.length,
      rankingsCount: newRankings.length
    });

  } catch (error: any) {
    console.error('Demo seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
