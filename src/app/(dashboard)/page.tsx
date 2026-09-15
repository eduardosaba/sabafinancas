'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
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
  CreditCard,
} from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';
import { useDateFilter } from '@/contexts/date-filter-context';
import { QuickTransactionInput } from '@/components/transactions/quick-input';
import { CashFlowChart } from '@/components/dashboard/cash-flow-chart';
import { CategoryExpenseChart } from '@/components/dashboard/category-expense-chart';
import { BudgetTracker } from '@/components/dashboard/budget-tracker';
import { CurrencyInput } from '@/components/ui/currency-input';
import { InvoiceCloseModal } from '@/components/transactions/invoice-close-modal';
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
  payCreditCardInvoice,
} from '@/lib/services/finance-service';
import { calculateCreditCardMetrics } from '@/lib/utils/credit-card';
import { ensureDatabaseSeeded, seedDefaultAccounts } from '@/lib/supabase/seed';
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

  // Credit Card invoice modal state
  const [payingCardAccount, setPayingCardAccount] = useState<Account | null>(null);
  const [closingInvoiceCardAccount, setClosingInvoiceCardAccount] = useState<Account | null>(null);
  const [payInvoiceAmount, setPayInvoiceAmount] = useState<string>('0');
  const [payInvoiceSourceAccId, setPayInvoiceSourceAccId] = useState<string>('');
  const [payInvoiceDate, setPayInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmittingPayInvoice, setIsSubmittingPayInvoice] = useState<boolean>(false);

  const handlePayInvoiceSubmit = async () => {
    if (!payingCardAccount || !payInvoiceSourceAccId) return;
    const amount = parseFloat(payInvoiceAmount) || 0;
    if (amount <= 0) {
      toast.warning('Por favor, informe um valor maior que zero.', 'Valor Inválido');
      return;
    }

    setIsSubmittingPayInvoice(true);
    try {
      await payCreditCardInvoice(payingCardAccount.id, payInvoiceSourceAccId, amount, payInvoiceDate);
      toast.success(
        `Fatura de ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} paga com sucesso! Saldo e limite atualizados.`,
        'Fatura Quitada'
      );
      setPayingCardAccount(null);
      window.dispatchEvent(new CustomEvent('transactionUpdated'));
      await loadData();
    } catch (err: any) {
      console.error('Error paying credit card invoice:', err);
      toast.error(`Erro ao pagar fatura: ${err?.message || 'Falha na gravação'}`);
    } finally {
      setIsSubmittingPayInvoice(false);
    }
  };

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
      window.dispatchEvent(new CustomEvent('transactionUpdated'));
      await loadData();
    }
  };

  useEffect(() => {
    if (isHydrated) {
      loadData();
    }
  }, [isHydrated, loadData]);

  useEffect(() => {
    const handleRefresh = () => loadData();
    window.addEventListener('transactionUpdated', handleRefresh);
    return () => window.removeEventListener('transactionUpdated', handleRefresh);
  }, [loadData]);

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
        newTxData.entityId === 'PJ' || newTxData.entityId === '22222222-2222-2222-2222-222222222222'
          ? '22222222-2222-2222-2222-222222222222'
          : '11111111-1111-1111-1111-111111111111';

      const created = await createTransaction({
        entityId: targetEntityId,
        accountId: newTxData.accountId,
        destinationAccountId: newTxData.destinationAccountId || null,
        categoryId: newTxData.categoryId || null,
        debtInstallmentId: newTxData.debtInstallmentId || null,
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
        <div className="p-4 rounded-2xl bg-amber-950/80 border border-amber-500/60 text-amber-200 text-xs font-semibold flex items-center justify-between shadow-xl flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-amber-100">Nenhuma Conta Cadastrada no Supabase</div>
              <div>Não há contas bancárias ou cartões de crédito cadastrados no banco de dados. Acesse Configurações &gt; Contas para cadastrar suas contas reais.</div>
            </div>
          </div>
          <Link
            href="/settings/accounts"
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs transition-colors shadow flex items-center gap-1.5"
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Cadastrar Minha Primeira Conta</span>
          </Link>
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
              <span className={cn('h-2 w-2 rounded-full', entity === 'PF' ? 'bg-emerald-400' : entity === 'PJ' ? 'bg-blue-400' : 'bg-indigo-400')} />
              <span className={config.textColor}>{config.badge}</span>
              {isSeeded && (
                <span className="ml-1 text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <Database className="h-3 w-3" /> Banco de Dados Conectado
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              {entity === 'PF' && <User className="h-8 w-8 text-emerald-400" />}
              {entity === 'PJ' && <Building2 className="h-8 w-8 text-blue-400" />}
              {entity === 'CONSOLIDATED' && <BarChart3 className="h-8 w-8 text-indigo-400" />}
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
                'px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border',
                entity === 'CONSOLIDATED'
                  ? 'bg-zinc-800 text-zinc-100 border-zinc-700 shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border-transparent'
              )}
            >
              <BarChart3 className="h-3.5 w-3.5 text-indigo-400" />
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
            Lançamento Rápido
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

      {/* GESTÃO DE CARTÕES DE CRÉDITO E FATURAS */}
      {accounts.some((a) => a.accountType === 'CREDIT_CARD') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-400" />
              Gestão de Cartões de Crédito e Faturas
            </h2>

            <Link
              href="/cards"
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-950/60 hover:bg-blue-900/60 px-3 py-1.5 rounded-xl border border-blue-500/30 transition-all shadow-sm"
            >
              <span>Ver Painel Completo de Cartões</span>
              <span>&rarr;</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {accounts
              .filter((a) => a.accountType === 'CREDIT_CARD')
              .map((acc) => {
                const cardMetrics = calculateCreditCardMetrics(acc, transactions);
                const checkingAccounts = accounts.filter((a) => a.accountType !== 'CREDIT_CARD');

                return (
                  <div key={acc.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.colorHex || '#3b82f6' }} />
                        <h3 className="text-sm font-bold text-slate-100">{acc.name}</h3>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        Fechamento dia {acc.closingDay || 25} | Vencimento dia {acc.dueDay || 5}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                        <span className="text-[10px] text-amber-400 font-bold uppercase block">Fatura Aberta</span>
                        <div className="text-sm sm:text-base font-extrabold font-mono text-slate-100">
                          {cardMetrics.openStatementTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono">Vence {cardMetrics.currentStatementDueDate}</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                        <span className="text-[10px] text-blue-400 font-bold uppercase block">Faturas Futuras</span>
                        <div className="text-sm sm:text-base font-extrabold font-mono text-slate-100">
                          {cardMetrics.futureStatementsTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className="text-[9px] text-slate-500">Parcelas futuras</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase block">Limite Disponível</span>
                        <div className="text-sm sm:text-base font-extrabold font-mono text-emerald-400">
                          {cardMetrics.availableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className="text-[9px] text-slate-500">Total: {cardMetrics.creditLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                      </div>
                    </div>

                    {/* Limit Usage Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Limite Comprometido</span>
                        <span>{cardMetrics.limitUsagePercentage}% ({cardMetrics.totalUsedCredit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                        <div
                          className={cn(
                            'h-full transition-all duration-500',
                            cardMetrics.limitUsagePercentage > 85 ? 'bg-rose-500' : cardMetrics.limitUsagePercentage > 60 ? 'bg-amber-500' : 'bg-blue-500'
                          )}
                          style={{ width: `${cardMetrics.limitUsagePercentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setClosingInvoiceCardAccount(acc)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 border border-slate-700"
                      >
                        <ShieldCheck className="h-4 w-4 text-blue-400" />
                        <span>[ Gerenciar / Fechar Fatura ]</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPayingCardAccount(acc);
                          setPayInvoiceAmount(cardMetrics.openStatementTotal.toString());
                          if (checkingAccounts.length > 0) setPayInvoiceSourceAccId(checkingAccounts[0].id);
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                      >
                        <Receipt className="h-4 w-4" />
                        <span>Pagar Fatura Direta</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Invoice Close Modal */}
      {closingInvoiceCardAccount && (
        <InvoiceCloseModal
          isOpen={!!closingInvoiceCardAccount}
          onClose={() => setClosingInvoiceCardAccount(null)}
          account={closingInvoiceCardAccount}
          onSuccess={loadData}
        />
      )}

      {/* Pay Credit Card Invoice Modal */}
      {payingCardAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-400" />
              Liquidação de Fatura — {payingCardAccount.name}
            </h3>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <div className="text-slate-400">Origem: <strong className="text-slate-200">Conta Corrente Bancária</strong></div>
              <div className="text-slate-400">Destino: <strong className="text-blue-400">{payingCardAccount.name}</strong></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Selecione a Conta Corrente para Débito
              </label>
              <select
                value={payInvoiceSourceAccId}
                onChange={(e) => setPayInvoiceSourceAccId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-medium focus:outline-none focus:border-blue-500"
              >
                {accounts
                  .filter((a) => a.accountType !== 'CREDIT_CARD')
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Saldo: {acc.currentBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Valor do Pagamento da Fatura (R$)
              </label>
              <CurrencyInput
                value={payInvoiceAmount}
                onChangeValue={(num) => setPayInvoiceAmount(num.toString())}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-blue-400" />
                Data do Pagamento
              </label>
              <input
                type="date"
                required
                value={payInvoiceDate}
                onChange={(e) => setPayInvoiceDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-medium focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPayingCardAccount(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePayInvoiceSubmit}
                disabled={isSubmittingPayInvoice}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-md"
              >
                {isSubmittingPayInvoice ? 'Processando...' : 'Confirmar Pagamento da Fatura'}
              </button>
            </div>
          </div>
        </div>
      )}

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
