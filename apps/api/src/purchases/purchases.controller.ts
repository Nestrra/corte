import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { PublicPurchase, PurchaseDetail } from './purchase.mapper';
import {
  createPurchaseSchema,
  updatePurchaseSchema,
  type CreatePurchaseInput,
  type UpdatePurchaseInput,
} from './purchases.schemas';
import { PurchasesService } from './purchases.service';

/** spec 003 contracts/purchases.openapi.yaml. The user always comes from the token. */
@ApiTags('purchases')
@ApiBearerAuth()
@Controller()
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get('cards/:id/purchases')
  list(@CurrentUser() user: RequestUser, @Param('id') cardId: string): Promise<PublicPurchase[]> {
    return this.purchases.list(user.id, cardId);
  }

  @Post('cards/:id/purchases')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: RequestUser,
    @Param('id') cardId: string,
    @Body(new ZodValidationPipe(createPurchaseSchema)) body: CreatePurchaseInput,
  ): Promise<PurchaseDetail> {
    return this.purchases.create(user.id, cardId, body);
  }

  @Get('purchases/:id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<PurchaseDetail> {
    return this.purchases.get(user.id, id);
  }

  @Patch('purchases/:id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePurchaseSchema)) body: UpdatePurchaseInput,
  ): Promise<PurchaseDetail> {
    return this.purchases.update(user.id, id, body);
  }

  @Delete('purchases/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<void> {
    return this.purchases.remove(user.id, id);
  }
}
