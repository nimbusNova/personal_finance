'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  icon?: React.ReactNode;
  masked?: boolean;
}

export default function StatCard({ title, value, change, icon, masked }: StatCardProps) {
  const isPositive = change?.startsWith('+');
  const isNegative = change?.startsWith('-');
  const changeColor = isPositive
    ? 'text-green-400'
    : isNegative
    ? 'text-red-400'
    : 'text-gray-400';

  const ChangeIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-400">{title}</p>
        {icon && <div className="text-gray-500">{icon}</div>}
      </div>
      <p className={`text-2xl font-bold ${masked ? 'text-gray-500 tracking-widest' : 'text-white'}`}>{value}</p>
      {change && (
        <div className={cn('flex items-center gap-1 text-sm mt-1', changeColor)}>
          <ChangeIcon className="w-4 h-4" />
          <span>{change}</span>
        </div>
      )}
    </div>
  );
}
