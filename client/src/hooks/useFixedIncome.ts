import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { FixedIncome, FixedIncomeSummary } from '../types';

export function useFixedIncome() {
  const [items, setItems] = useState<FixedIncome[]>([]);
  const [summary, setSummary] = useState<FixedIncomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{ items: FixedIncome[]; summary: FixedIncomeSummary }>('/fixed-income');
      setItems(response.data.items);
      setSummary(response.data.summary);
    } catch (err: any) {
      console.error('Error fetching fixed income:', err);
      setError(err.response?.data?.error || 'Erro ao carregar renda fixa');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const deleteInvestment = async (id: string) => {
    await api.delete(`/fixed-income/${id}`);
    await fetchData();
  };

  return { items, summary, loading, error, refresh: fetchData, deleteInvestment };
}
