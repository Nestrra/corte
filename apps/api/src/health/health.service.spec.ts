import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import type { Env } from '../config/env.schema';
import type { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

function createService(check: jest.Mock, gitSha = 'abc123'): HealthService {
  const healthCheck = { check } as unknown as HealthCheckService;
  const withTimeout = jest.fn().mockReturnValue('attempt');
  const indicator = {
    pingCheck: jest.fn().mockReturnValue({ withTimeout }),
  } as unknown as PrismaHealthIndicator;
  const config = {
    get: jest.fn((key: keyof Env) => (key === 'GIT_SHA' ? gitSha : undefined)),
  } as unknown as ConfigService<Env, true>;
  return new HealthService(healthCheck, indicator, {} as PrismaService, config);
}

describe('HealthService', () => {
  it('reports ok/up when the database check passes', async () => {
    const check = jest.fn().mockResolvedValue({ status: 'ok' });
    await expect(createService(check).check()).resolves.toEqual({
      status: 'ok',
      version: 'abc123',
      database: 'up',
    });
  });

  it('reports degraded/down when terminus throws ServiceUnavailableException', async () => {
    const check = jest.fn().mockRejectedValue(new ServiceUnavailableException({ status: 'error' }));
    await expect(createService(check).check()).resolves.toEqual({
      status: 'degraded',
      version: 'abc123',
      database: 'down',
    });
  });

  it('uses the configured version, including "unknown"', async () => {
    const check = jest.fn().mockResolvedValue({ status: 'ok' });
    await expect(createService(check, 'unknown').check()).resolves.toMatchObject({
      version: 'unknown',
    });
  });

  it('pings the database with a 2000 ms timeout', async () => {
    const check = jest.fn(async (fns: Array<() => unknown>) => {
      fns.forEach((fn) => fn());
      return { status: 'ok' };
    });
    const healthCheck = { check } as unknown as HealthCheckService;
    const withTimeout = jest.fn().mockReturnValue('attempt');
    const pingCheck = jest.fn().mockReturnValue({ withTimeout });
    const prisma = {} as PrismaService;
    const config = { get: jest.fn(() => 'abc123') } as unknown as ConfigService<Env, true>;
    const service = new HealthService(
      healthCheck,
      { pingCheck } as unknown as PrismaHealthIndicator,
      prisma,
      config,
    );

    await service.check();

    expect(pingCheck).toHaveBeenCalledWith('database', prisma);
    expect(withTimeout).toHaveBeenCalledWith(2000);
  });

  it('rethrows unexpected errors', async () => {
    const check = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(createService(check).check()).rejects.toThrow('boom');
  });
});
