import { useQuery } from '@tanstack/react-query'

import { searchPeople } from '../api/people.api'

/** The backend refuses a search shorter than this. */
export const MIN_QUERY_LENGTH = 2

/**
 * People matching `query`. Waits for 2 characters, and a stale request is
 * cancelled when the query changes, so results never arrive out of order.
 * Kept under ['connections'] so connecting from a result refreshes its button.
 */
export function usePeopleSearch(query) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['connections', 'people', trimmed],
    queryFn: ({ signal }) => searchPeople(trimmed, signal),
    enabled: trimmed.length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
  })
}
