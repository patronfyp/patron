import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { confirmPasswordReset } from '../api/auth.api'

import ResetPasswordPage from './ResetPasswordPage'

vi.mock('../api/auth.api', () => ({
  confirmPasswordReset: vi.fn(),
}))

function renderPage(path = '/reset-password?token=good-token') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/login" element={<div>Sign in page</div>} />
            <Route path="/forgot-password" element={<div>Request page</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

async function fillAndSubmit(user, password = 'newpassword123') {
  await user.type(screen.getByLabelText('New password'), password)
  await user.type(screen.getByLabelText('Confirm password'), password)
  await user.click(screen.getByRole('button', { name: /reset password/i }))
}

describe('ResetPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends the token from the URL with the new password, and redirects to sign in', async () => {
    const user = userEvent.setup()
    confirmPasswordReset.mockResolvedValue({})
    renderPage()

    await fillAndSubmit(user)

    expect(confirmPasswordReset.mock.calls[0][0]).toEqual({
      token: 'good-token',
      newPassword: 'newpassword123',
    })
    expect(await screen.findByText('Sign in page')).toBeInTheDocument()
  })

  it('rejects mismatched passwords before submitting', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('New password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm password'), 'somethingelse')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(confirmPasswordReset).not.toHaveBeenCalled()
  })

  it('shows a request-a-new-link screen with no token in the URL', () => {
    renderPage('/reset-password')

    expect(screen.getByText(/link no longer works/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  })

  it('shows the same request-a-new-link screen on an expired or used token', async () => {
    const user = userEvent.setup()
    confirmPasswordReset.mockRejectedValue({
      response: {
        status: 400,
        data: { detail: 'This reset link has expired or already been used.' },
      },
    })
    renderPage()

    await fillAndSubmit(user)

    expect(await screen.findByText(/link no longer works/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument()
  })

  it('shows a plain form error, not the expired-link screen, for other failures', async () => {
    const user = userEvent.setup()
    confirmPasswordReset.mockRejectedValue({
      response: { status: 503, data: { detail: 'Could not reach the server' } },
    })
    renderPage()

    await fillAndSubmit(user)

    expect(await screen.findByText('Could not reach the server')).toBeInTheDocument()
    expect(screen.queryByText(/link no longer works/i)).not.toBeInTheDocument()
  })
})
