import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '../services/api';
import type { Transaction } from '../types';

export function useTransactions(stockId?: number) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      const url = stockId ? `/transactions?stockId=${stockId}` : '/transactions';
      const response = await api.get<Transaction[]>(url);
      setTransactions(response.data);
      setError(null);
    } catch (err: unknown) {
      console.error('Error fetching transactions:', err);
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao carregar movimentações';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [stockId]);

  useEffect(() => {
    let isMounted = true;
    const url = stockId ? `/transactions?stockId=${stockId}` : '/transactions';
    api.get<Transaction[]>(url)
      .then((res) => {
        if (isMounted) {
          setTransactions(res.data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const message = axios.isAxiosError(err) && err.response?.data?.error
            ? (err.response.data.error as string)
            : 'Erro ao carregar movimentações';
          setError(message);
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, [stockId]);

  const deleteTransaction = async (id: string) => {
    await api.delete(`/transactions/${id}`);
    await fetchTransactions();
  };

  return { transactions, loading, error, refresh: fetchTransactions, deleteTransaction };
}
