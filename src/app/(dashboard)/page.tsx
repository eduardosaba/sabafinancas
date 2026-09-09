'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  User,
  Building2,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ShieldCheck,
  Receipt,
  Clock,
  Database,
  RefreshCw,
  AlertTriangle,
  PieChart as PieIcon,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';
import { useDateFilter } from '@/contexts/date-filter-context';
import { QuickTransactionInput } from '@/components/transactions/quick-input';
import { CashFlowChart } from '@/components/dashboard/cash-flow-chart';
import { CategoryExpenseChart } from '@/components/dashboard/category-expense-chart';
import { BudgetTracker } from '@/components/dashboard/budget-tracker';
import {
  Account,
  Budget,
  Category,
  CategoryBreakdownItem,
  DailyCashFlowItem,
  Debt,
  Transaction,
} from '@/types/finance';
import {
  createTransaction,
  deleteTransaction,
  fetchAccounts,
  fetchBudgets,
  fetchCategories,
  fetchCategoryBreakdown,
  fetchCashFlowSeries,
  fetchDebts,
  fetchTransactions,
} from '@/lib/services/finance-service';
import { ensureDatabaseSeeded } from '@/lib/supabase/seed';
import { cn } from '@/lib/utils';

import { useToast } from '@/contexts/toast-context';

export default function DashboardPage() {
  const { entity, setEntity, config, isHydrated } = useEntity();
  const { filter, setPeriod } = useDateFilter();
  const { toast, confirm } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashFlowSeries, setCashFlowSeries] = useState<DailyCashFlowItem[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSeeded, setIsSeeded] = useState<boolean>(false);

  const currentMonthYear = useMemo(() => {
    return filter.startDate ? filter.startDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
  }, [filter.startDate]);

  // Load database seed and initial data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const seeded = await ensureDatabaseSeeded();
      setIsSeeded(seeded);

      const [accData, catData, txData, seriesData, breakdownData, budgetData, debtsData] =
        await Promise.all([
          fetchAccounts(entity),
          fetchCategories(entity),
          fetchTransactions({
            entityType: entity,
            startDate: filter.startDate,
            endDate: filter.endDate,
          }),
          fetchCashFlowSeries(entity, filter.startDate, filter.endDate),
          fetchCategoryBreakdown(entity, filter.startDate, filter.endDate),
          fetchBudgets(entity, currentMonthYear),
          fetchDebts(entity),
        ]);

      setAccounts(accData);
      setCategories(catData);
      setTransactions(txData);
      setCashFlowSeries(seriesData);
      setCategoryBreakdown(breakdownData);
      setBudgets(budgetData);
      setDebts(debtsData);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [entity, filter.startDate, filter.endDate, currentMonthYear]);

  const handleDeleteTransaction = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Lançamento',
      message: 'Deseja realmente excluir este lançamento financeiro?',
      confirmText: 'Excluir Lançamento',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed) {
      await deleteTransaction(id);
      toast.success('Lançamento excluído com sucesso.', 'Lançamento Excluído');
      await loadData();
    }
  };

  useEffect(() => {
    if (isHydrated) {
      loadData();
    }
  }, [isHydrated, loadData]);

  // Filter transactions dynamically for active Entity Context
  const filteredTransactions = useMemo(() => {
    const pfId = '11111111-1111-1111-1111-111111111111';
    const pjId = '22222222-2222-2222-2222-222222222222';
    const accountEntityMap = new Map(accounts.map((a) => [a.id, a.entityId]));

    return transactions.filter((tx) => {
      if (entity === 'CONSOLIDATED') return true;
      const sourceEnt = accountEntityMap.get(tx.accountId);
      const destEnt = tx.destinationAccountId ? accountEntityMap.get(tx.destinationAccountId) : null;

      if (entity === 'PF') {
        if (tx.entityId === 'PF' || tx.entityId === pfId) return true;
        if (sourceEnt === 'PF' || sourceEnt === pfId || destEnt === 'PF' || destEnt === pfId) return true;
      }
      if (entity === 'PJ') {
        if (tx.entityId === 'PJ' || tx.entityId === pjId) return true;
        if (sourceEnt === 'PJ' || sourceEnt === pjId || destEnt === 'PJ' || destEnt === pjId) return true;
      }
      return tx.entityId === entity;
    });
  }, [transactions, entity, accounts]);

  // Dynamic metrics for active entity and period
  const metrics = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.type === 'INCOME') income += tx.amount;
      if (tx.type === 'EXPENSE') expense += tx.amount;
    });

    const totalAvailableBalance = accounts.reduce((acc, curr) => acc + curr.currentBalance, 0);

    return {
      income,
      expense,
      net: income - expense,
      totalAvailableBalance,
    };
  }, [filteredTransactions, accounts]);

  // Preventive Cash Alert: Check if upcoming installments in 15 days exceed available balance
  const cashAlert = useMemo(() => {
    const today = new Date();
    const next15Days = new Date();
    next15Days.setDate(today.getDate() + 15);

    const todayStr = today.toISOString().split('T')[0];
    const next15Str = next15Days.toISOString().split('T')[0];

    let upcomingDueTotal = 0;
    debts.forEach((d) => {
      d.installments?.forEach((inst) => {
        if (inst.status === 'PENDING' && inst.dueDate >= todayStr && inst.dueDate <= next15Str) {
          upcomingDueTotal += inst.amount;
        }
      });
    });

    const isRisk = upcomingDueTotal > metrics.totalAvailableBalance;

    return {
      isRisk,
      upcomingDueTotal,
      availableBalance: metrics.totalAvailableBalance,
    };
  }, [debts, metrics.totalAvailableBalance]);

  const handleConfirmQuickTransaction = async (newTxData: Omit<Transaction, 'id' | 'createdAt'>) => {
    try {
      const targetEntityId =
        newTxData.entityId === 'PJ'
          ? '22222222-2222-2222-2222-222222222222'
          : '11111111-1111-1111-1111-111111111111';

      const created = await createTransaction({
        entityId: targetEntityId,
        accountId: newTxData.accountId,
        categoryId: newTxData.categoryId,
        type: newTxData.type,
        amount: newTxData.amount,
        transactionDate: newTxData.transactionDate,
        description: newTxData.description,
        status: newTxData.status,
      });

      // Update state in real-time
      setTransactions((prev) => [created, ...prev]);
      await loadData();
    } catch (err: any) {
      console.error('Failed to create transaction:', err);
      toast.error(`Falha ao gravar no Supabase: ${err?.message || 'Erro de conexão'}`, 'Erro Supabase');
      throw err;
    }
  };

  if (!isHydrated) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <Clock className="h-5 w-5 animate-spin text-emerald-400" />
          <span>Carregando contexto...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* No Accounts Warning Banner */}
      {!isLoading && accounts.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/80 border border-amber-500/60 text-amber-200 text-xs font-semibold flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-amber-100">Nenhuma Conta Carregada do Supabase</div>
              <div>Não há contas bancárias cadastradas no banco de dados. Acesse Configurações &gt; Contas para cadastrar sua primeira conta.</div>
            </div>
          </div>
        </div>
      )}

      {/* Preventive Cash Alert Banner */}
      {cashAlert.isRisk && (
        <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-semibold flex items-center justify-between shadow-xl animate-bounce">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-rose-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-rose-100">Alerta de Caixa Preventivo!</div>
              <div>
                Vencimentos nos próximos 15 dias ({cashAlert.upcomingDueTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) excedem o saldo bancário disponível ({cashAlert.availableBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Banner */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl p-6 sm:p-8 border transition-all duration-300 shadow-xl',
          config.bgColor,
          config.borderColor
        )}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-900/80 border border-slate-800">
              <span className={cn('h-2 w-2 rounded-full', entity === 'PF' ? 'bg-emerald-400' : entity === 'PJ' ? 'bg-blue-400' : 'bg-purple-400')} />
              <span className={config.textColor}>{config.badge}</span>
              {isSeeded && (
                <span className="ml-1 text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <Database className="h-3 w-3" /> Supabase Conectado
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              {entity === 'PF' && <User className="h-8 w-8 text-emerald-400" />}
              {entity === 'PJ' && <Building2 className="h-8 w-8 text-blue-400" />}
              {entity === 'CONSOLIDATED' && <BarChart3 className="h-8 w-8 text-purple-400" />}
              Painel Financeiro {config.shortLabel}
            </h1>

            <p className="text-sm text-slate-300 max-w-xl">
              {config.description}. Análise visual preventiva com gráficos Recharts e acompanhamento de orçamento e dívidas.
            </p>
          </div>

          {/* Quick Entity Switch */}
          <div className="flex items-center gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800">
            <button
              onClick={() => setEntity('PF')}
              className={cn(
                'px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                entity === 'PF' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'
              )}
            >
              <User className="h-3.5 w-3.5" />
              <span>PF</span>
            </button>
            <button
              onClick={() => setEntity('PJ')}
              className={cn(
                'px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                entity === 'PJ' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>PJ</span>
            </button>
            <button
              onClick={() => setEntity('CONSOLIDATED')}
              className={cn(
                'px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                entity === 'CONSOLIDATED' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Consolidado</span>
            </button>
          </div>
        </div>
      </div>

      {/* QUICK TRANSACTION INPUT COMPONENT */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Lançamento Rápido em Linguagem Natural (Zero Tokens & Supabase DB)
          </span>
          <button
            onClick={loadData}
            title="Recarregar Dados"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </button>
        </div>

        <QuickTransactionInput
          accounts={accounts}
          categories={categories}
          onConfirm={handleConfirmQuickTransaction}
        />
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Receitas */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {entity === 'PJ' ? 'Faturamento' : entity === 'PF' ? 'Rendimentos' : 'Entradas Totais'}
            </span>
            <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100">
            {metrics.income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <div className="mt-2 text-xs text-emerald-400 font-medium">
            {filteredTransactions.filter((t) => t.type === 'INCOME').length} entrada(s) no período
          </div>
        </div>

        {/* Despesas */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {entity === 'PJ' ? 'Custos Operacionais' : entity === 'PF' ? 'Despesas Pessoais' : 'Saídas Totais'}
            </span>
            <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-400">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100">
            {metrics.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <div className="mt-2 text-xs text-slate-400 font-medium">
            {filteredTransactions.filter((t) => t.type === 'EXPENSE').length} saída(s) no período
          </div>
        </div>

        {/* Saldo Líquido */}
        <div className={cn('p-5 rounded-2xl border shadow-md transition-colors', config.bgColor, config.borderColor)}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Resultado Líquido ({config.shortLabel})
            </span>
            <div className={cn('p-2 rounded-xl bg-slate-900 border border-slate-800', config.textColor)}>
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className={cn('text-2xl sm:text-3xl font-extrabold', config.textColor)}>
            {metrics.net.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <div className="mt-2 text-xs text-slate-300 font-medium flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{metrics.net >= 0 ? 'Resultado Positivo (Superávit)' : 'Resultado Negativo (Atenção)'}</span>
          </div>
        </div>

      </div>

      {/* FASE 4: VISUAL CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Cash Flow Timeline Chart */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold text-slate-100">Fluxo de Caixa Diário</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Linha Temporal</span>
          </div>

          <CashFlowChart data={cashFlowSeries} />
        </div>

        {/* Category Expense Donut Chart */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <PieIcon className="h-5 w-5 text-purple-400" />
              <h3 className="text-base font-bold text-slate-100">Divisão de Gastos por Categoria</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Participação (%)</span>
          </div>

          <CategoryExpenseChart data={categoryBreakdown} />
        </div>

      </div>

      {/* FASE 4: BUDGET TRACKER SECTION */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <BudgetTracker
          budgets={budgets}
          categories={categories}
          monthYear={currentMonthYear}
          onRefresh={loadData}
        />
      </div>

      {/* Real-time Transactions Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-slate-100">
              Lançamentos Recentes ({filteredTransactions.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Modo ativo: <strong className={config.textColor}>{config.label}</strong>
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 flex items-center justify-center text-slate-400 text-xs gap-2">
            <Clock className="h-4 w-4 animate-spin text-emerald-400" />
            <span>Buscando dados...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-3 bg-slate-950/40 rounded-xl border border-slate-800/80 p-6">
            <Receipt className="h-8 w-8 mx-auto text-slate-600" />
            <div>
              <p className="font-semibold text-slate-300">Nenhum lançamento no período selecionado</p>
              <p className="text-slate-500 text-[11px] mt-1">
                Utilize a barra rápida de lançamentos ou altere os filtros no topo da página.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Tipo</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Conta</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center rounded-r-lg">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTransactions.map((tx) => {
                  const account = accounts.find((a) => a.id === tx.accountId);
                  const category = categories.find((c) => c.id === tx.categoryId);
                  const isIncome = tx.type === 'INCOME';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-4 py-3 font-semibold">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
                            isIncome
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                          )}
                        >
                          {isIncome ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {isIncome ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-100">{tx.description}</td>
                      <td className="px-4 py-3 text-slate-400">{account?.name || 'Conta Bancária'}</td>
                      <td className="px-4 py-3 text-slate-400">{category?.name || 'Categoria'}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono">{tx.transactionDate}</td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-bold text-sm font-mono',
                          isIncome ? 'text-emerald-400' : 'text-slate-100'
                        )}
                      >
                        {isIncome ? '+' : '-'} {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteTransaction(tx.id)}
                          title="Excluir Lançamento"
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
