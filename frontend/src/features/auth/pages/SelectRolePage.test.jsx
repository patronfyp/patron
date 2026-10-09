import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
    vi.clearAllMocks()
  })

  it('disables Continue until a role is chosen', () => {
    renderPage()

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('saves the chosen role and navigates home', async () => {
    const user = userEvent.setup()
    setRole.mockResolvedValue({ id: 1, email: 'jane@example.com', role: 'candidate' })

    renderPage()
    await user.click(screen.getByText('Candidate'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Home screen')).toBeInTheDocument()
    expect(setRole).toHaveBeenCalledWith('candidate')
    expect(useAuthStore.getState().user).toEqual({
      id: 1,
      email: 'jane@example.com',
      role: 'candidate',
    })
  })

  it('shows an error message if saving the role fails', async () => {
    const user = userEvent.setup()
    setRole.mockRejectedValue(new Error('network error'))

    renderPage()
    await user.click(screen.getByText('Candidate'))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByText('Could not save your role. Please try again.'),
    ).toBeInTheDocument()
  })
})
