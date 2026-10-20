import { useEffect, useRef } from 'react'

import { Input } from 'antd'

import styles from './OtpInput.module.css'

// Spaces are kept: antd pads empty boxes with them.
const NOT_DIGIT_OR_SPACE = /[^0-9 ]/g

/**
 * Digit boxes for a verification code - antd's Input.OTP, digits only.
 *
 * @param {object} props
 * @param {number} [props.length] - how many digits, default 6
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {(value: string) => void} [props.onComplete] - fires once when `value` reaches `length`
 * @param {'error' | 'warning'} [props.status]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.autoFocus]
 * @param {string} [props.ariaLabel] - read by screen readers for the whole group
 * @param {'default' | 'large'} [props.size] - `large` is the 56 x 64 boxes of
 *   the Figma onboarding frames (65:53, 9:337)
 */
function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  status,
  disabled,
  autoFocus = false,
  ariaLabel = 'Verification code',
  size = 'default',
}) {
  const otpRef = useRef(null)
  // Once on mount: antd's autoFocus refocuses on every render.
  const hasAutoFocused = useRef(false)

  useEffect(() => {
    if (autoFocus && !hasAutoFocused.current) {
      hasAutoFocused.current = true
      otpRef.current?.focus()
    }
  }, [autoFocus])

  function handleChange(nextValue) {
    onChange?.(nextValue)
    if (nextValue.length === length) onComplete?.(nextValue)
  }

  return (
    <Input.OTP
      className={size === 'large' ? styles.large : undefined}
      ref={otpRef}
      aria-label={ariaLabel}
      length={length}
      value={value}
      onChange={handleChange}
      status={status}
      disabled={disabled}
      formatter={(input) => input.replace(NOT_DIGIT_OR_SPACE, '')}
      autoComplete="one-time-code"
    />
  )
}

export default OtpInput
