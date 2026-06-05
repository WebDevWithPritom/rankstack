'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Search, Eye, EyeOff, Tag, Compass, ChevronLeft, 
  ChevronRight, AlertCircle, FileText
} from 'lucide-react';
import { Keyword } from '@/lib/types';

export default function KeywordsPage() {
  const queryClient = useQueryClient();
  const { activeProjectId } = useProject();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [syncFilter, setSyncFilter] = useState<'all' | 'updated'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jumpPageVal, setJumpPageVal] = useState<string>('');
  const pageSize = 15;

  const categories = ['Branded', 'Migration', 'Location', 'Service', 'Blog'];
  const intents = ['Informational', 'Navigational', 'Commercial', 'Transactional'];

  // Fetch keywords
  const { data: keywords = [], isLoading, isError, refetch } = useQuery<Keyword[]>({
    queryKey: ['keywords', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return [];
      const res = await fetch(`/api/keywords?projectId=${activeProjectId}`);
      if (!res.ok) throw new Error('Failed to fetch keywords');
      return res.json();
    },
    enabled: !!activeProjectId
  });

  // Reset pagination when searching or changing filters
  useEffect(() => {
    setCurrentPage(1);
    setJumpPageVal('');
  }, [searchTerm, syncFilter]);

  // Mutation to update keyword configurations
  const updateKeywordMutation = useMutation({
    mutationFn: async (payload: { id: string; is_excluded?: boolean; category?: string; intent?: string }) => {
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to update keyword');
      return res.json();
    },
    onSuccess: (updatedKeyword) => {
      // Invalidate keyword lists and dashboards
      queryClient.invalidateQueries({ queryKey: ['keywords', activeProjectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', activeProjectId] });
      toast.success(`Updated keyword configuration for "${updatedKeyword.keyword}"`);
    },
    onError: (err: any) => {
      toast.error(`Update failed: ${err.message}`);
    }
  });

  const handleToggleExclude = (id: string, currentExcluded: boolean) => {
    updateKeywordMutation.mutate({ id, is_excluded: !currentExcluded });
  };

  const handleChangeCategory = (id: string, newCategory: string) => {
    updateKeywordMutation.mutate({ id, category: newCategory });
  };

  const handleChangeIntent = (id: string, newIntent: string) => {
    updateKeywordMutation.mutate({ id, intent: newIntent });
  };

  if (!activeProjectId) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="h-12 w-12 text-slate-400 mb-4 animate-glow" />
        <h3 className="text-xl font-bold text-slate-800 mb-2">No Active Project Selected</h3>
        <p className="text-slate-500 text-sm max-w-sm mb-6">
          To manage keywords, please select or create a project in Settings first.
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
        <h3 className="text-xl font-bold text-slate-805 mb-1">Failed to load keywords</h3>
        <p className="text-slate-500 text-sm max-w-sm mb-6">
          There was an error retrieving the keyword database from local storage.
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

  // Filter keywords
  const filteredKeywords = keywords.filter((k: any) => {
    const matchesSearch = k.keyword.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSync = syncFilter === 'all' || k.is_updated_last_sync;
    return matchesSearch && matchesSync;
  });

  const totalKeywords = filteredKeywords.length;
  const totalPages = Math.max(1, Math.ceil(totalKeywords / pageSize));
  const paginatedKeywords = filteredKeywords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPageVal, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      setCurrentPage(parsed);
    } else {
      toast.error(`Please enter a page between 1 and ${totalPages}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
          Keywords Configuration
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Master query registry. Categorize keywords, define search intent, and exclude branded or spam terms.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search keywords database..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-slate-700 text-xs focus:border-indigo-500 focus:outline-none transition-all-200 shadow-sm"
            />
          </div>

          <select
            value={syncFilter}
            onChange={(e) => setSyncFilter(e.target.value as 'all' | 'updated')}
            className="h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs text-slate-750 outline-none focus:border-indigo-500 transition-all duration-150 shadow-sm cursor-pointer"
          >
            <option value="all">Show all registry keywords</option>
            <option value="updated">Show only updated in last sync</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-semibold">
          Total Keywords Tracked: <strong className="text-slate-800">{keywords.length}</strong>
        </div>
      </div>

      {/* Keywords Table */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {totalKeywords === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
              <h4 className="text-sm font-semibold text-slate-805 mb-1">No keywords found</h4>
              <p className="text-slate-400 text-xs max-w-sm">
                Try searching for another keyword or sync/seed your project database.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Keyword</th>
                  <th className="py-3.5 px-4">Country</th>
                  <th className="py-3.5 px-6">Category Rules</th>
                  <th className="py-3.5 px-6">Search Intent</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-center">Exclude</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedKeywords.map((kw) => (
                  <tr 
                    key={kw.id} 
                    className={`hover:bg-slate-50/30 transition-all-200 ${
                      kw.is_excluded ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Keyword */}
                    <td className="py-3 px-6 font-semibold text-slate-800">
                      <div>
                        <span>{kw.keyword}</span>
                        {(kw as any).is_updated_last_sync ? (
                          <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                            Last Sync ({(kw as any).last_updated}): Clicks: {(kw as any).last_clicks || 0}, Imps: {(kw as any).last_impressions || 0}, Pos: {((kw as any).last_position !== null && (kw as any).last_position !== undefined) ? (kw as any).last_position.toFixed(1) : '-'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                            No GSC traffic in last sync ({(kw as any).last_updated || 'N/A'})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Country */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-xs font-bold text-slate-600 shadow-sm">
                        {kw.country}
                      </span>
                    </td>

                    {/* Category Selection */}
                    <td className="py-3 px-6">
                      <div className="flex items-center space-x-1.5">
                        <Tag className="h-3.5 w-3.5 text-slate-400" />
                        <select
                          value={kw.category || 'Blog'}
                          onChange={e => handleChangeCategory(kw.id, e.target.value)}
                          className="h-8 bg-white border border-slate-200 hover:border-slate-350 rounded-lg px-2 text-xs text-slate-700 outline-none transition-all-200 shadow-sm"
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* Intent Selection */}
                    <td className="py-3 px-6">
                      <div className="flex items-center space-x-1.5">
                        <Compass className="h-3.5 w-3.5 text-slate-400" />
                        <select
                          value={kw.intent || 'Informational'}
                          onChange={e => handleChangeIntent(kw.id, e.target.value)}
                          className="h-8 bg-white border border-slate-200 hover:border-slate-350 rounded-lg px-2 text-xs text-slate-700 outline-none transition-all-200 shadow-sm"
                        >
                          {intents.map(int => (
                            <option key={int} value={int}>{int}</option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-6">
                      {kw.is_excluded ? (
                        <span className="inline-flex items-center space-x-1 rounded bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-750">
                          <EyeOff className="h-3 w-3" />
                          <span>Excluded</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-750">
                          <Eye className="h-3 w-3" />
                          <span>Active</span>
                        </span>
                      )}
                    </td>

                    {/* Exclude Toggle Button */}
                    <td className="py-3 px-6 text-center">
                      <button
                        onClick={() => handleToggleExclude(kw.id, kw.is_excluded)}
                        className={`h-8 px-3 rounded-lg text-xs font-bold border transition-all-200 shadow-sm ${
                          kw.is_excluded
                            ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                            : 'bg-red-50 hover:bg-red-100/60 text-red-650 border-red-200'
                        }`}
                      >
                        {kw.is_excluded ? 'Include' : 'Exclude'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Sticky Table Footer / Pagination */}
        {totalKeywords > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="text-xs text-slate-500">
              Showing <strong className="text-slate-800">{(currentPage - 1) * pageSize + 1}</strong> to <strong className="text-slate-800">{Math.min(currentPage * pageSize, totalKeywords)}</strong> of <strong className="text-slate-800">{totalKeywords}</strong> terms
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(c => c - 1)}
                  className="h-8 w-8 bg-white hover:bg-slate-50 disabled:opacity-30 border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 transition-all-200 shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="px-3 text-xs text-slate-650 font-semibold">
                  Page {currentPage} of {totalPages}
                </div>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(c => c + 1)}
                  className="h-8 w-8 bg-white hover:bg-slate-50 disabled:opacity-30 border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 transition-all-200 shadow-sm"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Jump to page */}
              <form onSubmit={handlePageJump} className="flex items-center space-x-1.5">
                <span className="text-xs text-slate-400">Go:</span>
                <input
                  type="text"
                  value={jumpPageVal}
                  onChange={e => setJumpPageVal(e.target.value)}
                  className="h-8 w-12 bg-white border border-slate-200 rounded-lg text-center text-slate-700 text-xs outline-none focus:border-indigo-500 shadow-sm"
                  placeholder={currentPage.toString()}
                />
                <button
                  type="submit"
                  className="h-8 px-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 text-xs font-semibold rounded-lg shadow-sm transition-all-200"
                >
                  Jump
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
