

import { User, Activity, Category, ActivityStatus, ActivityUpdate } from '../types';
import { v4 as uuidv4 } from 'uuid';

const USERS_STORAGE_KEY = 'workload_insights_users';
const ACTIVITIES_STORAGE_KEY = 'workload_insights_activities';
const CATEGORIES_STORAGE_KEY = 'workload_insights_categories';

// --- MOCK DATA DEFINITIONS (Moved from useMockData) ---

const MOCK_USERS: User[] = [
  { id: '1', phone_number: '+15550001', name: 'John Doe', role: 'Admin' },
  { id: '2', phone_number: '+15550002', name: 'Jane Smith', role: 'Teacher' },
  { id: '3', phone_number: '+15550003', name: 'Peter Jones', role: 'Maintenance' },
  { id: '4', phone_number: '+15550004', name: 'Mary Williams', role: 'Support Staff' },
];

const MOCK_CATEGORIES: Category[] = [
    { id: 'learner_wellness', name: 'Learner Wellness', isSystem: true },
    { id: 'parents', name: 'Parents', isSystem: true },
    { id: 'department', name: 'Department Visits/Meetings', isSystem: true },
    { id: 'fees', name: 'Fees Collections', isSystem: true },
    { id: 'maintenance', name: 'Maintenance', isSystem: true },
    { id: 'meetings', name: 'Staff Meetings', isSystem: true },
    { id: 'unplanned', name: 'Unplanned Incident', isSystem: true },
];

const CATEGORY_DETAILS: Record<string, { sub: string[], loc: string[] }> = {
  learner_wellness: { sub: ['Bullying', 'Counselling', 'Injury', 'Activities'], loc: ['Playground', 'Classroom A', 'Hall', 'Office'] },
  parents: { sub: ['Meetings', 'Complaints'], loc: ['Reception', 'Office'] },
  department: { sub: ['Meeting', 'Visit'], loc: ['Admin Block', 'Hall'] },
  fees: { sub: ['Collections', 'Enquiries'], loc: ['Accounts Office'] },
  maintenance: { sub: ['Grounds', 'Classroom', 'Hall', 'Plumbing', 'Electrical'], loc: ['Field', 'Classroom B', 'Main Hall', 'Ablution Block'] },
  meetings: { sub: ['Staff Meeting', 'Department Meeting'], loc: ['Staff Room', 'Hall'] },
  unplanned: { sub: ['Fire Drill', 'Medical Emergency', 'Lost Child'], loc: ['Field', 'Nurse Office', 'Main Gate'] }
};

const MOCK_NOTES = [
    "Follow-up required with parents.",
    "Resolved on the spot.",
    "Student sent to the nurse's office.",
    "Maintenance request submitted.",
    "Discussed upcoming school event.",
    "Complaint about bullying addressed with students involved.",
    "Routine fee collection for the new term.",
    "Fixed a leaking tap in the boys' bathroom.",
    "Incident report filed."
];

const LOCATION_COORDINATES: Record<string, { lat: number; lng: number }> = {
    'Playground': { lat: -25.7475, lng: 28.228 }, 'Classroom A': { lat: -25.7465, lng: 28.2285 },
    'Hall': { lat: -25.747, lng: 28.229 }, 'Office': { lat: -25.746, lng: 28.2295 },
    'Reception': { lat: -25.7461, lng: 28.2296 }, 'Admin Block': { lat: -25.746, lng: 28.2295 },
    'Accounts Office': { lat: -25.7459, lng: 28.2297 }, 'Grounds': { lat: -25.748, lng: 28.227 },
    'Field': { lat: -25.748, lng: 28.227 }, 'Classroom B': { lat: -25.7466, lng: 28.230 },
    'Main Hall': { lat: -25.747, lng: 28.229 }, 'Ablution Block': { lat: -25.7478, lng: 28.2288 },
    'Staff Room': { lat: -25.7462, lng: 28.2293 }, 'Nurse Office': { lat: -25.7468, lng: 28.2295 },
    'Main Gate': { lat: -25.7455, lng: 28.231 },
};

const getRandomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generateMockActivities = (count: number, categories: Category[]): Activity[] => {
  const activities: Activity[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const category = getRandomElement(categories);
    const details = CATEGORY_DETAILS[category.id] || { sub: ['General'], loc: ['Main Building']};
    const user = getRandomElement(MOCK_USERS);
    const location = getRandomElement(details.loc);
    const coords = LOCATION_COORDINATES[location];
    const timestamp = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const hasPhoto = Math.random() < 0.3;
    const hasNotes = Math.random() < 0.7;
    const latitude = coords ? coords.lat + (Math.random() - 0.5) * 0.0001 : undefined;
    const longitude = coords ? coords.lng + (Math.random() - 0.5) * 0.0001 : undefined;
    let status: ActivityStatus = 'Unassigned';
    let assigned_to_user_id: string | undefined = undefined;
    let assignment_instructions: string | undefined = undefined;
    if (category.id === 'maintenance' && Math.random() > 0.3) {
        status = 'Open';
        assigned_to_user_id = '3'; // Peter Jones (Maintenance)
        if(Math.random() > 0.5) assignment_instructions = "Please investigate the leak urgently.";
    }
    const updates: ActivityUpdate[] = [];
    if(status !== 'Unassigned' && Math.random() > 0.7) {
        updates.push({
            id: uuidv4(), timestamp: new Date(timestamp.getTime() + 60000 * 60).toISOString(),
            notes: "I've inspected the issue, will require parts that have been ordered.", author_id: '3',
            photo_url: Math.random() > 0.5 ? `https://picsum.photos/seed/${i+1}-update/400/300` : undefined,
        })
    }
    activities.push({
      id: (i + 1).toString(), user_id: user.id, category_id: category.id, subcategory: getRandomElement(details.sub),
      location: location, timestamp: timestamp.toISOString(), notes: hasNotes ? getRandomElement(MOCK_NOTES) : undefined,
      photo_url: hasPhoto ? `https://picsum.photos/seed/${i+1}/400/300` : undefined,
      latitude, longitude, status, assigned_to_user_id, assignment_instructions, updates, resolution_notes: undefined,
    });
  }
  return activities.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// --- API FUNCTION ---

export const fetchInitialData = async (): Promise<{ users: User[], activities: Activity[], categories: Category[] }> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            try {
                let storedUsers: User[] | null = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || 'null');
                let storedActivities: Activity[] | null = JSON.parse(localStorage.getItem(ACTIVITIES_STORAGE_KEY) || 'null');
                let storedCategories: Category[] | null = JSON.parse(localStorage.getItem(CATEGORIES_STORAGE_KEY) || 'null');

                if (!storedUsers || storedUsers.length === 0) {
                    storedUsers = MOCK_USERS;
                    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(storedUsers));
                }
                if (!storedCategories || storedCategories.length === 0) {
                    storedCategories = MOCK_CATEGORIES;
                    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(storedCategories));
                }
                if (!storedActivities || storedActivities.length === 0 || !storedActivities[0].status) {
                    storedActivities = generateMockActivities(150, storedCategories);
                    localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(storedActivities));
                }

                resolve({
                    users: storedUsers,
                    categories: storedCategories,
                    activities: storedActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                });
            } catch (error) {
                console.error("Failed to load data from localStorage, falling back to mocks.", error);
                const users = MOCK_USERS;
                const categories = MOCK_CATEGORIES;
                const activities = generateMockActivities(150, categories);
                
                localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
                localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
                localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(activities));

                resolve({ users, activities, categories });
            }
        }, 500); // Simulate 500ms network delay
    });
};