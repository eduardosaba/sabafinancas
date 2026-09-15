import { createClient } from './client';
import { Account, Category, Entity } from '@/types/finance';

export const SEED_ENTITIES: Omit<Entity, 'createdAt'>[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Pessoal (PF)', type: 'PF' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Empresa (PJ)', type: 'PJ' },
];

export const SEED_ACCOUNTS: Omit<Account, 'createdAt'>[] = [
  {
    id: '33333333-3333-3333-3333-333333333333',
    entityId: '11111111-1111-1111-1111-111111111111',
    name: 'Nubank (PF)',
    accountType: 'CHECKING',
    initialBalance: 2500.0,
    currentBalance: 7680.0,
    colorHex: '#10b981',
    isActive: true,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    entityId: '11111111-1111-1111-1111-111111111111',
    name: 'Carteira / Dinheiro',
    accountType: 'CASH',
    initialBalance: 300.0,
    currentBalance: 450.0,
    colorHex: '#059669',
    isActive: true,
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    entityId: '11111111-1111-1111-1111-111111111111',
    name: 'Cartão Nubank Ultravioleta',
    accountType: 'CREDIT_CARD',
    initialBalance: 0.0,
    currentBalance: -1450.0,
    colorHex: '#8b5cf6',
    closingDay: 25,
    dueDay: 5,
    creditLimit: 15000.0,
    cardImageUrl: 'nubank',
    isActive: true,
  },
  {
    id: '99999999-9999-9999-9999-999999999999',
    entityId: '11111111-1111-1111-1111-111111111111',
    name: 'Cartão Itaú Personnalité',
    accountType: 'CREDIT_CARD',
    initialBalance: 0.0,
    currentBalance: -2890.5,
    colorHex: '#ea580c',
    closingDay: 20,
    dueDay: 30,
    creditLimit: 35000.0,
    cardImageUrl: 'itau_black',
    isActive: true,
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    entityId: '22222222-2222-2222-2222-222222222222',
    name: 'Banco Inter PJ',
    accountType: 'CHECKING',
    initialBalance: 10000.0,
    currentBalance: 27550.0,
    colorHex: '#3b82f6',
    isActive: true,
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    entityId: '22222222-2222-2222-2222-222222222222',
    name: 'Caixa Operacional',
    accountType: 'CHECKING',
    initialBalance: 5000.0,
    currentBalance: 12000.0,
    colorHex: '#2563eb',
    isActive: true,
  },
  {
    id: '88888888-8888-8888-8888-888888888888',
    entityId: '22222222-2222-2222-2222-222222222222',
    name: 'Cartão Inter Black Empresarial',
    accountType: 'CREDIT_CARD',
    initialBalance: 0.0,
    currentBalance: -4200.0,
    colorHex: '#f97316',
    closingDay: 15,
    dueDay: 25,
    creditLimit: 50000.0,
    cardImageUrl: 'inter_gold',
    isActive: true,
  },
];

export const SEED_CATEGORIES: Omit<Category, 'createdAt'>[] = [
  // PF Categories
  { id: 'c1111111-1111-1111-1111-111111111111', entityId: '11111111-1111-1111-1111-111111111111', name: 'Alimentação', nature: 'EXPENSE', icon: 'utensils', colorHex: '#ef4444' },
  { id: 'c1111111-1111-1111-1111-222222222222', entityId: '11111111-1111-1111-1111-111111111111', name: 'Moradia', nature: 'EXPENSE', icon: 'home', colorHex: '#8b5cf6' },
  { id: 'c1111111-1111-1111-1111-333333333333', entityId: '11111111-1111-1111-1111-111111111111', name: 'Combustível / Transporte', nature: 'EXPENSE', icon: 'fuel', colorHex: '#f59e0b' },
  { id: 'c1111111-1111-1111-1111-444444444444', entityId: '11111111-1111-1111-1111-111111111111', name: 'Lazer & Entretenimento', nature: 'EXPENSE', icon: 'film', colorHex: '#ec4899' },
  { id: 'c1111111-1111-1111-1111-555555555555', entityId: '11111111-1111-1111-1111-111111111111', name: 'Saúde & Bem-Estar', nature: 'EXPENSE', icon: 'heart-pulse', colorHex: '#10b981' },
  { id: 'c1111111-1111-1111-1111-666666666666', entityId: '11111111-1111-1111-1111-111111111111', name: 'Salário / Pró-labore', nature: 'INCOME', icon: 'dollar-sign', colorHex: '#06b6d4' },
  { id: 'c1111111-1111-1111-1111-777777777777', entityId: '11111111-1111-1111-1111-111111111111', name: 'Investimentos & Dividendos', nature: 'INCOME', icon: 'trending-up', colorHex: '#10b981' },
  { id: 'c1111111-1111-1111-1111-888888888888', entityId: '11111111-1111-1111-1111-111111111111', name: 'Outras Receitas / Extras', nature: 'INCOME', icon: 'plus-circle', colorHex: '#3b82f6' },
  { id: 'c1111111-1111-1111-1111-999999999999', entityId: '11111111-1111-1111-1111-111111111111', name: 'Educação & Cursos', nature: 'EXPENSE', icon: 'book-open', colorHex: '#6366f1' },
  { id: 'c1111111-1111-1111-1111-aaaaaaaaaaaa', entityId: '11111111-1111-1111-1111-111111111111', name: 'Vestuário & Compras', nature: 'EXPENSE', icon: 'shopping-bag', colorHex: '#f43f5e' },
  { id: 'c1111111-1111-1111-1111-bbbbbbbbbbbb', entityId: '11111111-1111-1111-1111-111111111111', name: 'Assinaturas & Serviços', nature: 'EXPENSE', icon: 'tv', colorHex: '#a855f7' },
  { id: 'c1111111-1111-1111-1111-cccccccccccc', entityId: '11111111-1111-1111-1111-111111111111', name: 'Seguros & Financiamentos', nature: 'EXPENSE', icon: 'shield-check', colorHex: '#0284c7' },
  { id: 'c1111111-1111-1111-1111-dddddddddddd', entityId: '11111111-1111-1111-1111-111111111111', name: 'Tarifas Bancárias & Impostos PF', nature: 'EXPENSE', icon: 'percent', colorHex: '#64748b' },
  { id: 'c1111111-1111-1111-1111-eeeeeeeeeeee', entityId: '11111111-1111-1111-1111-111111111111', name: 'Pets / Animais', nature: 'EXPENSE', icon: 'dog', colorHex: '#d97706' },
  
  // PJ Categories
  { id: 'c2222222-2222-2222-2222-111111111111', entityId: '22222222-2222-2222-2222-222222222222', name: 'Vendas / Serviços Prestados', nature: 'INCOME', icon: 'briefcase', colorHex: '#10b981' },
  { id: 'c2222222-2222-2222-2222-222222222222', entityId: '22222222-2222-2222-2222-222222222222', name: 'Fornecedores & Insumos', nature: 'EXPENSE', icon: 'truck', colorHex: '#3b82f6' },
  { id: 'c2222222-2222-2222-2222-333333333333', entityId: '22222222-2222-2222-2222-222222222222', name: 'Impostos & DAS / Tributos', nature: 'EXPENSE', icon: 'file-text', colorHex: '#dc2626' },
  { id: 'c2222222-2222-2222-2222-444444444444', entityId: '22222222-2222-2222-2222-222222222222', name: 'Custos Operacionais Gerais', nature: 'EXPENSE', icon: 'settings', colorHex: '#64748b' },
  { id: 'c2222222-2222-2222-2222-555555555555', entityId: '22222222-2222-2222-2222-222222222222', name: 'Pró-labore / Distribuição de Lucros', nature: 'EXPENSE', icon: 'corner-up-right', colorHex: '#8b5cf6' },
  { id: 'c2222222-2222-2222-2222-666666666666', entityId: '22222222-2222-2222-2222-222222222222', name: 'Rendimentos Financeiros PJ', nature: 'INCOME', icon: 'trending-up', colorHex: '#059669' },
  { id: 'c2222222-2222-2222-2222-777777777777', entityId: '22222222-2222-2222-2222-222222222222', name: 'Folha de Pagamento & Salários', nature: 'EXPENSE', icon: 'users', colorHex: '#f59e0b' },
  { id: 'c2222222-2222-2222-2222-888888888888', entityId: '22222222-2222-2222-2222-222222222222', name: 'Encargos Sociais & Trabalhistas', nature: 'EXPENSE', icon: 'file-check', colorHex: '#ef4444' },
  { id: 'c2222222-2222-2222-2222-999999999999', entityId: '22222222-2222-2222-2222-222222222222', name: 'Marketing & Publicidade / Ads', nature: 'EXPENSE', icon: 'megaphone', colorHex: '#ec4899' },
  { id: 'c2222222-2222-2222-2222-aaaaaaaaaaaa', entityId: '22222222-2222-2222-2222-222222222222', name: 'Software, SaaS & TI', nature: 'EXPENSE', icon: 'cpu', colorHex: '#06b6d4' },
  { id: 'c2222222-2222-2222-2222-bbbbbbbbbbbb', entityId: '22222222-2222-2222-2222-222222222222', name: 'Contabilidade & Jurídico', nature: 'EXPENSE', icon: 'scale', colorHex: '#475569' },
  { id: 'c2222222-2222-2222-2222-cccccccccccc', entityId: '22222222-2222-2222-2222-222222222222', name: 'Aluguel & Infraestrutura PJ', nature: 'EXPENSE', icon: 'building', colorHex: '#8b5cf6' },
  { id: 'c2222222-2222-2222-2222-dddddddddddd', entityId: '22222222-2222-2222-2222-222222222222', name: 'Viagens & Representação Comercial', nature: 'EXPENSE', icon: 'plane', colorHex: '#3b82f6' },
  { id: 'c2222222-2222-2222-2222-eeeeeeeeeeee', entityId: '22222222-2222-2222-2222-222222222222', name: 'Tarifas Bancárias & Maquininha', nature: 'EXPENSE', icon: 'credit-card', colorHex: '#64748b' },
  { id: 'c2222222-2222-2222-2222-ffffffffffff', entityId: '22222222-2222-2222-2222-222222222222', name: 'Manutenção & Equipamentos', nature: 'EXPENSE', icon: 'wrench', colorHex: '#d97706' },
];

export async function seedDefaultAccounts(): Promise<boolean> {
  const supabase = createClient();
  try {
    const payload = SEED_ACCOUNTS.map((a) => ({
      id: a.id,
      entity_id: a.entityId,
      name: a.name,
      account_type: a.accountType,
      initial_balance: a.initialBalance,
      current_balance: a.currentBalance,
      color_hex: a.colorHex,
      is_active: a.isActive,
      closing_day: a.closingDay || null,
      due_day: a.dueDay || null,
      credit_limit: a.creditLimit || null,
      card_image_url: a.cardImageUrl || null,
    }));

    const { error } = await supabase.from('accounts').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Upsert seed accounts warning:', error.message);
      // Fallback: try individual inserts if bulk upsert fails
      for (const item of payload) {
        try {
          await supabase.from('accounts').insert(item);
        } catch {}
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to seed default accounts:', err);
    return false;
  }
}

/**
 * Initializes default user, entities, accounts, and categories in Supabase if empty
 */
export async function ensureDatabaseSeeded(): Promise<boolean> {
  const supabase = createClient();

  try {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    const authUserId = authUser?.id || null;

    // 1. If user is logged in, ensure user exists in public.users
    if (authUser?.id) {
      let name = authUser.user_metadata?.name || authUser.user_metadata?.full_name;
      if (!name && authUser.email) {
        const prefix = authUser.email.split('@')[0];
        name = prefix
          .replace(/[._-]/g, ' ')
          .split(' ')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      }
      try {
        await supabase.from('users').upsert(
          {
            id: authUser.id,
            email: authUser.email || `${authUser.id}@user.local`,
            name: name || 'Usuário',
          },
          { onConflict: 'id' }
        );
      } catch {}
    }

    // 2. Check entities
    const { data: entities } = await supabase.from('entities').select('id');
    if (!entities || entities.length === 0) {
      try {
        await supabase.from('entities').insert(
          SEED_ENTITIES.map((e) => ({
            id: e.id,
            user_id: authUserId,
            name: e.name,
            type: e.type,
          }))
        );
      } catch {}
    }

    // 3. Accounts are created dynamically by the user in Supabase

    // 4. Check categories
    const { data: categories } = await supabase.from('categories').select('id');
    if (!categories || categories.length === 0) {
      try {
        await supabase.from('categories').insert(
          SEED_CATEGORIES.map((c) => ({
            id: c.id,
            entity_id: c.entityId,
            name: c.name,
            nature: c.nature,
            icon: c.icon,
            color_hex: c.colorHex,
          }))
        );
      } catch {}
    }

    return true;
  } catch (err) {
    console.error('Failed to seed Supabase database:', err);
    return false;
  }
}

