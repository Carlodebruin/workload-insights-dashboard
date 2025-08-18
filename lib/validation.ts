import { z } from 'zod';

// Phone number validation (South African format)
const phoneNumberSchema = z.string()
  .regex(/^\+27[0-9]{9}$/, 'Phone number must be in format +27xxxxxxxxx')
  .min(12)
  .max(12);

// ID validation for database IDs (flexible for existing data)
export const cuidSchema = z.string().min(1, 'ID is required');

// URL validation for photo uploads
const urlSchema = z.string().url('Invalid URL format').optional();

// Coordinate validation
const latitudeSchema = z.number().min(-90).max(90);
const longitudeSchema = z.number().min(-180).max(180);

// User role enum
const userRoleSchema = z.enum(['Teacher', 'Admin', 'Maintenance', 'Support Staff']);

// Activity status enum
const activityStatusSchema = z.enum(['Unassigned', 'Open', 'In Progress', 'Resolved']);

// Geofence shape enum
const geofenceShapeSchema = z.enum(['circle', 'polygon']);

// User validation schemas
export const userSchema = z.object({
  id: cuidSchema,
  phone_number: phoneNumberSchema,
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
  role: userRoleSchema,
});

export const newUserSchema = userSchema.omit({ id: true });

export const updateUserSchema = newUserSchema.partial();

// Category validation schemas
export const categorySchema = z.object({
  id: cuidSchema,
  name: z.string().min(1, 'Category name is required').max(50, 'Category name too long').trim(),
  isSystem: z.boolean().optional(),
});

export const newCategorySchema = categorySchema.omit({ id: true });

export const updateCategorySchema = newCategorySchema.partial();

// Activity validation schemas
export const activityUpdateSchema = z.object({
  id: cuidSchema,
  timestamp: z.string().datetime('Invalid timestamp format'),
  notes: z.string().min(1, 'Notes are required').max(1000, 'Notes too long').trim(),
  photo_url: urlSchema,
  author_id: cuidSchema,
});

export const newActivityUpdateSchema = activityUpdateSchema.omit({ id: true, timestamp: true });

export const activitySchema = z.object({
  id: cuidSchema,
  user_id: cuidSchema,
  category_id: cuidSchema,
  subcategory: z.string().min(1, 'Subcategory is required').max(100, 'Subcategory too long').trim(),
  location: z.string().min(1, 'Location is required').max(100, 'Location too long').trim(),
  timestamp: z.string().datetime('Invalid timestamp format'),
  notes: z.string().max(1000, 'Notes too long').trim().optional(),
  photo_url: urlSchema,
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  status: activityStatusSchema,
  assigned_to_user_id: cuidSchema.optional(),
  assignment_instructions: z.string().max(500, 'Instructions too long').trim().optional(),
  resolution_notes: z.string().max(1000, 'Resolution notes too long').trim().optional(),
  updates: z.array(activityUpdateSchema).optional(),
});

export const newActivitySchema = z.object({
  user_id: cuidSchema,
  category_id: cuidSchema,
  subcategory: z.string().min(1, 'Subcategory is required').max(100, 'Subcategory too long').trim(),
  location: z.string().min(1, 'Location is required').max(100, 'Location too long').trim(),
  notes: z.string().max(1000, 'Notes too long').trim().optional(),
  photo_url: urlSchema,
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  status: activityStatusSchema.optional(),
  assigned_to_user_id: cuidSchema.optional(),
});

export const updateActivitySchema = newActivitySchema.partial();

// Activity status update schema (for task management)
export const activityStatusUpdateSchema = z.object({
  status: activityStatusSchema.optional(),
  resolutionNotes: z.string().max(1000, 'Resolution notes too long').trim().optional(),
  assignToUserId: cuidSchema.optional(),
  instructions: z.string().max(500, 'Instructions too long').trim().optional(),
});

// Geofence validation schemas
export const geofenceSchema = z.object({
  id: cuidSchema,
  name: z.string().min(1, 'Geofence name is required').max(50, 'Geofence name too long').trim(),
  shape: geofenceShapeSchema,
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  radius: z.number().min(1).max(50000).optional(), // 1m to 50km
  latlngs: z.array(z.array(z.object({
    lat: latitudeSchema,
    lng: longitudeSchema
  }))).optional(),
});

export const newGeofenceSchema = geofenceSchema.omit({ id: true });

// Query parameter validation
export const paginationSchema = z.object({
  page: z.string().transform(val => Math.max(1, parseInt(val) || 1)),
  limit: z.string().transform(val => Math.min(100, Math.max(1, parseInt(val) || 50))),
});

export const activityFilterSchema = z.object({
  user_id: cuidSchema.optional(),
  category_id: cuidSchema.optional(),
  status: activityStatusSchema.optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

// API route validation helpers
export const validateBody = <T>(schema: z.ZodSchema<T>, body: unknown): T => {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errorMessages = result.error.issues.map(issue => issue.message).join(', ');
    throw new Error(`Validation failed: ${errorMessages}`);
  }
  return result.data;
};

export const validateQuery = <T>(schema: z.ZodSchema<T>, query: Record<string, string | string[]>): T => {
  const result = schema.safeParse(query);
  if (!result.success) {
    const errorMessages = result.error.issues.map(issue => issue.message).join(', ');
    throw new Error(`Query validation failed: ${errorMessages}`);
  }
  return result.data;
};

// Type exports for TypeScript
export type ValidatedUser = z.infer<typeof userSchema>;
export type ValidatedNewUser = z.infer<typeof newUserSchema>;
export type ValidatedCategory = z.infer<typeof categorySchema>;
export type ValidatedNewCategory = z.infer<typeof newCategorySchema>;
export type ValidatedActivity = z.infer<typeof activitySchema>;
export type ValidatedNewActivity = z.infer<typeof newActivitySchema>;
export type ValidatedActivityStatusUpdate = z.infer<typeof activityStatusUpdateSchema>;
export type ValidatedGeofence = z.infer<typeof geofenceSchema>;
export type ValidatedNewGeofence = z.infer<typeof newGeofenceSchema>;