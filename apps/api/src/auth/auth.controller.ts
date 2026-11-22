import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { PublicUser } from '../users/user.mapper';
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  type ChangePasswordInput,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
} from './auth.schemas';
import { AuthService, type AuthResult } from './auth.service';
import { AllowPendingPasswordChange, CurrentUser, Public } from './decorators';
import type { RequestUser } from './jwt-auth.guard';

const FIFTEEN_MINUTES_MS = 15 * 60_000;
const ONE_HOUR_MS = 60 * 60_000;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** FR-014: 5 registrations per hour per IP; then blocked for 15 minutes. */
  @Post('register')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: ONE_HOUR_MS, blockDuration: FIFTEEN_MINUTES_MS } })
  @HttpCode(HttpStatus.CREATED)
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput): Promise<AuthResult> {
    return this.auth.register(body);
  }

  /** FR-013: 20 login requests per 15 minutes per IP; then blocked for 15 minutes. */
  @Post('login')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: FIFTEEN_MINUTES_MS, blockDuration: FIFTEEN_MINUTES_MS } })
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthResult> {
    return this.auth.login(body);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput): Promise<AuthResult> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @AllowPendingPasswordChange()
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: RequestUser): Promise<void> {
    return this.auth.logout(user);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @AllowPendingPasswordChange()
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ): Promise<PublicUser> {
    return this.auth.changePassword(user, body);
  }
}
