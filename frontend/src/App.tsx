import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import LoginPage from './features/auth/LoginPage';
import AdminPage from './features/admin/AdminPage';
import SchedulePage from './features/schedule/SchedulePage';
import Layout from './shared/Layout';
import ProtectedRoute from './shared/ProtectedRoute';
import { RealtimeProvider } from './shared/RealtimeProvider';
import { ToastProvider } from './features/notifications/ToastProvider';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <RealtimeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route element={<ProtectedRoute role="STUDENT" />}>
                <Route path="/" element={<SchedulePage />} />
              </Route>
              <Route element={<ProtectedRoute role="ADMIN" />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      </RealtimeProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
