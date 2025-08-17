import { User, Category, Activity, ActivityStatus, ActivityUpdate } from '../types';
import { v4 as uuidv4 } from 'uuid';

// This file is now used for seeding the database, not for client-side mocking.
// Contains minimal essential data for system functionality.

export const MOCK_USERS: Omit<User, 'logged_activities' | 'assigned_activities' | 'updates'>[] = [
  { id: '1', phone_number: '+27000000001', name: 'System Admin', role: 'Admin' },
];

export const MOCK_CATEGORIES: Category[] = [
    { id: 'learner_wellness', name: 'Learner Wellness', isSystem: true },
    { id: 'maintenance', name: 'Maintenance', isSystem: true },
    { id: 'unplanned', name: 'Unplanned Incident', isSystem: true },
];

const CATEGORY_DETAILS: Record<string, { sub: string[], loc: string[] }> = {
  learner_wellness: { sub: ['General'], loc: ['School Grounds'] },
  maintenance: { sub: ['General'], loc: ['School Grounds'] },
  unplanned: { sub: ['General'], loc: ['School Grounds'] }
};

const MOCK_NOTES: string[] = [];

const LOCATION_COORDINATES: Record<string, { lat: number; lng: number }> = { 
  'School Grounds': { lat: -25.7475, lng: 28.228 }
};

const getRandomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

type ActivityForSeeding = Omit<Activity, 'id' | 'timestamp' | 'updates'> & { updates?: Omit<ActivityUpdate, 'id' | 'timestamp' | 'activity_id'>[] };

export const generateMockActivities = (count: number, users: Omit<User, 'logged_activities' | 'assigned_activities' | 'updates'>[], categories: Category[]): ActivityForSeeding[] => {
  // Return empty array - no demo activities
  return [];
};