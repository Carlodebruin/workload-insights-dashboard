// @ts-ignore
import { PrismaClient } from '@prisma/client';
import { MOCK_USERS, MOCK_CATEGORIES, generateMockActivities } from '../lib/mock-data';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  // Seed Users
  for (const userData of MOCK_USERS) {
    await prisma.user.upsert({
      where: { id: userData.id },
      update: {},
      create: userData,
    });
  }
  console.log('Users seeded.');

  // Seed Categories
  for (const catData of MOCK_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: catData.id },
      update: {},
      create: catData,
    });
  }
  console.log('Categories seeded.');

  // Generate and seed Activities
  const activities = generateMockActivities(150, MOCK_USERS, MOCK_CATEGORIES);
  for (const activityData of activities) {
    // Prisma doesn't support creating relations via nested create on the 'updates' field in this way.
    // We'll create the activity first, then the updates.
    const { updates, ...mainActivityData } = activityData;

    const createdActivity = await prisma.activity.create({
      data: mainActivityData,
    });

    if (updates && updates.length > 0) {
      for (const updateData of updates) {
        await prisma.activityUpdate.create({
          data: {
            ...updateData,
            activity_id: createdActivity.id,
          },
        });
      }
    }
  }
  console.log('Activities seeded.');

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });