'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;
  days: number;      // approximate days in range (used as days param for API)
}

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESETS = [
  { label: 'Last 24 hours', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 28 days', days: 28 },
  { label: 'Last 3 months', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last 12 months', days: 365 },
  { label: 'Last 16 months', days: 480 },
];

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function presetToRange(days: number, label: string): DateRange {
  const end = new Date();
  end.setDate(end.getDate() - 2); // GSC data lags 2 days
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { startDate: toDateStr(start), endDate: toDateStr(end), label, days };
}

export function defaultDateRange(): DateRange {
  return presetToRange(28, 'Last 28 days');
}

export default function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'filter' | 'compare'>('filter');
  const [customStart, setCustomStart] = useState(value.startDate);
  const [customEnd, setCustomEnd] = useState(value.endDate);
  const [mode, setMode] = useState<'preset' | 'custom'>(
    PRESETS.some(p => p.label === value.label) ? 'preset' : 'custom'
  );
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync custom inputs when value changes externally
  useEffect(() => {
    setCustomStart(value.startDate);
    setCustomEnd(value.endDate);
    setMode(PRESETS.some(p => p.label === value.label) ? 'preset' : 'custom');
  }, [value]);

  const handlePreset = (days: number, label: string) => {
    const range = presetToRange(days, label);
    onChange(range);
    setMode('preset');
    setOpen(false);
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return;
    const start = new Date(customStart);
    const end = new Date(customEnd);
    if (start > end) return;
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400_000) + 1);
    onChange({ startDate: customStart, endDate: customEnd, label: 'Custom', days });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`h-10 px-4 flex items-center gap-2 rounded-xl text-sm font-semibold border transition-all duration-150 shadow-sm ${
          open
            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
            : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50'
        }`}
      >
        <Calendar className="h-4 w-4 shrink-0" />
        <span>{value.label}</span>
        <span className="text-slate-400 text-xs font-normal">
          {value.startDate} – {value.endDate}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-12 z-50 w-[420px] bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200/60 overflow-hidden animate-in slide-in-from-top-2 duration-150">
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {(['filter', 'compare'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  tab === t
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'filter' ? 'Filter' : 'Compare'}
              </button>
            ))}
          </div>

          {tab === 'filter' ? (
            <div className="p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Presets</p>
              <div className="space-y-0.5 mb-4">
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => handlePreset(p.days, p.label)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      value.label === p.label && mode === 'preset'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {/* Radio circle */}
                    <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      value.label === p.label && mode === 'preset'
                        ? 'border-indigo-600'
                        : 'border-slate-300'
                    }`}>
                      {value.label === p.label && mode === 'preset' && (
                        <span className="h-2 w-2 rounded-full bg-indigo-600" />
                      )}
                    </span>
                    {p.label}
                  </button>
                ))}

                {/* Custom option */}
                <button
                  onClick={() => setMode('custom')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'custom'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    mode === 'custom' ? 'border-indigo-600' : 'border-slate-300'
                  }`}>
                    {mode === 'custom' && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                  </span>
                  Custom
                </button>
              </div>

              {/* Custom date inputs */}
              {mode === 'custom' && (
                <div className="flex items-end gap-3 mt-3 pt-3 border-t border-slate-100">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Start date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={customStart}
                        max={customEnd}
                        onChange={e => setCustomStart(e.target.value)}
                        className="w-full h-9 px-3 pr-9 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">YYYY-MM-DD</p>
                  </div>
                  <span className="text-slate-400 font-medium mb-4">–</span>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      End date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={customEnd}
                        min={customStart}
                        onChange={e => setCustomEnd(e.target.value)}
                        className="w-full h-9 px-3 pr-9 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">YYYY-MM-DD</p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                {mode === 'custom' && (
                  <button
                    onClick={handleCustomApply}
                    disabled={!customStart || !customEnd}
                    className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Compare tab placeholder */
            <div className="p-6 text-center text-sm text-slate-500">
              <p className="font-semibold text-slate-700 mb-1">Date comparison</p>
              <p>Use the &quot;Filter Comparison&quot; panel in Advanced Filters to compare two date segments.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
