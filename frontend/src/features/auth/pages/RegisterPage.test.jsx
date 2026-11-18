import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Imported directly to mock it; app code uses the barrel.
// eslint-disable-next-line no-restricted-imports
import { acceptCompanyInvite, previewCompanyInvite } from '@/features/companies/api/companies.api'

import { login, register } from '../api/auth.api'

import RegisterPage from './RegisterPage'

vi.mock('../api/auth.api', () => ({
  register: vi.fn(),
  login: vi.fn(),
}))

vi.mock('@/features/companies/api/companies.api', () => ({
  previewCompanyInvite: vi.fn(),
  acceptCompanyInvite: vi.fn(),
}))

function renderPage(initialEntries = ['/register']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/start" element={<div>Protected home</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

async function fillValidForm(user) {
  await user.type(screen.getByLabelText(/full name/i), 'Jane Doe')
  await user.type(screen.getByLabelText(/email/i), 'jane@example.com')
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.type(screen.getByLabelText(/confirm password/i), 'password123')
  await user.click(screen.getByRole('checkbox', { name: /terms of service/i }))
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('renders the registration form', () => {
    renderPage()

    expect(screen.getByLabelText(/full name/i)).toBeVisible()
    expect(screen.getByLabelText(/email/i)).toBeVisible()
    expect(screen.getByLabelText('Password')).toBeVisible()
    expect(screen.getByLabelText(/confirm password/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /create account/i })).toBeVisible()
  })

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /create account/i }))

    // antd's error text fades in via CSS transition - jsdom never finishes that
    // animation, so it stays "in the document" without ever reporting visible.
    expect(await screen.findByText('Full name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('calls the API with the right payload and logs in on success', async () => {
    const user = userEvent.setup()
    register.mockResolvedValue({ id: 1, email: 'jane@example.com' })
    login.mockResolvedValue({ access_token: 'token-123', refresh_token: 'refresh-123' })
    renderPage()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'password123',
        role: 'candidate',
      })
    })
    expect(login).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'password123',
    })
  })

  it('starts on Candidate and sends whichever role card is picked', async () => {
    const user = userEvent.setup()
    register.mockResolvedValue({ id: 'user-1', email: 'jane@example.com' })
    login.mockResolvedValue({ access_token: 'token-123', refresh_token: 'refresh-123' })
    renderPage()

    expect(screen.getByRole('radio', { name: /get referred/i })).toBeChecked()

    await user.click(screen.getByText('Hire talent'))
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith(expect.objectContaining({ role: 'recruiter' }))
    })
  })

  it('remembers the picked role for SelectRolePage, in case LinkedIn sign-up needs it (#75)', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(sessionStorage.getItem('patron:picked-role')).toBe('candidate')

    await user.click(screen.getByText('Refer others'))

    expect(sessionStorage.getItem('patron:picked-role')).toBe('referrer')
  })

  it('blocks submit until the terms checkbox is checked', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/full name/i), 'Jane Doe')
    await user.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    // Deliberately not checking the terms checkbox.
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(
      await screen.findByText('You must agree to the Terms of Service and Privacy Policy'),
    ).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('shows a password strength label and hint once typing starts', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.queryByText('12+ chars, a number, a symbol')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Password'), 'weak')
    expect(await screen.findByText('Too short')).toBeInTheDocument()
    expect(screen.getByText('12+ chars, a number, a symbol')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Password'), 'pass1234!longer12')
    expect(await screen.findByText('Strong password')).toBeInTheDocument()
  })

  it('previews a team invite link, prefills and locks the email', async () => {
    previewCompanyInvite.mockResolvedValue({
      company_name: 'Garner',
      company_domain: 'garner.com',
      email: 'new.hire@garner.com',
      role: 'hiring_manager',
    })
    renderPage(['/register?invite=tok-1'])

    expect(
      await screen.findByText(
        (_text, node) => node?.textContent === 'Garner invited you to join as Hiring manager.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toHaveValue('new.hire@garner.com')
    expect(screen.getByLabelText(/email/i)).toBeDisabled()
    expect(screen.queryByRole('radio', { name: /get referred/i })).not.toBeInTheDocument()
    expect(previewCompanyInvite.mock.calls[0][0]).toBe('tok-1')
  })

  it('registers normally when the invite token is bad - no banner, no blocked email', async () => {
    previewCompanyInvite.mockRejectedValue({ response: { status: 404 } })
    renderPage(['/register?invite=expired-tok'])

    await waitFor(() => expect(previewCompanyInvite).toHaveBeenCalled())
    expect(screen.queryByText(/invited you/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeEnabled()
  })

  it('accepts the invite after signing up, then goes home', async () => {
    const user = userEvent.setup()
    previewCompanyInvite.mockResolvedValue({
      company_name: 'Garner',
      company_domain: 'garner.com',
      email: 'new.hire@garner.com',
      role: 'hiring_manager',
    })
    acceptCompanyInvite.mockResolvedValue({ id: 'c-1', name: 'Garner' })
    register.mockResolvedValue({ id: 'user-1', email: 'new.hire@garner.com' })
    login.mockResolvedValue({ access_token: 'token-123', refresh_token: 'refresh-123' })
    renderPage(['/register?invite=tok-1'])

    await screen.findByDisplayValue('new.hire@garner.com')
    await user.type(screen.getByLabelText(/full name/i), 'New Hire')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('checkbox', { name: /terms of service/i }))
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await screen.findByText('Protected home')
    expect(acceptCompanyInvite.mock.calls[0][0]).toBe('tok-1')
    // An invitee is a recruiter only, so the backend gives them the 1-step wizard.
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ role: 'recruiter' }))
  })

  it('still signs the user in if accepting the invite fails', async () => {
    const user = userEvent.setup()
    previewCompanyInvite.mockResolvedValue({
      company_name: 'Garner',
      company_domain: 'garner.com',
      email: 'new.hire@garner.com',
      role: 'hiring_manager',
    })
    acceptCompanyInvite.mockRejectedValue({
      response: { data: { detail: 'This invite has already been used.' } },
    })
    register.mockResolvedValue({ id: 'user-1', email: 'new.hire@garner.com' })
    login.mockResolvedValue({ access_token: 'token-123', refresh_token: 'refresh-123' })
    renderPage(['/register?invite=tok-1'])

    await screen.findByDisplayValue('new.hire@garner.com')
    await user.type(screen.getByLabelText(/full name/i), 'New Hire')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('checkbox', { name: /terms of service/i }))
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('This invite has already been used.')).toBeInTheDocument()
    expect(await screen.findByText('Protected home')).toBeInTheDocument()
  })

  it('shows the server error on a duplicate email', async () => {
    const user = userEvent.setup()
    register.mockRejectedValue({
      response: { data: { detail: 'An account with this email already exists' } },
    })
    renderPage()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })
})
