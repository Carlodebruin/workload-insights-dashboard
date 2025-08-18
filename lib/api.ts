// Fixed API layer - Database only, no localStorage conflicts
import { User, Activity, Category } from '../types';

// For demo purposes, use admin token. In production, implement proper auth flow
const getAuthHeaders = () => ({
  'Authorization': 'Bearer demo-admin-token',
  'Content-Type': 'application/json'
});

export const fetchInitialData = async (): Promise<{ users: User[], activities: Activity[], categories: Category[] }> => {
  try {
    const response = await fetch('/api/data?page=1&limit=50', {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch initial data:', error);
    // Return minimal fallback data instead of localStorage
    return {
      users: [],
      activities: [],
      categories: []
    };
  }
};

// Create new user
export const createUser = async (userData: Omit<User, 'id'>): Promise<User> => {
  const response = await fetch('/api/users/', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(userData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create user');
  }
  
  return response.json();
};

// Create new category
export const createCategory = async (categoryData: Omit<Category, 'id'>): Promise<Category> => {
  const response = await fetch('/api/categories/', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(categoryData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create category');
  }
  
  return response.json();
};

// Create new activity
export const createActivity = async (activityData: any): Promise<Activity> => {
  const response = await fetch('/api/activities/', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(activityData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create activity');
  }
  
  return response.json();
};

// Update activity
export const updateActivity = async (activityId: string, updates: any): Promise<Activity> => {
  const response = await fetch(`/api/activities/${activityId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update activity');
  }
  
  return response.json();
};

// Delete user
export const deleteUser = async (userId: string): Promise<void> => {
  const response = await fetch(`/api/users/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete user');
  }
};