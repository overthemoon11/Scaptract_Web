import { Routes, Route, Navigate } from 'react-router-dom';
import { TourProvider } from '../contexts/TourContext';
import { useEffect, useState, ReactNode } from 'react';
import { User } from './types';
import Loading from '../components/Loading';

// Pages
import Home from '../app/landing-page';
import LoginPage from '../pages/auth/login';
import RegisterPage from '../pages/auth/register';
import ForgotPasswordPage from '../pages/auth/forgot-password';
import ResetPasswordPage from '../pages/auth/reset-password';
import VerifyOTPPage from '../pages/auth/verify-otp';
import DocumentsPage from '../pages/documents';
import DocumentViewPage from '../pages/documents/view/[id]';
import ProfilePage from '../pages/profile';
import ScannerPage from '../pages/scanner';
import SupportPage from '../pages/support';
import SupportTicketPage from '../pages/support/ticket';
import NotificationsPage from '../pages/notifications/[id]';
import HomePage from '../pages/home';

// Admin Pages
import AdminUserPage from '../pages/admin/user';
import AdminAdminPage from '../pages/admin/admin';
import AdminDocumentPage from '../pages/admin/document';
import EditDocumentPage from '../pages/admin/document/edit/[id]';
import CommentOverviewPage from '../pages/admin/document/comments/[id]';
import EditReplyPage from '../pages/admin/document/comments/edit/[id]';
import AdminFAQPage from '../pages/admin/faq';
import AdminFAQAddPage from '../pages/admin/faq/add';
import AdminFAQEditPage from '../pages/admin/faq/edit/[id]';
import AdminSupportTicketPage from '../pages/admin/support-ticket';
import AnalyticsPage from '../pages/admin/analytics';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          if (requireAdmin && data.user.role !== 'admin') {
            window.location.href = '/profile';
          }
        } else {
          window.location.href = '/auth/login';
        }
      } catch (err) {
        window.location.href = '/auth/login';
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, [requireAdmin]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: '#101010'
      }}>
        <Loading text="Loading" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

function RootRoute() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      } catch (err) {
        // User not authenticated
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: '#101010'
      }}>
        <Loading text="Loading" />
      </div>
    );
  }

  // Redirect authenticated users to /home
  if (user) {
    // return <Navigate to="/home" replace />;
    return <Navigate to="/documents" replace />;
  }

  // Show landing page for unauthenticated users
  return <Home />;
}

function App() {
  return (
    <TourProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/verify-otp" element={<VerifyOTPPage />} />
        
        {/* Redirects */}
        <Route path="/login" element={<Navigate to="/auth/login" replace />} />
        <Route path="/register" element={<Navigate to="/auth/register" replace />} />

        {/* Protected Routes */}
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <DocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/view/group/:group_name"
          element={
            <ProtectedRoute>
              <DocumentViewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/view/:id"
          element={
            <ProtectedRoute>
              <DocumentViewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scanner"
          element={
            <ProtectedRoute>
              <ScannerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <SupportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support/ticket"
          element={
            <ProtectedRoute>
              <SupportTicketPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications/:id"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/user"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminUserPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/admin"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminAdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/document"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminDocumentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/document/edit/:id"
          element={
            <ProtectedRoute requireAdmin={true}>
              <EditDocumentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/document/comments/:id"
          element={
            <ProtectedRoute requireAdmin={true}>
              <CommentOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/document/comments/edit/:id"
          element={
            <ProtectedRoute requireAdmin={true}>
              <EditReplyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/faq"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminFAQPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/faq/add"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminFAQAddPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/faq/edit/:id"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminFAQEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/support-ticket"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminSupportTicketPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </TourProvider>
  );
}

export default App;

