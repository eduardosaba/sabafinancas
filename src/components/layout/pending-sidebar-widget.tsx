'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, CreditCard } from 'lucide-react';
import { CreditCardInvoice, Transaction } from '@/types/finance';
import { fetchAccounts, fetchClosedInvoices, fetchTransactions, payCreditCardInvoice, updateTransaction } from '@/lib/services/finance-service';
import { useEntity } from '@/contexts/entity-context';
import { useToast } from '@/contexts/toast-context';
import { cn } from '@/lib/utils';

export function PendingPaymentsSidebarWidget() {
  const { entity } = useEntity();
  const { toast } = useToast();
  const [pendingTxs, setPendingTxs] = useState<Transaction[]>([]);
  const [closedInvoices, setClosedInvoices] = useState<CreditCardInvoice[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadPendingData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allTxs, accounts, invoices] = await Promise.all([
        fetchTransactions({ entityType: entity }),
        fetchAccounts(entity).catch(() => []),
        fetchClosedInvoices(entity).catch(() => []),
      ]);

      const cardAccountIds = new Set(
        accounts.filter((a) => a.accountType === 'CREDIT_CARD').map((a) => a.id)
      );

      // Rule 1: Exclude individual credit card transactions from pending items
      const pendingNonCard = allTxs.filter(
        (t) => t.status === 'PENDING' && !cardAccountIds.has(t.accountId)
      );

      setPendingTxs(pendingNonCard);
      setClosedInvoices(invoices);
    } catch (err) {
      console.error('Failed to load pending transactions/invoices in sidebar:', err);
    } finally {
      setIsLoading(false);
    }
  }, [entity]);

  useEffect(() => {
    loadPendingData();
  }, [loadPendingData]);

  useEffect(() => {
    const handleRefresh = () => loadPendingData();
    window.addEventListener('transactionUpdated', handleRefresh);
    return () => window.removeEventListener('transactionUpdated', handleRefresh);
  }, [loadPendingData]);

  const handleMarkAsPaid = async (tx: Transaction) => {
    setUpdatingId(tx.id);
    try {
      await updateTransaction(tx.id, { status: 'PAID' });
      toast.success(`Lançamento "${tx.description}" marcado como pago!`, 'Baixa Concluída');
      await loadPendingData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('transactionUpdated'));
      }
    } catch (err: any) {
      toast.error(`Erro ao dar baixa: ${err?.message || 'Falha na atualização'}`, 'Erro');
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePayInvoice = async (invoice: CreditCardInvoice) => {
    setUpdatingId(invoice.id);
    try {
      const accounts = await fetchAccounts(entity).catch(() => []);
      const checkingAccount = accounts.find((a) => a.accountType !== 'CREDIT_CARD');

      if (!checkingAccount) {
        toast.warning('Nenhuma conta corrente encontrada para débito.', 'Aviso');
        return;
      }

      await payCreditCardInvoice(
        invoice.accountId,
        checkingAccount.id,
        invoice.totalAmount,
        undefined,
        undefined,
        invoice.id
      );

      toast.success(
        `Fatura de ${invoice.accountName || 'Cartão'} (${invoice.referenceMonth}) paga com sucesso!`,
        'Fatura Quitada'
      );

      await loadPendingData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('transactionUpdated'));
      }
    } catch (err: any) {
      toast.error(`Erro ao pagar fatura: ${err?.message || 'Falha no processo'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Count overdue items
  const overdueTxsCount = pendingTxs.filter((t) => t.transactionDate < todayStr).length;
  const overdueInvoicesCount = closedInvoices.filter((i) => i.dueDate < todayStr).length;
  const totalOverdueCount = overdueTxsCount + overdueInvoicesCount;
  const totalPendingCount = pendingTxs.length + closedInvoices.length;

  return (
    <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/90 shadow-md overflow-hidden transition-all pending-payments-widget">
      
      {/* Widget Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          {totalOverdueCount > 0 ? (
            <AlertTriangle className="h-4 w-4 text-rose-400 animate-pulse" />
          ) : (
            <Clock className="h-4 w-4 text-amber-400" />
          )}
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Contas a Vencer / Faturas
          </span>
        </div>

        <div className="flex items-center gap-2">
          {totalPendingCount > 0 && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-bold font-mono',
                totalOverdueCount > 0
                  ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                  : 'bg-amber-950 text-amber-300 border border-amber-500/40'
              )}
            >
              {totalPendingCount}
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              loadPendingData();
            }}
            className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
          </button>

          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Widget Body */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-2 border-t border-slate-800/60">
          {totalPendingCount === 0 ? (
            <div className="py-2 text-center text-[11px] text-slate-500 italic">
              Nenhuma conta ou fatura pendente no momento.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              
              {/* 1. Closed Credit Card Invoices */}
              {closedInvoices.map((inv) => {
                const isOverdue = inv.dueDate < todayStr;
                const formattedAmount = inv.totalAmount.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                });
                const dateParts = inv.dueDate.split('-');
                const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : inv.dueDate;

                return (
                  <div
                    key={inv.id}
                    className={cn(
                      'p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all',
                      isOverdue
                        ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                        : 'bg-blue-950/40 border-blue-500/30 text-blue-200'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-bold truncate text-[11px] text-blue-300">
                        <CreditCard className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
                        <span className="truncate">
                          [Fatura] {inv.accountName || 'Cartão'} - {inv.referenceMonth}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>Vence {formattedDate}</span>
                        <span className="font-semibold text-slate-100">{formattedAmount}</span>
                        {isOverdue && (
                          <span className="text-[9px] font-bold uppercase text-rose-400">Vencida</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handlePayInvoice(inv)}
                      disabled={updatingId === inv.id}
                      title="Pagar Fatura do Cartão"
                      className="p-1.5 rounded-md bg-blue-950 text-blue-300 hover:bg-blue-900 border border-blue-500/40 transition-colors flex-shrink-0 flex items-center gap-1 text-[10px] font-bold"
                    >
                      {updatingId === inv.id ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                      )}
                      <span className="hidden sm:inline">Pagar Fatura</span>
                    </button>
                  </div>
                );
              })}

              {/* 2. Regular Non-Credit Card Pending Expenses */}
              {pendingTxs.map((tx) => {
                const isOverdue = tx.transactionDate < todayStr;
                const formattedAmount = tx.amount.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                });
                const dateParts = tx.transactionDate.split('-');
                const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : tx.transactionDate;

                return (
                  <div
                    key={tx.id}
                    className={cn(
                      'p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all',
                      isOverdue
                        ? 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-bold truncate text-[11px]">
                        <span className="truncate">{tx.description}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{formattedDate}</span>
                        <span className="font-semibold text-slate-200">{formattedAmount}</span>
                        {isOverdue && (
                          <span className="text-[9px] font-bold uppercase text-rose-400">Vencido</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleMarkAsPaid(tx)}
                      disabled={updatingId === tx.id}
                      title="Dar Baixa (Marcar como Pago)"
                      className="p-1.5 rounded-md bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-500/30 transition-colors flex-shrink-0 flex items-center gap-1 text-[10px] font-bold"
                    >
                      {updatingId === tx.id ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">Baixa</span>
                    </button>
                  </div>
                );
              })}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
