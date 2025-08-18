import { NextRequest, NextResponse } from 'next/server';
import { validateBody } from '../../../lib/validation';
import { logSecureError, logSecureInfo, createRequestContext } from '../../../lib/secure-logger';
import {
  analyzeUserRetention,
  analyzeActivityRetention,
  exportUserData,
  softDeleteUser,
  anonymizeUser,
  generateComplianceReport,
  runScheduledCleanup,
  type DataExportRequest
} from '../../../lib/data-retention';
import { z } from 'zod';

// Validation schemas for GDPR operations
const exportRequestSchema = z.object({
  userId: z.string().optional(),
  phoneNumber: z.string().optional(),
  includeActivities: z.boolean().default(true),
  includeUpdates: z.boolean().default(true),
  format: z.enum(['json', 'csv']).default('json'),
}).refine(data => data.userId || data.phoneNumber, {
  message: "Either userId or phoneNumber must be provided"
});

const deleteRequestSchema = z.object({
  userId: z.string().cuid(),
  reason: z.string().min(10).max(500),
});

const anonymizeRequestSchema = z.object({
  userId: z.string().cuid(),
  reason: z.string().min(10).max(500),
});

const retentionAnalysisSchema = z.object({
  retentionDays: z.number().min(1).max(3650).optional(), // 1 day to 10 years
  recordType: z.enum(['user', 'activity']),
});

const cleanupRequestSchema = z.object({
  deleteExpiredActivities: z.boolean().default(false),
  anonymizeInactiveUsers: z.boolean().default(false),
  dryRun: z.boolean().default(true),
});

// GET /api/gdpr - Get compliance report
export async function GET(request: NextRequest) {
  let requestContext;
  
  try {
    requestContext = createRequestContext(
      'gdpr_compliance_report',
      'GET'
    );

    const report = await generateComplianceReport();
    
    logSecureInfo('GDPR compliance report generated', {
      ...requestContext,
      statusCode: 200,
    });

    return NextResponse.json({
      success: true,
      data: report,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logSecureError('Failed to generate GDPR compliance report', {
      ...requestContext || createRequestContext('gdpr_compliance_report', 'GET'),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate compliance report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/gdpr - Handle GDPR operations
export async function POST(request: NextRequest) {
  let requestContext;
  
  try {
    const { action, ...data } = await request.json();
    
    requestContext = createRequestContext(
      `gdpr_${action}`,
      'POST'
    );

    switch (action) {
      case 'export': {
        // Data Subject Access Request (GDPR Article 15)
        const validatedData = validateBody(exportRequestSchema, data);
        const exportResult = await exportUserData(validatedData as DataExportRequest);
        
        logSecureInfo('User data export completed', {
          ...requestContext,
          userId: validatedData.userId,
          statusCode: 200,
        });

        return NextResponse.json({
          success: true,
          data: exportResult,
          message: 'Data export completed successfully'
        });
      }

      case 'delete': {
        // Right to Erasure (GDPR Article 17)
        const validatedData = validateBody(deleteRequestSchema, data);
        const success = await softDeleteUser(validatedData.userId, validatedData.reason);
        
        if (success) {
          logSecureInfo('User soft deletion completed', {
            ...requestContext,
            userId: validatedData.userId,
            statusCode: 200,
          });

          return NextResponse.json({
            success: true,
            message: 'User marked for deletion successfully. Data will be permanently removed after 30 days.'
          });
        } else {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Failed to delete user data' 
            },
            { status: 500 }
          );
        }
      }

      case 'anonymize': {
        // Data anonymization (alternative to deletion)
        const validatedData = validateBody(anonymizeRequestSchema, data);
        const success = await anonymizeUser(validatedData.userId, validatedData.reason);
        
        if (success) {
          logSecureInfo('User data anonymization completed', {
            ...requestContext,
            userId: validatedData.userId,
            statusCode: 200,
          });

          return NextResponse.json({
            success: true,
            message: 'User data anonymized successfully'
          });
        } else {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Failed to anonymize user data' 
            },
            { status: 500 }
          );
        }
      }

      case 'analyze': {
        // Data retention analysis
        const validatedData = validateBody(retentionAnalysisSchema, data);
        
        let analysisResult;
        if (validatedData.recordType === 'user') {
          analysisResult = await analyzeUserRetention(validatedData.retentionDays);
        } else {
          analysisResult = await analyzeActivityRetention(validatedData.retentionDays);
        }
        
        logSecureInfo('Data retention analysis completed', {
          ...requestContext,
          statusCode: 200,
        });

        return NextResponse.json({
          success: true,
          data: analysisResult,
          recordType: validatedData.recordType
        });
      }

      case 'cleanup': {
        // Scheduled cleanup (admin only)
        const validatedData = validateBody(cleanupRequestSchema, data);
        const cleanupResult = await runScheduledCleanup(validatedData);
        
        logSecureInfo('Data cleanup operation completed', {
          ...requestContext,
          statusCode: 200,
        });

        return NextResponse.json({
          success: true,
          data: cleanupResult,
          message: validatedData.dryRun ? 'Dry run completed' : 'Cleanup completed'
        });
      }

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid action. Supported actions: export, delete, anonymize, analyze, cleanup' 
          },
          { status: 400 }
        );
    }
  } catch (error) {
    // Handle validation errors specifically
    if (error instanceof Error && error.message.includes('validation failed')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data', 
          details: error.message 
        },
        { status: 400 }
      );
    }

    logSecureError('GDPR operation failed', {
      ...requestContext || createRequestContext('gdpr_operation', 'POST'),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}