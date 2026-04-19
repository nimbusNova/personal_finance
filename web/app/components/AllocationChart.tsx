'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface AllocationData {
  name: string;
  value: number;
}

// Preset colors mapped to common asset classes for consistency
const COLOR_MAP: Record<string, string> = {
  equity: '#3b82f6',      // blue
  bond: '#10b981',        // emerald
  commodity: '#f59e0b',   // amber
  cash: '#eab308',        // yellow/gold
  cash_equivalent: '#eab308',
  alternative: '#8b5cf6', // violet
  unknown: '#6b7280',     // gray
};

const FALLBACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#eab308'];

export default function AllocationChart({ data }: { data: AllocationData[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No allocation data available
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((entry, index) => {
              const color = COLOR_MAP[entry.name.toLowerCase()] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
              return <Cell key={`cell-${index}`} fill={color} />;
            })}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
              color: '#fff',
            }}
            itemStyle={{ color: '#fff' }}
            labelStyle={{ color: '#fff' }}
            formatter={(value: number) => [`${value.toFixed(2)}%`, 'Allocation']}
          />
          <Legend
            wrapperStyle={{ color: '#9ca3af' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
