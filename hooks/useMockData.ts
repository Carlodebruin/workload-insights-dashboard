import React from 'react';
import { User, Activity, Category, NewActivityData, NewUserData, ActivityStatus, ActivityUpdate } from '../types';

type AppData = {
    users: User[];
    activities: Activity[];
    categories: Category[];
};

export const useMockData = (
    data: AppData,
    setData: React.Dispatch<React.SetStateAction<AppData>>
) => {

  const addActivity = async (activityData: NewActivityData): Promise<Activity> => {
    const response = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activityData),
    });
    if (!response.ok) throw new Error('Failed to create activity');
    const newActivity: Activity = await response.json();
    setData(prevData => ({ ...prevData, activities: [newActivity, ...prevData.activities] }));
    return newActivity;
  };

  const updateActivity = async (activityId: string, updatedData: NewActivityData): Promise<Activity> => {
    const response = await fetch(`/api/activities/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full_update', payload: updatedData }),
    });
    if (!response.ok) throw new Error('Failed to update activity');
    const updatedActivity: Activity = await response.json();
    setData(prev => ({
        ...prev,
        activities: prev.activities.map(a => a.id === activityId ? updatedActivity : a),
    }));
    return updatedActivity;
  };
  
  const deleteActivity = async (activityId: string): Promise<void> => {
    const response = await fetch(`/api/activities/${activityId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete activity');
    setData(prev => ({ ...prev, activities: prev.activities.filter(a => a.id !== activityId) }));
  };

  const updateActivityStatus = async (
    activityId: string, 
    payload: { status?: ActivityStatus; resolutionNotes?: string; assignToUserId?: string; instructions?: string; }
  ): Promise<Activity> => {
    const response = await fetch(`/api/activities/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'status_update', payload }),
    });
    if (!response.ok) throw new Error('Failed to update task status');
    const updatedActivity: Activity = await response.json();
    setData(prev => ({
        ...prev,
        activities: prev.activities.map(a => a.id === activityId ? updatedActivity : a),
    }));
    return updatedActivity;
  };

  const addUpdateToActivity = async (
      activityId: string, 
      updateData: Omit<ActivityUpdate, 'id' | 'timestamp'>
  ): Promise<Activity> => {
    const response = await fetch(`/api/activities/${activityId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
    });
    if (!response.ok) throw new Error('Failed to add update');
    const updatedActivity: Activity = await response.json();
    setData(prev => ({
        ...prev,
        activities: prev.activities.map(a => a.id === activityId ? updatedActivity : a),
    }));
    return updatedActivity;
  };

  const addUser = async (userData: NewUserData): Promise<User> => {
    const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
    });
    if (!response.ok) throw new Error('Failed to add user');
    const newUser: User = await response.json();
    setData(prev => ({ ...prev, users: [...prev.users, newUser] }));
    return newUser;
  };

  const updateUser = async (userId: string, updatedData: Partial<NewUserData>): Promise<User> => {
    const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
    });
    if (!response.ok) throw new Error('Failed to update user');
    const updatedUser: User = await response.json();
    setData(prev => ({ ...prev, users: prev.users.map(u => u.id === userId ? updatedUser : u) }));
    return updatedUser;
  };

  const deleteUser = async (userId: string): Promise<void> => {
    const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to delete user');
    }
    const { activitiesToReassign } = await response.json();
    setData(prev => ({
        ...prev,
        users: prev.users.filter(u => u.id !== userId),
        activities: prev.activities.map(act => {
            const reassignInfo = activitiesToReassign.find((a: any) => a.id === act.id);
            return reassignInfo ? { ...act, user_id: reassignInfo.user_id } : act;
        }),
    }));
  };
  
  const addCategory = async (name: string): Promise<Category> => {
    const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to add category');
    }
    const newCategory: Category = await response.json();
    setData(prev => ({ ...prev, categories: [...prev.categories, newCategory] }));
    return newCategory;
  };

  const deleteCategory = async (categoryId: string): Promise<void> => {
    const response = await fetch(`/api/categories/${categoryId}`, { method: 'DELETE' });
    if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to delete category');
    }
    const { activitiesToUpdate } = await response.json();
    setData(prev => ({
        ...prev,
        categories: prev.categories.filter(c => c.id !== categoryId),
        activities: prev.activities.map(act => {
            const updateInfo = activitiesToUpdate.find((a: any) => a.id === act.id);
            return updateInfo ? { ...act, category_id: updateInfo.category_id } : act;
        }),
    }));
  };

  return { addActivity, updateActivity, deleteActivity, addUser, updateUser, deleteUser, updateActivityStatus, addUpdateToActivity, addCategory, deleteCategory };
};