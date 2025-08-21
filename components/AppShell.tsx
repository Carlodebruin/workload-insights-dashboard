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
import GeofencePrompt from './GeofencePrompt';
import AddUpdateModal from './AddUpdateModal';
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
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [activityForUpdate, setActivityForUpdate] = useState<Activity | null>(null);

  // --- Filter State ---
  const [selectedUserId, setSelectedUserId] = useState<string>(() => getInitialFilterState().selectedUserId);
  const [selectedCategory, setSelectedCategory] = useState<string>(() => getInitialFilterState().selectedCategory);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => getInitialFilterState().dateRange);
  const [searchTerm, setSearchTerm] = useState<string>(() => getInitialFilterState().searchTerm);

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
  const handleSaveTaskAction = async (activityId: string, payload: { userId?: string; status?: ActivityStatus; notes?: string; instructions?: string; }) => {
    try {
      const updatePayload: any = {};
      if(payload.userId) updatePayload.assignToUserId = payload.userId;
      if(payload.status) updatePayload.status = payload.status;
      if(payload.notes !== undefined) updatePayload.resolutionNotes = payload.notes;
      if(payload.instructions !== undefined) updatePayload.instructions = payload.instructions;
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
  const handleOpenUpdateModal = (activity: Activity) => {
      setActivityForUpdate(activity); setIsUpdateModalOpen(true);
  };
  const handleCloseUpdateModal = () => {
      setIsUpdateModalOpen(false); setActivityForUpdate(null);
  };
  const handleSaveUpdate = async (activityId: string, updateData: Omit<ActivityUpdate, 'id' | 'timestamp'>) => {
    try {
        await addUpdateToActivity(activityId, updateData);
        addToast('Success', 'Incident update added.', 'success');
        handleCloseUpdateModal();
    } catch (error) {
        addToast('Error', 'Could not add update.', 'error'); console.error(error);
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
              onTaskAction={handleOpenTaskModal} onAddUpdate={handleOpenUpdateModal}
              onQuickStatusChange={handleQuickStatusChange}
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
        {isUpdateModalOpen && activityForUpdate && (
            <AddUpdateModal
                isOpen={isUpdateModalOpen} onClose={handleCloseUpdateModal} onSave={handleSaveUpdate}
                activity={activityForUpdate} users={users}
            />
        )}
      </div>
  );
}
