// WorkMode in backend/app/modules/profiles/models.py - jobs reuse it.
export const WORK_MODES = [
  { value: 'on_site', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
]

const WORK_MODE_LABELS = Object.fromEntries(WORK_MODES.map((mode) => [mode.value, mode.label]))

// Company.hiring_timeline in backend/app/modules/companies/models.py.
export const HIRING_TIMELINES = [
  { value: 'this_month', label: 'This month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'always', label: 'Always hiring' },
]

/** "Lahore · Hybrid · PKR 450k-600k" (Figma 67:1170) - only the parts that exist. */
export function jobSummary(job) {
  const salary =
    job.salary_min !== null &&
    job.salary_min !== undefined &&
    job.salary_max !== null &&
    job.salary_max !== undefined
      ? `PKR ${Math.round(job.salary_min / 1000)}k–${Math.round(job.salary_max / 1000)}k`
      : null
  return [job.location, WORK_MODE_LABELS[job.work_mode], salary].filter(Boolean).join(' · ')
}
