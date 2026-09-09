import { Account, Category, ParsedTransaction, TransactionType } from '@/types/finance';

/**
 * Normalizes text by converting to lowercase, removing accents and diacritics
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Formats a Date object to YYYY-MM-DD string
 */
function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Category synonym mapping for accurate fuzzy matching without LLMs
 */
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  combustivel: ['gasolina', 'etanol', 'diesel', 'posto', 'combustivel', 'abastecida', 'abastecer', 'shell', 'ipiranga', 'br'],
  alimentacao: ['almoco', 'jantar', 'restaurante', 'ifood', 'mercado', 'supermercado', 'lanche', 'cafe', 'padaria', 'mcdonalds', 'uber eats', 'comida'],
  moradia: ['aluguel', 'condominio', 'luz', 'agua', 'internet', 'enel', 'sabesp', 'net', 'claro', 'vivo'],
  vendas: ['venda', 'vendas', 'cliente', 'servico', 'faturamento', 'projeto', 'consultoria', 'pagamento cliente'],
  rendimento: ['salario', 'prolabore', 'pro-labore', 'lucro', 'rendimento', 'dividendo', 'pro labore'],
  lazer: ['cinema', 'jogo', 'viagem', 'lazer', 'show', 'teatro', 'ingresso', 'netflix', 'spotify'],
  saude: ['farmacia', 'remedio', 'medico', 'consulta', 'exame', 'drogasil', 'droga raia', 'hospital', 'psicologo'],
  investimento: ['investimento', 'investimentos', 'dividendos', 'acao', 'fundo', 'cdb', 'rendimento'],
  educacao: ['curso', 'escola', 'faculdade', 'livro', 'udemy', 'postgraduacao', 'treinamento'],
  vestuario: ['roupa', 'sapato', 'loja', 'shopping', 'zara', 'nike', 'compras', 'vestuario'],
  assinatura: ['netflix', 'spotify', 'prime', 'hbo', 'disney', 'youtube', 'chatgpt', 'openai', 'icloud'],
  seguros: ['seguro', 'financiamento', 'parcela carro', 'parcela casa'],
  pets: ['pet', 'vet', 'veterinario', 'racao', 'petshop', 'cachorro', 'gato'],
  fornecedores: ['fornecedor', 'materia prima', 'insumo', 'estoque', 'compra estoque'],
  impostos: ['imposto', 'das', 'simples', 'iss', 'irpj', 'fgts', 'inss', 'tributo', 'darf'],
  folha: ['folha', 'pagamento funcionario', 'salario funcionario', 'vale transporte', 'vr', 'va'],
  marketing: ['marketing', 'ads', 'facebook ads', 'google ads', 'anuncio', 'trafego', 'instagram'],
  software: ['software', 'saas', 'aws', 'google cloud', 'vercel', 'github', 'zoom', 'figma'],
  contabilidade: ['contabilidade', 'contador', 'juridico', 'advogado', 'honorarios'],
};

/**
 * Keywords for detecting Income vs Expense
 */
const INCOME_KEYWORDS = ['recebi', 'ganhei', 'vendi', 'salario', 'prolabore', 'pro-labore', 'faturamento', 'pix recebido', 'entrada', 'deposito', 'credito'];
const EXPENSE_KEYWORDS = ['gastei', 'paguei', 'comprei', 'saida', 'pagamento', 'debito', 'boleto', 'conta'];

/**
 * Prepositions and filler words to remove during description cleanup
 */
const STOP_WORDS = [
  'gastei', 'paguei', 'comprei', 'recebi', 'ganhei', 'vendi',
  'reais', 'real', 'r$', 'r',
  'com', 'no', 'na', 'nos', 'nas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'por', 'para', 'pela', 'pelo',
  'cartao', 'conta', 'banco', 'via', 'pix',
  'hoje', 'ontem', 'anteontem',
];

/**
 * Zero-Tokens Natural Language Quick Transaction Parser
 */
export function parseQuickInput(
  rawInput: string,
  categories: Category[] = [],
  accounts: Account[] = []
): ParsedTransaction {
  let normalized = normalizeText(rawInput);
  let confidence = 0.5;

  // 1. DATE EXTRACTION
  let date = new Date();
  if (/\banteontem\b/i.test(normalized)) {
    date.setDate(date.getDate() - 2);
    normalized = normalized.replace(/\banteontem\b/gi, '');
  } else if (/\bontem\b/i.test(normalized)) {
    date.setDate(date.getDate() - 1);
    normalized = normalized.replace(/\bontem\b/gi, '');
  } else if (/\bhoje\b/i.test(normalized)) {
    normalized = normalized.replace(/\bhoje\b/gi, '');
  }

  // 1.5. STATUS DETECTION (PAID vs PENDING)
  let status: 'PAID' | 'PENDING' = 'PAID';
  if (/\b(a vencer|vencer|vencimento|pendente|agendado|agendar|a pagar|a receber)\b/i.test(rawInput)) {
    status = 'PENDING';
    confidence += 0.1;
  }

  // 1.6 INSTALLMENTS DETECTION (e.g. "em 10x", "10x", "10 parcelas")
  let installmentsCount = 1;
  const installmentMatch = rawInput.match(/\b(?:em\s*)?(\d{1,2})\s*x\b/i) || rawInput.match(/\b(\d{1,2})\s*parcelas?\b/i);
  if (installmentMatch) {
    const num = parseInt(installmentMatch[1], 10);
    if (!isNaN(num) && num > 1 && num <= 48) {
      installmentsCount = num;
      confidence += 0.1;
      normalized = normalized.replace(new RegExp(normalizeText(installmentMatch[0]), 'gi'), '');
    }
  }

  // 2. TRANSACTION TYPE DETECTION
  let type: TransactionType = 'EXPENSE';
  const hasIncomeKeyword = INCOME_KEYWORDS.some((kw) => normalized.includes(kw));
  const hasExpenseKeyword = EXPENSE_KEYWORDS.some((kw) => normalized.includes(kw));

  if (hasIncomeKeyword && !hasExpenseKeyword) {
    type = 'INCOME';
    confidence += 0.15;
  } else {
    type = 'EXPENSE';
    if (hasExpenseKeyword) confidence += 0.1;
  }

  // 3. NUMERIC / AMOUNT EXTRACTION (BRL)
  let amount = 0;
  // Match regex: handles "50", "50,00", "50.50", "r$ 50", "50 reais", "1.500,00"
  const amountRegex = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*reais)?/i;
  const amountMatch = rawInput.match(amountRegex);

  if (amountMatch) {
    let cleanNumStr = amountMatch[1];
    // Convert BRL format "1.500,50" -> "1500.50"
    if (cleanNumStr.includes(',') && cleanNumStr.includes('.')) {
      cleanNumStr = cleanNumStr.replace(/\./g, '').replace(',', '.');
    } else if (cleanNumStr.includes(',')) {
      cleanNumStr = cleanNumStr.replace(',', '.');
    }
    const parsedAmount = parseFloat(cleanNumStr);
    if (!isNaN(parsedAmount) && parsedAmount > 0) {
      amount = parsedAmount;
      confidence += 0.2;
    }
  }

  // Remove the matched amount phrase from normalized text to prevent description noise
  if (amountMatch && amountMatch[0]) {
    const amountPhrase = normalizeText(amountMatch[0]);
    normalized = normalized.replace(amountPhrase, '');
  }

  // 4. ENTITY RESOLUTION - ACCOUNTS
  let matchedAccountId: string | undefined;
  let matchedAccountName: string | undefined;

  for (const account of accounts) {
    const accNorm = normalizeText(account.name);
    // Extract key words from account name (e.g. "Nubank PF" -> ["nubank", "pf"])
    const accKeywords = accNorm.split(/\s+/).filter((w) => w.length > 2);
    
    const isDirectMatch = normalized.includes(accNorm);
    const isKeywordMatch = accKeywords.some((kw) => normalized.includes(kw));

    if (isDirectMatch || isKeywordMatch) {
      matchedAccountId = account.id;
      matchedAccountName = account.name;
      confidence += 0.15;
      // Clean account name words from normalized buffer
      accKeywords.forEach((kw) => {
        normalized = normalized.replace(new RegExp(`\\b${kw}\\b`, 'gi'), '');
      });
      break;
    }
  }

  // Fallback default account if available
  if (!matchedAccountId && accounts.length > 0) {
    matchedAccountId = accounts[0].id;
    matchedAccountName = accounts[0].name;
  }

  // 5. ENTITY RESOLUTION - CATEGORIES
  let matchedCategoryId: string | undefined;
  let matchedCategoryName: string | undefined;

  // First check against available categories
  for (const category of categories) {
    const catNorm = normalizeText(category.name);
    if (normalized.includes(catNorm)) {
      matchedCategoryId = category.id;
      matchedCategoryName = category.name;
      confidence += 0.15;
      normalized = normalized.replace(new RegExp(`\\b${catNorm}\\b`, 'gi'), '');
      break;
    }
  }

  // If no direct category name match, check synonym map
  if (!matchedCategoryId) {
    for (const [key, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
      const foundSynonym = synonyms.find((syn) => normalized.includes(syn));
      if (foundSynonym) {
        // Find category matching key
        const targetCat = categories.find((c) => normalizeText(c.name).includes(key));
        if (targetCat) {
          matchedCategoryId = targetCat.id;
          matchedCategoryName = targetCat.name;
          confidence += 0.15;
          break;
        }
      }
    }
  }

  // Fallback category by nature if not matched
  if (!matchedCategoryId && categories.length > 0) {
    const fallbackCat = categories.find((c) => c.nature === type) || categories[0];
    if (fallbackCat) {
      matchedCategoryId = fallbackCat.id;
      matchedCategoryName = fallbackCat.name;
    }
  }

  // 6. DESCRIPTION RESIDUAL CLEANUP
  let words = normalized.split(/\s+/).filter(Boolean);
  
  // Filter out stop words and isolated symbols
  words = words.filter((w) => !STOP_WORDS.includes(w) && w.length > 1 && !/^[-–—.:;$]+$/.test(w));

  let description = words.join(' ');
  // Capitalize first letter
  if (description) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  } else {
    // Fallback description based on category or default
    description = matchedCategoryName || (type === 'INCOME' ? 'Receita' : 'Despesa');
  }

  return {
    rawInput,
    type,
    amount,
    description,
    accountId: matchedAccountId,
    accountName: matchedAccountName,
    categoryId: matchedCategoryId,
    categoryName: matchedCategoryName,
    date: formatDateISO(date),
    status,
    installmentsCount,
    confidence: Math.min(1.0, confidence),
  };
}
