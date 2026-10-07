import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../features/auth/AuthContext';
import ProtectedRoute from './ProtectedRoute';

function seed(role?: 'ADMIN' | 'STUDENT') {
  sessionStorage.clear();
  if (!role) return;
  sessionStorage.setItem('horario_token', 't');
  sessionStorage.setItem('horario_user', JSON.stringify({ id: '1', name: 'U', email: 'u@x.co', role }));
}

function renderAt(path: string) {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<p>login</p>} />
          <Route element={<ProtectedRoute />}>
            <Route element={<ProtectedRoute role="STUDENT" />}>
              <Route path="/" element={<p>student home</p>} />
            </Route>
            <Route element={<ProtectedRoute role="ADMIN" />}>
              <Route path="/admin" element={<p>admin home</p>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => seed());

  it('admin en / termina en /admin sin bucle', () => {
    seed('ADMIN');
    renderAt('/');
    expect(screen.getByText('admin home')).toBeInTheDocument();
  });

  it('estudiante en /admin termina en /', () => {
    seed('STUDENT');
    renderAt('/admin');
    expect(screen.getByText('student home')).toBeInTheDocument();
  });

  it('anónimo va a /login', () => {
    renderAt('/');
    expect(screen.getByText('login')).toBeInTheDocument();
    renderAt('/admin');
    expect(screen.getAllByText('login')).toHaveLength(2);
  });
});
