import { useState, useEffect, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, Download } from 'lucide-react';
import axios from 'axios';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

type FormMode =
  | 'transaction'
  | 'dividend-central'
  | 'dividend-manual'
  | 'import-csv'
  | 'import-dividends-csv'
  | 'fixed-income'
  | 'import-fixed-income-csv'
  | 'rate'
  | 'import-rates-csv';

type FormCategory = 'buysell' | 'dividend' | 'fixed-income' | 'rate';

const INVESTMENT_TYPES = [
  { value: 'CDB', label: 'CDB' },
  { value: 'LCI', label: 'LCI' },
  { value: 'LCA', label: 'LCA' },
  { value: 'LC', label: 'Letra de Câmbio' },
  { value: 'TESOURO', label: 'Tesouro Direto' },
  { value: 'DEBENTURE', label: 'Debênture' },
  { value: 'CRI', label: 'CRI' },
  { value: 'CRA', label: 'CRA' },
  { value: 'OUTRO', label: 'Outro' },
];

/** Rótulo e ajuda do campo "taxa" conforme o indexador escolhido. */
const YIELD_TYPES: Record<string, { label: string; rateLabel: string; hint: string }> = {
  PRE: { label: 'Prefixado', rateLabel: 'Taxa (% a.a.)', hint: 'Ex.: 11.5 para 11,5% ao ano' },
  CDI: { label: '% do CDI', rateLabel: 'Percentual do CDI (%)', hint: 'Ex.: 110 para 110% do CDI' },
  SELIC: { label: 'Selic +', rateLabel: 'Spread sobre a Selic (p.p. a.a.)', hint: 'Ex.: 0.5 para Selic + 0,5%' },
  IPCA: { label: 'IPCA +', rateLabel: 'Spread sobre o IPCA (% a.a.)', hint: 'Ex.: 6 para IPCA + 6%' },
};

export default function NewTransaction() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTicker = searchParams.get('ticker') || '';

  const [category, setCategory] = useState<FormCategory>('buysell');
  const [mode, setMode] = useState<FormMode>('transaction');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [knownTickers, setKnownTickers] = useState<string[]>([]);

  // Transaction fields
  const [ticker, setTicker] = useState(initialTicker);
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fees, setFees] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Dividend central fields
  const [divAmountPerShare, setDivAmountPerShare] = useState('');
  const [divComDate, setDivComDate] = useState('');
  const [divPaymentDate, setDivPaymentDate] = useState('');
  const [divType, setDivType] = useState<'DIVIDENDO' | 'JCP' | 'RENDIMENTO'>('DIVIDENDO');

  // Dividend manual fields
  const [manualAmount, setManualAmount] = useState('');
  const [manualComDate, setManualComDate] = useState('');
  const [manualPaymentDate, setManualPaymentDate] = useState('');
  const [manualType, setManualType] = useState<'DIVIDENDO' | 'JCP' | 'RENDIMENTO'>('DIVIDENDO');
  const [manualNotes, setManualNotes] = useState('');

  // Fixed income fields
  const [fiName, setFiName] = useState('');
  const [fiInvestmentType, setFiInvestmentType] = useState('CDB');
  const [fiYieldType, setFiYieldType] = useState<'PRE' | 'CDI' | 'SELIC' | 'IPCA'>('CDI');
  const [fiRate, setFiRate] = useState('');
  const [fiAmount, setFiAmount] = useState('');
  const [fiPurchaseDate, setFiPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [fiMaturityDate, setFiMaturityDate] = useState('');
  const [fiTaxExempt, setFiTaxExempt] = useState(false);
  const [fiNotes, setFiNotes] = useState('');

  // Rate index fields (admin)
  const [rateType, setRateType] = useState<'SELIC' | 'IPCA'>('SELIC');
  const [rateValue, setRateValue] = useState('');
  const [rateStartDate, setRateStartDate] = useState('');
  const [rateNotes, setRateNotes] = useState('');

  // CSV import fields
  const [csvContent, setCsvContent] = useState('');
  const [csvResult, setCsvResult] = useState<{ message: string; errors?: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    api.get('/dashboard/summary')
      .then((res) => {
        const tickers = (res.data.positions || []).map((p: { ticker: string }) => p.ticker);
        setKnownTickers(tickers);
      })
      .catch(() => {});
  }, []);

  const handleTransactionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/transactions', {
        ticker,
        type,
        quantity: Number(quantity),
        price: Number(price),
        fees: Number(fees || 0),
        date,
        notes: notes || undefined,
      });
      navigate(initialTicker ? `/stock/${initialTicker}` : '/');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao registrar movimentação';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDividendCentralSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/dividends/stock-dividends', {
        ticker,
        amountPerShare: Number(divAmountPerShare),
        comDate: divComDate,
        paymentDate: divPaymentDate,
        type: divType,
      });
      setSuccess('Dividendo central registrado! Será calculado automaticamente para todos os usuários com cotas na data-com.');
      setDivAmountPerShare('');
      setDivComDate('');
      setDivPaymentDate('');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao registrar dividendo';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDividendManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/dividends/manual', {
        ticker,
        amount: Number(manualAmount),
        comDate: manualComDate,
        paymentDate: manualPaymentDate,
        type: manualType,
        notes: manualNotes || undefined,
      });
      navigate(initialTicker ? `/stock/${initialTicker}` : '/');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao registrar dividendo manual';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleFixedIncomeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/fixed-income', {
        name: fiName,
        investmentType: fiInvestmentType,
        yieldType: fiYieldType,
        rate: Number(fiRate),
        maturityDate: fiMaturityDate,
        taxExempt: fiTaxExempt,
        notes: fiNotes || undefined,
        contributions: [{ amount: Number(fiAmount), date: fiPurchaseDate }],
      });
      navigate('/renda-fixa');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao registrar investimento de renda fixa';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/rates', {
        type: rateType,
        rate: Number(rateValue),
        startDate: rateStartDate,
        notes: rateNotes || undefined,
      });
      setSuccess(
        rateType === 'IPCA'
          ? 'IPCA do mês registrado! O motor de renda fixa já usa a nova variação.'
          : 'Selic registrada! O CDI é derivado automaticamente (Selic - 0,10 p.p.).'
      );
      setRateValue('');
      setRateStartDate('');
      setRateNotes('');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao registrar taxa';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCsvFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvContent(ev.target?.result as string || '');
      setCsvResult(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleCsvImport = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCsvResult(null);
    setLoading(true);

    try {
      const res = await api.post('/transactions/import-csv', { csv: csvContent });
      setCsvResult(res.data);
      setSuccess(res.data.message);
      setCsvContent('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      setError(data?.error || 'Erro ao importar CSV');
      if (data?.details) setCsvResult({ message: data.error, errors: data.details });
    } finally {
      setLoading(false);
    }
  };

  const handleDividendCsvImport = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCsvResult(null);
    setLoading(true);

    try {
      const res = await api.post('/dividends/stock-dividends/import-csv', { csv: csvContent });
      setCsvResult(res.data);
      setSuccess(res.data.message);
      setCsvContent('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      setError(data?.error || 'Erro ao importar CSV de dividendos');
      if (data?.details) setCsvResult({ message: data.error, errors: data.details });
    } finally {
      setLoading(false);
    }
  };

  const handleFixedIncomeCsvImport = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCsvResult(null);
    setLoading(true);

    try {
      const res = await api.post('/fixed-income/import-csv', { csv: csvContent });
      setCsvResult(res.data);
      setSuccess(res.data.message);
      setCsvContent('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      setError(data?.error || 'Erro ao importar CSV de renda fixa');
      if (data?.details) setCsvResult({ message: data.error, errors: data.details });
    } finally {
      setLoading(false);
    }
  };

  const handleRatesCsvImport = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCsvResult(null);
    setLoading(true);

    try {
      const res = await api.post('/rates/import-csv', { csv: csvContent });
      setCsvResult(res.data);
      setSuccess(res.data.message);
      setCsvContent('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      setError(data?.error || 'Erro ao importar CSV de taxas');
      if (data?.details) setCsvResult({ message: data.error, errors: data.details });
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFixedIncomeTemplate = () => {
    downloadCsv(
      'Nome;Tipo;Indexador;Taxa;Valor;Data-aporte;Vencimento;Isento\n' +
        'CDB Banco X;CDB;CDI;110;1000.00;2025-01-10;2027-01-10;NAO\n' +
        'CDB Banco X;CDB;CDI;110;500.00;2025-06-10;2027-01-10;NAO\n' +
        'LCI Banco Y;LCI;CDI;95;2000.00;2025-02-01;2026-08-01;SIM\n' +
        'Tesouro IPCA 2029;TESOURO;IPCA;6;3000.00;2025-03-15;2029-05-15;NAO\n',
      'modelo_importacao_renda_fixa.csv'
    );
  };

  const downloadRatesTemplate = () => {
    downloadCsv(
      'Tipo;Data-inicio;Taxa;Observacao\n' +
        'SELIC;2025-01-29;13.25;Copom jan/25\n' +
        'IPCA;2025-01-01;0.16;Variacao do mes de janeiro\n' +
        'IPCA;2025-02-01;1.31;Variacao do mes de fevereiro\n' +
        'IPCA;2025-03-01;-0.02;Deflacao no mes (aceita negativo)\n',
      'modelo_importacao_taxas.csv'
    );
  };

  const downloadTemplate = () => {
    downloadCsv(
      'Ticker;Cotas;Operação;Valor p/ Cota;Data\n' +
        'PETR4;100;COMPRA;32.50;2024-01-15\n' +
        'VALE3;50;VENDA;68.00;2024-02-10\n',
      'modelo_movimentacoes.csv'
    );
  };

  const downloadDividendTemplate = () => {
    downloadCsv(
      'Ticker;Data-com;Data-pagamento;Tipo;Valor\n' +
        'PETR4;2024-01-10;2024-01-25;DIVIDENDO;1.25\n' +
        'VALE3;2024-02-01;2024-02-20;JCP;0.80\n',
      'modelo_dividendos.csv'
    );
  };

  const selectMode = (m: FormMode) => {
    setMode(m);
    setError('');
    setSuccess('');
    setCsvResult(null);
  };

  const selectCategory = (c: FormCategory) => {
    setCategory(c);
    if (c === 'buysell') selectMode('transaction');
    else if (c === 'dividend') selectMode(isAdmin ? 'dividend-central' : 'dividend-manual');
    else if (c === 'fixed-income') selectMode('fixed-income');
    else selectMode('rate');
  };

  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition ${
      active ? 'bg-primary text-white' : 'bg-white text-foreground border border-border'
    }`;

  /** Bloco reutilizável de upload/preview de CSV, comum a todas as importações. */
  const csvFileFields = (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">Arquivo CSV</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleCsvFileChange}
          className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:opacity-90"
        />
      </div>

      {csvContent && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Pré-visualização ({csvContent.split(/\r?\n/).filter((l) => l.trim()).length} linhas)
          </label>
          <textarea
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            rows={6}
            className="w-full px-4 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {csvResult?.errors && csvResult.errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
          <strong>Avisos:</strong>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            {csvResult.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  const tickerInput = (
    <>
      <input
        type="text"
        list="ticker-list"
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        required
        placeholder="Ex: PETR4, AAPL"
        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
        readOnly={!!initialTicker}
      />
      <datalist id="ticker-list">
        {knownTickers.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </>
  );

  return (
    <main className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <h1 className="text-xl font-bold text-foreground mb-6">
        {initialTicker ? `Nova Movimentação — ${initialTicker}` : 'Nova Movimentação'}
      </h1>
      {/* Category Tabs */}
      <div className="flex overflow-x-auto gap-2 mb-4 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
        <button onClick={() => selectCategory('buysell')} className={`${tabClass(category === 'buysell')} whitespace-nowrap shrink-0`}>
          Compra / Venda
        </button>
        <button onClick={() => selectCategory('dividend')} className={`${tabClass(category === 'dividend')} whitespace-nowrap shrink-0`}>
          Dividendo
        </button>
        <button onClick={() => selectCategory('fixed-income')} className={`${tabClass(category === 'fixed-income')} whitespace-nowrap shrink-0`}>
          Renda Fixa
        </button>
        {isAdmin && (
          <button onClick={() => selectCategory('rate')} className={`${tabClass(category === 'rate')} whitespace-nowrap shrink-0`}>
            Taxas (Selic/IPCA)
          </button>
        )}
      </div>

      {/* Sub-mode Tabs */}
      <div className="flex overflow-x-auto gap-2 mb-6 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
        {category === 'buysell' && (
          <>
            <button onClick={() => selectMode('transaction')} className={`${tabClass(mode === 'transaction')} whitespace-nowrap shrink-0`}>
              Registrar
            </button>
            <button onClick={() => selectMode('import-csv')} className={`${tabClass(mode === 'import-csv')} whitespace-nowrap shrink-0`}>
              <span className="inline-flex items-center gap-1"><Upload size={14} /> Importar CSV</span>
            </button>
          </>
        )}
        {category === 'dividend' && (
          <>
            {isAdmin && (
              <button onClick={() => selectMode('dividend-central')} className={`${tabClass(mode === 'dividend-central')} whitespace-nowrap shrink-0`}>
                Dividendo (por cota)
              </button>
            )}
            <button onClick={() => selectMode('dividend-manual')} className={`${tabClass(mode === 'dividend-manual')} whitespace-nowrap shrink-0`}>
              Dividendo Manual
            </button>
            {isAdmin && (
              <button onClick={() => selectMode('import-dividends-csv')} className={`${tabClass(mode === 'import-dividends-csv')} whitespace-nowrap shrink-0`}>
                <span className="inline-flex items-center gap-1"><Upload size={14} /> Importar CSV</span>
              </button>
            )}
          </>
        )}
        {category === 'fixed-income' && (
          <>
            <button onClick={() => selectMode('fixed-income')} className={`${tabClass(mode === 'fixed-income')} whitespace-nowrap shrink-0`}>
              Registrar
            </button>
            <button onClick={() => selectMode('import-fixed-income-csv')} className={`${tabClass(mode === 'import-fixed-income-csv')} whitespace-nowrap shrink-0`}>
              <span className="inline-flex items-center gap-1"><Upload size={14} /> Importar CSV</span>
            </button>
          </>
        )}
        {category === 'rate' && isAdmin && (
          <>
            <button onClick={() => selectMode('rate')} className={`${tabClass(mode === 'rate')} whitespace-nowrap shrink-0`}>
              Registrar
            </button>
            <button onClick={() => selectMode('import-rates-csv')} className={`${tabClass(mode === 'import-rates-csv')} whitespace-nowrap shrink-0`}>
              <span className="inline-flex items-center gap-1"><Upload size={14} /> Importar CSV</span>
            </button>
          </>
        )}
      </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
            {success}
          </div>
        )}

        {mode === 'transaction' && (
          <form onSubmit={handleTransactionSubmit} className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ticker</label>
                {tickerInput}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'BUY' | 'SELL')}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="BUY">Compra</option>
                  <option value="SELL">Venda</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Quantidade</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  min="0"
                  step="1"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Preço Unitário (R$)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Taxas (R$)</label>
                <input
                  type="number"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Registrando...' : `Registrar ${type === 'BUY' ? 'Compra' : 'Venda'}`}
            </button>
          </form>
        )}

        {isAdmin && mode === 'dividend-central' && (
          <form onSubmit={handleDividendCentralSubmit} className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm mb-2">
              <strong>Dividendo por cota:</strong> Registre o valor por ação. Todos os usuários que tinham cotas na data-com receberão automaticamente.
              <br />
              <span className="text-xs">A data-ex é calculada automaticamente como data-com + 1 dia útil.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ticker</label>
                {tickerInput}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select
                  value={divType}
                  onChange={(e) => setDivType(e.target.value as 'DIVIDENDO' | 'JCP' | 'RENDIMENTO')}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="DIVIDENDO">Dividendo</option>
                  <option value="JCP">JCP</option>
                  <option value="RENDIMENTO">Rendimento</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Valor por Cota (R$)</label>
              <input
                type="number"
                value={divAmountPerShare}
                onChange={(e) => setDivAmountPerShare(e.target.value)}
                required
                min="0"
                step="0.00000001"
                placeholder="Ex: 0.50"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data Com (Record Date)</label>
                <input
                  type="date"
                  value={divComDate}
                  onChange={(e) => setDivComDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data Pagamento</label>
                <input
                  type="date"
                  value={divPaymentDate}
                  onChange={(e) => setDivPaymentDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Registrando...' : 'Registrar Dividendo por Cota'}
            </button>
          </form>
        )}

        {mode === 'dividend-manual' && (
          <form onSubmit={handleDividendManualSubmit} className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm mb-2">
              <strong>Dividendo manual:</strong> Registre um valor total recebido. Conta apenas para você.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ticker</label>
                {tickerInput}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as 'DIVIDENDO' | 'JCP' | 'RENDIMENTO')}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="DIVIDENDO">Dividendo</option>
                  <option value="JCP">JCP</option>
                  <option value="RENDIMENTO">Rendimento</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Valor Total Recebido (R$)</label>
              <input
                type="number"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                required
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data Com</label>
                <input
                  type="date"
                  value={manualComDate}
                  onChange={(e) => setManualComDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data Pagamento</label>
                <input
                  type="date"
                  value={manualPaymentDate}
                  onChange={(e) => setManualPaymentDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
              <input
                type="text"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Observações"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Registrando...' : 'Registrar Dividendo Manual'}
            </button>
          </form>
        )}

        {mode === 'import-csv' && (
          <form onSubmit={handleCsvImport} className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
              <strong>Formato do CSV:</strong> Ticker;Cotas;Operação(COMPRA/VENDA);Valor p/ Cota;Data
              <br />
              <span className="text-xs">Separador: ponto-e-vírgula (;). Decimais com ponto ou vírgula. Data no formato AAAA-MM-DD.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={downloadTemplate}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-muted text-foreground border border-border hover:bg-gray-100 transition"
              >
                <Download size={14} /> Baixar modelo CSV
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Arquivo CSV</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleCsvFileChange}
                className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:opacity-90"
              />
            </div>

            {csvContent && (
              <div>
                <label className="block text-sm font-medium mb-1">Pré-visualização ({csvContent.split(/\r?\n/).filter(l => l.trim()).length} linhas)</label>
                <textarea
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            {csvResult?.errors && csvResult.errors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
                <strong>Avisos:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {csvResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !csvContent.trim()}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Importando...' : 'Importar Movimentações'}
            </button>
          </form>
        )}

        {isAdmin && mode === 'import-dividends-csv' && (
          <form onSubmit={handleDividendCsvImport} className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
              <strong>Formato do CSV:</strong> Ticker;Data-com;Data-pagamento;Tipo;Valor
              <br />
              <span className="text-xs">Separador: ponto-e-vírgula (;). Tipo: DIVIDENDO, JCP ou RENDIMENTO. Data no formato AAAA-MM-DD.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={downloadDividendTemplate}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-muted text-foreground border border-border hover:bg-gray-100 transition"
              >
                <Download size={14} /> Baixar modelo CSV (Dividendos)
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Arquivo CSV</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleCsvFileChange}
                className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:opacity-90"
              />
            </div>

            {csvContent && (
              <div>
                <label className="block text-sm font-medium mb-1">Pré-visualização ({csvContent.split(/\r?\n/).filter(l => l.trim()).length} linhas)</label>
                <textarea
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            {csvResult?.errors && csvResult.errors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
                <strong>Avisos:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {csvResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !csvContent.trim()}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Importando...' : 'Importar Dividendos'}
            </button>
          </form>
        )}

        {mode === 'fixed-income' && (
          <form onSubmit={handleFixedIncomeSubmit} className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
              <strong>Renda fixa:</strong> registre o investimento e o primeiro aporte. Novos aportes do
              mesmo papel podem ser adicionados depois na página de Renda Fixa.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input
                  type="text"
                  value={fiName}
                  onChange={(e) => setFiName(e.target.value)}
                  required
                  maxLength={120}
                  placeholder="Ex: CDB Banco X 110% CDI"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de investimento</label>
                <select
                  value={fiInvestmentType}
                  onChange={(e) => setFiInvestmentType(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {INVESTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Indexador</label>
                <select
                  value={fiYieldType}
                  onChange={(e) => setFiYieldType(e.target.value as 'PRE' | 'CDI' | 'SELIC' | 'IPCA')}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(YIELD_TYPES).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{YIELD_TYPES[fiYieldType].rateLabel}</label>
                <input
                  type="number"
                  value={fiRate}
                  onChange={(e) => setFiRate(e.target.value)}
                  required
                  min="0"
                  step="0.0001"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">{YIELD_TYPES[fiYieldType].hint}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valor do aporte (R$)</label>
                <input
                  type="number"
                  value={fiAmount}
                  onChange={(e) => setFiAmount(e.target.value)}
                  required
                  min="0.01"
                  step="0.01"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data do aporte</label>
                <input
                  type="date"
                  value={fiPurchaseDate}
                  onChange={(e) => setFiPurchaseDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vencimento</label>
                <input
                  type="date"
                  value={fiMaturityDate}
                  onChange={(e) => setFiMaturityDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fiTaxExempt}
                onChange={(e) => setFiTaxExempt(e.target.checked)}
                className="rounded border-border"
              />
              Isento de Imposto de Renda (LCI, LCA, CRI, CRA, poupança)
            </label>

            <div>
              <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
              <input
                type="text"
                value={fiNotes}
                onChange={(e) => setFiNotes(e.target.value)}
                placeholder="Observações"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Registrando...' : 'Registrar Renda Fixa'}
            </button>
          </form>
        )}

        {mode === 'import-fixed-income-csv' && (
          <form onSubmit={handleFixedIncomeCsvImport} className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
              <strong>Formato do CSV:</strong> Nome;Tipo;Indexador;Taxa;Valor;Data-aporte;Vencimento;Isento
              <br />
              <span className="text-xs">
                Indexador: PRE, CDI, SELIC ou IPCA. Isento: SIM/NAO. Linhas com o mesmo Nome e
                Vencimento viram aportes do mesmo investimento. Datas no formato AAAA-MM-DD.
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={downloadFixedIncomeTemplate}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-muted text-foreground border border-border hover:bg-gray-100 transition"
              >
                <Download size={14} /> Baixar modelo CSV (Renda Fixa)
              </button>
            </div>

            {csvFileFields}

            <button
              type="submit"
              disabled={loading || !csvContent.trim()}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Importando...' : 'Importar Renda Fixa'}
            </button>
          </form>
        )}

        {isAdmin && mode === 'rate' && (
          <form onSubmit={handleRateSubmit} className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
              <strong>Selic:</strong> percentual <em>ao ano</em> definido pelo Copom, válido a partir da data informada.
              <br />
              <strong>IPCA:</strong> a variação <em>do mês</em> divulgada pelo IBGE (ex.: 0,16). Aceita
              valores negativos em meses de deflação. Use o dia 1º do mês de referência como data de início.
              <br />
              <span className="text-xs">O CDI não é cadastrado: é sempre derivado da Selic (Selic - 0,10 p.p.).</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Índice</label>
                <select
                  value={rateType}
                  onChange={(e) => setRateType(e.target.value as 'SELIC' | 'IPCA')}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="SELIC">Selic (% ao ano)</option>
                  <option value="IPCA">IPCA (variação do mês)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {rateType === 'SELIC' ? 'Taxa (% a.a.)' : 'Variação do mês (%)'}
                </label>
                <input
                  type="number"
                  value={rateValue}
                  onChange={(e) => setRateValue(e.target.value)}
                  required
                  step="0.01"
                  min={rateType === 'SELIC' ? '0' : '-20'}
                  max={rateType === 'SELIC' ? '100' : '20'}
                  placeholder={rateType === 'SELIC' ? 'Ex: 13.25' : 'Ex: 0.16 (ou -0.02)'}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {rateType === 'SELIC' ? 'Vigente a partir de' : 'Mês de referência (use o dia 1º)'}
                </label>
                <input
                  type="date"
                  value={rateStartDate}
                  onChange={(e) => setRateStartDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
                <input
                  type="text"
                  value={rateNotes}
                  onChange={(e) => setRateNotes(e.target.value)}
                  placeholder="Ex: Copom jan/25"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Registrando...' : `Registrar ${rateType}`}
            </button>
          </form>
        )}

        {isAdmin && mode === 'import-rates-csv' && (
          <form onSubmit={handleRatesCsvImport} className="bg-white rounded-xl shadow-sm border border-border p-4 sm:p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
              <strong>Formato do CSV:</strong> Tipo;Data-inicio;Taxa;Observacao
              <br />
              <span className="text-xs">
                Tipo: SELIC (% ao ano) ou IPCA (variação do mês, aceita negativo). Datas no formato
                AAAA-MM-DD. Taxas já cadastradas para o mesmo tipo e data são atualizadas.
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={downloadRatesTemplate}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-muted text-foreground border border-border hover:bg-gray-100 transition"
              >
                <Download size={14} /> Baixar modelo CSV (Taxas)
              </button>
            </div>

            {csvFileFields}

            <button
              type="submit"
              disabled={loading || !csvContent.trim()}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Importando...' : 'Importar Taxas'}
            </button>
          </form>
        )}
      </main>
    );
  }
