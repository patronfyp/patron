import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createJob, deleteJob, getJobs, updateJob } from '../api/jobs.api'

export const JOBS_KEY = ['companies', 'me', 'jobs']

/**
 * This company's draft jobs (#106, #107).
 *
 * @param {{ enabled?: boolean }} [options]
 */
export function useJobs({ enabled = true } = {}) {
  return useQuery({ queryKey: JOBS_KEY, queryFn: getJobs, enabled })
}

function useJobsWrite(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: JOBS_KEY }),
  })
}

export const useCreateJob = () => useJobsWrite(createJob)
export const useUpdateJob = () => useJobsWrite(updateJob)
export const useDeleteJob = () => useJobsWrite(deleteJob)
