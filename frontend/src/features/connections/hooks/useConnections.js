import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  acceptRequest,
  declineRequest,
  getRelationship,
  listConnections,
  listRequests,
  removeConnection,
  sendRequest,
  withdrawRequest,
} from '../api/connections.api'

/** Page size for "Load more": two rows of three cards, and then some. */
export const PAGE_SIZE = 24

// Everything under ['connections'], so one invalidate refreshes lists,
// counts, requests and every relationship after any change.
export const connectionKeys = {
  all: ['connections'],
  list: (params) => ['connections', 'list', params],
  infinite: (query) => ['connections', 'infinite', query],
  requests: (direction) => ['connections', 'requests', direction],
  relationship: (userId) => ['connections', 'with', userId],
}

/** One page of my connections: `{ items, total }`. */
export function useConnections(params = {}) {
  return useQuery({
    queryKey: connectionKeys.list(params),
    queryFn: () => listConnections(params),
  })
}

/**
 * My connections a page at a time, for "Load more". Optional name `query`.
 * Read `data.pages` and `fetchNextPage()`.
 */
export function useConnectionsInfinite(query = '') {
  return useInfiniteQuery({
    queryKey: connectionKeys.infinite(query),
    queryFn: ({ pageParam }) =>
      listConnections({ q: query || undefined, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0)
      return loaded < lastPage.total ? loaded : undefined
    },
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

/** Where I stand with someone: status, request id, type and mutuals. */
export function useRelationship(userId, { enabled = true } = {}) {
  return useQuery({
    queryKey: connectionKeys.relationship(userId),
    queryFn: () => getRelationship(userId),
    enabled: Boolean(userId) && enabled,
  })
}

function useConnectionWrite(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionKeys.all }),
  })
}

/** `mutate(userId)` */
export const useSendRequest = () => useConnectionWrite(sendRequest)
/** `mutate(requestId)` */
export const useAcceptRequest = () => useConnectionWrite(acceptRequest)
/** `mutate(requestId)` */
export const useDeclineRequest = () => useConnectionWrite(declineRequest)
/** `mutate(requestId)` */
export const useWithdrawRequest = () => useConnectionWrite(withdrawRequest)
/** `mutate(userId)` */
export const useRemoveConnection = () => useConnectionWrite(removeConnection)
