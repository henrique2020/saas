import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, TrendingDown, TrendingUp } from 'lucide-react';
import api from '../services/api';

interface SharedDetail {
  stock: { ticker: string; name: string; market: string; category: string };
  position: {
    quantity: number;
    totalInvested: number;
    averagePrice: number;
    currentPrice: number;
    totalDividends?: number;
    realizedPnL?: number;
  };
  totalDividends?: number;
  dividendsByYear?: Record<string, number>;
  realizedPnL?: number;
  transactions?: Array<{ id: string; type: string; quantity: any; price: any; date: string; fees?: any }>;
  dividends?: Array<{ source: string; ticker: string; totalAmount: number; paymentDate: string; type: string }>;
}

export default function SharedStockDetail() {
  const { shareId, ticker } = useParams<{ shareId: string; ticker: string }>();
  const [detail, setDetail] = useState<SharedDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shareId || !ticker) return;
    document.title = `${ticker.toUpperCase()} (compartilhado)`;
    loadData();
  }, [shareId, ticker]);

  const loadData = async () => {
    try {
      const res = await api.get(`/shares/${shareId}/stock/${ticker}`);
      setDetail(res.data);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('T')[0].split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('pt-BR');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!detail) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Ação não encontrada</div>;

  const currentPrice = detail.position.currentPrice || detail.position.averagePrice;
  const totalValue = detail.position.quantity * currentPrice;
  const unrealizedPnL = totalValue - detail.position.totalInvested;
  const transactions = detail.transactions || [];
  const dividendsList = detail.dividends || [];
  const totalDividends = detail.totalDividends ?? detail.position?.totalDividends ?? 0;
  const realizedPnL = detail.realizedPnL ?? detail.position?.realizedPnL ?? 0;
  const hasSales = transactions.some(tx => tx.type === 'SELL');
  const yearEntries = Object.entries(detail.dividendsByYear || {}).sort(([a], [b]) => Number(b) - Number(a));

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-4">
          <Link to={`/shared/${shareId}`} className="text-muted-foreground hover:text-foreground transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{detail.stock.ticker}</h1>
            <p className="text-sm text-muted-foreground">{detail.stock.name} • somente leitura</p>
          </div>
        </div>
        <div className="sm:ml-auto text-right">
          <div className="text-xl font-bold">{formatCurrency(currentPrice)}</div>
        </div>
      </div>

      {/* Position cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
          <div className="text-sm text-muted-foreground mb-1">Quantidade</div>
          <div className="text-xl sm:text-2xl font-bold">{detail.position.quantity.toFixed(0)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
          <div className="text-sm text-muted-foreground mb-1">Preço Médio</div>
          <div className="text-xl sm:text-2xl font-bold">{formatCurrency(detail.position.averagePrice)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
          <div className="text-sm text-muted-foreground mb-1">Patrimônio Total</div>
          <div className="text-xl sm:text-2xl font-bold">{formatCurrency(totalValue)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
          <div className="text-sm text-muted-foreground mb-1">L/P Não Realizado</div>
          <div className={`text-xl sm:text-2xl font-bold ${unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {unrealizedPnL >= 0 ? <TrendingUp size={16} className="inline mr-1" /> : <TrendingDown size={16} className="inline mr-1" />}
            {formatCurrency(unrealizedPnL)}
          </div>
        </div>
      </div>

      {/* Realized P/L + Dividends row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 sm:mb-8">
        {hasSales && (
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
            <div className="text-sm text-muted-foreground mb-1">L/P Vendas (Realizado)</div>
            <div className={`text-xl sm:text-2xl font-bold ${realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(realizedPnL)}
            </div>
          </div>
        )}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
          <div className="text-sm text-muted-foreground mb-1">Dividendos Totais</div>
          <div className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(totalDividends)}</div>
        </div>
        {yearEntries.length > 0 && (
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
            <div className="text-sm text-muted-foreground mb-2">Dividendos por Ano</div>
            <div className="space-y-1">
              {yearEntries.map(([year, amount]) => (
                <div key={year} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{year}</span>
                  <span className="font-medium text-green-600">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-border mb-6 sm:mb-8">
          <div className="p-4 sm:p-6 border-b border-border">
            <h3 className="text-lg font-semibold">Histórico de Movimentações</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Tipo</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Qtd</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Preço</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border">
                    <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm">{tx.type === 'BUY' ? 'COMPRA' : 'VENDA'}</td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{Number(tx.quantity).toFixed(0)}</td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatCurrency(Number(tx.price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dividends list */}
      {dividendsList.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-border">
          <div className="p-4 sm:p-6 border-b border-border">
            <h3 className="text-lg font-semibold">Dividendos Recebidos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Pagamento</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Origem</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Valor</th>
                </tr>
              </thead>
              <tbody>
                {dividendsList.map((d, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatDate(d.paymentDate)}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm">{d.type}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm">{d.source === 'auto' ? 'Automático' : 'Manual'}</td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm text-green-600 font-medium whitespace-nowrap">{formatCurrency(d.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
