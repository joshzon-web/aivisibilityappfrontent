import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import ClientDetail from './pages/ClientDetail';
import AllBusinesses from './pages/AllBusinesses';
import ScanResult from './pages/ScanResult';
import Business from './pages/Business';
import Prospecting from './pages/Prospecting';
import Settings from './pages/Settings';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
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
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/clients/:id" element={<PrivateRoute><ClientDetail /></PrivateRoute>} />
            <Route path="/all-businesses" element={<PrivateRoute><AllBusinesses /></PrivateRoute>} />
            <Route path="/scan/:id" element={<PrivateRoute><ScanResult /></PrivateRoute>} />
            <Route path="/business/:id" element={<PrivateRoute><Business /></PrivateRoute>} />
            <Route path="/prospecting" element={<PrivateRoute><Prospecting /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            {/* Public share links — no auth wrapper so anyone (even non-users) can view */}
            <Route path="/share/scan/:token" element={<ScanResult publicMode={true} />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
