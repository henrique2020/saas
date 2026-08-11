import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { Transaction } from '../types';

export function useTransactions(stockId?: number) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = stockId ? `/transactions?stockId=${stockId}` : '/transactions';
      const response = await api.get<Transaction[]>(url);
      setTransactions(response.data);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError(err.response?.data?.error || 'Erro ao carregar movimentações');
    } finally {
      setLoading(false);
    }
  }, [stockId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const deleteTransaction = async (id: string) => {
    await api.delete(`/transactions/${id}`);
    await fetchTransactions();
  };

  return { transactions, loading, error, refresh: fetchTransactions, deleteTransaction };
}
