import { z } from 'zod';

// CUID validation regex pattern
const CUID_REGEX = /^c[a-z0-9]{24}$/;

// Activity assignment validation schemas
export const activityAssignmentSchema = z.object({
  user_id: z.string().min(1, 'User ID is required').regex(CUID_REGEX, 'Invalid user ID format'),
  assignment_type: z.enum(['primary', 'secondary', 'observer']).default('primary'),
  role_instructions: z.string().max(500, 'Role instructions too long').trim().optional(),
  receive_notifications: z.boolean().default(true),
  status: z.enum(['active', 'inactive', 'completed']).default('active'),
});

export const newActivityAssignmentSchema = activityAssignmentSchema.extend({
  assigned_by: z.string().min(1, 'Assigner ID is required').regex(CUID_REGEX, 'Invalid assigner ID format'),
});

export const updateActivityAssignmentSchema = activityAssignmentSchema.partial();

// Type exports
export type ValidatedActivityAssignment = z.infer<typeof activityAssignmentSchema>;
export type ValidatedNewActivityAssignment = z.infer<typeof newActivityAssignmentSchema>;
export type ValidatedUpdateActivityAssignment = z.infer<typeof updateActivityAssignmentSchema>;