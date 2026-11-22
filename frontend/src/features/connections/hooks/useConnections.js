import { useQuery } from '@tanstack/react-query'

import { listConnections, listRequests } from '../api/connections.api'

export const connectionKeys = {
  all: ['connections'],
  list: (params) => ['connections', 'list', params],
  requests: (direction) => ['connections', 'requests', direction],
}

/** One page of my connections: `{ items, total }`. */
export function useConnections(params = {}) {
  return useQuery({
    queryKey: connectionKeys.list(params),
    queryFn: () => listConnections(params),
  })
}

/** How many connections I have - asks for one row and reads the total. */
export function useConnectionCount() {
  return useQuery({
    queryKey: connectionKeys.list({ limit: 1 }),
    queryFn: () => listConnections({ limit: 1 }),
    select: (page) => page.total,
  })
}

/** Pending requests to me (`received`) or from me (`sent`). */
export function useConnectionRequests(direction = 'received') {
  return useQuery({
    queryKey: connectionKeys.requests(direction),
    queryFn: () => listRequests(direction),
  })
}
