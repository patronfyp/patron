import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fakeNetwork, ok, restoreNetwork, unauthorized } from '@/test/fakeNetwork'

import { api, configureAuthClient } from './client'

function alwaysUnauthorized() {
  return fakeNetwork((config) => {
    throw unauthorized(config)
  })
}

describe('api client', () => {
  beforeEach(() => {
    configureAuthClient({ getAccessToken: () => null })
  })

  afterEach(() => {
    restoreNetwork()
  })

  describe('request interceptor', () => {
    it('attaches the access token as a Bearer header', async () => {
      const requests = fakeNetwork((config) => ok(config))
      configureAuthClient({ getAccessToken: () => 'token-1' })

      await api.get('/anything')

      expect(requests[0].authorization).toBe('Bearer token-1')
    })

    it('sends no Authorization header when there is no session', async () => {
      const requests = fakeNetwork((config) => ok(config))

      await api.get('/anything')

      expect(requests[0].authorization).toBeNull()
    })

    it('leaves an Authorization header the caller set explicitly', async () => {
      const requests = fakeNetwork((config) => ok(config))
      configureAuthClient({ getAccessToken: () => 'from-store' })

      await api.get('/anything', { headers: { Authorization: 'Bearer explicit' } })

      expect(requests[0].authorization).toBe('Bearer explicit')
    })
  })

  describe('response interceptor', () => {
    it('refreshes once on a 401 and retries the request with the new token', async () => {
      const refresh = vi.fn().mockResolvedValue('new-token')
      configureAuthClient({ getAccessToken: () => 'old-token', refresh })
      const requests = fakeNetwork((config, callNumber) => {
        if (callNumber === 1) throw unauthorized(config)
        return ok(config, { done: true })
      })

      const response = await api.get('/data')

      expect(response.data).toEqual({ done: true })
      expect(refresh).toHaveBeenCalledTimes(1)
      expect(requests.map((request) => request.authorization)).toEqual([
        'Bearer old-token',
        'Bearer new-token',
      ])
    })

    it('does not try to refresh when the refresh call itself gets a 401', async () => {
      const refresh = vi.fn()
      configureAuthClient({ getAccessToken: () => 'old-token', refresh })
      const requests = alwaysUnauthorized()

      await expect(api.post('/api/v1/auth/refresh', {})).rejects.toMatchObject({
        response: { status: 401 },
      })

      expect(refresh).not.toHaveBeenCalled()
      expect(requests).toHaveLength(1)
    })

    it('does not treat a failed login as an expired session', async () => {
      const refresh = vi.fn()
      configureAuthClient({ getAccessToken: () => null, refresh })
      alwaysUnauthorized()

      await expect(api.post('/api/v1/auth/login', {})).rejects.toMatchObject({
        response: { status: 401 },
      })

      expect(refresh).not.toHaveBeenCalled()
    })

    it('retries only once - a second 401 is final', async () => {
      const refresh = vi.fn().mockResolvedValue('new-token')
      configureAuthClient({ getAccessToken: () => 'old-token', refresh })
      const requests = alwaysUnauthorized()

      await expect(api.get('/data')).rejects.toMatchObject({ response: { status: 401 } })

      expect(refresh).toHaveBeenCalledTimes(1)
      expect(requests).toHaveLength(2)
    })

    it('passes the original 401 on when refreshing fails', async () => {
      const refresh = vi.fn().mockRejectedValue(new Error('refresh failed'))
      configureAuthClient({ getAccessToken: () => 'old-token', refresh })
      const requests = alwaysUnauthorized()

      await expect(api.get('/data')).rejects.toMatchObject({ response: { status: 401 } })

      expect(requests).toHaveLength(1)
    })
  })
})
