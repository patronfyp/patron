import { AxiosError } from 'axios'

import { api } from '@/shared/api/client'

const originalAdapter = api.defaults.adapter

/**
 * Replaces the network for the shared API client with a function, so tests
 * never hit a server. `respond(config, callNumber)` returns a response (see
 * `ok`) or throws one (see `unauthorized`). Returns the list of requests seen,
 * with the Authorization header captured at the moment each was sent - axios
 * reuses one config object across a retry, so reading it later would lie.
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
