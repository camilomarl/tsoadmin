export interface ProductDto {
  id: number;
  name: string;
  priceInCents: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface ProductInput {
  /** @minLength 1 */
  name: string;
  /**
   * @isInt
   * @minimum 0
   */
  priceInCents: number;
}
export interface ProductPatch {
  /** @minLength 1 */
  name?: string;
  /**
   * @isInt
   * @minimum 0
   */
  priceInCents?: number;
}
