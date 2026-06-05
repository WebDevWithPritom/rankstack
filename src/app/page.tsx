import React from 'react';
import Link from 'next/link';
import { ArrowRight, LayoutDashboard, Settings, TrendingUp, ShieldCheck, Database, CalendarDays, History } from 'lucide-react';

export default function Home() {
  const features = [
    {
      name: 'Google Search Console Mirror',
      description: 'Accurate keyword metrics that match GSC property totals down to 2% precision by using proper comparison periods and filters.',
      icon: ShieldCheck
    },
    {
      name: 'Cannibalization & Opportunity matrix',
      description: 'Flag pages ranking for identical search terms on the same day. Highlights winning URLs so you can optimize CTR.',
      icon: Database
    },
    {
      name: 'Precomputed Core Rollups',
      description: 'Lightning-fast dashboard queries using precomputed keyword rolling metrics over 1d, 7d, 30d, 90d, and 365d ranges.',
      icon: History
    },
    {
      name: 'Core Updates Correlation',
      description: 'Compare clicks and positions 14 days before vs 14 days after official Google Core, Helpful Content, and Spam algorithm updates.',
      icon: CalendarDays
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center py-12 md:py-24 relative overflow-hidden">
      
      {/* Background radial effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-[350px] h-[350px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Hero Section */}
      <div className="text-center max-w-3xl px-4 z-10">
        <div className="inline-flex items-center space-x-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-700 font-semibold mb-6 animate-pulse">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>SEO Enterprise SaaS v1.0</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
          SEO Teams Live in <br />
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Google Search Console
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-650 font-medium leading-relaxed mb-10 max-w-2xl mx-auto">
          Keyword rank tracking that mirrors Google Search Console Performance — same clicks, impressions, and query data — with a fast dashboard for every keyword, country, and date range.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all-200 hover:-translate-y-0.5"
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Open SEO Dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/settings"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-sm transition-all-200 hover:-translate-y-0.5"
          >
            <Settings className="h-5 w-5" />
            <span>Settings & Connections</span>
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl mt-24 px-4 z-10">
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <div key={idx} className="glass-card rounded-2xl p-6 flex items-start space-x-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-805 mb-2">{feature.name}</h3>
                <p className="text-slate-550 text-sm leading-relaxed">{feature.description}</p>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
