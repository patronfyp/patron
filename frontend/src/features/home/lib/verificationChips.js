import checkCircleIcon from '@/assets/icons/check-circle-12.svg'
import clockIcon from '@/assets/icons/clock-12.svg'
import plusIcon from '@/assets/icons/plus-12.svg'

/**
 * The University and Employer chips on the Readiness card (Figma 10:130),
 * from what is really verified: an email on the domain, a document waiting
 * for review, or nothing yet.
 *
 * @param {import('@/features/verification/api/verification.api').VerificationStatus} status
 * @returns {{ key: string, label: string, icon: string, tone: 'verified' | 'pending' | 'todo' }[]}
 */
export function verificationChips(status) {
  const pending = (kind) =>
    status.documents.some((doc) => doc.kind === kind && doc.status === 'pending')

  const chip = (key, name, verified) => {
    if (verified) {
      return { key, label: `${name} verified`, icon: checkCircleIcon, tone: 'verified' }
    }
    if (pending(key)) return { key, label: `${name} · pending`, icon: clockIcon, tone: 'pending' }
    return { key, label: `Verify ${name.toLowerCase()}`, icon: plusIcon, tone: 'todo' }
  }

  return [
    chip('university', 'University', Boolean(status.university_email)),
    chip('employer', 'Employer', Boolean(status.employer_email)),
  ]
}
