import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import axios from 'axios';
import api from '../services/api';
import type { SharedDashboardSummary } from '../types';

export default function SharedDashboard() {
  const { shareId } = useParams<{ shareId: string }>();
  const [summary, setSummary] = useState<SharedDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shareId) return;
    document.title = 'Portfólio compartilhado';
    let isMounted = true;
    api.get(`/shares/${shareId}/summary`)
      .then((summaryRes) => {
        if (isMounted) {
          setSummary(summaryRes.data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const message = axios.isAxiosError(err) && err.response?.data?.error
            ? (err.response.data.error as string)
            : 'Erro ao carregar portfólio compartilhado';
          setError(message);
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, [shareId]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;

  if (error || !summary) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error || 'Sem dados'}</div>;
  }

  return (
    <div className="min-h-screen bg-muted">
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 flex items-center gap-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">Portfólio compartilhado</h1>
            <p className="text-sm text-muted-foreground">{summary.owner.name} ({summary.owner.email})</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
            <div className="text-sm text-muted-foreground mb-1">Investido</div>
            <div className="text-xl sm:text-2xl font-bold">{formatCurrency(summary.totalInvested)}</div>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
            <div className="text-sm text-muted-foreground mb-1">Dividendos</div>
            <div className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(summary.totalDividends)}</div>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border">
            <div className="text-sm text-muted-foreground mb-1">Ações em carteira</div>
            <div className="text-xl sm:text-2xl font-bold">{summary.totalStocks}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-border">
          <div className="p-4 sm:p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Posições</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Ticker</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Qtd</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">PM</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Cotação</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">PT</th>
                </tr>
              </thead>
              <tbody>
                {summary.positions.map((pos) => {
                  const price = pos.currentPrice || pos.averagePrice;
                  return (
                    <tr key={pos.ticker} className="border-b border-border hover:bg-muted transition">
                      <td className="px-4 sm:px-6 py-4">
                        <Link to={`/shared/${shareId}/stock/${pos.ticker}`} className="font-medium text-primary hover:underline">
                          {pos.ticker}
                        </Link>
                        <div className="text-xs text-muted-foreground">{pos.name}</div>
                      </td>
                      <td className="text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{pos.quantity.toFixed(0)}</td>
                      <td className="text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatCurrency(pos.averagePrice)}</td>
                      <td className="text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatCurrency(price)}</td>
                      <td className="text-right px-4 sm:px-6 py-4 text-sm font-medium whitespace-nowrap">{formatCurrency(pos.quantity * price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
