import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import axios from 'axios';
import api from '../services/api';

interface AuditLogEntry {
  id: number;
  userId: number;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
  user: { id: number; name: string; email: string } | null;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Logs de Auditoria';
    let isMounted = true;
    api.get(`/audit-logs?page=${page}&limit=30`)
      .then(({ data }) => {
        if (isMounted) {
          setLogs(data.logs);
          setTotal(data.total);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const message = axios.isAxiosError(err) && err.response?.data?.error
            ? (err.response.data.error as string)
            : 'Erro ao carregar logs';
          setError(message);
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, [page]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR');
  };

  const totalPages = Math.ceil(total / 30);

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="flex items-center gap-2 mb-6">
        <Shield size={20} className="text-primary" />
        <h1 className="text-xl font-bold text-foreground">Logs de Auditoria</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">{error}</div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-border">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm text-muted-foreground">{total} registros</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-sm border border-border rounded disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-sm py-1">{page}/{totalPages || 1}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-sm border border-border rounded disabled:opacity-40"
              >
                Próximo
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum log encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Data</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Usuário</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Ação</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Entidade</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">ID</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Detalhes</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-border hover:bg-muted transition">
                      <td className="px-4 py-2 text-xs whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-2 text-xs whitespace-nowrap">{log.user?.name || log.userId}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                          log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs whitespace-nowrap">{log.entity}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{log.entityId || '-'}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{log.details || '-'}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{log.ip || '-'}</td>
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
