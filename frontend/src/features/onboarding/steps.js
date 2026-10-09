// The seven onboarding steps, in order. The backend only stores how far the
// user got (`onboarding_step`, 1-based) - which step is which lives here.
export const STEPS = [
  {
    key: 'account',
    label: 'Account',
    title: 'Your account',
    subtitle: 'Your account is set up. Email verification will live on this step.',
  },
  {
    key: 'profile',
    label: 'Profile',
    title: 'Tell us about yourself',
    subtitle: 'A photo, headline and location help people recognise you.',
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
    key: 'skills',
    label: 'Skills',
    title: 'Your skills',
    subtitle: 'The skills you want people to vouch for.',
  },
  {
    key: 'cv',
    label: 'CV',
    title: 'Your CV',
    subtitle: 'Upload or build the CV that goes out with your referrals.',
  },
  {
    key: 'preferences',
    label: 'Preferences',
    title: 'Your preferences',
    subtitle: 'The roles, locations and salary you are looking for.',
  },
]
