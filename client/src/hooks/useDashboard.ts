import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { DashboardSummary } from '../types';

export function useDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<DashboardSummary>('/dashboard/summary');
      setSummary(response.data);
    } catch (err: any) {
      console.error('Error fetching dashboard summary:', err);
      setError(err.response?.data?.error || 'Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { summary, loading, error, refresh: fetchDashboard };
}
