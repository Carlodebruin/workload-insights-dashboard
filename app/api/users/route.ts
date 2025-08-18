import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { validateBody, newUserSchema } from '../../../lib/validation';
import { logSecureError, logSecureInfo, createRequestContext } from '../../../lib/secure-logger';

export async function GET() {
  const requestContext = createRequestContext('fetch_users', 'GET');
  
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        phone_number: true,
        role: true
      }
    });
    
    logSecureInfo('Users fetched successfully', {
      ...requestContext,
      statusCode: 200
    }, { recordCount: users.length });
    
    return NextResponse.json(users);
  } catch (error) {
    logSecureError('Failed to fetch users', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const requestContext = createRequestContext('create_user', 'POST');
  
  try {
    const body = await request.json();
    const validatedData = validateBody(newUserSchema, body);
    
    const newUser = await prisma.user.create({
      data: {
        name: validatedData.name,
        phone_number: validatedData.phone_number,
        role: validatedData.role,
      },
      select: {
        id: true,
        name: true,
        phone_number: true,
        role: true
      }
    });
    
    logSecureInfo('User created successfully', {
      ...requestContext,
      statusCode: 201,
      userId: newUser.id
    });
    
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Validation failed') ? 400 : 500;
    const message = statusCode === 400 ? (error as Error).message : 'Internal Server Error';
    
    logSecureError('Failed to create user', {
      ...requestContext,
      statusCode
    }, error instanceof Error ? error : undefined);
    
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}