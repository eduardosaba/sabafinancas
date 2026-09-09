'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Zap,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  X,
  Calendar,
  Wallet,
  Tag,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Account, Category, ParsedTransaction, Transaction, TransactionType } from '@/types/finance';
import { parseQuickInput } from '@/lib/parsers/quick-input';
import { useEntity } from '@/contexts/entity-context';
import { useToast } from '@/contexts/toast-context';
import { cn } from '@/lib/utils';

interface QuickTransactionInputProps {
  accounts: Account[];
  categories: Category[];
  onConfirm: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void> | void;
}

export function QuickTransactionInput({
  accounts,
  categories,
  onConfirm,
}: QuickTransactionInputProps) {
  const { entity, config } = useEntity();
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Form state inside preview card for user adjustments
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [status, setStatus] = useState<'PAID' | 'PENDING'>('PAID');

  const inputRef = useRef<HTMLInputElement>(null);

  // Filter accounts according to active Entity Context (PF or PJ, or all if CONSOLIDATED)
  const filteredAccounts = accounts.filter((acc) => {
    if (!entity || entity === 'CONSOLIDATED') return true;
    if (acc.entityId === entity) return true;
    if (entity === 'PF' && (acc.entityId === '11111111-1111-1111-1111-111111111111' || acc.entityId === 'PF')) return true;
    if (entity === 'PJ' && (acc.entityId === '22222222-2222-2222-2222-222222222222' || acc.entityId === 'PJ')) return true;
    return false;
  });

  const displayAccounts = filteredAccounts.length > 0 ? filteredAccounts : accounts;

  useEffect(() => {
    if (displayAccounts.length > 0) {
      if (!accountId || !displayAccounts.some((a) => a.id === accountId)) {
        setAccountId(displayAccounts[0].id);
      }
    }
  }, [displayAccounts, accountId]);

  // Parse input when text changes or Enter is pressed
  const handleParse = (text: string) => {
    if (!text.trim()) {
      setShowPreview(false);
      return;
    }
    const result = parseQuickInput(text, categories, displayAccounts);
    setParsed(result);
    setType(result.type);
    setAmount(result.amount);
    setDescription(result.description);
    setAccountId(result.accountId || displayAccounts[0]?.id || '');
    setCategoryId(result.categoryId || categories[0]?.id || '');
    setDate(result.date);
    setStatus(result.status || 'PAID');
    setShowPreview(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!showPreview) {
        handleParse(inputValue);
      } else {
        handleSave();
      }
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleSave = async () => {
    if (!amount || amount <= 0) {
      toast.warning('Por favor, informe um valor maior que zero.', 'Valor Inválido');
      return;
    }
    if (!description.trim()) {
      toast.warning('Por favor, informe uma descrição.', 'Descrição Obrigatória');
      return;
    }

    const selectedAccount = displayAccounts.find((a) => a.id === accountId) || displayAccounts[0];
    let txEntity = entity === 'CONSOLIDATED' ? 'PF' : entity;
    if (selectedAccount?.entityId === '22222222-2222-2222-2222-222222222222' || selectedAccount?.entityId === 'PJ') {
      txEntity = 'PJ';
    } else if (selectedAccount?.entityId === '11111111-1111-1111-1111-111111111111' || selectedAccount?.entityId === 'PF') {
      txEntity = 'PF';
    }

    const newTx: Omit<Transaction, 'id' | 'createdAt'> = {
      userId: 'user-default-1',
      entityId: txEntity,
      accountId: accountId || filteredAccounts[0]?.id || '',
      categoryId: categoryId || categories[0]?.id || null,
      type,
      amount,
      transactionDate: date,
      description,
      status,
    };

    try {
      await onConfirm(newTx);

      // Success notification
      const formattedAmount = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      toast.success(`Lançamento "${description}" (${formattedAmount}) salvo com sucesso!`, 'Lançamento Concluído');
      
      // Clear state only on success
      setInputValue('');
      setShowPreview(false);
      setParsed(null);
    } catch (err: any) {
      console.error('Falha ao gravar no Supabase:', err);
      const errMsg = err?.message || 'Erro de gravação';
      toast.error(`Falha ao gravar no Supabase: ${errMsg}`, 'Erro de Salvamento');
      if (typeof window !== 'undefined') {
        window.alert(`Falha ao gravar no Supabase: ${errMsg}`);
      }
    }
  };

  const handleCancel = () => {
    setShowPreview(false);
    setParsed(null);
  };

  return (
    <div className="relative w-full space-y-3">
      
      {/* Quick Input Bar Header */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-emerald-400">
          <Zap className="h-5 w-5 animate-pulse text-emerald-400" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (showPreview) handleParse(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim() && !showPreview) {
              handleParse(inputValue);
            }
          }}
          placeholder='Lançamento Rápido: Ex "gastei 50 reais com gasolina - nubank" ou "recebi 1500 cliente x"'
          className="w-full pl-12 pr-28 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 shadow-lg transition-all"
        />

        {/* Action Button inside input bar */}
        <div className="absolute inset-y-1.5 right-1.5 flex items-center gap-1">
          {inputValue && (
            <button
              type="button"
              onClick={() => {
                setInputValue('');
                setShowPreview(false);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => handleParse(inputValue)}
            disabled={!inputValue.trim()}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Processar</span>
          </button>
        </div>
      </div>



      {/* Floating Confirmation & Preview Card */}
      {showPreview && parsed && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Pré-visualização do Lançamento
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-800 text-emerald-400 border border-slate-700">
                {Math.round(parsed.confidence * 100)}% confiança
              </span>
            </div>
            <button
              onClick={handleCancel}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Editable Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            
            {/* Type selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 block">Tipo</label>
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setType('EXPENSE')}
                  className={cn(
                    'flex-1 py-1.5 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all',
                    type === 'EXPENSE'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  <span>Despesa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('INCOME')}
                  className={cn(
                    'flex-1 py-1.5 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all',
                    type === 'INCOME'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>Receita</span>
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 block">Valor</label>
              <CurrencyInput
                value={amount}
                onChangeValue={(val) => setAmount(val)}
                className="!py-1.5 text-xs font-bold"
              />
            </div>

            {/* Description */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-400 block">Descrição</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-medium text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Account dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 block flex items-center gap-1">
                <Wallet className="h-3 w-3 text-blue-400" />
                Conta Bancária
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-medium focus:outline-none focus:border-emerald-500"
              >
                {displayAccounts.map((acc) => {
                  const isPJ = acc.entityId === 'PJ' || acc.entityId === '22222222-2222-2222-2222-222222222222';
                  return (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({isPJ ? 'PJ' : 'PF'})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Category dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 block flex items-center gap-1">
                <Tag className="h-3 w-3 text-purple-400" />
                Categoria
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-medium focus:outline-none focus:border-emerald-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.nature === 'INCOME' ? 'Receita' : 'Despesa'})
                  </option>
                ))}
              </select>
            </div>

            {/* Date picker */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 block flex items-center gap-1">
                <Calendar className="h-3 w-3 text-emerald-400" />
                Data do Lançamento
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-medium focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Status toggle */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 block">Status do Lançamento</label>
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setStatus('PAID')}
                  className={cn(
                    'flex-1 py-1 rounded-md text-[11px] font-bold transition-all',
                    status === 'PAID'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  Pago / Liquidado
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('PENDING')}
                  className={cn(
                    'flex-1 py-1 rounded-md text-[11px] font-bold transition-all',
                    status === 'PENDING'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  A Vencer / Pendente
                </button>
              </div>
            </div>

          </div>

          {/* Card Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" />
              <span>Cancelar (Esc)</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950 transition-all flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Confirmar Lançamento (Enter)</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
