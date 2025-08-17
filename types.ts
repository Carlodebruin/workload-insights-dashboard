export interface User {
  id: string;
  phone_number: string;
  name: string;
  role: 'Teacher' | 'Admin' | 'Maintenance' | 'Support Staff';
}

export type NewUserData = Omit<User, 'id'>;

export interface Category {
  id: string;
  name: string;
  isSystem?: boolean; // To prevent deletion of default categories
}

export type ActivityStatus = 'Unassigned' | 'Open' | 'In Progress' | 'Resolved';

export interface ActivityUpdate {
  id: string;
  timestamp: string;
  notes: string;
  photo_url?: string;
  author_id: string;
}

export interface Activity {
  id: string;
  user_id: string;
  category_id: string;
  subcategory: string;
  location: string;
  timestamp: string; // ISO 8601 string
  notes?: string;
  photo_url?: string;
  latitude?: number;
  longitude?: number;
  // Task management fields
  status: ActivityStatus;
  assigned_to_user_id?: string;
  assignment_instructions?: string;
  resolution_notes?: string;
  updates?: ActivityUpdate[];
}

// Represents the data captured from the "Add Incident" form.
export type NewActivityData = Pick<Activity, 'user_id' | 'category_id' | 'subcategory' | 'location' | 'notes'> & { photo_url?: string; status?: ActivityStatus; assigned_to_user_id?: string; };

// Geofencing Types
export type GeofenceShape = 'circle' | 'polygon';

export interface Geofence {
    id: string;
    name: string;
    shape: GeofenceShape;
    // For circles
    latitude?: number;
    longitude?: number;
    radius?: number;
    // For polygons
    latlngs?: { lat: number, lng: number }[][];
}

export type NewGeofenceData = Omit<Geofence, 'id'>;
