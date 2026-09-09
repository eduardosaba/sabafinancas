'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  User,
  Building2,
  BarChart3,
  Calendar,
  Wallet,
  Receipt,
  CreditCard,
  PieChart,
  Settings,
  Plus,
  LogOut,
} from 'lucide-react';
import { useEntity, EntityType, ENTITY_CONFIGS } from '@/contexts/entity-context';
import { useDateFilter, DatePeriodOption } from '@/contexts/date-filter-context';
import { TransactionModal } from '@/components/transactions/transaction-modal';
import { PendingPaymentsSidebarWidget } from '@/components/layout/pending-sidebar-widget';
import { fetchAccounts, fetchCategories } from '@/lib/services/finance-service';
import { createClient } from '@/lib/supabase/client';
import { Account, Category } from '@/types/finance';
import { cn } from '@/lib/utils';

export function Header() {
  const { entity, setEntity, config } = useEntity();
  const { filter, setPeriod } = useDateFilter();
  const pathname = usePathname();
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAccounts, setModalAccounts] = useState<Account[]>([]);
  const [modalCategories, setModalCategories] = useState<Category[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  React.useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserEmail(user.email || null);
          let name = user.user_metadata?.name || user.user_metadata?.full_name;

          if (!name) {
            const { data: dbUser } = await supabase
              .from('users')
              .select('name')
              .eq('id', user.id)
              .maybeSingle();

            if (dbUser?.name) {
              name = dbUser.name;
            }
          }

          if (!name && user.email) {
            const prefix = user.email.split('@')[0];
            name = prefix
              .replace(/[._-]/g, ' ')
              .split(' ')
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(' ');
          }

          setUserName(name || 'Usuário');
        }
      } catch (err) {
        console.error('Error fetching user in Header:', err);
      }
    }
    loadUser();
  }, []);

  const userInitials = useMemo(() => {
    if (!userName) return 'US';
    const parts = userName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return userName.slice(0, 2).toUpperCase();
  }, [userName]);

  const periodOptions: { id: DatePeriodOption; label: string }[] = [
    { id: 'THIS_MONTH', label: 'Este Mês' },
    { id: 'LAST_MONTH', label: 'Mês Anterior' },
    { id: 'LAST_30_DAYS', label: 'Últimos 30 Dias' },
  ];

  const handleOpenModal = async () => {
    const [accs, cats] = await Promise.all([
      fetchAccounts('CONSOLIDATED'),
      fetchCategories('CONSOLIDATED'),
    ]);
    setModalAccounts(accs);
    setModalCategories(cats);
    setIsModalOpen(true);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 group-hover:border-slate-700 transition-colors">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="hidden sm:block">
                <span className="text-base font-bold text-slate-100 tracking-tight">Finanças</span>
                <span className="text-xs ml-1 font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  PF / PJ
                </span>
              </div>
            </Link>
          </div>

          {/* Entity Selector (PF / PJ / CONSOLIDATED) */}
          <div className="flex items-center">
            <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 shadow-inner">
              
              <button
                type="button"
                onClick={() => setEntity('PF')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                  entity === 'PF'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950 ring-1 ring-emerald-400/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                )}
              >
                <User className="h-3.5 w-3.5" />
                <span>Pessoal (PF)</span>
              </button>

              <button
                type="button"
                onClick={() => setEntity('PJ')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                  entity === 'PJ'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-950 ring-1 ring-blue-400/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Empresa (PJ)</span>
              </button>

              <button
                type="button"
                onClick={() => setEntity('CONSOLIDATED')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                  entity === 'CONSOLIDATED'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950 ring-1 ring-purple-400/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                )}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Consolidado</span>
              </button>
            </div>
          </div>

          {/* Right Section: + Novo Lançamento, Date Filter & Profile */}
          <div className="flex items-center gap-3">
            
            {/* + Novo Lançamento Button */}
            <button
              type="button"
              onClick={handleOpenModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Lançamento</span>
            </button>

            {/* Quick Date Selector */}
            <div className="hidden md:flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
              {periodOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriod(opt.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    filter.period === opt.id
                      ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Profile & SignOut */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div
                title={userEmail ? `${userName} (${userEmail})` : userName || 'Usuário Autenticado'}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-900 to-slate-800 text-emerald-300 border border-slate-700 font-semibold text-xs shadow-sm uppercase"
              >
                {userInitials}
              </div>
              {userName && (
                <span className="hidden xl:inline-block text-xs text-slate-300 font-semibold truncate max-w-[140px]">
                  {userName}
                </span>
              )}

              <button
                type="button"
                onClick={handleSignOut}
                title="Sair da Conta"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accounts={modalAccounts}
        categories={modalCategories}
        onSuccess={() => {
          if (typeof window !== 'undefined') window.location.reload();
        }}
      />
    </>
  );
}

// Navigation items definition
export const NAVIGATION_ITEMS = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Transações', href: '/transactions', icon: Receipt },
  { name: 'Dívidas', href: '/debts', icon: CreditCard },
  { name: 'Orçamentos', href: '/budgets', icon: PieChart },
  { name: 'Configurações', href: '/settings/accounts', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { entity, config } = useEntity();

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-slate-800 bg-slate-950 p-4 min-h-[calc(100vh-4rem)]">
      
      <div className={cn('mb-4 p-3.5 rounded-xl border transition-all duration-300', config.bgColor, config.borderColor)}>
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg bg-slate-900/80 border border-slate-800', config.textColor)}>
            {entity === 'PF' && <User className="h-4 w-4" />}
            {entity === 'PJ' && <Building2 className="h-4 w-4" />}
            {entity === 'CONSOLIDATED' && <BarChart3 className="h-4 w-4" />}
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Modo Ativo</span>
            <span className={cn('text-sm font-bold block', config.textColor)}>{config.label}</span>
          </div>
        </div>
      </div>

      {/* Pending / Overdue Payments Widget in Sidebar */}
      <PendingPaymentsSidebarWidget />

      <nav className="flex-1 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
          Menu Principal
        </div>
        {NAVIGATION_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150',
                isActive
                  ? 'bg-slate-900 text-slate-100 border border-slate-800 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              )}
            >
              <Icon className={cn('h-4 w-4', isActive ? config.textColor : 'text-slate-400')} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Sistema Ativo
        </span>
        <span className="text-slate-600 font-mono">v1.0.0</span>
      </div>
    </aside>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { config } = useEntity();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md px-2 py-1.5 flex items-center justify-around">
      {NAVIGATION_ITEMS.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium transition-all',
              isActive
                ? cn('text-slate-100 font-semibold', config.textColor)
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
