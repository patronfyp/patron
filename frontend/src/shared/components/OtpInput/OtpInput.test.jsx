import { useState } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import OtpInput from './OtpInput'

function ControlledOtpInput({ onComplete }) {
  const [value, setValue] = useState('')
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} />
}

function Boxes() {
  return screen.getAllByRole('textbox')
}

describe('OtpInput', () => {
  it('renders a labelled group of 6 boxes by default', () => {
    render(<OtpInput value="" onChange={() => {}} />)

    expect(screen.getByRole('group', { name: 'Verification code' })).toBeInTheDocument()
    expect(Boxes()).toHaveLength(6)
  })

  it('respects a custom length and aria label', () => {
    render(<OtpInput length={4} value="" onChange={() => {}} ariaLabel="Reset code" />)

    expect(screen.getByRole('group', { name: 'Reset code' })).toBeInTheDocument()
    expect(Boxes()).toHaveLength(4)
  })

  it('auto-advances across boxes as digits are typed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<OtpInput value="" onChange={onChange} />)

    await user.type(Boxes()[0], '123456')

    expect(onChange).toHaveBeenLastCalledWith('123456')
  })

  it('fires onComplete only once the value reaches the full length', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<ControlledOtpInput onComplete={onComplete} />)

    await user.type(Boxes()[0], '12345')
    expect(onComplete).not.toHaveBeenCalled()

    await user.type(screen.getAllByRole('textbox')[5], '6')
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('rejects non-digit characters instead of filling a box with them', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<ControlledOtpInput onComplete={onComplete} />)

    // Letters are rejected in place - typing one must not advance focus or
    // consume a box, so the 6 digits that follow still land in order.
    await user.type(Boxes()[0], 'a123456')

    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('shows an error status', () => {
    render(<OtpInput value="123456" onChange={() => {}} status="error" />)

    expect(Boxes()[0]).toHaveClass('ant-input-status-error')
  })

  it('disables every box when disabled', () => {
    render(<OtpInput value="" onChange={() => {}} disabled />)

    Boxes().forEach((box) => expect(box).toBeDisabled())
  })
})
