import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { NotificationsService, type PublicNotification } from './notifications.service';

/** spec 006 contracts/notifications.openapi.yaml → /notifications. */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  history(@CurrentUser() user: RequestUser): Promise<{ items: PublicNotification[] }> {
    return this.notifications.history(user.id);
  }

  @Post('test')
  @HttpCode(HttpStatus.ACCEPTED)
  test(@CurrentUser() user: RequestUser): Promise<{ sent: number }> {
    return this.notifications.test(user);
  }
}
