'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Entity } from '@/types/finance';
import { fetchEntities } from '@/lib/services/finance-service';

export type EntityType = 'PF' | 'PJ' | 'CONSOLIDATED' | string;

export interface EntityConfig {
  id: string;
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

export const BASE_ENTITY_CONFIGS: Record<'PF' | 'PJ' | 'CONSOLIDATED', EntityConfig> = {
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
    label: 'Empresarial (PJ)',
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
    description: 'Patrimônio Total Combinado (Todas as PJs + PF)',
  },
};

interface EntityContextType {
  entity: EntityType;
  setEntity: (entity: EntityType) => void;
  config: EntityConfig;
  entities: Entity[];
  pjEntities: Entity[];
  activeCompanyId: string | null;
  activeCompany: Entity | null;
  selectCompany: (companyId: string) => void;
  reloadEntities: () => Promise<void>;
  isHydrated: boolean;
}

const EntityContext = createContext<EntityContextType | undefined>(undefined);

const STORAGE_KEY = 'financas_active_entity';
const COMPANY_STORAGE_KEY = 'financas_active_company_id';

export function EntityProvider({ children }: { children: React.ReactNode }) {
  const [entity, setEntityState] = useState<EntityType>('PF');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const loadEntitiesFromDb = async () => {
    try {
      const data = await fetchEntities();
      setEntities(data);

      // Restore active company if saved
      const savedComp = localStorage.getItem(COMPANY_STORAGE_KEY);
      if (savedComp && data.some((e) => e.id === savedComp && e.type === 'PJ')) {
        setActiveCompanyId(savedComp);
      } else {
        const firstPj = data.find((e) => e.type === 'PJ');
        if (firstPj) setActiveCompanyId(firstPj.id);
      }
    } catch (err) {
      console.error('Error fetching entities in EntityProvider:', err);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as EntityType | null;
      if (saved) {
        setEntityState(saved);
      }
    } catch {
      // localStorage fallback
    }
    loadEntitiesFromDb().finally(() => setIsHydrated(true));
  }, []);

  const setEntity = (newEntity: EntityType) => {
    setEntityState(newEntity);
    try {
      localStorage.setItem(STORAGE_KEY, newEntity);
    } catch {}
  };

  const selectCompany = (companyId: string) => {
    setActiveCompanyId(companyId);
    setEntityState(companyId);
    try {
      localStorage.setItem(COMPANY_STORAGE_KEY, companyId);
      localStorage.setItem(STORAGE_KEY, companyId);
    } catch {}
  };

  const pjEntities = useMemo(() => entities.filter((e) => e.type === 'PJ'), [entities]);

  const activeCompany = useMemo(() => {
    if (!activeCompanyId) return pjEntities[0] || null;
    return entities.find((e) => e.id === activeCompanyId) || pjEntities[0] || null;
  }, [entities, activeCompanyId, pjEntities]);

  const config: EntityConfig = useMemo(() => {
    if (entity === 'PF' || entity === '11111111-1111-1111-1111-111111111111') {
      return BASE_ENTITY_CONFIGS.PF;
    }
    if (entity === 'CONSOLIDATED') {
      return BASE_ENTITY_CONFIGS.CONSOLIDATED;
    }

    // PJ or Specific Company ID
    const comp = entities.find((e) => e.id === entity) || activeCompany;
    if (comp) {
      return {
        ...BASE_ENTITY_CONFIGS.PJ,
        id: comp.id,
        label: comp.name,
        shortLabel: comp.name,
        badge: `Empresa: ${comp.name}`,
        description: `Finanças Empresariais da ${comp.name}`,
      };
    }

    return BASE_ENTITY_CONFIGS.PJ;
  }, [entity, entities, activeCompany]);

  return (
    <EntityContext.Provider
      value={{
        entity,
        setEntity,
        config,
        entities,
        pjEntities,
        activeCompanyId,
        activeCompany,
        selectCompany,
        reloadEntities: loadEntitiesFromDb,
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
