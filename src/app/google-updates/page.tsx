'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, HelpCircle, ExternalLink, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { GoogleUpdateEvent } from '@/lib/google-updates-data';

export default function GoogleUpdatesPage() {
  // Fetch Google updates
  const { data: updates = [], isLoading, isError, refetch } = useQuery<GoogleUpdateEvent[]>({
    queryKey: ['google-updates'],
    queryFn: async () => {
      const res = await fetch('/api/google-updates');
      if (!res.ok) throw new Error('Failed to fetch Google updates');
      return res.json();
    }
  });

  const getTypeStyle = (type: GoogleUpdateEvent['type']) => {
    switch (type) {
      case 'core':
        return 'border-indigo-200 bg-indigo-50 text-indigo-700';
      case 'spam':
        return 'border-red-200 bg-red-50 text-red-700';
      case 'helpful_content':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'reviews':
        return 'border-yellow-200 bg-yellow-50 text-yellow-750';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-650';
    }
  };

  const getTypeLabel = (type: GoogleUpdateEvent['type']) => {
    switch (type) {
      case 'core': return 'Core Update';
      case 'spam': return 'Spam Update';
      case 'helpful_content': return 'Helpful Content';
      case 'reviews': return 'Reviews Update';
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded" />
        <div className="h-48 w-full bg-white border border-slate-200 rounded-xl" />
        <div className="h-48 w-full bg-white border border-slate-200 rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-slate-805 mb-1">Failed to load updates</h3>
        <p className="text-slate-500 text-sm max-w-sm mb-6">
          There was an error retrieving the algorithm updates timeline.
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
            Google Algorithm Updates
          </h1>
          <p className="text-slate-550 text-sm mt-1">
            Timeline calendar of official Google Search core, spam, and helpful content core updates.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="h-10 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 rounded-xl text-xs font-semibold shadow-sm transition-all-200 flex items-center space-x-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5 animate-glow" />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Main timeline visual */}
      <div className="relative border-l border-slate-200 ml-4 pl-8 space-y-8 max-w-3xl">
        {updates.map((event) => (
          <div key={event.id} className="relative animate-in slide-in-from-bottom-3 duration-250">
            {/* Dot marker */}
            <div className="absolute -left-[45px] top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-250 shadow-sm">
              <Calendar className="h-4 w-4 text-indigo-600" />
            </div>

            {/* Event Card */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-slate-800">{event.name}</h3>
                
                {/* Type Tag */}
                <span className={`inline-flex items-center text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${getTypeStyle(event.type)} shadow-sm`}>
                  {getTypeLabel(event.type)}
                </span>
              </div>

              {/* Date details */}
              <div className="text-xs text-slate-500 font-semibold">
                Rollout: <strong className="text-slate-700 font-mono">{event.startDate}</strong>
                {event.endDate && (
                  <>
                    <span> to </span>
                    <strong className="text-slate-700 font-mono">{event.endDate}</strong>
                  </>
                )}
              </div>

              {/* Description */}
              <p className="text-slate-600 text-sm leading-relaxed">
                {event.description}
              </p>

              {/* Link */}
              {event.documentationUrl && (
                <div className="pt-2">
                  <a
                    href={event.documentationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-all-200"
                  >
                    <span>View Search Central Documentation</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
