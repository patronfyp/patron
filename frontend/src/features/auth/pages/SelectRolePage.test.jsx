import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setRole } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'

import SelectRolePage from './SelectRolePage'

vi.mock('../api/auth.api', () => ({
  setRole: vi.fn(),
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={['/select-role']}>
          <Routes>
            <Route path="/select-role" element={<SelectRolePage />} />
            <Route path="/start" element={<div>Home screen</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

describe('SelectRolePage', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    vi.clearAllMocks()
  })

  it('disables Continue until a role is chosen', () => {
    renderPage()

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('offers the three roles a user can pick - never admin', () => {
    renderPage()

    const options = screen.getAllByRole('radio').map((radio) => radio.value)
    expect(options).toEqual(['candidate', 'referrer', 'recruiter'])
  })

  it('pre-selects the role remembered from Create account (#75)', () => {
    sessionStorage.setItem('patron:picked-role', 'recruiter')

    renderPage()

    expect(screen.getByRole('radio', { name: /hire talent/i })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  it('forgets the remembered role once it is saved', async () => {
    sessionStorage.setItem('patron:picked-role', 'recruiter')
    const user = userEvent.setup()
    setRole.mockResolvedValue({ id: 'user-1', email: 'jane@example.com', roles: ['recruiter'] })

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByText('Home screen')
    expect(sessionStorage.getItem('patron:picked-role')).toBeNull()
  })

  it('saves the chosen role and navigates home', async () => {
    const user = userEvent.setup()
    setRole.mockResolvedValue({ id: 'user-1', email: 'jane@example.com', roles: ['referrer'] })

    renderPage()
    await user.click(screen.getByText('Refer others'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Home screen')).toBeInTheDocument()
    expect(setRole).toHaveBeenCalledWith('referrer')
    expect(useAuthStore.getState().user).toEqual({
      id: 'user-1',
      email: 'jane@example.com',
      roles: ['referrer'],
    })
  })

  it('shows an error message if saving the role fails', async () => {
    const user = userEvent.setup()
    setRole.mockRejectedValue(new Error('network error'))

    renderPage()
    await user.click(screen.getByText('Get referred'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByText('Could not save your role. Please try again.'),
    ).toBeInTheDocument()
  })
})
