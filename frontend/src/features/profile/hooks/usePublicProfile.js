import { useQuery } from '@tanstack/react-query'

import { getPublicProfile } from '../api/profile.api'

export const profileKeys = {
  all: ['profile'],
  public: (userId) => ['profile', 'public', userId],
}

// The app-wide default retries once; that is right for a dropped connection but
// pointless for "no such user" or a malformed id, which will answer the same.
const retryUnlessClientError = (failureCount, error) => {
  const status = error?.response?.status
  if (status >= 400 && status < 500) return false
  return failureCount < 1
}

/**
 * Someone's public profile.
 *
 * @param {string | undefined} userId - the `:userId` from the URL; nothing is fetched until it is set
 */
export function usePublicProfile(userId) {
  return useQuery({
    queryKey: profileKeys.public(userId),
    queryFn: () => getPublicProfile(userId),
    enabled: Boolean(userId),
    retry: retryUnlessClientError,
  })
}
