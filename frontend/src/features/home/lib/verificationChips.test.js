import { describe, expect, it } from 'vitest'

import { verificationChips } from './verificationChips'

const none = { university_email: null, employer_email: null, documents: [] }

describe('verificationChips', () => {
  it('says verified for an email on the domain', () => {
    const chips = verificationChips({
      ...none,
      university_email: { email: 'a@lums.edu.pk' },
      employer_email: { email: 'a@garner.com' },
    })

    expect(chips.map((chip) => [chip.label, chip.tone])).toEqual([
      ['University verified', 'verified'],
      ['Employer verified', 'verified'],
    ])
  })

  it('says pending while a document waits for review', () => {
    const chips = verificationChips({
      ...none,
      documents: [{ kind: 'employer', status: 'pending' }],
    })

    expect(chips[1]).toMatchObject({ label: 'Employer · pending', tone: 'pending' })
  })

  it('asks for verification when there is nothing yet', () => {
    const chips = verificationChips({
      ...none,
      documents: [{ kind: 'university', status: 'rejected' }],
    })

    expect(chips.map((chip) => [chip.label, chip.tone])).toEqual([
      ['Verify university', 'todo'],
      ['Verify employer', 'todo'],
    ])
  })
})
