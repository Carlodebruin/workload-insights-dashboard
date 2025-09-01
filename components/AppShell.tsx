"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Dashboard from './Dashboard';
import Header from './Header';
import AIInsightsPage from '../page-components/AIInsightsPage';
import AdminPage from '../page-components/AdminPage';
import WhatsAppMessagesPage from '../page-components/WhatsAppMessagesPage';
import { Category, Activity, NewActivityData, ActivityStatus, User, ActivityUpdate } from '../types';
import ToastContainer from './ToastContainer';
import { useMockData } from '../hooks/useMockData';
import { useToast } from '../hooks/useToast';
import AddIncidentModal from './AddIncidentModal';
import TaskActionModal from './TaskActionModal';
import TaskDetailsModal from './TaskDetailsModal';
import GeofencePrompt from './GeofencePrompt';
import QuickStatusNoteModal from './QuickStatusNoteModal';
import { fetchInitialData } from '../lib/api';
import DashboardSkeleton from './DashboardSkeleton';
import DynamicMapView from './dynamic/DynamicMapView';

const FILTERS_STORAGE_KEY = 'workload_insights_filters';

type AppData = {
    users: User[];
    activities: Activity[];
    categories: Category[];
};

const getInitialFilterState = () => {
    try {
        if (typeof window === 'undefined') return {}; // Guard for SSR
        const savedFilters = sessionStorage.getItem(FILTERS_STORAGE_KEY);
        if (savedFilters) return JSON.parse(savedFilters);
    } catch (e) {
        console.error("Failed to parse filters from sessionStorage", e);
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(FILTERS_STORAGE_KEY);
        }
    }
    return {
        selectedUserId: 'all',
        selectedCategory: 'all',
        dateRange: { start: '', end: '' },
        searchTerm: '',
    };
};

export default function AppShell() {
  const [view, setView] = useState<'dashboard' | 'ai-insights' | 'admin' | 'map' | 'whatsapp-messages'>('dashboard');
  
  // --- Centralized State Management ---
  const [loading, setLoading] = useState(true);
  const [appData, setAppData] = useState<AppData>({ users: [], activities: [], categories: [] });
  const { addActivity, updateActivity, deleteActivity, updateActivityStatus, addUpdateToActivity, addUser, updateUser, deleteUser, addCategory, deleteCategory } = useMockData(appData, setAppData);
  
  useEffect(() => {
      console.log('[AppShell] Starting to fetch initial data...');
      fetchInitialData().then(initialData => {
          console.log('[AppShell] Fetched initial data:', {
              users: initialData.users?.length || 0,
              activities: initialData.activities?.length || 0,
              categories: initialData.categories?.length || 0
          });
          setAppData(initialData);
          setLoading(false);
      }).catch(err => {
          console.error("Failed to fetch initial data:", err);
          // Handle error state for the user
          setLoading(false);
      });
  }, []);

  const { users, activities, categories } = appData;
  const { addToast } = useToast();

  // --- Modal State ---
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);
  const [prefilledData, setPrefilledData] = useState<Partial<NewActivityData> | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activityForTask, setActivityForTask] = useState<Activity | null>(null);
  const [isQuickNoteModalOpen, setIsQuickNoteModalOpen] = useState(false);
  const [quickNoteData, setQuickNoteData] = useState<{
    activity: Activity;
    targetStatus: ActivityStatus;
    notePrompt: string;
  } | null>(null);
  const [isTaskDetailsModalOpen, setIsTaskDetailsModalOpen] = useState(false);
  const [activityForDetails, setActivityForDetails] = useState<Activity | null>(null);

  // --- Filter State ---
  const [selectedUserId, setSelectedUserId] = useState<string>(() => getInitialFilterState().selectedUserId);
  const [selectedCategory, setSelectedCategory] = useState<string>(() => getInitialFilterState().selectedCategory);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => getInitialFilterState().dateRange);
  const [searchTerm, setSearchTerm] = useState<string>(() => getInitialFilterState().searchTerm);
  
  // --- Navigation State ---
  const [highlightActivityId, setHighlightActivityId] = useState<string | null>(null);

  useEffect(() => {
    const filters = { selectedUserId, selectedCategory, dateRange, searchTerm };
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [selectedUserId, selectedCategory, dateRange, searchTerm]);
  
  const categoryOptions = useMemo(() => {
    const specialOption = { value: 'UNPLANNED_INCIDENTS', label: 'Unplanned Incidents (Combined)' };
    const standardCategories = categories
        .filter(cat => cat.id !== 'unplanned' && cat.id !== 'learner_wellness')
        .map(cat => ({ value: cat.id, label: cat.name }));
    return [specialOption, ...standardCategories];
  }, [categories]);
  
  const handleDeepDive = (params: URLSearchParams) => {
    setSelectedCategory(params.get('category') || 'all');
    setSearchTerm(params.get('search') || '');
    setView('dashboard');
  };

  const sharedFilterProps = {
    selectedUserId, setSelectedUserId, selectedCategory, setSelectedCategory,
    dateRange, setDateRange, categories: categoryOptions, searchTerm, setSearchTerm,
  };

  // --- Modal Handlers ---
  const handleOpenLogModal = (activity: Activity | null = null, prefill: Partial<NewActivityData> | null = null) => {
    setActivityToEdit(activity); setPrefilledData(prefill); setIsLogModalOpen(true);
  };
  const handleCloseLogModal = () => {
    setIsLogModalOpen(false); setActivityToEdit(null); setPrefilledData(null);
  };
  const handleSaveIncident = async (data: NewActivityData) => {
    try {
      const isEditing = !!activityToEdit;
      const savedActivity = isEditing ? await updateActivity(activityToEdit.id, data) : await addActivity(data);
      handleCloseLogModal();
      addToast('Success', `Incident successfully ${isEditing ? 'updated' : 'created'}.`, 'success');
      return savedActivity;
    } catch (error) {
      addToast('Error Saving', 'There was a problem saving the incident.', 'error');
      console.error(error); return null;
    }
  };
  const handleDeleteActivity = (activityId: string) => {
    if (typeof window !== 'undefined' && window.confirm("Are you sure you want to delete this incident?")) {
      deleteActivity(activityId)
        .then(() => addToast('Success', 'The incident has been deleted.', 'success'))
        .catch((error) => { addToast('Error', 'Could not delete the incident.', 'error'); console.error(error); });
    }
  };
  const handleOpenTaskModal = (activity: Activity) => {
    setActivityForTask(activity); setIsTaskModalOpen(true);
  };
  const handleCloseTaskModal = () => {
    setIsTaskModalOpen(false); setActivityForTask(null);
  };
  const handleSaveTaskAction = async (activityId: string, payload: { userId?: string; status?: ActivityStatus; notes?: string; instructions?: string; progressNotes?: string; }) => {
    try {
      const updatePayload: any = {};
      if(payload.userId) updatePayload.assignToUserId = payload.userId;
      if(payload.status) updatePayload.status = payload.status;
      if(payload.notes !== undefined) updatePayload.resolutionNotes = payload.notes;
      if(payload.instructions !== undefined) updatePayload.instructions = payload.instructions;
      
      // Handle progress notes by creating an ActivityUpdate record
      if (payload.progressNotes?.trim()) {
        const currentActivity = activities.find(a => a.id === activityId);
        const currentUser = users[0] || { id: '1', name: 'User', role: 'Admin', phone_number: '' };
        
        // Create the update with status context
        await addUpdateToActivity(activityId, {
          notes: payload.progressNotes.trim(),
          author_id: currentUser.id,
          status_context: payload.status || currentActivity?.status,
          update_type: payload.userId ? 'assignment' : 'status_change'
        });
      }
      
      await updateActivityStatus(activityId, updatePayload);
      addToast('Success', 'Task successfully updated.', 'success');
      handleCloseTaskModal();
    } catch (error) {
        addToast('Error', 'There was a problem updating the task.', 'error'); console.error(error);
    }
  };
  const handleQuickStatusChange = async (activityId: string, status: ActivityStatus) => {
    try {
        await updateActivityStatus(activityId, { status });
        addToast('Success', `Task status updated to "${status}".`, 'success');
    } catch (error) {
        addToast('Error', 'Could not update task status.', 'error'); console.error(error);
    }
  };
  const handleOpenQuickNoteModal = (activity: Activity, status: ActivityStatus, notePrompt: string) => {
    setQuickNoteData({ activity, targetStatus: status, notePrompt });
    setIsQuickNoteModalOpen(true);
  };
  const handleCloseQuickNoteModal = () => {
    setIsQuickNoteModalOpen(false);
    setQuickNoteData(null);
  };
  const handleSaveQuickStatusNote = async (activityId: string, notes: string, status: ActivityStatus, updateType: string) => {
    try {
      // First, add the update with status context
      await addUpdateToActivity(activityId, {
        notes,
        author_id: users[0]?.id || '1', // Use current user (simplified for now)
        status_context: status,
        update_type: updateType as any
      });
      
      // Then update the activity status if it changed
      const currentActivity = activities.find(a => a.id === activityId);
      if (currentActivity && currentActivity.status !== status) {
        await updateActivityStatus(activityId, { status });
      }
      
      addToast('Success', 'Status note added successfully.', 'success');
      handleCloseQuickNoteModal();
    } catch (error) {
      addToast('Error', 'Could not save status note.', 'error');
      console.error(error);
    }
  };

  // Task Details Modal handlers
  const handleOpenTaskDetailsModal = (activity: Activity) => {
    setActivityForDetails(activity);
    setIsTaskDetailsModalOpen(true);
  };
  const handleCloseTaskDetailsModal = () => {
    setIsTaskDetailsModalOpen(false);
    setActivityForDetails(null);
  };
  const handleTaskDetailsEdit = (activity: Activity) => {
    // Close details modal and open edit modal
    handleCloseTaskDetailsModal();
    handleOpenLogModal(activity);
  };
  const handleTaskDetailsDelete = (activityId: string) => {
    // Close details modal and delete
    handleCloseTaskDetailsModal();
    handleDeleteActivity(activityId);
  };
  const handleTaskDetailsStatusChange = async (activityId: string, newStatus: ActivityStatus) => {
    await handleQuickStatusChange(activityId, newStatus);
  };
  const handleTaskDetailsAssign = async (activityId: string, userId: string, instructions?: string) => {
    try {
      await updateActivityStatus(activityId, { 
        assignToUserId: userId,
        instructions: instructions || undefined
      });
      addToast('Success', 'Task assigned successfully.', 'success');
    } catch (error) {
      addToast('Error', 'Could not assign task.', 'error');
      console.error(error);
    }
  };
  const handleTaskDetailsAddUpdate = async (activityId: string, notes: string, updateType?: 'progress' | 'status_change' | 'assignment' | 'completion') => {
    try {
      await addUpdateToActivity(activityId, {
        notes,
        author_id: users[0]?.id || '1',
        update_type: updateType || 'progress'
      });
      addToast('Success', 'Update added successfully.', 'success');
    } catch (error) {
      addToast('Error', 'Could not add update.', 'error');
      console.error(error);
    }
  };

  const renderContent = () => {
    if (loading) {
        return <DashboardSkeleton />;
    }
    switch (view) {
        case 'dashboard':
            return <Dashboard 
              {...sharedFilterProps} 
              users={users} activities={activities} allCategories={categories} loading={loading}
              onLogIncidentClick={() => handleOpenLogModal()}
              onEditActivity={(activity) => handleOpenLogModal(activity)}
              onDeleteActivity={handleDeleteActivity} onSaveIncident={handleSaveIncident}
              onTaskAction={handleOpenTaskModal}
              onQuickStatusChange={handleQuickStatusChange}
              onQuickStatusNote={handleOpenQuickNoteModal}
              onViewDetails={handleOpenTaskDetailsModal}
              highlightActivityId={highlightActivityId || undefined}
            />;
        case 'ai-insights':
            return <AIInsightsPage 
              {...sharedFilterProps} 
              users={users} activities={activities} allCategories={categories} loading={loading}
              onDeepDive={handleDeepDive}
            />;
        case 'admin':
            return <AdminPage 
              users={users} categories={categories}
              addUser={addUser} updateUser={updateUser} deleteUser={deleteUser}
              addCategory={addCategory} deleteCategory={deleteCategory} addActivity={addActivity}
              dataLoading={loading}
            />;
        case 'map':
            return <DynamicMapView 
              users={users} activities={activities} allCategories={categories} loading={loading}
              onEditActivity={(activity) => handleOpenLogModal(activity)}
              onDeleteActivity={handleDeleteActivity}
            />;
        case 'whatsapp-messages':
            return <WhatsAppMessagesPage 
              onConvertToActivity={(message) => {
                // Pre-fill modal with WhatsApp message content
                const prefill = {
                  notes: message.content,
                  location: `From WhatsApp: ${message.sender.name}`,
                };
                handleOpenLogModal(null, prefill);
              }}
              onNavigateToDashboard={(activityId) => {
                // Navigate to dashboard and highlight the activity
                setView('dashboard');
                setHighlightActivityId(activityId);
                // Clear highlight after a delay
                setTimeout(() => setHighlightActivityId(null), 5000);
              }}
            />;
        default:
            return null;
    }
  };


  return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <Header view={view} setView={setView} />
        <main className="p-4 sm:p-6 lg:p-8">
          {renderContent()}
        </main>
        <ToastContainer />
        <GeofencePrompt onLogRequest={(prefill) => handleOpenLogModal(null, prefill)} />
        {isLogModalOpen && (
          <AddIncidentModal
            isOpen={isLogModalOpen} onClose={handleCloseLogModal} onSave={handleSaveIncident}
            categories={categories.filter(cat => !cat.isSystem || (cat.id !== 'unplanned' && cat.id !== 'learner_wellness'))}
            users={users} activityToEdit={activityToEdit} prefilledData={prefilledData}
          />
        )}
        {isTaskModalOpen && activityForTask && (
            <TaskActionModal
                isOpen={isTaskModalOpen} onClose={handleCloseTaskModal} onSave={handleSaveTaskAction}
                activity={activityForTask} users={users}
            />
        )}
        {isQuickNoteModalOpen && quickNoteData && (
            <QuickStatusNoteModal
                isOpen={isQuickNoteModalOpen} 
                onClose={handleCloseQuickNoteModal} 
                onSave={handleSaveQuickStatusNote}
                activity={quickNoteData.activity} 
                targetStatus={quickNoteData.targetStatus}
                notePrompt={quickNoteData.notePrompt}
                currentUser={users[0] || { id: '1', name: 'User', role: 'Admin', phone_number: '' }}
            />
        )}
        {isTaskDetailsModalOpen && activityForDetails && (
            <TaskDetailsModal
                isOpen={isTaskDetailsModalOpen}
                onClose={handleCloseTaskDetailsModal}
                activity={activityForDetails}
                users={users}
                categories={categories}
                onEdit={handleTaskDetailsEdit}
                onDelete={handleTaskDetailsDelete}
                onStatusChange={handleTaskDetailsStatusChange}
                onAssign={handleTaskDetailsAssign}
                onAddUpdate={handleTaskDetailsAddUpdate}
            />
        )}
      </div>
  );
}
