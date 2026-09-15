'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  X,
  Calendar,
  Wallet,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Search,
  ExternalLink,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  Building2,
  User,
  CreditCard,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { Account, Category, Transaction, TransactionType, AccountType } from '@/types/finance';
import { fetchTransactions, createTransaction } from '@/lib/services/finance-service';
import { CurrencyInput } from '@/components/ui/currency-input';
import { TransactionModal } from '@/components/transactions/transaction-modal';
import { cn } from '@/lib/utils';

export type StatementPeriodOption = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30_DAYS' | 'THIS_YEAR' | 'ALL' | 'CUSTOM';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: 'Conta Corrente',
  CREDIT_CARD: 'Cartão de Crédito',
  INVESTMENT: 'Investimento',
  CASH: 'Carteira / Dinheiro',
};

interface AccountStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  allAccounts: Account[];
  categories: Category[];
}

export function AccountStatementModal({
  isOpen,
  onClose,
  account,
  allAccounts,
  categories,
}: AccountStatementModalProps) {
  const [period, setPeriod] = useState<StatementPeriodOption>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE' | 'TRANSFER'>('ALL');

  const [rawTransactions, setRawTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // New Transaction Modal for this account
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState<boolean>(false);

  // Helper to calculate period date limits
  const computePeriodDates = useCallback((opt: StatementPeriodOption) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (opt === 'THIS_MONTH') {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    } else if (opt === 'LAST_MONTH') {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    } else if (opt === 'LAST_30_DAYS') {
      const start = new Date();
      start.setDate(now.getDate() - 30);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (opt === 'THIS_YEAR') {
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    } else if (opt === 'ALL') {
      setStartDate('');
      setEndDate('');
    }
  }, []);

  useEffect(() => {
    if (period !== 'CUSTOM') {
      computePeriodDates(period);
    }
  }, [period, computePeriodDates]);

  // Load account transactions
  const loadAccountTransactions = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);
    try {
      const txs = await fetchTransactions({
        entityType: 'CONSOLIDATED',
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setRawTransactions(txs);
    } catch (err) {
      console.error('Error fetching account statement transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [account, startDate, endDate]);

  useEffect(() => {
    if (isOpen && account) {
      loadAccountTransactions();
    }
  }, [isOpen, account, loadAccountTransactions]);

  // Filter transactions specifically linked to this account (source or destination)
  const accountTransactions = useMemo(() => {
    if (!account) return [];

    return rawTransactions.filter((tx) => {
      const isSource = tx.accountId === account.id;
      const isDestination = tx.destinationAccountId === account.id;

      if (!isSource && !isDestination) return false;

      // Type filter
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'INCOME' && tx.type !== 'INCOME' && !(tx.type === 'TRANSFER' && isDestination)) {
          return false;
        }
        if (typeFilter === 'EXPENSE' && tx.type !== 'EXPENSE' && !(tx.type === 'TRANSFER' && isSource)) {
          return false;
        }
        if (typeFilter === 'TRANSFER' && tx.type !== 'TRANSFER') {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cat = categories.find((c) => c.id === tx.categoryId);
        const matchDesc = tx.description.toLowerCase().includes(q);
        const matchCat = cat?.name.toLowerCase().includes(q);
        const matchAmount = tx.amount.toString().includes(q);
        if (!matchDesc && !matchCat && !matchAmount) return false;
      }

      return true;
    });
  }, [account, rawTransactions, typeFilter, searchQuery, categories]);

  // Summary Metrics (Entradas vs Saídas vs Resultado)
  const metrics = useMemo(() => {
    if (!account) return { totalIn: 0, totalOut: 0, net: 0, count: 0 };

    let totalIn = 0;
    let totalOut = 0;

    accountTransactions.forEach((tx) => {
      const isSource = tx.accountId === account.id;
      const isDestination = tx.destinationAccountId === account.id;

      if (tx.type === 'INCOME') {
        totalIn += tx.amount;
      } else if (tx.type === 'EXPENSE') {
        totalOut += tx.amount;
      } else if (tx.type === 'TRANSFER') {
        if (isDestination) {
          totalIn += tx.amount;
        } else if (isSource) {
          totalOut += tx.amount;
        }
      }
    });

    return {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      count: accountTransactions.length,
    };
  }, [account, accountTransactions]);

  if (!isOpen || !account) return null;

  const isPJ = account.entityId !== '11111111-1111-1111-1111-111111111111' && account.entityId !== 'PF';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header Bar */}
        <div className="flex items-center justify-between p-4 px-6 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl border bg-slate-900 flex-shrink-0"
              style={{ borderColor: account.colorHex || '#3b82f6' }}
            >
              {account.accountType === 'CREDIT_CARD' ? (
                <CreditCard className="h-6 w-6 text-purple-400" />
              ) : (
                <Wallet className="h-6 w-6 text-emerald-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-100">{account.name}</h2>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-extrabold border uppercase tracking-wider',
                    isPJ
                      ? 'bg-blue-950/80 text-blue-400 border-blue-800/60'
                      : 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                  )}
                >
                  {isPJ ? 'PJ' : 'PF'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {ACCOUNT_TYPE_LABELS[account.accountType as AccountType] || account.accountType}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Extrato detalhado de lançamentos e fluxo de caixa da conta
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAccountTransactions}
              title="Recarregar Extrato"
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Top Banner KPI Card */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Balance Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                {account.accountType === 'CREDIT_CARD' ? 'Fatura Atual' : 'Saldo da Conta'}
              </span>
              <div className={cn('text-xl font-extrabold font-mono', account.accountType === 'CREDIT_CARD' ? 'text-purple-300' : 'text-slate-100')}>
                {account.currentBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>

            {/* Total In (Entradas) */}
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
              <span className="text-[11px] font-semibold text-emerald-400 block uppercase tracking-wider flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5" /> Entradas (Período)
              </span>
              <div className="text-xl font-extrabold font-mono text-emerald-300">
                + {metrics.totalIn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>

            {/* Total Out (Saídas) */}
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 space-y-1">
              <span className="text-[11px] font-semibold text-rose-400 block uppercase tracking-wider flex items-center gap-1">
                <ArrowDownRight className="h-3.5 w-3.5" /> Saídas (Período)
              </span>
              <div className="text-xl font-extrabold font-mono text-rose-300">
                - {metrics.totalOut.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>

            {/* Net Period Balance */}
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-1">
              <span className="text-[11px] font-semibold text-indigo-400 block uppercase tracking-wider">
                Resultado do Período
              </span>
              <div className={cn('text-xl font-extrabold font-mono', metrics.net >= 0 ? 'text-indigo-300' : 'text-rose-300')}>
                {metrics.net >= 0 ? '+' : ''}
                {metrics.net.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </div>

          {/* Period Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Quick Period Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <button
                  type="button"
                  onClick={() => setPeriod('THIS_MONTH')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0',
                    period === 'THIS_MONTH'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                  )}
                >
                  Este Mês
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('LAST_MONTH')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0',
                    period === 'LAST_MONTH'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                  )}
                >
                  Mês Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('LAST_30_DAYS')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0',
                    period === 'LAST_30_DAYS'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                  )}
                >
                  Últimos 30 Dias
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('THIS_YEAR')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0',
                    period === 'THIS_YEAR'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                  )}
                >
                  Este Ano
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('ALL')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0',
                    period === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                  )}
                >
                  Todos
                </button>
              </div>

              {/* Type Filter (All, Income, Expense, Transfer) */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setTypeFilter('ALL')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all',
                    typeFilter === 'ALL' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('INCOME')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all',
                    typeFilter === 'INCOME' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-emerald-400'
                  )}
                >
                  Entradas
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('EXPENSE')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all',
                    typeFilter === 'EXPENSE' ? 'bg-rose-950 text-rose-300 border border-rose-500/40' : 'text-slate-400 hover:text-rose-400'
                  )}
                >
                  Saídas
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('TRANSFER')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all',
                    typeFilter === 'TRANSFER' ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-indigo-400'
                  )}
                >
                  Transf.
                </button>
              </div>
            </div>

            {/* Custom Date Pickers & Search Query */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-900 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">De:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setPeriod('CUSTOM');
                    setStartDate(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">Até:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setPeriod('CUSTOM');
                    setEndDate(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar lançamento..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-500 font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Statement Transactions Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
              <span>Lançamentos ({accountTransactions.length})</span>
              <span>{period === 'ALL' ? 'Período Completo' : `${startDate || 'Início'} a ${endDate || 'Hoje'}`}</span>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2 bg-slate-950 rounded-2xl border border-slate-800">
                <Clock className="h-4 w-4 animate-spin text-emerald-400" />
                <span>Carregando extrato da conta...</span>
              </div>
            ) : accountTransactions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2 bg-slate-950 rounded-2xl border border-slate-800">
                <Receipt className="h-8 w-8 text-slate-600 mx-auto" />
                <p>Nenhum lançamento encontrado para esta conta no período selecionado.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden divide-y divide-slate-800/80">
                {accountTransactions.map((tx) => {
                  const isSource = tx.accountId === account.id;
                  const isDestination = tx.destinationAccountId === account.id;
                  const isTransferIn = tx.type === 'TRANSFER' && isDestination;
                  const isTransferOut = tx.type === 'TRANSFER' && isSource;

                  const isPositive = tx.type === 'INCOME' || isTransferIn;
                  const category = categories.find((c) => c.id === tx.categoryId);

                  const otherAccId = isSource ? tx.destinationAccountId : tx.accountId;
                  const otherAcc = allAccounts.find((a) => a.id === otherAccId);

                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 px-4 flex items-center justify-between gap-3 hover:bg-slate-900/60 transition-colors text-xs"
                    >
                      {/* Left: Icon & Description */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={cn(
                            'p-2 rounded-xl border flex-shrink-0',
                            isPositive
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-950/60 text-rose-400 border-rose-500/30'
                          )}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100 truncate">{tx.description}</span>
                            {tx.type === 'TRANSFER' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800/50 flex-shrink-0">
                                Transf. {isTransferIn ? `de ${otherAcc?.name || 'outra conta'}` : `para ${otherAcc?.name || 'outra conta'}`}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{new Date(tx.transactionDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                            <span>•</span>
                            <span className="truncate">{category ? category.name : 'Geral'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Status & Amount */}
                      <div className="text-right flex-shrink-0 space-y-1">
                        <div
                          className={cn(
                            'text-sm font-extrabold font-mono',
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          )}
                        >
                          {isPositive ? '+' : '-'}
                          {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[10px]">
                          {tx.status === 'PAID' ? (
                            <span className="text-emerald-400 flex items-center gap-0.5 font-semibold">
                              <CheckCircle2 className="h-3 w-3" /> Liquidado
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-0.5 font-semibold">
                              <Clock className="h-3 w-3" /> Pendente
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 px-6 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsNewTxModalOpen(true)}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>+ Novo Lançamento</span>
            </button>

            <Link
              href={`/transactions?account=${account.id}`}
              onClick={onClose}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-slate-700"
            >
              <span>Abrir no Extrato Geral</span>
              <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
            </Link>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Fechar
          </button>
        </div>

      </div>

      {/* Transaction Modal for creating transaction pre-linked to this account */}
      {isNewTxModalOpen && (
        <TransactionModal
          isOpen={isNewTxModalOpen}
          onClose={() => setIsNewTxModalOpen(false)}
          accounts={allAccounts}
          categories={categories}
          defaultAccountId={account.id}
          onSuccess={() => {
            setIsNewTxModalOpen(false);
            loadAccountTransactions();
          }}
        />
      )}
    </div>
  );
}
