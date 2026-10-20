import { useEffect, useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  confirmVerificationCode,
  getVerificationStatus,
  sendVerificationCode,
  uploadVerificationDocument,
} from '../api/verification.api'

const STATUS_KEY = ['verification', 'me']

/** GET /verification/me - what the user has verified so far. */
export function useVerificationStatus() {
  return useQuery({ queryKey: STATUS_KEY, queryFn: getVerificationStatus })
}

/** POST /verification/documents - refreshes the status once stored. */
export function useUploadVerificationDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadVerificationDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  })
}

// `detail` is a string from our errors, or an array of {msg} from Pydantic.
export function getVerificationErrorMessage(error) {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  return 'Something went wrong. Please try again.'
}

/** POST /verification/email/send - emails a fresh code. */
export function useSendVerificationCode() {
  return useMutation({ mutationFn: sendVerificationCode })
}

/** POST /verification/email/confirm - checks the code the user typed, and
 * refreshes the status once it is accepted. */
export function useConfirmVerificationCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: confirmVerificationCode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  })
}

/**
 * Counts "Resend in 0:42" down. Restarts on each new `sendResult` object -
 * the seconds value alone is always 60.
 *
 * @param {{ resend_after_seconds: number } | undefined} sendResult
 * @returns {{ secondsLeft: number, isActive: boolean }}
 */
export function useResendCountdown(sendResult) {
  const targetSeconds = sendResult?.resend_after_seconds ?? 0
  const [trackedResult, setTrackedResult] = useState(sendResult)
  const [secondsLeft, setSecondsLeft] = useState(targetSeconds)

  // Reset during render, not in an effect (react.dev "Adjusting state").
  if (sendResult !== trackedResult) {
    setTrackedResult(sendResult)
    setSecondsLeft(targetSeconds)
  }

  const isCounting = secondsLeft > 0
  useEffect(() => {
    if (!isCounting) return undefined

    const id = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [isCounting])

  return { secondsLeft, isActive: secondsLeft > 0 }
}
