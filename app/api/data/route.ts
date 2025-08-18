import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { validateQuery, paginationSchema } from '../../../lib/validation';
import { logger, logApiRequest, logApiResponse, logApiError, ErrorCategory } from '../../../lib/logger';

// Optimized types for selective field retrieval
type OptimizedUser = {
  id: string;
  name: string;
  phone_number: string;
  role: string;
};

type OptimizedCategory = {
  id: string;
  name: string;
  isSystem: boolean;
};

type OptimizedActivityUpdate = {
  id: string;
  timestamp: string; // Will be serialized to string
  notes: string;
  photo_url: string | null;
  author_id: string;
};

type OptimizedActivity = {
  id: string;
  user_id: string;
  category_id: string;
  subcategory: string;
  location: string;
  timestamp: string; // Will be serialized to string
  notes: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  assigned_to_user_id: string | null;
  assignment_instructions: string | null;
  resolution_notes: string | null;
  updates: OptimizedActivityUpdate[];
};

export const dynamic = 'force-dynamic'; // Ensures this route is not cached

export async function GET(request: NextRequest) {
  // Initialize comprehensive logging
  const logContext = logApiRequest(request, 'get_dashboard_data', {
    searchParams: Object.fromEntries(new URL(request.url).searchParams.entries())
  });

  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate pagination parameters
    const queryParams = Object.fromEntries(searchParams.entries());
    
    logger.debug('Validating query parameters', logContext, { queryParams });
    const { page, limit } = validateQuery(paginationSchema, queryParams);
    
    logger.info('Query parameters validated', { ...logContext, tags: ['validation'] }, { page, limit });
    
    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Fetch users and categories with selective field retrieval for better performance
    logger.debug('Starting database queries', logContext, { operation: 'fetch_users_categories' });
    
    const dbStartTime = Date.now();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        phone_number: true,
        role: true,
        // Exclude unnecessary fields, don't include relations by default
      },
      orderBy: {
        name: 'asc', // Consistent ordering for better caching
      },
    });
    
    const usersFetchTime = Date.now() - dbStartTime;
    logger.logDatabaseOperation('fetch_users', logContext, usersFetchTime, users.length);
    
    const categoriesStartTime = Date.now();
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        isSystem: true,
        // Exclude unnecessary fields, don't include relations by default
      },
      orderBy: {
        name: 'asc', // Consistent ordering for better caching
      },
    });
    
    const categoriesFetchTime = Date.now() - categoriesStartTime;
    logger.logDatabaseOperation('fetch_categories', logContext, categoriesFetchTime, categories.length);
    
    // Fetch activities with pagination and selective field retrieval
    logger.debug('Starting paginated activities query', logContext, { skip, limit });
    
    const activitiesStartTime = Date.now();
    const [activities, totalActivities] = await Promise.all([
      prisma.activity.findMany({
        skip,
        take: limit,
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
          // Include related updates with selective fields
          updates: {
            select: {
              id: true,
              timestamp: true,
              notes: true,
              photo_url: true,
              author_id: true,
              // Exclude activity_id to reduce redundancy
            },
            orderBy: {
              timestamp: 'asc', // Order updates chronologically
            },
          },
        },
        orderBy: {
          timestamp: 'desc', // Most recent activities first
        },
      }),
      prisma.activity.count(), // Get total count for pagination metadata
    ]);
    
    const activitiesFetchTime = Date.now() - activitiesStartTime;
    logger.logDatabaseOperation('fetch_activities_paginated', logContext, activitiesFetchTime, activities.length);
    
    // Log pagination statistics
    logger.info('Activities fetched with pagination', { 
      ...logContext, 
      tags: ['database', 'pagination'] 
    }, {
      totalActivities,
      pageSize: limit,
      currentPage: page,
      fetchedCount: activities.length
    });

    // Convert Date objects to ISO strings for JSON serialization
    const serializedActivities: OptimizedActivity[] = activities.map((activity) => ({
      ...activity,
      timestamp: activity.timestamp.toISOString(),
      updates: activity.updates.map((update): OptimizedActivityUpdate => ({
        ...update,
        timestamp: update.timestamp.toISOString(),
      })),
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalActivities / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    const responseData = {
      users,
      categories,
      activities: serializedActivities,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords: totalActivities,
        pageSize: limit,
        hasNextPage,
        hasPreviousPage,
      },
    };

    // Log successful response
    const responseSize = JSON.stringify(responseData).length;
    logApiResponse(logContext, 200, responseData, responseSize);

    logger.logBusinessEvent('dashboard_data_retrieved', logContext, {
      userCount: users.length,
      categoryCount: categories.length,
      activityCount: serializedActivities.length,
      totalActivities,
      page,
      limit
    });

    return NextResponse.json(responseData);
  } catch (error) {
    // Handle validation errors specifically
    if (error instanceof Error && error.message.includes('validation failed')) {
      logApiError(logContext, error, ErrorCategory.VALIDATION);
      logApiResponse(logContext, 400, { error: "Invalid query parameters" });
      
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.message },
        { status: 400 }
      );
    }
    
    // Handle database errors
    if (error instanceof Error && (error.message.includes('PrismaClient') || error.message.includes('database'))) {
      logApiError(logContext, error, ErrorCategory.DATABASE);
      logApiResponse(logContext, 500, { error: "Database error" });
      
      return NextResponse.json(
        { error: "Database error: Unable to fetch data" },
        { status: 500 }
      );
    }
    
    // Handle all other errors
    logApiError(logContext, error, ErrorCategory.SYSTEM);
    logApiResponse(logContext, 500, { error: "Internal server error" });
    
    return NextResponse.json(
      { error: "Internal Server Error: Could not fetch data from the database." },
      { status: 500 }
    );
  }
}
