import briefcaseIcon from '@/assets/icons/briefcase-12.svg'
import capIcon from '@/assets/icons/cap-12.svg'
import diamondIcon from '@/assets/icons/diamond-12.svg'

/**
 * How each connection type looks (Figma Connection Card, 14:370): the chip's
 * label, icon and colour. The type itself comes from the backend (ADR 0023).
 */
export const CONNECTION_TYPES = {
  professional: { label: 'Professional', icon: briefcaseIcon, tone: 'neutral' },
  alumni: { label: 'Alumni', icon: capIcon, tone: 'alum' },
  both: { label: 'Professional + Alumni', icon: diamondIcon, tone: 'dv' },
}

/**
 * The line under a person's name: "Product Manager · Motive", else their
 * headline, else their university.
 *
 * @param {import('../api/connections.api').PersonSummary} person
 */
export function personSubline(person) {
  const work = [person.job_title, person.employer_name].filter(Boolean).join(' · ')
  return work || person.headline || person.university || ''
}
