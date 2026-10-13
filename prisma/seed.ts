import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  await prisma.product.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Bread', priceInCents: 250 },
  });
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Product"', 'id'), GREATEST((SELECT MAX(id) FROM "Product"), 1))`;
} finally {
  await prisma.$disconnect();
}
