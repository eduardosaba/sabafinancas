'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Wallet, User, Lock, LogIn, AlertCircle, ShieldCheck, Eye, EyeOff, Sparkles, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { translateAuthError } from '@/lib/auth-errors';
import { cn } from '@/lib/utils';

export default function LoginPage({ forceFamilyMode }: { forceFamilyMode?: boolean }) {
  const router = useRouter();
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic subdomain & mode detection
  const [isFamilyMode, setIsFamilyMode] = useState<boolean>(Boolean(forceFamilyMode));
  const [modeLoaded, setModeLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      const pathname = window.location.pathname;

      if (search.includes('logout=true')) {
        const supabase = createClient();
        supabase.auth.signOut().catch(() => { });
      }

      // Family / Mel & Saba mode active on /login/melesaba, /melesaba, /login/familia, or via query params (?acesso=melesaba, ?acesso=familia)
      const isFamily =
        Boolean(forceFamilyMode) ||
        pathname.includes('/melesaba') ||
        pathname.includes('/familia') ||
        search.includes('acesso=melesaba') ||
        search.includes('melesaba=true') ||
        search.includes('acesso=familia') ||
        search.includes('familia=true') ||
        search.includes('rapido=true');

      setIsFamilyMode(isFamily);
      setModeLoaded(true);
    }
  }, [forceFamilyMode]);

  const cleanInput = loginInput.trim().toLowerCase();
  const isEduardo = cleanInput === 'eduardosaba' || cleanInput === 'eduardo';
  const isMel = cleanInput === 'melsaba' || cleanInput === 'mel';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    let targetEmail = cleanInput;
    let displayName = 'Usuário';

    if (isEduardo) {
      targetEmail = 'eduardopedro.fsa@gmail.com';
      displayName = 'Eduardo Saba';
    } else if (isMel) {
      targetEmail = 'melsaba@financas.com.br';
      displayName = 'Mel Saba';
    } else if (!cleanInput.includes('@')) {
      targetEmail = `${cleanInput}@financas.com.br`;
    }

    try {
      const supabase = createClient();
      let { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      // If user doesn't exist yet in Supabase Auth (e.g. initial login), auto-signup
      if (error && (isEduardo || isMel || cleanInput.includes('saba'))) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: targetEmail,
          password,
          options: {
            data: { name: displayName },
          },
        });

        if (!signUpError) {
          const retry = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password,
          });
          data = retry.data;
          error = retry.error;
        }
      }

      if (error) {
        setErrorMsg(translateAuthError(error.message));
      } else {
        if (isFamilyMode && typeof window !== 'undefined') {
          localStorage.setItem('modo_familia', 'true');
        }
        window.location.href = '/';
      }
    } catch {
      setErrorMsg('Falha ao autenticar. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">

        {/* Logo Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-emerald-400 shadow-xl">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            {isFamilyMode ? 'Finanças PF / PJ' : 'Meu Financeiro PF / PJ'}
          </h1>
          <p className="text-xs text-slate-400">
            {isFamilyMode
              ? 'Selecione seu perfil ou digite seu usuário para acessar'
              : 'Entre com seu e-mail e senha para gerenciar suas contas'}
          </p>
        </div>

        {/* 3D Avatars Profile Switcher (Only rendered in Family Mode) */}
        {isFamilyMode && (
          <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-200">
            {/* Eduardo Saba Avatar */}
            <button
              type="button"
              onClick={() => setLoginInput('eduardosaba')}
              className={cn(
                'p-3 rounded-2xl bg-slate-900 border text-left flex items-center gap-3 transition-all duration-200 group relative overflow-visible',
                isEduardo
                  ? 'border-emerald-500 bg-emerald-950/30 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-950/50'
                  : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
              )}
            >
              <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-slate-700 group-hover:scale-[2] hover:scale-[2] transition-transform duration-300 ease-out flex-shrink-0 bg-slate-800 z-30 shadow-xl origin-center">
                <img
                  src="/avatars/avatar_eduardo.png"
                  alt="Eduardo Saba 3D Avatar"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-slate-100 flex items-center gap-1">
                  <span className="truncate">Eduardo Saba</span>
                  {isEduardo && <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
                </div>
                <div className="text-[10px] font-mono text-emerald-400 font-semibold truncate">
                  eduardosaba
                </div>
              </div>
            </button>

            {/* Mel Saba Avatar */}
            <button
              type="button"
              onClick={() => setLoginInput('melsaba')}
              className={cn(
                'p-3 rounded-2xl bg-slate-900 border text-left flex items-center gap-3 transition-all duration-200 group relative overflow-visible',
                isMel
                  ? 'border-blue-500 bg-blue-950/30 ring-2 ring-blue-500/50 shadow-lg shadow-blue-950/50'
                  : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
              )}
            >
              <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-slate-700 group-hover:scale-[2] hover:scale-[2] transition-transform duration-300 ease-out flex-shrink-0 bg-slate-800 z-30 shadow-xl origin-center">
                <img
                  src="/avatars/avatar_mel.png"
                  alt="Mel Saba 3D Avatar"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-slate-100 flex items-center gap-1">
                  <span className="truncate">Mel Saba</span>
                  {isMel && <Check className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />}
                </div>
                <div className="text-[10px] font-mono text-blue-400 font-semibold truncate">
                  melsaba
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Form Card */}
        <form
          onSubmit={handleLogin}
          className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4"
        >
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Field */}
          <div className="space-y-1 text-xs">
            <label className="font-semibold text-slate-300 block">Usuário ou E-mail</label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder={isFamilyMode ? 'eduardosaba ou melsaba' : 'seu.email@exemplo.com'}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>
          </div>

          {/* Password Field with Eye Icon Toggle */}
          <div className="space-y-1 text-xs">
            <label className="font-semibold text-slate-300 block">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                className="absolute right-3 top-2.5 p-1 rounded-lg text-slate-500 hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4 text-emerald-400" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            <span>{isLoading ? 'Entrando...' : 'Entrar no Sistema'}</span>
          </button>

          <div className="text-center pt-2 border-t border-slate-800 text-xs text-slate-400">
            Não possui uma conta?{' '}
            <Link href="/register" className="text-emerald-400 font-bold hover:underline">
              Cadastre-se gratuitamente
            </Link>
          </div>
        </form>

        {/* Footer Info */}
        <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Autenticação segura via Supabase Auth</span>
        </div>

      </div>
    </div>
  );
}

