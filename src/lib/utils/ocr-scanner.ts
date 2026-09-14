import { createWorker } from 'tesseract.js';

export interface OCRScanResult {
  rawText: string;
  amount: number | null;
  merchant: string | null;
  date: string | null;
  paymentMethod: string | null;
  suggestedInputText: string;
}

/**
 * Extrai texto e dados de finanças a partir de imagem de comprovante ou cupom fiscal
 */
export async function parseReceiptImage(imageFile: File | Blob | string): Promise<OCRScanResult> {
  let rawText = '';
  try {
    const worker = await createWorker('por');
    const ret = await worker.recognize(imageFile);
    rawText = ret.data.text || '';
    await worker.terminate();
  } catch (err) {
    console.warn('OCR em português falhou ou indisponível, tentando fallback padrão...', err);
    try {
      const worker = await createWorker('eng');
      const ret = await worker.recognize(imageFile);
      rawText = ret.data.text || '';
      await worker.terminate();
    } catch (fallbackErr) {
      console.error('Erro na extração de texto via OCR:', fallbackErr);
    }
  }

  return parseTextFromReceipt(rawText);
}

/**
 * Converte o texto bruto lido pelo OCR em campos estruturados
 */
export function parseTextFromReceipt(text: string): OCRScanResult {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let amount: number | null = null;
  let merchant: string | null = null;
  let date: string | null = null;
  let paymentMethod: string | null = null;

  // 1. Tenta extrair Valor Total
  const amountRegexes = [
    /(?:TOTAL|VALOR|PAGO|PAGAMENTO|VALOR TOTAL|R\$)\s*:?\s*R?\$?\s*([\d{1,3}.]*,\d{2}|\d+\.\d{2})/i,
    /R\$\s*([\d{1,3}.]*,\d{2}|\d+\.\d{2})/i,
  ];

  for (const regex of amountRegexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      const cleanVal = match[1].replace(/\./g, '').replace(',', '.');
      const parsedVal = parseFloat(cleanVal);
      if (!isNaN(parsedVal) && parsedVal > 0) {
        amount = parsedVal;
        break;
      }
    }
  }

  // Fallback: Procura pelo maior valor decimal encontrado
  if (!amount) {
    const allPrices = text.match(/\b\d+[\.,]\d{2}\b/g) || [];
    let maxVal = 0;
    for (const p of allPrices) {
      const clean = p.replace(/\./g, '').replace(',', '.');
      const val = parseFloat(clean);
      if (!isNaN(val) && val > maxVal && val < 50000) {
        maxVal = val;
      }
    }
    if (maxVal > 0) amount = maxVal;
  }

  // 2. Extrai Data
  const dateMatch = text.match(/\b(\d{2})[\/\.-](\d{2})[\/\.-](\d{2,4})\b/);
  if (dateMatch) {
    const day = dateMatch[1];
    const month = dateMatch[2];
    let year = dateMatch[3];
    if (year.length === 2) year = `20${year}`;
    date = `${year}-${month}-${day}`;
  }

  // 3. Extrai Forma de Pagamento
  if (/DEBITO|DÉBITO/i.test(text)) {
    paymentMethod = 'Cartão de Débito';
  } else if (/CREDITO|CRÉDITO|PARCELADO|NUBANK|VISA|MASTERCARD|ELO/i.test(text)) {
    paymentMethod = 'Cartão de Crédito';
  } else if (/PIX/i.test(text)) {
    paymentMethod = 'PIX';
  }

  // 4. Tenta extrair Estabelecimento (Geralmente uma das primeiras 3 linhas)
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (
      line.length >= 3 &&
      !/COMPROVANTE|VIA|CLIENTE|CNPJ|IE|EXTRATO|CUPOM|FISCAL|RECEITA|SAT|SEFAZ|NOTA/i.test(line) &&
      !/^\d+$/.test(line)
    ) {
      merchant = line.replace(/[^a-zA-Z0-9\sÁ-ÿ]/g, '').trim();
      if (merchant.length >= 3) break;
    }
  }

  // Monta a frase pronta para o parser de entrada rápida
  const parts: string[] = [];
  if (merchant) parts.push(merchant);
  else parts.push('Compra Comprovante');

  if (amount) parts.push(`R$ ${amount.toFixed(2).replace('.', ',')}`);
  if (paymentMethod) parts.push(`no ${paymentMethod}`);
  if (date) {
    const [y, m, d] = date.split('-');
    parts.push(`em ${d}/${m}/${y}`);
  }

  const suggestedInputText = parts.join(' ');

  return {
    rawText: text,
    amount,
    merchant,
    date,
    paymentMethod,
    suggestedInputText,
  };
}
