import { createClient } from '@/lib/supabase/client';
import {
  Account,
  AccountType,
  Budget,
  Category,
  CategoryBreakdownItem,
  CreditCardInvoice,
  DailyCashFlowItem,
  Debt,
  DebtInstallment,
  Entity,
  InvoiceStatus,
  Transaction,
  TransactionNature,
  TransactionType,
  Investment,
  InvestmentCategory,
  CreateInvestmentInput,
  UpdateInvestmentInput,
} from '@/types/finance';
import { SEED_ACCOUNTS, SEED_CATEGORIES, seedDefaultAccounts } from '@/lib/supabase/seed';
import { addMonthsToISO, calculateCreditCardDueDate } from '@/lib/utils/credit-card';

export interface CreateTransactionInput {
  userId?: string;
  entityId: string;
  accountId: string;
  destinationAccountId?: string | null;
  categoryId?: string | null;
  debtInstallmentId?: string | null;
  type: TransactionType;
  amount: number;
  transactionDate: string; // YYYY-MM-DD
  description: string;
  status?: 'PENDING' | 'PAID';
  installmentsCount?: number;
}

export interface CreateDebtInput {
  entityId: string;
  creditor: string;
  description?: string;
  totalAmount: number;
  interestRateMonthly?: number;
  installmentsCount: number;
  startDate: string; // YYYY-MM-DD
}

export interface UpdateDebtInput {
  entityId?: string;
  creditor?: string;
  description?: string;
  totalAmount?: number;
  interestRateMonthly?: number;
  installmentsCount?: number;
  startDate?: string; // YYYY-MM-DD
}

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  description: string;
  entityId?: string;
}

export interface CreateAccountInput {
  entityId: string;
  name: string;
  accountType: AccountType;
  initialBalance: number;
  colorHex?: string;
  closingDay?: number | null;
  dueDay?: number | null;
  creditLimit?: number | null;
  cardImageUrl?: string | null;
}

export interface CreateCategoryInput {
  entityId?: string | null;
  name: string;
  nature: TransactionNature;
  icon?: string;
  colorHex?: string;
}

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export async function ensureUserExistsInDb(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userInfo?: { email?: string; name?: string }
): Promise<void> {
  if (!userId) return;
  try {
    let email = userInfo?.email;
    let name = userInfo?.name;

    if (!email || !name) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && user.id === userId) {
          email = email || user.email;
          name = name || user.user_metadata?.name || user.user_metadata?.full_name;
        }
      } catch {}
    }

    if (email === 'eduardopedro.fsa@gmail.com' || email?.includes('eduardopedro') || email?.includes('eduardosaba')) {
      name = 'Eduardo Saba';
    } else if (email?.includes('melsaba')) {
      name = 'Mel Saba';
    }

    email = email || `user_${userId.slice(0, 8)}@financas.com.br`;
    name = name || email.split('@')[0] || 'Usuário';

    await supabase.from('users').upsert(
      {
        id: userId,
        email,
        name,
      },
      { onConflict: 'email' }
    );

    // Sync family entities to active user ID so RLS policies allow insertion & querying
    const familyEntityIds = [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '4a7d784d-089c-4b33-af79-09004a5a7d01',
      'bd458019-414d-4e68-9c8d-bf1e8a0890a0',
      'e239c328-735c-475d-a8da-833138107357',
    ];

    try {
      await supabase.from('entities').update({ user_id: userId }).in('id', familyEntityIds);
    } catch {}

    // Sync user_id on accounts, debts, transactions, and investments if column exists
    try {
      await supabase.from('accounts').update({ user_id: userId }).in('entity_id', familyEntityIds);
    } catch {}

    try {
      await supabase.from('debts').update({ user_id: userId }).in('entity_id', familyEntityIds);
    } catch {}

    try {
      await supabase.from('transactions').update({ user_id: userId }).in('entity_id', familyEntityIds);
    } catch {}

    try {
      await supabase.from('investments').update({ user_id: userId }).in('entity_id', familyEntityIds);
    } catch {}
  } catch (err) {
    console.warn('Failed to ensure user exists in public.users:', err);
  }
}

export const PRIMARY_FAMILY_USER_ID = '8cd0b5e5-21f1-4e1c-afff-cdfd3bce961a';

async function getAuthUserId(supabase: ReturnType<typeof createClient>): Promise<string> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      const name = user.user_metadata?.name || user.user_metadata?.full_name;
      await ensureUserExistsInDb(supabase, user.id, {
        email: user.email,
        name,
      });

      return user.id;
    }
  } catch {
    // Fallback default user id if unauthenticated
  }

  return PRIMARY_FAMILY_USER_ID;
}

export interface CreateEntityInput {
  name: string;
  type: 'PF' | 'PJ';
  userId?: string;
}

async function execWithJwtRetry<T = any>(
  fn: (supabase: ReturnType<typeof createClient>) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  let supabase = createClient();
  let result: { data: T | null; error: any };
  try {
    result = await fn(supabase);
  } catch (err: any) {
    result = { data: null, error: err };
  }

  if (
    result.error &&
    (result.error.message?.includes('JWT issued at future') ||
      result.error.message?.includes('JWT expired') ||
      result.error.message?.includes('invalid JWT') ||
      result.error.code === 'PGRST301' ||
      result.error.status === 401)
  ) {
    console.warn('Supabase JWT token issue / clock skew detected. Clearing invalid session and retrying query...');
    try {
      await supabase.auth.signOut();
    } catch {}
    supabase = createClient();
    try {
      result = await fn(supabase);
    } catch (err: any) {
      result = { data: null, error: err };
    }
  }

  return result;
}

// -------------------------------------------------------------
// ENTITIES
// -------------------------------------------------------------
export async function fetchEntities(): Promise<Entity[]> {
  const { data, error } = await execWithJwtRetry<any[]>(async (supabase) => {
    const res = await supabase.from('entities').select('*').order('created_at', { ascending: true });
    return res;
  });
  if (error) {
    console.error('Erro detalhado Supabase (fetchEntities):', error);
    throw new Error(`Falha ao buscar entidades do Supabase: ${error.message}`);
  }
  return (data || []).map((item: any) => ({
    id: item.id,
    userId: item.user_id,
    name: item.name,
    type: item.type,
    createdAt: item.created_at,
  }));
}

export async function createEntity(input: CreateEntityInput): Promise<Entity> {
  const supabase = createClient();
  const userId = input.userId || (await getAuthUserId(supabase));
  await ensureUserExistsInDb(supabase, userId);

  const payload = {
    user_id: userId,
    name: input.name,
    type: input.type,
  };

  const { data, error } = await supabase
    .from('entities')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Erro detalhado Supabase (createEntity):', error);
    throw new Error(`Falha ao cadastrar empresa no Supabase: ${error.message}`);
  }

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    type: data.type,
    createdAt: data.created_at,
  };
}

// -------------------------------------------------------------
// ACCOUNTS
// -------------------------------------------------------------
export async function fetchAccounts(entityType?: string): Promise<Account[]> {
  const { data, error } = await execWithJwtRetry<any[]>(async (supabase) => {
    const res = await supabase.from('accounts').select('*').order('created_at', { ascending: true });
    return res;
  });

  if (error) {
    console.error('Erro detalhado Supabase (fetchAccounts):', error);
  }

  const entities = await fetchEntities().catch(() => []);
  const entityTypeMap = new Map<string, string>();
  entities.forEach((e) => entityTypeMap.set(e.id, e.type));

  const accounts: Account[] = (data || []).map((item: any) => ({
    id: item.id,
    entityId: item.entity_id,
    name: item.name,
    accountType: item.account_type,
    initialBalance: Number(item.initial_balance),
    currentBalance: Number(item.current_balance),
    colorHex: item.color_hex,
    isActive: item.is_active,
    closingDay: item.closing_day ? Number(item.closing_day) : null,
    dueDay: item.due_day ? Number(item.due_day) : null,
    creditLimit: item.credit_limit ? Number(item.credit_limit) : null,
    cardImageUrl: item.card_image_url || null,
    createdAt: item.created_at || new Date().toISOString(),
  }));

  return filterAccountsByEntity(accounts, entityType, entityTypeMap);
}

function filterAccountsByEntity(
  accounts: Account[],
  entityType?: string,
  entityTypeMap?: Map<string, string>
): Account[] {
  if (!entityType || entityType === 'CONSOLIDATED') {
    return accounts;
  }
  return accounts.filter((a) => {
    if (a.entityId === entityType) return true;
    if (entityType === 'PF' && (a.entityId === '11111111-1111-1111-1111-111111111111' || a.entityId === 'PF')) return true;
    if (entityType === 'PJ' && (a.entityId !== '11111111-1111-1111-1111-111111111111' && a.entityId !== 'PF')) return true;

    if (entityTypeMap) {
      const type = entityTypeMap.get(a.entityId);
      if (type === entityType) return true;
    }

    return false;
  });
}

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const supabase = createClient();
  let dbEntityId = input.entityId;
  if (!isValidUUID(dbEntityId)) {
    dbEntityId = input.entityId === 'PJ' ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111';
  }

  const payload: any = {
    entity_id: dbEntityId,
    name: input.name,
    account_type: input.accountType,
    initial_balance: input.initialBalance,
    current_balance: input.initialBalance,
    color_hex: input.colorHex || '#3b82f6',
    is_active: true,
  };

  if (input.closingDay !== undefined) payload.closing_day = input.closingDay;
  if (input.dueDay !== undefined) payload.due_day = input.dueDay;
  if (input.creditLimit !== undefined) payload.credit_limit = input.creditLimit;
  if (input.cardImageUrl !== undefined) payload.card_image_url = input.cardImageUrl;

  let { data, error } = await supabase
    .from('accounts')
    .insert(payload)
    .select()
    .single();

  // Automatic RLS entity user_id repair & retry
  if (error && (error.code === '42501' || error.message?.includes('row-level security'))) {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id) {
      await supabase.from('entities').update({ user_id: authData.user.id }).eq('id', dbEntityId);
      const retry = await supabase.from('accounts').insert(payload).select().single();
      data = retry.data;
      error = retry.error;
    }
  }

  // Graceful fallback if card_image_url column does not exist in Supabase schema yet
  if (error && error.message?.includes('card_image_url')) {
    delete payload.card_image_url;
    const retry = await supabase.from('accounts').insert(payload).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    console.error('Erro detalhado Supabase (createAccount):', error);
    throw new Error(`Falha ao criar conta bancária no Supabase: ${error?.message}`);
  }

  return {
    id: data.id,
    entityId: data.entity_id,
    name: data.name,
    accountType: data.account_type,
    initialBalance: Number(data.initial_balance),
    currentBalance: Number(data.current_balance),
    colorHex: data.color_hex,
    isActive: data.is_active,
    closingDay: data.closing_day ? Number(data.closing_day) : null,
    dueDay: data.due_day ? Number(data.due_day) : null,
    creditLimit: data.credit_limit ? Number(data.credit_limit) : null,
    cardImageUrl: data.card_image_url || null,
    createdAt: data.created_at,
  };
}

export async function updateAccount(
  id: string,
  updates: Partial<CreateAccountInput & { currentBalance?: number }>
): Promise<boolean> {
  const supabase = createClient();
  const payload: any = {};
  if (updates.name) payload.name = updates.name;
  if (updates.accountType) payload.account_type = updates.accountType;
  if (updates.initialBalance !== undefined) payload.initial_balance = updates.initialBalance;
  if (updates.currentBalance !== undefined) payload.current_balance = updates.currentBalance;
  if (updates.colorHex) payload.color_hex = updates.colorHex;
  if (updates.closingDay !== undefined) payload.closing_day = updates.closingDay;
  if (updates.dueDay !== undefined) payload.due_day = updates.dueDay;
  if (updates.creditLimit !== undefined) payload.credit_limit = updates.creditLimit;
  if (updates.cardImageUrl !== undefined) payload.card_image_url = updates.cardImageUrl;

  let { error } = await supabase.from('accounts').update(payload).eq('id', id);

  // Graceful fallback if card_image_url column does not exist in Supabase schema yet
  if (error && error.message?.includes('card_image_url')) {
    delete payload.card_image_url;
    const retry = await supabase.from('accounts').update(payload).eq('id', id);
    error = retry.error;
  }

  if (error) {
    console.error('Erro detalhado Supabase (updateAccount):', error);
    throw new Error(`Falha ao atualizar conta no Supabase: ${error.message}`);
  }
  return true;
}

export async function deleteAccount(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) {
    console.error('Erro detalhado Supabase (deleteAccount):', error);
    throw new Error(`Falha ao excluir conta no Supabase: ${error.message}`);
  }
  return true;
}

// -------------------------------------------------------------
// CATEGORIES
// -------------------------------------------------------------
export async function fetchCategories(entityType?: string): Promise<Category[]> {
  const { data, error } = await execWithJwtRetry<any[]>(async (supabase) => {
    const res = await supabase.from('categories').select('*');
    return res;
  });
  if (error) {
    console.error('Erro detalhado Supabase (fetchCategories):', error);
    throw new Error(`Falha ao carregar categorias do Supabase: ${error.message}`);
  }

  const categories: Category[] = (data || []).map((item: any) => ({
    id: item.id,
    entityId: item.entity_id,
    name: item.name,
    nature: item.nature,
    icon: item.icon,
    colorHex: item.color_hex,
    createdAt: item.created_at,
  }));

  return filterCategoriesByEntity(categories, entityType);
}

function filterCategoriesByEntity(categories: Category[], entityType?: string): Category[] {
  if (!entityType || entityType === 'CONSOLIDATED') {
    return categories;
  }
  const filtered = categories.filter(
    (c) =>
      !c.entityId ||
      c.entityId === entityType ||
      (entityType === 'PF' && (c.entityId === '11111111-1111-1111-1111-111111111111' || c.id.startsWith('cat-pf-'))) ||
      (entityType === 'PJ' && (c.entityId === '22222222-2222-2222-2222-222222222222' || c.id.startsWith('cat-pj-')))
  );
  if (filtered.length > 0) return filtered;
  return SEED_CATEGORIES.filter(
    (c) =>
      !c.entityId ||
      c.entityId === entityType ||
      (entityType === 'PF' && (c.entityId === '11111111-1111-1111-1111-111111111111' || c.id.startsWith('cat-pf-'))) ||
      (entityType === 'PJ' && (c.entityId === '22222222-2222-2222-2222-222222222222' || c.id.startsWith('cat-pj-')))
  ).map((c) => ({ ...c, createdAt: new Date().toISOString() }));
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const supabase = createClient();
  let dbEntityId = input.entityId;
  if (dbEntityId && !isValidUUID(dbEntityId)) {
    dbEntityId = dbEntityId === 'PJ' ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111';
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({
      entity_id: dbEntityId || null,
      name: input.name,
      nature: input.nature,
      icon: input.icon || 'tag',
      color_hex: input.colorHex || '#64748b',
    })
    .select()
    .single();

  if (error) {
    console.error('Erro detalhado Supabase (createCategory):', error);
    throw new Error(`Falha ao criar categoria no Supabase: ${error.message}`);
  }

  return {
    id: data.id,
    entityId: data.entity_id,
    name: data.name,
    nature: data.nature,
    icon: data.icon,
    colorHex: data.color_hex,
    createdAt: data.created_at,
  };
}

export async function deleteCategory(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) {
    console.error('Erro detalhado Supabase (deleteCategory):', error);
    throw new Error(`Falha ao excluir categoria no Supabase: ${error.message}`);
  }
  return true;
}

// -------------------------------------------------------------
// TRANSACTIONS
// -------------------------------------------------------------
function filterTransactionsByEntity(
  txs: Transaction[],
  entityType?: string,
  accounts: Account[] = []
): Transaction[] {
  if (!entityType || entityType === 'CONSOLIDATED') {
    return txs;
  }

  const pfId = '11111111-1111-1111-1111-111111111111';
  const pjId = '22222222-2222-2222-2222-222222222222';
  const accountEntityMap = new Map(accounts.map((a) => [a.id, a.entityId]));

  return txs.filter((t) => {
    // Direct match by tx.entityId
    if (t.entityId === entityType) return true;
    if (entityType === 'PF' && (t.entityId === pfId || t.entityId === 'PF')) return true;
    if (entityType === 'PJ' && (t.entityId === pjId || t.entityId === 'PJ')) return true;

    // Match by associated account entityId
    const sourceEnt = accountEntityMap.get(t.accountId);
    const destEnt = t.destinationAccountId ? accountEntityMap.get(t.destinationAccountId) : null;

    if (entityType === 'PF') {
      if (sourceEnt === pfId || sourceEnt === 'PF' || destEnt === pfId || destEnt === 'PF') {
        return true;
      }
    }

    if (entityType === 'PJ') {
      if (sourceEnt === pjId || sourceEnt === 'PJ' || destEnt === pjId || destEnt === 'PJ') {
        return true;
      }
    }

    return false;
  });
}

export async function fetchTransactions(filters: {
  entityType?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Transaction[]> {
  const { data, error } = await execWithJwtRetry<any[]>(async (supabase) => {
    let query = supabase.from('transactions').select('*').order('transaction_date', { ascending: false });

    if (filters.startDate) query = query.gte('transaction_date', filters.startDate);
    if (filters.endDate) query = query.lte('transaction_date', filters.endDate);

    const res = await query;
    return res;
  });

  if (error) {
    console.error('Erro detalhado Supabase (fetchTransactions):', error);
    throw new Error(`Falha ao carregar transações do Supabase: ${error.message}`);
  }

  const dbTxs: Transaction[] = (data || []).map((item: any) => ({
    id: item.id,
    userId: item.user_id,
    entityId: item.entity_id,
    accountId: item.account_id,
    destinationAccountId: item.destination_account_id,
    categoryId: item.category_id,
    debtInstallmentId: item.debt_installment_id,
    invoiceId: item.invoice_id,
    type: item.type,
    amount: Number(item.amount),
    transactionDate: item.transaction_date,
    description: item.description,
    status: item.status,
    createdAt: item.created_at,
  }));

  const allAccounts = await fetchAccounts().catch(() => []);
  return filterTransactionsByEntity(dbTxs, filters.entityType, allAccounts);
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const supabase = createClient();
  const userId = input.userId || (await getAuthUserId(supabase));
  await ensureUserExistsInDb(supabase, userId);

  let dbEntityId = input.entityId;
  if (!isValidUUID(dbEntityId)) {
    dbEntityId = input.entityId === 'PJ'
      ? '22222222-2222-2222-2222-222222222222'
      : '11111111-1111-1111-1111-111111111111';
  }

  const dbAccountId = isValidUUID(input.accountId) ? input.accountId : input.accountId;
  const dbDestAccountId = isValidUUID(input.destinationAccountId) ? input.destinationAccountId : null;
  const dbCategoryId = isValidUUID(input.categoryId) ? input.categoryId : null;
  const dbDebtInstId = isValidUUID(input.debtInstallmentId) ? input.debtInstallmentId : null;

  // Check if account is CREDIT_CARD
  let targetAccount: Account | null = null;
  if (dbAccountId && isValidUUID(dbAccountId)) {
    const { data: accData } = await supabase.from('accounts').select('*').eq('id', dbAccountId).single();
    if (accData) {
      targetAccount = {
        id: accData.id,
        entityId: accData.entity_id,
        name: accData.name,
        accountType: accData.account_type,
        initialBalance: Number(accData.initial_balance),
        currentBalance: Number(accData.current_balance),
        colorHex: accData.color_hex,
        isActive: accData.is_active,
        closingDay: accData.closing_day ? Number(accData.closing_day) : 25,
        dueDay: accData.due_day ? Number(accData.due_day) : 5,
        creditLimit: accData.credit_limit ? Number(accData.credit_limit) : 0,
      };
    }
  }

  const isCreditCard = targetAccount?.accountType === 'CREDIT_CARD';
  let txStatus = input.status;
  if (isCreditCard && input.type === 'EXPENSE' && !input.status) {
    txStatus = 'PENDING';
  } else if (!txStatus) {
    txStatus = 'PAID';
  }

  // Handle Installments (Compras Parceladas no Cartão)
  const installmentsCount = input.installmentsCount || 1;
  if (isCreditCard && input.type === 'EXPENSE' && installmentsCount > 1) {
    const closingDay = targetAccount?.closingDay || 25;
    const dueDay = targetAccount?.dueDay || 5;

    const firstDueDate = calculateCreditCardDueDate(input.transactionDate, closingDay, dueDay);
    const installmentAmount = Math.round((input.amount / installmentsCount) * 100) / 100;
    const lastInstallmentAmount = input.amount - (installmentAmount * (installmentsCount - 1));

    const insertedTxs: Transaction[] = [];

    for (let i = 1; i <= installmentsCount; i++) {
      const instDueDate = i === 1 ? firstDueDate : addMonthsToISO(firstDueDate, i - 1);
      const instAmount = i === installmentsCount ? lastInstallmentAmount : installmentAmount;
      const instDescription = `${input.description} (${i}/${installmentsCount})`;

      const payload: any = {
        user_id: userId,
        entity_id: dbEntityId,
        account_id: dbAccountId,
        destination_account_id: dbDestAccountId,
        category_id: dbCategoryId,
        debt_installment_id: dbDebtInstId,
        type: input.type,
        amount: instAmount,
        transaction_date: instDueDate,
        description: instDescription,
        status: 'PENDING',
      };

      const { data, error } = await supabase
        .from('transactions')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('Erro detalhado Supabase (parcelas):', error);
        throw new Error(`Falha ao gravar parcela no Supabase: ${error.message}`);
      }

      insertedTxs.push({
        id: data.id,
        userId: data.user_id,
        entityId: data.entity_id,
        accountId: data.account_id,
        destinationAccountId: data.destination_account_id,
        categoryId: data.category_id,
        debtInstallmentId: data.debt_installment_id,
        type: data.type,
        amount: Number(data.amount),
        transactionDate: data.transaction_date,
        description: data.description,
        status: data.status,
        createdAt: data.created_at,
      });
    }

    return insertedTxs[0];
  }

  // Single transaction creation
  let txDate = input.transactionDate;
  if (isCreditCard && input.type === 'EXPENSE') {
    const closingDay = targetAccount?.closingDay || 25;
    const dueDay = targetAccount?.dueDay || 5;
    txDate = calculateCreditCardDueDate(input.transactionDate, closingDay, dueDay);
  }

  const payload: any = {
    user_id: userId,
    entity_id: dbEntityId,
    account_id: dbAccountId,
    destination_account_id: dbDestAccountId,
    category_id: dbCategoryId,
    debt_installment_id: dbDebtInstId,
    type: input.type,
    amount: input.amount,
    transaction_date: txDate,
    description: input.description,
    status: txStatus,
  };

  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Erro detalhado Supabase:', error);
    throw new Error(`Falha ao gravar no Supabase: ${error.message}`);
  }

  // Update account balance directly in Supabase ONLY IF status === 'PAID'
  if (txStatus === 'PAID') {
    if (dbAccountId && isValidUUID(dbAccountId)) {
      const { data: accountData, error: fetchAccError } = await supabase
        .from('accounts')
        .select('current_balance')
        .eq('id', dbAccountId)
        .single();

      if (fetchAccError) {
        console.error('Erro detalhado Supabase (atualização de saldo):', fetchAccError);
        throw new Error(`Falha ao buscar saldo da conta: ${fetchAccError.message}`);
      }

      if (accountData) {
        const currentBalance = Number(accountData.current_balance);
        const newBalance =
          input.type === 'INCOME' ? currentBalance + input.amount : currentBalance - input.amount;

        const { error: updateAccError } = await supabase
          .from('accounts')
          .update({ current_balance: newBalance })
          .eq('id', dbAccountId);

        if (updateAccError) {
          console.error('Erro detalhado Supabase (gravação de saldo):', updateAccError);
          throw new Error(`Falha ao atualizar saldo da conta: ${updateAccError.message}`);
        }
      }
    }

    if (input.type === 'TRANSFER' && dbDestAccountId && isValidUUID(dbDestAccountId)) {
      const { data: destAccData, error: fetchDestErr } = await supabase
        .from('accounts')
        .select('current_balance')
        .eq('id', dbDestAccountId)
        .single();

      if (!fetchDestErr && destAccData) {
        const currentBalance = Number(destAccData.current_balance);
        const newBalance = currentBalance + input.amount;
        await supabase
          .from('accounts')
          .update({ current_balance: newBalance })
          .eq('id', dbDestAccountId);
      }
    }
  }

  return {
    id: data.id,
    userId: data.user_id,
    entityId: data.entity_id,
    accountId: data.account_id,
    destinationAccountId: data.destination_account_id,
    categoryId: data.category_id,
    debtInstallmentId: data.debt_installment_id,
    type: data.type,
    amount: Number(data.amount),
    transactionDate: data.transaction_date,
    description: data.description,
    status: data.status,
    createdAt: data.created_at,
  };
}

// -------------------------------------------------------------
// CREDIT CARD INVOICES
// -------------------------------------------------------------

/**
 * Buscas lançamentos de cartão de crédito pendentes com invoice_id nulo ou status aberto
 */
export async function fetchOpenInvoiceTransactions(accountId: string): Promise<Transaction[]> {
  const { data, error } = await execWithJwtRetry<any[]>(async (supabase) => {
    const res = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'PENDING')
      .is('invoice_id', null)
      .order('transaction_date', { ascending: true });
    return res;
  });

  if (error) {
    console.error('Erro detalhado Supabase (fetchOpenInvoiceTransactions):', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    userId: item.user_id,
    entityId: item.entity_id,
    accountId: item.account_id,
    destinationAccountId: item.destination_account_id,
    categoryId: item.category_id,
    debtInstallmentId: item.debt_installment_id,
    invoiceId: item.invoice_id,
    type: item.type,
    amount: Number(item.amount),
    transactionDate: item.transaction_date,
    description: item.description,
    status: item.status,
    createdAt: item.created_at,
  }));
}

/**
 * Fecha uma fatura de cartão de crédito, consolidando os lançamentos checados.
 */
export async function closeInvoice(input: {
  accountId: string;
  dueDate: string;
  closingDate?: string;
  referenceMonth: string;
  transactionIds: string[];
  totalAmount: number;
}): Promise<CreditCardInvoice> {
  const supabase = createClient();
  const closingDate = input.closingDate || new Date().toISOString().split('T')[0];

  // 1. Cria registro na tabela credit_card_invoices
  const { data: invoiceData, error: invoiceErr } = await supabase
    .from('credit_card_invoices')
    .insert({
      account_id: input.accountId,
      due_date: input.dueDate,
      closing_date: closingDate,
      reference_month: input.referenceMonth,
      total_amount: input.totalAmount,
      status: 'CLOSED',
    })
    .select()
    .single();

  if (invoiceErr || !invoiceData) {
    console.error('Erro ao fechar fatura no Supabase:', invoiceErr);
    throw new Error(`Falha ao fechar fatura no Supabase: ${invoiceErr?.message}`);
  }

  // 2. Vincula os lançamentos selecionados a esta fatura
  if (input.transactionIds.length > 0) {
    const { error: txErr } = await supabase
      .from('transactions')
      .update({ invoice_id: invoiceData.id })
      .in('id', input.transactionIds);

    if (txErr) {
      console.error('Erro ao vincular lançamentos à fatura:', txErr);
    }
  }

  return {
    id: invoiceData.id,
    accountId: invoiceData.account_id,
    dueDate: invoiceData.due_date,
    closingDate: invoiceData.closing_date,
    referenceMonth: invoiceData.reference_month,
    totalAmount: Number(invoiceData.total_amount),
    status: invoiceData.status,
    createdAt: invoiceData.created_at,
  };
}

/**
 * Busca faturas de cartão por status ('CLOSED', 'PAID', ou 'ALL')
 */
export async function fetchCreditCardInvoices(
  entityType?: string,
  status: InvoiceStatus | 'ALL' = 'ALL'
): Promise<CreditCardInvoice[]> {
  const { data, error } = await execWithJwtRetry<any[]>(async (supabase) => {
    let query = supabase.from('credit_card_invoices').select('*, accounts(*)');
    if (status !== 'ALL') {
      query = query.eq('status', status);
    }
    query = query.order('due_date', { ascending: false });
    return await query;
  });

  if (error || !data) {
    if (error && !error.message?.includes('does not exist')) {
      console.error('Erro ao carregar faturas:', error);
    }
    return [];
  }

  const allAccounts = await fetchAccounts().catch(() => []);
  const accountMap = new Map(allAccounts.map((a) => [a.id, a]));

  const invoices: CreditCardInvoice[] = data.map((item: any) => {
    const acc = accountMap.get(item.account_id) || item.accounts;
    return {
      id: item.id,
      accountId: item.account_id,
      accountName: acc?.name || 'Cartão de Crédito',
      dueDate: item.due_date,
      closingDate: item.closing_date,
      referenceMonth: item.reference_month,
      totalAmount: Number(item.total_amount),
      status: item.status,
      createdAt: item.created_at,
    };
  });

  if (!entityType || entityType === 'CONSOLIDATED') {
    return invoices;
  }

  return invoices.filter((inv) => {
    const acc = accountMap.get(inv.accountId);
    if (!acc) return true;
    if (acc.entityId === entityType) return true;
    if (entityType === 'PF' && (acc.entityId === '11111111-1111-1111-1111-111111111111' || acc.entityId === 'PF')) return true;
    if (entityType === 'PJ' && (acc.entityId === '22222222-2222-2222-2222-222222222222' || acc.entityId === 'PJ')) return true;
    return false;
  });
}

/**
 * Busca faturas fechadas com status 'CLOSED'
 */
export async function fetchClosedInvoices(entityType?: string): Promise<CreditCardInvoice[]> {
  return fetchCreditCardInvoices(entityType, 'CLOSED');
}

/**
 * Busca lançamentos vinculados a uma fatura específica
 */
export async function fetchInvoiceTransactions(invoiceId: string): Promise<Transaction[]> {
  const { data, error } = await execWithJwtRetry<any[]>(async (supabase) => {
    const res = await supabase
      .from('transactions')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('transaction_date', { ascending: false });
    return res;
  });

  if (error || !data) {
    if (error) console.error('Erro ao carregar lançamentos da fatura:', error);
    return [];
  }

  return data.map((item: any) => ({
    id: item.id,
    userId: item.user_id,
    entityId: item.entity_id,
    accountId: item.account_id,
    destinationAccountId: item.destination_account_id,
    categoryId: item.category_id,
    debtInstallmentId: item.debt_installment_id,
    invoiceId: item.invoice_id,
    type: item.type,
    amount: Number(item.amount),
    transactionDate: item.transaction_date,
    description: item.description,
    status: item.status,
    createdAt: item.created_at,
  }));
}

export async function payCreditCardInvoice(
  creditCardAccountId: string,
  sourceAccountId: string,
  paymentAmount: number,
  paymentDate?: string,
  targetDueDate?: string,
  invoiceId?: string
): Promise<boolean> {
  const supabase = createClient();
  const payDate = paymentDate || new Date().toISOString().split('T')[0];

  const { data: sourceAcc } = await supabase
    .from('accounts')
    .select('entity_id')
    .eq('id', sourceAccountId)
    .single();

  const entityId = sourceAcc?.entity_id || '11111111-1111-1111-1111-111111111111';

  // 1. Create TRANSFER transaction (Checking -> Credit Card)
  await createTransaction({
    entityId,
    accountId: sourceAccountId,
    destinationAccountId: creditCardAccountId,
    type: 'TRANSFER',
    amount: paymentAmount,
    transactionDate: payDate,
    description: 'Pagamento de Fatura do Cartão de Crédito',
    status: 'PAID',
  });

  // 2. Se a fatura fechada específica foi informada ou existe fatura CLOSED para este cartão
  if (invoiceId) {
    await supabase
      .from('credit_card_invoices')
      .update({ status: 'PAID' })
      .eq('id', invoiceId);

    await supabase
      .from('transactions')
      .update({ status: 'PAID' })
      .eq('invoice_id', invoiceId);
  } else {
    // Buscar faturas CLOSED deste cartão
    const { data: closedInvs } = await supabase
      .from('credit_card_invoices')
      .select('id')
      .eq('account_id', creditCardAccountId)
      .eq('status', 'CLOSED')
      .order('due_date', { ascending: true });

    if (closedInvs && closedInvs.length > 0) {
      for (const inv of closedInvs) {
        await supabase.from('credit_card_invoices').update({ status: 'PAID' }).eq('id', inv.id);
        await supabase.from('transactions').update({ status: 'PAID' }).eq('invoice_id', inv.id);
      }
    }

    // Marca também as transações pendentes legadas até o valor pago
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('account_id', creditCardAccountId)
      .eq('status', 'PENDING')
      .order('transaction_date', { ascending: true });

    if (targetDueDate) {
      query = query.lte('transaction_date', targetDueDate);
    }

    const { data: pendingCardTxs } = await query;

    if (pendingCardTxs && pendingCardTxs.length > 0) {
      let remainingPayment = paymentAmount;
      for (const tx of pendingCardTxs) {
        const txAmt = Number(tx.amount);
        if (remainingPayment >= txAmt) {
          await supabase
            .from('transactions')
            .update({ status: 'PAID' })
            .eq('id', tx.id);
          remainingPayment -= txAmt;
        }
      }
    }
  }

  return true;
}


export async function deleteTransaction(id: string): Promise<boolean> {
  const supabase = createClient();
  const { data: dbTx, error: selectErr } = await supabase.from('transactions').select('*').eq('id', id).single();
  if (selectErr || !dbTx) {
    console.error('Erro detalhado Supabase (deleteTransaction find):', selectErr);
    throw new Error(`Transação não encontrada no Supabase.`);
  }

  const { error: deleteErr } = await supabase.from('transactions').delete().eq('id', id);
  if (deleteErr) {
    console.error('Erro detalhado Supabase (deleteTransaction delete):', deleteErr);
    throw new Error(`Falha ao excluir transação no Supabase: ${deleteErr.message}`);
  }

  // Revert balance in DB ONLY IF status was 'PAID'
  if (dbTx.status === 'PAID' && dbTx.account_id && isValidUUID(dbTx.account_id)) {
    const { data: accData } = await supabase
      .from('accounts')
      .select('current_balance')
      .eq('id', dbTx.account_id)
      .single();

    if (accData) {
      const curBal = Number(accData.current_balance);
      const revertedBal = dbTx.type === 'INCOME' ? curBal - Number(dbTx.amount) : curBal + Number(dbTx.amount);
      await supabase.from('accounts').update({ current_balance: revertedBal }).eq('id', dbTx.account_id);
    }

    if (dbTx.type === 'TRANSFER' && dbTx.destination_account_id && isValidUUID(dbTx.destination_account_id)) {
      const { data: destAccData } = await supabase
        .from('accounts')
        .select('current_balance')
        .eq('id', dbTx.destination_account_id)
        .single();

      if (destAccData) {
        const curBal = Number(destAccData.current_balance);
        const revertedBal = curBal - Number(dbTx.amount);
        await supabase.from('accounts').update({ current_balance: revertedBal }).eq('id', dbTx.destination_account_id);
      }
    }
  }

  return true;
}

export async function updateTransaction(
  id: string,
  updates: Partial<CreateTransactionInput>
): Promise<boolean> {
  const supabase = createClient();

  const { data: dbTx, error: fetchErr } = await supabase.from('transactions').select('*').eq('id', id).single();
  if (fetchErr || !dbTx) {
    console.error('Erro detalhado Supabase (updateTransaction fetch):', fetchErr);
    throw new Error(`Transação não encontrada no Supabase.`);
  }

  const dbPayload: any = {};
  if (updates.description !== undefined) dbPayload.description = updates.description;
  if (updates.amount !== undefined) dbPayload.amount = updates.amount;
  if (updates.type !== undefined) dbPayload.type = updates.type;
  if (updates.categoryId !== undefined) dbPayload.category_id = updates.categoryId;
  if (updates.accountId !== undefined) dbPayload.account_id = updates.accountId;
  if (updates.destinationAccountId !== undefined) dbPayload.destination_account_id = updates.destinationAccountId;
  if (updates.debtInstallmentId !== undefined) dbPayload.debt_installment_id = updates.debtInstallmentId;
  if (updates.entityId !== undefined) {
    dbPayload.entity_id = isValidUUID(updates.entityId)
      ? updates.entityId
      : updates.entityId === 'PJ'
      ? '22222222-2222-2222-2222-222222222222'
      : '11111111-1111-1111-1111-111111111111';
  }
  if (updates.transactionDate !== undefined) dbPayload.transaction_date = updates.transactionDate;
  if (updates.status !== undefined) dbPayload.status = updates.status;

  const { error } = await supabase.from('transactions').update(dbPayload).eq('id', id);
  if (error) {
    console.error('Erro detalhado Supabase (updateTransaction):', error);
    throw new Error(`Falha ao atualizar transação no Supabase: ${error.message}`);
  }

  // Handle balance updates based on status transitions
  const oldStatus = dbTx.status;
  const newStatus = updates.status !== undefined ? updates.status : oldStatus;
  const oldAmount = Number(dbTx.amount);
  const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;
  const oldType = dbTx.type;
  const newType = updates.type !== undefined ? updates.type : oldType;
  const oldAccountId = dbTx.account_id;
  const newAccountId = updates.accountId !== undefined ? updates.accountId : oldAccountId;

  const adjustBalance = async (accId: string | null, delta: number) => {
    if (!accId || !isValidUUID(accId)) return;
    const { data: accData } = await supabase.from('accounts').select('current_balance').eq('id', accId).single();
    if (accData) {
      const cur = Number(accData.current_balance);
      await supabase.from('accounts').update({ current_balance: cur + delta }).eq('id', accId);
    }
  };

  if (oldStatus === 'PENDING' && newStatus === 'PAID') {
    const delta = newType === 'INCOME' ? newAmount : -newAmount;
    await adjustBalance(newAccountId, delta);
  } else if (oldStatus === 'PAID' && newStatus === 'PENDING') {
    const revertDelta = oldType === 'INCOME' ? -oldAmount : oldAmount;
    await adjustBalance(oldAccountId, revertDelta);
  } else if (oldStatus === 'PAID' && newStatus === 'PAID') {
    if (oldAccountId === newAccountId && oldType === newType) {
      const diff = newAmount - oldAmount;
      const delta = newType === 'INCOME' ? diff : -diff;
      if (delta !== 0) await adjustBalance(newAccountId, delta);
    } else {
      const oldRevertDelta = oldType === 'INCOME' ? -oldAmount : oldAmount;
      await adjustBalance(oldAccountId, oldRevertDelta);
      const newDelta = newType === 'INCOME' ? newAmount : -newAmount;
      await adjustBalance(newAccountId, newDelta);
    }
  }

  return true;
}

export async function createTransfer(input: CreateTransferInput): Promise<boolean> {
  const allAccounts = await fetchAccounts();
  const fromAcc = allAccounts.find((a) => a.id === input.fromAccountId);
  const originEntityId = fromAcc?.entityId || input.entityId || '22222222-2222-2222-2222-222222222222';

  await createTransaction({
    entityId: originEntityId,
    accountId: input.fromAccountId,
    destinationAccountId: input.toAccountId,
    type: 'TRANSFER',
    amount: input.amount,
    transactionDate: input.date,
    description: input.description || 'Transferência entre contas',
    status: 'PAID',
  });

  return true;
}

// -------------------------------------------------------------
// ANALYTICS & REPORTS
// -------------------------------------------------------------
export async function fetchCashFlowSeries(
  entityType: string,
  startDate: string,
  endDate: string
): Promise<DailyCashFlowItem[]> {
  const txs = await fetchTransactions({ entityType, startDate, endDate });
  const dateMap: Record<string, { income: number; expense: number }> = {};

  txs.forEach((tx) => {
    const d = tx.transactionDate;
    if (!dateMap[d]) dateMap[d] = { income: 0, expense: 0 };
    if (tx.type === 'INCOME') dateMap[d].income += tx.amount;
    if (tx.type === 'EXPENSE') dateMap[d].expense += tx.amount;
  });

  const dates = Object.keys(dateMap).sort();
  if (dates.length === 0) return [];

  return dates.map((d) => ({
    date: d,
    income: dateMap[d].income,
    expense: dateMap[d].expense,
    net: dateMap[d].income - dateMap[d].expense,
  }));
}

export async function fetchCategoryBreakdown(
  entityType: string,
  startDate: string,
  endDate: string
): Promise<CategoryBreakdownItem[]> {
  const txs = await fetchTransactions({ entityType, startDate, endDate });
  const categories = await fetchCategories(entityType).catch(() => []);

  const expenses = txs.filter((t) => t.type === 'EXPENSE');
  const catTotalMap: Record<string, number> = {};
  let totalExpenseSum = 0;

  expenses.forEach((tx) => {
    const catId = tx.categoryId || 'uncategorized';
    catTotalMap[catId] = (catTotalMap[catId] || 0) + tx.amount;
    totalExpenseSum += tx.amount;
  });

  if (totalExpenseSum === 0) return [];

  return Object.entries(catTotalMap).map(([catId, amount]) => {
    const catObj = categories.find((c) => c.id === catId);
    return {
      categoryId: catId,
      categoryName: catObj?.name || 'Geral / Outros',
      amount,
      percentage: Math.round((amount / totalExpenseSum) * 100),
      colorHex: catObj?.colorHex || '#64748b',
    };
  });
}

// -------------------------------------------------------------
// BUDGETS
// -------------------------------------------------------------
export async function fetchBudgets(entityType: string, monthYear: string): Promise<Budget[]> {
  const categories = await fetchCategories(entityType).catch(() => []);
  const expenseCategories = categories.filter((c) => c.nature === 'EXPENSE' || !c.nature);
  const txs = await fetchTransactions({ entityType }).catch(() => []);

  const dbBudgetsMap = new Map<string, number>();

  const { data, error } = await execWithJwtRetry<any[]>(async (supabase) => {
    let query = supabase.from('budgets').select('*');
    if (monthYear.length === 4) {
      query = query.gte('month_year', `${monthYear}-01`).lte('month_year', `${monthYear}-12`);
    } else {
      query = query.eq('month_year', monthYear);
    }
    const res = await query;
    return res;
  });

  if (!error && data) {
    data.forEach((b: any) => {
      const current = dbBudgetsMap.get(b.category_id) || 0;
      dbBudgetsMap.set(b.category_id, current + Number(b.planned_amount));
    });
  }

  const defaultEntityId =
    entityType === 'PJ' ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111';

  const catNameMap = new Map(categories.map((c) => [c.id, c.name]));

  return expenseCategories.map((cat) => {
    const plannedAmount = dbBudgetsMap.get(cat.id) || 0;
    const spent = txs
      .filter(
        (t) =>
          (t.categoryId === cat.id || (t.categoryId && catNameMap.get(t.categoryId) === cat.name)) &&
          t.type === 'EXPENSE' &&
          t.transactionDate.startsWith(monthYear)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      id: `b-${cat.id}-${monthYear}`,
      entityId: defaultEntityId,
      categoryId: cat.id,
      categoryName: cat.name,
      monthYear,
      plannedAmount,
      spentAmount: spent,
    };
  });
}

export async function upsertBudget(
  entityIdOrType: string,
  categoryId: string,
  monthYear: string,
  plannedAmount: number
): Promise<boolean> {
  const supabase = createClient();
  let realEntityId = entityIdOrType;
  if (!isValidUUID(realEntityId)) {
    realEntityId = entityIdOrType === 'PJ' ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111';
  }

  if (isValidUUID(realEntityId) && isValidUUID(categoryId)) {
    const { error } = await supabase.from('budgets').upsert(
      {
        entity_id: realEntityId,
        category_id: categoryId,
        month_year: monthYear,
        planned_amount: plannedAmount,
      },
      { onConflict: 'entity_id,category_id,month_year' }
    );
    if (error) {
      console.error('Erro detalhado Supabase (upsertBudget):', error);
      throw new Error(`Falha ao salvar orçamento no Supabase: ${error.message}`);
    }
  }
  return true;
}

// -------------------------------------------------------------
// DEBTS & INSTALLMENTS
// -------------------------------------------------------------
export async function fetchDebts(entityType: string): Promise<Debt[]> {
  const { data: debtsData, error: debtsErr } = await execWithJwtRetry<any[]>(async (supabase) => {
    const res = await supabase.from('debts').select('*, debt_installments(*)');
    return res;
  });

  if (debtsErr) {
    console.warn('Erro/Aviso ao carregar dívidas do Supabase:', debtsErr.message);
  }

  const result: Debt[] = (debtsData || []).map((d: any) => {
    const installments: DebtInstallment[] = (d.debt_installments || [])
      .map((i: any) => ({
        id: i.id,
        debtId: i.debt_id,
        installmentNumber: i.installment_number,
        amount: Number(i.amount),
        dueDate: i.due_date,
        paidDate: i.paid_date,
        status: i.status,
        createdAt: i.created_at,
      }))
      .sort((a: DebtInstallment, b: DebtInstallment) => a.installmentNumber - b.installmentNumber);

    return {
      id: d.id,
      entityId: d.entity_id,
      creditor: d.creditor,
      description: d.description,
      totalAmount: Number(d.total_amount),
      interestRateMonthly: Number(d.interest_rate_monthly || 0),
      installmentsCount: d.installments_count,
      startDate: d.start_date,
      status: d.status,
      installments,
      createdAt: d.created_at,
    };
  });

  return filterDebtsByEntity(result, entityType);
}

function filterDebtsByEntity(debts: Debt[], entityType: string): Debt[] {
  if (!entityType || entityType === 'CONSOLIDATED') return debts;
  return debts.filter(
    (d) =>
      d.entityId === entityType ||
      (entityType === 'PF' && d.entityId === '11111111-1111-1111-1111-111111111111') ||
      (entityType === 'PJ' && d.entityId === '22222222-2222-2222-2222-222222222222')
  );
}

export async function createDebtWithInstallments(input: CreateDebtInput): Promise<Debt> {
  const supabase = createClient();
  let dbEntityId = input.entityId;
  if (!isValidUUID(dbEntityId)) {
    dbEntityId = input.entityId === 'PJ' ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111';
  }

  const totalAmount = input.totalAmount;
  const count = input.installmentsCount;
  const installmentAmount = Math.round((totalAmount / count) * 100) / 100;
  const startDate = new Date(input.startDate);

  const { data: dbDebt, error: debtErr } = await supabase
    .from('debts')
    .insert({
      entity_id: dbEntityId,
      creditor: input.creditor,
      description: input.description,
      total_amount: input.totalAmount,
      interest_rate_monthly: input.interestRateMonthly || 0,
      installments_count: count,
      start_date: input.startDate,
      status: 'ACTIVE',
    })
    .select()
    .single();

  if (debtErr || !dbDebt) {
    console.error('Erro detalhado Supabase (createDebtWithInstallments):', debtErr);
    throw new Error(`Falha ao criar dívida no Supabase: ${debtErr?.message}`);
  }

  const dbInstallments = [];
  for (let i = 0; i < count; i++) {
    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());
    dbInstallments.push({
      debt_id: dbDebt.id,
      installment_number: i + 1,
      amount: installmentAmount,
      due_date: dueDate.toISOString().split('T')[0],
      status: 'PENDING',
    });
  }

  const { data: insertedInsts, error: instErr } = await supabase
    .from('debt_installments')
    .insert(dbInstallments)
    .select();

  if (instErr) {
    console.error('Erro detalhado Supabase (createDebtInstallments):', instErr);
    throw new Error(`Falha ao cadastrar parcelas da dívida no Supabase: ${instErr.message}`);
  }

  const installments: DebtInstallment[] = (insertedInsts || []).map((i: any) => ({
    id: i.id,
    debtId: i.debt_id,
    installmentNumber: i.installment_number,
    amount: Number(i.amount),
    dueDate: i.due_date,
    paidDate: i.paid_date,
    status: i.status,
    createdAt: i.created_at,
  }));

  return {
    id: dbDebt.id,
    entityId: dbDebt.entity_id,
    creditor: dbDebt.creditor,
    description: dbDebt.description,
    totalAmount: Number(dbDebt.total_amount),
    interestRateMonthly: Number(dbDebt.interest_rate_monthly || 0),
    installmentsCount: dbDebt.installments_count,
    startDate: dbDebt.start_date,
    status: dbDebt.status,
    installments,
    createdAt: dbDebt.created_at,
  };
}

export async function payDebtInstallment(
  installmentId: string,
  accountId: string,
  paymentDate?: string
): Promise<boolean> {
  const supabase = createClient();
  const payDate = paymentDate || new Date().toISOString().split('T')[0];

  const { data: dbInst, error: instErr } = await supabase
    .from('debt_installments')
    .update({ status: 'PAID', paid_date: payDate })
    .eq('id', installmentId)
    .select('*, debts(*)')
    .single();

  if (instErr || !dbInst) {
    console.error('Erro detalhado Supabase (payDebtInstallment):', instErr);
    throw new Error(`Falha ao liquidação de parcela no Supabase: ${instErr?.message}`);
  }

  const amountToPay = Number(dbInst.amount);
  const installmentNum = dbInst.installment_number || '';
  const entityId = dbInst.debts?.entity_id || '11111111-1111-1111-1111-111111111111';
  const creditorName = dbInst.debts?.creditor || 'Financiamento';

  await createTransaction({
    entityId,
    accountId,
    debtInstallmentId: installmentId,
    type: 'EXPENSE',
    amount: amountToPay,
    transactionDate: payDate,
    description: `Pagamento Parcela #${installmentNum} - Dívida: ${creditorName}`,
    status: 'PAID',
  });

  return true;
}

export async function deleteDebt(debtId: string): Promise<boolean> {
  const supabase = createClient();
  const { error: instErr } = await supabase.from('debt_installments').delete().eq('debt_id', debtId);
  if (instErr) {
    console.error('Erro detalhado Supabase (deleteDebt installments):', instErr);
    throw new Error(`Falha ao excluir parcelas da dívida no Supabase: ${instErr.message}`);
  }

  const { error: debtErr } = await supabase.from('debts').delete().eq('id', debtId);
  if (debtErr) {
    console.error('Erro detalhado Supabase (deleteDebt):', debtErr);
    throw new Error(`Falha ao excluir dívida no Supabase: ${debtErr.message}`);
  }

  return true;
}

export async function updateDebt(debtId: string, input: UpdateDebtInput): Promise<boolean> {
  const supabase = createClient();

  // 1. Buscar a dívida e suas parcelas existentes
  const { data: dbDebt, error: fetchErr } = await supabase
    .from('debts')
    .select('*, debt_installments(*)')
    .eq('id', debtId)
    .single();

  if (fetchErr || !dbDebt) {
    console.error('Erro ao buscar dívida para edição:', fetchErr);
    throw new Error(`Dívida não encontrada no Supabase: ${fetchErr?.message}`);
  }

  const currentCount = dbDebt.installments_count;
  const newCount = input.installmentsCount || currentCount;
  const newTotalAmount = input.totalAmount !== undefined ? input.totalAmount : Number(dbDebt.total_amount);
  const newStartDateStr = input.startDate || dbDebt.start_date;
  const newStartDate = new Date(newStartDateStr);

  let dbEntityId = input.entityId;
  if (dbEntityId && !isValidUUID(dbEntityId)) {
    dbEntityId = dbEntityId === 'PJ' ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111';
  }

  // Atualiza registro principal na tabela debts
  const updateData: any = {};
  if (input.creditor) updateData.creditor = input.creditor;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.totalAmount !== undefined) updateData.total_amount = newTotalAmount;
  if (input.interestRateMonthly !== undefined) updateData.interest_rate_monthly = input.interestRateMonthly;
  if (input.installmentsCount !== undefined) updateData.installments_count = newCount;
  if (input.startDate) updateData.start_date = newStartDateStr;
  if (dbEntityId) updateData.entity_id = dbEntityId;

  const { error: updateErr } = await supabase
    .from('debts')
    .update(updateData)
    .eq('id', debtId);

  if (updateErr) {
    console.error('Erro ao atualizar registro da dívida:', updateErr);
    throw new Error(`Falha ao atualizar dívida no Supabase: ${updateErr.message}`);
  }

  // 2. Ajuste das parcelas em debt_installments
  const existingInsts: any[] = (dbDebt.debt_installments || []).sort(
    (a: any, b: any) => a.installment_number - b.installment_number
  );

  const newInstallmentAmount = Math.round((newTotalAmount / newCount) * 100) / 100;

  // Atualiza parcelas existentes
  for (const inst of existingInsts) {
    if (inst.installment_number <= newCount) {
      if (inst.status === 'PENDING') {
        const i = inst.installment_number - 1;
        const newDueDate = new Date(newStartDate.getFullYear(), newStartDate.getMonth() + i, newStartDate.getDate());
        await supabase
          .from('debt_installments')
          .update({
            amount: newInstallmentAmount,
            due_date: newDueDate.toISOString().split('T')[0],
          })
          .eq('id', inst.id);
      }
    } else {
      // Se a nova quantidade de parcelas for menor, exclui as parcelas pendentes excedentes
      if (inst.status === 'PENDING') {
        await supabase.from('debt_installments').delete().eq('id', inst.id);
      }
    }
  }

  // Se a nova quantidade de parcelas for maior do que as parcelas existentes, gera as parcelas faltantes
  const maxInstNum = existingInsts.length > 0 ? Math.max(...existingInsts.map((i: any) => i.installment_number)) : 0;
  if (newCount > maxInstNum) {
    const newDbInsts = [];
    for (let i = maxInstNum; i < newCount; i++) {
      const dueDate = new Date(newStartDate.getFullYear(), newStartDate.getMonth() + i, newStartDate.getDate());
      newDbInsts.push({
        debt_id: debtId,
        installment_number: i + 1,
        amount: newInstallmentAmount,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'PENDING',
      });
    }

    if (newDbInsts.length > 0) {
      const { error: insertErr } = await supabase.from('debt_installments').insert(newDbInsts);
      if (insertErr) {
        console.error('Erro ao gerar parcelas adicionais da dívida:', insertErr);
        throw new Error(`Falha ao cadastrar parcelas adicionais no Supabase: ${insertErr.message}`);
      }
    }
  }

  return true;
}

export async function fetchUsers(): Promise<{ id: string; name: string; email: string }[]> {
  const supabase = createClient();
  const { data } = await supabase.from('users').select('id, name, email');
  return data || [];
}

function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = (error.code || '').toUpperCase();
  return (
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('not find') ||
    msg.includes('could not find') ||
    code === 'PGRST205' ||
    code === '42P01'
  );
}

/**
  * Busca lista de investimentos cadastrados filtrados por entidade (PF, PJ ou Consolidado)
  */
export async function fetchInvestments(entityType?: string): Promise<Investment[]> {
  const { data, error } = await execWithJwtRetry<any[]>(async (supabase) => {
    let query = supabase.from('investments').select('*').order('created_at', { ascending: false });

    if (entityType && entityType !== 'CONSOLIDATED') {
      if (entityType === 'PF') {
        query = query.or('entity_id.eq.PF,entity_id.eq.11111111-1111-1111-1111-111111111111');
      } else if (entityType === 'PJ') {
        query = query.or('entity_id.eq.PJ,entity_id.not.in.(11111111-1111-1111-1111-111111111111,PF)');
      } else {
        query = query.eq('entity_id', entityType);
      }
    }

    return await query;
  });

  if (error || !data) {
    if (error && !isMissingTableError(error)) {
      console.error('Erro ao buscar investimentos do Supabase:', error);
    }
    // Fallback gracioso: buscar contas do tipo INVESTMENT se a tabela investments não existir ainda
    const accounts = await fetchAccounts(entityType);
    const investmentAccounts = accounts.filter((a) => a.accountType === 'INVESTMENT');

    return investmentAccounts.map((acc) => ({
      id: acc.id,
      entityId: acc.entityId,
      name: acc.name,
      category: 'RENDA_FIXA',
      institution: acc.name.split(' ')[0] || 'Instituição',
      initialAmount: acc.initialBalance || 0,
      currentAmount: acc.currentBalance || 0,
      yieldRate: '100% CDI',
      startDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
      createdAt: acc.createdAt,
    }));
  }

  return data.map((item: any) => ({
    id: item.id,
    entityId: item.entity_id,
    name: item.name,
    category: item.category || 'RENDA_FIXA',
    institution: item.institution || 'Instituição',
    initialAmount: Number(item.initial_amount || item.initial_balance || 0),
    currentAmount: Number(item.current_amount || item.current_balance || 0),
    yieldRate: item.yield_rate || null,
    startDate: item.start_date || item.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    status: item.status || 'ACTIVE',
    notes: item.notes || null,
    createdAt: item.created_at,
  }));
}

/**
 * Cria um novo investimento no Supabase
 */
export async function createInvestment(input: CreateInvestmentInput): Promise<Investment | null> {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  let dbEntityId = input.entityId;
  if (dbEntityId && !isValidUUID(dbEntityId)) {
    dbEntityId = dbEntityId === 'PJ' ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111';
  }

  const payload = {
    user_id: userId,
    entity_id: dbEntityId,
    name: input.name,
    category: input.category,
    institution: input.institution,
    initial_amount: input.initialAmount,
    current_amount: input.currentAmount,
    yield_rate: input.yieldRate || null,
    start_date: input.startDate,
    status: 'ACTIVE',
    notes: input.notes || null,
  };

  const { data, error } = await supabase.from('investments').insert([payload]).select().single();

  if (error) {
    if (isMissingTableError(error)) {
      const acc = await createAccount({
        entityId: dbEntityId,
        name: `${input.name} (${input.institution})`,
        accountType: 'INVESTMENT',
        initialBalance: input.initialAmount,
        colorHex: '#10b981',
      });
      if (acc) {
        return {
          id: acc.id,
          entityId: acc.entityId,
          name: input.name,
          category: input.category,
          institution: input.institution,
          initialAmount: input.initialAmount,
          currentAmount: input.currentAmount,
          yieldRate: input.yieldRate,
          startDate: input.startDate,
          status: 'ACTIVE',
          notes: input.notes,
        };
      }
    }
    console.error('Erro ao cadastrar investimento no Supabase:', error);
    throw new Error(`Falha ao cadastrar investimento: ${error.message}`);
  }

  return {
    id: data.id,
    entityId: data.entity_id,
    name: data.name,
    category: data.category,
    institution: data.institution,
    initialAmount: Number(data.initial_amount),
    currentAmount: Number(data.current_amount),
    yieldRate: data.yield_rate,
    startDate: data.start_date,
    status: data.status,
    notes: data.notes,
    createdAt: data.created_at,
  };
}

/**
 * Atualiza os dados de um investimento existente
 */
export async function updateInvestment(id: string, input: UpdateInvestmentInput): Promise<boolean> {
  const supabase = createClient();

  let dbEntityId = input.entityId;
  if (dbEntityId && !isValidUUID(dbEntityId)) {
    dbEntityId = dbEntityId === 'PJ' ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111';
  }

  const updateData: any = {};
  if (input.name) updateData.name = input.name;
  if (input.category) updateData.category = input.category;
  if (input.institution) updateData.institution = input.institution;
  if (input.initialAmount !== undefined) updateData.initial_amount = input.initialAmount;
  if (input.currentAmount !== undefined) updateData.current_amount = input.currentAmount;
  if (input.yieldRate !== undefined) updateData.yield_rate = input.yieldRate;
  if (input.startDate) updateData.start_date = input.startDate;
  if (input.status) updateData.status = input.status;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (dbEntityId) updateData.entity_id = dbEntityId;

  const { error } = await supabase.from('investments').update(updateData).eq('id', id);

  if (error) {
    if (isMissingTableError(error)) {
      const accUpdate: any = {};
      if (input.name) accUpdate.name = input.name;
      if (input.currentAmount !== undefined) accUpdate.current_balance = input.currentAmount;
      if (input.initialAmount !== undefined) accUpdate.initial_balance = input.initialAmount;
      await supabase.from('accounts').update(accUpdate).eq('id', id);
      return true;
    }
    console.error('Erro ao atualizar investimento:', error);
    throw new Error(`Falha ao atualizar investimento: ${error.message}`);
  }

  return true;
}

/**
 * Exclui um investimento do sistema
 */
export async function deleteInvestment(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from('investments').delete().eq('id', id);

  if (error) {
    if (isMissingTableError(error)) {
      await supabase.from('accounts').delete().eq('id', id);
      return true;
    }
    console.error('Erro ao deletar investimento:', error);
    throw new Error(`Falha ao excluir investimento: ${error.message}`);
  }

  return true;
}

/**
 * Migra um registro de Dívida existente para o Módulo de Investimentos
 */
export async function migrateDebtToInvestment(
  debtId: string,
  category: InvestmentCategory = 'RENDA_FIXA'
): Promise<boolean> {
  const supabase = createClient();

  // 1. Buscar os dados da dívida
  const { data: dbDebt, error } = await supabase
    .from('debts')
    .select('*')
    .eq('id', debtId)
    .single();

  if (error || !dbDebt) {
    console.error('Erro ao buscar dívida para migração:', error);
    throw new Error(`Dívida não encontrada: ${error?.message || ''}`);
  }

  // 2. Criar o investimento no Supabase
  await createInvestment({
    entityId: dbDebt.entity_id || 'PF',
    name: dbDebt.creditor || 'Investimento Migrado',
    category: category,
    institution: dbDebt.creditor || 'Instituição Financeira',
    initialAmount: Number(dbDebt.total_amount || 0),
    currentAmount: Number(dbDebt.total_amount || 0),
    yieldRate: dbDebt.interest_rate_monthly ? `${dbDebt.interest_rate_monthly}% a.m.` : '100% CDI',
    startDate: dbDebt.start_date || new Date().toISOString().split('T')[0],
    notes: dbDebt.description ? `Migrado da tela de dívidas: ${dbDebt.description}` : 'Migrado da tela de dívidas',
  });

  // 3. Excluir a dívida original
  await deleteDebt(debtId);

  return true;
}

/**
 * Migra um registro de Investimento existente de volta para o Módulo de Dívidas
 */
export async function migrateInvestmentToDebt(
  investmentId: string,
  installmentsCount: number = 12
): Promise<boolean> {
  const supabase = createClient();

  // 1. Buscar os dados do investimento
  const { data: dbInv } = await supabase
    .from('investments')
    .select('*')
    .eq('id', investmentId)
    .single();

  let entityId = 'PF';
  let creditor = 'Investimento Migrado';
  let totalAmount = 1000;
  let startDate = new Date().toISOString().split('T')[0];
  let description = '';

  if (dbInv) {
    entityId = dbInv.entity_id || 'PF';
    creditor = dbInv.name || dbInv.institution || 'Dívida Migrada';
    totalAmount = Number(dbInv.current_amount || dbInv.initial_amount || 0);
    startDate = dbInv.start_date || startDate;
    description = dbInv.notes || dbInv.institution || '';
  } else {
    // Tenta buscar de accounts se estiver em fallback
    const { data: dbAcc } = await supabase.from('accounts').select('*').eq('id', investmentId).single();
    if (dbAcc) {
      entityId = dbAcc.entityId || dbAcc.entity_id || 'PF';
      creditor = dbAcc.name;
      totalAmount = Number(dbAcc.current_balance || dbAcc.initial_balance || 0);
    }
  }

  // 2. Criar dívida com parcelas
  await createDebtWithInstallments({
    entityId,
    creditor,
    description: description ? `Migrado de Investimentos: ${description}` : 'Migrado de Investimentos',
    totalAmount,
    interestRateMonthly: 0,
    installmentsCount,
    startDate,
  });

  // 3. Excluir o investimento original
  await deleteInvestment(investmentId);

  return true;
}



