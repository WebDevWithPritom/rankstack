'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useProject } from '@/context/ProjectContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Plus, Trash2, Link2, RefreshCw, Play, AlertTriangle, 
  CheckCircle, Database, HelpCircle, ArrowRightLeft, ShieldAlert,
  History
} from 'lucide-react';

// Form validation schema
const projectSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  domain: z.string().min(4, 'Domain or property URL is required')
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { 
    projects, activeProject, activeProjectId, 
    setActiveProjectId, refetchProjects 
  } = useProject();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema)
  });

  // Query integration status
  const { data: integrations = [], refetch: refetchIntegrations } = useQuery({
    queryKey: ['integrations', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return [];
      const res = await fetch(`/api/integrations?projectId=${activeProjectId}`);
      if (!res.ok) throw new Error('Failed to fetch integrations');
      return res.json() as Promise<Array<{ type: string; is_active: boolean; has_credentials: boolean }>>;
    },
    enabled: !!activeProjectId
  });

  // Query backfill status
  const { data: backfillJob, refetch: refetchBackfill } = useQuery({
    queryKey: ['backfill', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      const res = await fetch(`/api/sync/gsc/backfill?projectId=${activeProjectId}`);
      if (!res.ok) throw new Error('Failed to fetch backfill');
      return res.json();
    },
    enabled: !!activeProjectId
  });

  const gscIntegration = integrations.find(i => i.type === 'gsc');
  const isGscConnected = gscIntegration?.has_credentials && gscIntegration?.is_active;

  // Handle URL callback params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('gsc_success')) {
        toast.success('Google Search Console connected successfully!');
        refetchIntegrations();
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (params.get('gsc_error')) {
        toast.error(`GSC Connection failed: ${params.get('gsc_error')}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [refetchIntegrations]);

  // Mutations
  const createProjectMutation = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create project');
      }
      return res.json();
    },
    onSuccess: (newProj) => {
      toast.success('Project created successfully!');
      reset();
      refetchProjects();
      setActiveProjectId(newProj.id);
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  // Backfill runner step loop
  const backfillStepMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/sync/gsc/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, action: 'step' })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Backfill step failed');
      }
      return res.json();
    },
    onSuccess: (updatedJob) => {
      refetchBackfill();
      queryClient.invalidateQueries({ queryKey: ['dashboard', activeProjectId] });
      
      if (updatedJob.status === 'completed') {
        toast.success('Historical backfill completed! Running final 7-day sync to populate recent data...');
        // Auto-run a 7-day sync so 24H/7D windows are populated with the latest GSC data
        fetch('/api/sync/gsc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: activeProjectId, mode: '7d', days: 7 })
        }).then(async (res) => {
          if (res.ok) {
            toast.success('Recent data sync complete! Dashboard is now fully up to date.');
            queryClient.invalidateQueries({ queryKey: ['dashboard', activeProjectId] });
          }
        }).catch(() => {
          // Non-critical: user can manually sync
        });
      } else if (updatedJob.status === 'running') {
        backfillStepMutation.mutate();
      }
    },
    onError: (err: any) => {
      toast.error(`Backfill step failed: ${err.message}. Stopped.`);
      refetchBackfill();
    }
  });

  // Trigger sync modes
  const handleSync = async (mode: string) => {
    if (!activeProjectId) return;
    setIsSyncing(mode);
    const toastId = toast.loading(`Running GSC Sync (${mode})...`);
    try {
      const res = await fetch('/api/sync/gsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, mode })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Sync failed');
      }
      const data = await res.json();
      toast.success(data.message || 'Sync complete!', { id: toastId });
      queryClient.invalidateQueries({ queryKey: ['dashboard', activeProjectId] });
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`, { id: toastId });
    } finally {
      setIsSyncing(null);
    }
  };

  const handleRebuildRollups = async () => {
    if (!activeProjectId) return;
    setIsSyncing('rebuild');
    const toastId = toast.loading('Rebuilding rollups from ranking database...');
    try {
      const res = await fetch('/api/sync/rollups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId })
      });
      if (!res.ok) throw new Error('Rebuild failed');
      const data = await res.json();
      toast.success(`Success! Recomputed ${data.rollupsCount} rollups and logged ${data.changesCount} change entries.`, { id: toastId });
      queryClient.invalidateQueries({ queryKey: ['dashboard', activeProjectId] });
    } catch (err: any) {
      toast.error(`Rebuild failed: ${err.message}`, { id: toastId });
    } finally {
      setIsSyncing(null);
    }
  };

  const handleCheckGSC = async () => {
    if (!activeProjectId) return;
    setIsSyncing('verify');
    const toastId = toast.loading('Querying Google Search Console property totals to verify database matching...');
    try {
      const res = await fetch(`/api/sync/gsc/verify?projectId=${activeProjectId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Verification request failed');
      }
      const data = await res.json();
      
      const detailsMsg = `GSC Clicks: ${data.gscClicks} | Local Clicks: ${data.dbClicks} (Diff: ${data.diffClicksPercent}%)
GSC Impressions: ${data.gscImpressions} | Local Impressions: ${data.dbImpressions} (Diff: ${data.diffImpressionsPercent}%)`;

      if (data.isWithinTolerance) {
        toast.success(`Data Match Verified! Totals are within 2% margin.`, { 
          id: toastId,
          description: detailsMsg,
          duration: 6005
        });
      } else {
        toast.warning(`Verification Complete. Data matches with discrepancy.`, { 
          id: toastId,
          description: detailsMsg,
          duration: 6005
        });
      }
    } catch (err: any) {
      toast.error(`Verification failed: ${err.message}`, { id: toastId });
    } finally {
      setIsSyncing(null);
    }
  };

  const handleBackfillAction = async (action: 'start' | 'cancel') => {
    if (!activeProjectId) return;
    try {
      const res = await fetch('/api/sync/gsc/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, action })
      });
      if (!res.ok) throw new Error('Action failed');
      const job = await res.json();
      refetchBackfill();

      if (action === 'start') {
        toast.success('Resumable historical backfill started.');
        backfillStepMutation.mutate();
      } else {
        toast.success('Historical backfill cancelled.');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteProject = async () => {
    if (!activeProjectId) return;
    if (!window.confirm('WARNING: Deleting this project will permanently remove all keywords, rankings, and rollup logs. This cannot be undone. Do you wish to proceed?')) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects?id=${activeProjectId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Deletion failed');
      toast.success('Project deleted successfully.');
      refetchProjects();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSeedDemo = async () => {
    setIsSeeding(true);
    const toastId = toast.loading('Seeding realistic SEO project rankings (last 90 days)...');
    try {
      const res = await fetch('/api/demo/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Seeding failed');
      const data = await res.json();
      toast.success('Demo project seeded successfully!', { id: toastId });
      refetchProjects();
      setActiveProjectId(data.projectId);
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleConnectGSC = () => {
    if (!activeProjectId) return;
    window.location.href = `/api/integrations/gsc/connect?projectId=${activeProjectId}`;
  };

  const handleDisconnectGSC = async () => {
    if (!activeProjectId) return;
    if (!window.confirm('Disconnect Google Search Console? This will remove tokens, but keep currently imported rankings.')) return;
    try {
      const res = await fetch(`/api/integrations?projectId=${activeProjectId}&type=gsc`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Disconnect failed');
      toast.success('GSC integration disconnected.');
      refetchIntegrations();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
          Settings & Integrations
        </h1>
        <p className="text-slate-550 text-sm mt-1">
          Manage SEO projects, integrations, Google Search Console sync operations, and data seeding.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Project Management */}
        <div className="space-y-8 lg:col-span-1">
          
          {/* Create Project Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-md font-bold text-slate-800 flex items-center space-x-2">
              <Plus className="h-5 w-5 text-indigo-500" />
              <span>Create New Project</span>
            </h2>
            <form onSubmit={handleSubmit(val => createProjectMutation.mutate(val))} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. WPoets Main"
                  {...register('name')}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm focus:border-indigo-500 focus:outline-none transition-all-200 shadow-sm"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Domain or GSC Property URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://www.wpoets.com/"
                  {...register('domain')}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm focus:border-indigo-500 focus:outline-none transition-all-200 shadow-sm"
                />
                {errors.domain && <p className="text-red-500 text-xs mt-1">{errors.domain.message}</p>}
                <p className="text-[10px] text-slate-400 mt-1 leading-normal font-medium">
                  Must exactly match GSC configuration (include protocol/trailing slash).
                </p>
              </div>

              <button
                type="submit"
                disabled={createProjectMutation.isPending}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-100 transition-all-200 flex items-center justify-center space-x-1.5"
              >
                <span>Add Project</span>
              </button>
            </form>
          </div>

          {/* Delete Project Card */}
          {activeProject && (
            <div className="bg-red-50/30 border border-red-200/60 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-md font-bold text-red-700 flex items-center space-x-2">
                <Trash2 className="h-5 w-5" />
                <span>Delete Project</span>
              </h2>
              <p className="text-slate-600 text-xs leading-normal">
                Currently Selected: <strong className="text-slate-800">{activeProject.name}</strong> ({activeProject.domain})
              </p>
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className="w-full h-10 bg-red-100/30 hover:bg-red-100/50 text-red-650 hover:text-red-800 border border-red-200/50 font-semibold text-sm rounded-xl transition-all-200 flex items-center justify-center"
              >
                {isDeleting ? 'Deleting...' : 'Delete Project & All Data'}
              </button>
            </div>
          )}

          {/* Seed Demo Data Card */}
          <div className="bg-purple-50/20 border border-purple-200/60 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-md font-bold text-purple-750 flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Sandbox Demo Data</span>
            </h2>
            <p className="text-slate-600 text-xs leading-normal">
              No GSC property ready? Seed a simulation of <strong>wpoets.com</strong> with 90 days of random rankings, clicks, and impressions.
            </p>
            <button
              onClick={handleSeedDemo}
              disabled={isSeeding}
              className="w-full h-10 bg-purple-100/40 hover:bg-purple-100/70 text-purple-750 hover:text-purple-900 border border-purple-200/50 font-semibold text-sm rounded-xl transition-all-200 flex items-center justify-center"
            >
              {isSeeding ? 'Seeding...' : 'Seed Demo Data'}
            </button>
          </div>

        </div>

        {/* Right Columns: Integrations, Syncs and Backfill */}
        <div className="space-y-8 lg:col-span-2">
          {activeProject ? (
            <>
              {/* Google Search Console connection card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-md font-bold text-slate-800 flex items-center space-x-2">
                      <Link2 className="h-5 w-5 text-indigo-500" />
                      <span>Google Search Console Integration</span>
                    </h2>
                    <p className="text-slate-500 text-xs mt-1">Connect your project with Google OAuth webmasters readonly API.</p>
                  </div>
                  {isGscConnected ? (
                    <span className="flex items-center space-x-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700 font-bold shadow-sm animate-in fade-in duration-300">
                      <CheckCircle className="h-3 w-3" />
                      <span>Connected</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700 font-bold shadow-sm">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Disconnected</span>
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-3 text-xs">
                  <div className="flex justify-between items-center text-slate-650">
                    <span>Target Domain Property:</span>
                    <span className="text-slate-800 font-mono font-bold">{activeProject.domain}</span>
                  </div>
                </div>

                <div className="flex space-x-3">
                  {isGscConnected ? (
                    <button
                      onClick={handleDisconnectGSC}
                      className="h-10 px-4 bg-white hover:bg-slate-50 text-red-600 border border-slate-250 rounded-xl text-sm font-semibold shadow-sm transition-all-200"
                    >
                      Disconnect API
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectGSC}
                      className="h-10 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-100 transition-all-200 flex items-center space-x-2"
                    >
                      <Link2 className="h-4 w-4" />
                      <span>Connect GSC Property</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sync Operations Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
                <div>
                  <h2 className="text-md font-bold text-slate-800 flex items-center space-x-2">
                    <RefreshCw className="h-5 w-5 text-indigo-500" />
                    <span>Sync Operations</span>
                  </h2>
                  <p className="text-slate-500 text-xs mt-1">Trigger manual database synchronizations and total data audits.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* GSC API Sync Buttons */}
                  <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 border border-slate-200/60">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sync with GSC API</h3>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleSync('quick')}
                        disabled={isSyncing !== null || !isGscConnected}
                        className="h-9 px-3 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-all-200 flex items-center justify-between shadow-sm"
                      >
                        <span>Quick Sync (7 Days)</span>
                        <Play className="h-3 w-3 text-slate-400" />
                      </button>
                      <button
                        onClick={() => handleSync('24h')}
                        disabled={isSyncing !== null || !isGscConnected}
                        className="h-9 px-3 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-all-200 flex items-center justify-between shadow-sm"
                      >
                        <span>Sync 24 Hours</span>
                        <Play className="h-3 w-3 text-slate-400" />
                      </button>
                      <button
                        onClick={() => handleSync('90d')}
                        disabled={isSyncing !== null || !isGscConnected}
                        className="h-9 px-3 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-all-200 flex items-center justify-between shadow-sm"
                      >
                        <span>Sync 90 Days</span>
                        <Play className="h-3 w-3 text-slate-400" />
                      </button>
                    </div>
                  </div>

                  {/* Calculations and Audits */}
                  <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 border border-slate-200/60">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Calculations & Verification</h3>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleRebuildRollups}
                        disabled={isSyncing !== null}
                        className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-all-200 flex items-center justify-between shadow-sm"
                      >
                        <span>Rebuild Keyword Rollups</span>
                        <Database className="h-3 w-3 text-slate-400" />
                      </button>
                      <button
                        onClick={handleCheckGSC}
                        disabled={isSyncing !== null || !isGscConnected}
                        className="h-9 px-3 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-all-200 flex items-center justify-between shadow-sm"
                      >
                        <span>Check vs GSC (Verify Totals)</span>
                        <ArrowRightLeft className="h-3 w-3 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Historical GSC Backfill */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
                <div>
                  <h2 className="text-md font-bold text-slate-800 flex items-center space-x-2">
                    <History className="h-5 w-5 text-indigo-500" />
                    <span>Historical GSC Backfill (~16 Months + Current)</span>
                  </h2>
                  <p className="text-slate-550 text-xs mt-1">
                    Imports full search analytics history month-by-month (16 past months + current partial month) in a resumable sequence. After completion, a 7-day sync runs automatically to ensure 24H data is live.
                  </p>
                </div>

                {backfillJob ? (
                  <div className="space-y-4">
                    {/* Progress details */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">
                        Status: <strong className="text-slate-805 capitalize">{backfillJob.status}</strong>
                      </span>
                      <span className="text-indigo-650 font-bold">
                        {backfillJob.months_done} / {backfillJob.total_months} months
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${(backfillJob.months_done / backfillJob.total_months) * 100}%` }}
                      />
                    </div>

                    {/* Next step details */}
                    {backfillJob.status === 'running' && (
                      <div className="flex items-center space-x-2 text-xs text-indigo-600">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>Currently importing: {backfillJob.next_month}</span>
                      </div>
                    )}

                    {backfillJob.status === 'failed' && (
                      <div className="flex items-center space-x-1.5 text-xs text-red-650">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>Sync failed on {backfillJob.next_month}. Click Resume to retry.</span>
                      </div>
                    )}

                    {/* Control Buttons */}
                    <div className="flex space-x-3">
                      {backfillJob.status === 'running' ? (
                        <button
                          onClick={() => handleBackfillAction('cancel')}
                          className="h-9 px-4 bg-red-50 text-red-650 border border-red-200 rounded-xl text-xs font-semibold shadow-sm transition-all-200"
                        >
                          Cancel / Pause
                        </button>
                      ) : backfillJob.status === 'completed' ? (
                        <button
                          onClick={() => handleBackfillAction('start')}
                          className="h-9 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-sm transition-all-200"
                        >
                          Restart Backfill
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBackfillAction('start')}
                          disabled={!isGscConnected}
                          className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-100 transition-all-200"
                        >
                          Resume Backfill
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-xs text-slate-550 leading-normal font-medium">
                      No backfill job initialized. Starting a backfill will schedule a step-by-step query import for the past 16 months + the current partial month, followed by an automatic 7-day sync to populate 24H data.
                    </div>
                    <button
                      onClick={() => handleBackfillAction('start')}
                      disabled={!isGscConnected}
                      className="h-10 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-100 transition-all-200"
                    >
                      Start Historical Backfill
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px] shadow-sm">
              <AlertTriangle className="h-12 w-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-bold text-slate-805 mb-1">No Active Project Selected</h3>
              <p className="text-slate-500 text-sm max-w-sm leading-normal">
                Create a new project using the panel on the left or seed the demo data to start tracking keywords.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
