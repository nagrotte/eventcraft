'use client';

import { Amplify } from 'aws-amplify';
import { amplifyConfig } from '@/lib/amplify-config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { useState } from 'react';

Amplify.configure(amplifyConfig);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: 1 } }
  }));

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
