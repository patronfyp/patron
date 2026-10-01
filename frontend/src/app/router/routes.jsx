import { createBrowserRouter } from 'react-router-dom'

import { LinkedInCallbackPage, LoginPage, RegisterPage, SelectRolePage } from '@/features/auth'

import App from '../../App'

import ProtectedRoute from './ProtectedRoute'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/auth/linkedin/callback', element: <LinkedInCallbackPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <App /> },
      { path: 'select-role', element: <SelectRolePage /> },
    ],
  },
])
