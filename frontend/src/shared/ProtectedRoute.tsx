import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

/** @pattern Guard | Guarda de rutas por rol | Primero «¿hay sesión?», luego «¿tiene el rol?» antes de renderizar. */
export default function ProtectedRoute({ role }: { role?: 'ADMIN' | 'STUDENT' }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/'} replace />;
  return <Outlet />;
}
