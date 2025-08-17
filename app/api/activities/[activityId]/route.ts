import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { NewActivityData, ActivityStatus } from '../../../../types';

export async function PUT(
  request: Request,
  { params }: { params: { activityId: string } }
) {
  try {
    const { activityId } = params;
    const { type, payload } = await request.json();

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

      let prismaData: any = {};
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
      updates: updatedActivity.updates?.map((update: any) => ({
        ...update,
        timestamp: update.timestamp.toISOString(),
      })) || [],
    };
    
    return NextResponse.json(serializedActivity);
  } catch (error) {
    console.error(`Failed to update activity:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { activityId: string } }
) {
  try {
    const { activityId } = params;

    // First delete related updates to avoid foreign key constraint errors
    await prisma.activityUpdate.deleteMany({
      where: { activity_id: activityId },
    });
    
    await prisma.activity.delete({
      where: { id: activityId },
    });
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Failed to delete activity:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}