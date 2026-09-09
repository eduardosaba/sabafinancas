'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Trash2,
  Edit2,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Clock,
  CheckCircle2,
  X,
  Save,
  AlertTriangle,
  Plus,
  Sparkles,
  User,
  Building2,
} from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';
import { useDateFilter } from '@/contexts/date-filter-context';
import { Account, Category, Transaction, TransactionType } from '@/types/finance';
import {
  createTransaction,
  deleteTransaction,
  fetchAccounts,
  fetchCategories,
  fetchTransactions,
  fetchUsers,
  updateTransaction,
} from '@/lib/services/finance-service';
import { TransactionModal } from '@/components/transactions/transaction-modal';
import { QuickTransactionInput } from '@/components/transactions/quick-input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { useToast } from '@/contexts/toast-context';
import { cn } from '@/lib/utils';

export default function TransactionsPage() {
  const { entity, config, isHydrated, pjEntities, activeCompany } = useEntity();
  const { filter } = useDateFilter();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | TransactionType>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');

  // Edit Modal State
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editEntity, setEditEntity] = useState<'PF' | 'PJ'>('PF');
  const [editPjCompanyId, setEditPjCompanyId] = useState<string>('');
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editAccountId, setEditAccountId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete State
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // New Transaction Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [txs, accs, cats, usersList] = await Promise.all([
        fetchTransactions({
          entityType: entity,
          startDate: filter.startDate,
          endDate: filter.endDate,
        }),
        fetchAccounts('CONSOLIDATED'),
        fetchCategories('CONSOLIDATED'),
        fetchUsers().catch(() => []),
      ]);
      setTransactions(txs);
      setAccounts(accs);
      setCategories(cats);

      const uMap: Record<string, string> = {};
      usersList.forEach((u) => {
        let name = u.name;
        if (u.email?.includes('eduardopedro') || u.email?.includes('eduardosaba')) name = 'Eduardo Saba';
        if (u.email?.includes('melsaba')) name = 'Mel Saba';
        uMap[u.id] = name || u.email || 'Usuário';
      });
      setUsersMap(uMap);
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [entity, filter.startDate, filter.endDate]);

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

  const handleQuickMarkPaid = async (tx: Transaction) => {
    try {
      await updateTransaction(tx.id, { status: 'PAID' });
      toast.success(`Lançamento "${tx.description}" marcado como pago!`, 'Baixa Concluída');
      await loadData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('transactionUpdated'));
      }
    } catch (err: any) {
      toast.error(`Erro ao dar baixa: ${err?.message || 'Falha na operação'}`, 'Erro');
    }
  };

  // Filtered transactions list
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Filter by type
      if (selectedType !== 'ALL' && tx.type !== selectedType) {
        return false;
      }
      // Filter by status
      if (selectedStatus !== 'ALL' && tx.status !== selectedStatus) {
        return false;
      }
      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const acc = accounts.find((a) => a.id === tx.accountId);
        const cat = categories.find((c) => c.id === tx.categoryId);

        const matchDesc = tx.description.toLowerCase().includes(q);
        const matchAcc = acc?.name.toLowerCase().includes(q);
        const matchCat = cat?.name.toLowerCase().includes(q);

        if (!matchDesc && !matchAcc && !matchCat) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, selectedType, selectedStatus, searchQuery, accounts, categories]);

  // Handle Edit Open
  const handleOpenEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditDescription(tx.description);
    setEditAmount(tx.amount.toString());
    setEditAccountId(tx.accountId);
    setEditCategoryId(tx.categoryId || '');
    setEditDate(tx.transactionDate);

    const isPJ = tx.entityId === 'PJ' || tx.entityId === '22222222-2222-2222-2222-222222222222' || pjEntities.some((e) => e.id === tx.entityId);
    if (isPJ) {
      setEditEntity('PJ');
      setEditPjCompanyId(pjEntities.some((e) => e.id === tx.entityId) ? tx.entityId : (activeCompany?.id || pjEntities[0]?.id || '22222222-2222-2222-2222-222222222222'));
    } else {
      setEditEntity('PF');
      setEditPjCompanyId(activeCompany?.id || pjEntities[0]?.id || '22222222-2222-2222-2222-222222222222');
    }
  };

  // Handle Edit Submit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const targetEntityId = editEntity === 'PJ'
      ? (editPjCompanyId || activeCompany?.id || pjEntities[0]?.id || '22222222-2222-2222-2222-222222222222')
      : '11111111-1111-1111-1111-111111111111';

    setIsSubmittingEdit(true);
    try {
      await updateTransaction(editingTx.id, {
        description: editDescription,
        amount: parsedAmount,
        accountId: editAccountId,
        categoryId: editCategoryId || null,
        transactionDate: editDate,
        entityId: targetEntityId,
      });

      setEditingTx(null);
      toast.success('Lançamento atualizado com sucesso!', 'Edição Concluída');
      await loadData();
    } catch (err: any) {
      console.error('Error saving transaction edit:', err);
      toast.error(`Falha ao salvar edição: ${err?.message || 'Erro Supabase'}`);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Delete Submit
  const handleDeleteConfirm = async () => {
    if (!deletingTxId) return;
    setIsSubmittingDelete(true);
    try {
      await deleteTransaction(deletingTxId);
      setDeletingTxId(null);
      await loadData();
    } catch (err) {
      console.error('Error deleting transaction:', err);
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  if (!isHydrated) return null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400">
            <Receipt className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
              Gestão de Transações & Extrato
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Extrato completo e edição/exclusão de lançamentos para <strong className={config.textColor}>{config.label}</strong>
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>+ Novo Lançamento</span>
        </button>
      </div>

      {/* QUICK TRANSACTION INPUT BAR */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Lançamento Rápido em Linguagem Natural
          </span>
        </div>

        <QuickTransactionInput
          accounts={accounts}
          categories={categories}
          onConfirm={async (newTxData) => {
            const targetEntityId =
              newTxData.entityId === 'PJ' || newTxData.entityId === '22222222-2222-2222-2222-222222222222'
                ? '22222222-2222-2222-2222-222222222222'
                : '11111111-1111-1111-1111-111111111111';

            await createTransaction({
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
            await loadData();
          }}
        />
      </div>

      {/* Filter and Search Controls */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        
        {/* Type & Status Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Tabs */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setSelectedType('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                selectedType === 'ALL'
                  ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              Todas ({transactions.length})
            </button>

            <button
              onClick={() => setSelectedType('EXPENSE')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                selectedType === 'EXPENSE'
                  ? 'bg-rose-950 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-rose-400'
              )}
            >
              <ArrowDownRight className="h-3.5 w-3.5" />
              <span>Despesas</span>
            </button>

            <button
              onClick={() => setSelectedType('INCOME')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                selectedType === 'INCOME'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-emerald-400'
              )}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Receitas</span>
            </button>

            <button
              onClick={() => setSelectedType('TRANSFER')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                selectedType === 'TRANSFER'
                  ? 'bg-purple-950 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-purple-400'
              )}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Transferências</span>
            </button>
          </div>

          {/* Status Tabs */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                selectedStatus === 'ALL'
                  ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              Todos Status
            </button>
            <button
              onClick={() => setSelectedStatus('PAID')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                selectedStatus === 'PAID'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-emerald-400'
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Pagas</span>
            </button>
            <button
              onClick={() => setSelectedStatus('PENDING')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1',
                selectedStatus === 'PENDING'
                  ? 'bg-amber-950 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-amber-400'
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>A Vencer ({transactions.filter((t) => t.status === 'PENDING').length})</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por descrição, conta ou categoria..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-medium"
          />
        </div>

      </div>

      {/* Transactions Table Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        
        {isLoading ? (
          <div className="py-12 flex items-center justify-center text-slate-400 text-xs gap-2">
            <Clock className="h-4 w-4 animate-spin text-emerald-400" />
            <span>Carregando extrato de transações...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-2">
            <Receipt className="h-8 w-8 mx-auto text-slate-600" />
            <p>Nenhuma transação encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Tipo</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Conta Bancária</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Lançado Por</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-center rounded-r-lg">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTransactions.map((tx) => {
                  const account = accounts.find((a) => a.id === tx.accountId);
                  const destAccount = tx.destinationAccountId
                    ? accounts.find((a) => a.id === tx.destinationAccountId)
                    : null;
                  const category = categories.find((c) => c.id === tx.categoryId);
                  const isIncome = tx.type === 'INCOME';
                  const isTransfer = tx.type === 'TRANSFER';
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isOverdue = tx.status === 'PENDING' && tx.transactionDate < todayStr;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors group">
                      {/* Type Badge */}
                      <td className="px-4 py-3 font-semibold">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold',
                            isIncome && 'bg-emerald-950 text-emerald-400 border border-emerald-500/30',
                            !isIncome && !isTransfer && 'bg-rose-950 text-rose-400 border border-rose-500/30',
                            isTransfer && 'bg-purple-950 text-purple-300 border border-purple-500/30'
                          )}
                        >
                          {isIncome && <ArrowUpRight className="h-3 w-3" />}
                          {!isIncome && !isTransfer && <ArrowDownRight className="h-3 w-3" />}
                          {isTransfer && <ArrowLeftRight className="h-3 w-3" />}
                          {isIncome ? 'Receita' : isTransfer ? 'Transferência' : 'Despesa'}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 font-semibold text-slate-100">
                        {tx.description}
                        {tx.debtInstallmentId && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-950 text-purple-300 border border-purple-800/50">
                            Dívida/Parcela
                          </span>
                        )}
                      </td>

                      {/* Account / Destination Account */}
                      <td className="px-4 py-3 text-slate-300">
                        {account?.name || 'Conta Bancária'}
                        {isTransfer && destAccount && (
                          <span className="text-purple-400 text-[11px] block">
                            → {destAccount.name}
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 text-slate-400 font-medium">
                        {category?.name || (isTransfer ? 'Transferência Patrimonial' : 'Outros')}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-400 font-mono">
                        {tx.transactionDate}
                      </td>

                      {/* Launched By User */}
                      <td className="px-4 py-3 text-slate-300 font-semibold text-[11px]">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-medium">
                          {usersMap[tx.userId] || 'Eduardo Saba'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 font-semibold">
                        {tx.status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" /> Pago
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/40">
                            <AlertTriangle className="h-3 w-3" /> VENCIDO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                            <Clock className="h-3 w-3" /> A Vencer
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-extrabold text-sm font-mono',
                          isIncome && 'text-emerald-400',
                          !isIncome && !isTransfer && 'text-slate-100',
                          isTransfer && 'text-purple-300'
                        )}
                      >
                        {isIncome ? '+' : '-'} {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {tx.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => handleQuickMarkPaid(tx)}
                              title="Dar Baixa (Marcar como Pago)"
                              className="px-2 py-1 rounded-md bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-500/30 transition-colors text-[10px] font-bold flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" /> Baixa
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(tx)}
                            title="Editar Lançamento"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingTxId(tx.id)}
                            title="Excluir Lançamento"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-blue-400" />
                Editar Lançamento
              </h3>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Entity Selector (PF / PJ) */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="font-semibold text-slate-300 block text-xs">Entidade do Lançamento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditEntity('PF')}
                    className={cn(
                      'py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all',
                      editEntity === 'PF'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                    )}
                  >
                    <User className="h-3.5 w-3.5 text-emerald-400" />
                    <span>PF (Pessoal)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditEntity('PJ')}
                    className={cn(
                      'py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all',
                      editEntity === 'PJ'
                        ? 'bg-blue-950 text-blue-300 border-blue-500/60 shadow-sm ring-1 ring-blue-500/30'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                    )}
                  >
                    <Building2 className="h-3.5 w-3.5 text-blue-400" />
                    <span>PJ (Empresarial)</span>
                  </button>
                </div>

                {editEntity === 'PJ' && (
                  <div className="pt-1 space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400 block">Qual Empresa PJ?</label>
                    <select
                      value={editPjCompanyId}
                      onChange={(e) => setEditPjCompanyId(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-medium focus:border-blue-500"
                    >
                      {pjEntities.length > 0 ? (
                        pjEntities.map((comp) => (
                          <option key={comp.id} value={comp.id}>
                            🏢 {comp.name}
                          </option>
                        ))
                      ) : (
                        <option value="22222222-2222-2222-2222-222222222222">🏢 Empresa PJ Principal</option>
                      )}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Descrição</label>
                <input
                  type="text"
                  required
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Valor</label>
                <CurrencyInput
                  value={editAmount}
                  onChangeValue={(num) => setEditAmount(num.toString())}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Conta Bancária</label>
                  <select
                    value={editAccountId}
                    onChange={(e) => setEditAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Categoria</label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                  >
                    <option value="">Sem Categoria</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Data</label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-md flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span>{isSubmittingEdit ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTxId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-950/80 text-rose-400 border border-rose-500/40">
              <AlertTriangle className="h-6 w-6" />
            </div>
            
            <div>
              <h3 className="text-base font-bold text-slate-100">Excluir Lançamento?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Esta ação removerá o registro e ajustará o saldo da conta bancária automaticamente.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTxId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmittingDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 shadow-md"
              >
                {isSubmittingDelete ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Transaction Modal Trigger */}
      <TransactionModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        accounts={accounts}
        categories={categories}
        onSuccess={loadData}
      />
    </div>
  );
}
