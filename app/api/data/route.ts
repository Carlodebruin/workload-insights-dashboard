import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic'; // Ensures this route is not cached

export async function GET() {
  try {
    const users = await prisma.user.findMany();
    const categories = await prisma.category.findMany();
    const activities = await prisma.activity.findMany({
      include: {
        updates: true, // Include related updates
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Convert Date objects to ISO strings for JSON serialization
    const serializedActivities = activities.map((activity: any) => ({
      ...activity,
      timestamp: activity.timestamp.toISOString(),
      updates: activity.updates?.map((update: any) => ({
        ...update,
        timestamp: update.timestamp.toISOString(),
      })) || [],
    }));

    return NextResponse.json({ users, categories, activities: serializedActivities });
  } catch (error) {
    console.error("Failed to fetch initial data:", error);
    return NextResponse.json(
      { error: "Internal Server Error: Could not fetch data from the database." },
      { status: 500 }
    );
  }
}
