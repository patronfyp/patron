/**
 * Profile strength for the All set screen, from what the user really did.
 *
 * @param {import('../api/onboarding.api').Profile} profile
 * @param {import('@/features/verification/api/verification.api').VerificationStatus | undefined} status
 * @returns {{ percent: number, nextStep: string | null, isOneAway: boolean }}
 *   `nextStep` names the first thing still missing (null when everything is
 *   done); `isOneAway` is true when it is the only thing missing
 */
export function profileStrength(profile, status) {
  const items = [
    { done: Boolean(status?.email_verified), todo: 'Verify your email' },
    { done: Boolean(profile.photo_url), todo: 'Add a profile photo' },
    { done: Boolean(profile.headline), todo: 'Add a headline' },
    { done: Boolean(profile.bio), todo: 'Write a short bio' },
    { done: Boolean(profile.linkedin_url), todo: 'Add your LinkedIn profile' },
    { done: Boolean(status?.university_email), todo: 'Verify your university' },
    { done: Boolean(profile.cv), todo: 'Upload your CV' },
    { done: profile.skills.length > 0, todo: 'Add your skills' },
    { done: profile.desired_roles.length > 0, todo: 'Pick the roles you want' },
  ]

  const done = items.filter((item) => item.done).length
  return {
    percent: Math.round((done / items.length) * 100),
    nextStep: items.find((item) => !item.done)?.todo ?? null,
    isOneAway: items.length - done === 1,
  }
}
