import { useEffect, useRef, useState } from 'react'

import { App, Button, Checkbox } from 'antd'

import checkCircleIcon from '@/assets/icons/check-circle-16.svg'
import clockIcon from '@/assets/icons/clock.svg'
import mailIcon from '@/assets/icons/mail-18.svg'
import { useAuthStore } from '@/features/auth'
import {
  getVerificationErrorMessage,
  useConfirmVerificationCode,
  useResendCountdown,
  useSendVerificationCode,
} from '@/features/verification'
import Icon from '@/shared/components/Icon/Icon'
import OtpInput from '@/shared/components/OtpInput/OtpInput'

import { useStepControls } from '../hooks/useStepControls'

import styles from './AccountStep.module.css'

const CODE_LENGTH = 6

// Academic domains (.edu, .edu.pk, .ac.uk ...) - only for those does the
// "use it for alumni verification" option make sense.
const ACADEMIC_DOMAIN = /\.(edu|ac)(\.[a-z]{2})?$/i

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Step 1 - verify the sign-up email (Figma 65:53). The code is sent on open;
 * "Verify email" confirms it.
 *
 * @param {object} props
 * @param {boolean} props.useForUniversity
 * @param {(value: boolean) => void} props.onUseForUniversityChange
 */
function AccountStep({ useForUniversity, onUseForUniversityChange }) {
  const { message } = App.useApp()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const email = user?.email ?? ''
  const isVerified = Boolean(user?.is_email_verified)

  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState(null)
  const sendCode = useSendVerificationCode()
  const confirmCode = useConfirmVerificationCode()
  const { secondsLeft, isActive } = useResendCountdown(sendCode.data)

  const markVerified = () => setUser({ ...user, is_email_verified: true })

  function send() {
    sendCode.mutate(
      { email, kind: 'account' },
      {
        onError: (error) => {
          // A code sent a moment ago (429) is still valid - nothing to report.
          if (error.response?.status === 429) return
          message.error(getVerificationErrorMessage(error))
        },
      },
    )
  }

  // Once per visit - StrictMode runs effects twice in development, and a
  // second send would only hit the resend limit.
  const hasSent = useRef(false)
  useEffect(() => {
    if (isVerified || !email || hasSent.current) return
    hasSent.current = true
    send()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send once on open
  }, [isVerified, email])

  useStepControls({
    continueLabel: isVerified ? 'Continue' : 'Verify email',
    beforeContinue: async () => {
      if (isVerified) return true
      if (code.trim().length !== CODE_LENGTH) {
        setCodeError('Enter the 6-digit code from the email.')
        return false
      }
      try {
        await confirmCode.mutateAsync({ email, kind: 'account', code: code.trim() })
        markVerified()
        return true
      } catch (error) {
        setCodeError(getVerificationErrorMessage(error))
        setCode('')
        return false
      }
    },
  })

  const isAcademic = ACADEMIC_DOMAIN.test(email.split('@')[1] ?? '')

  return (
    <div className={styles.fields}>
      <div className={styles.sentTo}>
        <span className={styles.mailTile}>
          <Icon src={isVerified ? checkCircleIcon : mailIcon} size={18} />
        </span>
        <span className={styles.sentToText}>
          <span className={styles.sentToLabel}>
            {isVerified ? 'Verified email' : 'Code sent to'}
          </span>
          <span className={styles.sentToEmail}>{email}</span>
        </span>
      </div>

      {isVerified ? null : (
        <div className={styles.codeGroup}>
          <span className={styles.codeLabel} id="account-code-label">
            6-digit code
          </span>
          <OtpInput
            size="large"
            value={code}
            onChange={(next) => {
              setCode(next)
              setCodeError(null)
            }}
            status={codeError ? 'error' : undefined}
            disabled={confirmCode.isPending}
            ariaLabel="6-digit code"
          />
          {codeError ? <p className={styles.error}>{codeError}</p> : null}
          {isActive ? (
            <span className={styles.resend}>
              <Icon src={clockIcon} size={14} />
              Resend code in {formatCountdown(secondsLeft)}
            </span>
          ) : (
            <Button
              type="link"
              size="small"
              className={styles.resendLink}
              onClick={send}
              loading={sendCode.isPending}
            >
              Didn&rsquo;t get it? Resend code
            </Button>
          )}
        </div>
      )}

      {isAcademic ? (
        <Checkbox
          checked={useForUniversity}
          onChange={(event) => onUseForUniversityChange(event.target.checked)}
          className={styles.checkbox}
        >
          Use my university email for alumni verification later
        </Checkbox>
      ) : null}
    </div>
  )
}

export default AccountStep
