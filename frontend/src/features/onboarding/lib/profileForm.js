import dayjs from 'dayjs'

import { formatSalaryRange, parseSalaryRange } from './validation'

// The plain fields PATCH /profile/me accepts - it rejects unknown ones, and the
// form also holds UI-only values (the verification method). `salary_range`
// and `available_from` need converting, so they are handled separately.
export const PROFILE_FIELDS = [
  'headline',
  'city',
  'phone',
  'linkedin_url',
  'bio',
  'university',
  'degree',
  'graduation_year',
  'employer_name',
  'skills',
  'primary_role',
  'desired_roles',
  'work_mode',
  'preferred_locations',
  'open_to_referrers',
  'job_title',
  'team',
  'referral_teams',
  'monthly_referral_limit',
  'accept_alumni_requests',
  'accept_any_verified_requests',
]

// Lists can't be null - an emptied one is sent as [].
const LIST_FIELDS = ['skills', 'desired_roles', 'preferred_locations', 'referral_teams']
// Switches can't be null either - an unset one is left out.
const BOOLEAN_FIELDS = [
  'open_to_referrers',
  'accept_alumni_requests',
  'accept_any_verified_requests',
]

/** The saved profile as the form's starting values. */
export function toFormValues(profile) {
  return {
    ...Object.fromEntries(PROFILE_FIELDS.map((field) => [field, profile[field] ?? undefined])),
    salary_range: formatSalaryRange(profile.salary_min, profile.salary_max),
    available_from: profile.available_from ? dayjs(profile.available_from) : undefined,
  }
}

// Only the fields on screen are in `values`; an emptied one is sent as null
// so clearing it in the form clears it on the profile too.
export function toProfileChanges(values) {
  const changes = Object.fromEntries(
    PROFILE_FIELDS.filter((field) => field in values).map((field) => [
      field,
      values[field] === '' ? null : (values[field] ?? null),
    ]),
  )
  if ('salary_range' in values) Object.assign(changes, parseSalaryRange(values.salary_range))
  if ('available_from' in values) {
    changes.available_from = values.available_from?.format('YYYY-MM-01') ?? null
  }
  for (const field of LIST_FIELDS) {
    if (field in changes && changes[field] === null) changes[field] = []
  }
  for (const field of BOOLEAN_FIELDS) {
    if (field in changes && changes[field] === null) delete changes[field]
  }
  return changes
}
