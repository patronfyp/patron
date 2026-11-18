// The onboarding steps in Figma's order. The backend only stores the number.
export const STEPS = [
  {
    key: 'account',
    label: 'Account',
    title: 'Verify your email',
    subtitle: 'We sent a 6-digit code to your inbox. Enter it below to secure your PATRON account.',
  },
  {
    key: 'profile',
    label: 'Profile',
    title: 'Set up your profile',
    subtitle: 'Tell referrers who you are. You can edit all of this later from your profile.',
  },
  {
    key: 'university',
    label: 'University',
    title: 'Verify your university',
    subtitle:
      'Alumni referrals only work when your degree is real. Choose how you would like to verify it.',
  },
  {
    key: 'employer',
    label: 'Employer',
    title: 'Confirm where you work',
    subtitle:
      'Optional for candidates, required for referrers. A verified employer lets you refer others and unlocks Double-Verified status.',
  },
  {
    key: 'cv',
    label: 'CV',
    title: 'Upload your CV',
    subtitle:
      'Referrers attach this to your referral. We use it to match you with the right people.',
  },
  {
    key: 'skills',
    label: 'Skills',
    // Figma's copy ("We read your CV...") describes AI reading the CV, which
    // isn't built yet (Module 9) - this says what the step really does.
    title: 'Check your skills',
    subtitle: "Add the skills you want referrers to see. Keep what's right, remove what's not.",
  },
  {
    key: 'preferences',
    label: 'Preferences',
    title: 'What are you looking for?',
    subtitle: 'Last step. Tell us the roles and places you want, and we will do the matching.',
  },
]

// The referrer's own three steps (Figma 67:505, 67:641), for a user whose only
// role is referrer - the backend allows them three steps instead of seven.
export const REFERRER_STEPS = [
  STEPS[0],
  {
    key: 'referrerEmployer',
    label: 'Employer',
    title: 'Verify where you work',
    subtitle:
      'Referrals carry weight because they come from inside. Confirm your employer once and you are set.',
  },
  {
    key: 'referring',
    label: 'Referring',
    title: 'How do you want to refer?',
    subtitle: 'Set limits so requests never pile up. You can change these any time.',
  },
]

// The recruiter's own four steps (Figma 67:899, 67:1040, 67:1170), for a user
// whose only role is recruiter - matches backend/app/modules/profiles/models.py's
// RECRUITER_ONBOARDING_STEP_COUNT.
export const RECRUITER_STEPS = [
  STEPS[0],
  {
    key: 'company',
    label: 'Company',
    title: 'Set up your company',
    subtitle: "Verify your work email and we'll confirm or create your company on PATRON.",
  },
  {
    key: 'team',
    label: 'Team',
    title: 'Invite your hiring team',
    subtitle: 'Hiring managers review candidates, interviewers leave scorecards.',
  },
  {
    key: 'hiring',
    label: 'Hiring',
    title: 'What are you hiring for?',
    subtitle: 'Pick your open roles. We will match them with referred candidates right away.',
  },
]

// An invited hiring manager or interviewer: their company already exists
// (whoever invited them built it), so only Account is left - matches
// TEAM_MEMBER_ONBOARDING_STEP_COUNT.
export const TEAM_MEMBER_STEPS = [STEPS[0]]

/** True for a user who only refers - they get REFERRER_STEPS. */
export function isReferrerOnly(roles) {
  return roles?.length === 1 && roles[0] === 'referrer'
}

/** True for a user who only recruits - they get RECRUITER_STEPS (or
 * TEAM_MEMBER_STEPS, if `companyRole` says someone else's company invited
 * them in rather than them building their own). */
export function isRecruiterOnly(roles) {
  return roles?.length === 1 && roles[0] === 'recruiter'
}

export const TEAM_MEMBER_COMPANY_ROLES = ['hiring_manager', 'interviewer']

/**
 * The wizard's steps for a user with these roles.
 *
 * @param {string[]} roles - the signed-in user's app roles
 * @param {string | null} [companyRole] - their role at their company, if
 *   any (`my_role` from `GET /companies/me`) - only read for a recruiter-only
 *   user, same as the backend's `onboarding_step_count`.
 */
export function stepsFor(roles, companyRole = null) {
  if (isReferrerOnly(roles)) return REFERRER_STEPS
  if (isRecruiterOnly(roles)) {
    return TEAM_MEMBER_COMPANY_ROLES.includes(companyRole) ? TEAM_MEMBER_STEPS : RECRUITER_STEPS
  }
  return STEPS
}
