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

  describe('when the session cannot be refreshed', () => {
    it('reports the auth failure once, however many requests were waiting', async () => {
      const refresh = vi.fn(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('refused')), 0)),
      )
      const onAuthFailure = vi.fn()
      configureAuthClient({ getAccessToken: () => 'old-token', refresh, onAuthFailure })
      alwaysUnauthorized()

      const results = await Promise.allSettled([api.get('/a'), api.get('/b'), api.get('/c')])

      expect(results.map((result) => result.reason.response.status)).toEqual([401, 401, 401])
      expect(refresh).toHaveBeenCalledTimes(1)
      expect(onAuthFailure).toHaveBeenCalledTimes(1)
    })

    it('does not report a failure when the refresh works', async () => {
      const onAuthFailure = vi.fn()
      configureAuthClient({
        getAccessToken: () => 'old-token',
        refresh: vi.fn().mockResolvedValue('new-token'),
        onAuthFailure,
      })
      fakeNetwork((config, callNumber) => {
        if (callNumber === 1) throw unauthorized(config)
        return ok(config)
      })

      await api.get('/data')

      expect(onAuthFailure).not.toHaveBeenCalled()
    })
  })

  describe('concurrent requests', () => {
    it('shares one refresh between requests that expire together', async () => {
      let currentToken = 'old-token'
      let finishRefresh
      const refresh = vi.fn(
        () =>
          new Promise((resolve) => {
            finishRefresh = () => {
              currentToken = 'new-token'
              resolve('new-token')
            }
          }),
      )
      configureAuthClient({ getAccessToken: () => currentToken, refresh })
      const requests = fakeNetwork((config) => {
        if (config.headers.get('Authorization') === 'Bearer new-token') return ok(config)
        throw unauthorized(config)
      })

      const calls = Array.from({ length: 5 }, (_, index) => api.get(`/data/${index}`))
      await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
      // Let the other four 401s reach the interceptor while the refresh is still pending.
      await new Promise((resolve) => setTimeout(resolve, 0))
      finishRefresh()
      const responses = await Promise.all(calls)

      expect(responses).toHaveLength(5)
      expect(refresh).toHaveBeenCalledTimes(1)
      expect(requests).toHaveLength(10)
    })

    it('reuses a token that was refreshed while the request was in flight', async () => {
      const refresh = vi.fn()
      configureAuthClient({ getAccessToken: () => 'new-token', refresh })
      const requests = fakeNetwork((config) => {
        if (config.headers.get('Authorization') === 'Bearer new-token') return ok(config)
        throw unauthorized(config)
      })

      // Sent with the old token, before another request had refreshed.
      await api.get('/late', { headers: { Authorization: 'Bearer old-token' } })

      expect(refresh).not.toHaveBeenCalled()
      expect(requests.map((request) => request.authorization)).toEqual([
        'Bearer old-token',
        'Bearer new-token',
      ])
    })

    it('refreshes again when a later token expires', async () => {
      let currentToken = 'token-1'
      let acceptedToken = 'token-2'
      const refresh = vi.fn(async () => {
        currentToken = acceptedToken
        return currentToken
      })
      configureAuthClient({ getAccessToken: () => currentToken, refresh })
      fakeNetwork((config) => {
        if (config.headers.get('Authorization') === `Bearer ${acceptedToken}`) return ok(config)
        throw unauthorized(config)
      })

      await api.get('/first')
      acceptedToken = 'token-3'
      await api.get('/second')

      expect(refresh).toHaveBeenCalledTimes(2)
    })
  })
})
