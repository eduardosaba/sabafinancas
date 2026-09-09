'use client';

import React, { useState } from 'react';
import {
  X,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Check,
  Wallet,
  Tag,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { Account, Category, TransactionType } from '@/types/finance';
import { createTransaction, createTransfer } from '@/lib/services/finance-service';
import { useEntity } from '@/contexts/entity-context';
import { useToast } from '@/contexts/toast-context';
import { CurrencyInput } from '@/components/ui/currency-input';
import { cn } from '@/lib/utils';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
}

export function TransactionModal({
  isOpen,
  onClose,
  accounts,
  categories,
  onSuccess,
}: TransactionModalProps) {
  const { entity } = useEntity();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE');

  // Form states
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [destinationAccountId, setDestinationAccountId] = useState(accounts[1]?.id || accounts[0]?.id || '');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'PAID' | 'PENDING'>('PAID');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (accounts.length > 0) {
        if (!accountId || !accounts.some((a) => a.id === accountId)) {
          setAccountId(accounts[0].id);
        }
        if (!destinationAccountId || !accounts.some((a) => a.id === destinationAccountId)) {
          setDestinationAccountId(accounts[1]?.id || accounts[0].id);
        }
      }
      if (categories.length > 0 && (!categoryId || !categories.some((c) => c.id === categoryId))) {
        setCategoryId(categories[0].id);
      }
    }
  }, [isOpen, accounts, categories]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (!description.trim()) return;

    setIsSubmitting(true);

    try {
      const targetEntityId =
        entity === 'PJ'
          ? '22222222-2222-2222-2222-222222222222'
          : '11111111-1111-1111-1111-111111111111';

      if (activeTab === 'TRANSFER') {
        await createTransfer({
          fromAccountId: accountId,
          toAccountId: destinationAccountId,
          amount: parsedAmount,
          date,
          description,
          entityId: targetEntityId,
        });
      } else {
        await createTransaction({
          entityId: targetEntityId,
          accountId,
          categoryId: categoryId || null,
          type: activeTab,
          amount: parsedAmount,
          transactionDate: date,
          description,
          status,
        });
      }

      onSuccess();
      onClose();
      // Reset
      setAmount('');
      setDescription('');
    } catch (err: any) {
      console.error('Error submitting transaction modal:', err);
      const errMsg = err?.message || 'Erro de gravação no Supabase';
      toast.error(`Falha ao gravar no Supabase: ${errMsg}`, 'Erro de Salvamento');
      if (typeof window !== 'undefined') {
        window.alert(`Falha ao gravar no Supabase: ${errMsg}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-400" />
            Novo Lançamento Financeiro
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 3 Tabs: Despesa, Receita, Transferência */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('EXPENSE')}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
              activeTab === 'EXPENSE'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <ArrowDownRight className="h-4 w-4" />
            <span>Despesa</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('INCOME')}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
              activeTab === 'INCOME'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>Receita</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TRANSFER')}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
              activeTab === 'TRANSFER'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span>Transferência</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            
            {/* Amount */}
            <div className="space-y-1 sm:col-span-2">
              <label className="font-semibold text-slate-300 block">Valor</label>
              <CurrencyInput
                value={amount}
                onChangeValue={(numeric, formatted) => setAmount(numeric ? numeric.toString() : '')}
                placeholder="0,00"
                className="text-lg"
              />
            </div>

            {/* Description */}
            <div className="space-y-1 sm:col-span-2">
              <label className="font-semibold text-slate-300 block">Descrição</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={activeTab === 'TRANSFER' ? 'Ex: Retirada Pró-labore PJ para PF' : 'Ex: Compra de suprimentos'}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Account / Source Account */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 block">
                {activeTab === 'TRANSFER' ? 'Conta de Origem (Débito)' : 'Conta Bancária'}
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              >
                {accounts.map((acc) => {
                  const isPJ = acc.entityId === 'PJ' || acc.entityId === '22222222-2222-2222-2222-222222222222';
                  return (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({isPJ ? 'PJ' : 'PF'})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Destination Account (If Transfer) OR Category */}
            {activeTab === 'TRANSFER' ? (
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Conta de Destino (Crédito)</label>
                <select
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                >
                  {accounts.map((acc) => {
                    const isPJ = acc.entityId === 'PJ' || acc.entityId === '22222222-2222-2222-2222-222222222222';
                    return (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({isPJ ? 'PJ' : 'PF'})
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Categoria</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                >
                  {categories
                    .filter((c) => c.nature === activeTab || !c.nature)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Date */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-300 block">Data do Lançamento</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Status (Paid / Pending) */}
            {activeTab !== 'TRANSFER' && (
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Status da Transação</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'PAID' | 'PENDING')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="PAID">Pago / Concluído</option>
                  <option value="PENDING">Pendente / A Vencer</option>
                </select>
              </div>
            )}

          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5',
                activeTab === 'EXPENSE' && 'bg-rose-600 hover:bg-rose-500',
                activeTab === 'INCOME' && 'bg-emerald-600 hover:bg-emerald-500',
                activeTab === 'TRANSFER' && 'bg-purple-600 hover:bg-purple-500'
              )}
            >
              <Check className="h-4 w-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Confirmar Lançamento'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
