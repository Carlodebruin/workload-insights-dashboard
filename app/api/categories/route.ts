import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { validateBody, newCategorySchema } from '../../../lib/validation';
import { logSecureError, logSecureInfo, createRequestContext } from '../../../lib/secure-logger';

export async function GET() {
  const requestContext = createRequestContext('fetch_categories', 'GET');
  
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        isSystem: true
      }
    });
    
    logSecureInfo('Categories fetched successfully', {
      ...requestContext,
      statusCode: 200
    }, { recordCount: categories.length });
    
    return NextResponse.json(categories);
  } catch (error) {
    logSecureError('Failed to fetch categories', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);
    
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const requestContext = createRequestContext('create_category', 'POST');
  
  try {
    const body = await request.json();
    const validatedData = validateBody(newCategorySchema, body);
    
    const existingCategory = await prisma.category.findFirst({
      where: { name: validatedData.name },
    });

    if (existingCategory) {
      return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 });
    }

    const newCategory = await prisma.category.create({
      data: {
        id: validatedData.name.toLowerCase().replace(/\s+/g, '_'),
        name: validatedData.name,
        isSystem: validatedData.isSystem || false,
      },
      select: {
        id: true,
        name: true,
        isSystem: true
      }
    });
    
    logSecureInfo('Category created successfully', {
      ...requestContext,
      statusCode: 201,
      categoryId: newCategory.id
    });
    
    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('Validation failed') ? 400 : 500;
    const message = statusCode === 400 ? (error as Error).message : 'Internal Server Error';
    
    logSecureError('Failed to create category', {
      ...requestContext,
      statusCode
    }, error instanceof Error ? error : undefined);
    
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}