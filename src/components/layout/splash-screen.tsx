'use client';

import React, { useEffect, useState } from 'react';
import { Wallet, ShieldCheck, TrendingUp } from 'lucide-react';
import { useEntity } from '@/contexts/entity-context';

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const { isHydrated } = useEntity();

  useEffect(() => {
    // Only start fade-out sequence after hydration finishes
    if (!isHydrated) return;

    const timer1 = setTimeout(() => {
      setFadeOut(true);
    }, 1000);

    const timer2 = setTimeout(() => {
      setVisible(false);
    }, 1400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isHydrated]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white transition-opacity duration-500 ease-in-out ${fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
    >
      <div className="relative flex flex-col items-center space-y-4">
        {/* Glowing aura effect */}
        <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-600 opacity-30 blur-xl animate-pulse" />

        {/* Logo icon container */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
          <div className="flex items-center justify-center gap-1">
            <Wallet className="h-9 w-9 text-emerald-400 animate-bounce" />
            <TrendingUp className="h-7 w-7 text-blue-400" />
          </div>
        </div>

        {/* Application Name & Tagline */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            Saba Finanças PF / PJ
          </h1>
          <p className="mt-1 text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Controle Financeiro Completo PF / PJ
          </p>
        </div>

        {/* Loading Spinner / Progress bar */}
        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden mt-6">
          <div className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 animate-pulse w-full" />
        </div>
      </div>
    </div>
  );
}
