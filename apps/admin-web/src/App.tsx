import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { AdminLayout } from './components/AdminLayout';
import { DashboardPage } from './pages/DashboardPage';
import { PublishersPage } from './pages/PublishersPage';
import { PublicationsPage } from './pages/PublicationsPage';
import { OffersPage } from './pages/OffersPage';
import { OrdersPage } from './pages/OrdersPage';
import { AuditPage } from './pages/AuditPage';
import { WhatsAppSimulatorPage } from './pages/WhatsAppSimulatorPage';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="publishers" element={<PublishersPage />} />
            <Route path="publications" element={<PublicationsPage />} />
            <Route path="offers" element={<OffersPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="whatsapp-simulator" element={<WhatsAppSimulatorPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
