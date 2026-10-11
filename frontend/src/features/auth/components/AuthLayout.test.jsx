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

function renderLayout(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={['/login']}>
          <AuthLayout
            title="Welcome back"
            subtitle="Sign in to see who can refer you today."
            linkedInLabel="Continue with LinkedIn"
            footer="New to PATRON?"
            {...props}
          >
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

  it('renders the title, the page content, the footer, and the LinkedIn button', () => {
    renderLayout()

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.getByText('Form content')).toBeInTheDocument()
    expect(screen.getByText('New to PATRON?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with linkedin/i })).toBeInTheDocument()
  })

  it('leaves out the LinkedIn button when no label is given', () => {
    renderLayout({ linkedInLabel: undefined })

    expect(screen.queryByRole('button', { name: /linkedin/i })).not.toBeInTheDocument()
    expect(screen.queryByText('or')).not.toBeInTheDocument()
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
