import { Body, Controller, Delete, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DevicesService } from './devices.service';
import { registerDeviceSchema, type RegisterDeviceInput } from './notifications.schemas';

/** spec 006 contracts/notifications.openapi.yaml → /devices. */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  register(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(registerDeviceSchema)) body: RegisterDeviceInput,
  ): Promise<void> {
    return this.devices.register(user, body);
  }

  @Delete('current')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCurrent(@CurrentUser() user: RequestUser): Promise<void> {
    return this.devices.removeCurrent(user);
  }
}
