import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Path,
  Post,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';
import { products } from './service.js';
import type { ProductInput, ProductPatch, ProductDto } from './types.js';
@Route('api/products')
@Tags('Products')
export class ProductsController extends Controller {
  @Get() public list(): Promise<ProductDto[]> {
    return products.list();
  }
  /**
   * @isInt id
   * @minimum id 1
   * @maximum id 2147483647
   */
  @Get('{id}') public get(@Path() id: number): Promise<ProductDto> {
    return products.get(id);
  }
  @Post() @SuccessResponse('201', 'Created') public create(
    @Body() body: ProductInput,
  ): Promise<ProductDto> {
    this.setStatus(201);
    return products.create(body);
  }
  /**
   * @isInt id
   * @minimum id 1
   * @maximum id 2147483647
   */
  @Patch('{id}') public update(
    @Path() id: number,
    @Body() body: ProductPatch,
  ): Promise<ProductDto> {
    return products.update(id, body);
  }
  /**
   * @isInt id
   * @minimum id 1
   * @maximum id 2147483647
   */
  @Delete('{id}') @SuccessResponse('204', 'Deleted') public async remove(
    @Path() id: number,
  ): Promise<void> {
    await products.remove(id);
    this.setStatus(204);
  }
}
