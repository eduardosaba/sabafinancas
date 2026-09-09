'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';

export type DatePeriodOption = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30_DAYS' | 'CUSTOM';

export interface DateFilterState {
  period: DatePeriodOption;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;
}

interface DateFilterContextType {
  filter: DateFilterState;
  setPeriod: (period: DatePeriodOption) => void;
  setCustomRange: (startDate: string, endDate: string) => void;
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateDatesForPeriod(period: DatePeriodOption, customStart?: string, customEnd?: string): { startDate: string; endDate: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === 'THIS_MONTH') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const monthName = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const formattedLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return {
      startDate: formatDateISO(start),
      endDate: formatDateISO(end),
      label: formattedLabel,
    };
  }

  if (period === 'LAST_MONTH') {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const monthName = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const formattedLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return {
      startDate: formatDateISO(start),
      endDate: formatDateISO(end),
      label: formattedLabel,
    };
  }

  if (period === 'LAST_30_DAYS') {
    const start = new Date();
    start.setDate(now.getDate() - 30);
    return {
      startDate: formatDateISO(start),
      endDate: formatDateISO(now),
      label: 'Últimos 30 Dias',
    };
  }

  // CUSTOM
  const startStr = customStart || formatDateISO(new Date(year, month, 1));
  const endStr = customEnd || formatDateISO(now);
  return {
    startDate: startStr,
    endDate: endStr,
    label: `Personalizado (${startStr} a ${endStr})`,
  };
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

export function DateFilterProvider({ children }: { children: React.ReactNode }) {
  const [period, setPeriodState] = useState<DatePeriodOption>('THIS_MONTH');
  const [customRange, setCustomRangeState] = useState<{ startDate?: string; endDate?: string }>({});

  const filter = useMemo<DateFilterState>(() => {
    const computed = calculateDatesForPeriod(period, customRange.startDate, customRange.endDate);
    return {
      period,
      ...computed,
    };
  }, [period, customRange]);

  const setPeriod = (newPeriod: DatePeriodOption) => {
    setPeriodState(newPeriod);
  };

  const setCustomRange = (startDate: string, endDate: string) => {
    setCustomRangeState({ startDate, endDate });
    setPeriodState('CUSTOM');
  };

  return (
    <DateFilterContext.Provider
      value={{
        filter,
        setPeriod,
        setCustomRange,
      }}
    >
      {children}
    </DateFilterContext.Provider>
  );
}

export function useDateFilter(): DateFilterContextType {
  const context = useContext(DateFilterContext);
  if (!context) {
    throw new Error('useDateFilter deve ser usado dentro de um DateFilterProvider');
  }
  return context;
}
