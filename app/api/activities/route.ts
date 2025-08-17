import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { NewActivityData } from '../../../types';

export async function POST(request: Request) {
  try {
    const body: NewActivityData = await request.json();

    const newActivity = await prisma.activity.create({
      data: {
        user_id: body.user_id,
        category_id: body.category_id,
        subcategory: body.subcategory,
        location: body.location,
        notes: body.notes,
        photo_url: body.photo_url,
        status: body.status || 'Unassigned',
        assigned_to_user_id: body.assigned_to_user_id,
        // Prisma will handle the ID and timestamp automatically
      },
      include: {
        updates: true,
      },
    });

    // Convert Date objects to ISO strings for JSON serialization
    const serializedActivity = {
      ...newActivity,
      timestamp: newActivity.timestamp.toISOString(),
      updates: newActivity.updates?.map((update: any) => ({
        ...update,
        timestamp: update.timestamp.toISOString(),
      })) || [],
    };


    return NextResponse.json(serializedActivity, { status: 201 });
  } catch (error) {
    console.error("Failed to create activity:", error);
    return NextResponse.json(
      { error: "Internal Server Error: Could not create activity." },
      { status: 500 }
    );
  }
}