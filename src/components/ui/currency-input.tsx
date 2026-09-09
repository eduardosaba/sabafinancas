'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | number;
  onChangeValue: (numericValue: number, formattedString: string) => void;
  className?: string;
  placeholder?: string;
}

export function formatValueToBRL(val: number | string | undefined | null): string {
  if (val === '' || val === undefined || val === null) return '';

  if (typeof val === 'number') {
    if (isNaN(val) || val === 0) return '';
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const str = val.toString().trim();
  if (!str) return '';

  // If it's a formatted BRL string like "2,00" or "1.250,50"
  if (str.includes(',')) {
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }

  // If standard float string representation (e.g. "2" or "2.5" or "200")
  const parsedFloat = parseFloat(str);
  if (!isNaN(parsedFloat) && parsedFloat > 0) {
    return parsedFloat.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return '';
}

export function CurrencyInput({
  value,
  onChangeValue,
  className,
  placeholder = '0,00',
  ...props
}: CurrencyInputProps) {
  const [displayString, setDisplayString] = useState<string>(() => formatValueToBRL(value));

  useEffect(() => {
    setDisplayString(formatValueToBRL(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digitsOnly = rawVal.replace(/\D/g, '');

    if (!digitsOnly || parseInt(digitsOnly, 10) === 0) {
      setDisplayString('');
      onChangeValue(0, '');
      return;
    }

    const numeric = parseFloat(digitsOnly) / 100;
    const formatted = numeric.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    setDisplayString(formatted);
    onChangeValue(numeric, formatted);
  };

  return (
    <div className="relative flex items-center w-full">
      <span className="absolute left-3 text-slate-400 font-extrabold font-mono text-xs select-none">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={displayString}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          'w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-extrabold font-mono text-sm focus:outline-none focus:border-emerald-500 transition-colors',
          className
        )}
        {...props}
      />
    </div>
  );
}
