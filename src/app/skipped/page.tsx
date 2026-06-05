'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  AlertOctagon, RefreshCw, CheckCircle2, Upload, Trash2, 
  Save, FileText, Ban, AlertTriangle, HelpCircle
} from 'lucide-react';
import { SyncSkipped } from '@/lib/types';
import { toast } from 'sonner';

export default function SkippedPage() {
  const queryClient = useQueryClient();
  const { activeProjectId } = useProject();
  const [rulesText, setRulesText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Fetch skipped logs
  const { data: skippedRows = [], isLoading, isError, refetch } = useQuery<SyncSkipped[]>({
    queryKey: ['skipped', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return [];
      const res = await fetch(`/api/sync/skipped?projectId=${activeProjectId}`);
      if (!res.ok) throw new Error('Failed to fetch skipped rows');
      return res.json();
    },
    enabled: !!activeProjectId
  });

  // Fetch skip rules
  const { data: rulesData, isLoading: isLoadingRules } = useQuery({
    queryKey: ['skipped-rules', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return { skipKeywords: [] };
      const res = await fetch(`/api/sync/skipped/rules?projectId=${activeProjectId}`);
      if (!res.ok) throw new Error('Failed to fetch skip rules');
      return res.json();
    },
    enabled: !!activeProjectId
  });

  // Initialize rulesText when rulesData loads
  useEffect(() => {
    if (rulesData?.skipKeywords) {
      setRulesText(rulesData.skipKeywords.join('\n'));
    }
  }, [rulesData]);

  // Handle Save Skip Rules
  const handleSaveRules = async () => {
    if (!activeProjectId) return;
    setIsSaving(true);
    const toastId = toast.loading('Saving skip rules...');
    try {
      const skipKeywords = rulesText
        .split('\n')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const res = await fetch('/api/sync/skipped/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, skipKeywords })
      });

      if (!res.ok) {
        throw new Error('Failed to save rules');
      }

      const updated = await res.json();
      setRulesText(updated.skipKeywords.join('\n'));
      queryClient.invalidateQueries({ queryKey: ['skipped-rules', activeProjectId] });
      toast.success('Skip rules saved successfully! Future GSC syncs will filter these queries.', { id: toastId });
    } catch (err: any) {
      toast.error(`Failed to save rules: ${err.message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle File Upload/Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const imported = text
        .split(/[\r\n,]+/)
        .map(k => k.trim())
        .filter(k => k.length > 0);
      
      const currentList = rulesText.split('\n').map(x => x.trim()).filter(Boolean);
      const combined = Array.from(new Set([...currentList, ...imported]));
      setRulesText(combined.join('\n'));
      toast.success(`Imported ${imported.length} keywords! Click "Save Rules" to apply.`);
    };
    reader.readAsText(file);
  };

  if (!activeProjectId) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
        <AlertOctagon className="h-12 w-12 text-slate-400 mb-4 animate-glow" />
        <h3 className="text-xl font-bold text-slate-800 mb-2">No Active Project Selected</h3>
        <p className="text-slate-500 text-sm max-w-sm">
          Please select or create a project in Settings first to configure skip rules and review audit logs.
        </p>
      </div>
    );
  }

  if (isLoading || isLoadingRules) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 h-96 bg-white border border-slate-200 rounded-xl" />
          <div className="lg:col-span-2 h-96 bg-white border border-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
        <AlertOctagon className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-slate-800 mb-1">Failed to load skipped rows logs</h3>
        <p className="text-slate-500 text-sm max-w-sm mb-6">
          There was an error retrieving the skipped rows database from local storage.
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
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
          Keywords Skip Rules & Sync Audit
        </h1>
        <p className="text-slate-550 text-sm mt-1">
          Configure keywords to skip permanently during GSC sync, preventing spam or unwanted queries from injecting into your dashboard tables.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Pane: Skip Rules Manager */}
        <div className="lg:col-span-1 glass-panel rounded-2xl p-6 border border-slate-200/80 shadow-sm bg-white space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center">
              <Ban className="h-4 w-4 text-red-500 mr-1.5" />
              <span>Keyword Skip Rules</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-normal">
              Enter queries or keywords to exclude. Matches are case-insensitive and apply as exact matching or substring matching (e.g. "free" excludes any query containing the phrase "free").
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Skipped Keywords List (One per line)
            </label>
            <textarea
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              placeholder="brandspam&#10;cheap offers&#10;competitorname"
              rows={12}
              className="w-full text-xs font-mono p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-none bg-slate-50/50"
            />
          </div>

          {/* Import / Upload Action */}
          <div className="flex flex-col gap-3">
            <div className="relative">
              <input
                type="file"
                accept=".txt,.csv"
                id="file-upload"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="w-full h-10 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 text-slate-655 rounded-xl text-xs font-semibold shadow-sm transition-all duration-150 flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Import from TXT / CSV</span>
              </label>
            </div>

            <button
              onClick={handleSaveRules}
              disabled={isSaving}
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-100 transition-all duration-150 flex items-center justify-center space-x-1.5"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Saving...' : 'Save Skip Rules'}</span>
            </button>
          </div>
        </div>

        {/* Right Pane: Skipped Rows Audit Logs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center">
                <FileText className="h-4 w-4 text-indigo-500 mr-1.5" />
                <span>Skipped Rows Audit Log</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                History of raw rows returned by GSC that were skipped due to your configured rules or metadata issues.
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg text-xs font-semibold shadow-sm transition-all duration-150 flex items-center space-x-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Log</span>
            </button>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden shadow-sm bg-white border border-slate-200/80">
            <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
              {skippedRows.length === 0 ? (
                <div className="p-16 text-center flex flex-col items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4 animate-glow" />
                  <h4 className="text-md font-semibold text-slate-800 mb-1">Clean import logs!</h4>
                  <p className="text-slate-500 text-xs max-w-md leading-normal">
                    No GSC rows are currently logged as skipped. All synced queries were successfully normalized or matched your project keywords.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur border-b border-slate-200">
                    <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3.5 px-6">Date</th>
                      <th className="py-3.5 px-6">Keyword / Query</th>
                      <th className="py-3.5 px-4">Country</th>
                      <th className="py-3.5 px-6">Reason for Skip</th>
                      <th className="py-3.5 px-4 text-right">Clicks</th>
                      <th className="py-3.5 px-4 text-right">Impressions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {skippedRows.slice().reverse().map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/30 transition-all duration-150">
                        {/* Date */}
                        <td className="py-3 px-6 text-slate-500 text-xs font-mono">
                          {row.date}
                        </td>

                        {/* Keyword */}
                        <td className="py-3 px-6 font-semibold text-slate-800">
                          {row.keyword}
                        </td>

                        {/* Country */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 font-mono text-[10px] font-bold text-slate-600 shadow-sm">
                            {row.country}
                          </span>
                        </td>

                        {/* Reason */}
                        <td className="py-3 px-6">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.reason === 'Excluded by Skip Rules'
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-red-50 text-red-700 border border-red-100'
                          }`}>
                            {row.reason}
                          </span>
                        </td>

                        {/* Clicks */}
                        <td className="py-3 px-4 text-right text-slate-600 font-mono font-semibold">
                          {row.clicks?.toLocaleString() || 0}
                        </td>

                        {/* Impressions */}
                        <td className="py-3 px-4 text-right text-slate-500 font-mono">
                          {row.impressions?.toLocaleString() || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
