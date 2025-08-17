

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Activity, Category } from '../../types';

interface ChartData {
  name: string;
  value: number;
  categoryId: string;
}

interface ActivityDistributionChartProps {
  data: Activity[];
  onCategorySelect: (categoryId: string) => void;
  selectedCategory: string;
  allCategories: Category[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff4d4d', '#82ca9d', '#fa8072'];
const SELECTED_COLOR = '#FFA500'; // Bright orange for selection

const ActivityDistributionChart: React.FC<ActivityDistributionChartProps> = ({ data, onCategorySelect, selectedCategory, allCategories }) => {
  const chartData: ChartData[] = useMemo(() => {
    const categoryCounts = data.reduce((acc, activity) => {
      const categoryId = activity.category_id || 'uncategorized';
      acc[categoryId] = (acc[categoryId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(categoryCounts).map(([id, value]) => ({
      name: allCategories.find(c => c.id === id)?.name || id,
      value,
      categoryId: id,
    }));
  }, [data, allCategories]);

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">No data to display</div>;
  }
  
  const handlePieClick = (data: any) => {
    if (data && data.categoryId) {
      if (data.categoryId === selectedCategory) {
        onCategorySelect('all');
      } else {
        onCategorySelect(data.categoryId);
      }
    }
  };
  
  return (
    <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
            <PieChart>
            <Tooltip
                contentStyle={{
                    backgroundColor: '#1c1917',
                    border: '1px solid #44403c',
                    borderRadius: '0.5rem',
                }}
                cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
            />
            <Legend iconSize={10} />
            <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                onClick={handlePieClick}
                cursor="pointer"
            >
                {chartData.map((entry, index) => {
                    let isSelected = entry.categoryId === selectedCategory;
                    if (selectedCategory === 'UNPLANNED_INCIDENTS') {
                      isSelected = entry.categoryId === 'unplanned' || entry.categoryId === 'learner_wellness';
                    }
                    return (
                        <Cell key={`cell-${index}`} fill={isSelected ? SELECTED_COLOR : COLORS[index % COLORS.length]} />
                    );
                })}
            </Pie>
            </PieChart>
        </ResponsiveContainer>
    </div>
  );
};

export default ActivityDistributionChart;