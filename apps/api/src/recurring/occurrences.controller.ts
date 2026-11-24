import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { PublicOccurrence } from './recurring.mapper';
import { payOccurrenceSchema, type PayOccurrenceInput } from './recurring.schemas';
import { RecurringService } from './recurring.service';

/** spec 005 contracts/recurring.openapi.yaml → /occurrences. The user always comes from the token. */
@ApiTags('recurring')
@ApiBearerAuth()
@Controller('occurrences')
export class OccurrencesController {
  constructor(private readonly recurring: RecurringService) {}

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<PublicOccurrence> {
    return this.recurring.getOccurrence(user.id, id);
  }

  @Post(':id/payment')
  @HttpCode(HttpStatus.OK)
  pay(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(payOccurrenceSchema)) body: PayOccurrenceInput,
  ): Promise<PublicOccurrence> {
    return this.recurring.payOccurrence(user.id, id, body);
  }

  @Delete(':id/payment')
  @HttpCode(HttpStatus.OK)
  unpay(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<PublicOccurrence> {
    return this.recurring.unpayOccurrence(user.id, id);
  }
}
