import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App as AntApp } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useConfirmVerificationCode, useSendVerificationCode } from '@/features/verification'

import EmailCodeVerification from './EmailCodeVerification'

vi.mock('@/features/verification', async (importOriginal) => ({
  ...(await importOriginal()),
  useSendVerificationCode: vi.fn(),
  useConfirmVerificationCode: vi.fn(),
}))

// Stands in for react-query's useMutation: calling `mutate` runs `mutationFn`
// and feeds the result to whichever onSuccess/onError this call passed.
function fakeMutation(mutationFn) {
  const hook = vi.fn(() => ({
    mutate: (variables, { onSuccess, onError } = {}) =>
      mutationFn(variables).then(onSuccess, onError),
    data: hook.data,
    isPending: false,
    isError: hook.isError ?? false,
  }))
  return hook
}

// The email input is also role "textbox", so OTP boxes must be queried
// scoped to the OTP group, not screen-wide.
function otpBoxes() {
  return within(screen.getByRole('group', { name: /verification code/i })).getAllByRole(
    'textbox',
  )
}

function renderComponent(props = {}) {
  return render(
    <AntApp>
      <EmailCodeVerification
        kind="employer"
        label="Work email at Garner"
        placeholder="you@garner.com"
        {...props}
      />
    </AntApp>,
  )
}

describe('EmailCodeVerification', () => {
  beforeEach(() => vi.clearAllMocks())

  it('disables Send code until the email looks valid', async () => {
    useSendVerificationCode.mockImplementation(fakeMutation(() => new Promise(() => {})))
    useConfirmVerificationCode.mockImplementation(fakeMutation(() => new Promise(() => {})))
    const user = userEvent.setup()
    renderComponent()

    expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled()

    await user.type(screen.getByLabelText('Work email at Garner'), 'jane@garner.com')

    expect(screen.getByRole('button', { name: 'Send code' })).toBeEnabled()
  })

  it('sends the code and reveals the OTP boxes', async () => {
    const sendCode = vi.fn().mockResolvedValue({
      email: 'jane@garner.com',
      kind: 'employer',
      resend_after_seconds: 60,
    })
    useSendVerificationCode.mockImplementation(fakeMutation(sendCode))
    useConfirmVerificationCode.mockImplementation(fakeMutation(() => new Promise(() => {})))
    const user = userEvent.setup()
    renderComponent()

    await user.type(screen.getByLabelText('Work email at Garner'), 'jane@garner.com')
    await user.click(screen.getByRole('button', { name: 'Send code' }))

    expect(await screen.findByRole('group', { name: /verification code/i })).toBeInTheDocument()
    expect(sendCode).toHaveBeenCalledWith({ email: 'jane@garner.com', kind: 'employer' })
    // The email is locked in once a code is on its way to it.
    expect(screen.getByLabelText('Work email at Garner')).toBeDisabled()
  })

  it('shows the verified state once the code is confirmed', async () => {
    useSendVerificationCode.mockImplementation(
      fakeMutation(() => Promise.resolve({ resend_after_seconds: 60 })),
    )
    const confirmCode = vi.fn().mockResolvedValue({ verified_at: '2026-01-01T00:00:00Z' })
    useConfirmVerificationCode.mockImplementation(fakeMutation(confirmCode))
    const user = userEvent.setup()
    renderComponent()

    await user.type(screen.getByLabelText('Work email at Garner'), 'jane@garner.com')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    await screen.findByRole('group', { name: /verification code/i })
    await user.type(otpBoxes()[0], '123456')

    await waitFor(() =>
      expect(confirmCode).toHaveBeenCalledWith({
        email: 'jane@garner.com',
        kind: 'employer',
        code: '123456',
      }),
    )
    expect(await screen.findByText(/jane@garner\.com/)).toBeInTheDocument()
    expect(screen.getByText(/is verified/)).toBeInTheDocument()
  })

  it('shows the backend message and lets the user retry on a wrong code', async () => {
    useSendVerificationCode.mockImplementation(
      fakeMutation(() => Promise.resolve({ resend_after_seconds: 60 })),
    )
    useConfirmVerificationCode.mockImplementation(
      fakeMutation(() =>
        Promise.reject({
          response: {
            data: { detail: 'That code is wrong or has expired. Request a new one and try again.' },
          },
        }),
      ),
    )
    const user = userEvent.setup()
    renderComponent()

    await user.type(screen.getByLabelText('Work email at Garner'), 'jane@garner.com')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    await screen.findByRole('group', { name: /verification code/i })
    await user.type(otpBoxes()[0], '000000')

    expect(
      await screen.findByText('That code is wrong or has expired. Request a new one and try again.'),
    ).toBeInTheDocument()
    // Cleared so the user can type a fresh attempt instead of resubmitting the same one.
    await waitFor(() => expect(otpBoxes()[0]).toHaveValue(''))
  })

  it('shows a send-time error, such as the rate limit, without revealing the OTP boxes', async () => {
    useSendVerificationCode.mockImplementation(
      fakeMutation(() =>
        Promise.reject({
          response: { data: { detail: 'Please wait 42 seconds before requesting another code.' } },
        }),
      ),
    )
    useConfirmVerificationCode.mockImplementation(fakeMutation(() => new Promise(() => {})))
    const user = userEvent.setup()
    renderComponent()

    await user.type(screen.getByLabelText('Work email at Garner'), 'jane@garner.com')
    await user.click(screen.getByRole('button', { name: 'Send code' }))

    expect(
      await screen.findByText('Please wait 42 seconds before requesting another code.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /verification code/i })).not.toBeInTheDocument()
  })
})
