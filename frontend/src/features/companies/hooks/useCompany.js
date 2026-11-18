import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  acceptCompanyInvite,
  createCompanyInvite,
  createOrJoinCompany,
  deleteCompanyInvite,
  getCompanyInvites,
  getMyCompany,
  previewCompanyInvite,
  removeCompanyLogo,
  updateCompany,
  uploadCompanyLogo,
} from '../api/companies.api'

export const COMPANY_KEY = ['companies', 'me']
export const COMPANY_INVITES_KEY = ['companies', 'me', 'invites']

/**
 * The user's company, or `null` when they have none yet (the API's 404).
 *
 * @param {{ enabled?: boolean }} [options] - `enabled: false` skips the
 *   fetch for a user who isn't a recruiter and so has no company to read
 */
export function useMyCompany({ enabled = true } = {}) {
  return useQuery({
    queryKey: COMPANY_KEY,
    queryFn: async () => {
      try {
        return await getMyCompany()
      } catch (error) {
        if (error.response?.status === 404) return null
        throw error
      }
    },
    enabled,
  })
}

// Every write returns the company, so the cache is set, not refetched.
function useCompanyWrite(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (company) => queryClient.setQueryData(COMPANY_KEY, company),
  })
}

export const useCreateOrJoinCompany = () => useCompanyWrite(createOrJoinCompany)
export const useUpdateCompany = () => useCompanyWrite(updateCompany)
export const useUploadCompanyLogo = () => useCompanyWrite(uploadCompanyLogo)
export const useRemoveCompanyLogo = () => useCompanyWrite(removeCompanyLogo)

/**
 * The company's pending/accepted/expired invites (#104, #105).
 *
 * @param {{ enabled?: boolean }} [options]
 */
export function useCompanyInvites({ enabled = true } = {}) {
  return useQuery({ queryKey: COMPANY_INVITES_KEY, queryFn: getCompanyInvites, enabled })
}

function useInvitesWrite(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPANY_INVITES_KEY }),
  })
}

export const useCreateCompanyInvite = () => useInvitesWrite(createCompanyInvite)
export const useDeleteCompanyInvite = () => useInvitesWrite(deleteCompanyInvite)

// No auth, so no query key to cache against - the register page calls this
// once per token it's handed.
export function usePreviewCompanyInvite() {
  return useMutation({ mutationFn: previewCompanyInvite })
}

// Not a company write: the company the invite belongs to isn't cached here
// yet (the accepting user has none, or a different one, until this resolves).
export function useAcceptCompanyInvite() {
  return useMutation({ mutationFn: acceptCompanyInvite })
}
