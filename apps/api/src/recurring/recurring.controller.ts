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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { MonthView, PublicRecurringPayment } from './recurring.mapper';
import {
  createRecurringSchema,
  monthQuerySchema,
  updateRecurringSchema,
  type CreateRecurringInput,
  type MonthQuery,
  type UpdateRecurringInput,
} from './recurring.schemas';
import { RecurringService } from './recurring.service';

/** spec 005 contracts/recurring.openapi.yaml → /recurring. The user always comes from the token. */
@ApiTags('recurring')
@ApiBearerAuth()
@Controller('recurring')
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<PublicRecurringPayment[]> {
    return this.recurring.list(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createRecurringSchema)) body: CreateRecurringInput,
  ): Promise<PublicRecurringPayment> {
    return this.recurring.create(user.id, body);
  }

  /** Declared before `:id` so `occurrences` is never taken as an id (research.md R8). */
  @Get('occurrences')
  month(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(monthQuerySchema)) query: MonthQuery,
  ): Promise<MonthView> {
    return this.recurring.monthView(user.id, query.month);
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<PublicRecurringPayment> {
    return this.recurring.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRecurringSchema)) body: UpdateRecurringInput,
  ): Promise<PublicRecurringPayment> {
    return this.recurring.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<void> {
    return this.recurring.remove(user.id, id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  pause(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<PublicRecurringPayment> {
    return this.recurring.pause(user.id, id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  resume(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<PublicRecurringPayment> {
    return this.recurring.resume(user.id, id);
  }
}
