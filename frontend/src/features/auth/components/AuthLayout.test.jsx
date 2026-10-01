import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { linkedinAuthorize } from '../api/auth.api'

import AuthLayout from './AuthLayout'

vi.mock('../api/auth.api', () => ({
  linkedinAuthorize: vi.fn(),
}))

function renderLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={['/login']}>
          <AuthLayout title="Welcome back" subtitle="Sign in to your Patron account.">
            <div>Form content</div>
          </AuthLayout>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

describe('AuthLayout', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { ...window.location, href: '' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('renders the tabs, the page content, and the LinkedIn button', () => {
    renderLayout()

    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create account' })).toBeInTheDocument()
    expect(screen.getByText('Form content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with linkedin/i })).toBeInTheDocument()
  })

  it('sends the browser to LinkedIn on click', async () => {
    const user = userEvent.setup()
    linkedinAuthorize.mockResolvedValue({
      authorize_url: 'https://www.linkedin.com/oauth/v2/authorization?client_id=abc',
    })

    renderLayout()
    await user.click(screen.getByRole('button', { name: /continue with linkedin/i }))

    await waitFor(() => {
      expect(window.location.href).toBe(
        'https://www.linkedin.com/oauth/v2/authorization?client_id=abc',
      )
    })
  })
})
