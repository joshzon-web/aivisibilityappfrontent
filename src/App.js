import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import { ConfirmModalProvider } from './components/ConfirmModal';
import Auth from './pages/Auth';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import ClientDetail from './pages/ClientDetail';
import AllBusinesses from './pages/AllBusinesses';
import ScanResult from './pages/ScanResult';
import Business from './pages/Business';
import Prospecting from './pages/Prospecting';
import Settings from './pages/Settings';
import Pricing from './pages/Pricing';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg)',
    }}>
      <div style={{
        width: 28, height: 28,
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
  return user ? children : <Navigate to="/auth" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ConfirmModalProvider>
            <Routes>
              <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
              <Route path="/auth/verify" element={<VerifyEmail />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/clients/:id" element={<PrivateRoute><ClientDetail /></PrivateRoute>} />
              <Route path="/all-businesses" element={<PrivateRoute><AllBusinesses /></PrivateRoute>} />
              <Route path="/scan/:id" element={<PrivateRoute><ScanResult /></PrivateRoute>} />
              <Route path="/business/:id" element={<PrivateRoute><Business /></PrivateRoute>} />
              <Route path="/prospecting" element={<PrivateRoute><Prospecting /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/share/scan/:token" element={<ScanResult publicMode={true} />} />
              <Route path="*" element={<Navigate to="/auth" replace />} />
            </Routes>
          </ConfirmModalProvider>
        </ToastProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
