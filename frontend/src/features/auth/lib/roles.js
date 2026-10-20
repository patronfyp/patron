import briefcaseIcon from '@/assets/icons/briefcase.svg'
import userCheckIcon from '@/assets/icons/user-check.svg'
import userIcon from '@/assets/icons/user.svg'

// The roles a user can give themselves - the "I want to" cards on the Figma
// Create account frame (64:2). Admin is never self-assigned, so it isn't here.
export const SIGNUP_ROLES = [
  { value: 'candidate', title: 'Get referred', label: 'Candidate', icon: userIcon },
  { value: 'referrer', title: 'Refer others', label: 'Referrer', icon: userCheckIcon },
  { value: 'recruiter', title: 'Hire talent', label: 'Recruiter', icon: briefcaseIcon },
]
