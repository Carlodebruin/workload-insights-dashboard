import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { NewUserData } from '../../../types';

export async function GET() {
  try {
    const users = await prisma.user.findMany();
    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: NewUserData = await request.json();
    const newUser = await prisma.user.create({
      data: {
        name: body.name,
        phone_number: body.phone_number,
        role: body.role,
      },
    });
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}