import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '../services/api';
import type { DashboardSummary } from '../types';

export function useDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await api.get<DashboardSummary>('/dashboard/summary');
      setSummary(response.data);
      setError(null);
    } catch (err: unknown) {
      console.error('Error fetching dashboard summary:', err);
      const message = axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : 'Erro ao carregar dados do dashboard';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    api.get<DashboardSummary>('/dashboard/summary')
      .then((res) => {
        if (isMounted) {
          setSummary(res.data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const message = axios.isAxiosError(err) && err.response?.data?.error
            ? (err.response.data.error as string)
            : 'Erro ao carregar dados do dashboard';
          setError(message);
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, []);

  return { summary, loading, error, refresh: fetchDashboard };
}
