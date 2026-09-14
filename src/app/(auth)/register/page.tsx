'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wallet, Mail, Lock, UserPlus, AlertCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { translateAuthError } from '@/lib/auth-errors';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message || 'Erro ao realizar cadastro.');
      } else {
        setSuccessMsg('Cadastro realizado com sucesso! Redirecionando...');
        setTimeout(() => {
          window.location.href = '/';
        }, 1200);
      }
    } catch {
      setErrorMsg('Falha no sistema. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-blue-400 shadow-xl">
            <Wallet className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Criar Nova Conta</h1>
          <p className="text-xs text-slate-400">Saba Controle Financeiro Completo PF / PJ</p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleRegister}
          className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4"
        >
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-1 text-xs">
            <label className="font-semibold text-slate-300 block">Nome Completo</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu Nome"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-semibold text-slate-300 block">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <label className="font-semibold text-slate-300 block">Senha (Mínimo 6 caracteres)</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            <span>{isLoading ? 'Cadastrando...' : 'Criar Conta e Iniciar'}</span>
          </button>

          <div className="text-center pt-2 border-t border-slate-800 text-xs text-slate-400">
            Já possui uma conta?{' '}
            <Link href="/login" className="text-blue-400 font-bold hover:underline">
              Fazer Login
            </Link>
          </div>
        </form>

        <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
          <span>Sua privacidade e dados criptografados</span>
        </div>

      </div>
    </div>
  );
}
