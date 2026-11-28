import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { afterEach, describe, expect, it } from 'vitest'

import { fakeNetwork, ok, restoreNetwork } from '@/test/fakeNetwork'

import ConnectButton from './ConnectButton'

function renderButton(props) {
  const calls = []
  fakeNetwork((config) => {
    calls.push({ method: config.method, url: config.url, data: config.data })
    return ok(config, {})
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <ConnectButton userId="u-2" {...props} />
      </AntApp>
    </QueryClientProvider>,
  )
  return calls
}

describe('ConnectButton', () => {
  afterEach(() => restoreNetwork())

  it('sends a request from Connect', async () => {
    const calls = renderButton({ status: 'none' })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() =>
      expect(calls).toContainEqual(
        expect.objectContaining({
          method: 'post',
          url: '/api/v1/connections/requests',
          data: JSON.stringify({ user_id: 'u-2' }),
        }),
      ),
    )
  })

  it('shows Connected as a state, not an action', () => {
    renderButton({ status: 'connected' })

    expect(screen.getByRole('button', { name: /Connected/ })).toBeDisabled()
  })

  it('offers Accept and Decline for a request I received', async () => {
    const calls = renderButton({ status: 'pending_received', requestId: 'r-1' })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Accept' }))

    await waitFor(() =>
      expect(calls.some((call) => call.url === '/api/v1/connections/requests/r-1/accept')).toBe(
        true,
      ),
    )
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument()
  })

  it('shows Pending for a request I sent, and withdraws it from the menu', async () => {
    const calls = renderButton({ status: 'pending_sent', requestId: 'r-3' })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Pending/ }))
    await user.click(await screen.findByText('Withdraw request'))

    await waitFor(() =>
      expect(
        calls.some((call) => call.method === 'delete' && call.url.endsWith('/requests/r-3')),
      ).toBe(true),
    )
  })
})
