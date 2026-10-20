import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/features/auth'

const SELECT_ROLE_PATH = '/select-role'

/**
 * No session -> /login; no role yet (a LinkedIn sign-up) -> /select-role.
 */
function ProtectedRoute() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const location = useLocation()

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  if (!user?.roles?.length && location.pathname !== SELECT_ROLE_PATH) {
    return <Navigate to={SELECT_ROLE_PATH} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
