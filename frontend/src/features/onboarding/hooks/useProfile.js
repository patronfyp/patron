import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getProfile, updateProfile } from '../api/onboarding.api'

const PROFILE_KEY = ['profile', 'me']

export function useProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: getProfile })
}

// PATCH returns the whole saved profile, so it replaces the cached copy
// directly instead of refetching.
export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (changes) => updateProfile(changes),
    onSuccess: (profile) => queryClient.setQueryData(PROFILE_KEY, profile),
  })
}
