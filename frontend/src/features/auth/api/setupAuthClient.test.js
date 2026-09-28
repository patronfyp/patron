import { afterEach, describe, expect, it } from 'vitest'

import { api } from '@/shared/api/client'

import { useAuthStore } from '../store/authStore'

import { setupAuthClient } from './setupAuthClient'

const originalAdapter = api.defaults.adapter

afterEach(() => {
  api.defaults.adapter = originalAdapter
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
})

describe('setupAuthClient', () => {
  it('sends the access token that is held in the auth store', async () => {
    let sent
    api.defaults.adapter = async (config) => {
      sent = config
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }

    setupAuthClient()
    useAuthStore.setState({ accessToken: 'token-from-store' })
    await api.get('/anything')

    expect(sent.headers.get('Authorization')).toBe('Bearer token-from-store')
  })
})
