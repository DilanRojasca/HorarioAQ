import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <>
      <a className="skip-link" href="#main">Saltar al contenido</a>
      <header className="app-header">
        <strong>Horario UNI</strong>
        <nav aria-label="Principal">
          {user?.role === 'STUDENT' && <NavLink to="/">Mi horario</NavLink>}
          {user?.role === 'ADMIN' && <NavLink to="/admin">Sincronización</NavLink>}
        </nav>
        <span className="user">{user?.name}</span>
        <button className="btn link" onClick={() => logout()}>Cerrar sesión</button>
      </header>
      <main id="main" className="container"><Outlet /></main>
    </>
  );
}
