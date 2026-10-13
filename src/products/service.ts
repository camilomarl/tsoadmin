import { prisma } from '../db.js';
import type { ProductInput, ProductPatch } from './types.js';
import { validateProduct, validateProductId } from './validation.js';

export const products = {
  list: () => prisma.product.findMany({ orderBy: { id: 'asc' }, take: 100 }),
  get: (id: number) => {
    validateProductId(id);
    return prisma.product.findUniqueOrThrow({ where: { id } });
  },
  create: (data: ProductInput) => {
    validateProduct(data);
    return prisma.product.create({ data });
  },
  update: (id: number, data: ProductPatch) => {
    validateProductId(id);
    validateProduct(data);
    return prisma.product.update({ where: { id }, data });
  },
  remove: async (id: number) => {
    validateProductId(id);
    await prisma.product.delete({ where: { id } });
  },
};
