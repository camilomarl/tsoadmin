import { describe, expect, it, vi } from 'vitest';
import { products } from '../src/products/service.js';
import { prisma } from '../src/db.js';
import { ValidationError } from '../src/validation-error.js';

vi.mock('../src/db.js', () => ({
  prisma: {
    product: {
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('product validation', () => {
  it.each([-1, 1.5, 2147483648, NaN, Infinity])('rejects invalid price %s', (priceInCents) => {
    expect(() => products.create({ name: 'Bread', priceInCents })).toThrow(ValidationError);
  });

  it.each(['', ' ', '\t\n'])('rejects blank names %j', (name) => {
    expect(() => products.create({ name, priceInCents: 100 })).toThrow('Name must not be blank');
  });

  it('rejects an empty update', () => {
    expect(() => products.update(1, {})).toThrow('Provide at least one field');
  });

  it.each([0, -1, 1.5, 2147483648, NaN, Infinity])('rejects invalid ID %s', async (id) => {
    expect(() => products.get(id)).toThrow(ValidationError);
    expect(() => products.update(id, { name: 'Bread' })).toThrow(ValidationError);
    await expect(products.remove(id)).rejects.toThrow(ValidationError);
  });

  it.each([0, 2147483647])('accepts price boundary %s', (priceInCents) => {
    const data = { name: 'Bread', priceInCents };
    products.create(data);
    expect(prisma.product.create).toHaveBeenLastCalledWith({ data });
  });

  it.each([1, 2147483647])('accepts ID boundary %s', (id) => {
    products.get(id);
    expect(prisma.product.findUniqueOrThrow).toHaveBeenLastCalledWith({ where: { id } });
  });
});
