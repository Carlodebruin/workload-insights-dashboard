import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { validateBody, validateQuery } from '../../../../../lib/validation';
import { logSecureError, logSecureInfo, createRequestContext, extractSafeUserId } from '../../../../../lib/secure-logger';
import { eventPublisher } from '../../../../../lib/event-publisher-service';
import { newActivityAssignmentSchema } from '../../../../../lib/validation/activity-assignment';

// CUID validation regex pattern
const CUID_REGEX = /^c[a-z0-9]{24}$/;

// Validate ID parameter to prevent SQL injection and malformed queries
function validateActivityId(activityId: string): { isValid: boolean; error?: NextResponse } {
  if (!activityId || typeof activityId !== 'string') {
    return {
      isValid: false,
      error: NextResponse.json(
        { error: 'Activity ID is required and must be a string' },
        { status: 400 }
      )
    };
  }
  
  if (!CUID_REGEX.test(activityId)) {
    return {
      isValid: false,
      error: NextResponse.json(
        { error: 'Invalid activity ID format. Must be a valid CUID.' },
        { status: 400 }
      )
    };
  }
  
  return { isValid: true };
}

// GET /api/activities/[activityId]/assignments - Get all assignments for an activity
export async function GET(
  request: Request,
  { params }: { params: { activityId: string } }
) {
  let requestContext;
  
  try {
    const { activityId } = params;
    
    // Validate activity ID parameter
    const validation = validateActivityId(activityId);
    if (!validation.isValid) {
      return validation.error!;
    }
    
    // Create secure logging context
    requestContext = createRequestContext(
      'get_activity_assignments',
      'GET',
      undefined,
      activityId
    );

    // Get all assignments for this activity with minimal user details
    const assignments = await prisma.activityAssignment.findMany({
      where: { activity_id: activityId },
      select: {
        id: true,
        activity_id: true,
        user_id: true,
        assigned_at: true,
        assigned_by: true,
        assignment_type: true,
        status: true,
        role_instructions: true,
        receive_notifications: true,
        // Minimal user details for performance
        assignedUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        assignedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        assignment_type: 'asc',
        assigned_at: 'desc',
      },
    });

    // Convert Date objects to ISO strings for JSON serialization
    const serializedAssignments = assignments.map((assignment: any) => ({
      id: assignment.id,
      activity_id: assignment.activity_id,
      user_id: assignment.user_id,
      assigned_at: assignment.assigned_at.toISOString(),
      assigned_by: assignment.assigned_by,
      assignment_type: assignment.assignment_type,
      status: assignment.status,
      role_instructions: assignment.role_instructions,
      receive_notifications: assignment.receive_notifications,
      assigned_user_name: assignment.assignedUser?.name || '',
      assigned_user_role: assignment.assignedUser?.role || '',
      assigned_by_name: assignment.assignedByUser?.name || '',
    }));
    
    // Log successful operation
    logSecureInfo('Activity assignments retrieved successfully', {
      ...requestContext,
      statusCode: 200,
      count: assignments.length,
    });

    return NextResponse.json(serializedAssignments);
  } catch (error) {
    // Secure error logging without PII exposure
    logSecureError(
      'Failed to retrieve activity assignments',
      {
        ...requestContext || createRequestContext('get_activity_assignments', 'GET'),
        statusCode: 500,
      },
      error instanceof Error ? error : undefined
    );
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/activities/[activityId]/assignments - Create a new assignment
export async function POST(
  request: Request,
  { params }: { params: { activityId: string } }
) {
  let requestContext;
  
  try {
    const { activityId } = params;
    
    // Validate activity ID parameter
    const validation = validateActivityId(activityId);
    if (!validation.isValid) {
      return validation.error!;
    }
    
    const body = await request.json();
    
    // Validate request body
    const validatedData = validateBody(newActivityAssignmentSchema, body);
    
    // Create secure logging context with safe user ID
    const safeUserId = extractSafeUserId(validatedData);
    requestContext = createRequestContext(
      'create_activity_assignment',
      'POST',
      safeUserId,
      activityId
    );

    // Check if assignment already exists
    const existingAssignment = await prisma.activityAssignment.findUnique({
      where: {
        unique_activity_user_assignment: {
          activity_id: activityId,
          user_id: validatedData.user_id,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'User is already assigned to this activity' },
        { status: 409 }
      );
    }

    // Create new assignment
    const newAssignment = await prisma.activityAssignment.create({
      data: {
        activity_id: activityId,
        user_id: validatedData.user_id,
        assigned_by: validatedData.assigned_by,
        assignment_type: validatedData.assignment_type,
        role_instructions: validatedData.role_instructions,
        receive_notifications: validatedData.receive_notifications,
      },
      select: {
        id: true,
        activity_id: true,
        user_id: true,
        assigned_at: true,
        assigned_by: true,
        assignment_type: true,
        status: true,
        role_instructions: true,
        receive_notifications: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            role: true,
          },
        },
        assignedByUser: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            role: true,
          },
        },
      },
    });

    // Convert Date objects to ISO strings for JSON serialization
    const serializedAssignment = {
      ...newAssignment,
      assigned_at: newAssignment.assigned_at.toISOString(),
    };
    
    // Log successful operation
    logSecureInfo('Activity assignment created successfully', {
      ...requestContext,
      statusCode: 201,
    });

    // Broadcast real-time event for assignment creation
    try {
      await eventPublisher.broadcastAssignmentChanged(
        activityId,
        undefined, // No previous assignee
        validatedData.user_id
      );
    } catch (broadcastError) {
      // Don't fail the request if broadcasting fails
      logSecureError('Failed to broadcast assignment creation event',
        createRequestContext('broadcast_assignment_created', 'POST', undefined, activityId, undefined),
        broadcastError instanceof Error ? broadcastError : undefined
      );
    }

    return NextResponse.json(serializedAssignment, { status: 201 });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Validation failed') ? 400 : 500;
    const message = statusCode === 400 ? (error as Error).message : 'Internal Server Error: Could not create assignment.';
    
    // Secure error logging without PII exposure
    logSecureError(
      'Failed to create activity assignment',
      {
        ...requestContext || createRequestContext('create_activity_assignment', 'POST'),
        statusCode,
      },
      error instanceof Error ? error : undefined
    );
    
    return NextResponse.json(
      { error: message },
      { status: statusCode }
    );
  }
}