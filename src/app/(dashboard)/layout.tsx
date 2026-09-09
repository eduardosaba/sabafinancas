'use client';

import React from 'react';
import { EntityProvider } from '@/contexts/entity-context';
import { DateFilterProvider } from '@/contexts/date-filter-context';
import { ToastProvider } from '@/contexts/toast-context';
import { SplashScreen } from '@/components/layout/splash-screen';
import { Header, Sidebar, MobileBottomNav } from '@/components/layout/header';
import { FloatingCalculator } from '@/components/ui/floating-calculator';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <EntityProvider>
        <DateFilterProvider>
          {/* Splash screen component */}
          <SplashScreen />

          <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            {/* Header */}
            <Header />

            {/* Body layout with Sidebar and Main Content */}
            <div className="flex-1 flex w-full">
              <Sidebar />

              <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 overflow-y-auto max-w-7xl mx-auto w-full">
                {children}
              </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <MobileBottomNav />

            {/* Floating Financial Calculator */}
            <FloatingCalculator />
          </div>
        </DateFilterProvider>
      </EntityProvider>
    </ToastProvider>
  );
}
