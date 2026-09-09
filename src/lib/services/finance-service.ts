import { createClient } from '@/lib/supabase/client';
import {
  Account,
  AccountType,
  Budget,
  Category,
  CategoryBreakdownItem,
  DailyCashFlowItem,
  Debt,
  DebtInstallment,
  Entity,
  Transaction,
  TransactionNature,
  TransactionType,
} from '@/types/finance';
import { SEED_CATEGORIES } from '@/lib/supabase/seed';

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
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existing) {
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

      email = email || `user_${userId.slice(0, 8)}@financas.com.br`;
      name = name || email.split('@')[0] || 'Usuário';

      await supabase.from('users').upsert(
        {
          id: userId,
          email,
          name,
        },
        { onConflict: 'id' }
      );
    }
  } catch (err) {
    console.warn('Failed to ensure user exists in public.users:', err);
  }
}

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

  const fallbackId = '00000000-0000-0000-0000-000000000001';
  await ensureUserExistsInDb(supabase, fallbackId, {
    email: 'usuario@financas.com.br',
    name: 'Eduardo Finanças',
  });
  return fallbackId;
}

// -------------------------------------------------------------
// ENTITIES
// -------------------------------------------------------------
export async function fetchEntities(): Promise<Entity[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('entities').select('*');
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

// -------------------------------------------------------------
// ACCOUNTS
// -------------------------------------------------------------
export async function fetchAccounts(entityType?: string): Promise<Account[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('accounts').select('*');
  if (error) {
    console.error('Erro detalhado Supabase (fetchAccounts):', error);
    throw new Error(`Falha ao carregar contas do Supabase: ${error.message}`);
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
    createdAt: item.created_at,
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
    if (entityType === 'PJ' && (a.entityId === '22222222-2222-2222-2222-222222222222' || a.entityId === 'PJ')) return true;

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

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      entity_id: dbEntityId,
      name: input.name,
      account_type: input.accountType,
      initial_balance: input.initialBalance,
      current_balance: input.initialBalance,
      color_hex: input.colorHex || '#3b82f6',
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Erro detalhado Supabase (createAccount):', error);
    throw new Error(`Falha ao criar conta bancária no Supabase: ${error.message}`);
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

  const { error } = await supabase.from('accounts').update(payload).eq('id', id);
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
  const supabase = createClient();
  const { data, error } = await supabase.from('categories').select('*');
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
  const supabase = createClient();
  let query = supabase.from('transactions').select('*').order('transaction_date', { ascending: false });

  if (filters.startDate) query = query.gte('transaction_date', filters.startDate);
  if (filters.endDate) query = query.lte('transaction_date', filters.endDate);

  const { data, error } = await query;
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
  const status = input.status || 'PAID';

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

  const payload: any = {
    user_id: userId,
    entity_id: dbEntityId,
    account_id: dbAccountId,
    destination_account_id: dbDestAccountId,
    category_id: dbCategoryId,
    debt_installment_id: dbDebtInstId,
    type: input.type,
    amount: input.amount,
    transaction_date: input.transactionDate,
    description: input.description,
    status,
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

  // Update account balance directly in Supabase
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

  // Revert balance in DB
  if (dbTx.account_id && isValidUUID(dbTx.account_id)) {
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
  }

  return true;
}

export async function updateTransaction(
  id: string,
  updates: Partial<CreateTransactionInput>
): Promise<boolean> {
  const supabase = createClient();
  const dbPayload: any = {};
  if (updates.description !== undefined) dbPayload.description = updates.description;
  if (updates.amount !== undefined) dbPayload.amount = updates.amount;
  if (updates.type !== undefined) dbPayload.type = updates.type;
  if (updates.categoryId !== undefined) dbPayload.category_id = updates.categoryId;
  if (updates.accountId !== undefined) dbPayload.account_id = updates.accountId;
  if (updates.transactionDate !== undefined) dbPayload.transaction_date = updates.transactionDate;
  if (updates.status !== undefined) dbPayload.status = updates.status;

  const { error } = await supabase.from('transactions').update(dbPayload).eq('id', id);
  if (error) {
    console.error('Erro detalhado Supabase (updateTransaction):', error);
    throw new Error(`Falha ao atualizar transação no Supabase: ${error.message}`);
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
  const supabase = createClient();
  const categories = await fetchCategories(entityType).catch(() => []);
  const expenseCategories = categories.filter((c) => c.nature === 'EXPENSE' || !c.nature);
  const txs = await fetchTransactions({ entityType }).catch(() => []);

  const dbBudgetsMap = new Map<string, number>();

  let query = supabase.from('budgets').select('*');
  if (monthYear.length === 4) {
    query = query.gte('month_year', `${monthYear}-01`).lte('month_year', `${monthYear}-12`);
  } else {
    query = query.eq('month_year', monthYear);
  }

  const { data, error } = await query;
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
  const supabase = createClient();
  const { data: debtsData, error: debtsErr } = await supabase
    .from('debts')
    .select('*, debt_installments(*)');

  if (debtsErr) {
    console.error('Erro detalhado Supabase (fetchDebts):', debtsErr);
    throw new Error(`Falha ao carregar dívidas do Supabase: ${debtsErr.message}`);
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
