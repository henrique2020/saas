import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowUpDown, Share2, Trash2, Link as LinkIcon, Landmark, Layers, PieChart as PieIcon, ChevronDown } from 'lucide-react';
import api from '../services/api';
import type { DashboardSummary, ProfileShare, FixedIncome } from '../types';
import { useTheme } from '../context/ThemeContext';

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e5', '#be185d'];
/** Cores fixas para a divisão entre classes, para leitura consistente. */
const CLASS_COLORS: Record<string, string> = {
  'Renda Variável': '#2563eb',
  'Renda Fixa': '#059669',
};

const FIXED_INCOME_TYPE_LABELS: Record<string, string> = {
  CDB: 'CDB',
  LCI: 'LCI',
  LCA: 'LCA',
  LC: 'LC',
  TESOURO: 'Tesouro Direto',
  DEBENTURE: 'Debênture',
  CRI: 'CRI',
  CRA: 'CRA',
  OUTRO: 'Outros',
};

const YIELD_TYPE_LABELS: Record<string, string> = {
  PRE: 'Prefixado',
  CDI: '% do CDI',
  SELIC: 'Selic +',
  IPCA: 'IPCA +',
};

type SortField = 'ticker' | 'pt' | 'pnl';
type SortDir = 'asc' | 'desc';
type DividendGroupMode = 'day' | 'month' | 'year';

interface GroupedDividend {
  label: string;
  received: number;
  pending: number;
  total?: number;
}

/** Chave usada para lembrar quais blocos da home estão expandidos. */
const SECTIONS_KEY = 'dashboard:sections';

/**
 * Reduz o corpo do número quando ele é muito longo, para o valor não quebrar
 * no meio dentro do cartão (ex.: "R$ 1.234.567.890,12").
 */
function valueSizeClass(text: string) {
  if (text.length > 20) return 'text-sm sm:text-base';
  if (text.length > 17) return 'text-base sm:text-lg';
  return 'text-lg sm:text-2xl';
}

function loadSectionsState(): { rv: boolean; rf: boolean } {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { rv: parsed.rv !== false, rf: parsed.rf !== false };
    }
  } catch {
    // storage indisponível — usa o padrão expandido
  }
  return { rv: true, rf: true };
}

export default function Dashboard() {
  const { theme } = useTheme();
  const location = useLocation();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [fixedIncomeItems, setFixedIncomeItems] = useState<FixedIncome[]>([]);
  const [groupedDividends, setGroupedDividends] = useState<GroupedDividend[]>([]);
  const [dividendMode, setDividendMode] = useState<DividendGroupMode>('month');
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('ticker');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [incomingShares, setIncomingShares] = useState<ProfileShare[]>([]);
  const [outgoingShares, setOutgoingShares] = useState<ProfileShare[]>([]);
  const [targetEmail, setTargetEmail] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');
  const [shareSuccess, setShareSuccess] = useState('');
  const [sections, setSections] = useState(loadSectionsState);

  const toggleSection = (key: 'rv' | 'rf') => setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const openSection = (key: 'rv' | 'rf') => setSections((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

  useEffect(() => {
    localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
  }, [sections]);

  useEffect(() => {
    document.title = 'Home';
    loadData();
  }, []);

  useEffect(() => {
    loadGroupedDividends();
  }, [dividendMode]);

  // Navegação por âncora (#renda-variavel / #renda-fixa) vinda do menu lateral.
  useEffect(() => {
    if (loading || !location.hash) return;
    const id = location.hash.slice(1);
    if (id === 'renda-variavel') openSection('rv');
    if (id === 'renda-fixa') openSection('rf');
    // aguarda o bloco expandir antes de rolar até ele
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [loading, location.hash, location.key]);

  const loadGroupedDividends = async () => {
    try {
      const res = await api.get(`/dashboard/dividends-grouped?mode=${dividendMode}`);
      setGroupedDividends(res.data);
    } catch (error) {
      console.error('Error loading grouped dividends:', error);
    }
  };

  const loadData = async () => {
    try {
      const [summaryRes, dividendsRes, incomingRes, outgoingRes, fixedIncomeRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get(`/dashboard/dividends-grouped?mode=${dividendMode}`),
        api.get('/shares/incoming'),
        api.get('/shares/outgoing'),
        api.get('/fixed-income'),
      ]);

      setSummary(summaryRes.data);
      setGroupedDividends(dividendsRes.data);
      setIncomingShares(incomingRes.data);
      setOutgoingShares(outgoingRes.data);
      setFixedIncomeItems(fixedIncomeRes.data.items || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'ticker' ? 'asc' : 'desc');
    }
  };

  const getPositionPT = (pos: { quantity: number; averagePrice: number; currentPrice?: number }) => {
    return pos.quantity * (pos.currentPrice || pos.averagePrice);
  };

  const getPositionPnL = (pos: { quantity: number; averagePrice: number; totalInvested: number; currentPrice?: number }) => {
    const currentPrice = pos.currentPrice || pos.averagePrice;
    return currentPrice * pos.quantity - pos.totalInvested;
  };

  const sortedPositions = [...(summary?.positions || [])].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'ticker':
        cmp = a.ticker.localeCompare(b.ticker);
        break;
      case 'pt':
        cmp = getPositionPT(a) - getPositionPT(b);
        break;
      case 'pnl':
        cmp = getPositionPnL(a) - getPositionPnL(b);
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('T')[0].split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('pt-BR');
  };

  const createShare = async () => {
    if (!targetEmail.trim()) return;
    setShareError('');
    setShareSuccess('');
    setShareLoading(true);
    try {
      const { data } = await api.post('/shares/outgoing', { targetEmail });
      setTargetEmail('');
      setShareSuccess(`Link gerado: ${data.confirmLink}`);
      await loadData();
    } catch (err: any) {
      setShareError(err.response?.data?.error || 'Erro ao compartilhar perfil');
    } finally {
      setShareLoading(false);
    }
  };

  const removeShare = async (id: string) => {
    try {
      await api.delete(`/shares/${id}`);
      await loadData();
    } catch (err: any) {
      setShareError(err.response?.data?.error || 'Erro ao remover compartilhamento');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const totalValue = (summary?.total?.currentValue) ?? 0;

  // Renda variável e renda fixa são calculadas de forma independente: os
  // lucros/perdas de uma classe nunca entram no resultado da outra.
  const rv = summary?.variableIncome;
  const fi = summary?.fixedIncome;

  const rvInvested = rv?.invested ?? 0;
  const rvValue = rv?.currentValue ?? 0;
  const rvPnL = rv?.unrealizedProfit ?? 0;
  const rvPnLPercent = rvInvested > 0 ? (rvPnL / rvInvested) * 100 : 0;

  const fiInvested = fi?.invested ?? 0;
  const fiValue = fi?.currentValue ?? 0;
  const fiPnL = fi?.unrealizedProfit ?? 0;
  const fiPnLPercent = fiInvested > 0 ? (fiPnL / fiInvested) * 100 : 0;

  // Composição de renda variável por categoria (Ações, FIIs, ETFs, BDRs)
  const categoryLabels: Record<string, string> = {
    ACAO: 'Ações',
    FII: 'FIIs',
    ETF: 'ETFs',
    BDR: 'BDRs',
  };
  const compositionData = (rv?.byCategory || [])
    .filter((c) => c.currentValue > 0)
    .map((c) => ({ name: categoryLabels[c.category] || c.category || 'Outros', value: c.currentValue }));

  // Composição de renda fixa por tipo de investimento (CDB, LCI, Tesouro...)
  const fixedIncomeComposition = (fi?.byType || [])
    .filter((t) => t.currentValue > 0)
    .map((t) => ({ name: FIXED_INCOME_TYPE_LABELS[t.type] || t.type, value: t.currentValue }));

  // Divisão do patrimônio entre as duas classes
  const classComposition = [
    { name: 'Renda Variável', value: rvValue },
    { name: 'Renda Fixa', value: fiValue },
  ].filter((c) => c.value > 0);

  const activeFixedIncome = fixedIncomeItems.filter((i) => !i.projection.settled);

  const chartTooltipStyle = {
    backgroundColor: theme === 'dark' ? '#1e293b' : '#fff',
    border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
    color: theme === 'dark' ? '#f1f5f9' : '#0a0a0a',
  };

  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if ((percent ?? 0) < 0.06) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        fontSize={12}
        fontWeight={600}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const renderTotalLabel = (props: any) => {
    const { x, y, width, payload, index } = props;
    const item = payload || (index != null ? groupedDividends[index] : null);
    if (!item) return null;

    const total = Number(item.total) || (Number(item.received || 0) + Number(item.pending || 0));
    if (total <= 0) return null;

    const labelX = (width && width > 0) ? (x || 0) + width / 2 : (x || 0);
    const labelY = Math.max(12, (y || 0) - 6);

    return (
      <text
        x={labelX}
        y={labelY}
        fill={theme === 'dark' ? '#cbd5e1' : '#475569'}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
      >
        {formatCurrency(total)}
      </text>
    );
  };

  const renderPie = (data: Array<{ name: string; value: number }>, fixedColors?: Record<string, string>) => (
    <div className="h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            labelLine={false}
            label={renderPieLabel}
            outerRadius="80%"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={fixedColors?.[entry.name] || COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            height={36}
            iconSize={10}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-6">
        <section className="min-w-0">
          {/* Consolidado — patrimônio das duas classes somado (apenas valor, nunca L/P) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border min-w-0">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign size={16} /> Patrimônio Total
              </div>
              <div className={`${valueSizeClass(formatCurrency(totalValue))} font-bold text-foreground break-words leading-tight`}>{formatCurrency(totalValue)}</div>
            </div>

            <a
              href="#renda-variavel"
              onClick={() => openSection('rv')}
              className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border hover:border-primary transition block min-w-0"
            >
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <BarChart3 size={16} /> Renda Variável
              </div>
              <div className={`${valueSizeClass(formatCurrency(rvValue))} font-bold text-foreground break-words leading-tight`}>{formatCurrency(rvValue)}</div>
              <div className={`text-sm break-words ${rvPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(rvPnL)} ({formatPercent(rvPnLPercent)})
              </div>
            </a>

            <a
              href="#renda-fixa"
              onClick={() => openSection('rf')}
              className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border hover:border-primary transition block min-w-0"
            >
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Landmark size={16} /> Renda Fixa
              </div>
              <div className={`${valueSizeClass(formatCurrency(fiValue))} font-bold text-foreground break-words leading-tight`}>{formatCurrency(fiValue)}</div>
              <div className={`text-sm break-words ${fiPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(fiPnL)} ({formatPercent(fiPnLPercent)})
              </div>
            </a>
          </div>

          {/* ---------------- RENDA VARIÁVEL ---------------- */}
          <div id="renda-variavel" className="scroll-mt-24 mb-10">
            <button
              type="button"
              onClick={() => toggleSection('rv')}
              aria-expanded={sections.rv}
              aria-controls="renda-variavel-conteudo"
              className="w-full flex items-center gap-2 mb-4 text-left"
            >
              <BarChart3 size={20} className="text-primary shrink-0" />
              <h2 className="text-lg font-bold text-foreground">Renda Variável</h2>
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                <span className="hidden sm:inline">{sections.rv ? 'recolher' : 'expandir'}</span>
                <ChevronDown
                  size={18}
                  className={`transition-transform ${sections.rv ? '' : '-rotate-90'}`}
                />
              </span>
            </button>

            {sections.rv && (
            <div id="renda-variavel-conteudo">
            <div className="grid grid-cols-1 min-[430px]:grid-cols-2 2xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border min-w-0">
                <div className="text-sm text-muted-foreground mb-1">Investido</div>
                <div className={`${valueSizeClass(formatCurrency(rvInvested))} font-bold text-foreground break-words leading-tight`}>{formatCurrency(rvInvested)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border min-w-0">
                <div className="text-sm text-muted-foreground mb-1">Valor de mercado</div>
                <div className={`${valueSizeClass(formatCurrency(rvValue))} font-bold text-foreground break-words leading-tight`}>{formatCurrency(rvValue)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border min-w-0">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  {rvPnL >= 0 ? <TrendingUp size={16} className="text-green-500" /> : <TrendingDown size={16} className="text-red-500" />}
                  Lucro/Perda RV
                </div>
                <div className={`${valueSizeClass(formatCurrency(rvPnL))} font-bold break-words leading-tight ${rvPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(rvPnL)}
                </div>
                <div className={`text-sm break-words ${rvPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(rvPnLPercent)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border min-w-0">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <DollarSign size={16} /> Dividendos
                </div>
                <div className={`${valueSizeClass(formatCurrency(summary?.totalDividends || 0))} font-bold text-foreground break-words leading-tight`}>{formatCurrency(summary?.totalDividends || 0)}</div>
                <div className="text-sm text-muted-foreground">{summary?.totalStocks || 0} ativo(s)</div>
              </div>
            </div>

            {/* Positions Table */}
            <div className="bg-white rounded-xl shadow-sm border border-border">
              <div className="p-4 sm:p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Posições</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort('ticker')}>
                        <span className="inline-flex items-center gap-1">Ticker {sortField === 'ticker' && <ArrowUpDown size={12} />}</span>
                      </th>
                      <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Qtd</th>
                      <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">PM</th>
                      <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Cotação</th>
                      <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort('pt')}>
                        <span className="inline-flex items-center gap-1 justify-end">PT {sortField === 'pt' && <ArrowUpDown size={12} />}</span>
                      </th>
                      <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Variação</th>
                      <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort('pnl')}>
                        <span className="inline-flex items-center gap-1 justify-end">L/P {sortField === 'pnl' && <ArrowUpDown size={12} />}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPositions.map((pos) => {
                      const currentPrice = pos.currentPrice || pos.averagePrice;
                      const pt = pos.quantity * currentPrice;
                      const pnl = currentPrice * pos.quantity - pos.totalInvested;
                      const pnlPct = pos.totalInvested > 0 ? (pnl / pos.totalInvested) * 100 : 0;

                      return (
                        <tr key={pos.ticker} className="border-b border-border hover:bg-muted transition">
                          <td className="px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Link to={`/stock/${pos.ticker}`} className="font-medium text-primary hover:underline">
                                {pos.ticker}
                              </Link>
                              {pos.category && pos.category !== 'ACAO' && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  pos.category === 'FII' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                                  pos.category === 'ETF' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' :
                                  'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                                }`}>
                                  {pos.category}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{pos.name}</div>
                          </td>
                          <td className="text-right px-4 sm:px-6 py-4 text-sm">{pos.quantity.toFixed(0)}</td>
                          <td className="text-right px-4 sm:px-6 py-4 text-sm">{formatCurrency(pos.averagePrice)}</td>
                          <td className="text-right px-4 sm:px-6 py-4 text-sm">{formatCurrency(currentPrice)}</td>
                          <td className="text-right px-4 sm:px-6 py-4 text-sm font-medium">{formatCurrency(pt)}</td>
                          <td className="text-right px-4 sm:px-6 py-4 text-sm">
                            <span className={(pos.changePercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatPercent(pos.changePercent || 0)}
                            </span>
                          </td>
                          <td className="text-right px-4 sm:px-6 py-4">
                            <div className={`text-sm font-medium ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(pnl)}</div>
                            <div className={`text-xs ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(pnlPct)}</div>
                          </td>
                        </tr>
                      );
                    })}
                    {sortedPositions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 sm:px-6 py-8 text-center text-muted-foreground">
                          Nenhuma posição encontrada. Registre sua primeira movimentação!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dividendos (renda variável) */}
            <div className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-foreground">Dividendos</h3>
                <div className="flex gap-1 bg-muted rounded-lg p-1 self-start sm:self-auto">
                  {(['day', 'month', 'year'] as DividendGroupMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setDividendMode(mode)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap ${
                        dividendMode === mode
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {mode === 'day' ? 'Dia' : mode === 'month' ? 'Mês' : 'Ano'}
                    </button>
                  ))}
                </div>
              </div>
              {groupedDividends.length > 0 && groupedDividends.some(d => d.received > 0 || d.pending > 0) ? (
                <div className="h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={groupedDividends} margin={{ top: 24, right: 12, left: 12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                    <YAxis
                      width={52}
                      tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                      domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.18)]}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      labelStyle={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                      formatter={(value: any, name: any) => {
                        if (name === 'total') return [null, null];
                        return [
                          formatCurrency(Number(value)),
                          name === 'received' ? 'Recebido' : 'A receber',
                        ];
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      formatter={(value) => (value === 'received' ? 'Recebido' : value === 'pending' ? 'A receber' : null)}
                    />
                    <Bar dataKey="received" fill="#2563eb" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="pending" fill="#93c5fd" radius={[4, 4, 0, 0]} stackId="a" />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="none"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    >
                      <LabelList content={renderTotalLabel} />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 sm:h-64 flex items-center justify-center text-muted-foreground">Sem dados de dividendos</div>
              )}
            </div>
            </div>
            )}
          </div>

          {/* ---------------- RENDA FIXA ---------------- */}
          <div id="renda-fixa" className="scroll-mt-24 mb-10">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => toggleSection('rf')}
                aria-expanded={sections.rf}
                aria-controls="renda-fixa-conteudo"
                className="flex items-center gap-2 text-left hover:opacity-80 transition cursor-pointer"
              >
                <Landmark size={20} className="text-primary shrink-0" />
                <h2 className="text-lg font-bold text-foreground">Renda Fixa</h2>
              </button>

              <div className="flex items-center gap-3 shrink-0">
                <Link to="/renda-fixa" className="text-xs sm:text-sm text-primary hover:underline font-medium">
                  gerenciar
                </Link>
                <button
                  type="button"
                  onClick={() => toggleSection('rf')}
                  aria-expanded={sections.rf}
                  aria-controls="renda-fixa-conteudo"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  <span className="hidden sm:inline">{sections.rf ? 'recolher' : 'expandir'}</span>
                  <ChevronDown
                    size={18}
                    className={`transition-transform ${sections.rf ? '' : '-rotate-90'}`}
                  />
                </button>
              </div>
            </div>

            {sections.rf && (
            <div id="renda-fixa-conteudo">
            <div className="grid grid-cols-1 min-[430px]:grid-cols-2 2xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border min-w-0">
                <div className="text-sm text-muted-foreground mb-1">Investido</div>
                <div className={`${valueSizeClass(formatCurrency(fiInvested))} font-bold text-foreground break-words leading-tight`}>{formatCurrency(fiInvested)}</div>
                <div className="text-sm text-muted-foreground">{fi?.activeCount || 0} ativo(s)</div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border min-w-0">
                <div className="text-sm text-muted-foreground mb-1">Valor líquido hoje</div>
                <div className={`${valueSizeClass(formatCurrency(fiValue))} font-bold text-foreground break-words leading-tight`}>{formatCurrency(fiValue)}</div>
                <div className="text-sm text-muted-foreground break-words">
                  bruto {formatCurrency(fi?.currentGrossValue || 0)} · IR {formatCurrency(fi?.currentTax || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border min-w-0">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  {fiPnL >= 0 ? <TrendingUp size={16} className="text-green-500" /> : <TrendingDown size={16} className="text-red-500" />}
                  Lucro/Perda RF
                </div>
                <div className={`${valueSizeClass(formatCurrency(fiPnL))} font-bold break-words leading-tight ${fiPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(fiPnL)}
                </div>
                <div className={`text-sm break-words ${fiPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(fiPnLPercent)}
                </div>
                <div className="text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-border/50">
                  Encerrados: <span className={(fi?.realizedProfit || 0) >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{formatCurrency(fi?.realizedProfit || 0)}</span>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border min-w-0">
                <div className="text-sm text-muted-foreground mb-1">Previsto no vencimento</div>
                <div className={`${valueSizeClass(formatCurrency(fi?.projectedNetValue || 0))} font-bold text-foreground break-words leading-tight`}>{formatCurrency(fi?.projectedNetValue || 0)}</div>
                <div className={`text-sm break-words ${(fi?.projectedProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(fi?.projectedProfit || 0)} de rendimento
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-border">
              <div className="p-4 sm:p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Investimentos ativos</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground min-w-[180px]">Investimento</th>
                      <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Rendimento</th>
                      <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Investido</th>
                      <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Líquido hoje</th>
                      <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">L/P</th>
                      <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Vencimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeFixedIncome.map((item) => {
                      const profit = item.projection.currentNetProfit;
                      const profitPct =
                        item.projection.investedAmount > 0
                          ? (profit / item.projection.investedAmount) * 100
                          : 0;
                      return (
                        <tr key={item.id} className="border-b border-border hover:bg-muted transition">
                          <td className="px-4 sm:px-6 py-4">
                            <div className="font-medium text-foreground">{item.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {FIXED_INCOME_TYPE_LABELS[item.investmentType] || item.investmentType}
                              {item.taxExempt && ' · isento de IR'}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm">
                            {YIELD_TYPE_LABELS[item.yieldType] || item.yieldType} {item.rate}
                            {item.yieldType === 'CDI' ? '%' : '% a.a.'}
                          </td>
                          <td className="text-right px-4 sm:px-6 py-4 text-sm">{formatCurrency(item.projection.investedAmount)}</td>
                          <td className="text-right px-4 sm:px-6 py-4 text-sm font-medium">
                            {formatCurrency(item.projection.currentNetValue)}
                          </td>
                          <td className="text-right px-4 sm:px-6 py-4">
                            <div className={`text-sm font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(profit)}
                            </div>
                            <div className={`text-xs ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatPercent(profitPct)}
                            </div>
                          </td>
                          <td className="text-right px-4 sm:px-6 py-4 text-sm text-muted-foreground">
                            {formatDate(item.maturityDate)}
                          </td>
                        </tr>
                      );
                    })}
                    {activeFixedIncome.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 sm:px-6 py-8 text-center text-muted-foreground">
                          Nenhum investimento de renda fixa ativo.{' '}
                          <Link to="/nova-movimentacao" className="text-primary hover:underline">
                            Cadastre o primeiro
                          </Link>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
            )}
          </div>

          {/* ---------------- COMPOSIÇÃO ---------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                <PieIcon size={18} /> Renda Variável por tipo
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Valor de mercado por categoria</p>
              {compositionData.length > 0 ? (
                renderPie(compositionData)
              ) : (
                <div className="h-64 sm:h-72 flex items-center justify-center text-muted-foreground">Sem dados</div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                <Landmark size={18} /> Renda Fixa por tipo
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Valor líquido atual por tipo de papel</p>
              {fixedIncomeComposition.length > 0 ? (
                renderPie(fixedIncomeComposition)
              ) : (
                <div className="h-64 sm:h-72 flex items-center justify-center text-muted-foreground">Sem dados</div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                <Layers size={18} /> Total RF × RV
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Divisão do patrimônio entre as classes</p>
              {classComposition.length > 0 ? (
                renderPie(classComposition, CLASS_COLORS)
              ) : (
                <div className="h-64 sm:h-72 flex items-center justify-center text-muted-foreground">Sem dados</div>
              )}
            </div>
          </div>
        </section>

          <aside className="space-y-4 min-w-0">
            <div className="bg-white rounded-xl shadow-sm border border-border p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Share2 size={16} /> Compartilhar perfil</h3>
              <div className="space-y-2">
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="email do usuário destino"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={createShare}
                  disabled={shareLoading || !targetEmail.trim()}
                  className="w-full bg-primary text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {shareLoading ? 'Gerando...' : 'Gerar link + código'}
                </button>
                {shareError && <div className="text-xs text-red-600">{shareError}</div>}
                {shareSuccess && <div className="text-xs text-green-600 break-all">{shareSuccess}</div>}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-border p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><LinkIcon size={16} /> Acessos recebidos</h3>
              <div className="space-y-2 max-h-72 overflow-auto">
                {incomingShares.length === 0 && (
                  <div className="text-xs text-muted-foreground">Nenhum compartilhamento recebido.</div>
                )}
                {incomingShares.map((share) => (
                  <div key={share.id} className="border border-border rounded-lg p-2 text-xs">
                    <div className="font-medium">{share.ownerUser?.name}</div>
                    <div className="text-muted-foreground mb-2">{share.ownerUser?.email}</div>
                    <div className="flex items-center justify-between">
                      <span className={share.status === 'AUTHORIZED' ? 'text-green-700' : 'text-amber-700'}>
                        [{share.status === 'AUTHORIZED' ? 'AUTORIZADO' : 'PENDENTE'}]
                      </span>
                      {share.status === 'AUTHORIZED' ? (
                        <Link to={`/shared/${share.id}`} className="text-primary hover:underline">abrir</Link>
                      ) : (
                        <Link to={`/share/confirm?token=${share.token}`} className="text-primary hover:underline">confirmar</Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-border p-4">
              <h3 className="text-sm font-semibold mb-3">Meus compartilhamentos</h3>
              <div className="space-y-2 max-h-96 overflow-auto">
                {outgoingShares.length === 0 && (
                  <div className="text-xs text-muted-foreground">Nenhum compartilhamento criado.</div>
                )}
                {outgoingShares.map((share) => (
                  <div key={share.id} className="border border-border rounded-lg p-2 text-xs">
                    <div className="font-medium">Usuário {share.targetUser?.name || share.targetUser?.email}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={share.status === 'AUTHORIZED' ? 'text-green-700' : 'text-amber-700'}>
                        [{share.status === 'AUTHORIZED' ? 'AUTORIZADO' : 'PENDENTE'}]
                      </span>
                      <button onClick={() => removeShare(share.id)} className="p-2 -m-1 text-red-600 hover:text-red-700">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {share.status === 'AUTHORIZED' ? `[${formatDate(share.authorizedAt)}]` : `[Código ${share.confirmationCode}]`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    );
  }
