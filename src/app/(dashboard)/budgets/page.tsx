'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PieChart,
  Calendar,
  Save,
  CheckCircle2,
  Clock,
  Plus,
  X,
  Target,
  Edit2,
  Layers,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';
import { useDateFilter } from '@/contexts/date-filter-context';
import { Budget, Category } from '@/types/finance';
import { createCategory, fetchBudgets, fetchCategories, upsertBudget } from '@/lib/services/finance-service';
import { CurrencyInput } from '@/components/ui/currency-input';
import { cn } from '@/lib/utils';

export default function BudgetsPage() {
  const { entity, config, isHydrated } = useEntity();
  const { filter } = useDateFilter();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selected Month (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(
    filter.startDate ? filter.startDate.slice(0, 7) : new Date().toISOString().slice(0, 7)
  );

  // Planning Modal State
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [plannedValues, setPlannedValues] = useState<Record<string, number>>({});
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  // New Category Inline Form State inside Planning Modal
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [budgetsData, categoriesData] = await Promise.all([
        fetchBudgets(entity, selectedMonth),
        fetchCategories(entity),
      ]);

      setBudgets(budgetsData);

      const expCategories = categoriesData.filter((c) => c.nature === 'EXPENSE' || !c.nature);
      setCategories(expCategories);

      // Populate plannedValues map
      const initialMap: Record<string, number> = {};
      budgetsData.forEach((b) => {
        initialMap[b.categoryId] = b.plannedAmount || 0;
      });
      setPlannedValues(initialMap);
    } catch (err) {
      console.error('Error loading budgets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [entity, selectedMonth]);

  useEffect(() => {
    if (isHydrated) {
      loadData();
    }
  }, [isHydrated, loadData]);

  // Totals & Summary
  const summary = useMemo(() => {
    let totalPlanned = 0;
    let totalSpent = 0;

    budgets.forEach((b) => {
      const val = plannedValues[b.categoryId] !== undefined ? Number(plannedValues[b.categoryId]) : b.plannedAmount || 0;
      totalPlanned += val;
      totalSpent += b.spentAmount || 0;
    });

    const remaining = Math.max(0, totalPlanned - totalSpent);
    const isOverBudget = totalSpent > totalPlanned && totalPlanned > 0;

    return {
      totalPlanned,
      totalSpent,
      remaining,
      isOverBudget,
    };
  }, [budgets, plannedValues]);

  // Open Planning Modal
  const handleOpenPlanningModal = () => {
    setShowPlanningModal(true);
  };

  // Handle inline change of planned value in modal table
  const handlePlannedValueChange = (categoryId: string, numericVal: number) => {
    setPlannedValues((prev) => ({
      ...prev,
      [categoryId]: numericVal,
    }));
  };

  // Create new category inline inside Planning Modal
  const handleCreateNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsCreatingCategory(true);
    try {
      const newCat = await createCategory({
        entityId: entity,
        name: newCategoryName.trim(),
        nature: 'EXPENSE',
        icon: 'tag',
        colorHex: '#8b5cf6',
      });

      setCategories((prev) => [...prev, newCat]);
      setPlannedValues((prev) => ({
        ...prev,
        [newCat.id]: 0,
      }));
      setNewCategoryName('');
      setShowNewCategoryForm(false);
    } catch (err) {
      console.error('Error creating category:', err);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Save all planned values in Modal
  const handleSaveMonthlyPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPlan(true);
    setSaveNotification(null);
    try {
      const targetEntityId =
        entity === 'PJ'
          ? '22222222-2222-2222-2222-222222222222'
          : '11111111-1111-1111-1111-111111111111';

      const promises = Object.entries(plannedValues).map(([catId, amount]) =>
        upsertBudget(targetEntityId, catId, selectedMonth, Number(amount) || 0)
      );

      await Promise.all(promises);
      setShowPlanningModal(false);
      setSaveNotification('Planejamento do mês salvo com sucesso!');
      setTimeout(() => setSaveNotification(null), 3500);
      await loadData();
    } catch (err) {
      console.error('Error saving monthly plan:', err);
    } finally {
      setIsSavingPlan(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-purple-950/80 border border-purple-500/30 text-purple-400 shadow-md">
            <PieChart className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
              Acompanhamento de Orçamentos
              <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/30 text-[10px] uppercase font-bold tracking-wider">
                Planejado vs. Realizado
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Controle dos gastos em relação às metas estipuladas para <strong className={config.textColor}>{config.label}</strong>
            </p>
          </div>
        </div>

        {/* Primary Action Button: [ 🎯 Definir Meta / Orçamento do Mês ] */}
        <button
          type="button"
          onClick={handleOpenPlanningModal}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-xl shadow-purple-950/50 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer ring-2 ring-purple-400/40"
        >
          <Target className="h-4 w-4 stroke-[3]" />
          <span>🎯 Definir Meta / Orçamento do Mês</span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {saveNotification && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>{saveNotification}</span>
        </div>
      )}

      {/* Month Selector & Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Month Selector Box */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-3 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Mês de Referência
          </span>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-purple-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-bold font-mono text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <span className="text-[11px] text-slate-500">Mude o mês para visualizar períodos</span>
        </div>

        {/* Total Planejado */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            🎯 Total Planejado (Meta)
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-purple-300 font-mono">
            {summary.totalPlanned.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-[11px] text-slate-400">Teto total estipulado para o mês</p>
        </div>

        {/* Gastos Realizados */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            💸 Gastos Realizados
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono">
            {summary.totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-[11px] text-slate-400">Soma de todas as despesas no mês</p>
        </div>

        {/* Saldo Restante */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            📊 Saldo Restante Total
          </span>
          <div
            className={cn(
              'text-2xl sm:text-3xl font-extrabold font-mono',
              summary.isOverBudget ? 'text-rose-400' : 'text-emerald-400'
            )}
          >
            {summary.remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-[11px] text-slate-400">
            {summary.isOverBudget ? 'Gastos superam o planejado' : 'Margem disponível para compras'}
          </p>
        </div>

      </div>

      {/* Main View: Acompanhamento de Gastos (Cards por Categoria com Barras de Progresso) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-400" />
            Acompanhamento de Gastos por Categoria ({budgets.length})
          </h2>

          <button
            type="button"
            onClick={handleOpenPlanningModal}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold shadow-md flex items-center gap-1.5 transition-all self-start sm:self-auto"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>🎯 Planejar / Alterar Metas</span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 flex items-center justify-center text-slate-400 text-xs gap-2">
            <Clock className="h-4 w-4 animate-spin text-purple-400" />
            <span>Carregando acompanhamento de gastos...</span>
          </div>
        ) : budgets.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-3">
            <p className="text-xs">Nenhum orçamento estipulado para este mês.</p>
            <button
              type="button"
              onClick={handleOpenPlanningModal}
              className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 shadow-lg inline-flex items-center gap-2"
            >
              <Target className="h-4 w-4" />
              <span>🎯 Planejar o Mês Agora</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.map((b) => {
              const planned = plannedValues[b.categoryId] !== undefined ? Number(plannedValues[b.categoryId]) : b.plannedAmount || 0;
              const spent = b.spentAmount || 0;
              const percentage = planned > 0 ? Math.round((spent / planned) * 100) : 0;

              let barColor = 'bg-emerald-500';
              let badgeText = 'Dentro da Meta';
              let isOverBudget = false;

              if (planned > 0) {
                if (percentage >= 100) {
                  barColor = 'bg-rose-500 animate-pulse';
                  badgeText = 'Estouro de Orçamento!';
                  isOverBudget = true;
                } else if (percentage >= 76) {
                  barColor = 'bg-amber-500';
                  badgeText = 'Atenção (Próximo do Limite)';
                }
              }

              return (
                <div
                  key={b.categoryId}
                  className={cn(
                    'p-4.5 rounded-xl border bg-slate-950/70 transition-all space-y-3',
                    isOverBudget ? 'border-rose-500/50 shadow-md shadow-rose-950/20' : 'border-slate-800/80 hover:border-slate-700'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-purple-500" />
                      <h3 className="text-sm font-bold text-slate-100">{b.categoryName}</h3>
                      {planned > 0 && (
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                            isOverBudget
                              ? 'bg-rose-950 text-rose-400 border border-rose-500/40'
                              : percentage >= 76
                              ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                          )}
                        >
                          {badgeText}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amounts row */}
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">
                      Realizado (Gasto): <strong className="text-slate-100 font-bold">{spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </span>
                    <span className="text-slate-400">
                      Planejado (Teto): <strong className="text-purple-300 font-bold">{planned > 0 ? planned.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}</strong>
                    </span>
                  </div>

                  {/* Progress bar */}
                  {planned > 0 ? (
                    <div className="space-y-1">
                      <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={cn('h-full transition-all duration-500', barColor)}
                          style={{ width: `${Math.min(100, percentage)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>Consumido: {percentage}%</span>
                        <span>
                          Margem Restante: {Math.max(0, planned - spent).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic flex items-center justify-between">
                      <span>Nenhuma meta definida (R$ 0,00).</span>
                      <button
                        type="button"
                        onClick={handleOpenPlanningModal}
                        className="text-purple-400 font-bold hover:underline"
                      >
                        Estipular Meta →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE PLANEJAMENTO DO MÊS (ao clicar no botão [ 🎯 Definir Meta / Orçamento do Mês ]) */}
      {showPlanningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveMonthlyPlan}
            className="w-full max-w-2xl p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-5 max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-400" />
                  Planejamento de Orçamentos do Mês ({selectedMonth})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Estipule o teto de gastos de cada categoria ou crie novas categorias de despesa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanningModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Create New Category Option inside Modal */}
            <div className="flex-shrink-0 bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-purple-400" />
                  Deseja adicionar uma nova categoria de despesa?
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewCategoryForm(!showNewCategoryForm)}
                  className="px-3 py-1 rounded-lg bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-1 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{showNewCategoryForm ? 'Fechar Form' : '+ Nova Categoria'}</span>
                </button>
              </div>

              {/* Inline Form to create new category */}
              {showNewCategoryForm && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 animate-in fade-in duration-150">
                  <input
                    type="text"
                    required
                    placeholder="Nome da categoria (ex: Pets, Assinaturas, Manutenção...)"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs font-semibold focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateNewCategory}
                    disabled={isCreatingCategory || !newCategoryName.trim()}
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-extrabold hover:bg-purple-500 shadow-md flex items-center gap-1 transition-all"
                  >
                    <span>{isCreatingCategory ? 'Criando...' : 'Criar Categoria'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable Category Planning Table */}
            <div className="flex-1 overflow-y-auto pr-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-900 z-10">
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono text-[11px]">
                    <th className="py-2.5 px-3">Categoria de Despesa</th>
                    <th className="py-2.5 px-3 w-56 text-right">Teto Planejado em R$</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {categories.map((cat) => {
                    const currentPlanned = plannedValues[cat.id] !== undefined ? Number(plannedValues[cat.id]) : 0;
                    return (
                      <tr key={cat.id} className="hover:bg-slate-950/60 transition-colors">
                        <td className="py-3 px-3 font-sans font-bold text-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                            <span>{cat.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <CurrencyInput
                            value={currentPlanned}
                            onChangeValue={(numVal) => handlePlannedValueChange(cat.id, numVal)}
                            className="!py-1.5 !text-xs font-bold border-purple-500/40 focus:border-purple-400 bg-slate-950"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 flex-shrink-0">
              <span className="text-xs text-slate-400">
                Total de Categorias: <strong className="text-purple-300 font-mono">{categories.length}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPlanningModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlan}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSavingPlan ? 'Gravando...' : '💾 Salvar Planejamento do Mês'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
