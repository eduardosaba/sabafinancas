'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Settings, Wallet, Plus, CheckCircle2, Clock, Trash2, Edit2 } from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';
import { Account, AccountType } from '@/types/finance';
import { createAccount, deleteAccount, fetchAccounts, updateAccount } from '@/lib/services/finance-service';
import { CurrencyInput } from '@/components/ui/currency-input';
import { cn } from '@/lib/utils';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: 'Conta Corrente',
  CREDIT_CARD: 'Cartão de Crédito',
  INVESTMENT: 'Investimento',
  CASH: 'Carteira / Dinheiro',
};

function renderEntityBadge(entityId: string) {
  const isPJ = entityId === 'PJ' || entityId === '22222222-2222-2222-2222-222222222222';
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[10px] font-extrabold border tracking-wider',
        isPJ
          ? 'bg-blue-950/80 text-blue-400 border-blue-800/60'
          : 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
      )}
    >
      {isPJ ? 'PJ' : 'PF'}
    </span>
  );
}

import { useToast } from '@/contexts/toast-context';

export default function AccountsSettingsPage() {
  const { entity, config, isHydrated, pjEntities, activeCompany } = useEntity();
  const { toast, confirm } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('CHECKING');
  const [initialBalance, setInitialBalance] = useState('0.00');
  const [colorHex, setColorHex] = useState('#3b82f6');
  const [closingDay, setClosingDay] = useState('25');
  const [dueDay, setDueDay] = useState('5');
  const [creditLimit, setCreditLimit] = useState('10000.00');
  const [targetEntity, setTargetEntity] = useState<string>(
    entity !== 'PF' && entity !== '11111111-1111-1111-1111-111111111111' && entity !== 'CONSOLIDATED'
      ? entity
      : activeCompany?.id || 'PJ'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [filterTab, setFilterTab] = useState<'ALL' | 'PF' | 'PJ'>('ALL');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AccountType>('CHECKING');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [editBalance, setEditBalance] = useState('0.00');
  const [editClosingDay, setEditClosingDay] = useState('25');
  const [editDueDay, setEditDueDay] = useState('5');
  const [editCreditLimit, setEditCreditLimit] = useState('10000.00');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAccounts('CONSOLIDATED');
      setAccounts(data);
    } catch (err) {
      console.error('Error loading accounts:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isHydrated) {
      loadData();
    }
  }, [isHydrated, loadData]);

  const filteredAccounts = useMemo(() => {
    if (filterTab === 'ALL') return accounts;
    return accounts.filter((a) => {
      const isPJ = a.entityId !== '11111111-1111-1111-1111-111111111111' && a.entityId !== 'PF';
      return filterTab === 'PJ' ? isPJ : !isPJ;
    });
  }, [accounts, filterTab]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      let targetEntityId = targetEntity;
      if (targetEntity === 'PF') {
        targetEntityId = '11111111-1111-1111-1111-111111111111';
      } else if (targetEntity === 'PJ') {
        targetEntityId = activeCompany?.id || '22222222-2222-2222-2222-222222222222';
      }

      await createAccount({
        entityId: targetEntityId,
        name,
        accountType,
        initialBalance: parseFloat(initialBalance) || 0,
        colorHex,
        closingDay: accountType === 'CREDIT_CARD' ? parseInt(closingDay, 10) || 25 : null,
        dueDay: accountType === 'CREDIT_CARD' ? parseInt(dueDay, 10) || 5 : null,
        creditLimit: accountType === 'CREDIT_CARD' ? parseFloat(creditLimit) || 0 : null,
      });

      setShowModal(false);
      setName('');
      setInitialBalance('0.00');
      toast.success(`Conta "${name}" cadastrada com sucesso!`, 'Conta Cadastrada');
      await loadData();
    } catch (err) {
      console.error('Error creating account:', err);
      toast.error('Erro ao cadastrar conta bancária.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Conta Bancária',
      message: 'Deseja realmente excluir esta conta bancária? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir Conta',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed) {
      await deleteAccount(id);
      toast.success('Conta bancária excluída com sucesso.', 'Conta Excluída');
      await loadData();
    }
  };

  const handleOpenEdit = (acc: Account) => {
    setEditingAccount(acc);
    setEditName(acc.name);
    setEditType(acc.accountType);
    setEditColor(acc.colorHex || '#3b82f6');
    setEditBalance(acc.currentBalance.toString());
    setEditClosingDay(acc.closingDay ? acc.closingDay.toString() : '25');
    setEditDueDay(acc.dueDay ? acc.dueDay.toString() : '5');
    setEditCreditLimit(acc.creditLimit ? acc.creditLimit.toString() : '10000.00');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    setIsSubmittingEdit(true);
    try {
      const parsedBalance = parseFloat(editBalance) || 0;
      await updateAccount(editingAccount.id, {
        name: editName,
        accountType: editType,
        colorHex: editColor,
        currentBalance: parsedBalance,
        initialBalance: parsedBalance,
        closingDay: editType === 'CREDIT_CARD' ? parseInt(editClosingDay, 10) || 25 : null,
        dueDay: editType === 'CREDIT_CARD' ? parseInt(editDueDay, 10) || 5 : null,
        creditLimit: editType === 'CREDIT_CARD' ? parseFloat(editCreditLimit) || 0 : null,
      });
      toast.success(`Conta "${editName}" atualizada com sucesso!`, 'Conta Atualizada');
      setEditingAccount(null);
      await loadData();
    } catch (err) {
      console.error('Error updating account:', err);
      toast.error('Erro ao atualizar conta bancária.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  if (!isHydrated) return null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-3">
            <Settings className="h-7 w-7 text-slate-300" />
            Configurações de Contas Bancárias
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gerenciamento de contas e carteiras para <strong className={config.textColor}>{config.label}</strong>
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Cadastrar Nova Conta</span>
        </button>
      </div>

      {/* Tabs Subnavigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex gap-2">
          <Link href="/settings/accounts" className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-white border border-slate-700 shadow-sm">
            Contas Bancárias
          </Link>
          <Link href="/settings/companies" className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition-colors">
            Empresas (PJ)
          </Link>
          <Link href="/settings/categories" className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition-colors">
            Categorias Dinâmicas
          </Link>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterTab('ALL')}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-bold transition-all',
              filterTab === 'ALL'
                ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            Todas ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('PF')}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-bold transition-all',
              filterTab === 'PF'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-emerald-400'
            )}
          >
            PF ({accounts.filter((a) => a.entityId !== 'PJ' && a.entityId !== '22222222-2222-2222-2222-222222222222').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('PJ')}
            className={cn(
              'px-3 py-1 rounded-lg text-xs font-bold transition-all',
              filterTab === 'PJ'
                ? 'bg-blue-950 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-blue-400'
            )}
          >
            PJ ({accounts.filter((a) => a.entityId === 'PJ' || a.entityId === '22222222-2222-2222-2222-222222222222').length})
          </button>
        </div>
      </div>

      {/* Accounts List Grid */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Buscando contas bancárias...</span>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
          Nenhuma conta bancária encontrada para o filtro selecionado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAccounts.map((acc: Account) => (
            <div
              key={acc.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3 relative overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: acc.colorHex }}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <Wallet className="h-5 w-5 text-slate-200" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">{acc.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-semibold text-slate-400">
                        {ACCOUNT_TYPE_LABELS[acc.accountType as AccountType] || acc.accountType}
                      </span>
                      {renderEntityBadge(acc.entityId)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(acc)}
                    title="Editar Conta"
                    className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(acc.id)}
                    title="Excluir Conta"
                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {acc.accountType === 'CREDIT_CARD' && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Fechamento: Dia {acc.closingDay || 25}</span>
                    <span>Vencimento: Dia {acc.dueDay || 5}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-200">
                    <span>Limite Total:</span>
                    <span className="text-emerald-400">
                      {(acc.creditLimit || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {acc.accountType === 'CREDIT_CARD' ? 'Saldo Devedor / Fatura' : 'Saldo Atual'}
                </span>
                <span className="text-lg font-bold font-mono text-slate-100">
                  {acc.currentBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-blue-400" />
              Editar Conta Bancária
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Nome da Conta / Banco</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Saldo Atual (R$)</label>
                <CurrencyInput
                  value={editBalance}
                  onChangeValue={(numeric) => setEditBalance(numeric ? numeric.toString() : '0')}
                  placeholder="0,00"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Tipo de Conta</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as AccountType)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                  >
                    <option value="CHECKING">Conta Corrente</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="INVESTMENT">Investimento</option>
                    <option value="CASH">Dinheiro / Carteira</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Cor de Identificação</label>
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-full h-9 p-1 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer"
                  />
                </div>
              </div>

              {editType === 'CREDIT_CARD' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block">
                    Parâmetros do Cartão de Crédito
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 block">Dia Fechamento</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={editClosingDay}
                        onChange={(e) => setEditClosingDay(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 block">Dia Vencimento</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={editDueDay}
                        onChange={(e) => setEditDueDay(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 block">Limite Total (R$)</label>
                      <input
                        type="number"
                        step="100"
                        value={editCreditLimit}
                        onChange={(e) => setEditCreditLimit(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-md"
              >
                {isSubmittingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Account Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateAccount}
            className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-400" />
              Cadastrar Nova Conta Bancária
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Nome da Conta / Banco</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Nubank PF, Inter PJ, Safra"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Tipo de Conta</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as AccountType)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-emerald-500"
                  >
                    <option value="CHECKING">Conta Corrente</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="INVESTMENT">Investimento</option>
                    <option value="CASH">Dinheiro / Carteira</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Entidade / Empresa</label>
                  <select
                    value={targetEntity}
                    onChange={(e) => setTargetEntity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-emerald-500"
                  >
                    <option value="PF">Pessoa Física (PF)</option>
                    {pjEntities.length === 0 ? (
                      <option value="PJ">Pessoa Jurídica (PJ Geral)</option>
                    ) : (
                      pjEntities.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          PJ: {comp.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Saldo Inicial</label>
                  <CurrencyInput
                    value={initialBalance}
                    onChangeValue={(num) => setInitialBalance(num.toString())}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Cor de Identificação</label>
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="w-full h-9 p-1 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer"
                  />
                </div>
              </div>

              {accountType === 'CREDIT_CARD' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                    Parâmetros do Cartão de Crédito
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 block">Dia Fechamento</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={closingDay}
                        onChange={(e) => setClosingDay(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 block">Dia Vencimento</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={dueDay}
                        onChange={(e) => setDueDay(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 block">Limite Total (R$)</label>
                      <input
                        type="number"
                        step="100"
                        value={creditLimit}
                        onChange={(e) => setCreditLimit(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}
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
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 shadow-md"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Conta'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
