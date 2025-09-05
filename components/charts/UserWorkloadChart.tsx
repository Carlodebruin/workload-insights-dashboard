import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { UserWorkloadData } from '../../lib/workload-analytics';

interface UserWorkloadChartProps {
  data: UserWorkloadData[];
  onUserSelect?: (userId: string) => void;
  selectedUserId?: string;
  maxBars?: number;
}

const UserWorkloadChart: React.FC<UserWorkloadChartProps> = ({ 
  data, 
  onUserSelect, 
  selectedUserId,
  maxBars = 8 
}) => {
  // Prepare chart data with user-friendly formatting
  const chartData = useMemo(() => {
    return data
      .sort((a, b) => b.workloadMetrics.workloadScore - a.workloadMetrics.workloadScore)
      .slice(0, maxBars)
      .map(user => ({
        userId: user.userId,
        userName: user.userName,
        workloadScore: Math.round(user.workloadMetrics.workloadScore),
        activeAssignments: user.workloadMetrics.activeAssignments,
        completedThisWeek: user.workloadMetrics.completedThisWeek,
        overdueAssignments: user.workloadMetrics.overdueAssignments,
        completionRate: Math.round(user.workloadMetrics.completionRate),
        capacityUtilization: Math.round(user.workloadMetrics.capacityUtilization),
        // For stacked bar display
        completed: user.workloadMetrics.completedThisWeek,
        active: user.workloadMetrics.activeAssignments,
        overdue: user.workloadMetrics.overdueAssignments
      }));
  }, [data, maxBars]);

  const handleBarClick = (data: any) => {
    if (data && data.userId && onUserSelect) {
      onUserSelect(data.userId);
    }
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground">{data.userName}</p>
          <p className="text-sm text-muted-foreground">
            Workload Score: <span className="text-foreground font-medium">{data.workloadScore}</span>
          </p>
          <div className="mt-2 space-y-1 text-xs">
            <p>✅ Completed: {data.completedThisWeek} this week</p>
            <p>🔄 Active: {data.activeAssignments}</p>
            <p>⚠️ Overdue: {data.overdueAssignments}</p>
            <p>📊 Completion: {data.completionRate}%</p>
            <p>📈 Capacity: {data.capacityUtilization}% utilized</p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <div className="text-2xl mb-2">📊</div>
          <p>No workload data available</p>
          <p className="text-sm">Assign tasks to staff to see workload analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          onClick={handleBarClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="userName" 
            angle={-45}
            textAnchor="end"
            height={60}
            tick={{ fontSize: 12 }}
            interval={0}
          />
          <YAxis 
            label={{ 
              value: 'Workload Score', 
              angle: -90, 
              position: 'insideLeft',
              style: { textAnchor: 'middle', fontSize: 12 }
            }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="workloadScore" 
            name="Workload Score"
            radius={[4, 4, 0, 0]}
            cursor={onUserSelect ? "pointer" : "default"}
          >
            {chartData.map((entry, index) => {
              const isSelected = entry.userId === selectedUserId;
              let color = 'hsl(var(--primary))';
              
              // Color coding based on workload intensity
              if (entry.workloadScore > 20) {
                color = 'hsl(var(--destructive))'; // High workload - red
              } else if (entry.workloadScore > 10) {
                color = 'hsl(var(--warning))'; // Medium workload - orange
              } else if (entry.workloadScore > 0) {
                color = 'hsl(var(--primary))'; // Normal workload - blue
              } else {
                color = 'hsl(var(--muted-foreground))'; // No workload - gray
              }
              
              // Highlight selected user
              if (isSelected) {
                color = 'hsl(var(--accent))'; // Selected - accent color
              }
              
              return <Cell key={`cell-${index}`} fill={color} stroke={isSelected ? 'hsl(var(--accent-foreground))' : undefined} strokeWidth={isSelected ? 2 : 0} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-destructive"></div>
          <span>High Workload (20+)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-warning"></div>
          <span>Medium (10-20)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary"></div>
          <span>Normal (1-10)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-muted-foreground"></div>
          <span>No Workload</span>
        </div>
      </div>
    </div>
  );
};

export default UserWorkloadChart;