'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ArrowDownRight, RefreshCw } from 'lucide-react';
import { Transaction } from '@/types/finance';
import { fetchTransactions, updateTransaction } from '@/lib/services/finance-service';
import { useEntity } from '@/contexts/entity-context';
import { useToast } from '@/contexts/toast-context';
import { cn } from '@/lib/utils';

export function PendingPaymentsSidebarWidget() {
  const { entity } = useEntity();
  const { toast } = useToast();
  const [pendingTxs, setPendingTxs] = useState<Transaction[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setIsLoading(true);
    try {
      const allTxs = await fetchTransactions({ entityType: entity });
      const pending = allTxs.filter((t) => t.status === 'PENDING');
      setPendingTxs(pending);
    } catch (err) {
      console.error('Failed to load pending transactions in sidebar:', err);
    } finally {
      setIsLoading(false);
    }
  }, [entity]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const handleMarkAsPaid = async (tx: Transaction) => {
    setUpdatingId(tx.id);
    try {
      await updateTransaction(tx.id, { status: 'PAID' });
      toast.success(`Lançamento "${tx.description}" marcado como pago!`, 'Baixa Concluída');
      await loadPending();
      if (typeof window !== 'undefined') {
        // Dispatch custom event to notify other components to refresh
        window.dispatchEvent(new CustomEvent('transactionUpdated'));
      }
    } catch (err: any) {
      toast.error(`Erro ao dar baixa: ${err?.message || 'Falha na atualização'}`, 'Erro');
    } finally {
      setUpdatingId(null);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const overdueCount = pendingTxs.filter((t) => t.transactionDate < todayStr).length;

  return (
    <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/90 shadow-md overflow-hidden transition-all">
      
      {/* Widget Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          {overdueCount > 0 ? (
            <AlertTriangle className="h-4 w-4 text-rose-400 animate-pulse" />
          ) : (
            <Clock className="h-4 w-4 text-amber-400" />
          )}
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            A Vencer / Pendentes
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pendingTxs.length > 0 && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-bold font-mono',
                overdueCount > 0
                  ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                  : 'bg-amber-950 text-amber-300 border border-amber-500/40'
              )}
            >
              {pendingTxs.length}
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              loadPending();
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
          {pendingTxs.length === 0 ? (
            <div className="py-2 text-center text-[11px] text-slate-500 italic">
              Nenhum pagamento pendente no período.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {pendingTxs.slice(0, 5).map((tx) => {
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

              {pendingTxs.length > 5 && (
                <div className="text-[10px] text-center text-slate-500 pt-1 font-medium">
                  + {pendingTxs.length - 5} lançamento(s) pendente(s)
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
