import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { ArrowLeft, Plus, X, Trash2, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';
import api from '../services/api';
import type { StockDetail, Transaction, CalculatedDividend } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function StockDetailPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [evolutionRange, setEvolutionRange] = useState<'day' | 'month' | 'year'>('month');
  const [evolutionSeries, setEvolutionSeries] = useState<{ date: string; cotacao: number; valorPatrimonial: number; precoMedio: number }[]>([]);

  // Collapsible sections
  const [isMovementsOpen, setIsMovementsOpen] = useState(true);
  const [isDividendsOpen, setIsDividendsOpen] = useState(true);

  // Add Transaction Modal Pop-up
  const [showTxModal, setShowTxModal] = useState(false);
  const [txFormLoading, setTxFormLoading] = useState(false);
  const [txFormError, setTxFormError] = useState('');
  const [txType, setTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [txQuantity, setTxQuantity] = useState('');
  const [txPrice, setTxPrice] = useState('');
  const [txFees, setTxFees] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txNotes, setTxNotes] = useState('');
  const [txSortDir, setTxSortDir] = useState<'desc' | 'asc'>('desc');

  // Add Dividend Modal Pop-up
  const [showDivModal, setShowDivModal] = useState(false);
  const [divFormLoading, setDivFormLoading] = useState(false);
  const [divFormError, setDivFormError] = useState('');
  const [divAmount, setDivAmount] = useState('');
  const [divComDate, setDivComDate] = useState('');
  const [divPaymentDate, setDivPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [divType, setDivType] = useState<'DIVIDENDO' | 'JCP' | 'RENDIMENTO'>('DIVIDENDO');
  const [divNotes, setDivNotes] = useState('');

  // Edit transaction modal
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editTxType, setEditTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [editTxQuantity, setEditTxQuantity] = useState('');
  const [editTxPrice, setEditTxPrice] = useState('');
  const [editTxFees, setEditTxFees] = useState('');
  const [editTxDate, setEditTxDate] = useState('');
  const [editTxNotes, setEditTxNotes] = useState('');
  const [editTxLoading, setEditTxLoading] = useState(false);

  // Edit dividend modal
  const [editDiv, setEditDiv] = useState<CalculatedDividend | null>(null);
  const [editDivAmount, setEditDivAmount] = useState('');
  const [editDivPaymentDate, setEditDivPaymentDate] = useState('');
  const [editDivType, setEditDivType] = useState<'DIVIDENDO' | 'JCP' | 'RENDIMENTO'>('DIVIDENDO');
  const [editDivLoading, setEditDivLoading] = useState(false);

  const loadData = async () => {
    if (!ticker) return;
    try {
      const detailRes = await api.get(`/dashboard/stock/${ticker}`);
      setDetail(detailRes.data);
    } catch (error) {
      console.error('Error loading stock detail:', error);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    if (!ticker) return;
    let isMounted = true;
    api.get(`/dashboard/stock/${ticker}`)
      .then((detailRes) => {
        if (isMounted) {
          setDetail(detailRes.data);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (isMounted) {
          console.error('Error loading stock detail:', error);
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, [ticker]);

  useEffect(() => {
    if (!ticker) return;
    let isMounted = true;
    api.get(`/dashboard/stock/${ticker}/evolution?range=${evolutionRange}`)
      .then((res) => {
        if (isMounted) {
          setEvolutionSeries(res.data.series || []);
        }
      })
      .catch((error) => {
        if (isMounted) {
          console.error('Error loading evolution series:', error);
          setEvolutionSeries([]);
        }
      });
    return () => { isMounted = false; };
  }, [ticker, evolutionRange]);

  useEffect(() => {
    if (ticker) document.title = ticker.toUpperCase();
  }, [ticker]);

  const handleAddTransaction = async (e: FormEvent) => {
    e.preventDefault();
    setTxFormError('');
    setTxFormLoading(true);

    try {
      await api.post('/transactions', {
        ticker,
        type: txType,
        quantity: Number(txQuantity),
        price: Number(txPrice),
        fees: Number(txFees || 0),
        date: txDate,
        notes: txNotes || undefined,
      });
      setShowTxModal(false);
      setTxQuantity('');
      setTxPrice('');
      setTxFees('');
      setTxNotes('');
      loadData();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao registrar movimentação';
      setTxFormError(message);
    } finally {
      setTxFormLoading(false);
    }
  };

  const handleAddDividend = async (e: FormEvent) => {
    e.preventDefault();
    setDivFormError('');
    setDivFormLoading(true);

    try {
      await api.post('/dividends/manual', {
        ticker,
        amount: Number(divAmount),
        comDate: divComDate || divPaymentDate,
        paymentDate: divPaymentDate,
        type: divType,
        notes: divNotes || undefined,
      });
      setShowDivModal(false);
      setDivAmount('');
      setDivComDate('');
      setDivNotes('');
      loadData();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao registrar dividendo';
      setDivFormError(message);
    } finally {
      setDivFormLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (isNaN(value) || value === undefined || value === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('T')[0].split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('pt-BR');
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Deseja excluir esta movimentação?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      loadData();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao excluir';
      alert(message);
    }
  };

  const handleDeleteDividend = async (div: { source: string; id?: string }) => {
    if (!div.id) return;
    if (!confirm('Deseja excluir este dividendo?')) return;
    try {
      if (div.source === 'auto') {
        await api.delete(`/dividends/stock-dividends/${div.id}`);
      } else {
        await api.delete(`/dividends/manual/${div.id}`);
      }
      loadData();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao excluir';
      alert(message);
    }
  };

  const openEditTransaction = (tx: Transaction) => {
    setEditTx(tx);
    setEditTxType(tx.type);
    setEditTxQuantity(String(tx.quantity));
    setEditTxPrice(String(tx.price));
    setEditTxFees(String(tx.fees || '0'));
    setEditTxDate(tx.date.split('T')[0]);
    setEditTxNotes(tx.notes || '');
  };

  const handleEditTransaction = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTx) return;
    setEditTxLoading(true);
    try {
      await api.put(`/transactions/${editTx.id}`, {
        type: editTxType,
        quantity: Number(editTxQuantity),
        price: Number(editTxPrice),
        fees: Number(editTxFees || 0),
        date: editTxDate,
        notes: editTxNotes || undefined,
      });
      setEditTx(null);
      loadData();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao atualizar';
      alert(message);
    } finally {
      setEditTxLoading(false);
    }
  };

  const openEditDividend = (div: CalculatedDividend) => {
    setEditDiv(div);
    setEditDivAmount(String(div.amountPerShare || div.totalAmount || '0'));
    setEditDivPaymentDate(div.paymentDate.split('T')[0]);
    setEditDivType((div.type as 'DIVIDENDO' | 'JCP' | 'RENDIMENTO') || 'DIVIDENDO');
  };

  const handleEditDividend = async (e: FormEvent) => {
    e.preventDefault();
    if (!editDiv || !editDiv.id) return;
    setEditDivLoading(true);
    try {
      if (editDiv.source === 'auto') {
        await api.put(`/dividends/stock-dividends/${editDiv.id}`, {
          amountPerShare: Number(editDivAmount),
          paymentDate: editDivPaymentDate,
          type: editDivType,
        });
      } else {
        await api.put(`/dividends/manual/${editDiv.id}`, {
          amount: Number(editDivAmount),
          paymentDate: editDivPaymentDate,
          type: editDivType,
        });
      }
      setEditDiv(null);
      loadData();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao atualizar dividendo';
      alert(message);
    } finally {
      setEditDivLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Carregando dados do ativo...</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Ação não encontrada</div>
      </div>
    );
  }

  const currentPrice = detail.position.currentPrice || detail.position.averagePrice;
  const totalValue = detail.position.quantity * currentPrice;
  const pnl = totalValue - detail.position.totalInvested;
  const pnlPercent = detail.position.totalInvested > 0 ? (pnl / detail.position.totalInvested) * 100 : 0;
  const safeTotalDividends = detail.totalDividends ?? detail.position?.totalDividends ?? 0;

  // Realized P/L: profit from sell transactions only
  const realizedPnL = (() => {
    let totalBought = 0;
    let totalQtyBought = 0;
    let realized = 0;

    const sortedTx = [...detail.transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const tx of sortedTx) {
      const qty = Number(tx.quantity);
      const price = Number(tx.price);
      if (tx.type === 'BUY') {
        totalBought += qty * price;
        totalQtyBought += qty;
      } else {
        const avgCost = totalQtyBought > 0 ? totalBought / totalQtyBought : 0;
        realized += qty * (price - avgCost);
        totalBought -= qty * avgCost;
        totalQtyBought -= qty;
      }
    }
    return realized;
  })();

  // Evolution chart data formatting
  const evolutionChartData = evolutionSeries.map((pt) => {
    let formattedDate = pt.date;
    if (evolutionRange === 'day') {
      formattedDate = formatDate(pt.date);
    } else if (evolutionRange === 'month') {
      const [y, m] = pt.date.split('-');
      formattedDate = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    } else if (evolutionRange === 'year') {
      formattedDate = pt.date.split('-')[0];
    }

    return {
      date: formattedDate,
      cotacao: pt.cotacao,
      valorPatrimonial: pt.valorPatrimonial,
      precoMedio: pt.precoMedio,
    };
  });

  // Prepare dividend chart data
  const dividendChartData = detail.dividends.reduce((acc: Array<{ month: string; amount: number }>, div) => {
    const p = div.paymentDate.split('T')[0].split('-');
    const month = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    const existing = acc.find(a => a.month === month);
    if (existing) existing.amount += div.totalAmount;
    else acc.push({ month, amount: div.totalAmount });
    return acc;
  }, []).reverse();

  // Valor recebido por cota em cada ano
  const perShareByYear = Object.entries(detail.dividendPerShareByYear || {})
    .map(([year, perShare]) => ({
      year,
      perShare: isNaN(Number(perShare)) ? 0 : Number(perShare),
      total: Number(detail.dividendsByYear?.[year] || 0),
    }))
    .sort((a, b) => Number(b.year) - Number(a.year));

  const formatPerShare = (value: number) => {
    if (isNaN(value) || value === undefined || value === null) return 'R$ 0,0000';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value);
  };

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      {/* Page title */}
      <div className="flex items-center gap-4 mb-6 sm:mb-8">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{detail.stock.ticker}</h1>
          <p className="text-sm text-muted-foreground">{detail.stock.name} • {detail.stock.market}</p>
        </div>
      </div>

      {/* Position Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-card text-card-foreground rounded-xl p-3 sm:p-5 shadow-xs border border-border">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">Quantidade</div>
          <div className="text-lg sm:text-xl font-bold">{detail.position.quantity.toFixed(0)}</div>
        </div>
        <div className="bg-card text-card-foreground rounded-xl p-3 sm:p-5 shadow-xs border border-border">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">Preço Médio</div>
          <div className="text-lg sm:text-xl font-bold">{formatCurrency(detail.position.averagePrice)}</div>
        </div>
        <div className="bg-card text-card-foreground rounded-xl p-3 sm:p-5 shadow-xs border border-border">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">Patrimônio Total</div>
          <div className="text-lg sm:text-xl font-bold">{formatCurrency(totalValue)}</div>
        </div>
        <div className="bg-card text-card-foreground rounded-xl p-3 sm:p-5 shadow-xs border border-border">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">L/P (posição)</div>
          <div className={`text-lg sm:text-xl font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(pnl)}
          </div>
          <div className={`text-xs ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
          </div>
        </div>
        <div className="bg-card text-card-foreground rounded-xl p-3 sm:p-5 shadow-xs border border-border">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">P/L Realizado</div>
          <div className={`text-lg sm:text-xl font-bold ${realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(realizedPnL)}
          </div>
          <div className="text-xs text-muted-foreground">Baseado em vendas</div>
        </div>
        <div className="bg-card text-card-foreground rounded-xl p-3 sm:p-5 shadow-xs border border-border">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">Dividendos</div>
          <div className="text-lg sm:text-xl font-bold text-green-600">{formatCurrency(safeTotalDividends)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
        {/* Dividends Chart */}
        <div className="bg-card text-card-foreground rounded-xl shadow-xs border border-border p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4">Dividendos Recebidos</h3>
          {dividendChartData.length > 0 ? (
            <div className="h-64 sm:h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dividendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`, color: theme === 'dark' ? '#f1f5f9' : '#0a0a0a' }}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Bar dataKey="amount" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 sm:h-[250px] flex items-center justify-center text-muted-foreground">
              Sem dividendos registrados
            </div>
          )}

          {/* Valor recebido por cota em cada ano */}
          {perShareByYear.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="text-sm font-semibold text-foreground mb-3">Recebido por cota (por ano)</h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs font-medium text-muted-foreground">Ano</th>
                      <th className="text-right py-2 text-xs font-medium text-muted-foreground">Por cota</th>
                      <th className="text-right py-2 text-xs font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perShareByYear.map((row) => (
                      <tr key={row.year} className="border-b border-border/50 text-xs">
                        <td className="py-2 text-foreground font-medium">{row.year}</td>
                        <td className="py-2 text-right text-foreground">{formatPerShare(row.perShare)}</td>
                        <td className="py-2 text-right text-green-600 font-medium">{formatCurrency(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Investment Evolution Chart */}
        <div className="bg-card text-card-foreground rounded-xl shadow-xs border border-border p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">Evolução do Investimento</h3>
            <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
              {(['day', 'month', 'year'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setEvolutionRange(r)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition whitespace-nowrap shrink-0 cursor-pointer ${
                    evolutionRange === r ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r === 'day' ? 'Dia (30d)' : r === 'month' ? 'Mês (12m)' : 'Ano'}
                </button>
              ))}
            </div>
          </div>
          {evolutionChartData.length > 0 ? (
            <div className="h-64 sm:h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`, color: theme === 'dark' ? '#f1f5f9' : '#0a0a0a' }}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="left" type="monotone" dataKey="valorPatrimonial" name="Valor Patrimonial (R$)" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="cotacao" name="Cotação Histórica (R$)" stroke="#059669" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="precoMedio" name="Preço Médio (R$)" stroke="#d97706" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 sm:h-[250px] flex items-center justify-center text-muted-foreground">
              Sem dados de cotação para o período
            </div>
          )}
        </div>
      </div>

      {/* Transactions History Card (Collapsible) */}
      <div className="bg-card text-card-foreground rounded-xl shadow-xs border border-border mb-6 sm:mb-8">
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMovementsOpen(!isMovementsOpen)}
              className="text-muted-foreground hover:text-foreground transition cursor-pointer p-1"
              title={isMovementsOpen ? 'Minimizar' : 'Expandir'}
            >
              {isMovementsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            <h3 className="text-lg font-semibold">Histórico de Movimentações</h3>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
              {detail.transactions.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTxSortDir(txSortDir === 'desc' ? 'asc' : 'desc')}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition cursor-pointer px-2 py-1.5 rounded-lg border border-border"
            >
              Data {txSortDir === 'desc' ? '↓' : '↑'}
            </button>
            <button
              onClick={() => setShowTxModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 transition cursor-pointer"
            >
              <Plus size={16} />
              <span>Nova Movimentação</span>
            </button>
          </div>
        </div>

        {isMovementsOpen && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Data</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Tipo</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Qtd</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Preço</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Taxas</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Total</th>
                  <th className="text-center px-3 py-3 text-sm font-medium text-muted-foreground w-10"></th>
                </tr>
              </thead>
              <tbody>
                {[...detail.transactions]
                  .sort((a, b) => {
                    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
                    return txSortDir === 'asc' ? diff : -diff;
                  })
                  .map((tx) => (
                  <tr key={tx.id} className="border-b border-border hover:bg-muted/50 transition">
                    <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${tx.type === 'BUY' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
                        {tx.type === 'BUY' ? 'COMPRA' : 'VENDA'}
                      </span>
                    </td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{Number(tx.quantity).toFixed(0)}</td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatCurrency(Number(tx.price))}</td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatCurrency(Number(tx.fees))}</td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm font-medium whitespace-nowrap">
                      {formatCurrency(Number(tx.quantity) * Number(tx.price))}
                    </td>
                    <td className="text-center px-3 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditTransaction(tx)}
                          className="text-muted-foreground hover:text-blue-600 transition cursor-pointer p-2"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="text-muted-foreground hover:text-red-600 transition cursor-pointer p-2"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dividends Table Card (Collapsible) */}
      <div className="bg-card text-card-foreground rounded-xl shadow-xs border border-border mb-6 sm:mb-8">
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDividendsOpen(!isDividendsOpen)}
              className="text-muted-foreground hover:text-foreground transition cursor-pointer p-1"
              title={isDividendsOpen ? 'Minimizar' : 'Expandir'}
            >
              {isDividendsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            <h3 className="text-lg font-semibold">Dividendos Recebidos</h3>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
              {detail.dividends.length}
            </span>
          </div>

          <button
            onClick={() => setShowDivModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:opacity-90 transition cursor-pointer"
          >
            <Plus size={16} />
            <span>Novo Dividendo</span>
          </button>
        </div>

        {isDividendsOpen && detail.dividends.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Data Pgto</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Fonte</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Cotas</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Valor/Cota</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Total</th>
                  <th className="text-center px-3 py-3 text-sm font-medium text-muted-foreground w-10"></th>
                </tr>
              </thead>
              <tbody>
                {detail.dividends.map((div, index) => (
                  <tr key={div.id ?? index} className="border-b border-border hover:bg-muted/50 transition">
                    <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatDate(div.paymentDate)}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {div.type}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${div.source === 'auto' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
                        {div.source === 'auto' ? 'Automático' : 'Manual'}
                      </span>
                    </td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{div.sharesHeld}</td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatCurrency(div.amountPerShare)}</td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm font-medium text-green-600 whitespace-nowrap">
                      {formatCurrency(div.totalAmount)}
                    </td>
                    <td className="text-center px-3 py-4">
                      {(div.source === 'manual' || user?.role === 'ADMIN') && div.id && (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditDividend(div)}
                            className="text-muted-foreground hover:text-blue-600 transition cursor-pointer p-2"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteDividend(div)}
                            className="text-muted-foreground hover:text-red-600 transition cursor-pointer p-2"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {isDividendsOpen && detail.dividends.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhum dividendo registrado para {detail.stock.ticker}
          </div>
        )}
      </div>

      {/* Modal Pop-up: Adicionar Movimentação */}
      {showTxModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-border">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <h3 className="text-lg font-semibold">Nova Movimentação em {detail.stock.ticker}</h3>
              <button onClick={() => setShowTxModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={20} />
              </button>
            </div>
            {txFormError && (
              <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-300 px-4 py-3 rounded-lg text-sm mb-4">
                {txFormError}
              </div>
            )}
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as 'BUY' | 'SELL')}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                  >
                    <option value="BUY">Compra</option>
                    <option value="SELL">Venda</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Data</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Qtd</label>
                  <input
                    type="number"
                    value={txQuantity}
                    onChange={(e) => setTxQuantity(e.target.value)}
                    required min="0" step="1"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Preço (R$)</label>
                  <input
                    type="number"
                    value={txPrice}
                    onChange={(e) => setTxPrice(e.target.value)}
                    required min="0" step="0.01"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Taxas (R$)</label>
                  <input
                    type="number"
                    value={txFees}
                    onChange={(e) => setTxFees(e.target.value)}
                    min="0" step="0.01" placeholder="0.00"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Observações (opcional)</label>
                <input
                  type="text"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="Ex: Compra corretora X"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={txFormLoading}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                >
                  {txFormLoading ? 'Salvando...' : 'Salvar Movimentação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pop-up: Adicionar Dividendo */}
      {showDivModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-border">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <h3 className="text-lg font-semibold">Novo Dividendo em {detail.stock.ticker}</h3>
              <button onClick={() => setShowDivModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={20} />
              </button>
            </div>
            {divFormError && (
              <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-950 dark:border-red-900 dark:text-red-300 px-4 py-3 rounded-lg text-sm mb-4">
                {divFormError}
              </div>
            )}
            <form onSubmit={handleAddDividend} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <select
                    value={divType}
                    onChange={(e) => setDivType(e.target.value as 'DIVIDENDO' | 'JCP' | 'RENDIMENTO')}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                  >
                    <option value="DIVIDENDO">Dividendo</option>
                    <option value="JCP">JCP</option>
                    <option value="RENDIMENTO">Rendimento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Valor Total (R$)</label>
                  <input
                    type="number"
                    value={divAmount}
                    onChange={(e) => setDivAmount(e.target.value)}
                    required min="0" step="0.01" placeholder="0.00"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Data COM (opcional)</label>
                  <input
                    type="date"
                    value={divComDate}
                    onChange={(e) => setDivComDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Data Pagamento</label>
                  <input
                    type="date"
                    value={divPaymentDate}
                    onChange={(e) => setDivPaymentDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Observações (opcional)</label>
                <input
                  type="text"
                  value={divNotes}
                  onChange={(e) => setDivNotes(e.target.value)}
                  placeholder="Ex: Provento complementar"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDivModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={divFormLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                >
                  {divFormLoading ? 'Salvando...' : 'Salvar Dividendo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editTx && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-border">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <h3 className="text-lg font-semibold">Editar Movimentação</h3>
              <button onClick={() => setEditTx(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditTransaction} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <select
                    value={editTxType}
                    onChange={(e) => setEditTxType(e.target.value as 'BUY' | 'SELL')}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                  >
                    <option value="BUY">Compra</option>
                    <option value="SELL">Venda</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Data</label>
                  <input
                    type="date"
                    value={editTxDate}
                    onChange={(e) => setEditTxDate(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Quantidade</label>
                  <input
                    type="number"
                    value={editTxQuantity}
                    onChange={(e) => setEditTxQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                    required min="0" step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Preço (R$)</label>
                  <input
                    type="number"
                    value={editTxPrice}
                    onChange={(e) => setEditTxPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                    required min="0" step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Taxas (R$)</label>
                  <input
                    type="number"
                    value={editTxFees}
                    onChange={(e) => setEditTxFees(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                    min="0" step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Observações (opcional)</label>
                <input
                  type="text"
                  value={editTxNotes}
                  onChange={(e) => setEditTxNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTx(null)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editTxLoading}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                >
                  {editTxLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Dividend Modal */}
      {editDiv && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-border">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <h3 className="text-lg font-semibold">Editar Dividendo ({editDiv.ticker})</h3>
              <button onClick={() => setEditDiv(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditDividend} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <select
                    value={editDivType}
                    onChange={(e) => setEditDivType(e.target.value as 'DIVIDENDO' | 'JCP' | 'RENDIMENTO')}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                  >
                    <option value="DIVIDENDO">Dividendo</option>
                    <option value="JCP">JCP</option>
                    <option value="RENDIMENTO">Rendimento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {editDiv.source === 'auto' ? 'Valor por Cota (R$)' : 'Valor Total (R$)'}
                  </label>
                  <input
                    type="number"
                    value={editDivAmount}
                    onChange={(e) => setEditDivAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                    required min="0" step="0.0001"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data Pagamento</label>
                <input
                  type="date"
                  value={editDivPaymentDate}
                  onChange={(e) => setEditDivPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditDiv(null)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editDivLoading}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                >
                  {editDivLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
