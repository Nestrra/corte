import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  // Failures are reported through the HTTP response; terminus' own error log is redundant.
  imports: [TerminusModule.forRoot({ logger: false })],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
