import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { fakeNetwork, ok, restoreNetwork } from '@/test/fakeNetwork'

import ConnectionsPage from './ConnectionsPage'

const person = (id, name, extra = {}) => ({
  user_id: id,
  full_name: name,
  photo_url: null,
  avatar_url: null,
  headline: null,
  job_title: 'Product Manager',
  employer_name: 'Motive',
  university: null,
  ...extra,
})

const connection = (id, name, type = 'professional', mutual = 12) => ({
  person: person(id, name),
  connection_type: type,
  mutual_count: mutual,
  connected_at: '2026-11-20T10:00:00Z',
})

/** A fake API: pages of connections, the two request lists, and a call log. */
function setup({ connections = [], received = [], sent = [], total } = {}) {
  const calls = []
  fakeNetwork((config) => {
    calls.push({ method: config.method, url: config.url, params: config.params })
    if (config.url === '/api/v1/connections' && config.method === 'get') {
      const { q, limit = 20, offset = 0 } = config.params ?? {}
      const matching = connections.filter(
        (item) => !q || item.person.full_name.toLowerCase().includes(q.toLowerCase()),
      )
      return ok(config, {
        items: matching.slice(offset, offset + limit),
        total: total ?? matching.length,
      })
    }
    if (config.url === '/api/v1/connections/requests' && config.method === 'get') {
      return ok(config, config.params.direction === 'received' ? received : sent)
    }
    return ok(config, {})
  })
  return calls
}

function renderPage(path = '/connections') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={[path]}>
          <ConnectionsPage />
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

describe('ConnectionsPage', () => {
  afterEach(() => restoreNetwork())

  it('shows each connection with its type, subline and mutual count', async () => {
    setup({
      connections: [
        connection('u-1', 'Hamza Naveed', 'both', 12),
        connection('u-2', 'Bilal Khan', 'professional', 0),
        connection('u-3', 'Maryam Iqbal', 'alumni', 1),
      ],
    })
    renderPage()

    expect(await screen.findByText('Hamza Naveed')).toBeInTheDocument()
    expect(screen.getByText('Professional + Alumni')).toBeInTheDocument()
    expect(screen.getByText('Alumni')).toBeInTheDocument()
    expect(screen.getByText('12 mutual')).toBeInTheDocument()
    expect(screen.getByText('No mutual connections')).toBeInTheDocument()
    expect(screen.getAllByText('Product Manager · Motive')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Hamza Naveed' })).toHaveAttribute(
      'href',
      '/profile/u-1',
    )
  })

  it('counts connections and waiting requests, and badges the tabs', async () => {
    setup({
      connections: [connection('u-1', 'Hamza Naveed')],
      received: [
        { id: 'r-1', direction: 'received', person: person('u-9', 'Sara Chen') },
        { id: 'r-2', direction: 'received', person: person('u-8', 'Omar Malik') },
      ],
      sent: [{ id: 'r-3', direction: 'sent', person: person('u-7', 'Zara Ali') }],
    })
    renderPage()

    expect(await screen.findByText('Requests (2)')).toBeInTheDocument()
    expect(screen.getByText('Sent (1)')).toBeInTheDocument()
    const stat = screen.getByRole('region', { name: 'Connections' })
    expect(await within(stat).findByText('1')).toBeInTheDocument()
  })

  it('searches the network after a pause, by name', async () => {
    const calls = setup({
      connections: [connection('u-1', 'Hamza Naveed'), connection('u-2', 'Bilal Khan')],
    })
    renderPage()
    await screen.findByText('Hamza Naveed')

    await userEvent.setup().type(screen.getByLabelText('Search your network'), 'bil')

    await waitFor(() => expect(screen.queryByText('Hamza Naveed')).not.toBeInTheDocument(), {
      timeout: 3000,
    })
    expect(await screen.findByText('Bilal Khan')).toBeInTheDocument()
    expect(calls.some((call) => call.params?.q === 'bil')).toBe(true)
    // One search after the pause, not one per keystroke.
    expect(calls.filter((call) => call.params?.q).length).toBe(1)
  })

  it('says so when nothing matches, and when there are no connections yet', async () => {
    setup({ connections: [] })
    renderPage()
    expect(await screen.findByText(/No connections yet/)).toBeInTheDocument()
  })

  it('loads more until everything is shown', async () => {
    const many = Array.from({ length: 30 }, (_, n) => connection(`u-${n}`, `Person ${n}`))
    setup({ connections: many })
    renderPage()

    await screen.findByText('Person 0')
    expect(screen.getAllByRole('article')).toHaveLength(24)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(30))
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('opens on the Requests tab from a link, and accepts a request', async () => {
    const calls = setup({
      received: [{ id: 'r-1', direction: 'received', person: person('u-9', 'Sara Chen') }],
    })
    renderPage('/connections?tab=requests')

    expect(await screen.findByText('Wants to connect')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Accept' }))

    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === 'post' && call.url === '/api/v1/connections/requests/r-1/accept',
        ),
      ).toBe(true),
    )
  })

  it('declines a request', async () => {
    const calls = setup({
      received: [{ id: 'r-1', direction: 'received', person: person('u-9', 'Sara Chen') }],
    })
    renderPage('/connections?tab=requests')

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Decline' }))

    await waitFor(() =>
      expect(calls.some((call) => call.url === '/api/v1/connections/requests/r-1/decline')).toBe(
        true,
      ),
    )
  })

  it('lists the requests I sent, with a way to withdraw', async () => {
    const calls = setup({
      sent: [{ id: 'r-3', direction: 'sent', person: person('u-7', 'Zara Ali') }],
    })
    const user = userEvent.setup()
    renderPage('/connections?tab=sent')

    expect(await screen.findByText('Waiting for their answer')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Pending/ }))
    await user.click(await screen.findByText('Withdraw request'))

    await waitFor(() =>
      expect(
        calls.some(
          (call) => call.method === 'delete' && call.url === '/api/v1/connections/requests/r-3',
        ),
      ).toBe(true),
    )
  })

  it('removes a connection only after confirming', async () => {
    const calls = setup({ connections: [connection('u-1', 'Hamza Naveed')] })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'More for Hamza Naveed' }))
    await user.click(await screen.findByText('Remove connection'))
    expect(calls.some((call) => call.method === 'delete')).toBe(false)

    await user.click(await screen.findByRole('button', { name: 'Remove' }))

    await waitFor(() =>
      expect(
        calls.some((call) => call.method === 'delete' && call.url === '/api/v1/connections/u-1'),
      ).toBe(true),
    )
  })
})
