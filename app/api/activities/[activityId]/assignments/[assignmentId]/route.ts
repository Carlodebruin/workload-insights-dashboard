import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { validateBody } from '../../../../../../lib/validation';
import { logSecureError, logSecureInfo, createRequestContext, extractSafeUserId } from '../../../../../../lib/secure-logger';
import { eventPublisher } from '../../../../../../lib/event-publisher-service';
import { updateActivityAssignmentSchema } from '../../../../../../lib/validation/activity-assignment';

// CUID validation regex pattern
const CUID_REGEX = /^c[a-z0-9]{24}$/;

// Validate ID parameters to prevent SQL injection and malformed queries
function validateIds(activityId: string, assignmentId: string): { isValid: boolean; error?: NextResponse } {
  if (!activityId || typeof activityId !== 'string' || !CUID_REGEX.test(activityId)) {
    return {
      isValid: false,
      error: NextResponse.json(
        { error: 'Invalid activity ID format. Must be a valid CUID.' },
        { status: 400 }
      )
    };
  }
  
  if (!assignmentId || typeof assignmentId !== 'string' || !CUID_REGEX.test(assignmentId)) {
    return {
      isValid: false,
      error: NextResponse.json(
        { error: 'Invalid assignment ID format. Must be a valid CUID.' },
        { status: 400 }
      )
    };
  }
  
  return { isValid: true };
}

// GET /api/activities/[activityId]/assignments/[assignmentId] - Get a specific assignment
export async function GET(
  request: Request,
  { params }: { params: { activityId: string; assignmentId: string } }
) {
  let requestContext;
  
  try {
    const { activityId, assignmentId } = params;
    
    // Validate ID parameters
    const validation = validateIds(activityId, assignmentId);
    if (!validation.isValid) {
      return validation.error!;
    }
    
    // Create secure logging context
    requestContext = createRequestContext(
      'get_specific_assignment',
      'GET',
      undefined,
      activityId
    );

    // Get the specific assignment with user details
    const assignment = await prisma.activityAssignment.findUnique({
      where: { id: assignmentId },
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

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Convert Date objects to ISO strings for JSON serialization
    const serializedAssignment = {
      ...assignment,
      assigned_at: assignment.assigned_at.toISOString(),
    };
    
    // Log successful operation
    logSecureInfo('Specific assignment retrieved successfully', {
      ...requestContext,
      statusCode: 200,
    });

    return NextResponse.json(serializedAssignment);
  } catch (error) {
    // Secure error logging without PII exposure
    logSecureError(
      'Failed to retrieve specific assignment',
      {
        ...requestContext || createRequestContext('get_specific_assignment', 'GET'),
        statusCode: 500,
      },
      error instanceof Error ? error : undefined
    );
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/activities/[activityId]/assignments/[assignmentId] - Update an assignment
export async function PUT(
  request: Request,
  { params }: { params: { activityId: string; assignmentId: string } }
) {
  let requestContext;
  
  try {
    const { activityId, assignmentId } = params;
    
    // Validate ID parameters
    const validation = validateIds(activityId, assignmentId);
    if (!validation.isValid) {
      return validation.error!;
    }
    
    const body = await request.json();
    
    // Validate request body
    const validatedData = validateBody(updateActivityAssignmentSchema, body);
    
    // Create secure logging context with safe user ID
    const safeUserId = extractSafeUserId(validatedData);
    requestContext = createRequestContext(
      'update_activity_assignment',
      'PUT',
      safeUserId,
      activityId
    );

    // Check if assignment exists
    const existingAssignment = await prisma.activityAssignment.findUnique({
      where: { id: assignmentId },
      select: { user_id: true },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Update assignment
    const updatedAssignment = await prisma.activityAssignment.update({
      where: { id: assignmentId },
      data: {
        assignment_type: validatedData.assignment_type,
        role_instructions: validatedData.role_instructions,
        receive_notifications: validatedData.receive_notifications,
        status: validatedData.status,
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
      ...updatedAssignment,
      assigned_at: updatedAssignment.assigned_at.toISOString(),
    };
    
    // Log successful operation
    logSecureInfo('Activity assignment updated successfully', {
      ...requestContext,
      statusCode: 200,
    });

    // Broadcast real-time event for assignment update
    try {
      await eventPublisher.broadcastAssignmentChanged(
        activityId,
        existingAssignment.user_id, // Previous assignee
        updatedAssignment.user_id   // New assignee (if changed)
      );
    } catch (broadcastError) {
      // Don't fail the request if broadcasting fails
      logSecureError('Failed to broadcast assignment update event',
        createRequestContext('broadcast_assignment_updated', 'PUT', undefined, activityId, undefined),
        broadcastError instanceof Error ? broadcastError : undefined
      );
    }

    return NextResponse.json(serializedAssignment);
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Validation failed') ? 400 : 500;
    const message = statusCode === 400 ? (error as Error).message : 'Internal Server Error: Could not update assignment.';
    
    // Secure error logging without PII exposure
    logSecureError(
      'Failed to update activity assignment',
      {
        ...requestContext || createRequestContext('update_activity_assignment', 'PUT'),
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

// DELETE /api/activities/[activityId]/assignments/[assignmentId] - Delete an assignment
export async function DELETE(
  request: Request,
  { params }: { params: { activityId: string; assignmentId: string } }
) {
  let requestContext;
  
  try {
    const { activityId, assignmentId } = params;
    
    // Validate ID parameters
    const validation = validateIds(activityId, assignmentId);
    if (!validation.isValid) {
      return validation.error!;
    }
    
    // Create secure logging context
    requestContext = createRequestContext(
      'delete_activity_assignment',
      'DELETE',
      undefined,
      activityId
    );

    // Check if assignment exists and get user_id for broadcasting
    const assignmentToDelete = await prisma.activityAssignment.findUnique({
      where: { id: assignmentId },
      select: { user_id: true },
    });

    if (!assignmentToDelete) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Delete assignment
    await prisma.activityAssignment.delete({
      where: { id: assignmentId },
    });
    
    // Log successful operation
    logSecureInfo('Activity assignment deleted successfully', {
      ...requestContext,
      statusCode: 200,
    });

    // Broadcast real-time event for assignment deletion
    try {
      await eventPublisher.broadcastAssignmentChanged(
        activityId,
        assignmentToDelete.user_id, // Previous assignee
        undefined                   // No new assignee (deletion)
      );
    } catch (broadcastError) {
      // Don't fail the request if broadcasting fails
      logSecureError('Failed to broadcast assignment deletion event',
        createRequestContext('broadcast_assignment_deleted', 'DELETE', undefined, activityId, undefined),
        broadcastError instanceof Error ? broadcastError : undefined
      );
    }

    return NextResponse.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    // Secure error logging without PII exposure
    logSecureError(
      'Failed to delete activity assignment',
      {
        ...requestContext || createRequestContext('delete_activity_assignment', 'DELETE'),
        statusCode: 500,
      },
      error instanceof Error ? error : undefined
    );
    
    return NextResponse.json({ error: 'Internal Server Error: Could not delete assignment.' }, { status: 500 });
  }
}