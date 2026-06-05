'use client';

import React, { useState } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, TrendingDown, RefreshCw, AlertCircle, 
  HelpCircle, CalendarRange
} from 'lucide-react';
import { ChangeLog } from '@/lib/types';

interface DetailedChangeLog extends ChangeLog {
  keyword: string;
  country: string;
}

export default function ComparePage() {
  const { activeProjectId } = useProject();
  const [metricFilter, setMetricFilter] = useState<string>('All');

  // Fetch changes
  const { data: changes = [], isLoading, isError, refetch } = useQuery<DetailedChangeLog[]>({
    queryKey: ['changes', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return [];
      const res = await fetch(`/api/keywords/changes?projectId=${activeProjectId}`);
      if (!res.ok) throw new Error('Failed to fetch keyword changes');
      return res.json();
    },
    enabled: !!activeProjectId
  });

  const getMetricLabel = (type: ChangeLog['metric_type']) => {
    switch (type) {
      case 'position': return 'Avg Position';
      case 'clicks_30d': return '30d Clicks';
      case 'clicks_90d': return '90d Clicks';
      case 'impressions_30d': return '30d Impressions';
      case 'impressions_90d': return '90d Impressions';
      default: return type;
    }
  };

  const filteredChanges = changes.filter(c => {
    if (metricFilter === 'All') return true;
    if (metricFilter === 'position') return c.metric_type === 'position';
    if (metricFilter === 'traffic') return c.metric_type.startsWith('clicks') || c.metric_type.startsWith('impressions');
    return true;
  });

  if (!activeProjectId) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="h-12 w-12 text-slate-400 mb-4 animate-glow" />
        <h3 className="text-xl font-bold text-slate-800 mb-2">No Active Project Selected</h3>
        <p className="text-slate-500 text-sm max-w-sm">
          Please select or create a project in Settings first to compare sync changes.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded" />
        <div className="h-12 w-full bg-white border border-slate-200 rounded-xl" />
        <div className="h-96 w-full bg-white border border-slate-200 rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-slate-805 mb-1">Failed to load change log</h3>
        <p className="text-slate-500 text-sm max-w-sm mb-6">
          There was an error retrieving the project comparison logs from local storage.
        </p>
        <button
          onClick={() => refetch()}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all-200"
        >
          Retry Load
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Sync Comparisons
          </h1>
          <p className="text-slate-550 text-sm mt-1">
            Compare precomputed keyword rollups before and after the last sync log update.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="h-10 px-4 bg-white border border-slate-200 hover:bg-slate-55 text-slate-650 rounded-xl text-xs font-semibold shadow-sm transition-all-200 flex items-center space-x-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5 animate-glow" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter tab bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200/40">
          {[
            { label: 'All Metric Updates', value: 'All' },
            { label: 'Rank Positions Only', value: 'position' },
            { label: 'Traffic Clicks / Imps', value: 'traffic' }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setMetricFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all-200 ${
                metricFilter === opt.value
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-805'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 flex items-center space-x-1 font-semibold">
          <CalendarRange className="h-3.5 w-3.5 text-indigo-500" />
          <span>Logging changes when metrics shift sync-to-sync</span>
        </div>
      </div>

      {/* Comparisons Table */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-sm bg-white border border-slate-200/80">
        <div className="overflow-x-auto">
          {filteredChanges.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <HelpCircle className="h-12 w-12 text-slate-400 mb-4 animate-glow" />
              <h4 className="text-sm font-semibold text-slate-805 mb-1">No sync updates found</h4>
              <p className="text-slate-500 text-xs max-w-md leading-normal">
                If you just set up this project or seeded demo data, ranking updates are initial. Changes will populate as subsequent sync operations are completed!
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Timestamp</th>
                  <th className="py-3.5 px-6">Keyword</th>
                  <th className="py-3.5 px-4">Country</th>
                  <th className="py-3.5 px-6">Audited Metric</th>
                  <th className="py-3.5 px-6 text-right">Prior Value</th>
                  <th className="py-3.5 px-6 text-right">Current Value</th>
                  <th className="py-3.5 px-6 text-right">Net Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredChanges.map((log) => {
                  const valDiff = log.new_value - log.old_value;
                  // For position, lower is better. So improvement is negative diff (e.g. from 15 to 10 is -5).
                  // For traffic metrics, higher is better. So improvement is positive diff (e.g. clicks from 20 to 50 is +30).
                  const isPos = log.metric_type === 'position';
                  const isImprovement = isPos ? valDiff < 0 : valDiff > 0;
                  const absDiffStr = Math.abs(valDiff).toFixed(isPos ? 1 : 0);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/30 transition-all-200">
                      {/* Date */}
                      <td className="py-3.5 px-6 text-slate-500 text-xs font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      {/* Keyword */}
                      <td className="py-3.5 px-6 font-semibold text-slate-800">
                        {log.keyword}
                      </td>

                      {/* Country */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-xs font-bold text-slate-650 shadow-sm">
                          {log.country}
                        </span>
                      </td>

                      {/* Metric Name */}
                      <td className="py-3.5 px-6">
                        <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded font-semibold bg-slate-50 border border-slate-200 text-slate-650 shadow-sm`}>
                          {getMetricLabel(log.metric_type)}
                        </span>
                      </td>

                      {/* Old Value */}
                      <td className="py-3.5 px-6 text-right text-slate-500 font-mono">
                        {isPos ? log.old_value.toFixed(1) : log.old_value.toLocaleString()}
                      </td>

                      {/* New Value */}
                      <td className="py-3.5 px-6 text-right text-slate-800 font-bold font-mono">
                        {isPos ? log.new_value.toFixed(1) : log.new_value.toLocaleString()}
                      </td>

                      {/* Difference */}
                      <td className="py-3.5 px-6 text-right">
                        {valDiff === 0 ? (
                          <span className="text-slate-400 font-mono">-</span>
                        ) : isImprovement ? (
                          <span className="inline-flex items-center space-x-0.5 text-xs font-bold text-emerald-600">
                            <TrendingUp className="h-3.5 w-3.5" />
                            <span>
                              {isPos ? '-' : '+'}{absDiffStr}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-0.5 text-xs font-bold text-red-650">
                            <TrendingDown className="h-3.5 w-3.5" />
                            <span>
                              {isPos ? '+' : '-'}{absDiffStr}
                            </span>
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
