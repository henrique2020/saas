import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Percent, Plus, X, Trash2, Pencil } from 'lucide-react';
import axios from 'axios';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { RateIndex } from '../types';

const RATE_TYPES: RateIndex['type'][] = ['SELIC', 'IPCA'];

const emptyForm = {
  type: 'SELIC' as RateIndex['type'],
  rate: '',
  startDate: new Date().toISOString().split('T')[0],
  notes: '',
};

export default function AdminRates() {
  const { user } = useAuth();
  const [rates, setRates] = useState<RateIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | RateIndex['type']>('ALL');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    document.title = 'Taxas de Referência';
    let isMounted = true;
    api.get('/rates')
      .then((res) => {
        if (isMounted) {
          setRates(res.data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error loading rates:', err);
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, []);

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('T')[0].split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('pt-BR');
  };
  const loadData = async () => {
    try {
      const res = await api.get('/rates');
      setRates(res.data || []);
    } catch (error) {
      console.error('Error loading rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (rate: RateIndex) => {
    setEditingId(rate.id);
    setForm({
      type: rate.type,
      rate: String(rate.rate),
      startDate: rate.startDate.split('T')[0],
      notes: rate.notes || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    const payload = {
      type: form.type,
      rate: Number(form.rate),
      startDate: form.startDate,
      notes: form.notes || null,
    };

    try {
      if (editingId) await api.put(`/rates/${editingId}`, payload);
      else await api.post('/rates', payload);
      setShowForm(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      loadData();
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao salvar taxa';
      setFormError(message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (rate: RateIndex) => {
    if (!confirm(`Excluir taxa ${rate.type} de ${formatDate(rate.startDate)}?`)) return;
    try {
      await api.delete(`/rates/${rate.id}`);
      loadData();
    } catch (error) {
      console.error('Error deleting rate:', error);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-border text-muted-foreground">
          Acesso restrito a administradores.
        </div>
      </main>
    );
  }

  const visible = filterType === 'ALL' ? rates : rates.filter((r) => r.type === filterType);

  return (
    <main className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Percent size={20} /> Taxas de Referência
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition w-full sm:w-auto"
        >
          <Plus size={16} /> Nova taxa
        </button>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        <strong>Selic:</strong> percentual <strong>ao ano</strong> definido pelo Copom, vigente a partir da data de início.
        <br />
        <strong>IPCA:</strong> a <strong>variação do mês</strong> divulgada pelo IBGE (ex.: 0,16). Aceita valores
        negativos em meses de deflação. Use o dia 1º do mês de referência como data de início — o motor de renda
        fixa anualiza compondo os meses.
        <br />
        Cada cadastro passa a valer a partir da sua data, e os cálculos capitalizam cada período com a taxa vigente à época.
        <br />
        O <strong>CDI não é cadastrado</strong>: é sempre derivado automaticamente como <strong>Selic - 0,10 p.p.</strong>
      </p>

      <div className="flex gap-1 bg-muted rounded-lg p-1 mb-6 w-fit overflow-x-auto max-w-full">
        {(['ALL', ...RATE_TYPES] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition whitespace-nowrap shrink-0 ${
              filterType === t ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'ALL' ? 'Todas' : t}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-border mb-6 sm:mb-8">
          <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {editingId ? 'Editar taxa' : 'Nova taxa'}
            </h2>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as RateIndex['type'] })}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {RATE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {form.type === 'IPCA' ? 'Variação do mês (%)' : 'Taxa (% a.a.)'}
              </label>
              <input
                type="number"
                step="0.01"
                min={form.type === 'IPCA' ? -20 : 0}
                max={form.type === 'IPCA' ? 20 : 100}
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                placeholder={form.type === 'IPCA' ? 'Ex.: 0.16 (ou -0.02)' : 'Ex.: 10.75'}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {form.type === 'IPCA' ? 'Mês de referência (use o dia 1º)' : 'Data de início'}
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-muted-foreground mb-1">Observações</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {formError && <p className="sm:col-span-2 lg:col-span-3 text-sm text-red-600">{formError}</p>}

            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={formLoading}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 w-full sm:w-auto"
              >
                {formLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-border">
        {loading ? (
          <div className="p-4 sm:p-6 text-muted-foreground text-sm">Carregando...</div>
        ) : visible.length === 0 ? (
          <div className="p-4 sm:p-6 text-muted-foreground text-sm">Nenhuma taxa cadastrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Tipo</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Taxa</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">Início da vigência</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Observações</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((rate) => (
                  <tr key={rate.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">{rate.type}</td>
                    <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                      {Number(rate.rate).toFixed(2)}%
                      <span className="text-xs text-muted-foreground ml-1">
                        {rate.type === 'IPCA' ? 'no mês' : 'a.a.'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-muted-foreground whitespace-nowrap">
                      {formatDate(rate.startDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{rate.notes || '-'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(rate)}
                        title="Editar"
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(rate)}
                        title="Excluir"
                        className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-muted transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
