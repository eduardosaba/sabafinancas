'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Settings, Tag, Plus, Clock, ArrowUpRight, ArrowDownRight, Trash2 } from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';
import { Category, TransactionNature } from '@/types/finance';
import { createCategory, deleteCategory, fetchCategories } from '@/lib/services/finance-service';
import { cn } from '@/lib/utils';

import { useToast } from '@/contexts/toast-context';

export default function CategoriesSettingsPage() {
  const { entity, config, isHydrated } = useEntity();
  const { toast, confirm } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [nature, setNature] = useState<TransactionNature>('EXPENSE');
  const [colorHex, setColorHex] = useState('#ef4444');
  const [targetEntity, setTargetEntity] = useState<'PF' | 'PJ' | 'BOTH'>('BOTH');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchCategories(entity);
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setIsLoading(false);
    }
  }, [entity]);

  useEffect(() => {
    if (isHydrated) {
      loadData();
    }
  }, [isHydrated, loadData]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const targetEntityId =
        targetEntity === 'BOTH'
          ? null
          : targetEntity === 'PJ'
          ? '22222222-2222-2222-2222-222222222222'
          : '11111111-1111-1111-1111-111111111111';

      await createCategory({
        entityId: targetEntityId,
        name,
        nature,
        icon: 'tag',
        colorHex,
      });

      setShowModal(false);
      setName('');
      toast.success(`Categoria "${name}" criada com sucesso!`, 'Categoria Criada');
      await loadData();
    } catch (err) {
      console.error('Error creating category:', err);
      toast.error('Erro ao criar categoria.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Categoria',
      message: 'Deseja realmente excluir esta categoria? Os lançamentos associados permanecerão salvos.',
      confirmText: 'Excluir Categoria',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed) {
      await deleteCategory(id);
      toast.success('Categoria excluída com sucesso.', 'Categoria Excluída');
      await loadData();
    }
  };

  if (!isHydrated) return null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-3">
            <Tag className="h-7 w-7 text-purple-400" />
            Gestão de Categorias Dinâmicas
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Categorização de receitas e despesas para <strong className={config.textColor}>{config.label}</strong>
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Nova Categoria</span>
        </button>
      </div>

      {/* Tabs Subnavigation */}
      <div className="flex gap-3 border-b border-slate-800 pb-3">
        <Link href="/settings/accounts" className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900">
          Contas Bancárias
        </Link>
        <Link href="/settings/categories" className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-white border border-slate-700 shadow-sm">
          Categorias Dinâmicas
        </Link>
      </div>

      {/* Categories List Grid */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 animate-spin text-purple-400" />
          <span>Buscando categorias...</span>
        </div>
      ) : categories.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
          Nenhuma categoria cadastrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const isIncome = cat.nature === 'INCOME';
            return (
              <div
                key={cat.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.colorHex }} />
                    <h3 className="text-sm font-bold text-slate-100">{cat.name}</h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
                        isIncome
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                      )}
                    >
                      {isIncome ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {isIncome ? 'Receita' : 'Despesa'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id)}
                      title="Excluir Categoria"
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-1.5">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-extrabold border tracking-wider',
                      !cat.entityId
                        ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                        : cat.entityId === 'PJ' || cat.entityId === '22222222-2222-2222-2222-222222222222'
                        ? 'bg-blue-950/80 text-blue-300 border-blue-800/60'
                        : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                    )}
                  >
                    {!cat.entityId
                      ? 'PF & PJ (Compartilhada)'
                      : cat.entityId === 'PJ' || cat.entityId === '22222222-2222-2222-2222-222222222222'
                      ? 'Pessoa Jurídica (PJ)'
                      : 'Pessoa Física (PF)'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Category Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateCategory}
            className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-400" />
              Cadastrar Nova Categoria
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Nome da Categoria</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Assinaturas, Consultoria, Marketing"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Natureza</label>
                  <select
                    value={nature}
                    onChange={(e) => {
                      const val = e.target.value as TransactionNature;
                      setNature(val);
                      setColorHex(val === 'INCOME' ? '#10b981' : '#ef4444');
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-purple-500"
                  >
                    <option value="EXPENSE">Despesa (Saída)</option>
                    <option value="INCOME">Receita (Entrada)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Vínculo de Entidade</label>
                  <select
                    value={targetEntity}
                    onChange={(e) => setTargetEntity(e.target.value as 'PF' | 'PJ' | 'BOTH')}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-purple-500"
                  >
                    <option value="BOTH">Ambas (Compartilhada)</option>
                    <option value="PF">Apenas Pessoa Física (PF)</option>
                    <option value="PJ">Apenas Empresa (PJ)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Cor da Etiqueta</label>
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  className="w-full h-9 p-1 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer"
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
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 shadow-md"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Categoria'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
