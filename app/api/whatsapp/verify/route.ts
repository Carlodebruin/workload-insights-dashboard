import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppPhoneVerification } from '../../../../lib/whatsapp/phone-verification';
import { withAuth } from '../../../../lib/auth-context';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../lib/secure-logger';
import { z } from 'zod';

/**
 * WhatsApp Phone Verification API Endpoints
 */

// Validation schemas
const initiateVerificationSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  whatsappUserId: z.string().min(1, 'WhatsApp user ID is required')
});

const verifyCodeSchema = z.object({
  verificationId: z.string().min(1, 'Verification ID is required'),
  code: z.string().length(6, 'Verification code must be 6 digits')
});

const linkingStatusSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required')
});

/**
 * POST - Initiate phone number verification
 */
export const POST = withAuth(async (request: NextRequest) => {
  const requestContext = createRequestContext('initiate_phone_verification', 'POST');
  
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = initiateVerificationSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validatedData.error.issues.map(issue => issue.message)
        },
        { status: 400 }
      );
    }

    const { phoneNumber, whatsappUserId } = validatedData.data;

    // Initiate verification
    const result = await WhatsAppPhoneVerification.initiateVerification(
      phoneNumber,
      whatsappUserId
    );

    if (result.success) {
      logSecureInfo('Phone verification initiated successfully', {
        ...requestContext,
        statusCode: 200
      }, {
        verificationId: result.verificationId,
        isExistingUser: result.isExistingUser
      });

      return NextResponse.json({
        success: true,
        verificationId: result.verificationId,
        isExistingUser: result.isExistingUser,
        linkedUserId: result.linkedUserId
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Verification initiation failed' },
        { status: 400 }
      );
    }
  } catch (error) {
    logSecureError('Failed to initiate phone verification', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
});

/**
 * PUT - Verify phone number with code
 */
export const PUT = withAuth(async (request: NextRequest) => {
  const requestContext = createRequestContext('verify_phone_code', 'PUT');
  
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = verifyCodeSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validatedData.error.issues.map(issue => issue.message)
        },
        { status: 400 }
      );
    }

    const { verificationId, code } = validatedData.data;

    // Verify code
    const result = await WhatsAppPhoneVerification.verifyPhoneNumber(
      verificationId,
      code
    );

    if (result.success) {
      logSecureInfo('Phone number verified successfully', {
        ...requestContext,
        statusCode: 200
      }, {
        verificationId,
        linkedUserId: result.linkedUserId,
        isExistingUser: result.isExistingUser
      });

      return NextResponse.json({
        success: true,
        linkedUserId: result.linkedUserId,
        isExistingUser: result.isExistingUser
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Verification failed' },
        { status: 400 }
      );
    }
  } catch (error) {
    logSecureError('Failed to verify phone code', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
});

/**
 * GET - Check user linking status
 */
export const GET = withAuth(async (request: NextRequest) => {
  const requestContext = createRequestContext('get_linking_status', 'GET');
  
  try {
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber');

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number parameter is required' },
        { status: 400 }
      );
    }

    // Get linking status
    const status = await WhatsAppPhoneVerification.getUserLinkingStatus(phoneNumber);

    logSecureInfo('User linking status retrieved', {
      ...requestContext,
      statusCode: 200
    }, {
      isLinked: status.isLinked,
      hasWhatsAppUser: !!status.whatsappUser,
      hasSystemUser: !!status.systemUser
    });

    return NextResponse.json({
      isLinked: status.isLinked,
      whatsappUser: status.whatsappUser ? {
        id: status.whatsappUser.id,
        phoneNumber: status.whatsappUser.phoneNumber,
        displayName: status.whatsappUser.displayName,
        isVerified: status.whatsappUser.isVerified,
        lastMessageAt: status.whatsappUser.lastMessageAt
      } : null,
      systemUser: status.systemUser ? {
        id: status.systemUser.id,
        name: status.systemUser.name,
        role: status.systemUser.role
      } : null
    });
  } catch (error) {
    logSecureError('Failed to get linking status', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
});