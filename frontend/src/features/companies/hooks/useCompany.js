import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createOrJoinCompany,
  getMyCompany,
  removeCompanyLogo,
  updateCompany,
  uploadCompanyLogo,
} from '../api/companies.api'

export const COMPANY_KEY = ['companies', 'me']

/** The user's company, or `null` when they have none yet (the API's 404). */
export function useMyCompany() {
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
