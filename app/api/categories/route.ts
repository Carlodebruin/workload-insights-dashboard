import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  try {
    const categories = await prisma.category.findMany();
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    }
    
    const existingCategory = await prisma.category.findFirst({
      where: { name: name },
    });

    if (existingCategory) {
      return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 });
    }

    const newCategory = await prisma.category.create({
      data: {
        id: name.trim().toLowerCase().replace(/\s+/g, '_'),
        name: name.trim(),
        isSystem: false,
      },
    });
    
    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error("Failed to create category:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}