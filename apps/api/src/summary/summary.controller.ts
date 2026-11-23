import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { SummaryService, type Summary } from './summary.service';

/** spec 004 contracts/home.openapi.yaml → GET /summary. The user always comes from the token. */
@ApiTags('summary')
@ApiBearerAuth()
@Controller('summary')
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  @Get()
  get(@CurrentUser() user: RequestUser): Promise<Summary> {
    return this.summary.get(user.id);
  }
}
