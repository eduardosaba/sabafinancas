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
  ChevronDown,
  Check,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';
import { useEntity, EntityType } from '@/contexts/entity-context';
import { useDateFilter, DatePeriodOption } from '@/contexts/date-filter-context';
import { useTheme } from '@/contexts/theme-context';
import { TransactionModal } from '@/components/transactions/transaction-modal';
import { CompanyModal } from '@/components/companies/company-modal';
import { PendingPaymentsSidebarWidget } from '@/components/layout/pending-sidebar-widget';
import { fetchAccounts, fetchCategories, ensureUserExistsInDb } from '@/lib/services/finance-service';
import { createClient } from '@/lib/supabase/client';
import { Account, Category } from '@/types/finance';
import { cn } from '@/lib/utils';

export function Header() {
  const {
    entity,
    setEntity,
    config,
    pjEntities,
    activeCompany,
    selectCompany,
    reloadEntities,
  } = useEntity();
  const { filter, setPeriod } = useDateFilter();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modalAccounts, setModalAccounts] = useState<Account[]>([]);
  const [modalCategories, setModalCategories] = useState<Category[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const isPjActive = entity !== 'PF' && entity !== '11111111-1111-1111-1111-111111111111' && entity !== 'CONSOLIDATED';

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

          if (user.email === 'eduardopedro.fsa@gmail.com' || user.email?.includes('eduardopedro') || user.email?.includes('eduardosaba')) {
            name = 'Eduardo Saba';
          } else if (user.email?.includes('melsaba')) {
            name = 'Mel Saba';
          } else if (!name) {
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

          const finalName = name || 'Usuário';
          setUserName(finalName);

          // Sync auth user to public.users table automatically
          await ensureUserExistsInDb(supabase, user.id, {
            email: user.email,
            name: finalName,
          });
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

  // Add event listener for opening mobile menu from anywhere (e.g. bottom nav)
  React.useEffect(() => {
    const handleToggle = () => setIsMobileMenuOpen((prev) => !prev);
    window.addEventListener('toggle-mobile-menu', handleToggle);
    return () => window.removeEventListener('toggle-mobile-menu', handleToggle);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        {/* Main Header Bar */}
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
          
          {/* Brand & Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 active:scale-95"
              title="Abrir Menu Completo"
            >
              <Menu className="h-5 w-5 text-emerald-400" />
            </button>

            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 group-hover:border-slate-700 transition-colors">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="hidden sm:flex sm:flex-col justify-center leading-tight">
                <span className="text-sm font-bold text-slate-100 tracking-tight">Finanças</span>
                <span className="text-[10px] font-medium text-slate-400 tracking-wider">
                  PF / PJ
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Entity Selector (PF / PJ Dropdown / CONSOLIDATED) - Visible on md+ */}
          <div className="hidden md:flex items-center justify-center">
            <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 shadow-inner relative">
              {/* PF Button */}
              <button
                type="button"
                onClick={() => setEntity('PF')}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                  (entity === 'PF' || entity === '11111111-1111-1111-1111-111111111111')
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950 ring-1 ring-emerald-400/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                )}
              >
                <User className="h-3.5 w-3.5" />
                <span>Pessoal PF</span>
              </button>

              {/* PJ Companies Dropdown Trigger */}
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                    isPjActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-950 ring-1 ring-blue-400/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  )}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[140px]">
                    {activeCompany ? activeCompany.name : 'PJ'}
                  </span>
                  <ChevronDown className="h-3 w-3 ml-0.5 flex-shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(true)}
                  className="flex ml-1 p-1 rounded-md text-emerald-400 hover:bg-emerald-950/60 hover:text-emerald-300 transition-colors"
                  title="Cadastrar Nova Empresa (PJ)"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>

                {/* Dropdown Menu */}
                {isCompanyDropdownOpen && (
                  <div
                    className="absolute top-full left-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-150"
                    onMouseLeave={() => setIsCompanyDropdownOpen(false)}
                  >
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Suas Empresas (PJ)
                    </div>

                    {pjEntities.length === 0 ? (
                      <div className="px-2.5 py-2 text-xs text-slate-400 italic">
                        Nenhuma empresa cadastrada
                      </div>
                    ) : (
                      pjEntities.map((comp) => {
                        const isSelected = entity === comp.id || (isPjActive && activeCompany?.id === comp.id);
                        return (
                          <button
                            key={comp.id}
                            type="button"
                            onClick={() => {
                              selectCompany(comp.id);
                              setIsCompanyDropdownOpen(false);
                            }}
                            className={cn(
                              'w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors',
                              isSelected
                                ? 'bg-blue-950/80 text-blue-300 border border-blue-500/40'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                            )}
                          >
                            <span className="truncate">{comp.name}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />}
                          </button>
                        );
                      })
                    )}

                    <div className="pt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCompanyDropdownOpen(false);
                          setIsCompanyModalOpen(true);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold text-emerald-400 hover:bg-emerald-950/60 hover:text-emerald-300 flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ Cadastrar Empresa</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Consolidado Button */}
              <button
                type="button"
                onClick={() => setEntity('CONSOLIDATED')}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
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

          {/* Right Section: + Novo Lançamento, Date Filter, Theme & Profile */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            
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

            {/* Theme Toggle Button (Light / Dark) */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-400 hover:text-amber-300 transition-all flex items-center justify-center shadow-inner"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400 animate-spin-slow" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-400" />
              )}
            </button>

            {/* Profile & SignOut */}
            <div className="flex items-center gap-1.5 sm:gap-2 pl-2 border-l border-slate-800">
              {userEmail?.includes('melsaba') ? (
                <div className="relative h-8 w-8 rounded-full overflow-hidden border border-blue-500/50 flex-shrink-0 bg-slate-800 shadow-sm transition-transform duration-300 transform hover:scale-[1.8] hover:z-50 cursor-pointer origin-center" title={userName || 'Mel Saba'}>
                  <img src="/avatars/avatar_mel.png" alt="Mel Saba" className="w-full h-full object-cover object-top" />
                </div>
              ) : (userEmail?.includes('eduardopedro') || userEmail?.includes('eduardosaba')) ? (
                <div className="relative h-8 w-8 rounded-full overflow-hidden border border-emerald-500/50 flex-shrink-0 bg-slate-800 shadow-sm transition-transform duration-300 transform hover:scale-[1.8] hover:z-50 cursor-pointer origin-center" title={userName || 'Eduardo Saba'}>
                  <img src="/avatars/avatar_eduardo.png" alt="Eduardo Saba" className="w-full h-full object-cover object-top" />
                </div>
              ) : (
                <div
                  title={userEmail ? `${userName} (${userEmail})` : userName || 'Usuário Autenticado'}
                  className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-900 to-slate-800 text-emerald-300 border border-slate-700 font-semibold text-xs shadow-sm uppercase transition-transform duration-300 transform hover:scale-[1.8] hover:z-50 cursor-pointer origin-center"
                >
                  {userInitials}
                </div>
              )}
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

        {/* Mobile Sub-Header Bar for PF / PJ / CONSOLIDATED - Visible only on mobile (< md) */}
        <div className="md:hidden border-t border-slate-800/80 bg-slate-950/95 px-3 py-1.5 flex items-center justify-center">
          <div className="inline-flex p-0.5 rounded-xl bg-slate-900 border border-slate-800 shadow-inner relative w-full max-w-sm justify-around">
            
            {/* PF Button */}
            <button
              type="button"
              onClick={() => setEntity('PF')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-xs font-bold transition-all',
                (entity === 'PF' || entity === '11111111-1111-1111-1111-111111111111')
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <User className="h-3.5 w-3.5" />
              <span>PF</span>
            </button>

            {/* PJ Button with Dropdown */}
            <div className="relative flex-1 flex items-center justify-center">
              <button
                type="button"
                onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                className={cn(
                  'w-full flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-xs font-bold transition-all',
                  isPjActive
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span className="truncate max-w-[80px]">
                  {activeCompany ? activeCompany.name : 'PJ'}
                </span>
                <ChevronDown className="h-3 w-3 flex-shrink-0" />
              </button>

              {/* Mobile PJ Dropdown */}
              {isCompanyDropdownOpen && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-50 space-y-1"
                  onMouseLeave={() => setIsCompanyDropdownOpen(false)}
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Suas Empresas (PJ)
                  </div>

                  {pjEntities.length === 0 ? (
                    <div className="px-2.5 py-2 text-xs text-slate-400 italic">
                      Nenhuma empresa cadastrada
                    </div>
                  ) : (
                    pjEntities.map((comp) => {
                      const isSelected = entity === comp.id || (isPjActive && activeCompany?.id === comp.id);
                      return (
                        <button
                          key={comp.id}
                          type="button"
                          onClick={() => {
                            selectCompany(comp.id);
                            setIsCompanyDropdownOpen(false);
                          }}
                          className={cn(
                            'w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors',
                            isSelected
                              ? 'bg-blue-950/80 text-blue-300 border border-blue-500/40'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                          )}
                        >
                          <span className="truncate">{comp.name}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />}
                        </button>
                      );
                    })
                  )}

                  <div className="pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCompanyDropdownOpen(false);
                        setIsCompanyModalOpen(true);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold text-emerald-400 hover:bg-emerald-950/60 hover:text-emerald-300 flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Cadastrar Empresa</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Consolidado Button */}
            <button
              type="button"
              onClick={() => setEntity('CONSOLIDATED')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-xs font-bold transition-all',
                entity === 'CONSOLIDATED'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Consolid.</span>
            </button>
          </div>
        </div>
      </header>

      {/* Slide-over Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Container */}
          <div className="relative w-5/6 max-w-sm bg-slate-950 border-r border-slate-800 p-5 shadow-2xl z-50 flex flex-col h-full overflow-y-auto animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-emerald-400">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Finanças PF / PJ</h3>
                  <p className="text-[11px] text-slate-400">Menu Navegação</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Entity Switcher Section */}
            <div className="py-4 border-b border-slate-800/80 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Modo de Operação
              </span>

              <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setEntity('PF');
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    'py-2 px-1 rounded-lg text-xs font-bold text-center transition-all flex flex-col items-center gap-1',
                    (entity === 'PF' || entity === '11111111-1111-1111-1111-111111111111')
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  <User className="h-4 w-4" />
                  <span>PF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (pjEntities.length > 0) selectCompany(pjEntities[0].id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    'py-2 px-1 rounded-lg text-xs font-bold text-center transition-all flex flex-col items-center gap-1',
                    isPjActive ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  )}
                >
                  <Building2 className="h-4 w-4" />
                  <span>PJ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEntity('CONSOLIDATED');
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    'py-2 px-1 rounded-lg text-xs font-bold text-center transition-all flex flex-col items-center gap-1',
                    entity === 'CONSOLIDATED' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  )}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Consolid.</span>
                </button>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="py-4 space-y-1 border-b border-slate-800/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-2 mb-2">
                Páginas Principais
              </span>
              {NAVIGATION_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all',
                      isActive
                        ? 'bg-slate-900 text-emerald-400 border border-slate-800 shadow-sm'
                        : 'text-slate-300 hover:bg-slate-900/60 hover:text-white'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', isActive ? 'text-emerald-400' : 'text-slate-400')} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Quick Date Period Filter */}
            <div className="py-4 border-b border-slate-800/80 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Filtrar Período
              </span>
              <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {periodOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setPeriod(opt.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      'py-1.5 px-1 rounded-lg text-[11px] font-medium transition-colors text-center truncate',
                      filter.period === opt.id
                        ? 'bg-slate-800 text-slate-100 font-bold border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pending Payments Widget inside Mobile Drawer */}
            <div className="py-4 border-b border-slate-800/80">
              <PendingPaymentsSidebarWidget />
            </div>

            {/* Footer Profile & Actions */}
            <div className="mt-auto pt-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center gap-2.5">
                  {userEmail?.includes('melsaba') ? (
                    <img src="/avatars/avatar_mel.png" alt="Mel Saba" className="h-8 w-8 rounded-full object-cover object-top border border-blue-500/50" />
                  ) : (userEmail?.includes('eduardopedro') || userEmail?.includes('eduardosaba')) ? (
                    <img src="/avatars/avatar_eduardo.png" alt="Eduardo Saba" className="h-8 w-8 rounded-full object-cover object-top border border-emerald-500/50" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-emerald-400 font-bold text-xs border border-slate-700 uppercase">
                      {userInitials}
                    </div>
                  )}
                  <div className="truncate max-w-[130px]">
                    <p className="text-xs font-bold text-slate-200 truncate">{userName || 'Usuário'}</p>
                    <p className="text-[10px] text-slate-500 truncate">{userEmail || ''}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  title="Alternar Tema"
                  className="p-2 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700 transition-colors"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleSignOut();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-950/60 border border-rose-900/50 text-rose-300 hover:bg-rose-900/60 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Company Creation Modal */}
      <CompanyModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        onSuccess={async (newComp) => {
          await reloadEntities();
          selectCompany(newComp.id);
        }}
      />
    </>
  );
}

// Navigation items definition
export const NAVIGATION_ITEMS = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Transações', href: '/transactions', icon: Receipt },
  { name: 'Cartões', href: '/cards', icon: CreditCard },
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAccounts, setModalAccounts] = useState<Account[]>([]);
  const [modalCategories, setModalCategories] = useState<Category[]>([]);

  const handleOpenModal = async () => {
    const [accs, cats] = await Promise.all([
      fetchAccounts('CONSOLIDATED'),
      fetchCategories('CONSOLIDATED'),
    ]);
    setModalAccounts(accs);
    setModalCategories(cats);
    setIsModalOpen(true);
  };

  const handleOpenMenuDrawer = () => {
    window.dispatchEvent(new CustomEvent('toggle-mobile-menu'));
  };

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md px-1 py-1.5 flex items-center justify-around shadow-2xl">
        <Link
          href="/"
          className={cn(
            'flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-all',
            pathname === '/' ? cn('text-slate-100 font-semibold', config.textColor) : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Painel</span>
        </Link>

        <Link
          href="/cards"
          className={cn(
            'flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-all',
            pathname?.startsWith('/cards') ? cn('text-slate-100 font-semibold', config.textColor) : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <CreditCard className="h-4 w-4" />
          <span>Cartões</span>
        </Link>

        {/* Central Floating Quick Transaction Launch Button */}
        <button
          type="button"
          onClick={handleOpenModal}
          className="flex flex-col items-center justify-center -mt-5 p-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-950/90 border-2 border-slate-950 transition-all active:scale-95"
          title="Novo Lançamento Rápido"
        >
          <Plus className="h-5 w-5" />
        </button>

        <Link
          href="/transactions"
          className={cn(
            'flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-all',
            pathname?.startsWith('/transactions') ? cn('text-slate-100 font-semibold', config.textColor) : 'text-slate-400 hover:text-slate-200'
          )}
        >
          <Receipt className="h-4 w-4" />
          <span>Extrato</span>
        </Link>

        {/* Mobile Menu Drawer Trigger Button */}
        <button
          type="button"
          onClick={handleOpenMenuDrawer}
          className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-all text-slate-400 hover:text-slate-200 active:scale-95"
          title="Abrir Menu Completo"
        >
          <Menu className="h-4 w-4 text-emerald-400" />
          <span>Menu</span>
        </button>
      </nav>

      {/* Transaction Modal for Mobile Quick Launch */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accounts={modalAccounts}
        categories={modalCategories}
        onSuccess={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('transactionUpdated'));
          }
        }}
      />
    </>
  );
}
