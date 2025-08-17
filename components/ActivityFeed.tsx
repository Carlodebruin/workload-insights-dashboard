import React, { useRef } from 'react';
import { Activity, User, Category, ActivityStatus } from '../types';
import ActivityCard from './ActivityCard';
import { useVirtualizer } from '../hooks/useVirtualizer';

interface ActivityFeedProps {
  activities: Activity[];
  users: User[];
  allCategories: Category[];
  highlightedActivityId?: string | null;
  onEdit: (activity: Activity) => void;
  onDelete: (activityId: string) => void;
  onTaskAction: (activity: Activity) => void;
  onAddUpdate: (activity: Activity) => void;
  onQuickStatusChange: (activityId: string, newStatus: ActivityStatus) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  view: 'all' | 'mytasks';
}

const ITEM_HEIGHT = 240; // Increased height to accommodate action buttons

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  users,
  allCategories,
  highlightedActivityId,
  onEdit,
  onDelete,
  onTaskAction,
  onAddUpdate,
  onQuickStatusChange,
  containerRef,
  view
}) => {
  const { virtualItems, totalHeight, startOffset } = useVirtualizer({
    items: activities,
    itemHeight: ITEM_HEIGHT,
    containerRef: containerRef,
    overscan: 5,
  });

  if (activities.length === 0) {
    const message = view === 'mytasks'
      ? "You have no open tasks assigned."
      : "No activities match the current filters.";
    const subMessage = view === 'mytasks'
      ? "Select 'All Staff' to see all open tasks, or switch to the 'All Activities' tab."
      : "Try adjusting or clearing your filters to see more results.";

    return (
      <div className="text-center py-10 border-2 border-dashed border-border rounded-lg h-[400px] flex flex-col justify-center">
        <h3 className="text-lg font-semibold">{message}</h3>
        <p className="text-muted-foreground mt-1">{subMessage}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[60vh] overflow-y-auto"
      style={{ willChange: 'transform' }} // Optimization hint for browsers
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${startOffset}px)`,
          }}
        >
          {virtualItems.map(({ item: activity, index }) => (
            <div key={activity.id} style={{ height: `${ITEM_HEIGHT}px` }} className="p-2">
                 <ActivityCard
                    activity={activity}
                    user={users.find(u => u.id === activity.user_id)}
                    assignedUser={users.find(u => u.id === activity.assigned_to_user_id)}
                    category={allCategories.find(c => c.id === activity.category_id)}
                    users={users}
                    isHighlighted={activity.id === highlightedActivityId}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onTaskAction={onTaskAction}
                    onAddUpdate={onAddUpdate}
                    onQuickStatusChange={onQuickStatusChange}
                />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActivityFeed;
