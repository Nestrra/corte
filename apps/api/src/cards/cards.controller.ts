import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { PublicCard } from './card.mapper';
import {
  createCardSchema,
  listCardsQuerySchema,
  updateCardSchema,
  type CreateCardInput,
  type ListCardsQuery,
  type UpdateCardInput,
} from './cards.schemas';
import { CardsService, type CardDetail } from './cards.service';

/** contracts/cards.openapi.yaml. The user always comes from the token (principle III). */
@ApiTags('cards')
@ApiBearerAuth()
@Controller('cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listCardsQuerySchema)) query: ListCardsQuery,
  ): Promise<PublicCard[]> {
    return this.cards.list(user.id, query.archived);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createCardSchema)) body: CreateCardInput,
  ): Promise<PublicCard> {
    return this.cards.create(user.id, body);
  }

  @Get(':id')
  getDetail(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<CardDetail> {
    return this.cards.getDetail(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCardSchema)) body: UpdateCardInput,
  ): Promise<PublicCard> {
    return this.cards.update(user.id, id, body);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<PublicCard> {
    return this.cards.archive(user.id, id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<PublicCard> {
    return this.cards.restore(user.id, id);
  }
}
