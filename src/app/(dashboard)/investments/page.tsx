'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Plus,
  Search,
  Building2,
  User,
  Percent,
  DollarSign,
  PieChart,
  ShieldCheck,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Landmark,
  Wallet,
  Sparkles,
} from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';
import { useToast } from '@/contexts/toast-context';
import { Investment, InvestmentCategory } from '@/types/finance';
import { fetchInvestments, deleteInvestment, updateInvestment, migrateInvestmentToDebt } from '@/lib/services/finance-service';
import { InvestmentModal } from '@/components/investments/investment-modal';
import { cn } from '@/lib/utils';

const CATEGORY_CONFIG: Record<
  InvestmentCategory,
  { label: string; color: string; bg: string; border: string }
> = {
  RENDA_FIXA: {
    label: 'Renda Fixa',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  RESERVA_EMERGENCIA: {
    label: 'Reserva de Emergência',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
  },
  ACOES: {
    label: 'Ações / Renda Variável',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  FIIS: {
    label: 'Fundos Imobiliários (FIIs)',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  CRIPTO: {
    label: 'Criptomoedas',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  OUTROS: {
    label: 'Outros',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
  },
};

export default function InvestmentsPage() {
  const { entity, activeCompany } = useEntity();
  const { toast, confirm } = useToast();

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);

  // Modal para atualização rápida de saldo
  const [quickUpdateItem, setQuickUpdateItem] = useState<Investment | null>(null);
  const [quickNewBalance, setQuickNewBalance] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  const loadInvestments = async () => {
    try {
      setLoading(true);
      const data = await fetchInvestments(entity);
      setInvestments(data);
    } catch (err) {
      console.error('Erro ao carregar investimentos:', err);
      toast.error('Erro ao carregar lista de investimentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvestments();
  }, [entity]);

  // Filtragem de investimentos por texto e categoria
  const filteredInvestments = useMemo(() => {
    return investments.filter((inv) => {
      const matchesSearch =
        inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.institution.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.notes && inv.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory = selectedCategory === 'ALL' || inv.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [investments, searchTerm, selectedCategory]);

  // Indicadores Consolidados
  const metrics = useMemo(() => {
    const totalCurrent = filteredInvestments.reduce((sum, item) => sum + (item.currentAmount || 0), 0);
    const totalInitial = filteredInvestments.reduce((sum, item) => sum + (item.initialAmount || 0), 0);
    const totalProfit = totalCurrent - totalInitial;
    const profitPercentage = totalInitial > 0 ? (totalProfit / totalInitial) * 100 : 0;

    // Alocação por categoria
    const allocation: Record<string, number> = {};
    filteredInvestments.forEach((item) => {
      allocation[item.category] = (allocation[item.category] || 0) + (item.currentAmount || 0);
    });

    let topCategory = 'Nenhuma';
    let topCategoryAmount = 0;

    Object.entries(allocation).forEach(([cat, amount]) => {
      if (amount > topCategoryAmount) {
        topCategoryAmount = amount;
        topCategory = CATEGORY_CONFIG[cat as InvestmentCategory]?.label || cat;
      }
    });

    return {
      totalCurrent,
      totalInitial,
      totalProfit,
      profitPercentage,
      topCategory,
      topCategoryPercentage: totalCurrent > 0 ? (topCategoryAmount / totalCurrent) * 100 : 0,
      allocation,
    };
  }, [filteredInvestments]);

  const handleDelete = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Investimento',
      message: `Tem certeza que deseja excluir o investimento "${name}"? Essa ação não poderá ser desfeita.`,
      confirmText: 'Excluir Ativo',
      cancelText: 'Cancelar',
      variant: 'danger',
    });
    if (!isConfirmed) return;

    try {
      await deleteInvestment(id);
      toast.success('Investimento excluído com sucesso!');
      loadInvestments();
    } catch (err: any) {
      console.error('Erro ao deletar investimento:', err);
      toast.error(`Erro: ${err?.message || 'Falha ao excluir'}`);
    }
  };

  const handleMigrateToDebt = async (inv: Investment) => {
    const isConfirmed = await confirm({
      title: 'Migrar para Dívidas',
      message: `Deseja migrar o investimento "${inv.name}" para a página de Dívidas?\n\nEle será movido e cadastrado como uma dívida parcelada.`,
      confirmText: 'Migrar para Dívida',
      cancelText: 'Cancelar',
      variant: 'warning',
    });
    if (!isConfirmed) return;

    try {
      await migrateInvestmentToDebt(inv.id, 12);
      toast.success(`"${inv.name}" foi migrado para Dívidas com sucesso!`);
      loadInvestments();
    } catch (err: any) {
      console.error('Erro ao migrar investimento para dívida:', err);
      toast.error(`Falha ao migrar: ${err?.message || 'Erro desconhecido'}`);
    }
  };

  const handleQuickBalanceSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUpdateItem) return;

    const val = parseFloat(quickNewBalance.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      toast.error('Informe um valor de saldo válido.');
      return;
    }

    try {
      setQuickSaving(true);
      await updateInvestment(quickUpdateItem.id, { currentAmount: val });
      toast.success('Saldo atualizado com sucesso!');
      setQuickUpdateItem(null);
      setQuickNewBalance('');
      loadInvestments();
    } catch (err: any) {
      console.error('Erro ao atualizar saldo:', err);
      toast.error(`Erro: ${err?.message || 'Falha ao atualizar'}`);
    } finally {
      setQuickSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              Investimentos & Patrimônio
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {entity === 'PF' ? 'Pessoa Física' : entity === 'CONSOLIDATED' ? 'Consolidado' : activeCompany?.name || 'PJ'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Acompanhe suas aplicações financeiras, rentabilidade e alocação de ativos em tempo real.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingInvestment(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>+ Novo Investimento</span>
        </button>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Investido */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Patrimônio Investido</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-slate-100 font-mono tracking-tight">
              R$ {metrics.totalCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span>Total aplicado:</span>
            <span className="font-semibold text-slate-300">
              R$ {metrics.totalInitial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Card 2: Rendimento / Lucro Acumulado */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Rentabilidade Total</span>
            <div
              className={cn(
                'p-2 rounded-xl border',
                metrics.totalProfit >= 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              )}
            >
              {metrics.totalProfit >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={cn(
                'text-xl sm:text-2xl font-black font-mono tracking-tight',
                metrics.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {metrics.totalProfit >= 0 ? '+' : ''}R${' '}
              {metrics.totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span
              className={cn(
                'text-xs font-bold px-1.5 py-0.5 rounded-md',
                metrics.totalProfit >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              )}
            >
              {metrics.totalProfit >= 0 ? '+' : ''}
              {metrics.profitPercentage.toFixed(2)}%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">Ganho de capital acumulado sobre aportes</div>
        </div>

        {/* Card 3: Classe Predominante */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Maior Alocação</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <PieChart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-slate-100 truncate block">{metrics.topCategory}</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span>Representa:</span>
            <span className="font-semibold text-purple-300">{metrics.topCategoryPercentage.toFixed(1)}% da carteira</span>
          </div>
        </div>

        {/* Card 4: Total de Ativos */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Aplicações Ativas</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-slate-100 font-mono">
              {filteredInvestments.length}{' '}
              <span className="text-xs font-semibold text-slate-400 font-sans">
                {filteredInvestments.length === 1 ? 'ativo' : 'ativos'}
              </span>
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">Cadastrados e acompanhados</div>
        </div>
      </div>

      {/* Asset Allocation Bar */}
      {metrics.totalCurrent > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <PieChart className="h-4 w-4 text-emerald-400" />
              <span>Distribuição da Carteira por Classe</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Total R$ {metrics.totalCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Multi-segmented Progress Bar */}
          <div className="h-3.5 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800 p-0.5 gap-0.5">
            {Object.entries(metrics.allocation).map(([cat, amount]) => {
              const pct = (amount / metrics.totalCurrent) * 100;
              if (pct <= 0) return null;
              const cfg = CATEGORY_CONFIG[cat as InvestmentCategory] || CATEGORY_CONFIG.OUTROS;
              return (
                <div
                  key={cat}
                  style={{ width: `${pct}%` }}
                  className={cn('h-full rounded-sm transition-all relative group', cfg.bg.replace('/10', '/80'))}
                  title={`${cfg.label}: ${pct.toFixed(1)}% (R$ ${amount.toLocaleString('pt-BR')})`}
                />
              );
            })}
          </div>

          {/* Legend Badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(metrics.allocation).map(([cat, amount]) => {
              const pct = (amount / metrics.totalCurrent) * 100;
              if (pct <= 0) return null;
              const cfg = CATEGORY_CONFIG[cat as InvestmentCategory] || CATEGORY_CONFIG.OUTROS;
              return (
                <div
                  key={cat}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5',
                    cfg.bg,
                    cfg.color,
                    cfg.border
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-current" />
                  <span>{cfg.label}:</span>
                  <span className="font-mono font-bold">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls Bar: Category Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
        {/* Category Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
              selectedCategory === 'ALL'
                ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            Todos ({investments.length})
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
            const count = investments.filter((i) => i.category === key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(key)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border',
                  selectedCategory === key
                    ? `${cfg.bg} ${cfg.color} ${cfg.border} font-bold shadow-sm`
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                )}
              >
                {cfg.label} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por ativo ou corretora..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Main Content: Investments Grid / Table */}
      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <RefreshCw className="h-6 w-6 text-emerald-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Carregando investimentos...</p>
        </div>
      ) : filteredInvestments.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">Nenhum investimento encontrado</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchTerm || selectedCategory !== 'ALL'
                ? 'Tente ajustar os filtros ou os termos de busca.'
                : 'Cadastre sua primeira aplicação financeira para acompanhar o rendimento do seu patrimônio.'}
            </p>
          </div>
          {(!searchTerm && selectedCategory === 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setEditingInvestment(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Cadastrar Primeiro Investimento</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInvestments.map((inv) => {
            const cfg = CATEGORY_CONFIG[inv.category] || CATEGORY_CONFIG.OUTROS;
            const profit = inv.currentAmount - inv.initialAmount;
            const profitPct = inv.initialAmount > 0 ? (profit / inv.initialAmount) * 100 : 0;
            const isPj = inv.entityId !== 'PF' && inv.entityId !== '11111111-1111-1111-1111-111111111111';

            return (
              <div
                key={inv.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between group relative"
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider',
                            cfg.bg,
                            cfg.color,
                            cfg.border
                          )}
                        >
                          {cfg.label}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1',
                            isPj
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          )}
                        >
                          {isPj ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          <span>{isPj ? 'PJ' : 'PF'}</span>
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors leading-snug">
                        {inv.name}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">{inv.institution}</p>
                    </div>

                    {/* Yield Rate Pill */}
                    {inv.yieldRate && (
                      <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono font-bold text-amber-400 flex-shrink-0">
                        {inv.yieldRate}
                      </span>
                    )}
                  </div>

                  {/* Amounts & Profit Breakdown */}
                  <div className="my-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Saldo / Valor Atual</span>
                      <span className="font-mono font-bold text-slate-100 text-sm">
                        R$ {inv.currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                      <span className="text-slate-400">Aporte Inicial</span>
                      <span className="font-mono text-slate-300">
                        R$ {inv.initialAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                      <span className="text-slate-400">Rendimento</span>
                      <span
                        className={cn(
                          'font-mono font-bold flex items-center gap-1',
                          profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        )}
                      >
                        {profit >= 0 ? '+' : ''}R$ {profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (
                        {profit >= 0 ? '+' : ''}
                        {profitPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  {/* Notes if available */}
                  {inv.notes && (
                    <p className="text-[11px] text-slate-400 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/50 mb-3 line-clamp-2">
                      "{inv.notes}"
                    </p>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-500">
                    Aplicado em: {new Date(inv.startDate).toLocaleDateString('pt-BR')}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Botão de Atualização Rápida de Saldo */}
                    <button
                      type="button"
                      onClick={() => {
                        setQuickUpdateItem(inv);
                        setQuickNewBalance(String(inv.currentAmount));
                      }}
                      title="Atualizar Saldo Atual"
                      className="px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/60 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Saldo</span>
                    </button>

                    {/* Botão Migrar p/ Dívidas */}
                    <button
                      type="button"
                      onClick={() => handleMigrateToDebt(inv)}
                      title="Migrar para Dívidas"
                      className="px-2 py-1 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-400 hover:bg-amber-900/60 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Landmark className="h-3 w-3" />
                      <span>Dívida</span>
                    </button>

                    {/* Botão Editar */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingInvestment(inv);
                        setIsModalOpen(true);
                      }}
                      title="Editar Dados"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Botão Deletar */}
                    <button
                      type="button"
                      onClick={() => handleDelete(inv.id, inv.name)}
                      title="Excluir Ativo"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Principal de Cadastro / Edição */}
      <InvestmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        investment={editingInvestment}
        onSuccess={loadInvestments}
      />

      {/* Modal Rápido para Atualizar Saldo */}
      {quickUpdateItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">Atualizar Saldo Atual</h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickUpdateItem(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Informe o novo valor de mercado para <strong className="text-slate-200">{quickUpdateItem.name}</strong>:
            </p>

            <form onSubmit={handleQuickBalanceSave} className="space-y-4">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">R$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={quickNewBalance}
                  onChange={(e) => setQuickNewBalance(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickUpdateItem(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={quickSaving}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {quickSaving ? 'Salvando...' : 'Salvar Novo Saldo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
