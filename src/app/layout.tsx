import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import { ProjectProvider } from '@/context/ProjectContext';
import Navbar from '@/components/Navbar';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RankStack - Keyword Rank Tracking & GSC Performance Engine',
  description: 'Keyword rank tracking that mirrors Google Search Console Performance with a fast dashboard for every keyword, country, and date range.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={outfit.className}>
      <body className="antialiased text-slate-800 min-h-screen flex flex-col bg-slate-50">
        <Providers>
          <ProjectProvider>
            <div className="flex flex-col min-h-screen">
              <Navbar />
              <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </main>
            </div>
          </ProjectProvider>
        </Providers>
      </body>
    </html>
  );
}
