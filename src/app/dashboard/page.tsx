'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, ReferenceArea, ReferenceLine,
  ReferenceDot, PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, TrendingDown, RefreshCw, Download, Search, 
  ExternalLink, ChevronLeft, ChevronRight, HelpCircle, AlertCircle,
  Filter, Calendar, Smartphone, Laptop, Tablet, Monitor, Grid,
  Plus, Trash2, Sparkles, CheckCircle2, Globe, Activity, FileText,
  Info, Eye, Sliders, AlertTriangle
} from 'lucide-react';
import DateRangePicker, { DateRange, defaultDateRange } from '@/components/DateRangePicker';

// Custom GSC Guardian-style Tooltip Component
const CustomChartTooltip = ({ active, payload, label, googleUpdates = [], annotations = [] }: any) => {
  if (!active || !payload || !payload.length) return null;

  // Find active google updates and annotations for this date
  const activeUpdates = googleUpdates.filter((upd: any) => 
    label >= upd.startDate && label <= (upd.endDate || upd.startDate)
  );
  
  const activeAnnotations = annotations.filter((ann: any) => 
    ann.date === label
  );

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xl min-w-[240px] text-xs space-y-3.5 font-sans animate-in fade-in zoom-in-95 duration-100">
      <div className="font-bold text-slate-800 border-b border-slate-100 pb-2 flex justify-between items-center">
        <span>{label}</span>
      </div>
      
      <div className="space-y-2">
        {payload.map((item: any) => {
          let valStr = item.value;
          if (item.name.toLowerCase().includes('ctr')) {
            valStr = `${(Number(item.value) * 100).toFixed(2)}%`;
          } else if (item.name.toLowerCase().includes('position')) {
            valStr = Number(item.value).toFixed(1);
          } else if (typeof item.value === 'number') {
            valStr = item.value.toLocaleString();
          }

          return (
            <div key={item.dataKey} className="flex justify-between items-center space-x-6">
              <div className="flex items-center space-x-2 text-slate-600 font-medium">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.stroke }} />
                <span>{item.name}</span>
              </div>
              <span className="font-bold text-slate-900">{valStr}</span>
            </div>
          );
        })}
      </div>

      {(activeUpdates.length > 0 || activeAnnotations.length > 0) && (
        <div className="border-t border-slate-100 pt-2.5 space-y-2">
          {activeUpdates.map((upd: any) => (
            <div key={upd.id} className="bg-red-50/60 border border-red-100 text-red-700 rounded-xl p-2.5 flex flex-col gap-1 shadow-sm">
              <span className="font-bold flex items-center gap-1.5 text-[11px]">
                <span className="text-red-500">📢</span> {upd.name}
              </span>
              <span className="text-[10px] text-red-650 leading-relaxed font-semibold">
                {upd.description}
              </span>
            </div>
          ))}
          {activeAnnotations.map((ann: any) => (
            <div key={ann.id} className="bg-indigo-50/60 border border-indigo-100 text-indigo-700 rounded-xl p-2.5 flex flex-col gap-1 shadow-sm">
              <span className="font-bold flex items-center gap-1.5 text-[11px]">
                <span className="text-indigo-500">📌</span> Annotation: {ann.title}
              </span>
              {ann.description && (
                <span className="text-[10px] text-indigo-650 leading-relaxed font-semibold">
                  {ann.description}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const formatCompactNumber = (val: number) => {
  if (val >= 1000000) {
    return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (val >= 1000) {
    return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return val.toString();
};

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { activeProjectId, activeProject } = useProject();

  // Metric states (GSC-style toggles)
  const [showClicks, setShowClicks] = useState<boolean>(true);
  const [showImpressions, setShowImpressions] = useState<boolean>(true);
  const [showCtr, setShowCtr] = useState<boolean>(false);
  const [showPosition, setShowPosition] = useState<boolean>(false);

  // Filter states
  const [dateRange, setDateRange] = useState<DateRange>(() => defaultDateRange());
  const days = dateRange.days; // alias for parts of code still using days
  const [country, setCountry] = useState<string>('All');
  const [category, setCategory] = useState<string>('All');
  const [hideExcluded, setHideExcluded] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Advanced GSC filter comparison states
  const [filterMode, setFilterMode] = useState<'single' | 'compare'>('single');
  const [compareFilterType, setCompareFilterType] = useState<'none' | 'query' | 'page' | 'country' | 'device'>('none');
  const [compareValueA, setCompareValueA] = useState<string>('');
  const [compareValueB, setCompareValueB] = useState<string>('');
  const [compareOperator, setCompareOperator] = useState<string>('contains');

  // Advanced filters drawer
  const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
  const [queryFilter, setQueryFilter] = useState<string>('');
  const [queryFilterType, setQueryFilterType] = useState<string>('contains');
  const [pageFilter, setPageFilter] = useState<string>('');
  const [pageFilterType, setPageFilterType] = useState<string>('contains');
  const [deviceFilter, setDeviceFilter] = useState<string>('All');
  const [searchType, setSearchType] = useState<string>('Web');
  const [compareMode, setCompareMode] = useState<boolean>(true);

  // Debounced versions of text filters (350ms delay — prevents API call on every keystroke)
  const [debouncedQueryFilter, setDebouncedQueryFilter] = useState<string>('');
  const [debouncedPageFilter, setDebouncedPageFilter] = useState<string>('');
  const [debouncedCompareValueA, setDebouncedCompareValueA] = useState<string>('');
  const [debouncedCompareValueB, setDebouncedCompareValueB] = useState<string>('');

  useEffect(() => { const t = setTimeout(() => setDebouncedQueryFilter(queryFilter), 350); return () => clearTimeout(t); }, [queryFilter]);
  useEffect(() => { const t = setTimeout(() => setDebouncedPageFilter(pageFilter), 350); return () => clearTimeout(t); }, [pageFilter]);
  useEffect(() => { const t = setTimeout(() => setDebouncedCompareValueA(compareValueA), 350); return () => clearTimeout(t); }, [compareValueA]);
  useEffect(() => { const t = setTimeout(() => setDebouncedCompareValueB(compareValueB), 350); return () => clearTimeout(t); }, [compareValueB]);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'queries' | 'pages' | 'countries' | 'devices' | 'appearances' | 'days' | 'cannibalization' | 'inspection' | 'changes'>('queries');

  // Annotation states
  const [isAnnotationModalOpen, setIsAnnotationModalOpen] = useState<boolean>(false);
  const [selectedDateForAnnotation, setSelectedDateForAnnotation] = useState<string>('');
  const [annotationTitle, setAnnotationTitle] = useState<string>('');
  const [annotationDescription, setAnnotationDescription] = useState<string>('');
  const [annotationKeyword, setAnnotationKeyword] = useState<string>('');
  const [annotationUrl, setAnnotationUrl] = useState<string>('');

  // Google Core Update modal state
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [selectedGoogleUpdate, setSelectedGoogleUpdate] = useState<any>(null);

  // URL Inspection states
  const [inspectUrlInput, setInspectUrlInput] = useState<string>('');
  const [inspectionResult, setInspectionResult] = useState<any>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);

  // AI SEO Insights states
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);

  // Table pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jumpPageVal, setJumpPageVal] = useState<string>('');
  const pageSize = 15;

  // Table sorting states
  const [sortField, setSortField] = useState<string>('clicks');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // SSR mount guard
  const [isMounted, setIsMounted] = useState<boolean>(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Quick sync mutation
  const [isQuickSyncing, setIsQuickSyncing] = useState<boolean>(false);

  // Fetch Sync Status
  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      const res = await fetch(`/api/sync/status?projectId=${activeProjectId}`);
      if (!res.ok) throw new Error('Failed to fetch status');
      return res.json();
    },
    enabled: !!activeProjectId,
    refetchInterval: 15000
  });

  // Fetch Dashboard aggregate data
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: [
      'dashboard', 
      activeProjectId, 
      dateRange.startDate,
      dateRange.endDate,
      country, 
      category, 
      hideExcluded,
      debouncedQueryFilter,
      queryFilterType,
      debouncedPageFilter,
      pageFilterType,
      deviceFilter,
      compareMode,
      searchType,
      filterMode,
      compareFilterType,
      debouncedCompareValueA,
      debouncedCompareValueB,
      compareOperator
    ],
    queryFn: async () => {
      if (!activeProjectId) return null;
      let url = `/api/dashboard?projectId=${activeProjectId}&days=${days}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&country=${country}&category=${category}&hideExcluded=${hideExcluded}&queryFilter=${encodeURIComponent(debouncedQueryFilter)}&queryFilterType=${queryFilterType}&pageFilter=${encodeURIComponent(debouncedPageFilter)}&pageFilterType=${pageFilterType}&deviceFilter=${deviceFilter}&compareMode=${compareMode}&searchType=${searchType}`;
      
      if (filterMode === 'compare' && compareFilterType !== 'none') {
        url += `&compareFilterType=${compareFilterType}&compareValueA=${encodeURIComponent(debouncedCompareValueA)}&compareValueB=${encodeURIComponent(debouncedCompareValueB)}&compareOperator=${compareOperator}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      return res.json();
    },
    enabled: !!activeProjectId,
    // Keep serving the previous dataset instantly while background refresh runs
    placeholderData: keepPreviousData,
    // Cache each unique filter combination for 5 minutes
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Destructure GSC data with default values to avoid errors before load completes
  const { 
    compareMode: isApiCompareMode = false, 
    compareFilterType: apiCompareFilterType = 'none', 
    compareValueA: apiCompareValueA = '', 
    compareValueB: apiCompareValueB = '', 
    kpis = {
      clicks: 0, priorClicks: 0, clicksDiff: 0, clicksDiffPercent: 0,
      impressions: 0, priorImpressions: 0, impressionsDiff: 0, impressionsDiffPercent: 0,
      ctr: 0, priorCtr: 0, ctrDiff: 0, position: 0, priorPosition: 0, positionDiff: 0,
      clicksB: 0, impressionsB: 0, ctrB: 0, positionB: 0
    }, 
    chartData = [], 
    keywords = [], 
    pages = [], 
    countries = [], 
    devices = [], 
    searchAppearances = [], 
    days: dailyLogs = [], 
    cannibalized = [], 
    brandedSplit = {}, 
    googleUpdates = [], 
    annotations: serverAnnotations = [], 
    countriesList = [], 
    asOfDate = '',
    recentlyUpdatedKeywords = []
  } = data || {};

  // Local storage annotations sync
  const [localAnnotations, setLocalAnnotations] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && activeProjectId) {
      const stored = localStorage.getItem(`rankstack_annotations_${activeProjectId}`);
      if (stored) {
        try {
          setLocalAnnotations(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse local annotations', e);
        }
      } else {
        setLocalAnnotations([]);
      }
    }
  }, [activeProjectId]);

  const annotations = useMemo(() => {
    const map = new Map<string, any>();
    serverAnnotations.forEach((ann: any) => {
      map.set(ann.id, ann);
    });
    localAnnotations.forEach((ann: any) => {
      map.set(ann.id, ann);
    });
    return Array.from(map.values());
  }, [serverAnnotations, localAnnotations]);

  const rightMargin = useMemo(() => {
    return 10 + 
      (showImpressions ? 45 : 0) + 
      (showCtr ? 45 : 0) + 
      (showPosition ? 40 : 0);
  }, [showImpressions, showCtr, showPosition]);

  const leftOffset = useMemo(() => {
    return 10 + (showClicks ? 40 : 0);
  }, [showClicks]);

  const activeYAxisId = useMemo(() => {
    if (showClicks) return "left";
    if (showImpressions) return "right";
    if (showCtr) return "ctr";
    return "pos";
  }, [showClicks, showImpressions, showCtr, showPosition]);

  const visibleUpdates = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    const minDate = chartData[0].date;
    const maxDate = chartData[chartData.length - 1].date;
    return googleUpdates.filter((upd: any) => 
      upd.startDate <= maxDate && (!upd.endDate || upd.endDate >= minDate)
    );
  }, [chartData, googleUpdates]);

  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

  // Get active tab elements
  let activeTabItems: any[] = [];
  if (activeTab === 'queries') activeTabItems = keywords;
  else if (activeTab === 'pages') activeTabItems = pages;
  else if (activeTab === 'countries') activeTabItems = countries;
  else if (activeTab === 'devices') activeTabItems = devices;
  else if (activeTab === 'appearances') activeTabItems = searchAppearances;
  else if (activeTab === 'days') activeTabItems = dailyLogs;
  else if (activeTab === 'cannibalization') activeTabItems = cannibalized;
  else if (activeTab === 'changes') activeTabItems = recentlyUpdatedKeywords;

  // Search input client filter
  const filteredTabItems = activeTabItems.filter((item: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    if (activeTab === 'queries') return item.keyword?.toLowerCase().includes(term);
    if (activeTab === 'pages') return item.ranking_url?.toLowerCase().includes(term);
    if (activeTab === 'countries') return item.code?.toLowerCase().includes(term);
    if (activeTab === 'devices' || activeTab === 'appearances') return item.name?.toLowerCase().includes(term);
    if (activeTab === 'days') return item.date?.toLowerCase().includes(term);
    if (activeTab === 'cannibalization') return item.keyword?.toLowerCase().includes(term);
    if (activeTab === 'changes') return item.keyword?.toLowerCase().includes(term);
    return true;
  });

  // Sorting helper
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort tab items
  const sortedTabItems = useMemo(() => {
    if (!sortField) return filteredTabItems;
    return [...filteredTabItems].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle specific mappings
      if (sortField === 'keyword' && activeTab === 'queries') {
        valA = a.keyword || '';
        valB = b.keyword || '';
      } else if (sortField === 'ranking_url' && activeTab === 'pages') {
        valA = a.ranking_url || '';
        valB = b.ranking_url || '';
      } else if (sortField === 'code' && activeTab === 'countries') {
        valA = a.code || '';
        valB = b.code || '';
      } else if (sortField === 'name' && (activeTab === 'devices' || activeTab === 'appearances')) {
        valA = a.name || '';
        valB = b.name || '';
      } else if (sortField === 'date' && activeTab === 'days') {
        valA = a.date || '';
        valB = b.date || '';
      } else if (sortField === 'keyword' && activeTab === 'cannibalization') {
        valA = a.keyword || '';
        valB = b.keyword || '';
      } else if (sortField === 'keyword' && activeTab === 'changes') {
        valA = a.keyword || '';
        valB = b.keyword || '';
      }

      // Handle undefined / null
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      // Handle numbers vs strings
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
    });
  }, [filteredTabItems, sortField, sortDirection, activeTab]);

  const totalTabItems = sortedTabItems.length;
  const totalPages = Math.max(1, Math.ceil(totalTabItems / pageSize));
  const paginatedTabItems = sortedTabItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
    setJumpPageVal('');
  }, [days, country, category, hideExcluded, searchTerm, queryFilter, pageFilter, deviceFilter, activeTab]);

  // Switch away from cannibalization tab if compare mode is active
  useEffect(() => {
    if (isApiCompareMode && activeTab === 'cannibalization') {
      setActiveTab('queries');
    }
  }, [isApiCompareMode, activeTab]);

  // Set default sorting field when activeTab changes
  useEffect(() => {
    if (activeTab === 'days') {
      setSortField('date');
      setSortDirection('desc');
    } else if (activeTab === 'queries') {
      setSortField('clicks');
      setSortDirection('desc');
    } else if (activeTab === 'pages') {
      setSortField('clicks');
      setSortDirection('desc');
    } else if (activeTab === 'countries') {
      setSortField('clicks');
      setSortDirection('desc');
    } else if (activeTab === 'devices') {
      setSortField('clicks');
      setSortDirection('desc');
    } else if (activeTab === 'appearances') {
      setSortField('clicks');
      setSortDirection('desc');
    } else if (activeTab === 'cannibalization') {
      setSortField('clicks');
      setSortDirection('desc');
    } else if (activeTab === 'changes') {
      setSortField('change');
      setSortDirection('desc');
    } else {
      setSortField('');
      setSortDirection('desc');
    }
  }, [activeTab]);

  // Quick Sync Handler
  const handleQuickSync = async () => {
    if (!activeProjectId) return;
    setIsQuickSyncing(true);
    const toastId = toast.loading('Running Quick Sync (last 7 days)...');
    try {
      const res = await fetch('/api/sync/gsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, mode: 'quick' })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Sync failed');
      }
      toast.success('Quick Sync completed successfully!', { id: toastId });
      refetch();
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`, { id: toastId });
    } finally {
      setIsQuickSyncing(false);
    }
  };

  // Create Annotation Handler
  const handleAddAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annotationTitle || !selectedDateForAnnotation) {
      toast.error('Please enter a Title and Date');
      return;
    }
    const toastId = toast.loading('Adding annotation...');
    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProjectId,
          date: selectedDateForAnnotation,
          title: annotationTitle,
          description: annotationDescription,
          keyword_id: annotationKeyword || undefined,
          ranking_url: annotationUrl || undefined
        })
      });
      if (!res.ok) throw new Error('Failed to save annotation');
      
      // Save locally as backup / stateless persistence
      try {
        const savedAnn = await res.json();
        const updatedLocal = [...localAnnotations, savedAnn];
        setLocalAnnotations(updatedLocal);
        localStorage.setItem(`rankstack_annotations_${activeProjectId}`, JSON.stringify(updatedLocal));
      } catch (err) {
        console.error('Failed to sync to local storage:', err);
      }

      toast.success('Annotation saved!', { id: toastId });
      setIsAnnotationModalOpen(false);
      setAnnotationTitle('');
      setAnnotationDescription('');
      setAnnotationKeyword('');
      setAnnotationUrl('');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Error saving annotation', { id: toastId });
    }
  };

  // Delete Annotation Handler
  const handleDeleteAnnotation = async (annId: string) => {
    if (!confirm('Are you sure you want to delete this annotation?')) return;
    const toastId = toast.loading('Deleting annotation...');
    try {
      const res = await fetch(`/api/annotations?projectId=${activeProjectId}&id=${annId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete annotation');

      // Delete locally
      try {
        const updatedLocal = localAnnotations.filter((a: any) => a.id !== annId);
        setLocalAnnotations(updatedLocal);
        localStorage.setItem(`rankstack_annotations_${activeProjectId}`, JSON.stringify(updatedLocal));
      } catch (err) {
        console.error('Failed to delete from local storage:', err);
      }

      toast.success('Annotation deleted!', { id: toastId });
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Error deleting annotation', { id: toastId });
    }
  };

  // Run GSC URL Inspection
  const handleUrlInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectUrlInput) return;
    setIsInspecting(true);
    const toastId = toast.loading('Querying Google Search Console URL Inspection API...');
    try {
      const res = await fetch('/api/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProjectId,
          url: inspectUrlInput
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to inspect URL');
      }
      const data = await res.json();
      setInspectionResult(data.inspectionResult);
      toast.success('URL Audit completed!', { id: toastId });
    } catch (err: any) {
      toast.error(`Inspection failed: ${err.message}`, { id: toastId });
    } finally {
      setIsInspecting(false);
    }
  };

  // Generate AI Insights with Gemini
  const handleGenerateAIInsights = async () => {
    setIsGeneratingAI(true);
    const toastId = toast.loading('Requesting Gemini Deep SEO Analysis...');
    try {
      const res = await fetch(`/api/ai/insights?projectId=${activeProjectId}&days=${days}`);
      if (!res.ok) throw new Error('Failed to generate insights');
      const data = await res.json();
      setAiInsights(data.insights || []);
      toast.success('AI SEO Insights updated!', { id: toastId });
    } catch (err: any) {
      toast.error(`AI analysis failed: ${err.message}`, { id: toastId });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!data) return;
    let listToExport: any[] = [];
    let headers: string[] = [];
    let filename = '';

    if (activeTab === 'queries') {
      listToExport = data.keywords || [];
      headers = ['Keyword', 'Country', 'Category', 'Intent', 'Clicks', 'Impressions', 'CTR', 'Position', 'Change', 'URL', 'Cannibalized'];
      listToExport = listToExport.map(k => [
        `"${k.keyword}"`, k.country, k.category, k.intent, k.clicks, k.impressions, k.ctr, k.position, k.change, `"${k.ranking_url || ''}"`, k.isCannibalized ? 'YES' : 'NO'
      ]);
      filename = `queries_${days}d`;
    } else if (activeTab === 'pages') {
      listToExport = data.pages || [];
      headers = ['URL', 'Clicks', 'Impressions', 'CTR', 'Position'];
      listToExport = listToExport.map(p => [`"${p.ranking_url}"`, p.clicks, p.impressions, p.ctr, p.position]);
      filename = `pages_${days}d`;
    } else if (activeTab === 'countries') {
      listToExport = data.countries || [];
      headers = ['CountryCode', 'Clicks', 'Impressions', 'CTR', 'Position'];
      listToExport = listToExport.map(c => [c.code, c.clicks, c.impressions, c.ctr, c.position]);
      filename = `countries_${days}d`;
    } else if (activeTab === 'devices') {
      listToExport = data.devices || [];
      headers = ['Device', 'Clicks', 'Impressions', 'CTR', 'Position'];
      listToExport = listToExport.map(d => [d.name, d.clicks, d.impressions, d.ctr, d.position]);
      filename = `devices_${days}d`;
    } else {
      toast.error('Export not configured for this view');
      return;
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...listToExport.map((r: any[]) => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rankstack_${filename}_${activeProject?.name || 'project'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${listToExport.length} rows.`);
  };

  // Recharts interactive chart point click handler
  const handleChartClick = (e: any) => {
    if (e && e.activeLabel) {
      setSelectedDateForAnnotation(e.activeLabel);
      setIsAnnotationModalOpen(true);
    }
  };

  if (!activeProjectId) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="h-12 w-12 text-slate-400 mb-4 animate-glow" />
        <h3 className="text-xl font-bold text-slate-800 mb-2">No Active Project Selected</h3>
        <p className="text-slate-500 text-sm max-w-sm mb-6">
          To view SEO keyword charts and tables, please create a project or seed mock sandbox data in settings.
        </p>
        <a
          href="/settings"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all-200"
        >
          Go to Settings
        </a>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl" />
          ))}
        </div>
        <div className="h-80 bg-white border border-slate-200 rounded-2xl" />
        <div className="h-96 bg-white border border-slate-200 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-slate-850 mb-1">Failed to load dashboard data</h3>
        <p className="text-slate-500 text-sm max-w-sm mb-6">
          There was an error communicating with the local file store. Make sure `.data/rankstack.json` is writable.
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


  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPageVal, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      setCurrentPage(parsed);
    } else {
      toast.error(`Please enter a page between 1 and ${totalPages}`);
    }
  };

  // Pie chart data for branded vs non-branded split
  const pieData = [
    { name: 'Branded Clicks', value: brandedSplit.branded?.clicks || 10, color: '#6366f1' },
    { name: 'Non-Branded Clicks', value: brandedSplit.nonBranded?.clicks || 90, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  const totalPieClicks = (brandedSplit.branded?.clicks || 0) + (brandedSplit.nonBranded?.clicks || 0);

  const renderSortHeader = (field: string, label: string, alignRight = false) => {
    const isSorted = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)} 
        className={`py-3 px-4 cursor-pointer select-none hover:bg-slate-100/50 transition-all-200 ${
          alignRight ? 'text-right' : 'text-left'
        }`}
      >
        <div className={`flex items-center space-x-1 ${alignRight ? 'justify-end' : 'justify-start'}`}>
          <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">{label}</span>
          <span className="text-[10px] text-slate-400 font-extrabold shrink-0">
            {isSorted ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            {activeProject?.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
            <span>Domain: <strong className="text-indigo-650 font-mono">{activeProject?.domain}</strong></span>
            <span className="text-slate-300">•</span>
            <span>GSC Sync Date: <strong className="text-indigo-500 font-mono">{asOfDate || 'N/A'}</strong></span>
            {syncStatus?.latestLog && (
              <>
                <span className="text-slate-300">•</span>
                <span className={`inline-flex items-center space-x-1 font-semibold ${
                  syncStatus.latestLog.status === 'success' ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  <span>Status: {syncStatus.latestLog.status}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={`h-10 px-4 border rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all-200 shadow-sm ${
              isFiltersOpen 
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-100' 
                : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Advanced Filters</span>
          </button>

          <button
            onClick={handleQuickSync}
            disabled={isQuickSyncing}
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-100 transition-all-200 flex items-center space-x-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isQuickSyncing ? 'animate-spin' : ''}`} />
            <span>Quick Sync</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={totalTabItems === 0}
            className="h-10 px-4 bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-sm transition-all-200 flex items-center space-x-1.5"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {isFiltersOpen && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-200/80 shadow-md animate-in slide-in-from-top duration-200">
          <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center">
            <Filter className="h-4 w-4 text-indigo-500 mr-1.5" />
            <span>GSC Filter & Segmentation Rules</span>
          </h3>

          {/* GSC Filter vs Compare Mode selector tabs */}
          <div className="flex border-b border-slate-200/80 mb-5 gap-6">
            <button
              onClick={() => {
                setFilterMode('single');
                setCompareFilterType('none');
              }}
              className={`pb-2.5 text-xs font-bold transition-all-200 border-b-2 -mb-[2px] ${
                filterMode === 'single'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🔍 Single Filter
            </button>
            <button
              onClick={() => {
                setFilterMode('compare');
                if (compareFilterType === 'none') {
                  setCompareFilterType('query');
                }
              }}
              className={`pb-2.5 text-xs font-bold transition-all-200 border-b-2 -mb-[2px] ${
                filterMode === 'compare'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              ⚖️ Filter Comparison
            </button>
          </div>
          
          {filterMode === 'single' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
              {/* Query Filter */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Search Query Filter</label>
                <div className="flex space-x-1">
                  <select
                    value={queryFilterType}
                    onChange={e => setQueryFilterType(e.target.value)}
                    className="h-9 bg-white border border-slate-200 rounded-lg px-2 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="contains">Contains</option>
                    <option value="notContains">Excludes</option>
                    <option value="exact">Exact</option>
                    <option value="regex">Regex</option>
                  </select>
                  <input
                    type="text"
                    placeholder="e.g. wpoets"
                    value={queryFilter}
                    onChange={e => setQueryFilter(e.target.value)}
                    className="h-9 flex-1 bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Page Filter */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Target Page URL</label>
                <div className="flex space-x-1">
                  <select
                    value={pageFilterType}
                    onChange={e => setPageFilterType(e.target.value)}
                    className="h-9 bg-white border border-slate-200 rounded-lg px-2 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="contains">Contains</option>
                    <option value="notContains">Excludes</option>
                    <option value="exact">Exact</option>
                    <option value="regex">Regex</option>
                  </select>
                  <input
                    type="text"
                    placeholder="e.g. /blog/"
                    value={pageFilter}
                    onChange={e => setPageFilter(e.target.value)}
                    className="h-9 flex-1 bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Device & Search Type */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Device Split</label>
                <select
                  value={deviceFilter}
                  onChange={e => setDeviceFilter(e.target.value)}
                  className="h-9 w-full bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="All">All Devices</option>
                  <option value="Desktop">Desktop Only</option>
                  <option value="Mobile">Mobile Only</option>
                  <option value="Tablet">Tablet Only</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Search Type</label>
                <select
                  value={searchType}
                  onChange={e => setSearchType(e.target.value)}
                  className="h-9 w-full bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="Web">Web Search</option>
                  <option value="Image">Image Search</option>
                  <option value="Video">Video Search</option>
                  <option value="News">News Search</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
              {/* Compare target selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Compare Target</label>
                <select
                  value={compareFilterType}
                  onChange={e => {
                    setCompareFilterType(e.target.value as any);
                    if (e.target.value === 'device') {
                      setCompareValueA('Desktop');
                      setCompareValueB('Mobile');
                    } else {
                      setCompareValueA('');
                      setCompareValueB('');
                    }
                  }}
                  className="h-9 w-full bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="query">Search Query</option>
                  <option value="page">Landing Page URL</option>
                  <option value="country">Country Code</option>
                  <option value="device">Device Type</option>
                </select>
              </div>

              {/* Operator (only for Query and Page) */}
              {(compareFilterType === 'query' || compareFilterType === 'page') ? (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Match Condition</label>
                  <select
                    value={compareOperator}
                    onChange={e => setCompareOperator(e.target.value)}
                    className="h-9 w-full bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="contains">Contains</option>
                    <option value="notContains">Excludes</option>
                    <option value="exact">Exact Match</option>
                    <option value="regex">Regex Match</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5 opacity-40 select-none">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Match Condition</label>
                  <div className="h-9 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs text-slate-400 flex items-center">
                    Exact Segment Comparison
                  </div>
                </div>
              )}

              {/* Segment A Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Segment A</label>
                {compareFilterType === 'country' ? (
                  <select
                    value={compareValueA}
                    onChange={e => setCompareValueA(e.target.value)}
                    className="h-9 w-full bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="">Select country...</option>
                    {countriesList.map((c: any) => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                ) : compareFilterType === 'device' ? (
                  <select
                    value={compareValueA}
                    onChange={e => setCompareValueA(e.target.value)}
                    className="h-9 w-full bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="Desktop">Desktop</option>
                    <option value="Mobile">Mobile</option>
                    <option value="Tablet">Tablet</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. wpoets"
                    value={compareValueA}
                    onChange={e => setCompareValueA(e.target.value)}
                    className="h-9 w-full bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                )}
              </div>

              {/* Segment B Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Segment B</label>
                {compareFilterType === 'country' ? (
                  <select
                    value={compareValueB}
                    onChange={e => setCompareValueB(e.target.value)}
                    className="h-9 w-full bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="">Select country...</option>
                    {countriesList.map((c: any) => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                ) : compareFilterType === 'device' ? (
                  <select
                    value={compareValueB}
                    onChange={e => setCompareValueB(e.target.value)}
                    className="h-9 w-full bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  >
                    <option value="Desktop">Desktop</option>
                    <option value="Mobile">Mobile</option>
                    <option value="Tablet">Tablet</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. wordpress"
                    value={compareValueB}
                    onChange={e => setCompareValueB(e.target.value)}
                    className="h-9 w-full bg-white border border-slate-200 rounded-lg px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                  />
                )}
              </div>
            </div>
          )}

          {/* Sub Row */}
          <div className="flex flex-wrap items-center justify-between mt-4 pt-4 border-t border-slate-100 gap-3">
            <div className="flex items-center space-x-6">
              {filterMode === 'single' && (
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={compareMode}
                    onChange={e => setCompareMode(e.target.checked)}
                    className="h-4 w-4 bg-white border-slate-200 rounded accent-indigo-600"
                  />
                  <span className="text-xs font-semibold text-slate-650">Overlay Prior Period curves (Double-Period)</span>
                </label>
              )}

              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideExcluded}
                  onChange={e => setHideExcluded(e.target.checked)}
                  className="h-4 w-4 bg-white border-slate-200 rounded accent-indigo-650"
                />
                <span className="text-xs font-semibold text-slate-650">Hide Excluded Keywords</span>
              </label>
            </div>

            <button
              onClick={() => {
                setQueryFilter('');
                setPageFilter('');
                setDeviceFilter('All');
                setSearchType('Web');
                setCompareMode(true);
                setFilterMode('single');
                setCompareFilterType('none');
                setCompareValueA('');
                setCompareValueB('');
                setCompareOperator('contains');
                toast.info('Filters cleared');
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Main Filter Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between relative z-30">
        <div className="flex flex-wrap items-center gap-4">
          {/* GSC-style Date Range Picker */}
          <div className="relative">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            {isFetching && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
              </span>
            )}
          </div>

          {/* Quick Category filter tabs */}
          <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200/40">
            {['All', 'Branded', 'Migration', 'Location', 'Service', 'Blog'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all-200 ${
                  category === cat
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Right filters: Country dropdown */}
        <div className="flex items-center space-x-2">
          <Globe className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Country:</span>
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-xs text-slate-700 outline-none hover:border-slate-350 shadow-sm"
          >
            <option value="All">All Countries</option>
            {countriesList.map((c: any) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* GSC-style Metric Tab Cards (Toggle Lines on Click) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* Clicks */}
        <button
          onClick={() => setShowClicks(!showClicks)}
          className={`p-5 rounded-2xl border text-left transition-all-200 relative overflow-hidden shadow-sm ${
            showClicks
              ? 'border-indigo-500 bg-indigo-50/15 text-indigo-900 ring-2 ring-indigo-500/10'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-350 hover:bg-slate-50'
          }`}
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500" />
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Clicks</span>
            <Eye className={`h-4 w-4 ${showClicks ? 'text-indigo-500' : 'text-slate-300'}`} />
          </div>
          {isApiCompareMode ? (
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-xs">
                <span className="text-indigo-600 font-bold truncate max-w-[120px]">{apiCompareValueA || 'A'}:</span>
                <span className="font-extrabold text-slate-800">{kpis.clicks.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-purple-650 font-bold truncate max-w-[120px]">{apiCompareValueB || 'B'}:</span>
                <span className="font-extrabold text-slate-800">{kpis.clicksB?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[11px] pt-1.5 border-t border-slate-100">
                <span className="text-slate-400 font-semibold">Diff:</span>
                <span className={`font-bold ${kpis.clicksDiff >= 0 ? 'text-emerald-600' : 'text-red-650'}`}>
                  {kpis.clicksDiff >= 0 ? '+' : ''}{kpis.clicksDiff.toLocaleString()} ({kpis.clicksB > 0 ? (kpis.clicksDiff >= 0 ? '+' : '') + ((kpis.clicksDiff / kpis.clicksB) * 100).toFixed(1) + '%' : '0.0%'})
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl font-extrabold text-slate-800">{kpis.clicks.toLocaleString()}</span>
                <span className={`inline-flex items-center space-x-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  kpis.clicksDiff >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                }`}>
                  {kpis.clicksDiff >= 0 ? '+' : ''}{kpis.clicksDiffPercent}%
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                vs {kpis.priorClicks.toLocaleString()} in prior period
              </p>
            </>
          )}
        </button>

        {/* Impressions */}
        <button
          onClick={() => setShowImpressions(!showImpressions)}
          className={`p-5 rounded-2xl border text-left transition-all-200 relative overflow-hidden shadow-sm ${
            showImpressions
              ? 'border-purple-500 bg-purple-50/15 text-purple-900 ring-2 ring-purple-500/10'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-350 hover:bg-slate-50'
          }`}
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-purple-500" />
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Impressions</span>
            <Eye className={`h-4 w-4 ${showImpressions ? 'text-purple-500' : 'text-slate-300'}`} />
          </div>
          {isApiCompareMode ? (
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-xs">
                <span className="text-indigo-650 font-bold truncate max-w-[120px]">{apiCompareValueA || 'A'}:</span>
                <span className="font-extrabold text-slate-800">{kpis.impressions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-purple-650 font-bold truncate max-w-[120px]">{apiCompareValueB || 'B'}:</span>
                <span className="font-extrabold text-slate-800">{kpis.impressionsB?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[11px] pt-1.5 border-t border-slate-100">
                <span className="text-slate-450 font-semibold">Diff:</span>
                <span className={`font-bold ${kpis.impressionsDiff >= 0 ? 'text-emerald-600' : 'text-red-650'}`}>
                  {kpis.impressionsDiff >= 0 ? '+' : ''}{kpis.impressionsDiff.toLocaleString()} ({kpis.impressionsB > 0 ? (kpis.impressionsDiff >= 0 ? '+' : '') + ((kpis.impressionsDiff / kpis.impressionsB) * 100).toFixed(1) + '%' : '0.0%'})
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl font-extrabold text-slate-800">{kpis.impressions.toLocaleString()}</span>
                <span className={`inline-flex items-center space-x-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  kpis.impressionsDiff >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                }`}>
                  {kpis.impressionsDiff >= 0 ? '+' : ''}{kpis.impressionsDiffPercent}%
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                vs {kpis.priorImpressions.toLocaleString()} in prior period
              </p>
            </>
          )}
        </button>

        {/* Average CTR */}
        <button
          onClick={() => setShowCtr(!showCtr)}
          className={`p-5 rounded-2xl border text-left transition-all-200 relative overflow-hidden shadow-sm ${
            showCtr
              ? 'border-emerald-500 bg-emerald-50/15 text-emerald-900 ring-2 ring-emerald-500/10'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-350 hover:bg-slate-50'
          }`}
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500" />
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Average CTR</span>
            <Eye className={`h-4 w-4 ${showCtr ? 'text-emerald-500' : 'text-slate-300'}`} />
          </div>
          {isApiCompareMode ? (
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-xs">
                <span className="text-indigo-650 font-bold truncate max-w-[120px]">{apiCompareValueA || 'A'}:</span>
                <span className="font-extrabold text-slate-800">{formatPercent(kpis.ctr)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-purple-650 font-bold truncate max-w-[120px]">{apiCompareValueB || 'B'}:</span>
                <span className="font-extrabold text-slate-800">{formatPercent(kpis.ctrB || 0)}</span>
              </div>
              <div className="flex justify-between text-[11px] pt-1.5 border-t border-slate-100">
                <span className="text-slate-450 font-semibold">Diff:</span>
                <span className={`font-bold ${kpis.ctrDiff >= 0 ? 'text-emerald-600' : 'text-red-650'}`}>
                  {kpis.ctrDiff >= 0 ? '+' : ''}{(kpis.ctrDiff * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl font-extrabold text-slate-800">{formatPercent(kpis.ctr)}</span>
                <span className={`inline-flex items-center space-x-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  kpis.ctrDiff >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                }`}>
                  {kpis.ctrDiff >= 0 ? '+' : ''}{(kpis.ctrDiff * 100).toFixed(2)}%
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                vs {formatPercent(kpis.priorCtr)} in prior period
              </p>
            </>
          )}
        </button>

        {/* Average Position */}
        <button
          onClick={() => setShowPosition(!showPosition)}
          className={`p-5 rounded-2xl border text-left transition-all-200 relative overflow-hidden shadow-sm ${
            showPosition
              ? 'border-amber-500 bg-amber-50/15 text-amber-900 ring-2 ring-amber-500/10'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-350 hover:bg-slate-50'
          }`}
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500" />
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Average Position</span>
            <Eye className={`h-4 w-4 ${showPosition ? 'text-amber-500' : 'text-slate-300'}`} />
          </div>
          {isApiCompareMode ? (
            <div className="space-y-1 mt-2">
              <div className="flex justify-between text-xs">
                <span className="text-indigo-650 font-bold truncate max-w-[120px]">{apiCompareValueA || 'A'}:</span>
                <span className="font-extrabold text-slate-800">{kpis.position.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-purple-650 font-bold truncate max-w-[120px]">{apiCompareValueB || 'B'}:</span>
                <span className="font-extrabold text-slate-800">{kpis.positionB?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] pt-1.5 border-t border-slate-100">
                <span className="text-slate-450 font-semibold">Diff:</span>
                <span className={`font-bold ${kpis.positionDiff >= 0 ? 'text-emerald-600' : 'text-red-650'}`}>
                  {kpis.positionDiff >= 0 ? '+' : ''}{kpis.positionDiff.toFixed(2)} pos
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl font-extrabold text-slate-800">{kpis.position}</span>
                <span className={`inline-flex items-center space-x-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  kpis.positionDiff >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
                }`}>
                  {kpis.positionDiff >= 0 ? '+' : ''}{kpis.positionDiff} pos
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                vs {kpis.priorPosition} in prior period
              </p>
            </>
          )}
        </button>
      </div>

      {/* Main Chart Visualization */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-200/80 shadow-sm relative">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h3 className="text-md font-bold text-slate-800 flex items-center">
              <Activity className="h-4 w-4 text-indigo-500 mr-1.5" />
              <span>GSC Traffic Performance Timeline</span>
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Click on the chart grid lines to add annotation notes. Red shaded blocks represent Google updates.
            </p>
          </div>
          <div className="flex items-center space-x-4 text-xs font-semibold text-slate-500">
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded bg-indigo-500" />
              <span>{isApiCompareMode ? `Segment A (${apiCompareValueA || 'A'})` : 'Current'}</span>
            </div>
            {(compareMode || isApiCompareMode) && (
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-1.5 rounded-l bg-indigo-300" style={{ borderStyle: 'dashed', borderWidth: '1px' }} />
                <span>{isApiCompareMode ? `Segment B (${apiCompareValueB || 'B'})` : 'Prior Period'}</span>
              </div>
            )}
          </div>
        </div>
        {/* ── CHART SECTION: GSC Guardian style ── */}
        <div className="space-y-0">

          {/* ─── UNIFIED CHART: Clicks (left) + Impressions, CTR, Position (right) ─── */}
          <div className="h-[300px] w-full relative bg-white">

            {isMounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  onClick={handleChartClick}
                  margin={{ top: 10, right: rightMargin, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />

                  {/* ── LEFT: Clicks ── */}
                  {showClicks && (
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      width={40}
                      tick={{ fill: '#6366f1', fontSize: 10, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatCompactNumber}
                      label={{ value: 'Clicks', position: 'insideTopLeft', offset: 0, dy: -8, dx: 4, fill: '#6366f1', fontSize: 10, fontWeight: 700 }}
                    />
                  )}

                  {/* ── RIGHT: Impressions ── */}
                  {showImpressions && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      width={45}
                      tick={{ fill: '#a855f7', fontSize: 10, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatCompactNumber}
                      label={{ value: 'Impressions', position: 'insideTopRight', offset: 0, dy: -8, dx: -4, fill: '#a855f7', fontSize: 10, fontWeight: 700 }}
                    />
                  )}

                  {/* ── RIGHT: CTR ── */}
                  {showCtr && (
                    <YAxis
                      yAxisId="ctr"
                      orientation="right"
                      width={45}
                      dx={showImpressions ? 45 : 0}
                      tick={{ fill: '#10b981', fontSize: 10, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                      label={{ value: 'CTR', position: 'insideTopRight', offset: 0, dy: -8, dx: showImpressions ? 41 : -4, fill: '#10b981', fontSize: 10, fontWeight: 700 }}
                    />
                  )}

                  {/* ── RIGHT: Position ── */}
                  {showPosition && (
                    <YAxis
                      yAxisId="pos"
                      orientation="right"
                      width={40}
                      dx={(showImpressions ? 45 : 0) + (showCtr ? 45 : 0)}
                      reversed={true}
                      domain={[1, 'auto']}
                      tick={{ fill: '#f59e0b', fontSize: 10, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      label={{ value: 'Position', position: 'insideTopRight', offset: 0, dy: -8, dx: (showImpressions ? 41 : -4) + (showCtr ? 45 : 0), fill: '#f59e0b', fontSize: 10, fontWeight: 700 }}
                    />
                  )}

                  <Tooltip content={<CustomChartTooltip googleUpdates={googleUpdates} annotations={annotations} />} />

                  {/* ── Google Update Shaded Areas ── */}
                  {visibleUpdates.map((upd: any) => (
                    <ReferenceArea
                      key={upd.id}
                      yAxisId={activeYAxisId}
                      x1={upd.startDate}
                      x2={upd.endDate || upd.startDate}
                      fill={upd.type === 'spam' ? 'rgba(251,191,36,0.12)' : 'rgba(239,68,68,0.12)'}
                      stroke="none"
                    />
                  ))}

                  {/* ── Vertical dashed lines at update boundaries ── */}
                  {visibleUpdates.map((upd: any) => (
                    <ReferenceLine
                      key={`vl-${upd.id}`}
                      yAxisId={activeYAxisId}
                      x={upd.startDate}
                      stroke={upd.type === 'spam' ? '#f59e0b' : '#ef4444'}
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      strokeOpacity={0.5}
                    />
                  ))}

                  {/* ── Annotation lines ── */}
                  {annotations.map((ann: any) => (
                    <ReferenceLine
                      key={ann.id}
                      yAxisId={activeYAxisId}
                      x={ann.date}
                      stroke="#6366f1"
                      strokeDasharray="3 3"
                      strokeOpacity={0.6}
                      label={{ value: '📌', position: 'insideTop', fill: '#6366f1', fontSize: 12 }}
                    />
                  ))}

                  {/* ── Clicks line ── */}
                  {showClicks && (
                    <Line yAxisId="left" type="monotone" dataKey="clicks"
                      name={isApiCompareMode ? `Clicks A (${apiCompareValueA})` : 'Clicks'}
                      stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#6366f1' }} />
                  )}
                  {(compareMode || isApiCompareMode) && showClicks && (
                    <Line yAxisId="left" type="monotone" dataKey="clicksPrior"
                      name={isApiCompareMode ? `Clicks B (${apiCompareValueB})` : 'Clicks (Prior)'}
                      stroke="#a5b4fc" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                  )}

                  {/* ── Impressions line ── */}
                  {showImpressions && (
                    <Line yAxisId="right" type="monotone" dataKey="impressions"
                      name={isApiCompareMode ? `Impressions A (${apiCompareValueA})` : 'Impressions'}
                      stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#a855f7' }} />
                  )}
                  {(compareMode || isApiCompareMode) && showImpressions && (
                    <Line yAxisId="right" type="monotone" dataKey="impressionsPrior"
                      name={isApiCompareMode ? `Impressions B (${apiCompareValueB})` : 'Impressions (Prior)'}
                      stroke="#d8b4fe" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                  )}

                  {/* ── CTR line ── */}
                  {showCtr && (
                    <Line yAxisId="ctr" type="monotone" dataKey="ctr"
                      name={isApiCompareMode ? `CTR A (${apiCompareValueA})` : 'CTR'}
                      stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
                  )}
                  {(compareMode || isApiCompareMode) && showCtr && (
                    <Line yAxisId="ctr" type="monotone" dataKey="ctrPrior"
                      name={isApiCompareMode ? `CTR B (${apiCompareValueB})` : 'CTR (Prior)'}
                      stroke="#6ee7b7" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                  )}

                  {/* ── Position line ── */}
                  {showPosition && (
                    <Line yAxisId="pos" type="monotone" dataKey="position"
                      name={isApiCompareMode ? `Avg Position A (${apiCompareValueA})` : 'Avg Position'}
                      stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#f59e0b' }} />
                  )}
                  {(compareMode || isApiCompareMode) && showPosition && (
                    <Line yAxisId="pos" type="monotone" dataKey="positionPrior"
                      name={isApiCompareMode ? `Avg Position B (${apiCompareValueB})` : 'Avg Position (Prior)'}
                      stroke="#fde68a" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No GSC metrics available for the selected dates.
              </div>
            )}
          </div>

          {/* ─── INCIDENT BADGES: rendered below the chart as a timeline row ─── */}
          {isMounted && chartData.length > 0 && visibleUpdates.length > 0 && (
            <div 
              className="relative h-8 border-t border-slate-100 bg-slate-50/60 rounded-b-xl overflow-hidden"
              style={{
                marginLeft: `${leftOffset}px`,
                marginRight: `${rightMargin}px`
              }}
            >
              {(() => {
                const total = chartData.length;
                if (total < 2) return null;
                return visibleUpdates.map((upd: any) => {
                  const dataIdx = chartData.findIndex((d: any) => d.date === upd.startDate);
                  if (dataIdx < 0) return null;
                  const pct = (dataIdx / (total - 1)) * 100;
                  const isSpam = upd.type === 'spam';

                  // Map to the row index in the googleUpdates table (1-based, descending)
                  const tableIdx = googleUpdates.findIndex((u: any) => u.id === upd.id);
                  const badgeNum = tableIdx >= 0 ? tableIdx + 1 : '?';

                  return (
                    <button
                      key={upd.id}
                      title={`${upd.name} — click for details`}
                      onClick={() => { setSelectedGoogleUpdate(upd); setIsUpdateModalOpen(true); }}
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full text-white text-[9px] font-bold shadow-md hover:scale-125 transition-transform cursor-pointer z-10"
                      style={{
                        left: `${pct}%`,
                        backgroundColor: isSpam ? '#f59e0b' : '#ef4444',
                        border: '2px solid white',
                        boxShadow: `0 0 0 1px ${isSpam ? '#f59e0b' : '#ef4444'}40`,
                      }}
                    >
                      {badgeNum}
                    </button>
                  );
                });
              })()}
              <div className="absolute inset-0 flex items-center justify-start pl-2 text-[9px] text-slate-400 font-medium pointer-events-none">
                Google Updates & Incidents
              </div>
            </div>
          )}

        </div>

        {/* ─── CHART LEGEND ─── */}
        {isMounted && chartData.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-x-5 gap-y-2 items-center justify-center text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
              <span>Core Update</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span>Spam / Incident</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span>(Click numbered badge on timeline for details)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-8 h-3 rounded-sm bg-red-400/15 border border-red-400/30 shrink-0" />
              <span>Update period shading</span>
            </span>
            {showClicks && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-0.5 bg-indigo-500 shrink-0" />
                <span className="text-indigo-600 font-semibold">Clicks (left)</span>
              </span>
            )}
            {showImpressions && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-0.5 bg-purple-500 shrink-0" />
                <span className="text-purple-600 font-semibold">Impressions (right)</span>
              </span>
            )}
            {showCtr && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-0.5 bg-emerald-500 shrink-0" />
                <span className="text-emerald-600 font-semibold">CTR (right)</span>
              </span>
            )}
            {showPosition && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-0.5 bg-amber-500 shrink-0" />
                <span className="text-amber-600 font-semibold">Position (right, inverted)</span>
              </span>
            )}
          </div>
        )}
      </div>



      {/* Split Row: Google updates impact, AI Copilot, Branded split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column: AI insights sidebar + Branded Split */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* AI insights panel */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col h-full min-h-[350px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center">
                <Sparkles className="h-4 w-4 text-indigo-650 mr-1.5" />
                <span>AI SEO insights Copilot</span>
              </h3>
              <button
                onClick={handleGenerateAIInsights}
                disabled={isGeneratingAI}
                className="h-8 px-2.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-all-200 flex items-center space-x-1"
              >
                <RefreshCw className={`h-3 w-3 ${isGeneratingAI ? 'animate-spin' : ''}`} />
                <span>Ask AI</span>
              </button>
            </div>

            {isGeneratingAI ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-12">
                <Sparkles className="h-8 w-8 text-indigo-600 animate-spin" />
                <span className="text-xs text-slate-500 font-semibold animate-pulse">Running Deep Rank Analysis...</span>
              </div>
            ) : aiInsights.length > 0 ? (
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px]">
                {aiInsights.map((insight, idx) => (
                  <div key={idx} className={`p-3 rounded-xl border text-xs relative ${
                    insight.type === 'warning'
                      ? 'bg-red-50/40 border-red-200/50'
                      : insight.type === 'opportunity'
                      ? 'bg-indigo-50/40 border-indigo-200/50'
                      : insight.type === 'success'
                      ? 'bg-emerald-50/40 border-emerald-200/50'
                      : 'bg-slate-50 border-slate-200/60'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-800">{insight.title}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                        insight.impact === 'High' 
                          ? 'bg-red-100 text-red-800' 
                          : insight.impact === 'Medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {insight.impact}
                      </span>
                    </div>
                    <p className="text-slate-650 leading-normal">{insight.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/40">
                <Sparkles className="h-8 w-8 text-slate-300 mb-2" />
                <span className="text-xs font-semibold text-slate-650">Unlock AI Insights</span>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                  Extract critical content gaps and Google update warnings on this domain.
                </p>
                <button
                  onClick={handleGenerateAIInsights}
                  className="mt-3 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-650 hover:bg-slate-50"
                >
                  Generate Insights
                </button>
              </div>
            )}
          </div>

          {/* Branded vs Non-Branded pie chart */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
              <Globe className="h-4 w-4 text-indigo-500 mr-1.5" />
              <span>Branded vs Non-Branded Split</span>
            </h3>

            <div className="flex items-center justify-between">
              {/* Left: Mini-Pie */}
              <div className="h-28 w-28 shrink-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={45}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Clicks</span>
                  <span className="text-sm font-bold text-slate-800">{totalPieClicks.toLocaleString()}</span>
                </div>
              </div>

              {/* Right: Legend Breakdown */}
              <div className="space-y-3 flex-1 ml-4">
                <div className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center font-semibold text-slate-700">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 mr-1.5" />
                      <span>Branded</span>
                    </span>
                    <span className="font-bold text-slate-800">
                      {totalPieClicks > 0 ? ((brandedSplit.branded?.clicks / totalPieClicks) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 pl-3.5 mt-0.5">
                    {brandedSplit.branded?.clicks.toLocaleString()} Clicks • Pos: {brandedSplit.branded?.position}
                  </div>
                </div>

                <div className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center font-semibold text-slate-700">
                      <span className="h-2 w-2 rounded-full bg-amber-500 mr-1.5" />
                      <span>Non-Branded</span>
                    </span>
                    <span className="font-bold text-slate-800">
                      {totalPieClicks > 0 ? ((brandedSplit.nonBranded?.clicks / totalPieClicks) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 pl-3.5 mt-0.5">
                    {brandedSplit.nonBranded?.clicks.toLocaleString()} Clicks • Pos: {brandedSplit.nonBranded?.position}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Google updates impact analyzer & SEO A/B Test / Annotations */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Google algorithm updates list */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center">
              <AlertTriangle className="h-4 w-4 text-red-500 mr-1.5" />
              <span>Google Algorithm Updates & Impact Analysis</span>
            </h3>
            <p className="text-slate-500 text-xs mb-4">
              RankStack automatically calculates organic click changes 14 days before vs 14 days after algorithm deployment.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3 rounded-l-lg">Algorithm Update Name</th>
                    <th className="py-2.5 px-3">Start Date</th>
                    <th className="py-2.5 px-3 text-right">Before Clicks</th>
                    <th className="py-2.5 px-3 text-right">After Clicks</th>
                    <th className="py-2.5 px-3 text-right rounded-r-lg">Traffic Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {googleUpdates.length > 0 ? (
                    googleUpdates.map((upd: any) => (
                      <tr key={upd.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-semibold text-slate-800">{upd.name}</td>
                        <td className="py-3 px-3 font-mono text-slate-500">{upd.startDate}</td>
                        <td className="py-3 px-3 text-right text-slate-500">{upd.beforeClicks.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-slate-500">{upd.afterClicks.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded ${
                            upd.clicksChangePercent > 5.0
                              ? 'bg-emerald-50 text-emerald-600'
                              : upd.clicksChangePercent < -5.0
                              ? 'bg-red-50 text-red-600'
                              : 'bg-slate-50 text-slate-600'
                          }`}>
                            {upd.clicksChangePercent > 0 ? '+' : ''}{upd.clicksChangePercent}%
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 font-semibold">
                        No algorithm updates detected in this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Annotations & A/B Impact Tracker */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center">
                  <Calendar className="h-4 w-4 text-indigo-500 mr-1.5" />
                  <span>SEO A/B Test & Annotation Impact Tracker</span>
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Track CTR impact of updates (14d before vs 14d after).
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedDateForAnnotation(new Date().toISOString().split('T')[0]);
                  setIsAnnotationModalOpen(true);
                }}
                className="h-8 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 rounded-lg text-xs font-semibold transition-all-200 flex items-center space-x-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Note</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Event Detail</th>
                    <th className="py-2.5 px-3 text-right">Before</th>
                    <th className="py-2.5 px-3 text-right">After</th>
                    <th className="py-2.5 px-3 text-right">Impact</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {annotations.length > 0 ? (
                    annotations.map((ann: any) => (
                      <tr key={ann.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-mono text-slate-500">{ann.date}</td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-850">{ann.title}</div>
                          {ann.description && <div className="text-[10px] text-slate-400 mt-0.5">{ann.description}</div>}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-500">{ann.beforeClicks.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-slate-500">{ann.afterClicks.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded ${
                            ann.clicksChangePercent > 2.0
                              ? 'bg-emerald-50 text-emerald-600'
                              : ann.clicksChangePercent < -2.0
                              ? 'bg-red-50 text-red-600'
                              : 'bg-slate-50 text-slate-500'
                          }`}>
                            {ann.clicksChangePercent > 0 ? '+' : ''}{ann.clicksChangePercent}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleDeleteAnnotation(ann.id)}
                            className="text-slate-400 hover:text-red-500 transition-all-200"
                          >
                            <Trash2 className="h-4 w-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 font-semibold">
                        No user annotations added in this range. Click on the chart timeline to create one!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* URL Inspection panel & GSC Tabs Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap border-b border-slate-200 bg-slate-50/50 p-2 gap-1.5">
          {[
            { id: 'queries', label: 'Queries', icon: Search },
            { id: 'pages', label: 'Pages', icon: FileText },
            { id: 'countries', label: 'Countries', icon: Globe },
            { id: 'devices', label: 'Devices', icon: Smartphone },
            { id: 'appearances', label: 'Appearances', icon: Grid },
            { id: 'days', label: 'Days', icon: Calendar },
            { id: 'changes', label: 'Last Sync Changes', icon: RefreshCw, badge: recentlyUpdatedKeywords?.length },
            ...(!isApiCompareMode ? [{ id: 'cannibalization', label: 'Cannibalization', icon: AlertTriangle, badge: cannibalized.length }] : []),
            { id: 'inspection', label: 'URL Inspector', icon: Eye }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id || (tab.id === 'inspection' && activeTab === 'inspection');
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all-200 shadow-sm border ${
                  active
                    ? 'bg-indigo-600 border-indigo-650 text-white shadow-indigo-100'
                    : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span className={`h-4.5 min-w-4.5 flex items-center justify-center px-1 rounded-full text-[9px] font-extrabold ${
                    active ? 'bg-white text-indigo-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Tab Content Panels */}
        <div className="p-6">
          
          {/* URL Inspector Panel */}
          {activeTab === 'inspection' ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800">GSC URL Inspection API Auditor</h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Direct audit from the official Google Search Console API. Test indexing status, crawlability, usability, and schemas.
                </p>
              </div>

              {/* Form Input */}
              <form onSubmit={handleUrlInspection} className="flex gap-2 max-w-xl">
                <input
                  type="url"
                  placeholder="https://www.wpoets.com/target-page-path"
                  value={inspectUrlInput}
                  onChange={e => setInspectUrlInput(e.target.value)}
                  required
                  className="h-10 flex-1 bg-white border border-slate-200 rounded-xl px-4 text-xs text-slate-700 outline-none focus:border-indigo-500 shadow-sm"
                />
                <button
                  type="submit"
                  disabled={isInspecting}
                  className="h-10 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all-200 flex items-center space-x-1.5"
                >
                  <Eye className="h-4 w-4" />
                  <span>{isInspecting ? 'Auditing...' : 'Inspect'}</span>
                </button>
              </form>

              {/* Inspection Results Dashboard Mockup/Real */}
              {inspectionResult ? (
                <div className="border border-slate-200/80 rounded-xl p-5 bg-slate-50/50 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <span className="font-bold text-slate-800 text-xs">Live Inspection Audit Results</span>
                    <span className={`inline-flex items-center font-bold px-2 py-0.5 rounded text-[10px] uppercase border ${
                      inspectionResult.indexStatusResult?.verdict === 'PASS'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      {inspectionResult.indexStatusResult?.verdict === 'PASS' ? 'Indexed successfully' : 'Not Indexed'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                    {/* Column 1: Indexing status */}
                    <div className="space-y-2">
                      <span className="font-bold text-slate-650 uppercase tracking-wider text-[9px] block">Coverage details</span>
                      <div className="space-y-1 text-slate-650">
                        <div>Verdict: <strong className="text-slate-800">{inspectionResult.indexStatusResult?.verdict}</strong></div>
                        <div>Coverage State: <span className="text-slate-500">{inspectionResult.indexStatusResult?.coverageState}</span></div>
                        <div>Last Crawl Time: <span className="text-slate-500 font-mono text-[10px]">{inspectionResult.indexStatusResult?.lastCrawlTime ? new Date(inspectionResult.indexStatusResult.lastCrawlTime).toLocaleString() : 'N/A'}</span></div>
                        <div>Crawl Agent: <span className="text-slate-500">{inspectionResult.indexStatusResult?.crawlUserAgent}</span></div>
                      </div>
                    </div>

                    {/* Column 2: Mobile Usability */}
                    <div className="space-y-2">
                      <span className="font-bold text-slate-650 uppercase tracking-wider text-[9px] block">Mobile Usability</span>
                      <div className="space-y-1 text-slate-650">
                        <div>Verdict: <strong className="text-slate-800">{inspectionResult.mobileUsabilityResult?.verdict}</strong></div>
                        <div>Issues Count: <span className="text-slate-500">{inspectionResult.mobileUsabilityResult?.issues?.length || 0}</span></div>
                        {inspectionResult.mobileUsabilityResult?.issues?.length > 0 && (
                          <div className="text-[10px] text-red-600 bg-red-50 p-1.5 rounded">
                            {inspectionResult.mobileUsabilityResult.issues.map((i: any) => i.message).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Column 3: Rich Results Schema */}
                    <div className="space-y-2">
                      <span className="font-bold text-slate-650 uppercase tracking-wider text-[9px] block">Detected Schemas</span>
                      <div className="space-y-1 text-slate-650">
                        <div>Verdict: <strong className="text-slate-800">{inspectionResult.richResultsResult?.verdict || 'PASS'}</strong></div>
                        <div>Detected Items:</div>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-500">
                          {inspectionResult.richResultsResult?.detectedItems?.map((itm: any, idx: number) => (
                            <li key={idx}>
                              <strong>{itm.name}</strong> ({itm.items?.length || 0} items)
                            </li>
                          )) || <li>None</li>}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {inspectionResult.inspectionResultLink && (
                    <div className="pt-2 border-t border-slate-200 flex justify-end">
                      <a
                        href={inspectionResult.inspectionResultLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-indigo-600 hover:underline font-bold flex items-center"
                      >
                        <span>Open in Google Search Console</span>
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Eye className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <span className="text-xs font-semibold text-slate-650">No inspection run yet</span>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Type a landing page URL above to check its real-time GSC Index Status, Canonical mismatches, or schema health.
                  </p>
                </div>
              )}
            </div>
          ) : (
            
            // Standard performance metric tables
            <div className="space-y-6">
              
              {/* Search filter input inside tab */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 capitalize">
                    {activeTab === 'changes' ? 'Last Sync Changes' : `${activeTab} Performance`}
                  </h4>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {activeTab === 'changes' 
                      ? `Showing keyword ranking shifts on sync date (${asOfDate}) vs the prior data date` 
                      : `Showing ${filteredTabItems.length} entries for current range`}
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={`Search ${activeTab}...`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:border-indigo-500 focus:outline-none transition-all-200 shadow-sm"
                  />
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                {totalTabItems === 0 ? (
                  <div className="p-12 text-center">
                    <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-sm font-semibold text-slate-800">No records found</h4>
                    <p className="text-slate-400 text-xs mt-1">Try relaxing your keyword filters or run a sync.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        
                        {/* Headers mapped dynamically by active tab */}
                        {activeTab === 'queries' && (
                          <>
                            {renderSortHeader('keyword', 'Keyword query')}
                            {renderSortHeader('country', 'Country')}
                            {renderSortHeader('category', 'Category')}
                            {renderSortHeader('intent', 'Intent')}
                            {isApiCompareMode ? (
                              <>
                                {renderSortHeader('clicks', `Clicks (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('clicksB', `Clicks (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('clicksDiff', 'Diff', true)}
                                {renderSortHeader('impressions', `Impressions (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('impressionsB', `Impressions (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('ctr', `CTR (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('ctrB', `CTR (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('position', `Position (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('positionB', `Position (${apiCompareValueB || 'B'})`, true)}
                              </>
                            ) : (
                              <>
                                {renderSortHeader('clicks', 'Clicks', true)}
                                {renderSortHeader('impressions', 'Impressions', true)}
                                {renderSortHeader('ctr', 'CTR', true)}
                                {renderSortHeader('position', 'Position', true)}
                                {renderSortHeader('change', 'Rank Change', true)}
                              </>
                            )}
                          </>
                        )}

                        {activeTab === 'pages' && (
                          <>
                            {renderSortHeader('ranking_url', 'Page landing URL')}
                            {isApiCompareMode ? (
                              <>
                                {renderSortHeader('clicks', `Clicks (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('clicksB', `Clicks (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('clicksDiff', 'Diff', true)}
                                {renderSortHeader('impressions', `Impressions (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('impressionsB', `Impressions (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('ctr', `CTR (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('ctrB', `CTR (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('position', `Position (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('positionB', `Position (${apiCompareValueB || 'B'})`, true)}
                              </>
                            ) : (
                              <>
                                {renderSortHeader('clicks', 'Clicks', true)}
                                {renderSortHeader('impressions', 'Impressions', true)}
                                {renderSortHeader('ctr', 'CTR', true)}
                                {renderSortHeader('position', 'Avg Position', true)}
                              </>
                            )}
                          </>
                        )}

                        {activeTab === 'countries' && (
                          <>
                            {renderSortHeader('code', 'Country Code')}
                            {isApiCompareMode ? (
                              <>
                                {renderSortHeader('clicks', `Clicks (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('clicksB', `Clicks (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('clicksDiff', 'Diff', true)}
                                {renderSortHeader('impressions', `Impressions (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('impressionsB', `Impressions (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('ctr', `CTR (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('ctrB', `CTR (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('position', `Position (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('positionB', `Position (${apiCompareValueB || 'B'})`, true)}
                              </>
                            ) : (
                              <>
                                {renderSortHeader('clicks', 'Clicks', true)}
                                {renderSortHeader('impressions', 'Impressions', true)}
                                {renderSortHeader('ctr', 'CTR', true)}
                                {renderSortHeader('position', 'Position', true)}
                              </>
                            )}
                          </>
                        )}

                        {activeTab === 'devices' && (
                          <>
                            {renderSortHeader('name', 'Device Class')}
                            {isApiCompareMode ? (
                              <>
                                {renderSortHeader('clicks', `Clicks (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('clicksB', `Clicks (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('clicksDiff', 'Diff', true)}
                                {renderSortHeader('impressions', `Impressions (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('impressionsB', `Impressions (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('ctr', `CTR (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('ctrB', `CTR (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('position', `Position (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('positionB', `Position (${apiCompareValueB || 'B'})`, true)}
                              </>
                            ) : (
                              <>
                                {renderSortHeader('clicks', 'Clicks', true)}
                                {renderSortHeader('impressions', 'Impressions', true)}
                                {renderSortHeader('ctr', 'CTR', true)}
                                {renderSortHeader('position', 'Position', true)}
                              </>
                            )}
                          </>
                        )}

                        {activeTab === 'appearances' && (
                          <>
                            {renderSortHeader('name', 'Rich result type')}
                            {isApiCompareMode ? (
                              <>
                                {renderSortHeader('clicks', `Clicks (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('clicksB', `Clicks (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('clicksDiff', 'Diff', true)}
                                {renderSortHeader('impressions', `Impressions (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('impressionsB', `Impressions (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('ctr', `CTR (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('ctrB', `CTR (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('position', `Position (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('positionB', `Position (${apiCompareValueB || 'B'})`, true)}
                              </>
                            ) : (
                              <>
                                {renderSortHeader('clicks', 'Clicks', true)}
                                {renderSortHeader('impressions', 'Impressions', true)}
                                {renderSortHeader('ctr', 'CTR', true)}
                                {renderSortHeader('position', 'Position', true)}
                              </>
                            )}
                          </>
                        )}

                        {activeTab === 'days' && (
                          <>
                            {renderSortHeader('date', 'Calendar Date')}
                            {isApiCompareMode ? (
                              <>
                                {renderSortHeader('clicks', `Clicks (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('clicksB', `Clicks (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('clicksDiff', 'Diff', true)}
                                {renderSortHeader('impressions', `Impressions (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('impressionsB', `Impressions (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('ctr', `CTR (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('ctrB', `CTR (${apiCompareValueB || 'B'})`, true)}
                                {renderSortHeader('position', `Position (${apiCompareValueA || 'A'})`, true)}
                                {renderSortHeader('positionB', `Position (${apiCompareValueB || 'B'})`, true)}
                              </>
                            ) : (
                              <>
                                {renderSortHeader('clicks', 'Clicks', true)}
                                {renderSortHeader('impressions', 'Impressions', true)}
                                {renderSortHeader('ctr', 'CTR', true)}
                                {renderSortHeader('position', 'Position', true)}
                              </>
                            )}
                          </>
                        )}

                        {activeTab === 'cannibalization' && (
                          <>
                            {renderSortHeader('keyword', 'Keyword Query')}
                            <th className="py-3 px-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Competing Landing Pages (Winner Highlighted)</th>
                            {renderSortHeader('clicks', 'Total Clicks', true)}
                            {renderSortHeader('impressions', 'Impressions', true)}
                            {renderSortHeader('position', 'Avg Position', true)}
                          </>
                        )}

                        {activeTab === 'changes' && (
                          <>
                            {renderSortHeader('keyword', 'Keyword Query')}
                            {renderSortHeader('country', 'Country')}
                            {renderSortHeader('category', 'Category')}
                            {renderSortHeader('clicks', 'Clicks', true)}
                            {renderSortHeader('impressions', 'Impressions', true)}
                            {renderSortHeader('ctr', 'CTR', true)}
                            {renderSortHeader('prevPosition', 'Prior Pos', true)}
                            {renderSortHeader('currentPosition', 'Sync Date Pos', true)}
                            {renderSortHeader('change', 'Rank Change', true)}
                          </>
                        )}

                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      
                      {paginatedTabItems.map((item: any, itemIdx: number) => (
                        <tr key={itemIdx} className="hover:bg-slate-50/40 transition-all-200">
                          
                          {/* Tab 1: Queries */}
                          {activeTab === 'queries' && (
                            <>
                              <td className="py-3.5 px-4 font-semibold text-slate-800">
                                <div className="flex flex-col">
                                  <div className="flex items-center">
                                    <span>{item.keyword}</span>
                                    {item.isCannibalized && (
                                      <span className="inline-flex items-center ml-2 px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 text-[9px] font-bold cursor-help group relative">
                                        <AlertTriangle className="h-3 w-3 mr-0.5 shrink-0" />
                                        <span>Cannibalized</span>
                                        <span className="absolute bottom-6 left-1/2 transform -translate-x-1/2 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-[9px] font-normal rounded shadow-md z-30 leading-tight pointer-events-none">
                                          Warning: Multiple URLs competing for this keyword. Merge content.
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* URL Hover card SERP Preview */}
                                  {item.ranking_url && (
                                    <div className="relative group self-start mt-1">
                                      <a
                                        href={item.ranking_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center space-x-1 text-[10px] text-slate-400 hover:text-indigo-650 truncate max-w-[200px]"
                                      >
                                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                        <span className="truncate">{item.ranking_url.replace(/https?:\/\/(www\.)?/, '')}</span>
                                      </a>

                                      {/* Floating SERP Mockup preview */}
                                      <div className="absolute left-0 top-5 z-40 hidden group-hover:block w-80 p-4 bg-white border border-slate-200 rounded-xl shadow-xl pointer-events-none transition-all-200 text-left">
                                        <div className="text-[10px] text-slate-500 font-semibold mb-1 flex items-center">
                                          <Globe className="h-2.5 w-2.5 mr-1" />
                                          <span>{item.ranking_url.replace(/https?:\/\//, '')}</span>
                                        </div>
                                        <div className="text-xs font-bold text-indigo-700 leading-snug mb-1">
                                          {item.keyword ? `${item.keyword.charAt(0).toUpperCase() + item.keyword.slice(1)} | WPoets SEO` : 'RankStack SEO Landing Page'}
                                        </div>
                                        <div className="text-[10px] text-slate-650 leading-normal">
                                          Learn how to audit {item.keyword || 'target page ranking'} on GSC. RankStack integrates real search intent splits, Core update overlaps, and annotation test tracking.
                                        </div>
                                        <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-amber-600">
                                          <div className="flex items-center">
                                            <span>⭐⭐⭐⭐⭐ 4.9</span>
                                            <span className="text-slate-400 ml-1">(120 reviews)</span>
                                          </div>
                                          <span className="text-slate-400 font-mono">Last Crawled 1d ago</span>
                                        </div>
                                      </div>

                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-mono text-slate-500 font-semibold">{item.country}</td>
                              
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 rounded-full font-semibold border text-[10px] bg-slate-50 border-slate-200 text-slate-600">
                                  {item.category}
                                </span>
                              </td>

                              <td className="py-3.5 px-4">
                                <span className={`px-2 py-0.5 rounded-full font-semibold border text-[10px] ${
                                  item.intent === 'Commercial'
                                    ? 'border-indigo-100 bg-indigo-50 text-indigo-700'
                                    : item.intent === 'Transactional'
                                    ? 'border-purple-100 bg-purple-50 text-purple-700'
                                    : item.intent === 'Navigational'
                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-600'
                                }`}>
                                  {item.intent}
                                </span>
                              </td>

                              {isApiCompareMode ? (
                                <>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-850">{item.clicksB.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-bold">
                                    <span className={item.clicksDiff >= 0 ? 'text-emerald-600' : 'text-red-655 text-red-600'}>
                                      {item.clicksDiff >= 0 ? '+' : ''}{item.clicksDiff.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right text-slate-450">{item.impressionsB.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-650">{formatPercent(item.ctr)}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-500">{formatPercent(item.ctrB)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-mono">{item.position.toFixed(1)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-600 font-mono">{item.positionB.toFixed(1)}</td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-650">{formatPercent(item.ctr)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-mono">{item.position.toFixed(1)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold">
                                    {item.change > 0 ? (
                                      <span className="text-emerald-600 inline-flex items-center">
                                        <TrendingUp className="h-3 w-3 mr-0.5" />
                                        <span>+{item.change.toFixed(1)}</span>
                                      </span>
                                    ) : item.change < 0 ? (
                                      <span className="text-red-650 inline-flex items-center">
                                        <TrendingDown className="h-3 w-3 mr-0.5" />
                                        <span>{item.change.toFixed(1)}</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-mono">-</span>
                                    )}
                                  </td>
                                </>
                              )}
                            </>
                          )}

                          {/* Tab: Last Sync Changes */}
                          {activeTab === 'changes' && (
                            <>
                              <td className="py-3.5 px-4 font-semibold text-slate-800">
                                {item.keyword}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-500 font-semibold">{item.country}</td>
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 rounded-full font-semibold border text-[10px] bg-slate-50 border-slate-200 text-slate-600">
                                  {item.category}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                              <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                              <td className="py-3.5 px-4 text-right font-mono text-slate-650">{formatPercent(item.ctr)}</td>
                              
                              <td className="py-3.5 px-4 text-right text-slate-500 font-mono">
                                {item.prevPosition !== null ? item.prevPosition.toFixed(1) : '-'}
                              </td>
                              <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-mono">
                                {item.currentPosition.toFixed(1)}
                              </td>
                              
                              <td className="py-3.5 px-4 text-right font-bold">
                                {item.change === null ? (
                                  <span className="px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold">
                                    New
                                  </span>
                                ) : item.change > 0 ? (
                                  <span className="text-emerald-600 inline-flex items-center">
                                    <TrendingUp className="h-3 w-3 mr-0.5" />
                                    <span>+{item.change.toFixed(1)}</span>
                                  </span>
                                ) : item.change < 0 ? (
                                  <span className="text-red-650 inline-flex items-center">
                                    <TrendingDown className="h-3 w-3 mr-0.5" />
                                    <span>{item.change.toFixed(1)}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-mono">-</span>
                                )}
                              </td>
                            </>
                          )}

                          {/* Tab 2: Pages */}
                          {activeTab === 'pages' && (
                            <>
                              <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-sm truncate relative group">
                                <a
                                  href={item.ranking_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-650 hover:underline inline-flex items-center"
                                >
                                  <span>{item.ranking_url.replace(/https?:\/\/(www\.)?/, '')}</span>
                                  <ExternalLink className="h-3 w-3 ml-1 shrink-0 text-slate-400" />
                                </a>

                                {/* Floating SERP preview for page list */}
                                <div className="absolute left-6 top-5 z-40 hidden group-hover:block w-80 p-4 bg-white border border-slate-200 rounded-xl shadow-xl pointer-events-none text-left">
                                  <div className="text-[10px] text-slate-500 font-semibold mb-1 flex items-center">
                                    <Globe className="h-2.5 w-2.5 mr-1" />
                                    <span>{item.ranking_url.replace(/https?:\/\//, '')}</span>
                                  </div>
                                  <div className="text-xs font-bold text-indigo-750 leading-snug mb-1">
                                    SaaS Landing Page | WPoets Search Rank
                                  </div>
                                  <div className="text-[10px] text-slate-650 leading-normal">
                                    Comprehensive SEO metrics tracker. Overlapping dashboard views for cannibalized organic traffic. Checked on schema article markup.
                                  </div>
                                  <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-amber-600">
                                    <div className="flex items-center">
                                      <span>⭐⭐⭐⭐⭐ 4.9</span>
                                      <span className="text-slate-400 ml-1">(120 reviews)</span>
                                    </div>
                                    <span className="text-slate-400 font-mono">Mobile Friendly</span>
                                  </div>
                                </div>

                              </td>
                              {isApiCompareMode ? (
                                <>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-850">{item.clicksB.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-bold">
                                    <span className={item.clicksDiff >= 0 ? 'text-emerald-600' : 'text-red-650'}>
                                      {item.clicksDiff >= 0 ? '+' : ''}{item.clicksDiff.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right text-slate-450">{item.impressionsB.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-600">{formatPercent(item.ctr)}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-500">{formatPercent(item.ctrB)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-mono">{item.position.toFixed(1)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-600 font-mono">{item.positionB.toFixed(1)}</td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-600">{formatPercent(item.ctr)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-850 font-mono">{item.position.toFixed(1)}</td>
                                </>
                              )}
                            </>
                          )}

                          {/* Tab 3: Countries */}
                          {activeTab === 'countries' && (
                            <>
                              <td className="py-3.5 px-4 font-bold text-slate-800 uppercase font-mono">{item.code}</td>
                              {isApiCompareMode ? (
                                <>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-850">{item.clicksB.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-bold">
                                    <span className={item.clicksDiff >= 0 ? 'text-emerald-600' : 'text-red-650'}>
                                      {item.clicksDiff >= 0 ? '+' : ''}{item.clicksDiff.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right text-slate-450">{item.impressionsB.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-650">{formatPercent(item.ctr)}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-550">{formatPercent(item.ctrB)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-mono">{item.position.toFixed(1)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-600 font-mono">{item.positionB.toFixed(1)}</td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-600">{formatPercent(item.ctr)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-mono">{item.position.toFixed(1)}</td>
                                </>
                              )}
                            </>
                          )}

                          {/* Tab 4: Devices */}
                          {activeTab === 'devices' && (
                            <>
                              <td className="py-3.5 px-4 font-semibold text-slate-800 flex items-center">
                                {item.name === 'Desktop' ? <Laptop className="h-4 w-4 text-indigo-500 mr-2" /> :
                                 item.name === 'Mobile' ? <Smartphone className="h-4 w-4 text-purple-500 mr-2" /> :
                                 <Tablet className="h-4 w-4 text-emerald-500 mr-2" />}
                                <span>{item.name}</span>
                              </td>
                              {isApiCompareMode ? (
                                <>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-850">{item.clicksB.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-bold">
                                    <span className={item.clicksDiff >= 0 ? 'text-emerald-600' : 'text-red-650'}>
                                      {item.clicksDiff >= 0 ? '+' : ''}{item.clicksDiff.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right text-slate-450">{item.impressionsB.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-600">{formatPercent(item.ctr)}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-500">{formatPercent(item.ctrB)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-mono">{item.position.toFixed(1)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-600 font-mono">{item.positionB.toFixed(1)}</td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-650">{formatPercent(item.ctr)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-mono">{item.position.toFixed(1)}</td>
                                </>
                              )}
                            </>
                          )}

                          {/* Tab 5: Appearances */}
                          {activeTab === 'appearances' && (
                            <>
                              <td className="py-3.5 px-4 font-semibold text-slate-800">{item.name}</td>
                              {isApiCompareMode ? (
                                <>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-850">{item.clicksB.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-bold">
                                    <span className={item.clicksDiff >= 0 ? 'text-emerald-600' : 'text-red-650'}>
                                      {item.clicksDiff >= 0 ? '+' : ''}{item.clicksDiff.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right text-slate-450">{item.impressionsB.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-600">{formatPercent(item.ctr)}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-500">{formatPercent(item.ctrB)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-mono">{item.position.toFixed(1)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-600 font-mono">{item.positionB.toFixed(1)}</td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-650">{formatPercent(item.ctr)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-mono">{item.position.toFixed(1)}</td>
                                </>
                              )}
                            </>
                          )}

                          {/* Tab 6: Days */}
                          {activeTab === 'days' && (
                            <>
                              <td className="py-3.5 px-4 font-semibold text-slate-800 font-mono">{item.date}</td>
                              {isApiCompareMode ? (
                                <>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-850">{item.clicksB.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-bold">
                                    <span className={item.clicksDiff >= 0 ? 'text-emerald-600' : 'text-red-650'}>
                                      {item.clicksDiff >= 0 ? '+' : ''}{item.clicksDiff.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right text-slate-450">{item.impressionsB.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-650">{formatPercent(item.ctr)}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-500">{formatPercent(item.ctrB)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-850 font-mono">{item.position.toFixed(1)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-600 font-mono">{item.positionB.toFixed(1)}</td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                                  <td className="py-3.5 px-4 text-right font-mono text-slate-650">{formatPercent(item.ctr)}</td>
                                  <td className="py-3.5 px-4 text-right font-bold text-slate-850 font-mono">{item.position.toFixed(1)}</td>
                                </>
                              )}
                            </>
                          )}

                          {/* Tab 7: Cannibalization Explorer */}
                          {activeTab === 'cannibalization' && (
                            <>
                              <td className="py-3.5 px-4 font-bold text-slate-800">{item.keyword}</td>
                              <td className="py-3.5 px-4 space-y-1.5 max-w-lg">
                                {item.urls.map((u: string, uIdx: number) => {
                                  const isWinner = uIdx === 0;
                                  return (
                                    <div key={uIdx} className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${
                                      isWinner 
                                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950 font-medium' 
                                        : 'bg-white border-slate-150 text-slate-550'
                                    }`}>
                                      <div className="flex items-center space-x-1.5 truncate">
                                        {isWinner ? (
                                          <span className="shrink-0 bg-emerald-500 text-white rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide">
                                            Winner
                                          </span>
                                        ) : (
                                          <span className="shrink-0 bg-slate-200 text-slate-600 rounded px-1.5 py-0.5 text-[9px] font-bold">
                                            Competing
                                          </span>
                                        )}
                                        <a href={u} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                                          {u.replace(/https?:\/\/(www\.)?/, '')}
                                        </a>
                                      </div>
                                      <span className="shrink-0 font-mono text-[10px] pl-2 text-slate-500">
                                        Winner gets most click share
                                      </span>
                                    </div>
                                  );
                                })}
                              </td>
                              <td className="py-3.5 px-4 text-right font-bold text-slate-800">{item.clicks.toLocaleString()}</td>
                              <td className="py-3.5 px-4 text-right text-slate-500">{item.impressions.toLocaleString()}</td>
                              <td className="py-3.5 px-4 text-right font-bold text-slate-850 font-mono">{item.position.toFixed(1)}</td>
                            </>
                          )}

                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Table Pagination controls */}
              {totalTabItems > 0 && (
                <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Showing <strong className="text-slate-850">{(currentPage - 1) * pageSize + 1}</strong> to <strong className="text-slate-850">{Math.min(currentPage * pageSize, totalTabItems)}</strong> of <strong className="text-slate-850">{totalTabItems}</strong> items
                  </div>

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
                        className="h-8 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 text-xs font-semibold rounded-lg shadow-sm transition-all-200"
                      >
                        Jump
                      </button>
                    </form>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* Add Annotation Dialog Modal */}
      {isAnnotationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-800">Create SEO Annotation</h3>
              <button
                onClick={() => setIsAnnotationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAnnotation} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Date (YYYY-MM-DD)</label>
                <input
                  type="date"
                  value={selectedDateForAnnotation}
                  onChange={e => setSelectedDateForAnnotation(e.target.value)}
                  required
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Annotation Title</label>
                <input
                  type="text"
                  placeholder="e.g. Migrated site headers / optimized title tags"
                  value={annotationTitle}
                  onChange={e => setAnnotationTitle(e.target.value)}
                  required
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Description (Optional)</label>
                <textarea
                  placeholder="Add details of what changed for this SEO iteration..."
                  value={annotationDescription}
                  onChange={e => setAnnotationDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs text-slate-700 outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Associate with Keyword (Optional)</label>
                <select
                  value={annotationKeyword}
                  onChange={e => setAnnotationKeyword(e.target.value)}
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs text-slate-750 outline-none focus:border-indigo-500"
                >
                  <option value="">No specific keyword</option>
                  {keywords.map((k: any) => (
                    <option key={k.id} value={k.id}>{k.keyword} ({k.country})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">Associate with URL (Optional)</label>
                <select
                  value={annotationUrl}
                  onChange={e => setAnnotationUrl(e.target.value)}
                  className="w-full h-10 border border-slate-200 rounded-xl px-3 text-xs text-slate-750 outline-none focus:border-indigo-500"
                >
                  <option value="">No specific URL</option>
                  {pages.map((p: any, idx: number) => (
                    <option key={idx} value={p.ranking_url}>{p.ranking_url.replace(/https?:\/\/(www\.)?/, '')}</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAnnotationModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-650 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-100"
                >
                  Save Annotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
