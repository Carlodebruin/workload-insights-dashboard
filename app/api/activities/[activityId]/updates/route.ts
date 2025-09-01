import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { ActivityUpdate } from '../../../../../types';
import type { ActivityUpdate as PrismaActivityUpdate } from '@prisma/client';

// Type for serialized update with string timestamp and enhanced fields
type SerializedActivityUpdate = Omit<PrismaActivityUpdate, 'timestamp'> & {
  timestamp: string;
  status_context?: string | null;
  update_type?: string;
};

export async function POST(
  request: Request,
  { params }: { params: { activityId: string } }
) {
  try {
    const { activityId } = params;
    const body: Omit<ActivityUpdate, 'id' | 'timestamp'> = await request.json();

    // Create the update with enhanced fields
    await prisma.activityUpdate.create({
      data: {
        notes: body.notes,
        photo_url: body.photo_url,
        author_id: body.author_id,
        activity_id: activityId,
        // Enhanced fields (optional, will use defaults if not provided)
        status_context: body.status_context || null,
        update_type: body.update_type || 'progress',
      },
    });

    // Return the whole updated activity object so the client can update its state
    const updatedActivity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: { updates: true },
    });

    if (!updatedActivity) {
      return NextResponse.json({ error: "Activity not found after update" }, { status: 404 });
    }

    const serializedActivity = {
      ...updatedActivity,
      timestamp: updatedActivity.timestamp.toISOString(),
      updates: updatedActivity.updates?.map((update: PrismaActivityUpdate): SerializedActivityUpdate => ({
        ...update,
        timestamp: update.timestamp.toISOString(),
      })) || [],
    };

    return NextResponse.json(serializedActivity, { status: 201 });
  } catch (error) {
    console.error(`Failed to add update to activity:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}