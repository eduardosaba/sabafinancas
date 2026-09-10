'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CreditCard,
  Calendar,
  CheckSquare,
  Square,
  FileCheck,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Account, Transaction } from '@/types/finance';
import { fetchOpenInvoiceTransactions, closeInvoice } from '@/lib/services/finance-service';
import { calculateCreditCardDueDate } from '@/lib/utils/credit-card';
import { useToast } from '@/contexts/toast-context';
import { cn } from '@/lib/utils';

interface InvoiceCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account;
  onSuccess: () => void;
}

export function InvoiceCloseModal({
  isOpen,
  onClose,
  account,
  onSuccess,
}: InvoiceCloseModalProps) {
  const { toast } = useToast();

  const [openTxs, setOpenTxs] = useState<Transaction[]>([]);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultDueDate = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return calculateCreditCardDueDate(todayStr, account.closingDay || 25, account.dueDay || 5);
  }, [account]);

  const defaultRefMonth = useMemo(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${m}/${d.getFullYear()}`;
  }, []);

  const [dueDate, setDueDate] = useState<string>(defaultDueDate);
  const [referenceMonth, setReferenceMonth] = useState<string>(defaultRefMonth);

  const loadOpenTxs = async () => {
    setIsLoading(true);
    try {
      const txs = await fetchOpenInvoiceTransactions(account.id);
      setOpenTxs(txs);
      setSelectedTxIds(txs.map((t) => t.id));
    } catch (err) {
      console.error('Failed to load open transactions for invoice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setDueDate(defaultDueDate);
      setReferenceMonth(defaultRefMonth);
      loadOpenTxs();
    }
  }, [isOpen, account.id, defaultDueDate, defaultRefMonth]);

  if (!isOpen) return null;

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTxIds.length === openTxs.length) {
      setSelectedTxIds([]);
    } else {
      setSelectedTxIds(openTxs.map((t) => t.id));
    }
  };

  const calculatedTotal = useMemo(() => {
    return openTxs
      .filter((t) => selectedTxIds.includes(t.id))
      .reduce((sum, t) => sum + (t.type === 'INCOME' ? -t.amount : t.amount), 0);
  }, [openTxs, selectedTxIds]);

  const handleConfirmClose = async () => {
    if (selectedTxIds.length === 0) {
      toast.warning('Selecione ao menos um lançamento para fechar a fatura.', 'Atenção');
      return;
    }

    if (!dueDate) {
      toast.warning('Informe a data de vencimento da fatura.', 'Campo Obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      await closeInvoice({
        accountId: account.id,
        dueDate,
        referenceMonth: referenceMonth || defaultRefMonth,
        transactionIds: selectedTxIds,
        totalAmount: calculatedTotal,
      });

      toast.success(
        `Fatura (${referenceMonth}) de ${account.name} fechada no valor de ${calculatedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}!`,
        'Fatura Fechada com Sucesso'
      );

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('transactionUpdated'));
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error closing invoice:', err);
      toast.error(`Falha ao fechar fatura: ${err?.message || 'Erro inesperado'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-950 border border-blue-800 text-blue-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Gerenciar / Fechar Fatura — {account.name}
              </h3>
              <p className="text-xs text-slate-400">
                Conferência de lançamentos do ciclo atual e geração da fatura a vencer.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Invoice Info Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 flex-shrink-0 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-300 block flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-blue-400" />
              Mês de Referência
            </label>
            <input
              type="text"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
              placeholder="Ex: 09/2026"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-300 block flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-emerald-400" />
              Data de Vencimento da Fatura
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Transaction Checklist Header & Controls */}
        <div className="flex items-center justify-between text-xs flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center gap-1.5 transition-colors"
            >
              {selectedTxIds.length === openTxs.length ? (
                <>
                  <CheckSquare className="h-3.5 w-3.5 text-blue-400" />
                  <span>Desmarcar Todos</span>
                </>
              ) : (
                <>
                  <Square className="h-3.5 w-3.5 text-slate-400" />
                  <span>Selecionar Todos</span>
                </>
              )}
            </button>
            <span className="text-slate-400">
              {selectedTxIds.length} de {openTxs.length} item(ns) selecionados
            </span>
          </div>

          <button
            type="button"
            onClick={loadOpenTxs}
            className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
            title="Atualizar Lançamentos"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </button>
        </div>

        {/* Transactions Checklist Scrollable Container */}
        <div className="flex-1 overflow-y-auto min-h-[160px] max-h-[280px] space-y-2 pr-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
              <span>Buscando lançamentos abertos...</span>
            </div>
          ) : openTxs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2 bg-slate-950/60 rounded-xl border border-slate-800/80 p-6">
              <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400" />
              <p className="font-semibold text-slate-300">Não há compras abertas para este cartão!</p>
              <p className="text-slate-500 text-[11px]">
                Todos os lançamentos do ciclo já foram faturados ou quitados.
              </p>
            </div>
          ) : (
            openTxs.map((tx) => {
              const isSelected = selectedTxIds.includes(tx.id);
              const formattedDate = tx.transactionDate.split('-').reverse().join('/');

              return (
                <div
                  key={tx.id}
                  onClick={() => toggleSelectTx(tx.id)}
                  className={cn(
                    'p-3 rounded-xl border text-xs flex items-center justify-between gap-3 cursor-pointer transition-all',
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500/50 text-slate-200 shadow-sm'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 opacity-60 hover:opacity-100 hover:border-slate-700'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-blue-400 flex-shrink-0">
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-blue-400" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate text-slate-200 text-xs">
                        {tx.description}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Data da compra: {formattedDate}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 font-bold font-mono text-sm text-slate-100">
                    {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Real-time Total & Action Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-4 flex-shrink-0">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Total Faturado (Itens Checados)
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-400">
              {calculatedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmClose}
              disabled={isSubmitting || selectedTxIds.length === 0}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-1.5"
            >
              <FileCheck className="h-4 w-4" />
              <span>{isSubmitting ? 'Gerando Fatura...' : 'Confirmar Fechamento'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
