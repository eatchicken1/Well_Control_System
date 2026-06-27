import { Navigate, Outlet, useLocation } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-panel">
          <ShieldCheck className="h-5 w-5 text-teal-600" />
          <span>正在校验登录状态...</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
