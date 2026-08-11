import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import api from '../services/api';

interface PnLSummary {
  unrealizedPnL: number;
  realizedPnL: number;
  totalDividends: number;
  totalResult: number;
}

interface FixedIncomePnL {
  invested: number;
  currentValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
  projectedProfit: number;
  settledTotal: number;
  activeCount: number;
  totalResult: number;
}

interface PnLByStock {
  ticker: string;
  name: string;
  category: string;
  isOpen: boolean;
  unrealizedPnL: number;
  realizedPnL: number;
  dividends: number;
  totalResult: number;
}

type ViewMode = 'geral' | 'por-acao';

export default function PnLOverview() {
  const [summary, setSummary] = useState<PnLSummary | null>(null);
  const [fixedIncome, setFixedIncome] = useState<FixedIncomePnL | null>(null);
  const [byStock, setByStock] = useState<PnLByStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('geral');
  const [openExpanded, setOpenExpanded] = useState(true);
  const [closedExpanded, setClosedExpanded] = useState(true);

  useEffect(() => {
    document.title = 'Lucro/Perda';
    let isMounted = true;
    api.get('/dashboard/pnl-overview')
      .then((res) => {
        if (isMounted) {
          const sumData = res.data.summary;
          const fiData = res.data.fixedIncome || res.data.fixedIncomeSummary;
          const rawStocks = res.data.byStock || res.data.stocks || [];

          setSummary(sumData ? {
            unrealizedPnL: sumData.unrealizedPnL || 0,
            realizedPnL: sumData.realizedPnL || 0,
            totalDividends: sumData.totalDividends || 0,
            totalResult: sumData.totalResult ?? sumData.totalPnL ?? 0,
          } : null);

          setFixedIncome(fiData ? {
            invested: fiData.invested || 0,
            currentValue: fiData.currentValue || 0,
            unrealizedPnL: fiData.unrealizedPnL ?? fiData.netProfit ?? 0,
            realizedPnL: fiData.realizedPnL || 0,
            projectedProfit: fiData.projectedProfit || 0,
            settledTotal: fiData.settledTotal || 0,
            activeCount: fiData.activeCount || 0,
            totalResult: fiData.totalResult ?? fiData.netProfit ?? 0,
          } : null);

          setByStock(Array.isArray(rawStocks) ? rawStocks.map((s: { ticker: string; name: string; category: string; isOpen?: boolean; hasActivePosition?: boolean; unrealizedPnL?: number; realizedPnL?: number; dividends?: number; totalDividends?: number; totalResult?: number; totalPnL?: number }) => ({
            ticker: s.ticker,
            name: s.name,
            category: s.category,
            isOpen: s.isOpen ?? s.hasActivePosition ?? true,
            unrealizedPnL: s.unrealizedPnL || 0,
            realizedPnL: s.realizedPnL || 0,
            dividends: s.dividends ?? s.totalDividends ?? 0,
            totalResult: s.totalResult ?? s.totalPnL ?? 0,
          })) : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error loading P/L overview:', err);
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const openPositions = (byStock || []).filter((s) => s.isOpen);
  const closedPositions = (byStock || []).filter((s) => !s.isOpen);

  const renderStockTable = (
    title: string,
    items: PnLByStock[],
    expanded: boolean,
    onToggle: () => void,
  ) => (
    <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-left hover:bg-muted transition cursor-pointer"
      >
        {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <span className="font-semibold text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">({items.length})</span>
      </button>
      {expanded && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Ticker</th>
                <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Valorização</th>
                <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">P/L Vendas</th>
                <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Dividendos</th>
                <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.ticker} className="border-b border-border hover:bg-muted transition">
                  <td className="px-4 sm:px-6 py-4">
                    <div className="font-medium text-foreground">{item.ticker}</div>
                    <div className="text-xs text-muted-foreground">{item.name}</div>
                  </td>
                  <td className={`text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap ${item.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(item.unrealizedPnL)}
                  </td>
                  <td className={`text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap ${item.realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(item.realizedPnL)}
                  </td>
                  <td className="text-right px-4 sm:px-6 py-4 text-sm text-green-600 whitespace-nowrap">
                    {formatCurrency(item.dividends)}
                  </td>
                  <td className={`text-right px-4 sm:px-6 py-4 text-sm font-bold whitespace-nowrap ${item.totalResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(item.totalResult)}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 sm:px-6 py-8 text-center text-muted-foreground">
                    Nenhuma posição
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground">Lucro/Perda</h1>
        <div className="sm:ml-auto flex gap-2 overflow-x-auto">
          <button
            onClick={() => setViewMode('geral')}
            className={`px-3 py-1 text-sm rounded-lg transition whitespace-nowrap shrink-0 ${viewMode === 'geral' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            Geral
          </button>
          <button
            onClick={() => setViewMode('por-acao')}
            className={`px-3 py-1 text-sm rounded-lg transition whitespace-nowrap shrink-0 ${viewMode === 'por-acao' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            Por Ação
          </button>
        </div>
      </div>

      {viewMode === 'geral' && summary && (
        <div className="space-y-6 sm:space-y-8">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">Renda Variável</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
                <div className="text-sm text-muted-foreground mb-1">Valorização (não realizado)</div>
                <div className={`text-xl sm:text-2xl font-bold ${summary.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.unrealizedPnL)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
                <div className="text-sm text-muted-foreground mb-1">P/L Vendas (realizado)</div>
                <div className={`text-xl sm:text-2xl font-bold ${summary.realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.realizedPnL)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
                <div className="text-sm text-muted-foreground mb-1">Dividendos</div>
                <div className="text-xl sm:text-2xl font-bold text-green-600">
                  {formatCurrency(summary.totalDividends)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
                <div className="text-sm text-muted-foreground mb-1">Resultado da Renda Variável</div>
                <div className={`text-xl sm:text-2xl font-bold ${summary.totalResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.totalResult)}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">Renda Fixa</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
                <div className="text-sm text-muted-foreground mb-1">Rendimento líquido acumulado</div>
                <div className={`text-xl sm:text-2xl font-bold ${(fixedIncome?.unrealizedPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(fixedIncome?.unrealizedPnL || 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  se resgatasse hoje, já descontado o IR
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
                <div className="text-sm text-muted-foreground mb-1">Realizado (encerrados)</div>
                <div className={`text-xl sm:text-2xl font-bold ${(fixedIncome?.realizedPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(fixedIncome?.realizedPnL || 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(fixedIncome?.settledTotal || 0)} recebidos
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
                <div className="text-sm text-muted-foreground mb-1">Previsto até o vencimento</div>
                <div className={`text-xl sm:text-2xl font-bold ${(fixedIncome?.projectedProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(fixedIncome?.projectedProfit || 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {fixedIncome?.activeCount || 0} investimento(s) ativo(s)
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
                <div className="text-sm text-muted-foreground mb-1">Resultado da Renda Fixa</div>
                <div className={`text-xl sm:text-2xl font-bold ${(fixedIncome?.totalResult || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(fixedIncome?.totalResult || 0)}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Os resultados de renda fixa e renda variável são apurados de forma independente e nunca
              são somados entre si.
            </p>
          </section>
        </div>
        )}

        {viewMode === 'por-acao' && (
          <div className="space-y-6">
            {renderStockTable('Posições Abertas', openPositions, openExpanded, () => setOpenExpanded((v) => !v))}
            {renderStockTable('Posições Fechadas', closedPositions, closedExpanded, () => setClosedExpanded((v) => !v))}
          </div>
        )}
      </main>
    );
  }
