import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AllowPendingPasswordChange, CurrentUser } from '../auth/decorators';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { PublicUser } from './user.mapper';
import {
  deleteMeSchema,
  updateMeSchema,
  type DeleteMeInput,
  type UpdateMeInput,
} from './users.schemas';
import { UsersService } from './users.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @AllowPendingPasswordChange()
  getProfile(@CurrentUser() user: RequestUser): Promise<PublicUser> {
    return this.users.getProfile(user.id);
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateMeSchema)) body: UpdateMeInput,
  ): Promise<PublicUser> {
    return this.users.updateTimezone(user.id, body.timezone);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAccount(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(deleteMeSchema)) body: DeleteMeInput,
  ): Promise<void> {
    return this.users.deleteAccount(user.id, body.password);
  }
}
