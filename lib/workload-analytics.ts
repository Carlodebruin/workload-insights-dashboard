import { Activity, User, Category } from '../types';

export interface UserWorkloadData {
  userId: string;
  userName: string;
  userRole: string;
  workloadMetrics: {
    activeAssignments: number;
    completedThisWeek: number;
    overdueAssignments: number;
    averageCompletionTime: number; // hours
    completionRate: number; // percentage
    workloadScore: number; // calculated complexity weight
    capacityUtilization: number; // percentage of theoretical max
  };
  categoryExpertise: Array<{
    categoryId: string;
    categoryName: string;
    assignmentCount: number;
    successRate: number;
  }>;
}

export interface TeamWorkloadSummary {
  totalActiveAssignments: number;
  totalOverdue: number;
  averageCompletionRate: number;
  mostLoadedUser?: string;
  leastLoadedUser?: string;
  workloadDistribution: Array<{
    userId: string;
    userName: string;
    workloadPercentage: number;
  }>;
}

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Calculate comprehensive workload analytics
 * PRESERVES existing activity data structures
 */
export async function calculateUserWorkloads(
  activities: Activity[],
  users: User[],
  categories: Category[],
  dateRange?: DateRange
): Promise<{
  userWorkloads: UserWorkloadData[];
  teamSummary: TeamWorkloadSummary;
}> {
  // Default to last 7 days if no date range provided
  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 7);
  
  const effectiveDateRange = dateRange || {
    start: defaultStart,
    end: defaultEnd
  };

  // Calculate user workloads
  const userWorkloads = users.map(user => {
    const userActivities = activities.filter(activity => 
      activity.assigned_to_user_id === user.id
    );

    const recentActivities = userActivities.filter(activity => {
      const activityDate = new Date(activity.timestamp);
      return activityDate >= effectiveDateRange.start && activityDate <= effectiveDateRange.end;
    });

    const activeAssignments = userActivities.filter(a => 
      a.status === 'Open' || a.status === 'In Progress'
    ).length;

    const completedActivities = userActivities.filter(a => 
      a.status === 'Resolved'
    );

    const completedThisWeek = completedActivities.filter(a => {
      const completionDate = new Date(a.timestamp);
      return completionDate >= effectiveDateRange.start;
    }).length;

    const overdueAssignments = userActivities.filter(a => {
      // Simple overdue logic: activities older than 48 hours that aren't resolved
      if (a.status === 'Resolved') return false;
      const activityDate = new Date(a.timestamp);
      const hoursSinceAssignment = (Date.now() - activityDate.getTime()) / (1000 * 60 * 60);
      return hoursSinceAssignment > 48;
    }).length;

    // Calculate completion metrics
    const totalAssignable = userActivities.length;
    const completionRate = totalAssignable > 0 
      ? (completedActivities.length / totalAssignable) * 100 
      : 0;

    // Calculate average completion time (in hours)
    let averageCompletionTime = 0;
    if (completedActivities.length > 0) {
      const totalCompletionTime = completedActivities.reduce((sum, activity) => {
        const assignmentDate = new Date(activity.timestamp);
        const completionDate = assignmentDate; // Using timestamp as completion for simplicity
        return sum + (completionDate.getTime() - assignmentDate.getTime());
      }, 0);
      averageCompletionTime = totalCompletionTime / (completedActivities.length * 1000 * 60 * 60);
    }

    // Calculate workload score (simple weighted calculation)
    const workloadScore = Math.round(
      (activeAssignments * 2) + 
      (overdueAssignments * 3) + 
      (completedThisWeek * 0.5)
    );

    // Calculate capacity utilization (0-100%)
    const maxCapacity = 10; // Theoretical maximum assignments per user
    const capacityUtilization = Math.min(100, (activeAssignments / maxCapacity) * 100);

    // Calculate category expertise
    const categoryExpertise = categories.map(category => {
      const categoryActivities = userActivities.filter(a => a.category_id === category.id);
      const completedCategoryActivities = categoryActivities.filter(a => a.status === 'Resolved');
      
      return {
        categoryId: category.id,
        categoryName: category.name,
        assignmentCount: categoryActivities.length,
        successRate: categoryActivities.length > 0 
          ? (completedCategoryActivities.length / categoryActivities.length) * 100 
          : 0
      };
    }).filter(expertise => expertise.assignmentCount > 0);

    return {
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      workloadMetrics: {
        activeAssignments,
        completedThisWeek,
        overdueAssignments,
        averageCompletionTime,
        completionRate,
        workloadScore,
        capacityUtilization
      },
      categoryExpertise
    };
  });

  // Calculate team summary
  const totalActiveAssignments = userWorkloads.reduce((sum, user) => 
    sum + user.workloadMetrics.activeAssignments, 0
  );

  const totalOverdue = userWorkloads.reduce((sum, user) => 
    sum + user.workloadMetrics.overdueAssignments, 0
  );

  const totalCompletionRate = userWorkloads.reduce((sum, user) => 
    sum + user.workloadMetrics.completionRate, 0
  );
  const averageCompletionRate = userWorkloads.length > 0 
    ? totalCompletionRate / userWorkloads.length 
    : 0;

  // Find most and least loaded users
  const sortedByWorkload = [...userWorkloads].sort((a, b) => 
    b.workloadMetrics.workloadScore - a.workloadMetrics.workloadScore
  );

  const mostLoadedUser = sortedByWorkload[0]?.userName;
  const leastLoadedUser = sortedByWorkload[sortedByWorkload.length - 1]?.userName;

  // Calculate workload distribution
  const totalWorkloadScore = userWorkloads.reduce((sum, user) => 
    sum + user.workloadMetrics.workloadScore, 0
  );

  const workloadDistribution = userWorkloads.map(user => ({
    userId: user.userId,
    userName: user.userName,
    workloadPercentage: totalWorkloadScore > 0 
      ? (user.workloadMetrics.workloadScore / totalWorkloadScore) * 100 
      : 0
  }));

  return {
    userWorkloads,
    teamSummary: {
      totalActiveAssignments,
      totalOverdue,
      averageCompletionRate,
      mostLoadedUser,
      leastLoadedUser,
      workloadDistribution
    }
  };
}

/**
 * Get workload insights for dashboard display
 */
export function getWorkloadInsights(userWorkloads: UserWorkloadData[], teamSummary: TeamWorkloadSummary) {
  const insights = [];

  // Overdue work insight
  if (teamSummary.totalOverdue > 0) {
    insights.push({
      type: 'warning' as const,
      title: 'Overdue Assignments',
      message: `${teamSummary.totalOverdue} assignments are overdue. Consider reassigning or prioritizing these tasks.`,
      priority: 'high' as const
    });
  }

  // Workload imbalance insight
  const workloadScores = userWorkloads.map(u => u.workloadMetrics.workloadScore);
  const maxWorkload = Math.max(...workloadScores);
  const minWorkload = Math.min(...workloadScores);
  
  if (maxWorkload > minWorkload * 3 && maxWorkload > 10) {
    insights.push({
      type: 'info' as const,
      title: 'Workload Imbalance',
      message: `Significant workload imbalance detected. ${teamSummary.mostLoadedUser} has ${Math.round(maxWorkload)} workload points while ${teamSummary.leastLoadedUser} has ${Math.round(minWorkload)}.`,
      priority: 'medium' as const
    });
  }

  // High capacity utilization insight
  const highUtilizationUsers = userWorkloads.filter(u => 
    u.workloadMetrics.capacityUtilization > 80
  );
  
  if (highUtilizationUsers.length > 0) {
    insights.push({
      type: 'warning' as const,
      title: 'High Capacity Utilization',
      message: `${highUtilizationUsers.length} staff members are at over 80% capacity. Consider redistributing workload.`,
      priority: 'medium' as const
    });
  }

  // Good performance insight
  const highPerformers = userWorkloads.filter(u => 
    u.workloadMetrics.completionRate > 75 && u.workloadMetrics.activeAssignments > 0
  );
  
  if (highPerformers.length > 0) {
    insights.push({
      type: 'success' as const,
      title: 'High Performance',
      message: `${highPerformers.length} staff members are maintaining excellent completion rates above 75%.`,
      priority: 'low' as const
    });
  }

  return insights;
}