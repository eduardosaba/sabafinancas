import { Account, CreditCardMetrics, Transaction } from '@/types/finance';

export type { CreditCardMetrics };

/**
 * Calculates the exact statement due date for a credit card purchase.
 * 
 * Rules:
 * - Closing Day (Fechamento): The day of month when statement closes (e.g., 25).
 * - Due Day (Vencimento): The day of month when invoice is due (e.g., 5).
 * - If purchase day <= closingDay: Purchase enters statement of current month M.
 * - If purchase day > closingDay: Purchase enters statement of next month M+1.
 * - If dueDay <= closingDay (e.g. closes 25th, due 5th): Invoice due date is in month M_stmt + 1.
 * - If dueDay > closingDay (e.g. closes 5th, due 15th): Invoice due date is in month M_stmt.
 */
export function calculateCreditCardDueDate(
  transactionDate: string, // YYYY-MM-DD
  closingDay: number = 25,
  dueDay: number = 5
): string {
  const parts = transactionDate.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return transactionDate;
  }

  const year = parts[0];
  const month = parts[1] - 1; // 0-indexed in JS Date
  const day = parts[2];

  // 1. Determine statement closing month/year
  let stmtYear = year;
  let stmtMonth = month;

  if (day > closingDay) {
    stmtMonth += 1;
    if (stmtMonth > 11) {
      stmtMonth = 0;
      stmtYear += 1;
    }
  }

  // 2. Determine due month/year based on dueDay vs closingDay
  let dueYear = stmtYear;
  let dueMonth = stmtMonth;

  if (dueDay <= closingDay) {
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
  }

  // 3. Create due date and clamp day to max days in target month
  const maxDaysInTargetMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
  const safeDueDay = Math.min(dueDay, maxDaysInTargetMonth);

  const formattedYear = dueYear;
  const formattedMonth = String(dueMonth + 1).padStart(2, '0');
  const formattedDay = String(safeDueDay).padStart(2, '0');

  return `${formattedYear}-${formattedMonth}-${formattedDay}`;
}

/**
 * Adds N months to an ISO date string (YYYY-MM-DD), maintaining valid day bounds.
 */
export function addMonthsToISO(dateStr: string, monthsToAdd: number): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;

  let year = parts[0];
  let month = parts[1] - 1 + monthsToAdd;
  const day = parts[2];

  while (month > 11) {
    month -= 12;
    year += 1;
  }
  while (month < 0) {
    month += 12;
    year -= 1;
  }

  const maxDays = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(day, maxDays);

  const formattedYear = year;
  const formattedMonth = String(month + 1).padStart(2, '0');
  const formattedDay = String(safeDay).padStart(2, '0');

  return `${formattedYear}-${formattedMonth}-${formattedDay}`;
}

/**
 * Computes Credit Card summary metrics for a given account.
 */
export function calculateCreditCardMetrics(
  account: Account,
  transactions: Transaction[]
): CreditCardMetrics {
  const todayStr = new Date().toISOString().split('T')[0];
  const closingDay = account.closingDay || 25;
  const dueDay = account.dueDay || 5;
  const creditLimit = account.creditLimit || 0;

  // Next upcoming statement due date relative to today
  const currentStatementDueDate = calculateCreditCardDueDate(todayStr, closingDay, dueDay);

  let openStatementTotal = 0;
  let futureStatementsTotal = 0;

  // Filter pending transactions linked to this credit card account
  const cardTxs = transactions.filter(
    (t) => t.accountId === account.id && t.status === 'PENDING'
  );

  cardTxs.forEach((tx) => {
    const delta = tx.type === 'INCOME' ? -tx.amount : tx.amount;
    // If transaction date is on or before current statement due date, it's in open statement
    if (tx.transactionDate <= currentStatementDueDate) {
      openStatementTotal += delta;
    } else {
      futureStatementsTotal += delta;
    }
  });

  openStatementTotal = Math.max(0, openStatementTotal);
  futureStatementsTotal = Math.max(0, futureStatementsTotal);

  const totalUsedCredit = openStatementTotal + futureStatementsTotal;
  const availableLimit = Math.max(0, creditLimit - totalUsedCredit);
  const limitUsagePercentage =
    creditLimit > 0 ? Math.min(100, Math.round((totalUsedCredit / creditLimit) * 100)) : 0;

  return {
    currentStatementDueDate,
    openStatementTotal,
    futureStatementsTotal,
    totalUsedCredit,
    creditLimit,
    availableLimit,
    limitUsagePercentage,
  };
}

