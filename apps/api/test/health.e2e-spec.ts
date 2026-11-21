/**
 * E2E tests for GET /api/v1/health against a real PostgreSQL (research.md R8).
 * DATABASE_URL points to corte_test (default set by the `test:e2e` script).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createServer, type AddressInfo, type Server, type Socket } from 'node:net';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

const TEST_DATABASE_URL = process.env.DATABASE_URL;
const HEALTH_PATH = '/api/v1/health';
const HEALTH_REPORT_KEYS = ['database', 'status', 'version'];

type EnvOverrides = Partial<
  Record<'DATABASE_URL' | 'APP_ENV' | 'GIT_SHA' | 'SWAGGER_ENABLED', string | undefined>
>;

async function createApp(overrides: EnvOverrides = {}): Promise<INestApplication> {
  const env: EnvOverrides = {
    DATABASE_URL: TEST_DATABASE_URL,
    APP_ENV: 'test',
    GIT_SHA: '',
    SWAGGER_ENABLED: 'false',
    ...overrides,
  };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  const moduleRef = await Test.createTestingModule({ imports: [AppModule.register()] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

/** Returns a TCP port on 127.0.0.1 with nothing listening on it. */
async function getClosedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

/** A TCP server that accepts connections and never answers (a "hung" database). */
async function startSilentServer(): Promise<{ server: Server; sockets: Set<Socket> }> {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, sockets };
}

describe('GET /api/v1/health (e2e)', () => {
  let app: INestApplication | undefined;

  beforeAll(() => {
    if (!TEST_DATABASE_URL) throw new Error('DATABASE_URL must point to the test database');
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('responds 200 ok/up with the database available, without authentication', async () => {
    app = await createApp();

    const response = await request(app.getHttpServer()).get(HEALTH_PATH).expect(200);

    expect(response.body).toEqual({ status: 'ok', version: 'unknown', database: 'up' });
    expect(Object.keys(response.body).sort()).toEqual(HEALTH_REPORT_KEYS);
  });

  it('responds 503 degraded/down when the database refuses connections', async () => {
    const port = await getClosedPort();
    app = await createApp({
      DATABASE_URL: `postgresql://corte:corte@127.0.0.1:${port}/corte_test`,
    });

    const response = await request(app.getHttpServer()).get(HEALTH_PATH).expect(503);

    expect(response.body).toEqual({ status: 'degraded', version: 'unknown', database: 'down' });
    expect(Object.keys(response.body).sort()).toEqual(HEALTH_REPORT_KEYS);
  });

  it('responds 503 within 3 s when the database hangs (SC-003)', async () => {
    const { server, sockets } = await startSilentServer();
    const { port } = server.address() as AddressInfo;
    try {
      app = await createApp({
        DATABASE_URL: `postgresql://corte:corte@127.0.0.1:${port}/corte_test`,
      });

      const startedAt = Date.now();
      const response = await request(app.getHttpServer()).get(HEALTH_PATH).expect(503);
      const elapsedMs = Date.now() - startedAt;

      expect(response.body).toEqual({ status: 'degraded', version: 'unknown', database: 'down' });
      expect(elapsedMs).toBeLessThanOrEqual(3000);
    } finally {
      sockets.forEach((socket) => socket.destroy());
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('reports the configured GIT_SHA as version', async () => {
    app = await createApp({ GIT_SHA: 'abc123def' });

    const response = await request(app.getHttpServer()).get(HEALTH_PATH).expect(200);

    expect(response.body.version).toBe('abc123def');
  });

  it('reports version "unknown" when GIT_SHA is absent', async () => {
    app = await createApp({ GIT_SHA: undefined });

    const response = await request(app.getHttpServer()).get(HEALTH_PATH).expect(200);

    expect(response.body.version).toBe('unknown');
  });

  it('does not expose Swagger when SWAGGER_ENABLED=false', async () => {
    app = await createApp({ SWAGGER_ENABLED: 'false' });

    await request(app.getHttpServer()).get('/api/docs').expect(404);
  });

  it('exposes Swagger at /api/docs when SWAGGER_ENABLED=true outside production', async () => {
    app = await createApp({ SWAGGER_ENABLED: 'true', APP_ENV: 'test' });

    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });
});
