import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PublisherLayout } from './components/PublisherLayout';
import { DashboardPage } from './pages/DashboardPage';
import { PublicationsPage } from './pages/PublicationsPage';
import { OffersPage } from './pages/OffersPage';
import { OrdersPage } from './pages/OrdersPage';
import { AuditPage } from './pages/AuditPage';
import { SubscriptionPage } from './pages/SubscriptionPage';

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
      <BrowserRouter basename="/editora">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registar" element={<RegisterPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <PublisherLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="publications" element={<PublicationsPage />} />
            <Route path="offers" element={<OffersPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="subscricao" element={<SubscriptionPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
