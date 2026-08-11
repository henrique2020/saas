import React from 'react';
import { DollarSign, TrendingUp, ShieldAlert, Award } from 'lucide-react';
import type { DashboardSummary } from '../types';

interface SummaryCardsProps {
  summary: DashboardSummary;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const totalPatrimony = summary.total?.currentValue ?? (summary.totalInvested + (summary.fixedIncome?.currentValue || 0));
  const totalInvested = summary.total?.invested ?? (summary.totalInvested + (summary.fixedIncome?.invested || 0));
  const unrealizedProfit = (summary.variableIncome?.unrealizedProfit || 0) + (summary.fixedIncome?.unrealizedProfit || 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-xs">
        <div className="flex items-center justify-between pb-2">
          <span className="text-sm font-medium text-muted-foreground">Patrimônio Total</span>
          <DollarSign className="w-5 h-5 text-primary" />
        </div>
        <div className="text-2xl font-bold">{formatCurrency(totalPatrimony)}</div>
        <p className="text-xs text-muted-foreground mt-1">
          Investido: {formatCurrency(totalInvested)}
        </p>
      </div>

      <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-xs">
        <div className="flex items-center justify-between pb-2">
          <span className="text-sm font-medium text-muted-foreground">Renda Variável</span>
          <TrendingUp className="w-5 h-5 text-blue-500" />
        </div>
        <div className="text-2xl font-bold">{formatCurrency(summary.variableIncome?.currentValue || 0)}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {summary.variableIncome?.positionsCount || summary.totalStocks} posições ativas
        </p>
      </div>

      <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-xs">
        <div className="flex items-center justify-between pb-2">
          <span className="text-sm font-medium text-muted-foreground">Renda Fixa</span>
          <ShieldAlert className="w-5 h-5 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold">{formatCurrency(summary.fixedIncome?.currentValue || 0)}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {summary.fixedIncome?.activeCount || 0} títulos ativos
        </p>
      </div>

      <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-xs">
        <div className="flex items-center justify-between pb-2">
          <span className="text-sm font-medium text-muted-foreground">Dividendos Acumulados</span>
          <Award className="w-5 h-5 text-amber-500" />
        </div>
        <div className="text-2xl font-bold text-amber-500">{formatCurrency(summary.totalDividends)}</div>
        <p className="text-xs text-muted-foreground mt-1">
          Lucro não realizado: {formatCurrency(unrealizedProfit)}
        </p>
      </div>
    </div>
  );
};
