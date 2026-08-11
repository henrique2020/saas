import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '../services/api';
import type { FixedIncome, FixedIncomeSummary } from '../types';

export function useFixedIncome() {
  const [items, setItems] = useState<FixedIncome[]>([]);
  const [summary, setSummary] = useState<FixedIncomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get<{ items: FixedIncome[]; summary: FixedIncomeSummary }>('/fixed-income');
      setItems(response.data.items);
      setSummary(response.data.summary);
      setError(null);
    } catch (err: unknown) {
      console.error('Error fetching fixed income:', err);
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao carregar renda fixa';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    api.get<{ items: FixedIncome[]; summary: FixedIncomeSummary }>('/fixed-income')
      .then((res) => {
        if (isMounted) {
          setItems(res.data.items);
          setSummary(res.data.summary);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const message = axios.isAxiosError(err) && err.response?.data?.error
            ? (err.response.data.error as string)
            : 'Erro ao carregar renda fixa';
          setError(message);
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, []);

  const deleteInvestment = async (id: string) => {
    await api.delete(`/fixed-income/${id}`);
    await fetchData();
  };

  return { items, summary, loading, error, refresh: fetchData, deleteInvestment };
}
