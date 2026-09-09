'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Settings, Building2, Plus, Check, ShieldCheck, Wallet, ArrowRight } from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';
import { useToast } from '@/contexts/toast-context';
import { CompanyModal } from '@/components/companies/company-modal';
import { cn } from '@/lib/utils';

export default function CompaniesSettingsPage() {
  const { entity, config, pjEntities, activeCompany, selectCompany, reloadEntities, isHydrated } = useEntity();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!isHydrated) {
    return (
      <div className="p-8 text-center text-slate-400">
        Carregando empresas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-400" />
            Configurações - Empresas (PJ)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre e gerencie suas empresas PJ para separar finanças, contas bancárias e extratos.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Cadastrar Nova Empresa (PJ)</span>
        </button>
      </div>

      {/* Settings Subnavigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex gap-2">
          <Link
            href="/settings/accounts"
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            Contas Bancárias
          </Link>
          <Link
            href="/settings/companies"
            className="px-3.5 py-1.5 rounded-lg bg-blue-950 text-blue-300 text-xs font-bold border border-blue-500/40 shadow-sm"
          >
            Empresas (PJ)
          </Link>
          <Link
            href="/settings/categories"
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            Categorias Dinâmicas
          </Link>
        </div>
      </div>

      {/* Main Companies Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-400" />
            Empresas Cadastradas ({pjEntities.length})
          </h2>
        </div>

        {pjEntities.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
            <Building2 className="h-10 w-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-200">Nenhuma empresa PJ cadastrada</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Cadastre sua primeira empresa PJ para gerenciar contas bancárias empresariais e separar receitas e despesas.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Cadastrar Minha Primeira Empresa PJ</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pjEntities.map((company) => {
              const isActive = activeCompany?.id === company.id;
              return (
                <div
                  key={company.id}
                  className={cn(
                    'p-5 rounded-2xl bg-slate-900 border transition-all duration-200 flex flex-col justify-between space-y-4 relative overflow-hidden',
                    isActive
                      ? 'border-blue-500 bg-blue-950/20 ring-1 ring-blue-500/50 shadow-xl'
                      : 'border-slate-800 hover:border-slate-700'
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-500/30 text-blue-400">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-100">{company.name}</h3>
                          <span className="text-[10px] font-mono text-slate-400">ID: {company.id.slice(0, 8)}...</span>
                        </div>
                      </div>

                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-extrabold border border-blue-400/30 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          <span>Ativa</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => selectCompany(company.id)}
                      disabled={isActive}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                        isActive
                          ? 'bg-slate-800 text-slate-400 cursor-default'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                      )}
                    >
                      {isActive ? 'Empresa Ativa' : 'Selecionar Esta Empresa'}
                    </button>

                    <Link
                      href="/settings/accounts"
                      className="text-[11px] font-semibold text-slate-400 hover:text-blue-400 flex items-center gap-1 hover:underline"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      <span>Contas</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
        <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Como funciona a separação PF / PJ no sistema?
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed">
          Você pode ter múltiplas empresas PJ cadastradas. Ao selecionar uma empresa no topo do sistema ou nas Configurações, os lançamentos, extratos e relatórios exibidos serão automaticamente filtrados para a empresa ativa. Se desejar ver o valor total acumulado (PF + todas as PJs), selecione o modo <strong>Consolidado</strong>.
        </p>
      </div>

      {/* Company Creation Modal */}
      <CompanyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={async (newCompany) => {
          await reloadEntities();
          selectCompany(newCompany.id);
          toast.success(`Empresa "${newCompany.name}" configurada e selecionada!`);
        }}
      />
    </div>
  );
}
