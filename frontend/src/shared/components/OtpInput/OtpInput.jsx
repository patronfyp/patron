import { useEffect, useRef } from 'react'

import { Input } from 'antd'

// antd's Input.OTP formats the whole string on every keystroke, with a
// literal space standing in for each not-yet-filled box (see its
// patchValue) - stripping spaces here would collapse that padding and
// break which box is "next". Only non-digit, non-space characters are
// rejected.
const NOT_DIGIT_OR_SPACE = /[^0-9 ]/g

/**
 * A row of digit boxes for a 6-digit email verification code.
 *
 * Auto-advance, full-code paste and backspace-to-previous-box all come from
 * antd's `Input.OTP` - this wraps it so every call site (university step,
 * employer step, forgot-password flow, ...) gets the same digit-only
 * formatting, group label and autofocus behaviour instead of repeating them.
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
}) {
  const otpRef = useRef(null)
  // Reaching for focus() on mount rather than antd's own autoFocus prop: that
  // prop focuses the first box on every re-render with autoFocus set, which
  // would steal focus back after the user has already moved on.
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
