import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { changePassword } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'

import SettingsPage from './SettingsPage'

vi.mock('../api/auth.api', () => ({
  changePassword: vi.fn(),
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={['/settings']}>
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/" element={<div>Home</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

async function fillAndSubmit(user, { current = 'old-password', next = 'newpassword123' } = {}) {
  await user.type(screen.getByLabelText('Current password'), current)
  await user.type(screen.getByLabelText('New password'), next)
  await user.type(screen.getByLabelText('Confirm new password'), next)
  await user.click(screen.getByRole('button', { name: /change password/i }))
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: { id: 1, email: 'jane@example.com' },
      accessToken: 'a',
      refreshToken: 'r',
    })
  })

  it('changes the password and clears the form on success', async () => {
    const user = userEvent.setup()
    changePassword.mockResolvedValue({ access_token: 'new-a', refresh_token: 'new-r' })
    renderPage()

    await fillAndSubmit(user)

    expect(changePassword.mock.calls[0][0]).toEqual({
      currentPassword: 'old-password',
      newPassword: 'newpassword123',
    })
    expect(await screen.findByText('Your password has been changed.')).toBeInTheDocument()
    expect(screen.getByLabelText('Current password')).toHaveValue('')
  })

  it('rejects mismatched new passwords before submitting', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Current password'), 'old-password')
    await user.type(screen.getByLabelText('New password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm new password'), 'somethingelse')
    await user.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('shows the backend message on a wrong current password', async () => {
    const user = userEvent.setup()
    changePassword.mockRejectedValue({
      response: { data: { detail: 'Your current password is incorrect.' } },
    })
    renderPage()

    await fillAndSubmit(user)

    expect(await screen.findByText('Your current password is incorrect.')).toBeInTheDocument()
  })

  it('shows the backend message for a LinkedIn-only account', async () => {
    const user = userEvent.setup()
    changePassword.mockRejectedValue({
      response: {
        data: {
          detail: "Your account doesn't have a password yet. Use 'Forgot password' to set one.",
        },
      },
    })
    renderPage()

    await fillAndSubmit(user)

    expect(
      await screen.findByText(
        "Your account doesn't have a password yet. Use 'Forgot password' to set one.",
      ),
    ).toBeInTheDocument()
  })

  it('links back home', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('link', { name: /back/i }))

    expect(await screen.findByText('Home')).toBeInTheDocument()
  })
})
