import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { NewUserData } from '../../../../types';

export async function PUT(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    const body: Partial<NewUserData> = await request.json();
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: body,
    });
    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error(`Failed to update user:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    // System user check
    if (userId === '1') {
      return NextResponse.json({ error: "Cannot delete the default administrative user." }, { status: 403 });
    }

    // Find a fallback user (Admin with ID '1')
    const adminUser = await prisma.user.findUnique({ where: { id: '1' } });
    if (!adminUser) {
      return NextResponse.json({ error: "Default admin user not found. Cannot reassign activities." }, { status: 500 });
    }

    // Reassign activities logged by the deleted user to the admin
    const activitiesToReassign = await prisma.activity.findMany({
        where: { user_id: userId }
    });
    
    await prisma.activity.updateMany({
      where: { user_id: userId },
      data: { user_id: adminUser.id },
    });

    // Reassign activities assigned to the deleted user to the admin
    await prisma.activity.updateMany({
      where: { assigned_to_user_id: userId },
      data: { assigned_to_user_id: adminUser.id },
    });

    // Delete related updates first
    await prisma.activityUpdate.deleteMany({
        where: { author_id: userId }
    });

    // Finally, delete the user
    await prisma.user.delete({
      where: { id: userId },
    });

    // Return info about which activities were changed so client can update state
    const reassignInfo = activitiesToReassign.map((a: any) => ({ id: a.id, user_id: adminUser.id }));
    
    return NextResponse.json({ message: 'User deleted successfully', activitiesToReassign: reassignInfo }, { status: 200 });

  } catch (error) {
    console.error(`Failed to delete user:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}