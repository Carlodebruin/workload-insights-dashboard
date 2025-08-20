import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        isSystem: true
      }
    });
    
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    
    const existingCategory = await prisma.category.findFirst({
      where: { name: body.name },
    });

    if (existingCategory) {
      return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 });
    }

    const newCategory = await prisma.category.create({
      data: {
        name: body.name,
        isSystem: body.isSystem || false,
      },
      select: {
        id: true,
        name: true,
        isSystem: true
      }
    });
    
    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error('Failed to create category:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}