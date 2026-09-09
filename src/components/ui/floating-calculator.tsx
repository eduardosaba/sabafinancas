'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, X, Minus, Maximize2, Copy, Check, Percent, Divide, Delete } from 'lucide-react';
import { useToast } from '@/contexts/toast-context';
import { cn } from '@/lib/utils';

export function FloatingCalculator() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  
  const [display, setDisplay] = useState<string>('0');
  const [history, setHistory] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [newNumber, setNewNumber] = useState<boolean>(true);

  const handleClear = () => {
    setDisplay('0');
    setHistory('');
    setNewNumber(true);
  };

  const handleDelete = () => {
    if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
      setNewNumber(true);
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handleDigit = (digit: string) => {
    if (newNumber || display === '0') {
      setDisplay(digit);
      setNewNumber(false);
    } else {
      if (display.length < 14) {
        setDisplay(display + digit);
      }
    }
  };

  const handleDecimal = () => {
    if (newNumber) {
      setDisplay('0.');
      setNewNumber(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleOp = (op: string) => {
    let expr = history;
    if (newNumber && history && !history.endsWith('=')) {
      // Replace last operator
      expr = history.trim().slice(0, -1) + ' ' + op + ' ';
    } else {
      expr = (history && !history.endsWith('=') ? history : '') + display + ' ' + op + ' ';
    }
    setHistory(expr);
    setNewNumber(true);
  };

  const handleEquals = () => {
    if (!history || history.endsWith('=')) return;
    const fullExpr = history + display;
    try {
      // Safe math eval replacing user operators
      const safeExpr = fullExpr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/,/g, '.');
      
      // Calculate
      const sanitized = safeExpr.replace(/[^0-9+\-*/%. ]/g, '');
      // eslint-disable-next-line no-eval
      const result = eval(sanitized);
      const formattedResult = Number(result.toFixed(6)).toString();
      
      setHistory(fullExpr + ' =');
      setDisplay(formattedResult);
      setNewNumber(true);
    } catch {
      setDisplay('Erro');
      setNewNumber(true);
    }
  };

  const handlePercent = () => {
    try {
      const val = parseFloat(display);
      if (!isNaN(val)) {
        setDisplay((val / 100).toString());
        setNewNumber(true);
      }
    } catch {
      setDisplay('Erro');
    }
  };

  const handleNegate = () => {
    if (display === '0') return;
    if (display.startsWith('-')) {
      setDisplay(display.slice(1));
    } else {
      setDisplay('-' + display);
    }
  };

  const handleCopy = () => {
    try {
      const numVal = parseFloat(display);
      const textToCopy = isNaN(numVal)
        ? display
        : numVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      toast.success(`Resultado ${textToCopy} copiado!`, 'Copiado');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy calculator result:', err);
    }
  };

  // Keyboard shortcut support
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen || isMinimized) return;
    
    // Ignore if focus is in an input or textarea
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }

    if (e.key >= '0' && e.key <= '9') {
      handleDigit(e.key);
    } else if (e.key === '.' || e.key === ',') {
      handleDecimal();
    } else if (e.key === '+') {
      handleOp('+');
    } else if (e.key === '-') {
      handleOp('-');
    } else if (e.key === '*') {
      handleOp('×');
    } else if (e.key === '/') {
      e.preventDefault();
      handleOp('÷');
    } else if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      handleEquals();
    } else if (e.key === 'Backspace') {
      handleDelete();
    } else if (e.key === 'Escape') {
      setIsMinimized(true);
    }
  }, [isOpen, isMinimized, display, history, newNumber]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
        }}
        title="Abrir Calculadora Flutuante"
        className="fixed bottom-6 right-6 z-50 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-2xl border border-emerald-400/30 flex items-center gap-2 group transition-all duration-300 hover:scale-105"
      >
        <Calculator className="h-5 w-5 transition-transform group-hover:rotate-12" />
        <span className="text-xs font-bold hidden sm:inline">Calculadora</span>
      </button>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 p-2 px-3.5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsMinimized(false)}>
          <Calculator className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold text-slate-200">{display}</span>
        </div>
        <div className="h-4 w-[1px] bg-slate-800 my-auto" />
        <button
          onClick={() => setIsMinimized(false)}
          title="Expandir Calculadora"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setIsOpen(false)}
          title="Fechar Calculadora"
          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 sm:w-80 rounded-3xl bg-slate-950/95 border border-slate-800 shadow-2xl backdrop-blur-xl space-y-3 overflow-hidden animate-in zoom-in-95 duration-200">
      
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 px-4 bg-slate-900/90 border-b border-slate-800 cursor-move">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <Calculator className="h-4 w-4 text-emerald-400" />
          <span>Calculadora Financeira</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            title="Minimizar"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            title="Fechar"
            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Screen Display */}
      <div className="px-4 py-2 space-y-1">
        <div className="h-4 text-right text-[11px] text-slate-500 font-mono overflow-hidden truncate">
          {history}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handleCopy}
            title="Copiar Valor"
            className={cn(
              'p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all',
              isCopied ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            )}
          >
            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-100 text-right truncate flex-1">
            {display}
          </div>
        </div>
      </div>

      {/* Keypad */}
      <div className="p-3.5 pt-1 grid grid-cols-4 gap-2">
        <button
          onClick={handleClear}
          className="p-3 rounded-2xl bg-rose-950/60 text-rose-300 hover:bg-rose-900/80 border border-rose-500/30 font-bold text-xs transition-colors"
        >
          C
        </button>
        <button
          onClick={handleDelete}
          className="p-3 rounded-2xl bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800 font-bold text-xs transition-colors flex items-center justify-center"
        >
          <Delete className="h-4 w-4" />
        </button>
        <button
          onClick={handlePercent}
          className="p-3 rounded-2xl bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800 font-bold text-xs transition-colors flex items-center justify-center"
        >
          <Percent className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleOp('÷')}
          className="p-3 rounded-2xl bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900 border border-emerald-500/30 font-bold text-sm transition-colors"
        >
          ÷
        </button>

        <button
          onClick={() => handleDigit('7')}
          className="p-3 rounded-2xl bg-slate-900 text-slate-100 hover:bg-slate-800 border border-slate-800 font-bold text-sm transition-colors"
        >
          7
        </button>
        <button
          onClick={() => handleDigit('8')}
          className="p-3 rounded-2xl bg-slate-900 text-slate-100 hover:bg-slate-800 border border-slate-800 font-bold text-sm transition-colors"
        >
          8
        </button>
        <button
          onClick={() => handleDigit('9')}
          className="p-3 rounded-2xl bg-slate-900 text-slate-100 hover:bg-slate-800 border border-slate-800 font-bold text-sm transition-colors"
        >
          9
        </button>
        <button
          onClick={() => handleOp('×')}
          className="p-3 rounded-2xl bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900 border border-emerald-500/30 font-bold text-sm transition-colors"
        >
          ×
        </button>

        <button
          onClick={() => handleDigit('4')}
          className="p-3 rounded-2xl bg-slate-900 text-slate-100 hover:bg-slate-800 border border-slate-800 font-bold text-sm transition-colors"
        >
          4
        </button>
        <button
          onClick={() => handleDigit('5')}
          className="p-3 rounded-2xl bg-slate-900 text-slate-100 hover:bg-slate-800 border border-slate-800 font-bold text-sm transition-colors"
        >
          5
        </button>
        <button
          onClick={() => handleDigit('6')}
          className="p-3 rounded-2xl bg-slate-900 text-slate-100 hover:bg-slate-800 border border-slate-800 font-bold text-sm transition-colors"
        >
          6
        </button>
        <button
          onClick={() => handleOp('-')}
          className="p-3 rounded-2xl bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900 border border-emerald-500/30 font-bold text-sm transition-colors"
        >
          -
        </button>

        <button
          onClick={() => handleDigit('1')}
          className="p-3 rounded-2xl bg-slate-900 text-slate-100 hover:bg-slate-800 border border-slate-800 font-bold text-sm transition-colors"
        >
          1
        </button>
        <button
          onClick={() => handleDigit('2')}
          className="p-3 rounded-2xl bg-slate-900 text-slate-100 hover:bg-slate-800 border border-slate-800 font-bold text-sm transition-colors"
        >
          2
        </button>
        <button
          onClick={() => handleDigit('3')}
          className="p-3 rounded-2xl bg-slate-900 text-slate-100 hover:bg-slate-800 border border-slate-800 font-bold text-sm transition-colors"
        >
          3
        </button>
        <button
          onClick={() => handleOp('+')}
          className="p-3 rounded-2xl bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900 border border-emerald-500/30 font-bold text-sm transition-colors"
        >
          +
        </button>

        <button
          onClick={handleNegate}
          className="p-3 rounded-2xl bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800 font-bold text-xs transition-colors"
        >
          +/-
        </button>
        <button
          onClick={() => handleDigit('0')}
          className="p-3 rounded-2xl bg-slate-900 text-slate-100 hover:bg-slate-800 border border-slate-800 font-bold text-sm transition-colors"
        >
          0
        </button>
        <button
          onClick={handleDecimal}
          className="p-3 rounded-2xl bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800 font-bold text-sm transition-colors"
        >
          ,
        </button>
        <button
          onClick={handleEquals}
          className="p-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm hover:from-emerald-500 hover:to-teal-500 shadow-lg border border-emerald-400/40 transition-colors"
        >
          =
        </button>
      </div>

    </div>
  );
}
