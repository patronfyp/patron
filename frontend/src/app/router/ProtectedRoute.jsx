import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/features/auth'

const SELECT_ROLE_PATH = '/select-role'

/**
 * Redirects to /login when there is no session, and to /select-role when
 * there is one but no role yet - a LinkedIn sign-up (#25) reaches here with
 * role=null, since LinkedIn never tells us candidate vs company. Nested
 * routes render via <Outlet />.
 */
function ProtectedRoute() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const location = useLocation()

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  if (!user?.role && location.pathname !== SELECT_ROLE_PATH) {
    return <Navigate to={SELECT_ROLE_PATH} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
