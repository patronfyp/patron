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
import { ConnectionsPage } from '@/features/connections'
import { HomePage } from '@/features/home'
import { AllSetPage, OnboardingPage, ResumeOnboardingRedirect } from '@/features/onboarding'
import { EditProfilePage, ProfilePage } from '@/features/profile'

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
      // Inside the app shell: sidebar + top navigation. Each `handle` sets the
      // top bar's breadcrumb and heading (see AppLayout).
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage />, handle: { breadcrumb: ['Home', 'Overview'] } },
          {
            path: 'connections',
            element: <ConnectionsPage />,
            handle: { breadcrumb: ['Home', 'Connections'], title: 'Your network' },
          },
          // Pages with a heading of their own leave the top bar's out (title: null).
          {
            path: 'profile/edit',
            element: <EditProfilePage />,
            handle: { breadcrumb: ['Home', 'Profile', 'Edit'], title: null },
          },
          {
            path: 'profile/:userId',
            element: <ProfilePage />,
            handle: { breadcrumb: ['Home', 'Profile'], title: null },
          },
          {
            path: 'settings',
            element: <SettingsPage />,
            handle: { breadcrumb: ['Home', 'Settings'], title: null },
          },
        ],
      },
      // Full-screen flows, outside the shell.
      { path: 'select-role', element: <SelectRolePage /> },
      { path: 'onboarding', element: <OnboardingPage /> },
      { path: 'onboarding/done', element: <AllSetPage /> },
      // Where sign-in and sign-up land; decides between onboarding and home.
      { path: 'start', element: <ResumeOnboardingRedirect /> },
    ],
  },
])
