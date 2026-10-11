import { createBrowserRouter } from 'react-router-dom'

import {
  ForgotPasswordPage,
  LinkedInCallbackPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  SelectRolePage,
} from '@/features/auth'
import { OnboardingPage, ResumeOnboardingRedirect } from '@/features/onboarding'

import App from '../../App'

import ProtectedRoute from './ProtectedRoute'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/auth/linkedin/callback', element: <LinkedInCallbackPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <App /> },
      { path: 'select-role', element: <SelectRolePage /> },
      { path: 'onboarding', element: <OnboardingPage /> },
      // Where sign-in and sign-up land; decides between onboarding and home.
      { path: 'start', element: <ResumeOnboardingRedirect /> },
    ],
  },
])
