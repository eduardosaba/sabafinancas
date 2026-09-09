'use client';

import React, { useState } from 'react';
import { Building2, X, Plus, Check } from 'lucide-react';
import { createEntity } from '@/lib/services/finance-service';
import { useToast } from '@/contexts/toast-context';
import { Entity } from '@/types/finance';

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCompany: Entity) => void;
}

export function CompanyModal({ isOpen, onClose, onSuccess }: CompanyModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning('Por favor, informe o nome da empresa.', 'Nome Obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createEntity({
        name: name.trim(),
        type: 'PJ',
      });

      toast.success(`Empresa "${created.name}" cadastrada com sucesso!`, 'Empresa Criada');
      setName('');
      onSuccess(created);
      onClose();
    } catch (err: any) {
      console.error('Error creating company:', err);
      toast.error(`Falha ao cadastrar empresa: ${err?.message || 'Erro de gravação'}`, 'Erro Supabase');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            Cadastrar Nova Empresa (PJ)
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1 text-xs">
            <label className="font-semibold text-slate-300 block">
              Nome da Empresa / Razão Social <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Saba Tecnologia LTDA"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-300 text-xs">
            <p>
              Ao cadastrar uma nova empresa PJ, ela ficará disponível no menu superior do sistema para você alternar e controlar contas bancárias, despesas e receitas individualmente.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-950 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Cadastrar Empresa</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
