import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { AxiosError } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/features/auth'
import { fakeNetwork, ok, restoreNetwork } from '@/test/fakeNetwork'

import EditProfilePage from './EditProfilePage'

const MY_PROFILE = {
  headline: 'Backend engineer',
  city: null,
  phone: null,
  linkedin_url: null,
  bio: 'I build APIs.',
  photo_url: null,
  university: null,
  degree: null,
  graduation_year: null,
  employer_name: null,
  cv: null,
  skills: ['Python'],
  primary_role: 'backend',
  desired_roles: [],
  work_mode: null,
  preferred_locations: [],
  salary_min: null,
  salary_max: null,
  available_from: null,
  open_to_referrers: false,
  onboarding_step: 7,
}

function unprocessable(config, detail) {
  const response = {
    data: { detail },
    status: 422,
    statusText: 'Unprocessable',
    headers: {},
    config,
  }
  return new AxiosError(
    'Request failed with status code 422',
    'ERR_BAD_REQUEST',
    config,
    null,
    response,
  )
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={['/profile/edit']}>
          <Routes>
            <Route path="/profile/edit" element={<EditProfilePage />} />
            <Route path="/profile/:userId" element={<div>Profile screen</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

describe('EditProfilePage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'u-1', full_name: 'Rohan Zubair', roles: ['candidate'] },
      accessToken: 'token',
    })
  })

  afterEach(() => {
    restoreNetwork()
    useAuthStore.setState({ user: null, accessToken: null })
  })

  it('starts from the saved profile', async () => {
    fakeNetwork((config) => ok(config, MY_PROFILE))
    renderPage()

    expect(await screen.findByLabelText('Headline')).toHaveValue('Backend engineer')
    expect(screen.getByLabelText('Short bio')).toHaveValue('I build APIs.')
  })

  it('saves with PATCH /profile/me and returns to the profile', async () => {
    const patches = []
    fakeNetwork((config) => {
      if (config.method === 'patch') {
        patches.push(JSON.parse(config.data))
        return ok(config, { ...MY_PROFILE, headline: 'Platform engineer' })
      }
      return ok(config, MY_PROFILE)
    })
    renderPage()

    const headline = await screen.findByLabelText('Headline')
    await userEvent.clear(headline)
    await userEvent.type(headline, 'Platform engineer')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Profile screen')).toBeInTheDocument()
    expect(patches).toHaveLength(1)
    expect(patches[0]).toMatchObject({ headline: 'Platform engineer', bio: 'I build APIs.' })
  })

  it("shows the backend's validation error under its field and stays on the page", async () => {
    fakeNetwork((config) => {
      if (config.method === 'patch') {
        throw unprocessable(config, [{ loc: ['body', 'bio'], msg: 'Bio is too long' }])
      }
      return ok(config, MY_PROFILE)
    })
    renderPage()

    await screen.findByLabelText('Short bio')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect((await screen.findAllByText('Bio is too long')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Profile screen')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })

  it('offers a retry when the profile cannot be loaded', async () => {
    let attempts = 0
    fakeNetwork((config) => {
      attempts += 1
      if (attempts === 1) throw unprocessable(config, 'down')
      return ok(config, MY_PROFILE)
    })
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(screen.getByLabelText('Headline')).toBeInTheDocument())
  })
})
