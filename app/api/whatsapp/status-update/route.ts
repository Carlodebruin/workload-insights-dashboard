import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../lib/secure-logger';
import { sendTwilioMessage } from '../../../../lib/twilio';

/**
 * Handles sending WhatsApp notifications for status updates and new assignments using Twilio.
 */
export async function POST(request: NextRequest) {
  const requestContext = createRequestContext('status_update_notification', 'POST');
  
  try {
    const { activityId, newStatus, notes, assignedToUserId } = await request.json();

    if (!activityId) {
      return NextResponse.json({ error: 'Activity ID is required' }, { status: 400 });
    }

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: { user: true, category: true, assignedTo: true },
    });

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    const referenceNumber = `${activity.category.name.substring(0,3).toUpperCase()}-${activity.id.slice(-4)}`;

    // 1. Notify Reporter of Status Change
    if (newStatus && activity.user.phone_number) {
      const assignedToName = assignedToUserId 
        ? (await prisma.user.findUnique({ where: { id: assignedToUserId } }))?.name 
        : activity.assignedTo?.name;

      const message = createStatusUpdateMessage({
        newStatus,
        referenceNumber,
        subcategory: activity.subcategory,
        assignedToName,
        notes,
      });
      await sendTwilioMessage(activity.user.phone_number, message);
      logSecureInfo('Reporter status update sent', requestContext, { activityId, newStatus });
    }

    // 2. Notify Newly Assigned Staff
    if (assignedToUserId) {
      const assignedUser = await prisma.user.findUnique({ where: { id: assignedToUserId } });
      if (assignedUser?.phone_number) {
        const message = createAssignmentMessage({
          referenceNumber,
          subcategory: activity.subcategory,
          location: activity.location,
          reporterName: activity.user.name,
        });
        await sendTwilioMessage(assignedUser.phone_number, message);
        logSecureInfo('Staff assignment notification sent', requestContext, { activityId, assignedToUserId });
      }
    }

    return NextResponse.json({ success: true, message: 'Notifications sent' });

  } catch (error) {
    logSecureError('Status update notification error', requestContext, error instanceof Error ? error : undefined);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Message Generation Functions

function createStatusUpdateMessage(data: any): string {
  let message = `*Status Update: Ref ${data.referenceNumber}*\n`;
  message += `Task: ${data.subcategory}\n`;
  message += `New Status: *${data.newStatus}*`;
  if (data.assignedToName) message += `\nAssigned to: ${data.assignedToName}`;
  if (data.notes) message += `\nNotes: ${data.notes}`;
  return message;
}

function createAssignmentMessage(data: any): string {
  let message = `*New Assignment: Ref ${data.referenceNumber}*\n`;
  message += `Task: ${data.subcategory}\n`;
  message += `Location: ${data.location}\n`;
  message += `Reported by: ${data.reporterName}`;
  return message;
}