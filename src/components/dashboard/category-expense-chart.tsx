'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CategoryBreakdownItem } from '@/types/finance';

interface CategoryExpenseChartProps {
  data: CategoryBreakdownItem[];
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="rounded-xl bg-slate-900 border border-slate-700 p-3 shadow-xl text-xs space-y-1">
        <div className="font-bold text-slate-100 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.colorHex }} />
          {item.categoryName}
        </div>
        <div className="text-slate-300 font-mono font-semibold">
          {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({item.percentage}%)
        </div>
      </div>
    );
  }
  return null;
}

export function CategoryExpenseChart({ data }: CategoryExpenseChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[220px] flex items-center justify-center text-slate-500 text-xs italic bg-slate-950/40 rounded-xl border border-slate-800/80">
        Nenhuma despesa categorizada no período selecionado.
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4">
      {/* Donut Chart Container */}
      <div className="w-full md:w-1/2 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="categoryName"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={4}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.colorHex || '#64748b'} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Legend */}
      <div className="w-full md:w-1/2 space-y-2 text-xs">
        {data.map((item) => (
          <div
            key={item.categoryId}
            className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.colorHex }} />
              <span className="font-medium text-slate-200 truncate max-w-[120px]">{item.categoryName}</span>
            </div>
            <div className="text-right font-mono">
              <span className="font-bold text-slate-100 block">
                {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{item.percentage}% do total</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
