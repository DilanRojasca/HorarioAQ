import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import VerifyPage from './features/auth/VerifyPage';
import AuditPage from './features/admin/AuditPage';
import CatalogPage from './features/admin/CatalogPage';
import UsersPage from './features/admin/UsersPage';
import GapsPage from './features/gaps/GapsPage';
import NotificationsPage from './features/notifications/NotificationsPage';
import ProfilePage from './features/profile/ProfilePage';
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
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/forgot" element={<ForgotPasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route element={<ProtectedRoute role="STUDENT" />}>
                <Route path="/" element={<SchedulePage />} />
                <Route path="/gaps" element={<GapsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
              <Route element={<ProtectedRoute role="ADMIN" />}>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/catalog" element={<CatalogPage />} />
                <Route path="/admin/audit" element={<AuditPage />} />
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
