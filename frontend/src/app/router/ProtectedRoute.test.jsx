import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/features/auth'

import ProtectedRoute from './ProtectedRoute'

function renderRoutes() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/login" element={<div>Login screen</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>Secret page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
})

describe('ProtectedRoute', () => {
  it('shows the page while there is a session', () => {
    useAuthStore.setState({ accessToken: 'token' })

    renderRoutes()

    expect(screen.getByText('Secret page')).toBeInTheDocument()
  })

  it('redirects to /login when there is no session', () => {
    renderRoutes()

    expect(screen.getByText('Login screen')).toBeInTheDocument()
  })

  // This is how a failed token refresh reaches the user: the API client clears
  // the store, and this route reacts - nothing navigates by hand.
  it('redirects to /login the moment the session is cleared', () => {
    useAuthStore.setState({ accessToken: 'token' })
    renderRoutes()

    act(() => useAuthStore.getState().clearSession())

    expect(screen.getByText('Login screen')).toBeInTheDocument()
  })
})
