'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  CreditCard,
  Eye,
  FileText,
} from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';
import { useDateFilter } from '@/contexts/date-filter-context';
import { useToast } from '@/contexts/toast-context';
import { QuickTransactionInput } from '@/components/transactions/quick-input';
import { TransactionModal } from '@/components/transactions/transaction-modal';
import {
  Account,
  Category,
  CreditCardInvoice,
  Transaction,
  TransactionType,
} from '@/types/finance';
import {
  createTransaction,
  deleteTransaction,
  fetchAccounts,
  fetchCategories,
  fetchCreditCardInvoices,
  fetchInvoiceTransactions,
  fetchTransactions,
  fetchUsers,
  updateTransaction,
} from '@/lib/services/finance-service';
import { CurrencyInput } from '@/components/ui/currency-input';
import { cn } from '@/lib/utils';

function TransactionsContent() {
  const { entity, config, isHydrated, pjEntities, activeCompany } = useEntity();
  const { filter } = useDateFilter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | TransactionType | 'INVOICE_PAYMENT'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const [selectedAccountTypeFilter, setSelectedAccountTypeFilter] = useState<'ALL' | 'CREDIT_CARD' | 'CHECKING'>('ALL');

  useEffect(() => {
    const accParam = searchParams?.get('account');
    if (accParam) {
      setSelectedAccountId(accParam);
    }
  }, [searchParams]);

  // Paid Invoices History in Transactions
  const [paidInvoices, setPaidInvoices] = useState<CreditCardInvoice[]>([]);

  // Viewing invoice items modal state in Transactions
  const [viewingInvoice, setViewingInvoice] = useState<CreditCardInvoice | null>(null);
  const [viewingInvoiceItems, setViewingInvoiceItems] = useState<Transaction[]>([]);
  const [isLoadingInvoiceItems, setIsLoadingInvoiceItems] = useState(false);

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
      const [txs, accs, cats, usersList, pInvoices] = await Promise.all([
        fetchTransactions({
          entityType: entity,
          startDate: filter.startDate,
          endDate: filter.endDate,
        }),
        fetchAccounts('CONSOLIDATED'),
        fetchCategories('CONSOLIDATED'),
        fetchUsers().catch(() => []),
        fetchCreditCardInvoices(entity, 'PAID').catch(() => []),
      ]);
      setTransactions(txs);
      setAccounts(accs);
      setCategories(cats);

      // Synthesize paid invoices from both DB table and payment transfer transactions
      const synthesizedInvoices: CreditCardInvoice[] = [...pInvoices];
      txs.forEach((t) => {
        const destAcc = accs.find((a) => a.id === t.destinationAccountId);
        const sourceAcc = accs.find((a) => a.id === t.accountId);
        const desc = t.description.toLowerCase();

        const isInvoicePayment =
          t.type === 'TRANSFER' &&
          (desc.includes('pagamento') || desc.includes('fatura') || destAcc?.accountType === 'CREDIT_CARD');

        if (isInvoicePayment) {
          const cardAcc = destAcc?.accountType === 'CREDIT_CARD' ? destAcc : (sourceAcc?.accountType === 'CREDIT_CARD' ? sourceAcc : null);
          const cardName = cardAcc ? cardAcc.name : 'Cartão de Crédito';

          const alreadyExists = synthesizedInvoices.some(
            (inv) => inv.accountId === (t.destinationAccountId || t.accountId) && Math.abs(inv.totalAmount - t.amount) < 0.01
          );

          if (!alreadyExists) {
            synthesizedInvoices.push({
              id: `synth-${t.id}`,
              accountId: t.destinationAccountId || t.accountId,
              accountName: cardName,
              dueDate: t.transactionDate,
              closingDate: t.transactionDate,
              referenceMonth: t.transactionDate.substring(0, 7),
              totalAmount: t.amount,
              status: 'PAID',
              createdAt: t.createdAt,
            });
          }
        }
      });

      setPaidInvoices(synthesizedInvoices);

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

  // Handle View Invoice Items Modal
  const handleViewInvoiceItems = async (inv: CreditCardInvoice) => {
    setViewingInvoice(inv);
    setIsLoadingInvoiceItems(true);
    try {
      let items: Transaction[] = [];
      if (inv.id.startsWith('synth-')) {
        items = transactions.filter(
          (t) => (t.accountId === inv.accountId || t.destinationAccountId === inv.accountId) && t.type !== 'TRANSFER'
        );
      } else {
        items = await fetchInvoiceTransactions(inv.id);
      }
      setViewingInvoiceItems(items);
    } catch (err) {
      console.error('Error fetching invoice items:', err);
      toast.error('Erro ao carregar itens da fatura.');
    } finally {
      setIsLoadingInvoiceItems(false);
    }
  };

  // Filtered transactions list
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const sourceAcc = accounts.find((a) => a.id === tx.accountId);
      const destAcc = tx.destinationAccountId ? accounts.find((a) => a.id === tx.destinationAccountId) : null;
      const desc = tx.description.toLowerCase();

      // Filter by type
      if (selectedType === 'INVOICE_PAYMENT') {
        const isInvoicePaymentTransfer =
          (tx.type === 'TRANSFER' && (desc.includes('pagamento') || desc.includes('fatura') || destAcc?.accountType === 'CREDIT_CARD')) ||
          (sourceAcc?.accountType === 'CHECKING' && destAcc?.accountType === 'CREDIT_CARD');
        const isLinkedToInvoice = !!tx.invoiceId;
        const isPaidCreditCardTx = (sourceAcc?.accountType === 'CREDIT_CARD' || destAcc?.accountType === 'CREDIT_CARD') && tx.status === 'PAID';

        if (!isInvoicePaymentTransfer && !isLinkedToInvoice && !isPaidCreditCardTx) {
          return false;
        }
      } else if (selectedType !== 'ALL' && tx.type !== selectedType) {
        return false;
      }

      // Filter by account type category (Todas, Cartões de Crédito, Contas Correntes)
      if (selectedType !== 'INVOICE_PAYMENT' && selectedAccountTypeFilter === 'CREDIT_CARD') {
        if (sourceAcc?.accountType !== 'CREDIT_CARD' && destAcc?.accountType !== 'CREDIT_CARD') {
          return false;
        }
      } else if (selectedType !== 'INVOICE_PAYMENT' && selectedAccountTypeFilter === 'CHECKING') {
        if (sourceAcc?.accountType === 'CREDIT_CARD' && destAcc?.accountType === 'CREDIT_CARD') {
          return false;
        }
      }

      // Filter by status
      if (selectedStatus !== 'ALL' && tx.status !== selectedStatus) {
        return false;
      }

      // Filter by specific account
      if (selectedAccountId === 'CREDIT_CARDS_ONLY') {
        if (sourceAcc?.accountType !== 'CREDIT_CARD' && destAcc?.accountType !== 'CREDIT_CARD') {
          return false;
        }
      } else if (selectedAccountId !== 'ALL') {
        if (tx.accountId !== selectedAccountId && tx.destinationAccountId !== selectedAccountId) {
          return false;
        }
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cat = categories.find((c) => c.id === tx.categoryId);

        const matchDesc = tx.description.toLowerCase().includes(q);
        const matchAcc = sourceAcc?.name.toLowerCase().includes(q) || (destAcc && destAcc.name.toLowerCase().includes(q));
        const matchCat = cat?.name.toLowerCase().includes(q);
        const matchCardKeyword =
          (q.includes('cartao') || q.includes('cartão') || q.includes('fatura')) &&
          (sourceAcc?.accountType === 'CREDIT_CARD' || destAcc?.accountType === 'CREDIT_CARD' || !!tx.invoiceId);

        const amountNumStr = tx.amount.toString();
        const amountBrlStr = tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const cleanQ = q.replace('r$', '').replace(/\s+/g, '').trim();

        const matchAmount =
          amountNumStr.includes(cleanQ) ||
          amountBrlStr.toLowerCase().includes(cleanQ) ||
          amountBrlStr.replace('.', '').replace(',', '.').includes(cleanQ);

        if (!matchDesc && !matchAcc && !matchCat && !matchAmount && !matchCardKeyword) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, selectedType, selectedAccountTypeFilter, selectedStatus, selectedAccountId, searchQuery, accounts, categories]);

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
          onOpenManual={() => setIsNewModalOpen(true)}
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
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        
        {/* Row 1: Main Type Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setSelectedType('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all',
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
                'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                selectedType === 'EXPENSE'
                  ? 'bg-rose-950 text-rose-300 border border-rose-500/40 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-rose-400'
              )}
            >
              <ArrowDownRight className="h-3.5 w-3.5" />
              <span>Despesas</span>
            </button>

            <button
              onClick={() => setSelectedType('INCOME')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                selectedType === 'INCOME'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-emerald-400'
              )}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Receitas</span>
            </button>

            <button
              onClick={() => setSelectedType('TRANSFER')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                selectedType === 'TRANSFER'
                  ? 'bg-purple-950 text-purple-300 border border-purple-500/40 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-purple-400'
              )}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Transferências</span>
            </button>

            <button
              onClick={() => setSelectedType('INVOICE_PAYMENT')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
                selectedType === 'INVOICE_PAYMENT'
                  ? 'bg-blue-950 text-blue-300 border border-blue-500/40 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-blue-400'
              )}
            >
              <CreditCard className="h-3.5 w-3.5 text-blue-400" />
              <span>Faturas Pagas (Cartão)</span>
            </button>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all',
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
                'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1',
                selectedStatus === 'PAID'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-emerald-400'
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Pagas</span>
            </button>
            <button
              onClick={() => setSelectedStatus('PENDING')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1',
                selectedStatus === 'PENDING'
                  ? 'bg-amber-950 text-amber-300 border border-amber-500/40 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-amber-400'
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>A Vencer</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search Bar & Account Filters */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por descrição, valor (R$), conta, cartão ou categoria..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          {/* Account Category Filter (Todas, Cartões de Crédito, Contas Bancárias) */}
          <div className="flex items-center gap-2">
            <select
              value={selectedAccountTypeFilter}
              onChange={(e) => {
                const val = e.target.value as any;
                setSelectedAccountTypeFilter(val);
                if (val === 'CREDIT_CARD') setSelectedAccountId('CREDIT_CARDS_ONLY');
                else if (selectedAccountId === 'CREDIT_CARDS_ONLY') setSelectedAccountId('ALL');
              }}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">Todas Categorias de Conta</option>
              <option value="CREDIT_CARD">💳 Apenas Cartões de Crédito</option>
              <option value="CHECKING">🏦 Apenas Contas Bancárias</option>
            </select>

            {/* Specific Account Filter */}
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[220px]"
            >
              <option value="ALL">Selecione uma Conta / Cartão...</option>
              <option value="CREDIT_CARDS_ONLY">💳 Todos os Cartões de Crédito</option>
              <optgroup label="Contas / Cartões Cadastrados">
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountType === 'CREDIT_CARD' ? '💳 ' : '🏦 '}
                    {a.name} ({a.accountType === 'CREDIT_CARD' ? 'Cartão' : 'Conta'})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

        </div>
      </div>

      {/* Section: Faturas de Cartão Pagas (Shown when 'INVOICE_PAYMENT' or 'ALL' or 'CREDIT_CARD' is active) */}
      {(selectedType === 'INVOICE_PAYMENT' || paidInvoices.length > 0) && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-400" />
              <span>Faturas de Cartão Quitadas ({paidInvoices.length})</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              Histórico de liquidação de faturas consolidadas
            </span>
          </div>

          {paidInvoices.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs italic bg-slate-950/40 rounded-xl border border-slate-800/80 p-3">
              Nenhuma fatura de cartão paga registrada até o momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {paidInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2 flex flex-col justify-between hover:border-blue-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-100 truncate">
                        {inv.accountName || 'Cartão de Crédito'}
                      </div>
                      <div className="text-[11px] text-blue-400 font-mono">
                        Fatura Ref: {inv.referenceMonth}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase">
                      Quitada
                    </span>
                  </div>

                  <div className="flex items-end justify-between pt-2 border-t border-slate-800/80">
                    <div>
                      <div className="text-[10px] text-slate-400">Vencimento:</div>
                      <div className="text-xs text-slate-300 font-mono">
                        {inv.dueDate.split('-').reverse().join('/')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-emerald-400 font-mono">
                        {inv.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewInvoiceItems(inv)}
                        className="mt-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold transition-colors inline-flex items-center gap-1 border border-slate-700"
                      >
                        <Eye className="h-3 w-3 text-blue-400" />
                        <span>Ver Itens</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoice Details Modal in Transactions Page */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-950 border border-blue-800 text-blue-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                    <span>Lançamentos da Fatura ({viewingInvoice.referenceMonth})</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Quitada
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {viewingInvoice.accountName || 'Cartão de Crédito'} | Vencimento: {viewingInvoice.dueDate.split('-').reverse().join('/')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setViewingInvoice(null);
                  setViewingInvoiceItems([]);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Total Summary */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs flex-shrink-0">
              <span className="text-slate-400 font-semibold">Valor Total Pago:</span>
              <strong className="text-lg font-mono font-extrabold text-emerald-400">
                {viewingInvoice.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </strong>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
              {isLoadingInvoiceItems ? (
                <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
                  <Clock className="h-4 w-4 animate-spin text-blue-400" />
                  <span>Carregando itens da fatura...</span>
                </div>
              ) : viewingInvoiceItems.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs italic bg-slate-950/40 rounded-xl border border-slate-800/80 p-4">
                  Nenhum lançamento individual encontrado para esta fatura.
                </div>
              ) : (
                <div className="space-y-2">
                  {viewingInvoiceItems.map((item) => {
                    const cat = categories.find((c) => c.id === item.categoryId);
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-100 truncate">{item.description}</div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span>{item.transactionDate.split('-').reverse().join('/')}</span>
                            {cat && <span className="text-slate-400 font-sans">| {cat.name}</span>}
                          </div>
                        </div>

                        <div className="text-right font-mono font-bold text-sm text-slate-100">
                          {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setViewingInvoice(null);
                  setViewingInvoiceItems([]);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

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
                    const desc = tx.description.toLowerCase();
                    const isInvoicePayment =
                      (isTransfer && (desc.includes('pagamento') || desc.includes('fatura') || destAccount?.accountType === 'CREDIT_CARD')) ||
                      (account?.accountType === 'CHECKING' && destAccount?.accountType === 'CREDIT_CARD');

                    const todayStr = new Date().toISOString().split('T')[0];
                    const isOverdue = tx.status === 'PENDING' && tx.transactionDate < todayStr;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors group">
                        {/* Type Badge */}
                        <td className="px-4 py-3 font-semibold">
                          {isInvoicePayment ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-500/40 shadow-sm">
                              <CreditCard className="h-3 w-3 text-blue-400" />
                              Cartão de Crédito
                            </span>
                          ) : (
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
                          )}
                        </td>

                      {/* Description */}
                      <td className="px-4 py-3 font-semibold text-slate-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{tx.description}</span>
                          {tx.debtInstallmentId && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-950 text-purple-300 border border-purple-800/50">
                              Dívida/Parcela
                            </span>
                          )}
                          {tx.invoiceId && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-950 text-blue-300 border border-blue-800/50">
                              [Fatura]
                            </span>
                          )}
                          {(tx.description.toLowerCase().includes('pagamento de fatura') ||
                            (isTransfer && destAccount?.accountType === 'CREDIT_CARD')) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                              [Pgto Fatura]
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Account / Destination Account */}
                      <td className="px-4 py-3 text-slate-300">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{account?.name || 'Conta Bancária'}</span>
                          {account?.accountType === 'CREDIT_CARD' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-950 text-blue-300 border border-blue-800/60">
                              <CreditCard className="h-2.5 w-2.5 text-blue-400" />
                              Cartão
                            </span>
                          )}
                        </div>
                        {isTransfer && destAccount && (
                          <span className="text-purple-400 text-[11px] block mt-0.5">
                            → {destAccount.name}
                            {destAccount.accountType === 'CREDIT_CARD' && (
                              <span className="ml-1 inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-blue-950 text-blue-300 border border-blue-800/60">
                                Cartão
                              </span>
                            )}
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
                  onChangeValue={(num: number) => setEditAmount(num.toString())}
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

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Carregando extrato...</span>
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}
