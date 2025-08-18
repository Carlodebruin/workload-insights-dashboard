import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { NewActivityData, ActivityStatus } from '../../../../types';
import { logSecureError, logSecureInfo, createRequestContext, extractSafeUserId } from '../../../../lib/secure-logger';
import type { Activity, ActivityUpdate, User, Category } from '@prisma/client';

// Type for Activity with included relationships
type ActivityWithIncludes = Activity & {
  updates: ActivityUpdate[];
  user?: User;
  category?: Category;
  assignedTo?: User | null;
};

// Type for serialized update with string timestamp (matching the select fields)
type SerializedActivityUpdate = {
  id: string;
  timestamp: string;
  notes: string;
  photo_url: string | null;
  author_id: string;
};

// Type for Prisma update data
type PrismaActivityUpdateData = {
  status?: ActivityStatus;
  resolution_notes?: string | null;
  assignment_instructions?: string | null;
  assigned_to_user_id?: string | null;
};

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
      'get_activity',
      'GET',
      undefined,
      activityId
    );

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        user_id: true,
        category_id: true,
        subcategory: true,
        location: true,
        timestamp: true,
        notes: true,
        photo_url: true,
        latitude: true,
        longitude: true,
        status: true,
        assigned_to_user_id: true,
        assignment_instructions: true,
        resolution_notes: true,
        // Include related data with selective fields
        updates: {
          select: {
            id: true,
            timestamp: true,
            notes: true,
            photo_url: true,
            author_id: true,
          },
          orderBy: {
            timestamp: 'asc',
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            role: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            isSystem: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            role: true,
          },
        },
      },
    });

    if (!activity) {
      logSecureInfo('Activity not found', {
        ...requestContext,
        statusCode: 404,
      });
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    // Convert Date objects to ISO strings for JSON serialization
    const serializedActivity = {
      ...activity,
      timestamp: activity.timestamp.toISOString(),
      updates: activity.updates?.map((update): SerializedActivityUpdate => ({
        ...update,
        timestamp: update.timestamp.toISOString(),
      })) || [],
    };
    
    // Log successful operation
    logSecureInfo('Activity retrieved successfully', {
      ...requestContext,
      statusCode: 200,
    });

    return NextResponse.json(serializedActivity);
  } catch (error) {
    // Secure error logging without PII exposure
    logSecureError(
      'Failed to retrieve activity',
      {
        ...requestContext || createRequestContext('get_activity', 'GET'),
        statusCode: 500,
      },
      error instanceof Error ? error : undefined
    );
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
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
    const { type, payload } = await request.json();
    
    // Create secure logging context
    const safeUserId = extractSafeUserId(payload);
    requestContext = createRequestContext(
      `update_activity_${type}`,
      'PUT',
      safeUserId,
      activityId
    );

    let updatedActivity;

    if (type === 'full_update') {
      const data: NewActivityData = payload;
      updatedActivity = await prisma.activity.update({
        where: { id: activityId },
        data: {
          user_id: data.user_id,
          category_id: data.category_id,
          subcategory: data.subcategory,
          location: data.location,
          notes: data.notes,
          photo_url: data.photo_url,
        },
        include: { updates: true },
      });
    } else if (type === 'status_update') {
      const data: { status?: ActivityStatus; resolutionNotes?: string; assignToUserId?: string; instructions?: string; } = payload;
      
      const currentActivity = await prisma.activity.findUnique({ where: { id: activityId } });
      if (!currentActivity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });

      let prismaData: PrismaActivityUpdateData = {};
      if (data.status) {
          prismaData.status = data.status;
          if (currentActivity.status === 'Resolved' && data.status === 'Open') {
              prismaData.resolution_notes = null;
          }
      }
      if (data.resolutionNotes !== undefined) prismaData.resolution_notes = data.resolutionNotes;
      if (data.instructions !== undefined) prismaData.assignment_instructions = data.instructions;
      if (data.assignToUserId !== undefined) {
          prismaData.assigned_to_user_id = data.assignToUserId;
          if(currentActivity.status === 'Unassigned') prismaData.status = 'Open';
      }
      if (data.status === 'Unassigned') {
          prismaData.assigned_to_user_id = null;
          prismaData.assignment_instructions = null;
      }

      updatedActivity = await prisma.activity.update({
        where: { id: activityId },
        data: prismaData,
        include: { updates: true },
      });
    } else {
      return NextResponse.json({ error: 'Invalid update type' }, { status: 400 });
    }

    const serializedActivity = {
      ...updatedActivity,
      timestamp: updatedActivity.timestamp.toISOString(),
      updates: updatedActivity.updates?.map((update: ActivityUpdate): SerializedActivityUpdate => ({
        ...update,
        timestamp: update.timestamp.toISOString(),
      })) || [],
    };
    
    // Log successful operation
    logSecureInfo('Activity updated successfully', {
      ...requestContext,
      statusCode: 200,
    });
    
    return NextResponse.json(serializedActivity);
  } catch (error) {
    // Secure error logging without PII exposure
    logSecureError(
      'Failed to update activity',
      {
        ...requestContext || createRequestContext('update_activity', 'PUT'),
        statusCode: 500,
      },
      error instanceof Error ? error : undefined
    );
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
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
      'delete_activity',
      'DELETE',
      undefined,
      activityId
    );

    // First delete related updates to avoid foreign key constraint errors
    await prisma.activityUpdate.deleteMany({
      where: { activity_id: activityId },
    });
    
    await prisma.activity.delete({
      where: { id: activityId },
    });
    
    // Log successful operation
    logSecureInfo('Activity deleted successfully', {
      ...requestContext,
      statusCode: 204,
    });
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Secure error logging without PII exposure
    logSecureError(
      'Failed to delete activity',
      {
        ...requestContext || createRequestContext('delete_activity', 'DELETE'),
        statusCode: 500,
      },
      error instanceof Error ? error : undefined
    );
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}