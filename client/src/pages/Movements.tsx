import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Trash2, X, Plus, Lock } from 'lucide-react';
import axios from 'axios';
import api from '../services/api';

interface Movement {
  id: string | null;
  source: 'transaction' | 'dividend-auto' | 'dividend-manual';
  kind: string;
  category: string;
  ticker: string;
  stockName: string;
  date: string;
  quantity: number;
  unitValue: number;
  fees: number;
  total: number;
  editable: boolean;
  notes: string | null;
  divType: string | null;
  paymentDate: string | null;
  comDate?: string | null;
}

type CreateKind = 'BUY' | 'SELL' | 'DIVIDEND';

const categoryStyle: Record<string, string> = {
  Compra: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  Venda: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  'Dividendo Automático': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'Dividendo Manual': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

export default function Movements() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [filter, setFilter] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [cMode, setCMode] = useState<'transaction' | 'dividend'>('transaction');
  const [cType, setCType] = useState<'BUY' | 'SELL'>('BUY');
  const [createKind, setCreateKindState] = useState<CreateKind>('BUY');

  const setCreateKind = (kind: CreateKind) => {
    setCreateKindState(kind);
    if (kind === 'DIVIDEND') {
      setCMode('dividend');
    } else {
      setCMode('transaction');
      setCType(kind);
    }
  };

  const [cTicker, setCTicker] = useState('');

  const [cQuantity, setCQuantity] = useState('');
  const [cPrice, setCPrice] = useState('');
  const [cFees, setCFees] = useState('');
  const [cDate, setCDate] = useState(new Date().toISOString().split('T')[0]);
  const [cAmount, setCAmount] = useState('');
  const [cComDate, setCComDate] = useState(new Date().toISOString().split('T')[0]);
  const [cPaymentDate, setCPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [cDivType, setCDivType] = useState<'DIVIDENDO' | 'JCP' | 'RENDIMENTO'>('DIVIDENDO');
  const [cNotes, setCNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit modal
  const [editMov, setEditMov] = useState<Movement | null>(null);
  const [eType, setEType] = useState<'BUY' | 'SELL'>('BUY');
  const [eQuantity, setEQuantity] = useState('');
  const [ePrice, setEPrice] = useState('');
  const [eFees, setEFees] = useState('');
  const [eDate, setEDate] = useState('');
  const [eAmount, setEAmount] = useState('');
  const [eComDate, setEComDate] = useState('');
  const [ePaymentDate, setEPaymentDate] = useState('');
  const [eDivType, setEDivType] = useState<'DIVIDENDO' | 'JCP' | 'RENDIMENTO'>('DIVIDENDO');
  const [eNotes, setENotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const loadData = async () => {
    try {
      const res = await api.get('/dashboard/movements');
      setMovements(res.data);
    } catch (err) {
      console.error('Erro ao carregar movimentações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Movimentações';
    let isMounted = true;
    api.get('/dashboard/movements')
      .then((res) => {
        if (isMounted) {
          setMovements(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Erro ao carregar movimentações:', err);
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('T')[0].split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('pt-BR');
  };

  const resetCreate = () => {
    setCTicker(''); setCQuantity(''); setCPrice(''); setCFees('');
    setCDate(new Date().toISOString().split('T')[0]);
    setCAmount(''); setCComDate(''); setCPaymentDate(''); setCNotes('');
    setCMode('transaction'); setCType('BUY'); setCDivType('DIVIDENDO'); setCreateKindState('BUY'); setFormError('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (cMode === 'dividend') {
        await api.post('/dividends/manual', {
          ticker: cTicker.trim().toUpperCase(),
          amount: Number(cAmount),
          comDate: cComDate,
          paymentDate: cPaymentDate,
          type: cDivType,
          notes: cNotes || undefined,
        });
      } else {
        await api.post('/transactions', {
          ticker: cTicker.trim().toUpperCase(),
          type: cType,
          quantity: Number(cQuantity),
          price: Number(cPrice),
          fees: Number(cFees || 0),
          date: cDate,
          notes: cNotes || undefined,
        });
      }
      setShowCreate(false);
      resetCreate();
      loadData();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao registrar movimentação';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (mov: Movement) => {
    setEditMov(mov);
    setENotes(mov.notes || '');
    if (mov.source === 'transaction') {
      setEType(mov.kind as 'BUY' | 'SELL');
      setEQuantity(String(mov.quantity));
      setEPrice(String(mov.unitValue));
      setEFees(String(mov.fees || 0));
      setEDate(mov.date.split('T')[0]);
    } else {
      setEAmount(String(mov.total));
      setEComDate((mov.comDate || mov.date).split('T')[0]);
      setEPaymentDate((mov.paymentDate || mov.date).split('T')[0]);
      setEDivType((mov.divType as 'DIVIDENDO' | 'JCP' | 'RENDIMENTO') || 'DIVIDENDO');
    }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editMov || !editMov.id) return;
    setEditSaving(true);
    try {
      if (editMov.source === 'transaction') {
        await api.put(`/transactions/${editMov.id}`, {
          type: eType,
          quantity: Number(eQuantity),
          price: Number(ePrice),
          fees: Number(eFees || 0),
          date: eDate,
          notes: eNotes || undefined,
        });
      } else {
        await api.put(`/dividends/manual/${editMov.id}`, {
          amount: Number(eAmount),
          comDate: eComDate,
          paymentDate: ePaymentDate,
          type: eDivType,
          notes: eNotes || undefined,
        });
      }
      setEditMov(null);
      loadData();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao editar';
      alert(message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (mov: Movement) => {
    if (!mov.id || !mov.editable) return;
    if (!confirm('Deseja excluir esta movimentação?')) return;
    try {
      if (mov.source === 'transaction') {
        await api.delete(`/transactions/${mov.id}`);
      } else {
        await api.delete(`/dividends/manual/${mov.id}`);
      }
      loadData();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao excluir';
      alert(message);
    }
  };

  const filtered = filter
    ? movements.filter((m) => m.ticker.toLowerCase().includes(filter.toLowerCase()))
    : movements;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Movimentações</h1>
          <span className="text-sm text-muted-foreground">({filtered.length} registros)</span>
        </div>
        <button
          onClick={() => { resetCreate(); setShowCreate(true); }}
          className="sm:ml-auto w-full sm:w-auto flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 transition cursor-pointer"
        >
          <Plus size={16} /> Nova
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Filtrar por ticker..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Data</th>
                <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Tipo</th>
                <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Ticker</th>
                <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Qtd</th>
                <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Valor Unit.</th>
                <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Total</th>
                <th className="text-center px-3 py-3 text-sm font-medium text-muted-foreground w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((mov, idx) => (
                <tr key={`${mov.source}-${mov.id ?? idx}`} className="border-b border-border hover:bg-muted/50 transition">
                  <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatDate(mov.date)}</td>
                  <td className="px-4 sm:px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${categoryStyle[mov.category] || 'bg-muted text-muted-foreground'}`}>
                      {mov.category}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-sm">
                    <div className="font-medium">{mov.ticker}</div>
                    <div className="text-xs text-muted-foreground">{mov.stockName}</div>
                  </td>
                  <td className="text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{mov.quantity > 0 ? mov.quantity.toFixed(0) : '-'}</td>
                  <td className="text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{mov.unitValue > 0 ? formatCurrency(mov.unitValue) : '-'}</td>
                  <td className="text-right px-4 sm:px-6 py-4 text-sm font-medium whitespace-nowrap">{formatCurrency(mov.total)}</td>
                  <td className="text-center px-3 py-4">
                    {mov.editable ? (
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(mov)} className="text-muted-foreground hover:text-blue-600 transition cursor-pointer p-2" title="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(mov)} className="text-muted-foreground hover:text-red-600 transition cursor-pointer p-2" title="Excluir">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center text-muted-foreground/50" title="Entrada automática (somente leitura)">
                        <Lock size={14} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    Nenhuma movimentação encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Nova Movimentação</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              {formError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{formError}</div>}
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select value={createKind} onChange={(e) => setCreateKind(e.target.value as CreateKind)} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                  <option value="BUY">Compra</option>
                  <option value="SELL">Venda</option>
                  <option value="DIVIDEND">Dividendo Manual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ticker</label>
                <input type="text" value={cTicker} onChange={(e) => setCTicker(e.target.value.toUpperCase())} required className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>

              {createKind !== 'DIVIDEND' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Quantidade</label>
                      <input type="number" value={cQuantity} onChange={(e) => setCQuantity(e.target.value)} required min="0" step="0.000001" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Preço (R$)</label>
                      <input type="number" value={cPrice} onChange={(e) => setCPrice(e.target.value)} required min="0" step="0.01" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Taxas (R$)</label>
                      <input type="number" value={cFees} onChange={(e) => setCFees(e.target.value)} min="0" step="0.01" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Data</label>
                      <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} required className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Valor Total (R$)</label>
                      <input type="number" value={cAmount} onChange={(e) => setCAmount(e.target.value)} required min="0" step="0.01" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Tipo Dividendo</label>
                      <select value={cDivType} onChange={(e) => setCDivType(e.target.value as 'DIVIDENDO' | 'JCP' | 'RENDIMENTO')} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                        <option value="DIVIDENDO">Dividendo</option>
                        <option value="JCP">JCP</option>
                        <option value="RENDIMENTO">Rendimento</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Data Com</label>
                      <input type="date" value={cComDate} onChange={(e) => setCComDate(e.target.value)} required className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Data Pagamento</label>
                      <input type="date" value={cPaymentDate} onChange={(e) => setCPaymentDate(e.target.value)} required className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Observações</label>
                <input type="text" value={cNotes} onChange={(e) => setCNotes(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition cursor-pointer">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 cursor-pointer">{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editMov && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Editar — {editMov.ticker}</h3>
              <button onClick={() => setEditMov(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              {editMov.source === 'transaction' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tipo</label>
                    <select value={eType} onChange={(e) => setEType(e.target.value as 'BUY' | 'SELL')} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                      <option value="BUY">Compra</option>
                      <option value="SELL">Venda</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Quantidade</label>
                      <input type="number" value={eQuantity} onChange={(e) => setEQuantity(e.target.value)} required min="0" step="0.000001" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Preço (R$)</label>
                      <input type="number" value={ePrice} onChange={(e) => setEPrice(e.target.value)} required min="0" step="0.01" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Taxas (R$)</label>
                      <input type="number" value={eFees} onChange={(e) => setEFees(e.target.value)} min="0" step="0.01" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Data</label>
                      <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} required className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Valor Total (R$)</label>
                      <input type="number" value={eAmount} onChange={(e) => setEAmount(e.target.value)} required min="0" step="0.01" className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Tipo Dividendo</label>
                      <select value={eDivType} onChange={(e) => setEDivType(e.target.value as 'DIVIDENDO' | 'JCP' | 'RENDIMENTO')} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                        <option value="DIVIDENDO">Dividendo</option>
                        <option value="JCP">JCP</option>
                        <option value="RENDIMENTO">Rendimento</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Data Com</label>
                      <input type="date" value={eComDate} onChange={(e) => setEComDate(e.target.value)} required className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Data Pagamento</label>
                      <input type="date" value={ePaymentDate} onChange={(e) => setEPaymentDate(e.target.value)} required className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">A data-ex é calculada automaticamente (data-com + 1 dia útil).</p>
                </>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Observações</label>
                <input type="text" value={eNotes} onChange={(e) => setENotes(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditMov(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition cursor-pointer">Cancelar</button>
                <button type="submit" disabled={editSaving} className="flex-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 cursor-pointer">{editSaving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
