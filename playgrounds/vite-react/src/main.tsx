import { Buffer } from 'buffer';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Network, SatsWagmiConfig } from '@gobob/sats-wagmi';

import './index.css';

// `@coinbase-wallet/sdk` uses `Buffer`
globalThis.Buffer = Buffer;

import App from './App.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1_000 * 60 * 60 * 24, // 24 hours
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: false,
      retry: 0
    },
    mutations: { networkMode: 'offlineFirst' }
  }
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SatsWagmiConfig network={Network.testnet} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SatsWagmiConfig>
  </React.StrictMode>
);
