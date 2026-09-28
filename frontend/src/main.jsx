import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntApp, ConfigProvider } from 'antd'
import { RouterProvider } from 'react-router-dom'

import './index.css'
import AuthProvider from './app/providers/AuthProvider'
import { router } from './app/router/routes'
import { theme } from './config/theme'
import { setupAuthClient } from './features/auth'

// Lets the shared API client read the session's access token (see setupAuthClient).
setupAuthClient()

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
      <ConfigProvider theme={theme}>
        <AntApp>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
)
