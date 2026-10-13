import { ValidationError } from '../validation-error.js';

export class EmptyProductInputError extends ValidationError {
  constructor() {
    super('Provide at least one field');
  }
}

export class InvalidProductNameError extends ValidationError {
  constructor() {
    super('Name must not be blank');
  }
}

export class InvalidProductPriceError extends ValidationError {
  constructor() {
    super('Price must be a nonnegative 32-bit integer');
  }
}

export class InvalidProductIdError extends ValidationError {
  constructor() {
    super('ID must be a positive 32-bit integer');
  }
}
