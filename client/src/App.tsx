import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import NewTransaction from './pages/NewTransaction';
import SharedDashboard from './pages/SharedDashboard';
import SharedStockDetail from './pages/SharedStockDetail';
import ShareConfirm from './pages/ShareConfirm';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import ClosedPositions from './pages/ClosedPositions';
import PnLOverview from './pages/PnLOverview';
import AdminDividends from './pages/AdminDividends';
import AdminRates from './pages/AdminRates';
import FixedIncome from './pages/FixedIncome';
import Movements from './pages/Movements';
import AppLayout from './components/AppLayout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/" />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/stock/:ticker" element={<ProtectedRoute><StockDetail /></ProtectedRoute>} />
      <Route path="/transactions/new" element={<ProtectedRoute><NewTransaction /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/closed-positions" element={<ProtectedRoute><ClosedPositions /></ProtectedRoute>} />
      <Route path="/pnl" element={<ProtectedRoute><PnLOverview /></ProtectedRoute>} />
      <Route path="/movimentacoes" element={<ProtectedRoute><Movements /></ProtectedRoute>} />
      <Route path="/renda-fixa" element={<ProtectedRoute><FixedIncome /></ProtectedRoute>} />
      <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
      <Route path="/admin/taxas" element={<ProtectedRoute><AdminRates /></ProtectedRoute>} />
      <Route path="/admin/dividendos-automaticos" element={<ProtectedRoute><AdminDividends /></ProtectedRoute>} />
      <Route path="/shared/:shareId" element={<ProtectedRoute><SharedDashboard /></ProtectedRoute>} />
      <Route path="/shared/:shareId/stock/:ticker" element={<ProtectedRoute><SharedStockDetail /></ProtectedRoute>} />
      <Route path="/share/confirm" element={<ProtectedRoute><ShareConfirm /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
