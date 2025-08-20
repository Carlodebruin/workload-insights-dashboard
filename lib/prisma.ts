import { PrismaClient } from '@prisma/client';

// Simple Prisma client configuration for Neon PostgreSQL
function createPrismaClient(): PrismaClient {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return new PrismaClient({
    errorFormat: isProduction ? 'minimal' : 'pretty',
    log: isProduction ? ['error'] : ['error', 'warn'],
  });
}

// Global Prisma client instance
const globalForPrisma = global as unknown as { 
  prisma: PrismaClient | undefined;
};

// Initialize Prisma client - ensure singleton pattern
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// In development, reuse the same instance to prevent connection exhaustion
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Simple connection test utility
export const connectionPool = {
  testConnection: async (): Promise<boolean> => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  },
  
  disconnect: async (): Promise<void> => {
    await prisma.$disconnect();
  }
};

export default prisma;