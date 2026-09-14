'use client';

import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Building2, User, DollarSign, Calendar, Info, Layers } from 'lucide-react';
import { Investment, InvestmentCategory, CreateInvestmentInput, UpdateInvestmentInput } from '@/types/finance';
import { createInvestment, updateInvestment } from '@/lib/services/finance-service';
import { useEntity } from '@/contexts/entity-context';
import { useToast } from '@/contexts/toast-context';
import { cn } from '@/lib/utils';

interface InvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  investment?: Investment | null;
  onSuccess: () => void;
}

export function InvestmentModal({ isOpen, onClose, investment, onSuccess }: InvestmentModalProps) {
  const { entity, pjEntities } = useEntity();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('PF');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<InvestmentCategory>('RENDA_FIXA');
  const [institution, setInstitution] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [yieldRate, setYieldRate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (investment) {
        setSelectedEntityId(investment.entityId || 'PF');
        setName(investment.name || '');
        setCategory(investment.category || 'RENDA_FIXA');
        setInstitution(investment.institution || '');
        setInitialAmount(investment.initialAmount ? String(investment.initialAmount) : '');
        setCurrentAmount(investment.currentAmount ? String(investment.currentAmount) : '');
        setYieldRate(investment.yieldRate || '');
        setStartDate(investment.startDate || new Date().toISOString().split('T')[0]);
        setNotes(investment.notes || '');
      } else {
        setSelectedEntityId(entity === 'CONSOLIDATED' ? 'PF' : entity);
        setName('');
        setCategory('RENDA_FIXA');
        setInstitution('');
        setInitialAmount('');
        setCurrentAmount('');
        setYieldRate('100% CDI');
        setStartDate(new Date().toISOString().split('T')[0]);
        setNotes('');
      }
    }
  }, [isOpen, investment, entity]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Por favor, informe o nome do ativo/aplicação.');
      return;
    }

    if (!institution.trim()) {
      toast.error('Por favor, informe a instituição ou corretora.');
      return;
    }

    const initVal = parseFloat(initialAmount.replace(',', '.'));
    const currVal = parseFloat(currentAmount.replace(',', '.'));

    if (isNaN(initVal) || initVal < 0) {
      toast.error('Informe um valor inicial aplicado válido.');
      return;
    }

    const finalCurrentVal = isNaN(currVal) ? initVal : currVal;

    try {
      setLoading(true);

      if (investment) {
        const updateInput: UpdateInvestmentInput = {
          entityId: selectedEntityId,
          name: name.trim(),
          category,
          institution: institution.trim(),
          initialAmount: initVal,
          currentAmount: finalCurrentVal,
          yieldRate: yieldRate.trim() || undefined,
          startDate,
          notes: notes.trim() || undefined,
        };
        await updateInvestment(investment.id, updateInput);
        toast.success('Investimento atualizado com sucesso!');
      } else {
        const createInput: CreateInvestmentInput = {
          entityId: selectedEntityId,
          name: name.trim(),
          category,
          institution: institution.trim(),
          initialAmount: initVal,
          currentAmount: finalCurrentVal,
          yieldRate: yieldRate.trim() || undefined,
          startDate,
          notes: notes.trim() || undefined,
        };
        await createInvestment(createInput);
        toast.success('Investimento cadastrado com sucesso!');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar investimento:', err);
      toast.error(`Erro: ${err?.message || 'Falha ao salvar investimento'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {investment ? 'Editar Investimento' : 'Novo Investimento'}
              </h2>
              <p className="text-xs text-slate-400">
                {investment ? 'Atualize os dados do ativo' : 'Cadastre uma nova aplicação financeira'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Entity Selector (PF / PJ) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Titular do Investimento</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedEntityId('PF')}
                className={cn(
                  'py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all',
                  (selectedEntityId === 'PF' || selectedEntityId === '11111111-1111-1111-1111-111111111111')
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <User className="h-3.5 w-3.5" />
                <span>Pessoa Física (PF)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetPj = pjEntities.length > 0 ? pjEntities[0].id : 'PJ';
                  setSelectedEntityId(targetPj);
                }}
                className={cn(
                  'py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all',
                  (selectedEntityId !== 'PF' && selectedEntityId !== '11111111-1111-1111-1111-111111111111')
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Empresa (PJ)</span>
              </button>
            </div>
          </div>

          {/* Nome do Ativo & Instituição */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Nome do Ativo / Aplicação *</label>
              <input
                type="text"
                required
                placeholder="Ex: CDB Banco Inter 102% CDI"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Instituição / Corretora *</label>
              <input
                type="text"
                required
                placeholder="Ex: XP, BTG, Banco Inter, NuInvest"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Categoria do Ativo & Indexador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Classe do Ativo</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as InvestmentCategory)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="RENDA_FIXA">Renda Fixa (CDB, LCI, Tesouro)</option>
                <option value="RESERVA_EMERGENCIA">Reserva de Emergência</option>
                <option value="ACOES">Ações / Renda Variável</option>
                <option value="FIIS">Fundos Imobiliários (FIIs)</option>
                <option value="CRIPTO">Criptomoedas</option>
                <option value="OUTROS">Outros Investimentos</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Taxa / Indexador (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: 102% CDI, IPCA + 6.5%, 12% a.a."
                value={yieldRate}
                onChange={(e) => setYieldRate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Valor Inicial & Valor Atual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Valor Inicial Aplicado (R$) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">R$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Valor Atual / Saldo (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">R$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Deixe em branco para usar valor inicial"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          {/* Data da Aplicação */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Data da Aplicação *</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Notas / Observações (Opcional)</label>
            <textarea
              rows={2}
              placeholder="Ex: Liquidez diária, vencimento em 2027..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {loading ? 'Salvando...' : investment ? 'Atualizar Ativo' : 'Cadastrar Investimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
