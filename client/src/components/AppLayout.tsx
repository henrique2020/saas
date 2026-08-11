import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Moon, Sun, LogOut, User, BarChart3, Landmark } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useDashboard } from '../hooks/useDashboard';
import Sidebar, { SidebarToggle } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { summary } = useDashboard();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  const rvCurrent = summary?.variableIncome?.currentValue ?? 0;
  const rvPnl = summary?.variableIncome?.unrealizedProfit ?? 0;

  const rfInvested = summary?.fixedIncome?.invested ?? 0;
  const rfCurrent = summary?.fixedIncome?.currentValue ?? 0;
  const rfPnl = rfCurrent - rfInvested;

  return (
    <div className="min-h-screen bg-muted">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />

      {/* Header/Nav */}
      <header className="bg-card text-card-foreground border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <SidebarToggle onToggle={() => setSidebarOpen(true)} />
            <Link
              to="/"
              className="text-lg sm:text-xl font-bold text-foreground hover:opacity-80 transition truncate shrink-0"
            >
              StockSaaS
            </Link>

            {/* Desktop / Tablet Nav Summary Buttons for RV & RF */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                to="/#renda-variavel"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/80 transition"
                title="Ir para Renda Variável"
              >
                <BarChart3 size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-semibold">{formatCurrency(rvCurrent)}</span>
                <span className={`text-[10px] px-1 py-0.5 rounded ${rvPnl >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                  {rvPnl >= 0 ? '+' : ''}{formatCurrency(rvPnl)}
                </span>
              </Link>

              <Link
                to="/#renda-fixa"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 transition"
                title="Ir para Renda Fixa"
              >
                <Landmark size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold">{formatCurrency(rfInvested)}</span>
                <span className={`text-[10px] px-1 py-0.5 rounded ${rfPnl >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                  {rfPnl >= 0 ? '+' : ''}{formatCurrency(rfPnl)}
                </span>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <Link
              to="/transactions/new"
              title="Nova Movimentação"
              aria-label="Nova Movimentação"
              className="flex items-center justify-center gap-1 bg-primary text-white h-10 w-10 sm:h-auto sm:w-auto sm:px-4 sm:py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Nova Movimentação</span>
            </Link>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              to="/settings"
              className="flex items-center justify-center h-10 w-10 sm:w-auto sm:h-auto sm:px-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted sm:hover:bg-transparent transition"
              title="Configurações"
              aria-label="Configurações"
            >
              <User size={18} className="sm:hidden" />
              <span className="hidden sm:inline max-w-[10rem] truncate">{user?.name}</span>
            </Link>
            <button
              onClick={logout}
              className="flex items-center justify-center h-10 w-10 sm:w-auto sm:h-auto sm:px-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted sm:hover:bg-transparent transition"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut size={18} className="sm:hidden" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
