import React, { lazy, Suspense } from 'react';
import { Activity, Category, ActivityStatus, User } from '../../types';
import { NewActivityData } from '../../types';

// Define prop interfaces locally since they're not exported
interface ActivityDistributionChartProps {
  data: Activity[];
  onCategorySelect: (categoryId: string) => void;
  selectedCategory: string;
  allCategories: Category[];
}

interface UserWorkloadChartProps {
  data: any[];
  onUserSelect?: (userId: string) => void;
  selectedUserId?: string;
  maxBars?: number;
}

interface PeakTimesChartProps {
  data: Activity[];
  onHourSelect: (hour: number | null) => void;
  selectedHour: number | null;
}

interface ActivityFeedProps {
  activities: Activity[];
  users: User[];
  allCategories: Category[];
  highlightedActivityId?: string | null;
  onEdit: (activity: Activity) => void;
  onDelete: (activityId: string) => void;
  onTaskAction: (activity: Activity) => void;
  onQuickStatusChange: (activityId: string, newStatus: ActivityStatus) => void;
  onQuickStatusNote?: (activity: Activity, status: ActivityStatus, notePrompt: string) => void;
  onViewDetails: (activity: Activity) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  view: 'all' | 'mytasks';
}

interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity;
  users: User[];
  categories: Category[];
  onEdit: (activity: Activity) => void;
  onDelete: (activityId: string) => void;
  onStatusChange: (activityId: string, newStatus: ActivityStatus) => Promise<void>;
  onAssign: (activityId: string, userId: string, instructions?: string) => Promise<void>;
  onAddUpdate: (activityId: string, notes: string, updateType?: 'progress' | 'status_change' | 'assignment' | 'completion') => Promise<void>;
}

// Individual skeleton components for better loading states
const ChartSkeleton: React.FC<{ type: 'pie' | 'bar' | 'times' }> = ({ type }) => (
  <div className="flex items-center justify-center h-64 bg-secondary/30 rounded-lg">
    <div className="text-center text-muted-foreground">
      <div className="text-2xl mb-2">
        {type === 'pie' ? '📊' : type === 'bar' ? '📈' : '⏰'}
      </div>
      <p className="text-sm">Loading chart...</p>
    </div>
  </div>
);

const ModalSkeleton: React.FC = () => (
  <div className="bg-background p-6 rounded-lg shadow-xl max-w-4xl w-full mx-4">
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-muted rounded w-3/4"></div>
      <div className="h-4 bg-muted rounded w-1/2"></div>
      <div className="h-32 bg-muted rounded"></div>
      <div className="h-12 bg-muted rounded"></div>
    </div>
  </div>
);

const FeedSkeleton: React.FC = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="bg-secondary/30 border border-border p-4 rounded-lg animate-pulse">
        <div className="h-6 bg-muted rounded w-2/3 mb-2"></div>
        <div className="h-4 bg-muted rounded w-1/2 mb-3"></div>
        <div className="h-20 bg-muted rounded"></div>
      </div>
    ))}
  </div>
);

// Lazy load heavy components
const LazyActivityDistributionChart = lazy(() => import('../charts/ActivityDistributionChart'));
const LazyUserWorkloadChart = lazy(() => import('../charts/UserWorkloadChart'));
const LazyPeakTimesChart = lazy(() => import('../charts/PeakTimesChart'));
const LazyActivityFeed = lazy(() => import('../ActivityFeed'));
const LazyTaskDetailsModal = lazy(() => import('../TaskDetailsModal'));

// Wrapper components that preserve existing interfaces
export const ActivityDistributionChart: React.FC<ActivityDistributionChartProps> = (props) => {
  return (
    <Suspense fallback={<ChartSkeleton type="pie" />}>
      <LazyActivityDistributionChart {...props} />
    </Suspense>
  );
};

export const UserWorkloadChart: React.FC<UserWorkloadChartProps> = (props) => {
  return (
    <Suspense fallback={<ChartSkeleton type="bar" />}>
      <LazyUserWorkloadChart {...props} />
    </Suspense>
  );
};

export const PeakTimesChart: React.FC<PeakTimesChartProps> = (props) => {
  return (
    <Suspense fallback={<ChartSkeleton type="times" />}>
      <LazyPeakTimesChart {...props} />
    </Suspense>
  );
};

export const ActivityFeed: React.FC<ActivityFeedProps> = (props) => {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <LazyActivityFeed {...props} />
    </Suspense>
  );
};

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = (props) => {
  return (
    <Suspense fallback={<ModalSkeleton />}>
      <LazyTaskDetailsModal {...props} />
    </Suspense>
  );
};