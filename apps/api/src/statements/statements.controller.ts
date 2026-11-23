import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators';
import type { RequestUser } from '../auth/jwt-auth.guard';
import type { PublicStatement, StatementDetail } from './statement.mapper';
import { StatementsService } from './statements.service';

/** spec 003 contracts/purchases.openapi.yaml. The user always comes from the token. */
@ApiTags('statements')
@ApiBearerAuth()
@Controller()
export class StatementsController {
  constructor(private readonly statements: StatementsService) {}

  @Get('cards/:id/statements')
  list(@CurrentUser() user: RequestUser, @Param('id') cardId: string): Promise<PublicStatement[]> {
    return this.statements.listForCard(user.id, cardId);
  }

  @Get('statements/:id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<StatementDetail> {
    return this.statements.get(user.id, id);
  }

  @Post('statements/:id/payment')
  @HttpCode(HttpStatus.OK)
  pay(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<PublicStatement> {
    return this.statements.pay(user.id, id);
  }

  @Delete('statements/:id/payment')
  @HttpCode(HttpStatus.OK)
  unpay(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<PublicStatement> {
    return this.statements.unpay(user.id, id);
  }
}
