import { useState, useEffect, useRef, Fragment } from 'react';
import type { FormEvent } from 'react';
import { Landmark, Plus, X, Trash2, Pencil, CheckCircle2, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../services/api';
import type { FixedIncome, FixedIncomeSummary, FixedIncomeYieldType, CurrentRate } from '../types';

const INVESTMENT_TYPES = ['CDB', 'LCI', 'LCA', 'LC', 'TESOURO', 'DEBENTURE', 'CRI', 'CRA', 'OUTRO'];

const YIELD_TYPES: { value: FixedIncomeYieldType; label: string; hint: string }[] = [
  { value: 'PRE', label: 'Prefixado', hint: 'Taxa fixa ao ano (ex.: 11,5 = 11,5% a.a.)' },
  { value: 'CDI', label: '% do CDI', hint: 'Percentual do CDI (ex.: 110 = 110% do CDI)' },
  { value: 'SELIC', label: 'Selic + spread', hint: 'Spread somado à Selic (ex.: 0,5 = Selic + 0,5%)' },
  { value: 'IPCA', label: 'IPCA + spread', hint: 'Spread somado ao IPCA (ex.: 6 = IPCA + 6%)' },
];

const emptyForm = {
  name: '',
  investmentType: 'CDB',
  yieldType: 'CDI' as FixedIncomeYieldType,
  rate: '',
  investedAmount: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  maturityDate: '',
  taxExempt: false,
  notes: '',
};

const emptyContributionForm = {
  amount: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
};

export default function FixedIncomePage() {
  const [items, setItems] = useState<FixedIncome[]>([]);
  const [summary, setSummary] = useState<FixedIncomeSummary | null>(null);
  const [currentRates, setCurrentRates] = useState<Record<string, CurrentRate>>({});
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const [settleItem, setSettleItem] = useState<FixedIncome | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState('');
  const [settleError, setSettleError] = useState('');
  const [settleLoading, setSettleLoading] = useState(false);

  // Aportes e Agrupamentos
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedSettledGroups, setExpandedSettledGroups] = useState<Record<string, boolean>>({});
  const [contribTarget, setContribTarget] = useState<FixedIncome | null>(null);
  const [contribEditingId, setContribEditingId] = useState<string | null>(null);
  const [contribForm, setContribForm] = useState({ ...emptyContributionForm });
  const [contribError, setContribError] = useState('');
  const [contribLoading, setContribLoading] = useState(false);

  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [showForm, editingId]);

  useEffect(() => {
    document.title = 'Renda Fixa';
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [listRes, ratesRes] = await Promise.all([
        api.get('/fixed-income'),
        api.get('/rates/current'),
      ]);
      setItems(listRes.data.items || []);
      setSummary(listRes.data.summary || null);
      setCurrentRates(ratesRes.data || {});
    } catch (error) {
      console.error('Error loading fixed income:', error);
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

  const yieldLabel = (item: FixedIncome) => {
    switch (item.yieldType) {
      case 'PRE':
        return `${item.rate}% a.a.`;
      case 'CDI':
        return `${item.rate}% do CDI`;
      case 'SELIC':
        return `Selic + ${item.rate}%`;
      case 'IPCA':
        return `IPCA + ${item.rate}%`;
      default:
        return `${item.rate}%`;
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (item: FixedIncome) => {
    setEditingId(item.id);
    const firstContrib = item.contributions[0];
    setForm({
      name: item.name,
      investmentType: item.investmentType,
      yieldType: item.yieldType,
      rate: String(item.rate),
      investedAmount: String(item.investedAmount),
      purchaseDate: firstContrib ? firstContrib.date.split('T')[0] : item.createdAt.split('T')[0],
      maturityDate: item.maturityDate.split('T')[0],
      taxExempt: item.taxExempt,
      notes: item.notes || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    const payload = {
      name: form.name,
      investmentType: form.investmentType,
      yieldType: form.yieldType,
      rate: Number(form.rate),
      investedAmount: Number(form.investedAmount),
      purchaseDate: form.purchaseDate,
      maturityDate: form.maturityDate,
      taxExempt: form.taxExempt,
      notes: form.notes || null,
    };

    try {
      if (editingId) {
        await api.put(`/fixed-income/${editingId}`, payload);
      } else {
        await api.post('/fixed-income', payload);
      }
      setShowForm(false);
      setEditingId(null);
      loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Erro ao salvar investimento');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (item: FixedIncome) => {
    if (!confirm(`Excluir ${item.name}?`)) return;
    try {
      await api.delete(`/fixed-income/${item.id}`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  const openSettle = (item: FixedIncome) => {
    setSettleItem(item);
    setSettleAmount(
      item.settledAmount ? String(item.settledAmount) : String(item.projection.projectedNetValue)
    );
    setSettleDate(new Date().toISOString().split('T')[0]);
    setSettleError('');
  };

  const handleSettle = async (e: FormEvent) => {
    e.preventDefault();
    if (!settleItem) return;
    setSettleError('');
    setSettleLoading(true);
    try {
      await api.patch(`/fixed-income/${settleItem.id}/settle`, {
        settledAmount: Number(settleAmount),
        settledDate: settleDate,
      });
      setSettleItem(null);
      loadData();
    } catch (err: any) {
      setSettleError(err.response?.data?.error || 'Erro ao encerrar');
    } finally {
      setSettleLoading(false);
    }
  };

  const handleReopen = async (item: FixedIncome) => {
    if (!confirm(`Reabrir o investimento ${item.name}?`)) return;
    try {
      await api.patch(`/fixed-income/${item.id}/settle`, {
        settledAmount: null,
        settledDate: null,
      });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao reabrir');
    }
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openContribution = (item: FixedIncome, contributionId?: string) => {
    setContribTarget(item);
    setContribError('');
    if (contributionId) {
      const c = item.contributions.find((x) => x.id === contributionId);
      setContribEditingId(contributionId);
      setContribForm({
        amount: c ? String(c.amount) : '',
        date: c ? c.date.split('T')[0] : '',
        notes: c?.notes || '',
      });
    } else {
      setContribEditingId(null);
      setContribForm({ ...emptyContributionForm });
    }
  };

  const handleContributionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!contribTarget) return;
    setContribError('');
    setContribLoading(true);

    const payload = {
      amount: Number(contribForm.amount),
      date: contribForm.date,
      notes: contribForm.notes || null,
    };

    try {
      if (contribEditingId) {
        await api.put(`/fixed-income/${contribTarget.id}/contributions/${contribEditingId}`, payload);
      } else {
        await api.post(`/fixed-income/${contribTarget.id}/contributions`, payload);
      }
      setExpanded((prev) => ({ ...prev, [contribTarget.id]: true }));
      setContribTarget(null);
      setContribEditingId(null);
      loadData();
    } catch (err: any) {
      setContribError(err.response?.data?.error || 'Erro ao salvar aporte');
    } finally {
      setContribLoading(false);
    }
  };

  const handleDeleteContribution = async (item: FixedIncome, contributionId: string) => {
    if (!confirm('Excluir este aporte?')) return;
    try {
      await api.delete(`/fixed-income/${item.id}/contributions/${contributionId}`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir aporte');
    }
  };

  const selectedYield = YIELD_TYPES.find((y) => y.value === form.yieldType);
  const missingRate =
    form.yieldType !== 'PRE' &&
    (form.yieldType === 'CDI' ? !currentRates['SELIC'] : !currentRates[form.yieldType]);

  const active = items.filter((i) => !i.projection.settled);
  const settled = items.filter((i) => i.projection.settled);

  const toggleSettledGroup = (name: string) => {
    setExpandedSettledGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const settledGroupedMap = settled.reduce((acc: Record<string, FixedIncome[]>, item) => {
    const key = item.name.trim();
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const settledGroups = Object.entries(settledGroupedMap).map(([name, groupItems]) => {
    const totalInvested = groupItems.reduce((sum, i) => sum + i.investedAmount, 0);
    const totalSettledAmount = groupItems.reduce((sum, i) => sum + (i.settledAmount || 0), 0);
    const totalExpectedAtSettlement = groupItems.reduce((sum, i) => sum + (i.projection.expectedNetAtSettlement || 0), 0);
    const totalRealizedProfit = groupItems.reduce((sum, i) => sum + (i.projection.realizedProfit || 0), 0);

    return {
      name,
      items: groupItems,
      totalInvested,
      totalSettledAmount,
      totalExpectedAtSettlement,
      totalRealizedProfit,
      count: groupItems.length,
    };
  });

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="text-muted-foreground">Carregando...</div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Landmark size={20} /> Renda Fixa
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition w-full sm:w-auto"
        >
          <Plus size={16} /> Novo investimento
        </button>
      </div>

      {/* Taxas vigentes */}
      <div className="flex flex-wrap gap-2 mb-6 text-xs">
        {['SELIC', 'IPCA', 'CDI'].map((type) => {
          const rate = currentRates[type];
          let label: string;
          if (!rate) {
            label = type === 'CDI' ? 'derivado da Selic (cadastre a Selic)' : 'não cadastrada';
          } else if (type === 'CDI') {
            label = `${rate.rate}% a.a. (derivado da Selic - 0,10 p.p.)`;
          } else if (type === 'IPCA') {
            // O IPCA é cadastrado como variação do mês; o acumulado 12m vem da API.
            const acc = rate.accumulated12m;
            label =
              `${rate.rate}% no mês de ${formatDate(rate.startDate)}` +
              (acc != null ? ` · ${acc.toFixed(2)}% em 12 meses` : '');
          } else {
            label = `${rate.rate}% a.a. (desde ${formatDate(rate.startDate)})`;
          }
          return (
            <span
              key={type}
              className={`px-3 py-1.5 rounded-lg border ${
                rate ? 'border-border bg-muted text-foreground' : 'border-amber-300 bg-amber-50 text-amber-700'
              }`}
            >
              {type}: {label}
            </span>
          );
        })}
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-card text-card-foreground rounded-xl p-4 sm:p-6 shadow-xs border border-border">
          <div className="text-sm text-muted-foreground mb-1">Investido (ativos)</div>
          <div className="text-xl sm:text-2xl font-bold text-foreground">{formatCurrency(summary?.invested || 0)}</div>
          <div className="text-xs text-muted-foreground mt-1">{summary?.activeCount || 0} ativo(s)</div>
        </div>

        <div className="bg-card text-card-foreground rounded-xl p-4 sm:p-6 shadow-xs border border-border">
          <div className="text-sm text-muted-foreground mb-1 font-semibold text-foreground">L/P</div>
          <div className={`text-xl sm:text-2xl font-bold ${((summary?.unrealizedProfit || 0) + (summary?.realizedProfit || 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency((summary?.unrealizedProfit || 0) + (summary?.realizedProfit || 0))}
          </div>
          <div className="mt-2 text-xs space-y-1 border-t border-border/50 pt-2 text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Ativos: <strong className={(summary?.unrealizedProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(summary?.unrealizedProfit || 0)}</strong></span>
              <span>(IR: <strong>{formatCurrency(summary?.currentTax || 0)}</strong>)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Encerrados: <strong className={(summary?.realizedProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(summary?.realizedProfit || 0)}</strong></span>
              <span>(IR: <strong>{formatCurrency(summary?.settledTax || 0)}</strong>)</span>
            </div>
          </div>
        </div>

        <div className="bg-card text-card-foreground rounded-xl p-4 sm:p-6 shadow-xs border border-border">
          <div className="text-sm text-muted-foreground mb-1">Previsto no vencimento</div>
          <div className="text-xl sm:text-2xl font-bold text-foreground">
            {formatCurrency(summary?.projectedNetValue || 0)}
          </div>
          <div className="mt-2 text-xs space-y-1 border-t border-border/50 pt-2 text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Líquido: <strong className={(summary?.projectedProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(summary?.projectedProfit || 0)}</strong></span>
              <span>(IR: <strong>{formatCurrency(summary?.projectedTax || 0)}</strong>)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div ref={formRef} className="bg-white rounded-xl shadow-sm border-2 border-primary/40 mb-6 sm:mb-8">
          <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {editingId ? `Editar investimento — ${form.name}` : 'Novo investimento'}
            </h2>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="sm:col-span-2 md:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1">Nome</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="CDB Banco X 2027"
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                required
                maxLength={120}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Tipo</label>
              <select
                value={form.investmentType}
                onChange={(e) => setForm({ ...form, investmentType: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {INVESTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {editingId ? 'Total aportado (R$)' : 'Valor do primeiro aporte (R$)'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.investedAmount}
                onChange={(e) => setForm({ ...form, investedAmount: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                required={!editingId}
                disabled={!!editingId}
              />
              {editingId && (
                <p className="text-xs text-muted-foreground mt-1">Gerencie os valores na lista de aportes</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Tipo de rendimento</label>
              <select
                value={form.yieldType}
                onChange={(e) => setForm({ ...form, yieldType: e.target.value as FixedIncomeYieldType })}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {YIELD_TYPES.map((y) => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Percentual</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">{selectedYield?.hint}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {editingId ? 'Data do primeiro aporte' : 'Data de aquisição'}
              </label>
              <input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                required={!editingId}
                disabled={!!editingId}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Data de vencimento</label>
              <input
                type="date"
                value={form.maturityDate}
                onChange={(e) => setForm({ ...form, maturityDate: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer py-2">
                <input
                  type="checkbox"
                  checked={form.taxExempt}
                  onChange={(e) => setForm({ ...form, taxExempt: e.target.checked })}
                  className="w-4 h-4 accent-[var(--color-primary)]"
                />
                Isento de IR
              </label>
            </div>

            <div className="sm:col-span-2 md:col-span-3">
              <label className="block text-sm font-medium text-muted-foreground mb-1">Observações</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {missingRate && (
              <p className="sm:col-span-2 md:col-span-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                A taxa {form.yieldType} ainda não foi cadastrada. O rendimento previsto ficará zerado até que um
                administrador cadastre a taxa.
              </p>
            )}
            {formError && <p className="sm:col-span-2 md:col-span-3 text-sm text-red-600">{formError}</p>}

            <div className="sm:col-span-2 md:col-span-3">
              <button
                type="submit"
                disabled={formLoading}
                className="w-full sm:w-auto bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {formLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ativos */}
      <div className="bg-white rounded-xl shadow-sm border border-border mb-6 sm:mb-8">
        <div className="p-4 sm:p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Investimentos ativos</h2>
        </div>
        {active.length === 0 ? (
          <div className="p-6 text-muted-foreground text-sm">Nenhum investimento ativo</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground min-w-[200px]">Nome</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Rendimento</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Investido</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Líquido hoje</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Previsto líquido</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">IR</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">Vencimento</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {active.map((item) => (
                  <Fragment key={item.id}>
                  <tr className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      <button
                        onClick={() => toggleExpanded(item.id)}
                        className="inline-flex items-center gap-1 text-left hover:text-primary transition"
                        title="Ver aportes"
                      >
                        {expanded[item.id] ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                        <span>{item.name}</span>
                      </button>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({item.contributions.length} aporte{item.contributions.length > 1 ? 's' : ''})
                      </span>
                      {item.projection.matured && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          vencido
                        </span>
                      )}
                      {item.notes && (
                        <div className="text-xs text-muted-foreground font-normal mt-0.5">{item.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{item.investmentType}</td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {yieldLabel(item)}
                      <div className="text-xs text-muted-foreground">
                        {item.projection.effectiveAnnualRate.toFixed(2)}% a.a. efetivo
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right whitespace-nowrap">{formatCurrency(item.investedAmount)}</td>
                    <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                      <div className="font-medium">{formatCurrency(item.projection.currentNetValue)}</div>
                      <div className="text-xs text-muted-foreground">
                        bruto {formatCurrency(item.projection.currentGrossValue)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-green-600 whitespace-nowrap">
                      {formatCurrency(item.projection.projectedNetValue)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground whitespace-nowrap">
                      {item.taxExempt ? 'Isento' : `${(item.projection.taxRate * 100).toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-muted-foreground whitespace-nowrap">
                      {formatDate(item.maturityDate)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openContribution(item)}
                        title="Adicionar aporte"
                        className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition"
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        onClick={() => openSettle(item)}
                        title="Encerrar / informar valor recebido"
                        className="p-2 rounded-lg text-muted-foreground hover:text-green-600 hover:bg-muted transition"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        title="Editar"
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        title="Excluir"
                        className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-muted transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                  {expanded[item.id] && (
                    <tr className="border-b border-border bg-muted/30">
                      <td colSpan={9} className="px-6 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-foreground">Aportes</h4>
                          <button
                            onClick={() => openContribution(item)}
                            className="text-xs flex items-center gap-1 text-primary hover:underline"
                          >
                            <Plus size={12} /> Novo aporte
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px]">
                          <thead>
                            <tr className="text-xs text-muted-foreground">
                              <th className="text-left py-1 font-medium">Data</th>
                              <th className="text-right py-1 font-medium">Valor</th>
                              <th className="text-right py-1 font-medium">Prazo (dias)</th>
                              <th className="text-right py-1 font-medium">Líquido hoje</th>
                              <th className="text-right py-1 font-medium">Previsto líquido</th>
                              <th className="text-right py-1 font-medium">IR (hoje / venc.)</th>
                              <th className="text-left py-1 font-medium pl-4">Obs.</th>
                              <th className="text-right py-1 font-medium">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.contributions.map((c) => (
                              <tr key={c.id} className="text-sm border-t border-border/60">
                                <td className="py-1.5 text-muted-foreground whitespace-nowrap">{formatDate(c.date)}</td>
                                <td className="py-1.5 text-right whitespace-nowrap">{formatCurrency(c.amount)}</td>
                                <td className="py-1.5 text-right text-muted-foreground whitespace-nowrap">{c.days}</td>
                                <td className="py-1.5 text-right whitespace-nowrap">
                                  <div>{formatCurrency(c.currentNetValue)}</div>
                                  <div className="text-xs text-muted-foreground">
                                    bruto {formatCurrency(c.currentGrossValue)}
                                  </div>
                                </td>
                                <td className="py-1.5 text-right text-green-600 whitespace-nowrap">
                                  {formatCurrency(c.projectedNetValue)}
                                </td>
                                <td className="py-1.5 text-right text-muted-foreground whitespace-nowrap">
                                  {item.taxExempt
                                    ? 'Isento'
                                    : `${(c.currentTaxRate * 100).toFixed(1)}% / ${(c.taxRate * 100).toFixed(1)}%`}
                                </td>
                                <td className="py-1.5 pl-4 text-muted-foreground text-xs">{c.notes || '-'}</td>
                                <td className="py-1.5 text-right whitespace-nowrap">
                                  <button
                                    onClick={() => openContribution(item, c.id)}
                                    title="Editar aporte"
                                    className="p-2 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteContribution(item, c.id)}
                                    title="Excluir aporte"
                                    className="p-2 rounded text-muted-foreground hover:text-red-600 hover:bg-muted transition"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Encerrados (Agrupados por Nome) */}
      {settledGroups.length > 0 && (
        <div className="bg-card text-card-foreground rounded-xl shadow-xs border border-border mt-6 sm:mt-8">
          <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Investimentos encerrados</h2>
            <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
              {settled.length} título(s) em {settledGroups.length} grupo(s)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground min-w-[220px]">Grupo / Nome</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Rendimento</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Investido</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Recebido</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Estimado</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Resultado</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">Encerrado em</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {settledGroups.map((group) => {
                  const isGroup = group.count > 1;
                  const isOpen = expandedSettledGroups[group.name];

                  if (!isGroup) {
                    const item = group.items[0];
                    return (
                      <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {item.name}
                          {item.notes && <div className="text-xs text-muted-foreground font-normal mt-0.5">{item.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{yieldLabel(item)}</td>
                        <td className="px-4 py-3 text-sm text-right whitespace-nowrap">{formatCurrency(item.investedAmount)}</td>
                        <td className="px-4 py-3 text-sm text-right whitespace-nowrap">{formatCurrency(item.settledAmount || 0)}</td>
                        <td className="px-4 py-3 text-sm text-right text-muted-foreground whitespace-nowrap">
                          {formatCurrency(item.projection.expectedNetAtSettlement || 0)}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium whitespace-nowrap ${group.totalRealizedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(group.totalRealizedProfit)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-muted-foreground whitespace-nowrap">
                          {item.settledDate ? formatDate(item.settledDate) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button onClick={() => openSettle(item)} title="Ajustar valor recebido" className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleReopen(item)} title="Reabrir" className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer">
                            <RotateCcw size={16} />
                          </button>
                          <button onClick={() => handleDelete(item)} title="Excluir" className="p-2 rounded-lg text-muted-foreground hover:text-red-600 transition cursor-pointer">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <Fragment key={group.name}>
                      <tr className="border-b border-border bg-muted/30 font-medium hover:bg-muted/60 transition">
                        <td className="px-4 py-3 text-sm text-foreground flex items-center gap-2">
                          <button
                            onClick={() => toggleSettledGroup(group.name)}
                            className="p-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
                          >
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          <span>{group.name}</span>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                            {group.count} encerrados
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">Agrupado por nome</td>
                        <td className="px-4 py-3 text-sm text-right whitespace-nowrap font-semibold">{formatCurrency(group.totalInvested)}</td>
                        <td className="px-4 py-3 text-sm text-right whitespace-nowrap font-semibold">{formatCurrency(group.totalSettledAmount)}</td>
                        <td className="px-4 py-3 text-sm text-right text-muted-foreground whitespace-nowrap">{formatCurrency(group.totalExpectedAtSettlement)}</td>
                        <td className={`px-4 py-3 text-sm text-right font-bold whitespace-nowrap ${group.totalRealizedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(group.totalRealizedProfit)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-muted-foreground whitespace-nowrap">-</td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          <button onClick={() => toggleSettledGroup(group.name)} className="text-primary hover:underline cursor-pointer">
                            {isOpen ? 'Ocultar' : 'Ver títulos'}
                          </button>
                        </td>
                      </tr>

                      {isOpen && group.items.map((item) => (
                        <tr key={item.id} className="border-b border-border bg-background/50 text-xs hover:bg-muted/30 transition">
                          <td className="px-4 py-2.5 pl-9 font-medium text-foreground">
                            └ {item.name}
                            {item.notes && <span className="text-muted-foreground font-normal ml-2">({item.notes})</span>}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{yieldLabel(item)}</td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">{formatCurrency(item.investedAmount)}</td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">{formatCurrency(item.settledAmount || 0)}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">{formatCurrency(item.projection.expectedNetAtSettlement || 0)}</td>
                          <td className={`px-4 py-2.5 text-right font-medium whitespace-nowrap ${(item.projection.realizedProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(item.projection.realizedProfit || 0)}
                          </td>
                          <td className="px-4 py-2.5 text-center text-muted-foreground whitespace-nowrap">
                            {item.settledDate ? formatDate(item.settledDate) : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <button onClick={() => openSettle(item)} title="Ajustar valor recebido" className="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleReopen(item)} title="Reabrir" className="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer">
                              <RotateCcw size={14} />
                            </button>
                            <button onClick={() => handleDelete(item)} title="Excluir" className="p-1 rounded text-muted-foreground hover:text-red-600 transition cursor-pointer">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de encerramento */}
      {contribTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-lg border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {contribEditingId ? 'Editar aporte' : 'Novo aporte'}
              </h3>
              <button
                onClick={() => setContribTarget(null)}
                className="text-muted-foreground hover:text-foreground p-2 -m-2"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleContributionSubmit} className="p-4 sm:p-6 space-y-4">
              <p className="text-sm text-muted-foreground">{contribTarget.name}</p>
              {contribError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
                  {contribError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={contribForm.amount}
                  onChange={(e) => setContribForm({ ...contribForm, amount: e.target.value })}
                  onBlur={(e) =>
                    setContribForm((prev) => ({
                      ...prev,
                      amount: e.target.value === '' ? '' : Number(e.target.value).toFixed(2),
                    }))
                  }
                  className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Data do aporte</label>
                <input
                  type="date"
                  value={contribForm.date}
                  onChange={(e) => setContribForm({ ...contribForm, date: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A alíquota de IR é calculada pelo prazo deste aporte até o vencimento
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Observações</label>
                <input
                  type="text"
                  value={contribForm.notes}
                  onChange={(e) => setContribForm({ ...contribForm, notes: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={contribLoading}
                  className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                  {contribLoading ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => setContribTarget(null)}
                  className="flex-1 border border-border text-foreground py-2 rounded-lg hover:bg-muted transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {settleItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-lg border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Encerrar investimento</h3>
              <button
                onClick={() => setSettleItem(null)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSettle} className="p-4 sm:p-6 space-y-4">
              <div className="text-sm text-muted-foreground">
                {settleItem.name}
                <div className="mt-1">
                  Líquido hoje{' '}
                  <strong className="text-foreground">
                    {formatCurrency(settleItem.projection.currentNetValue)}
                  </strong>{' '}
                  · previsto no vencimento{' '}
                  <strong className="text-foreground">
                    {formatCurrency(settleItem.projection.projectedNetValue)}
                  </strong>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Valor efetivamente recebido (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Data do encerramento</label>
                <input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              {settleError && <p className="text-sm text-red-600">{settleError}</p>}
              <button
                type="submit"
                disabled={settleLoading}
                className="w-full bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {settleLoading ? 'Salvando...' : 'Confirmar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
