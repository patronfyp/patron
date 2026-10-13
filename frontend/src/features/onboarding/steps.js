// The seven onboarding steps, in Figma's order (frames 65:53 ... 65:545). The
// backend only stores how far the user got (`onboarding_step`, 1-based) - which
// step is which lives here.
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
