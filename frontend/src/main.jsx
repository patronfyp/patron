import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider } from 'antd'

import './index.css'
import App from './App.jsx'

// One client for the whole app: it owns the cache of everything fetched from
// the backend, so two components asking for the same data share one request.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        <AntApp>
          <App />
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
)
