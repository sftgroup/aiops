import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../token';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = getToken();
  const location = useLocation();

  if (!token) {
    // Preserve the attempted URL so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
