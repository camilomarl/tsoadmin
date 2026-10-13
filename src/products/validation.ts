import {
  EmptyProductInputError,
  InvalidProductNameError,
  InvalidProductPriceError,
  InvalidProductIdError,
} from './errors.js';
import type { ProductPatch } from './types.js';

export function validateProduct(data: ProductPatch) {
  if (Object.keys(data).length === 0) throw new EmptyProductInputError();
  if (data.name !== undefined && !data.name.trim()) throw new InvalidProductNameError();
  if (
    data.priceInCents !== undefined &&
    (!Number.isInteger(data.priceInCents) ||
      data.priceInCents < 0 ||
      data.priceInCents > 2147483647)
  )
    throw new InvalidProductPriceError();
}
export function validateProductId(id: number) {
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new InvalidProductIdError();
}
