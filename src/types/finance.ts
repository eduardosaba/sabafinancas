export type EntityType = 'PF' | 'PJ' | 'CONSOLIDATED';

export type AccountType = 'CHECKING' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH';

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export type TransactionNature = 'INCOME' | 'EXPENSE';

export type TransactionStatus = 'PENDING' | 'PAID';

export type DebtStatus = 'ACTIVE' | 'PAID_OFF' | 'RENEGOTIATED';

export type InstallmentStatus = 'PENDING' | 'PAID';

export type InvoiceStatus = 'OPEN' | 'CLOSED' | 'PAID';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
}

export interface Entity {
  id: string;
  userId?: string;
  name: string;
  type: 'PF' | 'PJ';
  createdAt?: string;
}

export interface Account {
  id: string;
  entityId: string;
  name: string;
  accountType: AccountType;
  initialBalance: number;
  currentBalance: number;
  colorHex: string;
  isActive: boolean;
  closingDay?: number | null;
  dueDay?: number | null;
  creditLimit?: number | null;
  cardImageUrl?: string | null;
  createdAt?: string;
}

export interface Category {
  id: string;
  entityId?: string | null; // null = Shared category
  name: string;
  nature: TransactionNature;
  icon: string;
  colorHex: string;
  keywords?: string[]; // Optional aliases for fuzzy matching
  createdAt?: string;
}

export interface DebtInstallment {
  id: string;
  debtId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  paidDate?: string | null;
  status: InstallmentStatus;
  createdAt?: string;
}

export interface Debt {
  id: string;
  entityId: string;
  creditor: string;
  description?: string;
  totalAmount: number;
  interestRateMonthly: number;
  installmentsCount: number;
  startDate: string; // YYYY-MM-DD
  status: DebtStatus;
  installments?: DebtInstallment[];
  createdAt?: string;
}

export interface Budget {
  id: string;
  entityId: string;
  categoryId: string;
  categoryName?: string;
  monthYear: string; // YYYY-MM
  plannedAmount: number;
  spentAmount?: number;
  createdAt?: string;
}

export interface CreditCardInvoice {
  id: string;
  accountId: string;
  accountName?: string;
  dueDate: string; // YYYY-MM-DD
  closingDate?: string; // YYYY-MM-DD
  referenceMonth: string; // YYYY-MM or Mês/Ano
  totalAmount: number;
  status: InvoiceStatus;
  createdAt?: string;
  transactions?: Transaction[];
}

export interface Transaction {
  id: string;
  userId: string;
  entityId: string; // 'PF' or 'PJ'
  accountId: string;
  destinationAccountId?: string | null;
  categoryId?: string | null;
  debtInstallmentId?: string | null;
  invoiceId?: string | null;
  type: TransactionType;
  amount: number;
  transactionDate: string; // YYYY-MM-DD
  description: string;
  status: TransactionStatus;
  createdAt?: string;
}

export interface ParsedTransaction {
  rawInput: string;
  type: TransactionType;
  amount: number;
  description: string;
  accountId?: string;
  accountName?: string;
  categoryId?: string;
  categoryName?: string;
  date: string; // YYYY-MM-DD
  status?: TransactionStatus;
  installmentsCount?: number;
  confidence: number;
}

export interface DailyCashFlowItem {
  date: string;
  income: number;
  expense: number;
  net: number;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  colorHex: string;
}

export interface CreditCardMetrics {
  currentStatementDueDate: string;
  openStatementTotal: number;
  futureStatementsTotal: number;
  totalUsedCredit: number;
  creditLimit: number;
  availableLimit: number;
  limitUsagePercentage: number;
}


