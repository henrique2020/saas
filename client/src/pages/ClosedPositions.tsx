import { useEffect, useState } from 'react';
import api from '../services/api';

interface ClosedPosition {
  ticker: string;
  name: string;
  market: string;
  category: string;
  totalBought?: number;
  totalSold?: number;
  realizedPnL: number;
  totalDividends: number;
  firstDate?: string;
  firstBuyDate?: string;
  lastDate?: string;
  closedDate?: string;
}

export default function ClosedPositions() {
  const [positions, setPositions] = useState<ClosedPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Posições Fechadas';
    let isMounted = true;
    api.get('/dashboard/closed-positions')
      .then((res) => {
        if (isMounted) {
          setPositions(Array.isArray(res.data) ? res.data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error loading closed positions:', err);
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, []);

  const formatCurrency = (value: number | undefined) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <h1 className="text-xl font-bold text-foreground mb-6">Posições Fechadas</h1>
      {positions.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          Nenhuma posição encerrada encontrada.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Ticker</th>
                <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Total Comprado</th>
                <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Total Vendido</th>
                <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">P/L Realizado</th>
                <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Dividendos</th>
                <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Período</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => {
                const startDate = (pos.firstDate || pos.firstBuyDate || '').split('T')[0];
                const endDate = (pos.lastDate || pos.closedDate || '').split('T')[0];
                return (
                  <tr key={pos.ticker} className="border-b border-border hover:bg-muted transition">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="font-medium text-foreground">{pos.ticker}</div>
                      <div className="text-xs text-muted-foreground">{pos.name}</div>
                    </td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm text-foreground whitespace-nowrap">{formatCurrency(pos.totalBought)}</td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm text-foreground whitespace-nowrap">{formatCurrency(pos.totalSold)}</td>
                    <td className={`text-right px-4 sm:px-6 py-4 text-sm font-medium whitespace-nowrap ${pos.realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(pos.realizedPnL)}
                    </td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm text-green-600 whitespace-nowrap">{formatCurrency(pos.totalDividends)}</td>
                    <td className="text-right px-4 sm:px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                      {startDate && endDate ? `${startDate} — ${endDate}` : startDate || endDate || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
