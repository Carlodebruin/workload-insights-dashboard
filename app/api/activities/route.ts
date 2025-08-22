import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { validateBody, validateQuery, newActivitySchema, paginationSchema } from '../../../lib/validation';
import { logSecureError, logSecureInfo, createRequestContext, extractSafeUserId } from '../../../lib/secure-logger';
import { optimizedQueries, performanceMonitor } from '../../../lib/database-optimization';
import type { Activity, ActivityUpdate } from '@prisma/client';

// Type for Activity with included updates
type ActivityWithUpdates = Activity & {
  updates: ActivityUpdate[];
};

// Type for serialized update with string timestamp (matching the select fields)
type SerializedActivityUpdate = {
  id: string;
  timestamp: string;
  notes: string;
  photo_url: string | null;
  author_id: string;
};

export async function GET(request: NextRequest) {
  let requestContext;
  
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate pagination parameters
    const queryParams = Object.fromEntries(searchParams.entries());
    const { page, limit } = validateQuery(paginationSchema, queryParams);
    
    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Create secure logging context
    requestContext = createRequestContext(
      'fetch_activities',
      'GET',
      undefined,
      undefined,
      undefined
    );

    // Fetch activities with optimized query
    const result = await performanceMonitor.measureQuery(
      'fetch_activities_paginated',
      () => optimizedQueries.getActivitiesLite(prisma, page, limit)
    );

    const { activities, pagination } = result;

    // Convert Date objects to ISO strings for JSON serialization
    const serializedActivities = activities.map((activity) => ({
      ...activity,
      timestamp: activity.timestamp.toISOString(),
      // Add user_id and category_id for backward compatibility
      user_id: activity.user.id,
      category_id: activity.category.id,
      // Add assigned_to_user_id for backward compatibility  
      assigned_to_user_id: activity.assignedTo?.id || null,
      // Add empty fields for backward compatibility
      notes: '',
      photo_url: null,
      latitude: null,
      longitude: null,
      assignment_instructions: null,
      resolution_notes: null,
      updates: []
    }));

    const responseData = {
      activities: serializedActivities,
      pagination
    };

    // Log successful operation
    logSecureInfo('Activities fetched successfully', {
      ...requestContext,
      statusCode: 200,
      count: activities.length,
    });

    return NextResponse.json(responseData);
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('validation failed') ? 400 : 500;
    const message = statusCode === 400 ? (error as Error).message : 'Internal Server Error: Could not fetch activities.';
    
    // Secure error logging without PII exposure
    logSecureError(
      'Failed to fetch activities',
      {
        ...requestContext || createRequestContext('fetch_activities', 'GET'),
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

export async function POST(request: Request) {
  let requestContext;
  
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = validateBody(newActivitySchema, body);
    
    // Create secure logging context with safe user ID
    const safeUserId = extractSafeUserId(validatedData);
    requestContext = createRequestContext(
      'create_activity',
      'POST',
      safeUserId,
      undefined,
      validatedData.category_id
    );

    const newActivity = await prisma.activity.create({
      data: {
        user_id: validatedData.user_id,
        category_id: validatedData.category_id,
        subcategory: validatedData.subcategory,
        location: validatedData.location,
        notes: validatedData.notes,
        photo_url: validatedData.photo_url,
        status: validatedData.status || 'Unassigned',
        assigned_to_user_id: validatedData.assigned_to_user_id,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        // Prisma will handle the ID and timestamp automatically
      },
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
      },
    });

    // Convert Date objects to ISO strings for JSON serialization
    const serializedActivity = {
      ...newActivity,
      timestamp: newActivity.timestamp.toISOString(),
      updates: newActivity.updates?.map((update): SerializedActivityUpdate => ({
        ...update,
        timestamp: update.timestamp.toISOString(),
      })) || [],
    };

    // Log successful operation
    logSecureInfo('Activity created successfully', {
      ...requestContext,
      activityId: newActivity.id,
      statusCode: 201,
    });

    return NextResponse.json(serializedActivity, { status: 201 });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Validation failed') ? 400 : 500;
    const message = statusCode === 400 ? (error as Error).message : 'Internal Server Error: Could not create activity.';
    
    // Secure error logging without PII exposure
    logSecureError(
      'Failed to create activity',
      {
        ...requestContext || createRequestContext('create_activity', 'POST'),
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