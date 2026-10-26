import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReaderAuthProvider, useReaderAuth } from './context/ReaderAuthContext';
import { ReaderLoginPage } from './pages/ReaderLoginPage';
import { LibraryPage } from './pages/LibraryPage';
import { ReaderPage } from './pages/ReaderPage';
import { CatalogStorePage } from './pages/CatalogStorePage';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { token } = useReaderAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export const App: React.FC = () => {
  return (
    <ReaderAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<ReaderLoginPage />} />

          <Route
            path="/library"
            element={
              <ProtectedRoute>
                <LibraryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/read/:id"
            element={
              <ProtectedRoute>
                <ReaderPage />
              </ProtectedRoute>
            }
          />

          <Route path="/store" element={<CatalogStorePage />} />

          <Route path="*" element={<Navigate to="/library" replace />} />
        </Routes>
      </BrowserRouter>
    </ReaderAuthProvider>
  );
};

export default App;
