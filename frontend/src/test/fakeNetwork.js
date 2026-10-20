import { AxiosError } from 'axios'

import { api } from '@/shared/api/client'

const originalAdapter = api.defaults.adapter

/**
 * Swaps the API client's network for `respond(config, callNumber)`. Records
 * each request's Authorization header when sent - axios reuses the config.
 */
export function fakeNetwork(respond) {
  const requests = []
  api.defaults.adapter = async (config) => {
    requests.push({ url: config.url, authorization: config.headers.get('Authorization') ?? null })
    return respond(config, requests.length)
  }
  return requests
}

export function restoreNetwork() {
  api.defaults.adapter = originalAdapter
}

export function ok(config, data = {}) {
  return { data, status: 200, statusText: 'OK', headers: {}, config }
}

/** Usage: `throw unauthorized(config)` inside a fakeNetwork responder. */
export function unauthorized(config) {
  const response = { data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config }
  return new AxiosError(
    'Request failed with status code 401',
    AxiosError.ERR_BAD_REQUEST,
    config,
    null,
    response,
  )
}
