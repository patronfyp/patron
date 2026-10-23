import { createBrowserRouter } from 'react-router-dom'

import {
  ForgotPasswordPage,
  LinkedInCallbackPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  SelectRolePage,
  SettingsPage,
} from '@/features/auth'
import { AllSetPage, OnboardingPage, ResumeOnboardingRedirect } from '@/features/onboarding'
import { EditProfilePage, ProfilePage } from '@/features/profile'

import App from '../App'
import AppLayout from '../layouts/AppLayout'

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
      {
        index: true,
        element: (
          <AppLayout>
            <App />
          </AppLayout>
        ),
      },
      { path: 'select-role', element: <SelectRolePage /> },
      { path: 'onboarding', element: <OnboardingPage /> },
      { path: 'onboarding/done', element: <AllSetPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'profile/edit', element: <EditProfilePage /> },
      { path: 'profile/:userId', element: <ProfilePage /> },
      // Where sign-in and sign-up land; decides between onboarding and home.
      { path: 'start', element: <ResumeOnboardingRedirect /> },
    ],
  },
])
