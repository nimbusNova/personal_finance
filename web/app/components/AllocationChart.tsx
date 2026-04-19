'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface AllocationData {
  name: string;
  value: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

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
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
              color: '#fff',
            }}
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
