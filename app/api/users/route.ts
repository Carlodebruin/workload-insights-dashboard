import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        phone_number: true,
        role: true
      }
    });
    
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.name || !body.phone_number || !body.role) {
      return NextResponse.json({ error: "Name, phone_number, and role are required" }, { status: 400 });
    }
    
    const newUser = await prisma.user.create({
      data: {
        name: body.name,
        phone_number: body.phone_number,
        role: body.role,
      },
      select: {
        id: true,
        name: true,
        phone_number: true,
        role: true
      }
    });
    
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}