import { Navigate, Outlet } from 'react-router-dom'

import { useAuthStore } from '@/features/auth'

// Redirects to /login when there is no session. Nested routes render via <Outlet />.
function ProtectedRoute() {
  const accessToken = useAuthStore((state) => state.accessToken)

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
