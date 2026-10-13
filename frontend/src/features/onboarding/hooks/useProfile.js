import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  completeOnboarding,
  getProfile,
  removeCv,
  removePhoto,
  updateProfile,
  uploadCv,
  uploadPhoto,
} from '../api/onboarding.api'

const PROFILE_KEY = ['profile', 'me']

export function useProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: getProfile })
}

// Every profile write returns the whole saved profile, so it replaces the
// cached copy directly instead of refetching.
function useProfileWrite(mutationFn) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: (profile) => queryClient.setQueryData(PROFILE_KEY, profile),
  })
}

export function useUpdateProfile() {
  return useProfileWrite((changes) => updateProfile(changes))
}

export function useCompleteOnboarding() {
  return useProfileWrite(() => completeOnboarding())
}

export function useUploadPhoto() {
  return useProfileWrite((file) => uploadPhoto(file))
}

export function useRemovePhoto() {
  return useProfileWrite(() => removePhoto())
}

export function useUploadCv() {
  return useProfileWrite((file) => uploadCv(file))
}

export function useRemoveCv() {
  return useProfileWrite(() => removeCv())
}
