import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: { categoryId: string } }
) {
  try {
    const { categoryId } = params;

    const categoryToDelete = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!categoryToDelete) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }
    if (categoryToDelete.isSystem) {
      return NextResponse.json({ error: "System categories cannot be deleted." }, { status: 403 });
    }

    // Find activities using this category to update them
    const activitiesToUpdate = await prisma.activity.findMany({
        where: { category_id: categoryId }
    });

    // Reassign activities to the 'unplanned' category
    await prisma.activity.updateMany({
      where: { category_id: categoryId },
      data: { category_id: 'unplanned' },
    });

    // Finally, delete the category
    await prisma.category.delete({
      where: { id: categoryId },
    });

    const updateInfo = activitiesToUpdate.map((a: any) => ({ id: a.id, category_id: 'unplanned' }));

    return NextResponse.json({ message: 'Category deleted successfully', activitiesToUpdate: updateInfo }, { status: 200 });

  } catch (error) {
    console.error(`Failed to delete category:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}