import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { api } from '@/shared/api/client'
import { fakeNetwork, ok, restoreNetwork, unauthorized } from '@/test/fakeNetwork'

import { useAuthStore } from '../store/authStore'

import { setupAuthClient } from './setupAuthClient'

beforeEach(() => {
  setupAuthClient()
})

afterEach(() => {
  restoreNetwork()
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
})

describe('setupAuthClient', () => {
  it('sends the access token that is held in the auth store', async () => {
    const requests = fakeNetwork((config) => ok(config))
    useAuthStore.setState({ accessToken: 'token-from-store' })

    await api.get('/anything')

    expect(requests[0].authorization).toBe('Bearer token-from-store')
  })

  it('swaps the stored refresh token for a new access token when a request gets a 401', async () => {
    useAuthStore.setState({ accessToken: 'stale', refreshToken: 'refresh-1' })
    const requests = fakeNetwork((config) => {
      if (config.url === '/api/v1/auth/refresh') return ok(config, { access_token: 'fresh' })
      if (config.headers.get('Authorization') === 'Bearer fresh') return ok(config, { done: true })
      throw unauthorized(config)
    })

    const response = await api.get('/api/v1/jobs')

    expect(response.data).toEqual({ done: true })
    expect(useAuthStore.getState().accessToken).toBe('fresh')
    expect(requests.map((request) => request.url)).toEqual([
      '/api/v1/jobs',
      '/api/v1/auth/refresh',
      '/api/v1/jobs',
    ])
  })

  it('does not call the refresh endpoint when there is no refresh token', async () => {
    useAuthStore.setState({ accessToken: 'stale', refreshToken: null })
    const requests = fakeNetwork((config) => {
      throw unauthorized(config)
    })

    await expect(api.get('/api/v1/jobs')).rejects.toMatchObject({ response: { status: 401 } })

    expect(requests).toHaveLength(1)
  })
})
