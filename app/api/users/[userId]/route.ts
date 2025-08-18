import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { validateBody, updateUserSchema, cuidSchema } from '../../../../lib/validation';
import { logSecureError, logSecureInfo, createRequestContext } from '../../../../lib/secure-logger';
import { z } from 'zod';

export async function PUT(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const requestContext = createRequestContext('update_user', 'PUT');
  
  try {
    // Validate userId parameter
    const userIdResult = cuidSchema.safeParse(params.userId);
    if (!userIdResult.success) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }
    const { userId } = params;
    
    // Validate request body
    const body = await request.json();
    const validatedData = validateBody(updateUserSchema, body);
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        name: true,
        phone_number: true,
        role: true
      }
    });
    
    logSecureInfo('User updated successfully', {
      ...requestContext,
      statusCode: 200,
      userId: updatedUser.id
    });
    
    return NextResponse.json(updatedUser);
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Validation failed') ? 400 : 500;
    const message = statusCode === 400 ? (error as Error).message : 'Internal Server Error';
    
    logSecureError('Failed to update user', {
      ...requestContext,
      statusCode,
      userId: params.userId
    }, error instanceof Error ? error : undefined);
    
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const requestContext = createRequestContext('delete_user', 'DELETE');
  
  try {
    // Validate userId parameter
    const userIdResult = cuidSchema.safeParse(params.userId);
    if (!userIdResult.success) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }
    const { userId } = params;

    // System user check
    if (userId === '1') {
      return NextResponse.json({ error: "Cannot delete the default administrative user." }, { status: 403 });
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find a fallback user (Admin with ID '1')
    const adminUser = await prisma.user.findUnique({ where: { id: '1' } });
    if (!adminUser) {
      return NextResponse.json({ error: "Default admin user not found. Cannot reassign activities." }, { status: 500 });
    }

    // Use transaction for data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Reassign activities logged by the deleted user to the admin
      const activitiesToReassign = await tx.activity.findMany({
        where: { user_id: userId },
        select: { id: true, user_id: true }
      });
      
      await tx.activity.updateMany({
        where: { user_id: userId },
        data: { user_id: adminUser.id },
      });

      // Reassign activities assigned to the deleted user to the admin
      await tx.activity.updateMany({
        where: { assigned_to_user_id: userId },
        data: { assigned_to_user_id: adminUser.id },
      });

      // Delete related updates first
      await tx.activityUpdate.deleteMany({
        where: { author_id: userId }
      });

      // Finally, delete the user
      await tx.user.delete({
        where: { id: userId },
      });
      
      return activitiesToReassign;
    });

    // Return info about which activities were changed so client can update state
    const reassignInfo = result.map(a => ({ id: a.id, user_id: adminUser.id }));
    
    logSecureInfo('User deleted successfully', {
      ...requestContext,
      statusCode: 200,
      userId
    }, { activitiesReassigned: result.length });
    
    return NextResponse.json({ 
      message: 'User deleted successfully', 
      activitiesToReassign: reassignInfo 
    }, { status: 200 });

  } catch (error) {
    logSecureError('Failed to delete user', {
      ...requestContext,
      statusCode: 500,
      userId: params.userId
    }, error instanceof Error ? error : undefined);
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}