'use client';

import React from 'react';
import { AlertOctagon } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-slate-100 flex min-h-screen items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500 mb-6">
            <AlertOctagon className="h-8 w-8" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Critical System Error</h2>
          <p className="text-slate-400 max-w-md mb-6 text-sm">
            A critical layout-level error occurred: {error.message || 'Unknown error'}
          </p>
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-all-200 shadow-lg shadow-indigo-650/20"
          >
            Attempt Recovery
          </button>
        </div>
      </body>
    </html>
  );
}
