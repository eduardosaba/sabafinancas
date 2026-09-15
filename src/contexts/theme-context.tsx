'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

export type ColorPresetId = 'graphite-mint' | 'titanium-cobalt' | 'deep-onyx-gold';

export interface ColorPresetConfig {
  id: ColorPresetId;
  name: string;
  subtitle: string;
  tag: string;
  bgMain: string;
  bgCard: string;
  borderCard: string;
  primaryAccent: string;
  secondaryAccent: string;
  alertAccent: string;
  previewGradient: string;
  description: string;
}

export const COLOR_PRESETS: Record<ColorPresetId, ColorPresetConfig> = {
  'graphite-mint': {
    id: 'graphite-mint',
    name: 'Graphite & Mint',
    subtitle: 'Estilo Linear / Stripe (Recomendada)',
    tag: 'Executivo & Clean',
    bgMain: '#09090B',
    bgCard: '#121215',
    borderCard: '#27272A',
    primaryAccent: '#10B981',
    secondaryAccent: '#8B5CF6',
    alertAccent: '#F43F5E',
    previewGradient: 'from-emerald-500 via-zinc-800 to-violet-500',
    description: 'Preto carvão neutro com acentos em esmeralda sóbria e violeta discreto. Elimina o tom azulado excessivo.',
  },
  'titanium-cobalt': {
    id: 'titanium-cobalt',
    name: 'Titanium & Cobalt',
    subtitle: 'Estilo Corporativo / Nubank PJ',
    tag: 'Segurança Bancária',
    bgMain: '#0B0F19',
    bgCard: '#111827',
    borderCard: '#1E293B',
    primaryAccent: '#2563EB',
    secondaryAccent: '#0EA5E9',
    alertAccent: '#F59E0B',
    previewGradient: 'from-blue-600 via-slate-800 to-sky-400',
    description: 'Tons de ardósia fria com acentos em azul cobalto, ideal para estabilidade corporativa e clareza visual.',
  },
  'deep-onyx-gold': {
    id: 'deep-onyx-gold',
    name: 'Deep Onyx & Warm Gold',
    subtitle: 'Estilo Private Banking',
    tag: 'Patrimonial / Premium',
    bgMain: '#050505',
    bgCard: '#121212',
    borderCard: '#262626',
    primaryAccent: '#D97706',
    secondaryAccent: '#F59E0B',
    alertAccent: '#E11D48',
    previewGradient: 'from-amber-500 via-neutral-900 to-yellow-600',
    description: 'Estética de gestão patrimonial e private banking, com preto ônix profundo e acentos dourados sofisticados.',
  },
};

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  colorPreset: ColorPresetId;
  setColorPreset: (preset: ColorPresetId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [colorPreset, setColorPresetState] = useState<ColorPresetId>('graphite-mint');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Read stored theme from localStorage or system preference
    const storedTheme = localStorage.getItem('app_theme') as Theme | null;
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setThemeState(storedTheme);
    } else {
      setThemeState('dark');
    }

    const storedPreset = localStorage.getItem('app_color_preset') as ColorPresetId | null;
    if (storedPreset && COLOR_PRESETS[storedPreset]) {
      setColorPresetState(storedPreset);
    } else {
      setColorPresetState('graphite-mint');
    }

    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }

    root.setAttribute('data-color-preset', colorPreset);

    localStorage.setItem('app_theme', theme);
    localStorage.setItem('app_color_preset', colorPreset);
  }, [theme, colorPreset, isMounted]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setColorPreset = (preset: ColorPresetId) => {
    setColorPresetState(preset);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_color_preset', preset);
      document.documentElement.setAttribute('data-color-preset', preset);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, colorPreset, setColorPreset }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

