import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fakeNetwork, ok, restoreNetwork } from '@/test/fakeNetwork'

import PeopleSearch from './PeopleSearch'

const result = (id, name, relationship = 'none', extra = {}) => ({
  user_id: id,
  full_name: name,
  photo_url: null,
  avatar_url: null,
  headline: null,
  job_title: 'Engineer',
  employer_name: 'Garner',
  university: null,
  university_verified: false,
  employer_verified: false,
  relationship,
  request_id: relationship === 'pending_received' ? 'r-1' : null,
  ...extra,
})

const PEOPLE = [
  result('u-1', 'Bilal Khan', 'none', { employer_verified: true }),
  result('u-2', 'Bilal Ahmed', 'connected'),
  result('u-3', 'Bilqis Noor', 'pending_received'),
]

function renderSearch({ people = PEOPLE, onClose = vi.fn() } = {}) {
  const calls = []
  fakeNetwork((config) => {
    calls.push({ method: config.method, url: config.url, params: config.params })
    if (config.url === '/api/v1/people') return ok(config, people)
    return ok(config, {})
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/', element: <PeopleSearch open onClose={onClose} /> },
      { path: '/profile/:userId', element: <p>Profile page</p> },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </QueryClientProvider>,
  )
  return { calls, router, onClose }
}

const box = () => screen.getByRole('textbox', { name: 'Search people' })

describe('PeopleSearch', () => {
  afterEach(() => restoreNetwork())

  it('asks for 2 letters before searching anything', async () => {
    const { calls } = renderSearch()

    expect(await screen.findByText(/at least 2 letters/)).toBeInTheDocument()
    await userEvent.setup().type(box(), 'b')

    expect(calls.filter((call) => call.url === '/api/v1/people')).toHaveLength(0)
  })

  it('searches after a pause and shows each person with the right button', async () => {
    const { calls } = renderSearch()

    await userEvent.setup().type(box(), 'bil')

    const list = await screen.findByRole('listbox', { name: 'People' })
    expect(within(list).getAllByRole('option')).toHaveLength(3)
    expect(within(list).getByText('Bilal Khan')).toBeInTheDocument()
    expect(within(list).getByText('Employee verified')).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'Connect' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: /Connected/ })).toBeDisabled()
    expect(within(list).getByRole('button', { name: 'Accept' })).toBeInTheDocument()
    // One search for the whole word, not one per letter.
    const searches = calls.filter((call) => call.url === '/api/v1/people')
    expect(searches).toHaveLength(1)
    expect(searches[0].params).toEqual({ q: 'bil' })
  })

  it('connects from a result', async () => {
    const { calls } = renderSearch()
    const user = userEvent.setup()

    await user.type(box(), 'bil')
    await user.click(await screen.findByRole('button', { name: 'Connect' }))

    await waitFor(() =>
      expect(
        calls.some((call) => call.method === 'post' && call.url === '/api/v1/connections/requests'),
      ).toBe(true),
    )
  })

  it('moves with the arrow keys and opens the highlighted profile on Enter', async () => {
    const { router, onClose } = renderSearch()
    const user = userEvent.setup()

    await user.type(box(), 'bil')
    const list = await screen.findByRole('listbox', { name: 'People' })
    expect(within(list).getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowDown}')
    expect(within(list).getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(within(list).getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(router.state.location.pathname).toBe('/profile/u-3'))
    expect(onClose).toHaveBeenCalled()
  })

  it('opens a profile when a person is clicked', async () => {
    const { router } = renderSearch()
    const user = userEvent.setup()

    await user.type(box(), 'bil')
    await user.click(await screen.findByText('Bilal Khan'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/profile/u-1'))
  })

  it('says so when no one is found', async () => {
    renderSearch({ people: [] })

    await userEvent.setup().type(box(), 'zzz')

    expect(await screen.findByText('No one found for “zzz”.')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const { onClose } = renderSearch()

    await userEvent.setup().keyboard('{Escape}')

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
