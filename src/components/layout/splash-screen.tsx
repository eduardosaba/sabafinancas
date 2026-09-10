'use client';

import React, { useEffect, useState } from 'react';
import { Wallet, ShieldCheck, TrendingUp, Coins, Sparkles } from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';
import { cn } from '@/lib/utils';

export function SplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const { isHydrated } = useEntity();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Smooth progress bar animation 0 -> 100%
  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const step = Math.floor(Math.random() * 12) + 8;
        return Math.min(100, prev + step);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [mounted]);

  // Handle completion and fade out
  useEffect(() => {
    if (!mounted || progress < 100 || !isHydrated) return;

    const timer1 = setTimeout(() => {
      setFadeOut(true);
    }, 400);

    const timer2 = setTimeout(() => {
      setVisible(false);
    }, 900);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [progress, isHydrated, mounted]);

  if (!visible) return null;

  // Status subtext based on progress %
  const getStatusText = () => {
    if (progress < 30) return 'Carregando ecossistema de finanças...';
    if (progress < 65) return 'Carregando contas, saldos e cartões de crédito...';
    if (progress < 95) return 'Carregando orçamentos e DRE...';
    return 'Tudo pronto!';
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden transition-opacity duration-500 ease-in-out',
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      )}
    >
      <div className="relative z-10 flex flex-col items-center space-y-5 px-4 text-center max-w-sm">

        {/* Glowing Aura Effect */}
        <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-600 opacity-30 blur-2xl animate-pulse" />

        {/* Original Brand Logo Container */}
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl shadow-emerald-950/80">
          <div className="flex items-center justify-center gap-1.5">
            <Wallet className="h-10 w-10 text-emerald-400 animate-bounce" />
            <TrendingUp className="h-8 w-8 text-blue-400" />
          </div>
          <Coins className="absolute -top-2 -right-2 h-6 w-6 text-amber-400 animate-pulse" />
          <Sparkles className="absolute -bottom-1 -left-1 h-5 w-5 text-emerald-300 animate-pulse" />
        </div>

        {/* App Title & Subtitle */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            Mel & Saba Finanças PF / PJ
          </h1>
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Controle Financeiro Completo PF / PJ</span>
          </p>
        </div>

        {/* Real Progress Bar & Percentage */}
        <div className="w-full space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 text-[11px] truncate max-w-[210px]">
              {getStatusText()}
            </span>
            <span className="text-emerald-400 font-extrabold">{mounted ? progress : 0}%</span>
          </div>

          {/* Track & Bar */}
          <div className="w-full h-3 bg-slate-900 border border-slate-800 rounded-full overflow-hidden p-0.5 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full transition-all duration-200 ease-out shadow-sm"
              style={{ width: `${mounted ? progress : 0}%` }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
