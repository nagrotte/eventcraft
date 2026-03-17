'use client';

import { Amplify } from 'aws-amplify';
import { amplifyConfig } from '@/lib/amplify-config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

Amplify.configure(amplifyConfig);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry:     1
      }
    }
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
