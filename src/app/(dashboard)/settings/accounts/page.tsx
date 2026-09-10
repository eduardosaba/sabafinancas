'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Settings, Wallet, Plus, CheckCircle2, Clock, Trash2, Edit2, CreditCard, Upload, Image as ImageIcon, X } from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';
import { Account, AccountType } from '@/types/finance';
import { createAccount, deleteAccount, fetchAccounts, updateAccount } from '@/lib/services/finance-service';
import { CurrencyInput } from '@/components/ui/currency-input';
import { cn } from '@/lib/utils';
import { useToast } from '@/contexts/toast-context';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: 'Conta Corrente',
  CREDIT_CARD: 'Cartão de Crédito',
  INVESTMENT: 'Investimento',
  CASH: 'Carteira / Dinheiro',
};

export const CARD_PRESET_TEMPLATES = [
  { id: 'bb_ourocard', name: 'Banco do Brasil Ourocard', color: '#facc15', bgGradient: 'from-amber-500 via-yellow-600 to-amber-700', logo: 'BB Ourocard' },
  { id: 'bb_black', name: 'Banco do Brasil Altus Black', color: '#1e293b', bgGradient: 'from-slate-950 via-slate-900 to-zinc-900', logo: 'BB Altus' },
  { id: 'nubank', name: 'Nubank Roxinho', color: '#8b5cf6', bgGradient: 'from-purple-700 via-violet-800 to-purple-950', logo: 'Nu' },
  { id: 'itau_black', name: 'Itaú Personnalité Black', color: '#ea580c', bgGradient: 'from-amber-700 via-orange-800 to-slate-950', logo: 'Itaú Black' },
  { id: 'xp_infinite', name: 'XP Visa Infinite', color: '#0f172a', bgGradient: 'from-zinc-900 via-slate-950 to-black', logo: 'XP Infinite' },
  { id: 'inter_gold', name: 'Inter Gold / Orange', color: '#f97316', bgGradient: 'from-orange-500 via-amber-600 to-orange-700', logo: 'Inter' },
  { id: 'c6_carbon', name: 'C6 Bank Carbon Black', color: '#334155', bgGradient: 'from-stone-900 via-slate-900 to-neutral-950', logo: 'C6 Carbon' },
  { id: 'santander_black', name: 'Santander Unlimited', color: '#dc2626', bgGradient: 'from-red-700 via-rose-900 to-slate-950', logo: 'Santander' },
  { id: 'bradesco_prime', name: 'Bradesco Prime', color: '#b91c1c', bgGradient: 'from-red-800 via-rose-900 to-black', logo: 'Bradesco' },
  { id: 'caixa_blue', name: 'Caixa Econômica', color: '#0284c7', bgGradient: 'from-blue-600 via-sky-700 to-blue-900', logo: 'Caixa' },
];

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

export default function AccountsSettingsPage() {
  const { entity, config, isHydrated, pjEntities, activeCompany } = useEntity();
  const { toast, confirm } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Section Tab: BANK (Bancárias), CARDS (Cartões de Crédito), ALL
  const [sectionTab, setSectionTab] = useState<'BANK' | 'CARDS' | 'ALL'>('BANK');
  const [filterTab, setFilterTab] = useState<'ALL' | 'PF' | 'PJ'>('ALL');

  // Form states
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('CHECKING');
  const [initialBalance, setInitialBalance] = useState('0.00');
  const [colorHex, setColorHex] = useState('#3b82f6');
  const [closingDay, setClosingDay] = useState('25');
  const [dueDay, setDueDay] = useState('5');
  const [creditLimit, setCreditLimit] = useState('10000.00');
  const [cardImageUrl, setCardImageUrl] = useState('');
  const [targetEntity, setTargetEntity] = useState<string>(
    entity !== 'PF' && entity !== '11111111-1111-1111-1111-111111111111' && entity !== 'CONSOLIDATED'
      ? entity
      : activeCompany?.id || 'PJ'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AccountType>('CHECKING');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [editBalance, setEditBalance] = useState('0.00');
  const [editClosingDay, setEditClosingDay] = useState('25');
  const [editDueDay, setEditDueDay] = useState('5');
  const [editCreditLimit, setEditCreditLimit] = useState('10000.00');
  const [editCardImageUrl, setEditCardImageUrl] = useState('');
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

  // Separate Accounts into Bank Accounts and Credit Cards
  const bankAccounts = useMemo(() => {
    return accounts.filter((a) => a.accountType !== 'CREDIT_CARD');
  }, [accounts]);

  const creditCardAccounts = useMemo(() => {
    return accounts.filter((a) => a.accountType === 'CREDIT_CARD');
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    let list = accounts;
    if (sectionTab === 'BANK') {
      list = bankAccounts;
    } else if (sectionTab === 'CARDS') {
      list = creditCardAccounts;
    }

    if (filterTab === 'ALL') return list;
    return list.filter((a) => {
      const isPJ = a.entityId !== '11111111-1111-1111-1111-111111111111' && a.entityId !== 'PF';
      return filterTab === 'PJ' ? isPJ : !isPJ;
    });
  }, [accounts, bankAccounts, creditCardAccounts, sectionTab, filterTab]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      if (isEdit) {
        setEditCardImageUrl(base64Url);
      } else {
        setCardImageUrl(base64Url);
      }
      toast.success('Imagem do cartão carregada com sucesso!', 'Upload Concluído');
    };
    reader.readAsDataURL(file);
  };

  const handleOpenCreateModal = (defaultType: AccountType = 'CHECKING') => {
    setAccountType(defaultType);
    setShowModal(true);
  };

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
        cardImageUrl: accountType === 'CREDIT_CARD' ? cardImageUrl : null,
      });

      setShowModal(false);
      setName('');
      setCardImageUrl('');
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

  const handleDeleteAccount = async (id: string, isCard: boolean) => {
    const isConfirmed = await confirm({
      title: isCard ? 'Excluir Cartão de Crédito' : 'Excluir Conta Bancária',
      message: `Deseja realmente excluir este ${isCard ? 'cartão de crédito' : 'registro de conta'}? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed) {
      await deleteAccount(id);
      toast.success(`${isCard ? 'Cartão' : 'Conta'} excluída com sucesso.`, 'Registro Excluído');
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
    setEditCardImageUrl(acc.cardImageUrl || '');
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
        cardImageUrl: editType === 'CREDIT_CARD' ? editCardImageUrl : null,
      });
      toast.success(`Conta "${editName}" atualizada com sucesso!`, 'Conta Atualizada');
      setEditingAccount(null);
      await loadData();
    } catch (err) {
      console.error('Error updating account:', err);
      toast.error('Erro ao atualizar conta.');
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
            Configurações de Contas & Cartões
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gerenciamento de contas bancárias, carteiras e cartões de crédito para <strong className={config.textColor}>{config.label}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => handleOpenCreateModal('CHECKING')}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>+ Nova Conta Bancária</span>
          </button>

          <button
            onClick={() => handleOpenCreateModal('CREDIT_CARD')}
            className="px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all"
          >
            <CreditCard className="h-4 w-4" />
            <span>+ Novo Cartão</span>
          </button>
        </div>
      </div>

      {/* Primary Section Tabs: Contas Bancárias vs. Cartões de Crédito vs. Todas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start">
          <button
            type="button"
            onClick={() => setSectionTab('BANK')}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all',
              sectionTab === 'BANK'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Wallet className="h-4 w-4" />
            <span>Contas Bancárias ({bankAccounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSectionTab('CARDS')}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all',
              sectionTab === 'CARDS'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <CreditCard className="h-4 w-4" />
            <span>Cartões de Crédito ({creditCardAccounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSectionTab('ALL')}
            className={cn(
              'px-3.5 py-2 rounded-lg text-xs font-bold transition-all',
              sectionTab === 'ALL'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            Todas ({accounts.length})
          </button>
        </div>

        {/* Filter PF vs PJ */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start md:self-auto">
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
            Todas
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
            PF (Pessoal)
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
            PJ (Empresas)
          </button>
        </div>
      </div>

      {/* Content Section Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          {sectionTab === 'BANK' && <Wallet className="h-4 w-4 text-emerald-400" />}
          {sectionTab === 'CARDS' && <CreditCard className="h-4 w-4 text-purple-400" />}
          {sectionTab === 'ALL' && <Settings className="h-4 w-4 text-slate-400" />}
          <span>
            {sectionTab === 'BANK' && 'Suas Contas Bancárias & Carteiras'}
            {sectionTab === 'CARDS' && 'Seus Cartões de Crédito Cadastrados'}
            {sectionTab === 'ALL' && 'Todas as Contas & Cartões'}
          </span>
        </h2>
      </div>

      {/* Accounts List Grid */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Buscando registros...</span>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs space-y-3">
          <p>Nenhum registro encontrado para a categoria selecionada.</p>
          <button
            onClick={() => handleOpenCreateModal(sectionTab === 'CARDS' ? 'CREDIT_CARD' : 'CHECKING')}
            className="px-4 py-2 rounded-xl bg-slate-800 text-emerald-400 text-xs font-bold hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Cadastrar Novo Registro</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAccounts.map((acc: Account) => {
            const isCard = acc.accountType === 'CREDIT_CARD';
            const cardPreset = CARD_PRESET_TEMPLATES.find((p) => p.id === acc.cardImageUrl);

            return (
              <div
                key={acc.id}
                className={cn(
                  'p-5 rounded-2xl bg-slate-900 border shadow-xl space-y-3 relative overflow-hidden transition-all hover:border-slate-700',
                  isCard ? 'border-purple-900/40' : 'border-slate-800'
                )}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: acc.colorHex || (isCard ? '#8b5cf6' : '#3b82f6') }}
                />

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Display custom image, preset card logo, or default icon */}
                    {isCard && acc.cardImageUrl && acc.cardImageUrl.startsWith('data:image') ? (
                      <div className="h-10 w-14 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 flex-shrink-0">
                        <img src={acc.cardImageUrl} alt={acc.name} className="w-full h-full object-cover" />
                      </div>
                    ) : isCard && cardPreset ? (
                      <div className={cn('h-10 w-14 rounded-lg p-1.5 flex items-center justify-center font-bold text-[10px] text-white shadow flex-shrink-0 bg-gradient-to-tr', cardPreset.bgGradient)}>
                        {cardPreset.logo}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                        {isCard ? (
                          <CreditCard className="h-5 w-5 text-purple-400" />
                        ) : (
                          <Wallet className="h-5 w-5 text-emerald-400" />
                        )}
                      </div>
                    )}

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
                      title="Editar Registro"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(acc.id, isCard)}
                      title="Excluir Registro"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isCard && (
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
                    {isCard ? 'Fatura Aberta / Saldo' : 'Saldo Atual'}
                  </span>
                  <span className={cn('text-lg font-bold font-mono', isCard ? 'text-purple-300' : 'text-slate-100')}>
                    {acc.currentBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Account / Card Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4 my-8"
          >
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-blue-400" />
              Editar {editType === 'CREDIT_CARD' ? 'Cartão de Crédito' : 'Conta Bancária'}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Nome do Registro / Banco</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">
                  {editType === 'CREDIT_CARD' ? 'Saldo Atual da Fatura (R$)' : 'Saldo Atual (R$)'}
                </label>
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
                    Parâmetros & Imagem do Cartão de Crédito
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

                  {/* Card Image Selector & File Upload */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      Arte do Cartão (Upload de Imagem ou Presets)
                    </label>

                    {/* Custom File Upload Option */}
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors">
                        <Upload className="h-4 w-4 text-blue-400" />
                        <span>Fazer Upload da Imagem do Cartão</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, true)}
                          className="hidden"
                        />
                      </label>

                      {editCardImageUrl && editCardImageUrl.startsWith('data:image') && (
                        <div className="relative h-10 w-14 rounded-lg overflow-hidden border border-blue-500 flex-shrink-0">
                          <img src={editCardImageUrl} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setEditCardImageUrl('')}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-slate-950/80 text-rose-400 hover:text-white"
                            title="Remover Imagem"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Presets Grid */}
                    <div className="grid grid-cols-5 gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {CARD_PRESET_TEMPLATES.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setEditCardImageUrl(preset.id);
                            setEditColor(preset.color);
                          }}
                          className={cn(
                            'p-1.5 rounded-lg border text-[10px] font-bold text-center truncate transition-all',
                            editCardImageUrl === preset.id
                              ? 'border-blue-500 bg-blue-950 text-white ring-2 ring-blue-500/50 scale-95'
                              : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                          )}
                          title={preset.name}
                        >
                          {preset.logo}
                        </button>
                      ))}
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

      {/* New Account / Card Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateAccount}
            className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4 my-8"
          >
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              {accountType === 'CREDIT_CARD' ? (
                <>
                  <CreditCard className="h-5 w-5 text-purple-400" />
                  Cadastrar Novo Cartão de Crédito
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 text-emerald-400" />
                  Cadastrar Nova Conta Bancária
                </>
              )}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Nome do Registro / Banco</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={accountType === 'CREDIT_CARD' ? 'Ex: Nubank Violeta, Inter Black' : 'Ex: Itaú PF, Safra PJ'}
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
                  <label className="font-semibold text-slate-300 block">
                    {accountType === 'CREDIT_CARD' ? 'Fatura Atual (R$)' : 'Saldo Inicial (R$)'}
                  </label>
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
                  <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block">
                    Parâmetros & Imagem do Cartão de Crédito
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

                  {/* Card Image Selector & File Upload */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      Arte do Cartão (Upload de Imagem ou Presets)
                    </label>

                    {/* Custom File Upload Option */}
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors">
                        <Upload className="h-4 w-4 text-purple-400" />
                        <span>Fazer Upload da Imagem do Cartão</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, false)}
                          className="hidden"
                        />
                      </label>

                      {cardImageUrl && cardImageUrl.startsWith('data:image') && (
                        <div className="relative h-10 w-14 rounded-lg overflow-hidden border border-purple-500 flex-shrink-0">
                          <img src={cardImageUrl} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setCardImageUrl('')}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-slate-950/80 text-rose-400 hover:text-white"
                            title="Remover Imagem"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Presets Grid */}
                    <div className="grid grid-cols-5 gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {CARD_PRESET_TEMPLATES.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setCardImageUrl(preset.id);
                            setColorHex(preset.color);
                          }}
                          className={cn(
                            'p-1.5 rounded-lg border text-[10px] font-bold text-center truncate transition-all',
                            cardImageUrl === preset.id
                              ? 'border-purple-500 bg-purple-950 text-white ring-2 ring-purple-500/50 scale-95'
                              : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                          )}
                          title={preset.name}
                        >
                          {preset.logo}
                        </button>
                      ))}
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
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 shadow-md"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Registro'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
