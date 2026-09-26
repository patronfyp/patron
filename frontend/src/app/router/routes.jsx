import { createBrowserRouter } from 'react-router-dom'

import { LoginPage, RegisterPage } from '@/features/auth'

import App from '../../App'

import ProtectedRoute from './ProtectedRoute'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [{ index: true, element: <App /> }],
  },
])
