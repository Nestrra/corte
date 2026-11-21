/** Response of GET /api/v1/health (data-model.md → HealthReport, contracts/health.openapi.yaml). */
export interface HealthReport {
  status: 'ok' | 'degraded';
  version: string;
  database: 'up' | 'down';
}
