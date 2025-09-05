import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Activity, Category, NewActivityData, ActivityStatus } from '../types';
import { exportToCsv, parseDateStringAsLocal } from '../lib/utils';
import FilterControls from './FilterControls';
import KpiCard from './KpiCard';
import {
  ActivityDistributionChart,
  UserWorkloadChart,
  PeakTimesChart,
  ActivityFeed
} from './lazy/LazyComponentWrappers';
import { AlertTriangle, Users, Clock, Zap, GitPullRequest, Lightbulb } from 'lucide-react';
import DashboardSkeleton from './DashboardSkeleton';
import { useToast } from '../hooks/useToast';
import { calculateUserWorkloads, getWorkloadInsights } from '../lib/workload-analytics';

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
  onQuickStatusChange: (activityId: string, newStatus: ActivityStatus) => void;
  onQuickStatusNote?: (activity: Activity, status: ActivityStatus, notePrompt: string) => void; // New: Quick status with note
  onViewDetails: (activity: Activity) => void; // New: View task details modal
  highlightActivityId?: string;
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
  onQuickStatusChange,
  onQuickStatusNote,
  onViewDetails,
  highlightActivityId,
}) => {
  const { addToast } = useToast();
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [highlightedActivityId, setHighlightedActivityId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open'>('all');
  const [viewTab, setViewTab] = useState<'all' | 'mytasks'>('all');
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const [workloadData, setWorkloadData] = useState<any>(null);
  const [workloadInsights, setWorkloadInsights] = useState<any[]>([]);

  // Handle external activity highlighting (e.g., from WhatsApp navigation)
  useEffect(() => {
    if (highlightActivityId && activities.some(a => a.id === highlightActivityId)) {
      highlightAndScroll(highlightActivityId);
    }
  }, [highlightActivityId, activities]);

  // Calculate workload analytics when data changes
  useEffect(() => {
    const calculateWorkloads = async () => {
      try {
        const result = await calculateUserWorkloads(activities, users, allCategories);
        setWorkloadData(result);
        setWorkloadInsights(getWorkloadInsights(result.userWorkloads, result.teamSummary));
      } catch (error) {
        console.error('Failed to calculate workload analytics:', error);
      }
    };

    if (activities.length > 0 && users.length > 0 && allCategories.length > 0) {
      calculateWorkloads();
    }
  }, [activities, users, allCategories]);

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
        
        // Also search in category name and reporter name for better discoverability
        const category = allCategories.find(c => c.id === activity.category_id);
        const inCategory = category?.name.toLowerCase().includes(lowerCaseSearchTerm) ?? false;
        const reporter = users.find(u => u.id === activity.user_id);
        const inReporter = reporter?.name.toLowerCase().includes(lowerCaseSearchTerm) ?? false;
        const assignedUser = users.find(u => u.id === activity.assigned_to_user_id);
        const inAssignedUser = assignedUser?.name.toLowerCase().includes(lowerCaseSearchTerm) ?? false;
        
        return inSubcategory || inNotes || inLocation || inCategory || inReporter || inAssignedUser;
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

    // Make KPI calculations consistent - all use finalFilteredActivities or all use activities
    // For filtered view: show filtered counts; for unfiltered view: show global counts
    const useFilteredData = selectedCategory !== 'all' || selectedUserId !== 'all' || searchTerm || selectedHour !== null;
    
    const dataSource = useFilteredData ? finalFilteredActivities : activities;
    const openIncidents = useFilteredData 
      ? finalFilteredActivities.filter(a => a.status === 'Open' || a.status === 'In Progress').length
      : activities.filter(a => a.status === 'Open' || a.status === 'In Progress').length;

    return { 
        totalActivities: dataSource.length, 
        openIncidents,
        activeStaff: new Set(dataSource.map(a => a.user_id)).size, 
        peakHour 
    };
  }, [finalFilteredActivities, activities, selectedCategory, selectedUserId, searchTerm, selectedHour]);
  
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
        const ITEM_HEIGHT = 260; // Match the value in ActivityFeed
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
          <h3 className="text-lg font-semibold mb-4">Team Workload Analysis</h3>
          {process.env.NEXT_PUBLIC_ENABLE_WORKLOAD_CHART === 'true' && workloadData ? (
            <UserWorkloadChart
              data={workloadData.userWorkloads}
              onUserSelect={setSelectedUserId}
              selectedUserId={selectedUserId}
            />
          ) : (
            <ActivityDistributionChart
              data={baseFilteredActivities}
              onCategorySelect={setSelectedCategory}
              selectedCategory={selectedCategory}
              allCategories={allCategories}
            />
          )}
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

      {/* Workload Insights */}
      {workloadInsights.length > 0 && (
        <div className="bg-secondary/30 border border-border p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Workload Insights
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {workloadInsights.map((insight, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  insight.type === 'warning'
                    ? 'bg-yellow-100/20 border-yellow-500/30 text-yellow-800'
                    : insight.type === 'success'
                    ? 'bg-green-100/20 border-green-500/30 text-green-800'
                    : 'bg-blue-100/20 border-blue-500/30 text-blue-800'
                }`}
              >
                <h4 className="font-semibold text-sm mb-1">{insight.title}</h4>
                <p className="text-xs">{insight.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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
          onQuickStatusChange={onQuickStatusChange}
          onQuickStatusNote={onQuickStatusNote}
          onViewDetails={onViewDetails}
          view={viewTab}
        />
      </div>

    </div>
  );
};

export default Dashboard;
