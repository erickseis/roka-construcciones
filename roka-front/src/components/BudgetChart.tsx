import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const data = [
  { name: 'Ene', presupuesto: 70, gasto: 65 },
  { name: 'Feb', presupuesto: 85, gasto: 90 },
  { name: 'Mar', presupuesto: 60, gasto: 55 },
  { name: 'Abr', presupuesto: 45, gasto: 50 },
  { name: 'May', presupuesto: 95, gasto: 85 },
  { name: 'Jun', presupuesto: 80, gasto: 72 },
];

export function BudgetChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: '#94a3b8' }} 
          />
          <Tooltip 
            cursor={{ fill: '#f1f5f9' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="presupuesto" fill="#e2e8f0" radius={[2, 2, 0, 0]} barSize={20} />
          <Bar dataKey="gasto" fill="#f59e0b" radius={[2, 2, 0, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
