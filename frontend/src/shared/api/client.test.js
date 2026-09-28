import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { api, configureAuthClient } from './client'

const originalAdapter = api.defaults.adapter

/** Replaces the network with a function, and records every request it sees. */
function fakeNetwork(respond) {
  const requests = []
  api.defaults.adapter = async (config) => {
    requests.push(config)
    return respond(config, requests.length)
  }
  return requests
}

function ok(config, data = {}) {
  return { data, status: 200, statusText: 'OK', headers: {}, config }
}

describe('api client', () => {
  beforeEach(() => {
    configureAuthClient({ getAccessToken: () => null })
  })

  afterEach(() => {
    api.defaults.adapter = originalAdapter
  })

  describe('request interceptor', () => {
    it('attaches the access token as a Bearer header', async () => {
      const requests = fakeNetwork((config) => ok(config))
      configureAuthClient({ getAccessToken: () => 'token-1' })

      await api.get('/anything')

      expect(requests[0].headers.get('Authorization')).toBe('Bearer token-1')
    })

    it('sends no Authorization header when there is no session', async () => {
      const requests = fakeNetwork((config) => ok(config))

      await api.get('/anything')

      expect(requests[0].headers.get('Authorization')).toBeFalsy()
    })

    it('leaves an Authorization header the caller set explicitly', async () => {
      const requests = fakeNetwork((config) => ok(config))
      configureAuthClient({ getAccessToken: () => 'from-store' })

      await api.get('/anything', { headers: { Authorization: 'Bearer explicit' } })

      expect(requests[0].headers.get('Authorization')).toBe('Bearer explicit')
    })
  })
})
