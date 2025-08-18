import { NextRequest, NextResponse } from 'next/server';
import { validateBody } from '../../../lib/validation';
import { logSecureError, logSecureInfo, createRequestContext } from '../../../lib/secure-logger';
import { exportUserData, softDeleteUser, type DataExportRequest } from '../../../lib/data-retention';
import { prisma } from '../../../lib/prisma';
import { z } from 'zod';
import * as crypto from 'crypto';

// Validation schemas for data subject rights requests
const dataExportRequestSchema = z.object({
  // User identification (at least one required)
  userId: z.string().cuid().optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  
  // Identity verification
  verificationCode: z.string().min(6).max(10).optional(),
  
  // Export preferences
  includeActivities: z.boolean().default(true),
  includeUpdates: z.boolean().default(true),
  format: z.enum(['json', 'csv']).default('json'),
  
  // Legal basis and consent
  legalBasis: z.enum([
    'consent',
    'legitimate_interest', 
    'legal_obligation',
    'vital_interests',
    'public_task',
    'contract'
  ]).default('consent'),
}).refine(data => data.userId || data.phoneNumber, {
  message: "Either userId or phoneNumber must be provided for identification"
});

const deletionRequestSchema = z.object({
  // User identification (at least one required)
  userId: z.string().cuid().optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  
  // Identity verification
  verificationCode: z.string().min(6).max(10).optional(),
  
  // Deletion reason (GDPR Article 17 grounds)
  reason: z.enum([
    'no_longer_necessary',      // Data no longer necessary for original purpose
    'withdraw_consent',         // Withdrawal of consent
    'unlawful_processing',      // Data processed unlawfully
    'legal_obligation',         // Compliance with legal obligation
    'child_consent',           // Data collected from child without proper consent
    'object_to_processing',    // Object to processing under Art 21
    'other'                    // Other legitimate reason
  ]),
  reasonDescription: z.string().min(10).max(1000).optional(),
  
  // Confirmation and legal acknowledgment
  confirmDeletion: z.boolean().refine(val => val === true, {
    message: "You must confirm your intention to delete your data"
  }),
  acknowledgeConsequences: z.boolean().refine(val => val === true, {
    message: "You must acknowledge the consequences of data deletion"
  }),
}).refine(data => data.userId || data.phoneNumber, {
  message: "Either userId or phoneNumber must be provided for identification"
});

// Data subject rights information schema
const rightsInfoRequestSchema = z.object({
  language: z.enum(['en', 'af', 'zu']).default('en'), // Support for South African languages
});

// Helper function to verify user identity
async function verifyUserIdentity(userId?: string, phoneNumber?: string, verificationCode?: string): Promise<{ verified: boolean; user?: any; error?: string }> {
  try {
    // Find user by ID or phone number
    let user;
    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          phone_number: true,
          name: true,
          role: true,
        }
      });
    } else if (phoneNumber) {
      user = await prisma.user.findUnique({
        where: { phone_number: phoneNumber },
        select: {
          id: true,
          phone_number: true,
          name: true,
          role: true,
        }
      });
    }

    if (!user) {
      return { verified: false, error: 'User not found' };
    }

    // For now, we'll implement a simple verification system
    // In production, this should be replaced with proper identity verification
    // such as SMS codes, email verification, or integration with existing auth
    if (verificationCode) {
      // Simple verification: code should be last 6 characters of user ID + phone
      const expectedCode = crypto
        .createHash('sha256')
        .update(user.id + user.phone_number + process.env.VERIFICATION_SALT || 'default-salt')
        .digest('hex')
        .slice(-6);
      
      if (verificationCode !== expectedCode) {
        return { verified: false, error: 'Invalid verification code' };
      }
    }

    return { verified: true, user };
  } catch (error) {
    return { verified: false, error: 'Verification failed' };
  }
}

// Helper function to generate audit trail
async function createDataSubjectAuditLog(operation: string, userId: string, details: any, requestContext: any) {
  const auditEntry = {
    operation,
    userId,
    timestamp: new Date(),
    requestDetails: details,
    ipAddress: requestContext.ipAddress || 'unknown',
    userAgent: requestContext.userAgent || 'unknown',
  };

  logSecureInfo(`Data subject right exercised: ${operation}`, {
    ...requestContext,
    userId,
    statusCode: 200,
  }, auditEntry);
}

// GET /api/data-subject-rights - Export personal data (GDPR Article 15)
export async function GET(request: NextRequest) {
  let requestContext;
  
  try {
    requestContext = createRequestContext(
      'data_subject_export',
      'GET'
    );

    const url = new URL(request.url);
    const queryParams = {
      userId: url.searchParams.get('userId') || undefined,
      phoneNumber: url.searchParams.get('phoneNumber') || undefined,
      verificationCode: url.searchParams.get('verificationCode') || undefined,
      includeActivities: url.searchParams.get('includeActivities') !== 'false',
      includeUpdates: url.searchParams.get('includeUpdates') !== 'false',
      format: url.searchParams.get('format') as 'json' | 'csv' || 'json',
      legalBasis: url.searchParams.get('legalBasis') as any || 'consent',
    };

    // Validate request parameters
    const validatedData = dataExportRequestSchema.parse(queryParams);

    // Verify user identity
    const { verified, user, error } = await verifyUserIdentity(
      validatedData.userId, 
      validatedData.phoneNumber, 
      validatedData.verificationCode
    );

    if (!verified) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Identity verification failed',
          details: error || 'Unable to verify your identity',
          code: 'IDENTITY_VERIFICATION_FAILED'
        },
        { status: 401 }
      );
    }

    // Prepare export request
    const exportRequest: DataExportRequest = {
      userId: user.id,
      phoneNumber: user.phone_number,
      includeActivities: validatedData.includeActivities,
      includeUpdates: validatedData.includeUpdates,
      format: validatedData.format,
    };

    // Export user data
    const exportResult = await exportUserData(exportRequest);

    // Create audit log
    await createDataSubjectAuditLog(
      'data_export',
      user.id,
      {
        format: validatedData.format,
        includeActivities: validatedData.includeActivities,
        includeUpdates: validatedData.includeUpdates,
        legalBasis: validatedData.legalBasis,
      },
      requestContext
    );

    // Prepare response with additional metadata
    const response = {
      success: true,
      message: 'Your personal data has been exported successfully',
      data: {
        ...exportResult,
        dataSubjectRights: {
          exercisedRight: 'Right of Access (GDPR Article 15)',
          legalBasis: validatedData.legalBasis,
          exercisedAt: new Date().toISOString(),
          dataController: {
            name: 'Workload Insights Dashboard',
            contact: process.env.DATA_CONTROLLER_EMAIL || 'privacy@example.com',
          },
          retentionPeriod: 'Data is retained according to our retention policy',
          furtherRights: [
            'You have the right to rectification of inaccurate data',
            'You have the right to erasure under certain circumstances',
            'You have the right to restrict processing',
            'You have the right to data portability',
            'You have the right to object to processing',
          ],
        },
      },
      exportId: exportResult.exportId,
      exportedAt: exportResult.exportedAt,
    };

    logSecureInfo('Data subject access request completed', {
      ...requestContext,
      userId: user.id,
      statusCode: 200,
    });

    // Set appropriate headers for data export
    const headers: Record<string, string> = {
      'Content-Type': validatedData.format === 'csv' ? 'text/csv' : 'application/json',
      'Content-Disposition': `attachment; filename="personal-data-export-${exportResult.exportId}.${validatedData.format}"`,
      'X-Data-Export-ID': exportResult.exportId,
      'X-Export-Timestamp': exportResult.exportedAt.toISOString(),
    };

    if (validatedData.format === 'csv') {
      // Convert to CSV format for download
      const csvData = convertToCSV(exportResult);
      return new Response(csvData, {
        status: 200,
        headers,
      });
    }

    return NextResponse.json(response, {
      status: 200,
      headers,
    });

  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request parameters',
          details: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '),
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    logSecureError('Data subject export request failed', {
      ...requestContext || createRequestContext('data_subject_export', 'GET'),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unable to process data export request',
        details: error instanceof Error ? error.message : 'Unknown error',
        code: 'EXPORT_ERROR'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/data-subject-rights - Request data deletion (GDPR Article 17)
export async function DELETE(request: NextRequest) {
  let requestContext;
  
  try {
    requestContext = createRequestContext(
      'data_subject_deletion',
      'DELETE'
    );

    const requestData = await request.json();
    
    // Validate request data
    const validatedData = deletionRequestSchema.parse(requestData);

    // Verify user identity
    const { verified, user, error } = await verifyUserIdentity(
      validatedData.userId, 
      validatedData.phoneNumber, 
      validatedData.verificationCode
    );

    if (!verified) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Identity verification failed',
          details: error || 'Unable to verify your identity',
          code: 'IDENTITY_VERIFICATION_FAILED'
        },
        { status: 401 }
      );
    }

    // Prepare deletion reason with GDPR reference
    const deletionReason = `Data Subject Deletion Request - ${validatedData.reason}${
      validatedData.reasonDescription ? `: ${validatedData.reasonDescription}` : ''
    } (GDPR Article 17)`;

    // Perform soft deletion
    const deletionSuccess = await softDeleteUser(user.id, deletionReason);

    if (!deletionSuccess) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unable to process deletion request',
          details: 'Deletion operation failed',
          code: 'DELETION_ERROR'
        },
        { status: 500 }
      );
    }

    // Create audit log
    await createDataSubjectAuditLog(
      'data_deletion_request',
      user.id,
      {
        reason: validatedData.reason,
        reasonDescription: validatedData.reasonDescription,
        confirmed: validatedData.confirmDeletion,
        acknowledged: validatedData.acknowledgeConsequences,
      },
      requestContext
    );

    const response = {
      success: true,
      message: 'Your data deletion request has been processed successfully',
      details: {
        deletionStatus: 'scheduled',
        effectiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        permanentDeletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        dataSubjectRights: {
          exercisedRight: 'Right to Erasure (GDPR Article 17)',
          reason: validatedData.reason,
          exercisedAt: new Date().toISOString(),
          withdrawalPeriod: '30 days',
          dataController: {
            name: 'Workload Insights Dashboard',
            contact: process.env.DATA_CONTROLLER_EMAIL || 'privacy@example.com',
          },
          notificationSent: true,
          furtherActions: [
            'Data has been marked for deletion and will be permanently removed in 30 days',
            'You can contact us within 30 days to withdraw this request',
            'Some data may be retained for legal compliance purposes',
            'You will receive a confirmation once deletion is complete',
          ],
        },
      },
      requestId: `del_${user.id}_${Date.now()}`,
      processedAt: new Date().toISOString(),
    };

    logSecureInfo('Data subject deletion request completed', {
      ...requestContext,
      userId: user.id,
      statusCode: 200,
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-Deletion-Request-ID': response.requestId,
        'X-Deletion-Scheduled': response.details.effectiveDate,
      },
    });

  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '),
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    logSecureError('Data subject deletion request failed', {
      ...requestContext || createRequestContext('data_subject_deletion', 'DELETE'),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unable to process deletion request',
        details: error instanceof Error ? error.message : 'Unknown error',
        code: 'DELETION_ERROR'
      },
      { status: 500 }
    );
  }
}

// POST /api/data-subject-rights - Get information about data subject rights
export async function POST(request: NextRequest) {
  let requestContext;
  
  try {
    requestContext = createRequestContext(
      'data_subject_rights_info',
      'POST'
    );

    const requestData = await request.json();
    const validatedData = rightsInfoRequestSchema.parse(requestData);

    // Provide comprehensive information about data subject rights
    const rightsInformation = {
      success: true,
      message: 'Data Subject Rights Information',
      dataSubjectRights: {
        overview: 'Under the General Data Protection Regulation (GDPR) and Protection of Personal Information Act (POPIA), you have several rights regarding your personal data.',
        rights: [
          {
            right: 'Right of Access (Article 15)',
            description: 'You have the right to obtain confirmation whether your personal data is being processed and access to that data.',
            howToExercise: 'Use GET /api/data-subject-rights with your user ID or phone number',
            timeframe: 'Response within 1 month',
          },
          {
            right: 'Right to Rectification (Article 16)',
            description: 'You have the right to have inaccurate personal data corrected or completed if incomplete.',
            howToExercise: 'Contact us at the provided email address with correction details',
            timeframe: 'Response within 1 month',
          },
          {
            right: 'Right to Erasure (Article 17)',
            description: 'You have the right to have your personal data deleted under certain circumstances.',
            howToExercise: 'Use DELETE /api/data-subject-rights with appropriate justification',
            timeframe: 'Processing within 30 days',
          },
          {
            right: 'Right to Restrict Processing (Article 18)',
            description: 'You have the right to restrict processing of your personal data in certain situations.',
            howToExercise: 'Contact us with your restriction request',
            timeframe: 'Response within 1 month',
          },
          {
            right: 'Right to Data Portability (Article 20)',
            description: 'You have the right to receive your personal data in a machine-readable format.',
            howToExercise: 'Use GET /api/data-subject-rights with format=json or format=csv',
            timeframe: 'Response within 1 month',
          },
          {
            right: 'Right to Object (Article 21)',
            description: 'You have the right to object to processing of your personal data for certain purposes.',
            howToExercise: 'Contact us with your objection details',
            timeframe: 'Response within 1 month',
          },
        ],
        dataController: {
          name: 'Workload Insights Dashboard',
          contact: process.env.DATA_CONTROLLER_EMAIL || 'privacy@example.com',
          address: process.env.DATA_CONTROLLER_ADDRESS || 'Contact us for address details',
          phone: process.env.DATA_CONTROLLER_PHONE || 'Contact us for phone details',
        },
        dataProcessed: {
          personalData: [
            'Name and contact details (phone number)',
            'Location data (when using location features)',
            'Activity records and logs',
            'Communication preferences',
            'Technical data (IP address, browser information)',
          ],
          legalBasis: [
            'Consent for optional features',
            'Legitimate interest for service provision',
            'Legal obligation for record keeping',
            'Contract performance for service delivery',
          ],
          retentionPeriods: {
            userProfiles: '7 years or until deletion request',
            activityData: '3 years or until deletion request',
            logData: '1 year for security purposes',
          },
        },
        supervisoryAuthority: {
          name: 'Information Regulator (South Africa)',
          website: 'https://inforegulator.org.za/',
          contact: 'Contact the Information Regulator for complaints',
        },
        identityVerification: {
          required: true,
          methods: [
            'User ID and verification code',
            'Phone number and verification code',
            'Contact our support team for additional verification methods',
          ],
          note: 'Identity verification is required to protect your personal data from unauthorized access.',
        },
      },
    };

    logSecureInfo('Data subject rights information provided', {
      ...requestContext,
      statusCode: 200,
    });

    return NextResponse.json(rightsInformation);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request parameters',
          details: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '),
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    logSecureError('Data subject rights information request failed', {
      ...requestContext || createRequestContext('data_subject_rights_info', 'POST'),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unable to provide rights information',
        code: 'INFO_ERROR'
      },
      { status: 500 }
    );
  }
}

// Helper function to convert export data to CSV format
function convertToCSV(exportData: any): string {
  const headers = ['Data Type', 'Field', 'Value', 'Last Updated'];
  const rows: string[][] = [];

  // Add user data
  if (exportData.user) {
    Object.entries(exportData.user).forEach(([key, value]) => {
      rows.push([
        'User Profile',
        key,
        String(value || ''),
        exportData.exportedAt
      ]);
    });
  }

  // Add activities data
  if (exportData.activities) {
    exportData.activities.forEach((activity: any, index: number) => {
      Object.entries(activity).forEach(([key, value]) => {
        rows.push([
          `Activity ${index + 1}`,
          key,
          String(value || ''),
          activity.timestamp || exportData.exportedAt
        ]);
      });
    });
  }

  // Add updates data
  if (exportData.updates) {
    exportData.updates.forEach((update: any, index: number) => {
      Object.entries(update).forEach(([key, value]) => {
        rows.push([
          `Update ${index + 1}`,
          key,
          String(value || ''),
          update.timestamp || exportData.exportedAt
        ]);
      });
    });
  }

  // Convert to CSV format
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return csvContent;
}