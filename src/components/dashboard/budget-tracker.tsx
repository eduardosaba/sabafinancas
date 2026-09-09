'use client';

import React, { useState } from 'react';
import { Budget, Category } from '@/types/finance';
import { Plus, Edit2, CheckCircle2, ShieldAlert, PieChart, Save, X } from 'lucide-react';
import { upsertBudget } from '@/lib/services/finance-service';
import { useEntity } from '@/contexts/entity-context';
import { CurrencyInput } from '@/components/ui/currency-input';
import { cn } from '@/lib/utils';

interface BudgetTrackerProps {
  budgets: Budget[];
  categories: Category[];
  monthYear: string;
  onRefresh: () => void;
}

export function BudgetTracker({ budgets, categories, monthYear, onRefresh }: BudgetTrackerProps) {
  const { entity } = useEntity();
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(monthYear || new Date().toISOString().slice(0, 7));
  const [limitInput, setLimitInput] = useState<string>('500');
  const [isSaving, setIsSaving] = useState(false);

  const expenseCategories = categories.filter((c) => c.nature === 'EXPENSE' || !c.nature);

  const handleOpenNewModal = () => {
    if (expenseCategories.length > 0) {
      setSelectedCategoryId(expenseCategories[0].id);
      const existing = budgets.find((b) => b.categoryId === expenseCategories[0].id);
      setLimitInput(existing && existing.plannedAmount > 0 ? existing.plannedAmount.toString() : '500');
    }
    setSelectedMonthYear(monthYear || new Date().toISOString().slice(0, 7));
    setShowModal(true);
  };

  const handleOpenEditCategory = (cat: Category, currentPlanned?: number) => {
    setSelectedCategoryId(cat.id);
    setSelectedMonthYear(monthYear || new Date().toISOString().slice(0, 7));
    setLimitInput(currentPlanned && currentPlanned > 0 ? currentPlanned.toString() : '500');
    setShowModal(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) return;
    const amount = parseFloat(limitInput);
    if (isNaN(amount) || amount < 0) return;

    setIsSaving(true);
    const targetEntityId =
      entity === 'PJ'
        ? '22222222-2222-2222-2222-222222222222'
        : '11111111-1111-1111-1111-111111111111';

    await upsertBudget(targetEntityId, selectedCategoryId, selectedMonthYear, amount);
    setIsSaving(false);
    setShowModal(false);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <PieChart className="h-5 w-5 text-purple-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              Acompanhamento de Orçamento (Planejado vs. Realizado)
            </h3>
            <p className="text-xs text-slate-400">Teto de gastos por categoria para o período {monthYear}</p>
          </div>
        </div>

        {/* Quick + Meta Button */}
        <button
          type="button"
          onClick={handleOpenNewModal}
          className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold shadow-md flex items-center gap-1.5 transition-all"
        >
          <Plus className="h-3.5 w-3.5 stroke-[3]" />
          <span>[ + Definir Orçamento ]</span>
        </button>
      </div>

      {/* Categories List */}
      <div className="space-y-3">
        {expenseCategories.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            Nenhuma categoria de despesa encontrada.
          </div>
        ) : (
          expenseCategories.map((cat) => {
            const budgetObj = budgets.find((b) => b.categoryId === cat.id);
            const planned = budgetObj?.plannedAmount || 0;
            const spent = budgetObj?.spentAmount || 0;
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
                key={cat.id}
                onClick={() => handleOpenEditCategory(cat, planned)}
                className={cn(
                  'p-3.5 rounded-xl border bg-slate-950/70 transition-all cursor-pointer hover:border-purple-500/50 group',
                  isOverBudget ? 'border-rose-500/50 shadow-md shadow-rose-950/20' : 'border-slate-800/80'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.colorHex }} />
                    <span className="text-xs font-bold text-slate-200 group-hover:text-purple-300 transition-colors">
                      {cat.name}
                    </span>
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

                  <div className="flex items-center gap-2">
                    <div className="text-right text-xs font-mono">
                      <span className="text-slate-100 font-bold">
                        {spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className="text-slate-400 font-medium">
                        {planned > 0
                          ? planned.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : 'R$ 0,00'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditCategory(cat, planned);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 transition-colors"
                      title="Definir teto de gastos"
                    >
                      {planned > 0 ? (
                        <Edit2 className="h-3.5 w-3.5" />
                      ) : (
                        <span className="text-[10px] font-bold text-purple-400 px-1.5 py-0.5 rounded bg-purple-950 border border-purple-500/30">
                          + Meta
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {planned > 0 ? (
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={cn('h-full transition-all duration-500', barColor)}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>Consumido: {percentage}%</span>
                      <span>
                        Restante: {Math.max(0, planned - spent).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Sem teto definido. Clique para estipular uma meta.</span>
                    <span className="text-purple-400 text-[10px] font-bold hover:underline">
                      Definir limite →
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit / New Budget Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveBudget}
            className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-purple-400" />
                Definir Teto de Orçamento
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Categoria</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => {
                    setSelectedCategoryId(e.target.value);
                    const b = budgets.find((item) => item.categoryId === e.target.value);
                    if (b && b.plannedAmount > 0) {
                      setLimitInput(b.plannedAmount.toString());
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-medium focus:outline-none focus:border-purple-500"
                >
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Mês de Referência</label>
                <input
                  type="month"
                  required
                  value={selectedMonthYear}
                  onChange={(e) => setSelectedMonthYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Teto Planejado</label>
                <CurrencyInput
                  value={limitInput}
                  onChangeValue={(numeric) => setLimitInput(numeric ? numeric.toString() : '')}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 shadow-md flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? 'Salvando...' : 'Salvar Meta'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
