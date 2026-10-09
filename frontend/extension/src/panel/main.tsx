import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './panel.css';
import { Panel } from './Panel';

const consultas = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <QueryClientProvider client={consultas}>
        <Panel />
      </QueryClientProvider>
    </StrictMode>,
  );
}
