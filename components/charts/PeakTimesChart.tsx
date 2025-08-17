import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Activity } from '../../types';

interface ChartData {
  hour: string;
  activities: number;
}

interface PeakTimesChartProps {
  data: Activity[];
  onHourSelect: (hour: number | null) => void;
  selectedHour: number | null;
}

const SELECTED_COLOR = '#FF8042';
const DEFAULT_COLOR = '#0088FE';

const PeakTimesChart: React.FC<PeakTimesChartProps> = ({ data, onHourSelect, selectedHour }) => {
  const chartData: ChartData[] = useMemo(() => {
    const hourlyCounts: number[] = Array(24).fill(0);

    data.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours();
      hourlyCounts[hour]++;
    });

    return hourlyCounts.map((count, index) => ({
      hour: `${index.toString().padStart(2, '0')}:00`,
      activities: count,
    }));
  }, [data]);
  
  const hasData = useMemo(() => chartData.some(d => d.activities > 0), [chartData]);
  
  if (!hasData) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">No data to display</div>;
  }

  const handleBarClick = (data: any) => {
    // The `data` object passed by recharts' Bar onClick contains the original data in the `payload` property.
    const payload = data?.payload;

    if (payload && payload.hour) {
      const hour = parseInt(payload.hour.split(':')[0], 10);
      
      // If the clicked bar is already selected, deselect it. Otherwise, select it.
      if (hour === selectedHour) {
        onHourSelect(null);
      } else {
        onHourSelect(hour);
      }
    }
  };

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart 
            data={chartData} 
            margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
          <XAxis dataKey="hour" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1c1917',
              border: '1px solid #44403c',
              borderRadius: '0.5rem',
            }}
            cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
          />
          <Bar 
            dataKey="activities" 
            radius={[4, 4, 0, 0]} 
            cursor="pointer"
            onClick={handleBarClick}
          >
            {chartData.map((entry, index) => {
              const hourNumber = parseInt(entry.hour.split(':')[0], 10);
              return (
                <Cell 
                  key={`cell-${index}`} 
                  fill={hourNumber === selectedHour ? SELECTED_COLOR : DEFAULT_COLOR} 
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PeakTimesChart;