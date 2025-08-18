import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppPhoneVerification } from '../../../../../../lib/whatsapp/phone-verification';
import { withAuth } from '../../../../../../lib/auth-context';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../../../lib/secure-logger';

/**
 * WhatsApp User Unlinking API Endpoint
 */

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * DELETE - Unlink WhatsApp user from system user
 */
export const DELETE = withAuth(async (request: NextRequest, { params }: RouteParams) => {
  const requestContext = createRequestContext('unlink_whatsapp_user', 'DELETE');
  const whatsappUserId = params.id;
  
  try {
    if (!whatsappUserId) {
      return NextResponse.json(
        { error: 'WhatsApp user ID is required' },
        { status: 400 }
      );
    }

    // Unlink the user
    const result = await WhatsAppPhoneVerification.unlinkUser(whatsappUserId);

    if (result.success) {
      logSecureInfo('WhatsApp user unlinked successfully', {
        ...requestContext,
        statusCode: 200
      }, {
        whatsappUserId
      });

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to unlink user' },
        { status: 400 }
      );
    }
  } catch (error) {
    logSecureError('Failed to unlink WhatsApp user', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
});