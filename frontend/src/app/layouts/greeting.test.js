import { describe, expect, it } from 'vitest'

import { getFirstName, getGreeting, getInitials } from './greeting'

const at = (hour, minute = 0) => new Date(2026, 9, 15, hour, minute)

describe('getGreeting', () => {
  it('greets by the hour of the day', () => {
    expect(getGreeting(at(0))).toBe('Good morning')
    expect(getGreeting(at(11, 59))).toBe('Good morning')
    expect(getGreeting(at(12))).toBe('Good afternoon')
    expect(getGreeting(at(17, 59))).toBe('Good afternoon')
    expect(getGreeting(at(18))).toBe('Good evening')
    expect(getGreeting(at(23, 59))).toBe('Good evening')
  })
})

describe('getFirstName', () => {
  it('takes the first word', () => {
    expect(getFirstName('Abdul Rafay')).toBe('Abdul')
    expect(getFirstName('  Sarah   Chen ')).toBe('Sarah')
  })

  it('gives an empty string without a name', () => {
    expect(getFirstName('')).toBe('')
    expect(getFirstName(undefined)).toBe('')
  })
})

describe('getInitials', () => {
  it('uses the first and last word', () => {
    expect(getInitials('Abdul Rafay')).toBe('AR')
    expect(getInitials('muhammad ali khan')).toBe('MK')
  })

  it('uses one letter for a single name', () => {
    expect(getInitials('Madonna')).toBe('M')
  })

  it('gives an empty string without a name', () => {
    expect(getInitials('   ')).toBe('')
    expect(getInitials(null)).toBe('')
  })
})
