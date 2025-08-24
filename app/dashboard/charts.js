"use client";

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#10B981', '#EF4444']; // Green-500, Red-500

export function StatusPieChart({ data }) {
  const chartData = [
    { name: 'Checked', value: data.checked },
    { name: 'Not-Checked', value: data.notChecked },
  ];

  if (data.checked === 0 && data.notChecked === 0) {
    return <div className="flex items-center justify-center h-full text-gray-400">No data for chart</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: 'none', color: '#F9FAFB' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function NumberFrequencyBarChart({ data }) {
    if (data.length === 0) {
        return <div className="flex items-center justify-center h-full text-gray-400">No data for chart</div>;
    }

    return (
        <ResponsiveContainer width="100%" height={256}>
            <BarChart data={data}>
                <XAxis dataKey="number" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" allowDecimals={false} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                    labelStyle={{ color: '#F9FAFB' }}
                    cursor={{fill: 'rgba(59, 130, 246, 0.1)'}}
                />
                <Bar dataKey="count" fill="#3B82F6" name="Checkmarked Count" />
            </BarChart>
        </ResponsiveContainer>
    );
}
