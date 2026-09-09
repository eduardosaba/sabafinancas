'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type EntityType = 'PF' | 'PJ' | 'CONSOLIDATED';

export interface EntityConfig {
  id: EntityType;
  label: string;
  shortLabel: string;
  badge: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  hoverColor: string;
  textColor: string;
  activeRing: string;
  iconName: 'user' | 'building' | 'bar-chart';
  description: string;
}

export const ENTITY_CONFIGS: Record<EntityType, EntityConfig> = {
  PF: {
    id: 'PF',
    label: 'Pessoal (PF)',
    shortLabel: 'PF',
    badge: 'Pessoa Física',
    accentColor: '#10b981',
    bgColor: 'bg-emerald-950/40',
    borderColor: 'border-emerald-500/30',
    hoverColor: 'hover:bg-emerald-900/30',
    textColor: 'text-emerald-400',
    activeRing: 'ring-2 ring-emerald-500',
    iconName: 'user',
    description: 'Finanças Pessoais e Orçamento Familiar',
  },
  PJ: {
    id: 'PJ',
    label: 'Empresa (PJ)',
    shortLabel: 'PJ',
    badge: 'Pessoa Jurídica',
    accentColor: '#3b82f6',
    bgColor: 'bg-blue-950/40',
    borderColor: 'border-blue-500/30',
    hoverColor: 'hover:bg-blue-900/30',
    textColor: 'text-blue-400',
    activeRing: 'ring-2 ring-blue-500',
    iconName: 'building',
    description: 'Finanças Empresariais e Fluxo de Caixa',
  },
  CONSOLIDATED: {
    id: 'CONSOLIDATED',
    label: 'Consolidado (PF + PJ)',
    shortLabel: 'Consolidado',
    badge: 'Visão Geral',
    accentColor: '#8b5cf6',
    bgColor: 'bg-purple-950/40',
    borderColor: 'border-purple-500/30',
    hoverColor: 'hover:bg-purple-900/30',
    textColor: 'text-purple-400',
    activeRing: 'ring-2 ring-purple-500',
    iconName: 'bar-chart',
    description: 'Patrimônio Total Combinado',
  },
};

interface EntityContextType {
  entity: EntityType;
  setEntity: (entity: EntityType) => void;
  config: EntityConfig;
  isHydrated: boolean;
}

const EntityContext = createContext<EntityContextType | undefined>(undefined);

const STORAGE_KEY = 'financas_active_entity';

export function EntityProvider({ children }: { children: React.ReactNode }) {
  const [entity, setEntityState] = useState<EntityType>('PF');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as EntityType | null;
      if (saved && (saved === 'PF' || saved === 'PJ' || saved === 'CONSOLIDATED')) {
        setEntityState(saved);
      }
    } catch {
      // localStorage fallback if disabled
    }
    setIsHydrated(true);
  }, []);

  const setEntity = (newEntity: EntityType) => {
    setEntityState(newEntity);
    try {
      localStorage.setItem(STORAGE_KEY, newEntity);
    } catch {
      // Ignore storage write errors
    }
  };

  return (
    <EntityContext.Provider
      value={{
        entity,
        setEntity,
        config: ENTITY_CONFIGS[entity],
        isHydrated,
      }}
    >
      {children}
    </EntityContext.Provider>
  );
}

export function useEntity(): EntityContextType {
  const context = useContext(EntityContext);
  if (!context) {
    throw new Error('useEntity deve ser usado dentro de um EntityProvider');
  }
  return context;
}
