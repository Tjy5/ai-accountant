import { Suspense, lazy, useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import api from './api/axiosInstance';

import { Layout } from './components/Layout';

const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const Register = lazy(() => import('./pages/Register').then((module) => ({ default: module.Register })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Transactions = lazy(() => import('./pages/Transactions').then((module) => ({ default: module.Transactions })));
const Categories = lazy(() => import('./pages/Categories').then((module) => ({ default: module.Categories })));
const Goals = lazy(() => import('./pages/Goals').then((module) => ({ default: module.Goals })));
const Budgets = lazy(() => import('./pages/Budgets').then((module) => ({ default: module.Budgets })));
const Reports = lazy(() => import('./pages/Reports').then((module) => ({ default: module.Reports })));
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));

const RouteFallback = () => (
  <div className="min-h-screen bg-cute-bg flex items-center justify-center text-[#4E3629] font-black">
    Loading...
  </div>
);

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
};

function App() {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          useAuthStore.setState({ user: res.data.user, token, isAuthenticated: true });
        })
        .catch(() => {
          useAuthStore.getState().logout();
        });
    }
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <Transactions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <Categories />
              </ProtectedRoute>
            }
          />
          <Route
            path="/goals"
            element={
              <ProtectedRoute>
                <Goals />
              </ProtectedRoute>
            }
          />
          <Route
            path="/budgets"
            element={
              <ProtectedRoute>
                <Budgets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route path="/ai-input" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
