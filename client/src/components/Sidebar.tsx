import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Home, Archive, TrendingUp, Settings, DollarSign, FileText, RefreshCw, ArrowLeftRight, Landmark, Percent, BarChart3, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import api from '../services/api';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/#renda-variavel', icon: BarChart3, label: 'Renda Variável', onlyMobile: true },
  { to: '/#renda-fixa', icon: Landmark, label: 'Renda Fixa', onlyMobile: true },
  { to: '/movimentacoes', icon: ArrowLeftRight, label: 'Movimentações' },
  { to: '/renda-fixa', icon: Wallet, label: 'Gerenciar Renda Fixa' },
  { to: '/closed-positions', icon: Archive, label: 'Posições Fechadas' },
  { to: '/pnl', icon: TrendingUp, label: 'Lucro/Perda' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];

const adminLinkItems = [
  { to: '/admin/dividendos-automaticos', icon: DollarSign, label: 'Dividendos' },
  { to: '/admin/taxas', icon: Percent, label: 'Taxas (Selic/IPCA)' },
  { to: '/audit-logs', icon: FileText, label: 'Logs de Auditoria' },
];

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [syncingMonth, setSyncingMonth] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Trava o scroll do body enquanto o menu está aberto no mobile
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const handleSyncMonth = async () => {
    if (syncingMonth) return;
    setSyncingMonth(true);
    setSyncResult(null);
    try {
      const res = await api.post('/stocks/admin/sync-month');
      setSyncResult(`✓ ${res.data.tickers} tickers, ${res.data.totalBars} barras (${res.data.month})`);
    } catch (error: unknown) {
      const message = axios.isAxiosError(error) && error.response?.data?.error
        ? (error.response.data.error as string)
        : 'Erro na sincronização';
      setSyncResult(`✗ ${message}`);
    } finally {
      setSyncingMonth(false);
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 bg-white border-r border-border transition-transform duration-200 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } w-[85vw] max-w-[18rem] sm:w-64`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          <span className="text-lg font-bold text-foreground">StockSaaS</span>
          <button
            onClick={onToggle}
            className="flex items-center justify-center h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1 flex-1 overflow-y-auto overscroll-contain">
          {navItems.map((item) => {
            // Itens com âncora (ex.: /#renda-fixa) ficam ativos pelo hash atual
            const [path, hash] = item.to.split('#');
            const normalizedPath = path || '/';
            const isActive = hash
              ? location.pathname === normalizedPath && location.hash === `#${hash}`
              : location.pathname === item.to && !location.hash;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onToggle}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition ${
                  item.onlyMobile ? 'md:hidden' : ''
                } ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <item.icon size={18} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}

          {user?.role === 'ADMIN' && (
            <>
              <div className="pt-4 pb-2 px-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</span>
              </div>
              {adminLinkItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onToggle}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <item.icon size={18} className="shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
              {/* Sync inline button */}
              <button
                onClick={handleSyncMonth}
                disabled={syncingMonth}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition w-full text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw size={18} className={syncingMonth ? 'animate-spin' : ''} />
                {syncingMonth ? 'Sincronizando...' : 'Sync Cotações'}
              </button>
              {syncResult && (
                <div className={`mx-3 mt-1 px-3 py-2 rounded-lg text-xs ${syncResult.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {syncResult}
                </div>
              )}
            </>
          )}
        </nav>
      </aside>
    </>
  );
}

export function SidebarToggle({ onToggle }: { onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-center h-10 w-10 shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
      title="Menu"
      aria-label="Abrir menu"
    >
      <Menu size={20} />
    </button>
  );
}
