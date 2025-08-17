// Fixed API layer - Database only, no localStorage conflicts
import { User, Activity, Category } from '../types';

export const fetchInitialData = async (): Promise<{ users: User[], activities: Activity[], categories: Category[] }> => {
  try {
    const response = await fetch('/api/data');
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