'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CreditCard,
  CalendarClock,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Receipt,
  FileCheck,
  Filter,
  CheckCircle2,
  Clock,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Building2,
  User,
  Zap,
  Radio,
  Wifi,
  BarChart3,
  Layers,
  Eye,
  FileText,
  X,
  Trash2,
  Edit2,
} from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';
import { useToast } from '@/contexts/toast-context';
import { Account, Category, CreditCardInvoice, Transaction } from '@/types/finance';
import {
  fetchAccounts,
  fetchTransactions,
  fetchCreditCardInvoices,
  fetchInvoiceTransactions,
  fetchCategories,
  payCreditCardInvoice,
  deleteTransaction,
} from '@/lib/services/finance-service';
import {
  calculateCreditCardMetrics,
  calculateAggregatedCreditCardKPIs,
} from '@/lib/utils/credit-card';
import { InvoiceCloseModal } from '@/components/transactions/invoice-close-modal';
import { CARD_PRESET_TEMPLATES } from '@/app/(dashboard)/settings/accounts/page';
import { cn } from '@/lib/utils';

// Helper to determine Card Art / Skin
function getCardSkin(account: Account) {
  const preset = CARD_PRESET_TEMPLATES.find((p) => p.id === account.cardImageUrl);
  if (preset) {
    return {
      gradient: preset.bgGradient,
      logoText: preset.logo,
      color: preset.color,
      isImage: false,
    };
  }

  if (
    account.cardImageUrl &&
    (account.cardImageUrl.startsWith('http') ||
      account.cardImageUrl.startsWith('/') ||
      account.cardImageUrl.startsWith('data:image'))
  ) {
    return {
      imageUrl: account.cardImageUrl,
      isImage: true,
      color: account.colorHex || '#3b82f6',
    };
  }

  return {
    gradient: 'from-indigo-950 via-slate-900 to-zinc-950',
    logoText: account.name.slice(0, 3).toUpperCase(),
    color: account.colorHex || '#3b82f6',
    isImage: false,
  };
}

export default function CreditCardsDashboardPage() {
  const { entity, isHydrated, pjEntities } = useEntity();
  const { toast, confirm } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allInvoices, setAllInvoices] = useState<CreditCardInvoice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleDeleteInvoiceItem = async (itemId: string, itemDesc: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Lançamento Duplicado?',
      message: `Deseja excluir a transação "${itemDesc}" do cartão de crédito?`,
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (!isConfirmed) return;

    try {
      await deleteTransaction(itemId);
      toast.success(`Lançamento "${itemDesc}" excluído com sucesso!`, 'Item Removido');
      if (viewingInvoice) {
        const items = await fetchInvoiceTransactions(viewingInvoice.id);
        setViewingInvoiceItems(items);
      }
      await loadData();
    } catch (err: any) {
      console.error('Error deleting invoice item:', err);
      toast.error(`Falha ao excluir item: ${err?.message || 'Erro inesperado'}`);
    }
  };

  // Sub-tab for invoices: CLOSED or PAID
  const [invoiceTab, setInvoiceTab] = useState<'CLOSED' | 'PAID'>('CLOSED');

  // Viewing invoice items modal state
  const [viewingInvoice, setViewingInvoice] = useState<CreditCardInvoice | null>(null);
  const [viewingInvoiceItems, setViewingInvoiceItems] = useState<Transaction[]>([]);
  const [isLoadingInvoiceItems, setIsLoadingInvoiceItems] = useState(false);

  // Filter Tab: ALL, PF, PJ
  const [filterTab, setFilterTab] = useState<'ALL' | 'PF' | 'PJ'>('ALL');
  const [selectedCardId, setSelectedCardId] = useState<string>('ALL');

  // Carousel scroll ref & handler
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -310 : 310;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Modal States
  const [closingInvoiceAccount, setClosingInvoiceAccount] = useState<Account | null>(null);
  const [payingCardAccount, setPayingCardAccount] = useState<Account | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<CreditCardInvoice | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [paySourceAccId, setPaySourceAccId] = useState<string>('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [accs, txs, invs, cats] = await Promise.all([
        fetchAccounts('CONSOLIDATED'),
        fetchTransactions({ entityType: 'CONSOLIDATED' }),
        fetchCreditCardInvoices('CONSOLIDATED', 'ALL').catch(() => []),
        fetchCategories('CONSOLIDATED').catch(() => []),
      ]);

      setAccounts(accs);
      setTransactions(txs);
      setAllInvoices(invs);
      setCategories(cats);
    } catch (err) {
      console.error('Error loading credit cards dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  // Credit Card accounts vs Checking accounts
  const creditCardAccounts = useMemo(() => {
    let cardAccs = accounts.filter((a) => a.accountType === 'CREDIT_CARD');

    if (filterTab === 'PF') {
      cardAccs = cardAccs.filter(
        (a) => a.entityId === '11111111-1111-1111-1111-111111111111' || a.entityId === 'PF'
      );
    } else if (filterTab === 'PJ') {
      cardAccs = cardAccs.filter(
        (a) => a.entityId !== '11111111-1111-1111-1111-111111111111' && a.entityId !== 'PF'
      );
    }

    return cardAccs;
  }, [accounts, filterTab]);

  const checkingAccounts = useMemo(() => {
    return accounts.filter((a) => a.accountType !== 'CREDIT_CARD');
  }, [accounts]);

  // Selected single card account object if not 'ALL'
  const selectedCardAccount = useMemo(() => {
    if (selectedCardId === 'ALL') return null;
    return creditCardAccounts.find((a) => a.id === selectedCardId) || null;
  }, [creditCardAccounts, selectedCardId]);

  // Calculate Monthly Income for Income Commitment % KPI
  const monthlyIncome = useMemo(() => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return transactions
      .filter(
        (t) =>
          t.type === 'INCOME' &&
          t.status === 'PAID' &&
          t.transactionDate.startsWith(currentMonthStr)
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // Aggregated KPIs
  const kpis = useMemo(() => {
    return calculateAggregatedCreditCardKPIs(creditCardAccounts, transactions, monthlyIncome);
  }, [creditCardAccounts, transactions, monthlyIncome]);

  // Pending card purchases list (filtered by selectedCardId if selected)
  const filteredCardTransactions = useMemo(() => {
    const cardIds = new Set(creditCardAccounts.map((a) => a.id));
    let cardTxs = transactions.filter(
      (t) => t.status === 'PENDING' && cardIds.has(t.accountId)
    );

    if (selectedCardId !== 'ALL') {
      cardTxs = cardTxs.filter((t) => t.accountId === selectedCardId);
    }

    return cardTxs.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, [creditCardAccounts, transactions, selectedCardId]);

  // Closed invoices (filtered by selectedCardId if selected)
  const filteredClosedInvoices = useMemo(() => {
    const closed = allInvoices.filter((i) => i.status === 'CLOSED');
    if (selectedCardId === 'ALL') return closed;
    return closed.filter((i) => i.accountId === selectedCardId);
  }, [allInvoices, selectedCardId]);

  // Paid invoices (filtered by selectedCardId if selected)
  const filteredPaidInvoices = useMemo(() => {
    const paid = allInvoices.filter((i) => i.status === 'PAID');
    if (selectedCardId === 'ALL') return paid;
    return paid.filter((i) => i.accountId === selectedCardId);
  }, [allInvoices, selectedCardId]);

  // Handle View Invoice Items
  const handleViewInvoiceItems = async (inv: CreditCardInvoice) => {
    setViewingInvoice(inv);
    setIsLoadingInvoiceItems(true);
    try {
      const items = await fetchInvoiceTransactions(inv.id);
      setViewingInvoiceItems(items);
    } catch (err) {
      console.error('Error fetching invoice items:', err);
      toast.error('Erro ao carregar itens da fatura.');
    } finally {
      setIsLoadingInvoiceItems(false);
    }
  };

  // Handle Pay Credit Card Invoice
  const handlePayConfirm = async () => {
    if (!paySourceAccId) {
      toast.warning('Selecione uma conta corrente para débito.', 'Campo Obrigatório');
      return;
    }

    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.warning('Informe um valor de pagamento válido.', 'Valor Inválido');
      return;
    }

    setIsSubmittingPay(true);
    try {
      const cardAccId = payingCardAccount?.id || payingInvoice?.accountId;
      if (!cardAccId) return;

      await payCreditCardInvoice(
        cardAccId,
        paySourceAccId,
        amt,
        undefined,
        undefined,
        payingInvoice?.id
      );

      toast.success(
        `Pagamento de ${amt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} efetuado com sucesso!`,
        'Fatura Quitada'
      );

      setPayingCardAccount(null);
      setPayingInvoice(null);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('transactionUpdated'));
      }

      await loadData();
    } catch (err: any) {
      console.error('Error paying invoice:', err);
      toast.error(`Falha no pagamento: ${err?.message || 'Erro inesperado'}`);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Header Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
                <span>Gestão de Cartões de Crédito</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                  Estilo Banco do Brasil
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Selecione ou deslize o carrossel de cartões para filtrar despesas, faturas e limites em tempo real.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            <span>Atualizar Painel</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs: ALL, PF, PJ */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setFilterTab('ALL');
              setSelectedCardId('ALL');
            }}
            className={cn(
              'px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
              filterTab === 'ALL'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Todos os Cartões ({accounts.filter((a) => a.accountType === 'CREDIT_CARD').length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterTab('PF');
              setSelectedCardId('ALL');
            }}
            className={cn(
              'px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
              filterTab === 'PF'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <User className="h-3.5 w-3.5" />
            <span>Cartões PF (Pessoal)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterTab('PJ');
              setSelectedCardId('ALL');
            }}
            className={cn(
              'px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5',
              filterTab === 'PJ'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Cartões PJ (Empresas)</span>
          </button>
        </div>
      </div>

      {/* BANCO DO BRASIL STYLE CREDIT CARD CAROUSEL */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider text-[11px]">
            <Layers className="h-4 w-4 text-blue-400" />
            Cartões de Crédito (Clique para Selecionar e Filtrar)
          </span>

          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-mono text-[11px] hidden sm:inline">
              {selectedCardId === 'ALL'
                ? 'Mostrando Visão Consolidada'
                : `Filtrado por: ${selectedCardAccount?.name}`}
            </span>

            {/* Carousel Navigation Arrows */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg shadow-sm">
              <button
                type="button"
                onClick={() => scrollCarousel('left')}
                title="Rolar para esquerda"
                className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="w-[1px] h-3 bg-slate-800" />
              <button
                type="button"
                onClick={() => scrollCarousel('right')}
                title="Rolar para direita"
                className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={carouselRef}
          className="relative w-full overflow-x-auto pt-3.5 pb-5 px-3 no-scrollbar scroll-smooth"
        >
          <div className="flex items-center gap-4 min-w-max">

            {/* Carousel Item 0: ALL CARDS (Consolidado) */}
            <div
              onClick={() => setSelectedCardId('ALL')}
              className={cn(
                'relative w-72 h-44 rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 border shadow-xl flex-shrink-0 group overflow-hidden credit-card-3d-skin',
                selectedCardId === 'ALL'
                  ? 'border-blue-400 shadow-blue-950/90 ring-4 ring-blue-500/70 scale-[1.03] z-20'
                  : 'border-slate-800 opacity-85 hover:opacity-100 hover:scale-[1.01]'
              )}
            >
              {/* Card Background Gradient & Glass Overlay */}
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 via-indigo-900 to-purple-950" />
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[0.5px] credit-card-glass-overlay" />

              {/* Card Content */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <BarChart3 className="h-5 w-5 text-indigo-300 flex-shrink-0" />
                  <span className="text-xs font-black uppercase text-white tracking-wider drop-shadow-sm truncate max-w-[130px]">
                    Visão Consolidada
                  </span>
                </div>
                {selectedCardId === 'ALL' ? (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500 text-white uppercase shadow animate-pulse flex-shrink-0">
                    Ativo
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-200 border border-indigo-500/50 flex-shrink-0">
                    {creditCardAccounts.length} Cartões
                  </span>
                )}
              </div>

              <div className="relative z-10 my-0.5">
                <div className="text-[9px] text-indigo-200 uppercase font-bold tracking-wider">
                  Faturas Abertas Acumuladas
                </div>
                <div className="text-xl font-extrabold font-mono text-white drop-shadow-sm truncate">
                  {kpis.totalOpenStatement.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>

              <div className="relative z-10 flex items-center justify-between text-[10px] text-indigo-200 border-t border-white/20 pt-2 font-mono">
                <span className="truncate max-w-[170px]">Limite Livre: {kpis.totalAvailableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                <span className="font-bold text-emerald-400 flex-shrink-0">Ver Todos &rarr;</span>
              </div>
            </div>

            {/* Carousel Items: Credit Card Cards (Banco do Brasil 3D Skin Style) */}
            {creditCardAccounts.map((acc) => {
              const metrics = calculateCreditCardMetrics(acc, transactions);
              const skin = getCardSkin(acc);
              const isSelected = selectedCardId === acc.id;
              const isPJ = acc.entityId !== '11111111-1111-1111-1111-111111111111' && acc.entityId !== 'PF';

              return (
                <div
                  key={acc.id}
                  onClick={() => setSelectedCardId(acc.id)}
                  className={cn(
                    'relative w-72 h-44 rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 border shadow-xl flex-shrink-0 group overflow-hidden credit-card-3d-skin',
                    isSelected
                      ? 'border-blue-400 shadow-blue-950/90 ring-4 ring-blue-500/70 scale-[1.03] z-20'
                      : 'border-slate-800 hover:border-slate-700 hover:scale-[1.01]'
                  )}
                  style={{
                    backgroundColor: skin.isImage ? '#0f172a' : undefined,
                  }}
                >
                  {/* Card Background Gradient or Image */}
                  {skin.isImage ? (
                    <img
                      src={skin.imageUrl}
                      alt={acc.name}
                      className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div
                      className={cn(
                        'absolute inset-0 bg-gradient-to-br transition-all duration-300',
                        skin.gradient
                      )}
                    />
                  )}

                  {/* Dark Glass Overlay for text readability on 3D Card */}
                  <div className="absolute inset-0 bg-black/45 backdrop-blur-[0.5px] credit-card-glass-overlay" />

                  {/* Top Row: Brand / Logo & Entity Badge */}
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full border border-white/40 shadow-sm"
                        style={{ backgroundColor: skin.color }}
                      />
                      <span className="text-xs font-black text-white tracking-wide truncate max-w-[140px]">
                        {acc.name}
                      </span>
                    </div>

                    <span
                      className={cn(
                        'text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase backdrop-blur-md shadow-sm',
                        isPJ
                          ? 'bg-purple-950/80 text-purple-200 border-purple-500/50'
                          : 'bg-emerald-950/80 text-emerald-200 border-emerald-500/50'
                      )}
                    >
                      {(() => {
                        const comp = pjEntities.find((e) => e.id === acc.entityId);
                        return comp ? `PJ (${comp.name})` : isPJ ? 'PJ' : 'PF';
                      })()}
                    </span>
                  </div>

                  {/* Middle Row: Chip & Contactless icons */}
                  <div className="relative z-10 flex items-center justify-between opacity-85 my-1">
                    <div className="w-8 h-6 rounded bg-gradient-to-tr from-amber-200 via-amber-400 to-amber-100 border border-amber-600/60 shadow-inner flex items-center justify-center">
                      <div className="w-5 h-4 border border-amber-800/40 rounded-sm" />
                    </div>
                    <Wifi className="h-4 w-4 text-white/70 rotate-90" />
                  </div>

                  {/* Bottom Row: Fatura Aberta & Dates */}
                  <div className="relative z-10 space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[9px] text-slate-200 font-bold uppercase tracking-wider">
                        Fatura Aberta
                      </span>
                      <span className="text-[9px] font-mono text-slate-200">
                        Vence {metrics.currentStatementDueDate.split('-').reverse().join('/')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-base font-extrabold font-mono text-white drop-shadow-sm">
                        {metrics.openStatementTotal.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </div>

                      {isSelected && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500 text-white uppercase shadow animate-pulse">
                          Ativo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5 Executive KPIs Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">

        {/* KPI 1: Fatura Aberta Atual */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
              Fatura Aberta Atual
            </span>
            <div className="p-1.5 rounded-lg bg-amber-950/80 border border-amber-800/60 text-amber-400">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-100">
            {(selectedCardAccount
              ? calculateCreditCardMetrics(selectedCardAccount, transactions).openStatementTotal
              : kpis.totalOpenStatement
            ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-[10px] text-slate-500">
            {selectedCardAccount ? `Fatura de ${selectedCardAccount.name}` : 'Total consolidado de cartões'}
          </p>
        </div>

        {/* KPI 2: Comprometimento Futuro */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
              Parcelamentos Futuros
            </span>
            <div className="p-1.5 rounded-lg bg-blue-950/80 border border-blue-800/60 text-blue-400">
              <CalendarClock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-100">
            {(selectedCardAccount
              ? calculateCreditCardMetrics(selectedCardAccount, transactions).futureStatementsTotal
              : kpis.totalFutureStatements
            ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-[10px] text-slate-500">
            Parcelas contratadas em ciclos posteriores.
          </p>
        </div>

        {/* KPI 3: Limite Disponível vs. Total */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
              Limite Disponível
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-400">
            {(selectedCardAccount
              ? calculateCreditCardMetrics(selectedCardAccount, transactions).availableLimit
              : kpis.totalAvailableLimit
            ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>
                {selectedCardAccount
                  ? calculateCreditCardMetrics(selectedCardAccount, transactions).limitUsagePercentage
                  : kpis.globalLimitUsagePercentage}% uso
              </span>
              <span>
                Total: {(selectedCardAccount
                  ? calculateCreditCardMetrics(selectedCardAccount, transactions).creditLimit
                  : kpis.totalCreditLimit
                ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${selectedCardAccount
                      ? calculateCreditCardMetrics(selectedCardAccount, transactions).limitUsagePercentage
                      : kpis.globalLimitUsagePercentage
                    }%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* KPI 4: Comprometimento da Renda */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
              Comprometimento Renda
            </span>
            <div
              className={cn(
                'p-1.5 rounded-lg border',
                kpis.isIncomeCommitmentHigh
                  ? 'bg-rose-950/80 border-rose-800/60 text-rose-400'
                  : 'bg-emerald-950/80 border-emerald-800/60 text-emerald-400'
              )}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div
              className={cn(
                'text-xl sm:text-2xl font-extrabold font-mono',
                kpis.isIncomeCommitmentHigh ? 'text-rose-400' : 'text-slate-100'
              )}
            >
              {monthlyIncome > 0 ? `${kpis.incomeCommitmentPercentage}%` : 'N/A'}
            </div>
            {kpis.isIncomeCommitmentHigh && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950 text-rose-300 border border-rose-800 uppercase animate-pulse">
                Alerta &gt;30%
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500">
            {monthlyIncome > 0
              ? `Receita do mês: ${monthlyIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
              : 'Registre receitas para obter a %.'}
          </p>
        </div>

        {/* KPI 5: Melhor Dia de Compra */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
              Melhor Dia de Compra
            </span>
            <div className="p-1.5 rounded-lg bg-purple-950/80 border border-purple-800/60 text-purple-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          {kpis.bestCardToUseToday ? (
            <div>
              <div className="text-sm font-bold text-purple-300 truncate">
                {kpis.bestCardToUseToday.name}
              </div>
              <div className="text-[11px] text-slate-300 font-medium">
                Fechamento em {kpis.bestCardDaysUntilClosing} dia(s)
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">Nenhum cartão cadastrado</div>
          )}
          <p className="text-[10px] text-slate-500">
            Garante maior prazo para pagamento.
          </p>
        </div>

      </div>

      {/* SELECTED CARD ACTION & DETAILS BANNER (if a specific card is selected) */}
      {selectedCardAccount && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-blue-500/30 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white shadow-md border border-white/20 flex-shrink-0"
              style={{ backgroundColor: selectedCardAccount.colorHex || '#3b82f6' }}
            >
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-100">
                  {selectedCardAccount.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedCardId('ALL')}
                  className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  Limpar Filtro &times;
                </button>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Fechamento dia {selectedCardAccount.closingDay || 25} | Vencimento dia {selectedCardAccount.dueDay || 5}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setClosingInvoiceAccount(selectedCardAccount)}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 border border-slate-700"
            >
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span>Gerenciar / Fechar Fatura</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const metrics = calculateCreditCardMetrics(selectedCardAccount, transactions);
                setPayingCardAccount(selectedCardAccount);
                setPayAmount(metrics.openStatementTotal.toString());
                if (checkingAccounts.length > 0) setPaySourceAccId(checkingAccounts[0].id);
              }}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Receipt className="h-4 w-4" />
              <span>Pagar Fatura Direta</span>
            </button>
          </div>
        </div>
      )}

      {/* Closed & Paid Invoices + Pending Purchases Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">

        {/* Invoices (Fechadas & Histórico de Pagas) */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          
          {/* Header & Sub-tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-blue-400" />
              <span>Faturas do Cartão</span>
            </h3>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setInvoiceTab('CLOSED')}
                className={cn(
                  'px-3 py-1 rounded-lg transition-all flex items-center gap-1.5',
                  invoiceTab === 'CLOSED'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800/60 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span>A Vencer ({filteredClosedInvoices.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setInvoiceTab('PAID')}
                className={cn(
                  'px-3 py-1 rounded-lg transition-all flex items-center gap-1.5',
                  invoiceTab === 'PAID'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Pagas ({filteredPaidInvoices.length})</span>
              </button>
            </div>
          </div>

          {/* CLOSED Invoices Tab Content */}
          {invoiceTab === 'CLOSED' && (
            <>
              {filteredClosedInvoices.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs italic bg-slate-950/40 rounded-xl border border-slate-800/80 p-4">
                  Nenhuma fatura fechada a vencer para o filtro selecionado.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {filteredClosedInvoices.map((inv) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isOverdue = inv.dueDate < todayStr;

                    return (
                      <div
                        key={inv.id}
                        className={cn(
                          'p-3 rounded-xl border text-xs flex items-center justify-between gap-3 transition-all',
                          isOverdue
                            ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                            : 'bg-blue-950/40 border-blue-500/30 text-blue-200'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-blue-300 truncate">
                            [Fatura] {inv.accountName || 'Cartão'} - {inv.referenceMonth}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                            <span>Vence {inv.dueDate.split('-').reverse().join('/')}</span>
                            <span className="font-bold text-slate-100">
                              {inv.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            {isOverdue && (
                              <span className="text-[9px] font-bold text-rose-400 uppercase">Vencida</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleViewInvoiceItems(inv)}
                            title="Ver lançamentos desta fatura"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors flex items-center gap-1"
                          >
                            <Eye className="h-3.5 w-3.5 text-blue-400" />
                            <span className="hidden sm:inline">Itens</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPayingInvoice(inv);
                              setPayAmount(inv.totalAmount.toString());
                              if (checkingAccounts.length > 0) setPaySourceAccId(checkingAccounts[0].id);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Baixa</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* PAID Invoices Tab Content (Histórico de Faturas Pagas) */}
          {invoiceTab === 'PAID' && (
            <>
              {filteredPaidInvoices.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs italic bg-slate-950/40 rounded-xl border border-slate-800/80 p-4">
                  Nenhuma fatura paga encontrada no histórico.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {filteredPaidInvoices.map((inv) => {
                    return (
                      <div
                        key={inv.id}
                        className="p-3 rounded-xl bg-slate-950/70 border border-emerald-900/40 text-xs flex items-center justify-between gap-3 hover:border-emerald-700/60 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-300 truncate">
                              [Fatura Paga] {inv.accountName || 'Cartão'} - {inv.referenceMonth}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase flex-shrink-0">
                              Quitada
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                            <span>Vencimento: {inv.dueDate.split('-').reverse().join('/')}</span>
                            <span className="font-bold text-emerald-400">
                              {inv.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleViewInvoiceItems(inv)}
                          title="Ver lançamentos desta fatura paga"
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 flex-shrink-0 border border-slate-700"
                        >
                          <Eye className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Ver Itens</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

        </div>

        {/* Detailed Pending Card Transactions Audit List */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-400" />
              <span>Compras Abertas no Cartão ({filteredCardTransactions.length})</span>
            </h3>
          </div>

          {filteredCardTransactions.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs italic bg-slate-950/40 rounded-xl border border-slate-800/80 p-4">
              Nenhuma compra aberta no cartão para este filtro.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredCardTransactions.map((tx) => {
                const acc = accounts.find((a) => a.id === tx.accountId);
                return (
                  <div
                    key={tx.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-200 truncate">{tx.description}</div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>{tx.transactionDate.split('-').reverse().join('/')}</span>
                        {acc && (
                          <span className="text-blue-400 font-medium">({acc.name})</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-bold font-mono text-sm text-slate-100">
                        {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteInvoiceItem(tx.id, tx.description)}
                        title="Excluir Lançamento do Cartão"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Invoice Close Checklist Modal */}
      {closingInvoiceAccount && (
        <InvoiceCloseModal
          isOpen={!!closingInvoiceAccount}
          onClose={() => setClosingInvoiceAccount(null)}
          account={closingInvoiceAccount}
          onSuccess={loadData}
        />
      )}

      {/* Pay Credit Card Invoice Modal */}
      {(payingCardAccount || payingInvoice) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4">

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-400" />
                Liquidação de Fatura — {payingCardAccount?.name || payingInvoice?.accountName}
              </h3>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="text-slate-400 flex justify-between">
                <span>Destino:</span>
                <strong className="text-blue-400 font-bold">
                  {payingCardAccount?.name || payingInvoice?.accountName}
                </strong>
              </div>
              {payingInvoice && (
                <div className="text-slate-400 flex justify-between font-mono">
                  <span>Mês Referência:</span>
                  <strong className="text-slate-200">{payingInvoice.referenceMonth}</strong>
                </div>
              )}
            </div>

            {/* Select Source Checking Account */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Selecione a Conta Corrente para Débito
              </label>
              <select
                value={paySourceAccId}
                onChange={(e) => setPaySourceAccId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="">Selecione uma conta bancária...</option>
                {checkingAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Amount Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Valor do Pagamento (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPayingCardAccount(null);
                  setPayingInvoice(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handlePayConfirm}
                disabled={isSubmittingPay || !paySourceAccId}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-1.5"
              >
                {isSubmittingPay ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>Confirmar Baixa em Lote</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Invoice Details / Items Modal */}
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
                    <span>Detalhamento da Fatura ({viewingInvoice.referenceMonth})</span>
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border',
                        viewingInvoice.status === 'PAID'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      )}
                    >
                      {viewingInvoice.status === 'PAID' ? 'Quitada' : 'Fechada (A Vencer)'}
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

            {/* Total Amount Summary */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs flex-shrink-0">
              <span className="text-slate-400 font-semibold">Valor Total Faturado:</span>
              <strong className="text-lg font-mono font-extrabold text-emerald-400">
                {viewingInvoice.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </strong>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
              {isLoadingInvoiceItems ? (
                <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                  <span>Carregando lançamentos vinculados a esta fatura...</span>
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
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-100 truncate">{item.description}</div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span>{item.transactionDate.split('-').reverse().join('/')}</span>
                            {cat && (
                              <span className="text-slate-400 font-sans">| {cat.name}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right font-mono font-bold text-sm text-slate-100">
                            {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteInvoiceItem(item.id, item.description)}
                            title="Excluir Lançamento Duplicado"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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

    </div>
  );
}
