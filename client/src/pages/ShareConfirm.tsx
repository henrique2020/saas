import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

export default function ShareConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/shares/confirm', { token, code });
      navigate(`/shared/${data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao confirmar compartilhamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-border p-6">
        <h1 className="text-xl font-bold text-foreground mb-2">Confirmar compartilhamento</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Informe o código de 6 dígitos/letras para liberar o acesso.
        </p>

        {!token && (
          <div className="text-red-600 text-sm mb-4">Link inválido: token ausente.</div>
        )}

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Código de confirmação</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring uppercase"
              placeholder="X9A4H3"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Confirmando...' : 'Confirmar acesso'}
          </button>
        </form>

        <div className="mt-4 text-sm">
          <Link to="/" className="text-primary hover:underline">Voltar para Home</Link>
        </div>
      </div>
    </div>
  );
}
