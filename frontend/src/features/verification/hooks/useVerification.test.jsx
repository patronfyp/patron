import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { confirmVerificationCode, sendVerificationCode } from '../api/verification.api'

import {
  getVerificationErrorMessage,
  useConfirmVerificationCode,
  useResendCountdown,
  useSendVerificationCode,
} from './useVerification'

vi.mock('../api/verification.api', () => ({
  sendVerificationCode: vi.fn(),
  confirmVerificationCode: vi.fn(),
}))

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return wrapper
}

describe('useSendVerificationCode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends the email and kind, and returns the countdown numbers', async () => {
    sendVerificationCode.mockResolvedValue({
      email: 'jane@lums.edu.pk',
      kind: 'university',
      expires_in_seconds: 600,
      resend_after_seconds: 60,
    })

    const { result } = renderHook(() => useSendVerificationCode(), { wrapper: setup() })
    let response
    await act(async () => {
      response = await result.current.mutateAsync({ email: 'jane@lums.edu.pk', kind: 'university' })
    })

    expect(sendVerificationCode.mock.calls[0][0]).toEqual({
      email: 'jane@lums.edu.pk',
      kind: 'university',
    })
    expect(response.resend_after_seconds).toBe(60)
  })
})

describe('useConfirmVerificationCode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('confirms the code', async () => {
    confirmVerificationCode.mockResolvedValue({
      email: 'jane@lums.edu.pk',
      kind: 'university',
      verified_at: '2026-01-01T00:00:00Z',
    })

    const { result } = renderHook(() => useConfirmVerificationCode(), { wrapper: setup() })
    let response
    await act(async () => {
      response = await result.current.mutateAsync({
        email: 'jane@lums.edu.pk',
        kind: 'university',
        code: '123456',
      })
    })

    expect(confirmVerificationCode.mock.calls[0][0]).toEqual({
      email: 'jane@lums.edu.pk',
      kind: 'university',
      code: '123456',
    })
    expect(response.verified_at).toBe('2026-01-01T00:00:00Z')
  })
})

describe('getVerificationErrorMessage', () => {
  it('reads a plain string detail', () => {
    const error = { response: { data: { detail: 'That code is wrong or has expired.' } } }
    expect(getVerificationErrorMessage(error)).toBe('That code is wrong or has expired.')
  })

  it('reads the first message from a Pydantic array detail', () => {
    const error = { response: { data: { detail: [{ msg: 'Code must be 6 digits' }] } } }
    expect(getVerificationErrorMessage(error)).toBe('Code must be 6 digits')
  })

  it('falls back to a generic message', () => {
    expect(getVerificationErrorMessage({})).toBe('Something went wrong. Please try again.')
  })
})

describe('useResendCountdown', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('counts down to zero in whole seconds', () => {
    const sendResult = { resend_after_seconds: 3 }
    const { result } = renderHook(() => useResendCountdown(sendResult))

    expect(result.current).toEqual({ secondsLeft: 3, isActive: true })

    act(() => vi.advanceTimersByTime(3000))
    expect(result.current).toEqual({ secondsLeft: 0, isActive: false })
  })

  it('is inactive with no send result yet', () => {
    const { result } = renderHook(() => useResendCountdown(undefined))

    expect(result.current).toEqual({ secondsLeft: 0, isActive: false })
  })

  it('restarts on a second send even though the cooldown is the same number', () => {
    const firstSend = { resend_after_seconds: 2 }
    const { result, rerender } = renderHook(({ sendResult }) => useResendCountdown(sendResult), {
      initialProps: { sendResult: firstSend },
    })
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.secondsLeft).toBe(0)

    const secondSend = { resend_after_seconds: 2 }
    rerender({ sendResult: secondSend })
    expect(result.current).toEqual({ secondsLeft: 2, isActive: true })
  })
})
