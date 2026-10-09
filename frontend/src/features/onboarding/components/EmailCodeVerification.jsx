import { useState } from 'react'

import { App, Button, Input } from 'antd'

import { useConfirmVerificationCode, useResendCountdown, useSendVerificationCode } from '@/features/verification'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'
import OtpInput from '@/shared/components/OtpInput/OtpInput'

import styles from './EmailCodeVerification.module.css'

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
      <path
        d="M5 12l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

/**
 * Send-a-code-type-a-code email verification, shared by the university and
 * employer onboarding steps. Not a Form.Item: the verified email and the
 * code are never sent to PATCH /profile/me (#52 - the profile has no field
 * for them), so this keeps its own state instead of registering with the
 * wizard's antd Form.
 *
 * @param {object} props
 * @param {'university' | 'employer'} props.kind
 * @param {string} props.label - e.g. "University email"
 * @param {string} [props.placeholder]
 * @param {string} [props.helpText]
 */
function EmailCodeVerification({ kind, label, placeholder, helpText }) {
  const { message } = App.useApp()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState(null)
  const [verifiedEmail, setVerifiedEmail] = useState(null)

  const sendCode = useSendVerificationCode()
  const confirmCode = useConfirmVerificationCode()
  const { secondsLeft, isActive } = useResendCountdown(sendCode.data)

  const isEmailValid = EMAIL_PATTERN.test(email)

  function handleSend() {
    sendCode.mutate(
      { email, kind },
      {
        onSuccess: () => {
          setSentTo(email)
          setCode('')
        },
        onError: (error) =>
          message.error(getApiErrorMessage(error, 'Could not send the code. Please try again.')),
      },
    )
  }

  function handleComplete(fullCode) {
    confirmCode.mutate(
      { email: sentTo, kind, code: fullCode },
      {
        onSuccess: () => setVerifiedEmail(sentTo),
        onError: (error) => {
          message.error(getApiErrorMessage(error, 'Could not verify that code. Please try again.'))
          setCode('')
        },
      },
    )
  }

  if (verifiedEmail) {
    return (
      <div className={styles.verified}>
        <span className={styles.verifiedIcon} aria-hidden="true">
          <CheckIcon />
        </span>
        <span>
          <strong>{verifiedEmail}</strong> is verified
        </span>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor={`${kind}-email`}>
        {label}
      </label>
      <div className={styles.row}>
        <Input
          id={`${kind}-email`}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={placeholder}
          disabled={Boolean(sentTo)}
        />
        {!sentTo && (
          <Button
            onClick={handleSend}
            loading={sendCode.isPending}
            disabled={!isEmailValid}
          >
            Send code
          </Button>
        )}
      </div>
      {helpText ? <p className={styles.help}>{helpText}</p> : null}

      {sentTo ? (
        <div className={styles.otpRow}>
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={handleComplete}
            status={confirmCode.isError ? 'error' : undefined}
            disabled={confirmCode.isPending}
            ariaLabel={`${label} verification code`}
          />
          <Button
            type="link"
            onClick={handleSend}
            disabled={isActive || sendCode.isPending}
          >
            {isActive ? `Resend in ${formatCountdown(secondsLeft)}` : "Didn't get it? Resend"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default EmailCodeVerification
