'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CreditCard,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Wallet,
  Building2,
  User,
  ShieldAlert,
  ArrowRight,
  DollarSign,
  Trash2,
  Edit2,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';
import { Account, Debt, DebtInstallment, Transaction } from '@/types/finance';
import {
  createDebtWithInstallments,
  deleteDebt,
  updateDebt,
  fetchAccounts,
  fetchDebts,
  fetchTransactions,
  payDebtInstallment,
  updateTransaction,
  migrateDebtToInvestment,
} from '@/lib/services/finance-service';
import { CurrencyInput } from '@/components/ui/currency-input';
import { cn } from '@/lib/utils';
import { useToast } from '@/contexts/toast-context';

export default function DebtsPage() {
  const { entity, config, isHydrated } = useEntity();
  const { toast, confirm } = useToast();

  const [debts, setDebts] = useState<Debt[]>([]);
  const [pendingTxs, setPendingTxs] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Accordion state for expanded debt details
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);

  // Payment modal state for debt installment
  const [payingInstallment, setPayingInstallment] = useState<{
    installment: DebtInstallment;
    debt: Debt;
  } | null>(null);

  // Payment modal state for pending transaction
  const [payingTx, setPayingTx] = useState<Transaction | null>(null);

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Edit Debt modal state
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editCreditor, setEditCreditor] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTotalAmount, setEditTotalAmount] = useState<string>('');
  const [editInstallmentsCount, setEditInstallmentsCount] = useState<string>('');
  const [editInterestRate, setEditInterestRate] = useState<string>('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editTargetEntity, setEditTargetEntity] = useState<'PF' | 'PJ'>('PF');
  const [isSubmittingEditDebt, setIsSubmittingEditDebt] = useState(false);

  // New Debt modal state
  const [showNewDebtModal, setShowNewDebtModal] = useState(false);
  const [creditor, setCreditor] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState<string>('12000');
  const [installmentsCount, setInstallmentsCount] = useState<string>('12');
  const [interestRate, setInterestRate] = useState<string>('1.0');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetEntity, setTargetEntity] = useState<'PF' | 'PJ'>(entity === 'PJ' ? 'PJ' : 'PF');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [debtsData, accountsData, allTxs] = await Promise.all([
        fetchDebts(entity),
        fetchAccounts(entity),
        fetchTransactions({ entityType: entity }),
      ]);
      setDebts(debtsData);
      setAccounts(accountsData);
      setPendingTxs(allTxs.filter((t) => t.status === 'PENDING'));
      if (accountsData.length > 0) {
        setSelectedAccountId((prev) => prev || accountsData[0].id);
      }
    } catch (err) {
      console.error('Error loading debts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [entity]);

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

  // Executive summary computations
  const summary = useMemo(() => {
    let totalConsolidatedDebt = 0;
    let dueThisMonthTotal = 0;

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    debts.forEach((debt) => {
      debt.installments?.forEach((inst) => {
        if (inst.status === 'PENDING') {
          totalConsolidatedDebt += inst.amount;
          if (inst.dueDate.startsWith(currentMonth)) {
            dueThisMonthTotal += inst.amount;
          }
        }
      });
    });

    pendingTxs.forEach((tx) => {
      if (tx.type === 'EXPENSE') {
        totalConsolidatedDebt += tx.amount;
        if (tx.transactionDate.startsWith(currentMonth)) {
          dueThisMonthTotal += tx.amount;
        }
      }
    });

    // Income commitment thermometer (estimate income baseline)
    const estimatedMonthlyIncome = entity === 'PJ' ? 48900 : 12500;
    const commitmentPercentage =
      estimatedMonthlyIncome > 0 ? Math.round((dueThisMonthTotal / estimatedMonthlyIncome) * 100) : 0;

    return {
      totalConsolidatedDebt,
      dueThisMonthTotal,
      commitmentPercentage,
    };
  }, [debts, pendingTxs, entity]);

  const handlePayInstallmentSubmit = async () => {
    if (!payingInstallment || !selectedAccountId) return;
    setIsSubmittingPay(true);
    try {
      await payDebtInstallment(payingInstallment.installment.id, selectedAccountId, payDate);
      toast.success(`Parcela de ${payingInstallment.installment.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} baixada com sucesso!`, 'Pagamento Realizado');
      setPayingInstallment(null);
      window.dispatchEvent(new CustomEvent('transactionUpdated'));
      await loadData();
    } catch (err) {
      console.error('Error paying installment:', err);
      toast.error('Erro ao processar pagamento da parcela.');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handlePayTxSubmit = async () => {
    if (!payingTx || !selectedAccountId) return;
    setIsSubmittingPay(true);
    try {
      await updateTransaction(payingTx.id, {
        status: 'PAID',
        accountId: selectedAccountId,
        transactionDate: payDate,
      });
      toast.success(`Lançamento "${payingTx.description}" baixado e debitado na conta!`, 'Pagamento Confirmado');
      setPayingTx(null);
      window.dispatchEvent(new CustomEvent('transactionUpdated'));
      await loadData();
    } catch (err: any) {
      console.error('Error paying pending transaction:', err);
      toast.error(`Erro ao dar baixa no lançamento: ${err?.message || 'Falha na gravação'}`);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleDeleteDebt = async (debtId: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Dívida / Financiamento',
      message: 'Deseja excluir este contrato de dívida e todas as suas parcelas? Esta ação é irreversível.',
      confirmText: 'Excluir Contrato',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed) {
      await deleteDebt(debtId);
      toast.success('Contrato de dívida excluído.', 'Dívida Excluída');
      await loadData();
    }
  };

  const handleCreateDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditor.trim() || !totalAmount || !installmentsCount) return;

    const targetEntityId =
      targetEntity === 'PJ'
        ? '22222222-2222-2222-2222-222222222222'
        : '11111111-1111-1111-1111-111111111111';

    await createDebtWithInstallments({
      entityId: targetEntityId,
      creditor,
      description,
      totalAmount: parseFloat(totalAmount),
      installmentsCount: parseInt(installmentsCount, 10),
      interestRateMonthly: parseFloat(interestRate) || 0,
      startDate,
    });

    setShowNewDebtModal(false);
    setCreditor('');
    setDescription('');
    toast.success(`Dívida com ${creditor} cadastrada com sucesso!`, 'Dívida Registrada');
    await loadData();
  };
  const handleOpenEditDebt = (debt: Debt) => {
    setEditingDebt(debt);
    setEditCreditor(debt.creditor);
    setEditDescription(debt.description || '');
    setEditTotalAmount(debt.totalAmount.toString());
    setEditInstallmentsCount(debt.installmentsCount.toString());
    setEditInterestRate((debt.interestRateMonthly || 0).toString());
    setEditStartDate(debt.startDate);
    const isPJ = debt.entityId === 'PJ' || debt.entityId === '22222222-2222-2222-2222-222222222222';
    setEditTargetEntity(isPJ ? 'PJ' : 'PF');
  };

  const handleEditDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebt || !editCreditor.trim() || !editTotalAmount || !editInstallmentsCount) return;

    setIsSubmittingEditDebt(true);
    try {
      const targetEntityId = editTargetEntity === 'PJ'
        ? '22222222-2222-2222-2222-222222222222'
        : '11111111-1111-1111-1111-111111111111';

      await updateDebt(editingDebt.id, {
        entityId: targetEntityId,
        creditor: editCreditor,
        description: editDescription,
        totalAmount: parseFloat(editTotalAmount),
        installmentsCount: parseInt(editInstallmentsCount, 10),
        interestRateMonthly: parseFloat(editInterestRate) || 0,
        startDate: editStartDate,
      });

      setEditingDebt(null);
      toast.success(`Dívida "${editCreditor}" atualizada com sucesso!`, 'Edição Concluída');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('transactionUpdated'));
      }
      await loadData();
    } finally {
      setIsSubmittingEditDebt(false);
    }
  };

  const handleMigrateDebt = async (debt: Debt) => {
    const isConfirmed = await confirm({
      title: 'Migrar para Investimentos?',
      message: `Deseja converter o registro "${debt.creditor}" em um Investimento ativo e removê-lo da tela de dívidas?`,
      confirmText: 'Sim, Migrar para Investimentos',
      cancelText: 'Cancelar',
      variant: 'primary',
    });

    if (!isConfirmed) return;

    try {
      await migrateDebtToInvestment(debt.id);
      toast.success(`Dívida "${debt.creditor}" migrada com sucesso para o Módulo de Investimentos!`, 'Migração Concluída');
      await loadData();
    } catch (err: any) {
      console.error('Error migrating debt:', err);
      toast.error(`Falha ao migrar dívida: ${err?.message || 'Erro inesperado'}`);
    }
  };

  if (!isHydrated) return null;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-3">
            <CreditCard className="h-7 w-7 text-blue-400" />
            Gestão de Dívidas e Financiamentos
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Controle de parcelamentos, passivos e quitação para <strong className={config.textColor}>{config.label}</strong>
          </p>
        </div>

        <button
          onClick={() => setShowNewDebtModal(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Cadastrar Nova Dívida</span>
        </button>
      </div>

      {/* Executive Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Total Dívida Consolidada */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Dívida Restante Total
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono">
            {summary.totalConsolidatedDebt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-[11px] text-slate-400">Soma das parcelas vincendas dos contratos ativos</p>
        </div>

        {/* Parcelas a Vencer no Mês */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Vencimentos Neste Mês
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
            {summary.dueThisMonthTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-[11px] text-slate-400">Total comprometido no mês corrente</p>
        </div>

        {/* Termômetro de Comprometimento de Renda */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Comprometimento de Renda
          </span>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'text-2xl sm:text-3xl font-extrabold font-mono',
                summary.commitmentPercentage > 35
                  ? 'text-rose-400'
                  : summary.commitmentPercentage > 20
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              )}
            >
              {summary.commitmentPercentage}%
            </div>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                summary.commitmentPercentage > 35
                  ? 'bg-rose-950 text-rose-400 border border-rose-500/40'
                  : 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
              )}
            >
              {summary.commitmentPercentage > 35 ? 'Atenção Elevada' : 'Nível Saudável'}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all',
                summary.commitmentPercentage > 35 ? 'bg-rose-500' : 'bg-emerald-500'
              )}
              style={{ width: `${Math.min(100, summary.commitmentPercentage)}%` }}
            />
          </div>
        </div>

      </div>

      {/* Faturas, Boletos Vencidos e Débitos Pendentes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            Faturas, Boletos Vencidos e Débitos Pendentes ({pendingTxs.length})
          </h2>
          <span className="text-xs text-slate-400">
            Lançamentos a vencer só são debitados da conta após a confirmação do pagamento
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Clock className="h-4 w-4 animate-spin text-blue-400" />
            <span>Carregando boletos e débitos pendentes...</span>
          </div>
        ) : pendingTxs.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Nenhuma fatura ou boleto pendente de pagamento para esta entidade.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingTxs.map((tx) => {
              const todayStr = new Date().toISOString().split('T')[0];
              const isOverdue = tx.transactionDate < todayStr;
              const isToday = tx.transactionDate === todayStr;

              return (
                <div
                  key={tx.id}
                  className={cn(
                    'p-4 rounded-2xl border shadow-lg flex flex-col justify-between gap-3 transition-all',
                    isOverdue
                      ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/60'
                      : isToday
                      ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500/60'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  )}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-200 truncate">{tx.description}</span>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border font-mono flex items-center gap-1',
                          isOverdue
                            ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                            : isToday
                            ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                            : 'bg-slate-800 text-blue-300 border-slate-700'
                        )}
                      >
                        {isOverdue && <AlertTriangle className="h-3 w-3 text-rose-400" />}
                        {isOverdue ? 'Vencido' : isToday ? 'Vence Hoje' : 'A Vencer'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>Vencimento: {tx.transactionDate}</span>
                      <span className="font-semibold text-slate-300">{tx.type === 'EXPENSE' ? 'Despesa' : 'Receita'}</span>
                    </div>

                    <div className="text-xl font-extrabold font-mono text-slate-100 pt-1">
                      {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPayingTx(tx);
                      if (tx.accountId) setSelectedAccountId(tx.accountId);
                    }}
                    className="w-full mt-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Dar Baixa (Confirmar Pagamento)</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Debts List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          Contratos e Dívidas Ativas ({debts.length})
        </h2>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Clock className="h-4 w-4 animate-spin text-blue-400" />
            <span>Carregando grade de parcelamentos...</span>
          </div>
        ) : debts.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
            Nenhuma dívida cadastrada para esta entidade.
          </div>
        ) : (
          debts.map((debt) => {
            const installments = debt.installments || [];
            const paidCount = installments.filter((i) => i.status === 'PAID').length;
            const totalCount = debt.installmentsCount;
            const progressPercent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
            const isExpanded = expandedDebtId === debt.id;

            return (
              <div
                key={debt.id}
                className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden transition-all"
              >
                {/* Debt Card Header */}
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-100">{debt.creditor}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-800 text-blue-400 border border-slate-700">
                        {debt.status === 'PAID_OFF' ? 'Quitado' : 'Ativo'}
                      </span>
                    </div>
                    {debt.description && (
                      <p className="text-xs text-slate-400">{debt.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Valor Contratado</div>
                      <div className="text-sm font-bold font-mono text-slate-100">
                        {debt.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>

                    <div className="w-36 space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Progresso</span>
                        <span>{paidCount}/{totalCount} ({progressPercent}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedDebtId(isExpanded ? null : debt.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 transition-colors"
                    >
                      <span>{isExpanded ? 'Ocultar Grade' : 'Ver Parcelas'}</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    <button
                      onClick={() => handleMigrateDebt(debt)}
                      title="Migrar para Módulo de Investimentos"
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-800/60 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Migrar p/ Investimento</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditDebt(debt)}
                      title="Editar Dívida / Financiamento"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteDebt(debt.id)}
                      title="Excluir Dívida"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expandable Grade of Installments */}
                {isExpanded && (
                  <div className="p-5 bg-slate-950 border-t border-slate-800 space-y-3 animate-in fade-in duration-200">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Grade Completa de Parcelas
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      {installments.map((inst) => {
                        const isPaid = inst.status === 'PAID';
                        return (
                          <div
                            key={inst.id}
                            className={cn(
                              'p-3 rounded-xl border flex items-center justify-between transition-all',
                              isPaid
                                ? 'bg-slate-900/40 border-slate-800/60 opacity-80'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            )}
                          >
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                                <span>Parcela #{inst.installmentNumber}</span>
                                {isPaid && (
                                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                                    <CheckCircle2 className="h-3 w-3" /> Pago
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                Vencimento: {inst.dueDate}
                              </div>
                              <div className="font-bold text-slate-100 font-mono">
                                {inst.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </div>
                            </div>

                            {!isPaid && (
                              <button
                                type="button"
                                onClick={() => setPayingInstallment({ installment: inst, debt })}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1"
                              >
                                <span>Pagar</span>
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pay Pending Transaction Modal */}
      {payingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-400" />
              Dar Baixa no Débito Pendente
            </h3>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <div className="text-slate-400">Descrição: <strong className="text-slate-200">{payingTx.description}</strong></div>
              <div className="text-slate-400">Valor a Debitar: <strong className="text-emerald-400 font-mono text-sm">{payingTx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
              <div className="text-slate-400">Vencimento Original: <strong className="text-slate-300 font-mono">{payingTx.transactionDate}</strong></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Selecione a Conta Bancária para Débito
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-medium focus:outline-none focus:border-emerald-500"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (Saldo: {acc.currentBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                Data da Efetivação / Pagamento
              </label>
              <input
                type="date"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-medium focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPayingTx(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePayTxSubmit}
                disabled={isSubmittingPay}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 shadow-md"
              >
                {isSubmittingPay ? 'Efetuando débito...' : 'Confirmar e Debitar Saldo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Installment Modal */}
      {payingInstallment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-400" />
              Liquidação de Parcela #{payingInstallment.installment.installmentNumber}
            </h3>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <div className="text-slate-400">Contrato: <strong className="text-slate-200">{payingInstallment.debt.creditor}</strong></div>
              <div className="text-slate-400">Valor da Parcela: <strong className="text-emerald-400 font-mono text-sm">{payingInstallment.installment.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Selecione a Conta Bancária para Débito
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-medium focus:outline-none focus:border-emerald-500"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (Saldo: {acc.currentBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                Data do Pagamento
              </label>
              <input
                type="date"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-medium focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPayingInstallment(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePayInstallmentSubmit}
                disabled={isSubmittingPay}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 shadow-md"
              >
                {isSubmittingPay ? 'Efetuando débito...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Debt Modal */}
      {showNewDebtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateDebtSubmit}
            className="w-full max-w-lg p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-400" />
              Cadastrar Nova Dívida / Financiamento
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Credor / Instituição</label>
                <input
                  type="text"
                  required
                  value={creditor}
                  onChange={(e) => setCreditor(e.target.value)}
                  placeholder="Ex: Itaú, Caixa, Fornecedor X"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Entidade</label>
                <select
                  value={targetEntity}
                  onChange={(e) => setTargetEntity(e.target.value as 'PF' | 'PJ')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                >
                  <option value="PF">Pessoa Física (PF)</option>
                  <option value="PJ">Pessoa Jurídica (PJ)</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-slate-300 block">Descrição Opcional</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Financiamento de Veículo ou Máquina"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Valor Total</label>
                <CurrencyInput
                  value={totalAmount}
                  onChangeValue={(num) => setTotalAmount(num.toString())}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Nº de Parcelas</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="420"
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-bold focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Taxa Juros AM (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Data do 1º Vencimento</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewDebtModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-md"
              >
                Gerar Dívida e Parcelas
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Debt Modal */}
      {editingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleEditDebtSubmit}
            className="w-full max-w-lg p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-blue-400" />
              Editar Dívida / Financiamento
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Credor / Instituição</label>
                <input
                  type="text"
                  required
                  value={editCreditor}
                  onChange={(e) => setEditCreditor(e.target.value)}
                  placeholder="Ex: Itaú, Caixa, Fornecedor X"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Entidade</label>
                <select
                  value={editTargetEntity}
                  onChange={(e) => setEditTargetEntity(e.target.value as 'PF' | 'PJ')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                >
                  <option value="PF">Pessoa Física (PF)</option>
                  <option value="PJ">Pessoa Jurídica (PJ)</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-slate-300 block">Descrição Opcional</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Ex: Financiamento de Veículo ou Máquina"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Valor Total Contratado (R$)</label>
                <CurrencyInput
                  value={editTotalAmount}
                  onChangeValue={(num) => setEditTotalAmount(num.toString())}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Nº Total de Parcelas (até 420)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="420"
                  value={editInstallmentsCount}
                  onChange={(e) => setEditInstallmentsCount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 font-bold focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Taxa Juros AM (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editInterestRate}
                  onChange={(e) => setEditInterestRate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Data do 1º Vencimento</label>
                <input
                  type="date"
                  required
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingDebt(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingEditDebt}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-md"
              >
                {isSubmittingEditDebt ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
