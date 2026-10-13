import { useState } from 'react'

import { App, Button, Input } from 'antd'

import checkCircleIcon from '@/assets/icons/check-circle-16.svg'
import {
  useConfirmVerificationCode,
  useResendCountdown,
  useSendVerificationCode,
} from '@/features/verification'
import { getApiErrorMessage } from '@/shared/api/getApiErrorMessage'
import Icon from '@/shared/components/Icon/Icon'
import OtpInput from '@/shared/components/OtpInput/OtpInput'

import styles from './EmailCodeVerification.module.css'

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

/**
 * Send-a-code-type-a-code email verification, shared by the university and
 * employer onboarding steps; the code part follows Figma frame 9:337. Not a
 * Form.Item: the verified email and the code are never sent to PATCH
 * /profile/me (#52 - the profile has no field for them), so this keeps its
 * own state instead of registering with the wizard's antd Form.
 *
 * @param {object} props
 * @param {'university' | 'employer'} props.kind
 * @param {string} props.label - e.g. "University email"
 * @param {string} [props.placeholder]
 * @param {string} [props.helpText]
 * @param {string} [props.defaultEmail] - pre-filled address, e.g. the sign-up email
 * @param {string | null} [props.verifiedEmail] - an address already verified earlier
 */
function EmailCodeVerification({
  kind,
  label,
  placeholder,
  helpText,
  defaultEmail = '',
  verifiedEmail: alreadyVerified = null,
}) {
  const { message } = App.useApp()
  const [email, setEmail] = useState(defaultEmail)
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState(null)
  const [verifiedEmail, setVerifiedEmail] = useState(alreadyVerified)

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
        <Icon src={checkCircleIcon} className={styles.verifiedIcon} />
        <span>
          <strong>{verifiedEmail}</strong> is verified
        </span>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.field}>
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
            <Button onClick={handleSend} loading={sendCode.isPending} disabled={!isEmailValid}>
              Send code
            </Button>
          )}
        </div>
        {helpText ? <p className={styles.help}>{helpText}</p> : null}
      </div>

      {sentTo ? (
        <div className={styles.codeGroup}>
          <span className={styles.label}>Enter the 6-digit code sent to {sentTo}</span>
          <OtpInput
            size="large"
            value={code}
            onChange={setCode}
            onComplete={handleComplete}
            status={confirmCode.isError ? 'error' : undefined}
            disabled={confirmCode.isPending}
            ariaLabel={`${label} verification code`}
          />
          <span className={styles.resend}>
            Didn&rsquo;t get it?{' '}
            {isActive ? (
              <span className={styles.resendAction}>Resend in {formatCountdown(secondsLeft)}</span>
            ) : (
              <button
                type="button"
                className={styles.resendAction}
                onClick={handleSend}
                disabled={sendCode.isPending}
              >
                Resend
              </button>
            )}
          </span>
        </div>
      ) : null}
    </div>
  )
}

export default EmailCodeVerification
