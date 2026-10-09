import { useEffect, useState } from 'react'

import { useMutation } from '@tanstack/react-query'

import { confirmVerificationCode, sendVerificationCode } from '../api/verification.api'

// Same shape as LoginPage's getErrorMessage - a 422/429/503 from this module
// carries a plain string in `detail` (app/core/exceptions.py), a 422 from
// Pydantic itself carries an array of {msg}.
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

/** POST /verification/email/confirm - checks the code the user typed. */
export function useConfirmVerificationCode() {
  return useMutation({ mutationFn: confirmVerificationCode })
}

/**
 * Counts a "Resend in 0:42" button down to zero, in whole seconds.
 *
 * `resend_after_seconds` is a fixed value from the backend's config
 * (verification/service.py's RESEND_COOLDOWN) - it is the same 60 on every
 * send, so it can't be used as a change signal on its own. `sendResult`
 * (the whole `useSendVerificationCode().data` object) is a fresh object
 * reference each time a send succeeds, so comparing *that* is what notices a
 * second resend and restarts the countdown.
 *
 * @param {{ resend_after_seconds: number } | undefined} sendResult
 * @returns {{ secondsLeft: number, isActive: boolean }}
 */
export function useResendCountdown(sendResult) {
  const targetSeconds = sendResult?.resend_after_seconds ?? 0
  const [trackedResult, setTrackedResult] = useState(sendResult)
  const [secondsLeft, setSecondsLeft] = useState(targetSeconds)

  // Derived-state-reset pattern (react.dev "Adjusting state when a prop
  // changes") rather than an effect: a new send result means a new
  // countdown, synchronously, before this render commits.
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
