'use client';

import React, { useEffect } from 'react';
import { AlertOctagon } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500 mb-6">
        <AlertOctagon className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Something went wrong!</h2>
      <p className="text-slate-400 max-w-md mb-6 text-sm">
        {error.message || 'An unexpected error occurred in the application.'}
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all-200"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-sm font-medium border border-white/5 transition-all-200"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
