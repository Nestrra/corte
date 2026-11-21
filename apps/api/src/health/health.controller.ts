import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { HealthReport } from './health-report';
import { HealthService } from './health.service';

/** Public endpoint (FR-005): no authentication. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Servicio sano; la base de datos respondió en ≤ 2 s.' })
  @ApiServiceUnavailableResponse({ description: 'Servicio degradado; la base no respondió.' })
  async getHealth(): Promise<HealthReport> {
    const report = await this.healthService.check();
    if (report.status !== 'ok') {
      // The exception body is the report itself, so the 503 response keeps the same contract.
      throw new ServiceUnavailableException(report);
    }
    return report;
  }
}
