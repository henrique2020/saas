import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, X } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface StockDividend {
  id: string;
  stockId: number;
  amountPerShare: string;
  exDate: string;
  comDate: string;
  paymentDate: string;
  type: 'DIVIDENDO' | 'JCP' | 'RENDIMENTO';
  stock: {
    ticker: string;
    name: string;
  };
}

export default function AdminDividends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dividends, setDividends] = useState<StockDividend[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTicker, setFilterTicker] = useState('');

  // Edit modal
  const [editDiv, setEditDiv] = useState<StockDividend | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editComDate, setEditComDate] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [editType, setEditType] = useState<'DIVIDENDO' | 'JCP' | 'RENDIMENTO'>('DIVIDENDO');
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    document.title = 'Admin - Dividendos Automáticos';
    if (user?.role !== 'ADMIN') {
      navigate('/');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const res = await api.get('/dividends/stock-dividends');
      setDividends(res.data);
    } catch (err) {
      console.error('Erro ao carregar dividendos:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('T')[0].split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const openEdit = (div: StockDividend) => {
    setEditDiv(div);
    setEditAmount(String(div.amountPerShare));
    setEditComDate(div.comDate.split('T')[0]);
    setEditPaymentDate(div.paymentDate.split('T')[0]);
    setEditType(div.type);
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editDiv) return;
    setEditLoading(true);
    try {
      await api.put(`/dividends/stock-dividends/${editDiv.id}`, {
        amountPerShare: Number(editAmount),
        comDate: editComDate,
        paymentDate: editPaymentDate,
        type: editType,
      });
      setEditDiv(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao editar');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este dividendo automático?')) return;
    try {
      await api.delete(`/dividends/stock-dividends/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  const filtered = filterTicker
    ? dividends.filter(d => d.stock.ticker.toLowerCase().includes(filterTicker.toLowerCase()))
    : dividends;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold">Dividendos Automáticos</h1>
        <span className="text-sm text-muted-foreground">({filtered.length} registros)</span>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Filtrar por ticker..."
            value={filterTicker}
            onChange={(e) => setFilterTicker(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Ticker</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Ativo</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Tipo</th>
                  <th className="text-right px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Valor/Cota</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Data-Com</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Data-Ex</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-sm font-medium text-muted-foreground">Pagamento</th>
                  <th className="text-center px-3 py-3 text-sm font-medium text-muted-foreground w-20">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((div) => (
                  <tr key={div.id} className="border-b border-border hover:bg-muted/50 transition">
                    <td className="px-4 sm:px-6 py-4 text-sm font-medium whitespace-nowrap">{div.stock.ticker}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-muted-foreground">{div.stock.name}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-700">
                        {div.type}
                      </span>
                    </td>
                    <td className="text-right px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatCurrency(Number(div.amountPerShare))}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatDate(div.comDate)}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatDate(div.exDate)}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{formatDate(div.paymentDate)}</td>
                    <td className="text-center px-3 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(div)}
                          className="p-2 text-muted-foreground hover:text-blue-600 transition cursor-pointer"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(div.id)}
                          className="p-2 text-muted-foreground hover:text-red-600 transition cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 sm:px-6 py-8 text-center text-muted-foreground">
                      Nenhum dividendo automático encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Modal */}
        {editDiv && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Editar Dividendo — {editDiv.stock.ticker}
                </h3>
                <button onClick={() => setEditDiv(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as 'DIVIDENDO' | 'JCP' | 'RENDIMENTO')}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                  >
                    <option value="DIVIDENDO">Dividendo</option>
                    <option value="JCP">JCP</option>
                    <option value="RENDIMENTO">Rendimento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Valor por Cota (R$)</label>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                    required min="0" step="0.0001"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Data-Com</label>
                    <input
                      type="date"
                      value={editComDate}
                      onChange={(e) => setEditComDate(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Data Pagamento</label>
                    <input
                      type="date"
                      value={editPaymentDate}
                      onChange={(e) => setEditPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                      required
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  A data-ex será recalculada automaticamente (data-com + 1 dia útil).
                </p>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditDiv(null)}
                    className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="flex-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                  >
                    {editLoading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    );
  }
