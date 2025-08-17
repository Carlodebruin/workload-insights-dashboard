import React, { useState, useMemo, useRef } from 'react';
import { User, Activity, Category, NewActivityData, ActivityStatus } from '../types';
import { exportToCsv, parseDateStringAsLocal } from '../lib/utils';
import FilterControls from './FilterControls';
import KpiCard from './KpiCard';
import ActivityDistributionChart from './charts/ActivityDistributionChart';
import PeakTimesChart from './charts/PeakTimesChart';
import ActivityFeed from './ActivityFeed';
import { AlertTriangle, Users, Clock, Zap, GitPullRequest } from 'lucide-react';
import DashboardSkeleton from './DashboardSkeleton';
import { useToast } from '../hooks/useToast';

interface DashboardProps {
  selectedUserId: string;
  setSelectedUserId: (value: string) => void;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  dateRange: { start: string; end: string };
  setDateRange: (value: { start: string; end: string }) => void;
  categories: Array<{ value: string; label: string; }>;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  users: User[];
  activities: Activity[];
  allCategories: Category[];
  loading: boolean;
  onLogIncidentClick: () => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: string) => void;
  onSaveIncident: (data: NewActivityData) => Promise<Activity | null>;
  onTaskAction: (activity: Activity) => void;
  onAddUpdate: (activity: Activity) => void;
  onQuickStatusChange: (activityId: string, newStatus: ActivityStatus) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  selectedUserId,
  setSelectedUserId,
  selectedCategory,
  setSelectedCategory,
  dateRange,
  setDateRange,
  categories,
  searchTerm,
  setSearchTerm,
  users,
  activities,
  allCategories,
  loading,
  onLogIncidentClick,
  onEditActivity,
  onDeleteActivity,
  onSaveIncident,
  onTaskAction,
  onAddUpdate,
  onQuickStatusChange,
}) => {
  const { addToast } = useToast();
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [highlightedActivityId, setHighlightedActivityId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open'>('all');
  const [viewTab, setViewTab] = useState<'all' | 'mytasks'>('all');
  const feedContainerRef = useRef<HTMLDivElement>(null);

  const baseFilteredActivities = useMemo(() => {
    const startDate = parseDateStringAsLocal(dateRange.start);
    const endDate = parseDateStringAsLocal(dateRange.end);
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    return activities
      .filter(activity => {
        if (selectedUserId === 'all' || viewTab === 'all') return true;
        return activity.user_id === selectedUserId;
      })
      .filter(activity => {
        const activityDate = new Date(activity.timestamp);
        if (startDate && activityDate < startDate) return false;
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999); // Include the whole end day
            if(activityDate > endOfDay) return false;
        }
        return true;
      })
      .filter(activity => {
        if (selectedHour === null) return true;
        return new Date(activity.timestamp).getHours() === selectedHour;
      })
      .filter(activity => {
        if (!lowerCaseSearchTerm) return true;
        const inSubcategory = activity.subcategory.toLowerCase().includes(lowerCaseSearchTerm);
        const inNotes = activity.notes?.toLowerCase().includes(lowerCaseSearchTerm) ?? false;
        const inLocation = activity.location.toLowerCase().includes(lowerCaseSearchTerm);
        return inSubcategory || inNotes || inLocation;
      })
      .filter(activity => {
        if (filterStatus === 'all') return true;
        return activity.status === 'Open' || activity.status === 'In Progress';
      });
  }, [activities, selectedUserId, dateRange, selectedHour, searchTerm, filterStatus, viewTab]);

  const finalFilteredActivities = useMemo(() => {
    let activitiesToDisplay = baseFilteredActivities;

    if (viewTab === 'mytasks') {
      if (selectedUserId === 'all') {
         // Show all open tasks if 'All Staff' is selected
         activitiesToDisplay = activitiesToDisplay.filter(a => a.status === 'Open' || a.status === 'In Progress');
      } else {
        activitiesToDisplay = activitiesToDisplay.filter(
          a => a.assigned_to_user_id === selectedUserId && a.status !== 'Resolved'
        );
      }
    }

    if (selectedCategory === 'all') {
      return activitiesToDisplay;
    }
    return activitiesToDisplay.filter(activity => {
      if (selectedCategory === 'UNPLANNED_INCIDENTS') {
        return activity.category_id === 'unplanned' || activity.category_id === 'learner_wellness';
      }
      return activity.category_id === selectedCategory;
    });
  }, [baseFilteredActivities, selectedCategory, selectedUserId, viewTab]);

  const kpis = useMemo(() => {
    const hourlyCounts: number[] = Array(24).fill(0);
    finalFilteredActivities.forEach(activity => {
        const hour = new Date(activity.timestamp).getHours();
        hourlyCounts[hour]++;
    });

    let peakHour = 'N/A';
    const maxCount = Math.max(...hourlyCounts);
    if (maxCount > 0) {
        const peakHourNumber = hourlyCounts.indexOf(maxCount);
        peakHour = `${peakHourNumber}:00 - ${peakHourNumber + 1}:00`;
    }

    return { 
        totalActivities: finalFilteredActivities.length, 
        openIncidents: activities.filter(a => a.status === 'Open' || a.status === 'In Progress').length,
        activeStaff: new Set(finalFilteredActivities.map(a => a.user_id)).size, 
        peakHour 
    };
  }, [finalFilteredActivities, activities]);
  
  const myTasksCount = useMemo(() => {
      if (selectedUserId === 'all') {
          return activities.filter(a => a.status !== 'Resolved' && a.status !== 'Unassigned').length;
      }
      return activities.filter(a => a.assigned_to_user_id === selectedUserId && a.status !== 'Resolved').length;
  }, [activities, selectedUserId]);

  const handleExport = () => {
    if (finalFilteredActivities.length === 0) {
        addToast('No Data', 'There are no activities matching the current filters to export.', 'info');
        return;
    }
    exportToCsv(finalFilteredActivities.map(a => ({
        ...a,
        user_name: users.find(u => u.id === a.user_id)?.name || 'Unknown',
        assigned_to_name: users.find(u => u.id === a.assigned_to_user_id)?.name || 'N/A'
    })), 'activity_report.csv');
    addToast('Export Started', 'Your CSV file download has begun.', 'success');
  };

  const handleClearFilters = () => {
    setSelectedUserId('all');
    setSelectedCategory('all');
    setDateRange({ start: '', end: '' });
    setSelectedHour(null);
    setSearchTerm('');
    setFilterStatus('all');
    setViewTab('all');
  };
    
  const handleKpiClick = (kpiType: 'open' | 'total' | 'staff') => {
    setFilterStatus('all'); // Reset status filter first
    setViewTab('all'); // Go back to all activities view
    
    if (kpiType === 'open') {
      setFilterStatus('open');
      setSelectedCategory('all'); // Unset category filter to show all open tasks
    } else if (kpiType === 'total' || kpiType === 'staff') {
      setSelectedCategory('all');
    }
  };

  const highlightAndScroll = (activityId: string) => {
    setHighlightedActivityId(activityId);
    
    // Find the index of the new activity to scroll to it
    const index = finalFilteredActivities.findIndex(a => a.id === activityId);
    const feedElement = feedContainerRef.current;
    if (index !== -1 && feedElement) {
        const ITEM_HEIGHT = 192; // Match the value in ActivityCard
        const scrollTop = index * ITEM_HEIGHT - (feedElement.clientHeight / 2) + (ITEM_HEIGHT / 2);
        feedElement.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }

    setTimeout(() => {
      setHighlightedActivityId(null);
    }, 3000);
  }

  const handleSaveAndHighlight = async (data: NewActivityData) => {
    const savedActivity = await onSaveIncident(data);
    if (savedActivity) {
        highlightAndScroll(savedActivity.id);
    }
  };


  if (loading) {
    return <DashboardSkeleton />;
  }
  
  const tabButtonClasses = "px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background";
  const activeTabClasses = "bg-primary text-primary-foreground";
  const inactiveTabClasses = "bg-secondary text-secondary-foreground hover:bg-secondary/80";

  return (
    <div className="space-y-8">
      <FilterControls
        users={users}
        categories={categories}
        selectedUserId={selectedUserId}
        setSelectedUserId={setSelectedUserId}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        dateRange={dateRange}
        setDateRange={setDateRange}
        onClearFilters={handleClearFilters}
        showSearch={true}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showExport={true}
        onExport={handleExport}
        activityCount={finalFilteredActivities.length}
        onLogIncident={onLogIncidentClick}
      />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Activities" value={kpis.totalActivities} icon={<Zap className="h-6 w-6 text-muted-foreground" />} onClick={() => handleKpiClick('total')} isClickable={true} />
        <KpiCard title="Open Incidents" value={kpis.openIncidents} icon={<GitPullRequest className="h-6 w-6 text-muted-foreground" />} onClick={() => handleKpiClick('open')} isClickable={true} />
        <KpiCard title="Active Staff" value={kpis.activeStaff} icon={<Users className="h-6 w-6 text-muted-foreground" />} onClick={() => handleKpiClick('staff')} isClickable={true} />
        <KpiCard title="Peak Crisis Time" value={kpis.peakHour} icon={<Clock className="h-6 w-6 text-muted-foreground" />} isClickable={false} />
      </div>

      <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-5">
        <div className="lg:col-span-2 bg-secondary/30 border border-border p-4 rounded-lg">
           <h3 className="text-lg font-semibold mb-4">Activity Distribution</h3>
           <ActivityDistributionChart 
                data={baseFilteredActivities} 
                onCategorySelect={setSelectedCategory} 
                selectedCategory={selectedCategory}
                allCategories={allCategories}
            />
        </div>
        <div className="lg:col-span-3 bg-secondary/30 border border-border p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Activity by Hour</h3>
            <PeakTimesChart 
                data={finalFilteredActivities}
                onHourSelect={setSelectedHour}
                selectedHour={selectedHour}
            />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2 border border-border bg-secondary/30 p-1 rounded-lg">
                <button
                    onClick={() => setViewTab('all')}
                    className={`${tabButtonClasses} ${viewTab === 'all' ? activeTabClasses : inactiveTabClasses}`}
                    aria-pressed={viewTab === 'all'}
                >
                    All Activities ({activities.length})
                </button>
                <button
                    onClick={() => setViewTab('mytasks')}
                    className={`${tabButtonClasses} ${viewTab === 'mytasks' ? activeTabClasses : inactiveTabClasses}`}
                    aria-pressed={viewTab === 'mytasks'}
                >
                    My Open Tasks ({myTasksCount})
                </button>
            </div>
            <h3 className="text-2xl font-bold tracking-tight">
                {viewTab === 'all' ? `Live Activity Feed (${finalFilteredActivities.length})` : `My Open Tasks (${finalFilteredActivities.length})`}
            </h3>
        </div>
        <ActivityFeed
          containerRef={feedContainerRef}
          activities={finalFilteredActivities}
          users={users}
          allCategories={allCategories}
          highlightedActivityId={highlightedActivityId}
          onEdit={onEditActivity}
          onDelete={onDeleteActivity}
          onTaskAction={onTaskAction}
          onAddUpdate={onAddUpdate}
          onQuickStatusChange={onQuickStatusChange}
          view={viewTab}
        />
      </div>

    </div>
  );
};

export default Dashboard;
