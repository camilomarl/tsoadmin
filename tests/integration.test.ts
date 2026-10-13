import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { execFileSync } from 'node:child_process';
import { readConfig } from '../src/config.js';
import { assertTestDatabase } from '../src/config-utils.js';
const enabled = process.env.RUN_INTEGRATION === 'true';
describe.skipIf(!enabled)('database-backed API and administration', () => {
  let app: Awaited<ReturnType<(typeof import('../src/app.js'))['createApp']>>['app'];
  let close: () => Promise<void>;
  let prisma: (typeof import('../src/db.js'))['prisma'];
  beforeAll(async () => {
    const databaseUrl = assertTestDatabase(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL);
    process.env.DATABASE_URL = databaseUrl;
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
      env: process.env,
      stdio: 'pipe',
    });
    const db = await import('../src/db.js');
    prisma = db.prisma;
    const { createApp } = await import('../src/app.js');
    const result = await createApp(
      readConfig({
        DATABASE_URL: databaseUrl,
        ADMIN_EMAIL: 'admin@example.com',
        ADMIN_PASSWORD: 'test-password',
        SESSION_SECRET: 'test-secret-'.repeat(4),
      }),
    );
    app = result.app;
    close = result.close;
    await prisma.product.deleteMany();
  }, 120000);
  afterAll(async () => {
    if (close) await close();
    if (prisma) {
      await prisma.product.deleteMany();
      await prisma.$disconnect();
    }
  });
  it('supports CRUD and missing records', async () => {
    const product = (
      await request(app)
        .post('/api/products')
        .send({ name: 'Bread', priceInCents: 250 })
        .expect(201)
    ).body;
    await request(app).get(`/api/products/${product.id}`).expect(200);
    await request(app).patch(`/api/products/${product.id}`).send({ priceInCents: 300 }).expect(200);
    await request(app).get('/api/products').expect(200);
    await request(app).delete(`/api/products/${product.id}`).expect(204);
    await request(app).get(`/api/products/${product.id}`).expect(404);
  });
  it.each([
    { name: 'Bread', priceInCents: -1 },
    { name: 'Bread', priceInCents: 1.5 },
    { name: ' ', priceInCents: 100 },
    { name: 'Bread', priceInCents: 100, extra: true },
  ])('rejects invalid product %j', async (body) => {
    await request(app).post('/api/products').send(body).expect(400);
  });
  it('rejects malformed JSON and empty updates', async () => {
    await request(app)
      .post('/api/products')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    await request(app).patch('/api/products/1').send({}).expect(400);
  });
  it.each(['1.5', '-1', '2147483648'])('rejects invalid IDs %s', async (id) => {
    await request(app).get(`/api/products/${id}`).expect(400);
    await request(app).patch(`/api/products/${id}`).send({ name: 'Bread' }).expect(400);
    await request(app).delete(`/api/products/${id}`).expect(400);
  });
  it('serves health, OpenAPI and documentation', async () => {
    const health = await request(app)
      .get('/health')
      .set('X-Request-ID', 'health-integration')
      .expect(200);
    expect(health.headers['x-request-id']).toBe('health-integration');
    expect(health.headers['x-powered-by']).toBeUndefined();
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    const spec = (await request(app).get('/openapi.json').expect(200)).body;
    expect(spec.paths['/api/products'].post).toBeDefined();
    expect(spec.paths['/api/products/{id}'].delete).toBeDefined();
    await request(app).get('/docs/').expect(200);
  });
  it('requires login and rejects bad credentials', async () => {
    await request(app).get('/admin').expect(302);
    await request(app).get('/admin/api/resources/Product/actions/list').expect(302);
    await request(app)
      .post('/admin/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .type('form')
      .send({ email: 'admin@example.com', password: 'wrong' })
      .expect(200);
  });
  it('rotates the session on login and rejects the old session', async () => {
    const agent = request.agent(app);
    const first = await agent
      .post('/admin/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .type('form')
      .send({ email: 'admin@example.com', password: 'test-password' })
      .expect(302);
    const firstCookie = first.headers['set-cookie'][0].split(';')[0];
    const second = await agent
      .post('/admin/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .type('form')
      .send({ email: 'admin@example.com', password: 'test-password' })
      .expect(302);
    expect(second.headers['set-cookie'][0].split(';')[0]).not.toBe(firstCookie);
    await request(app)
      .get('/admin/api/resources/Product/actions/list')
      .set('Cookie', firstCookie)
      .expect(302);
  });
  it('admin manages the same records with persistent sessions', async () => {
    const agent = request.agent(app);
    await agent
      .post('/admin/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .type('form')
      .send({ email: 'admin@example.com', password: 'test-password' })
      .expect(302);
    const created = await agent
      .post('/admin/api/resources/Product/actions/new')
      .set('Origin', 'http://127.0.0.1:3000')
      .field('name', 'Admin bread')
      .field('priceInCents', '450')
      .expect(200);
    expect(created.body.record?.errors).toEqual({});
    const id = created.body.record.params.id;
    const product = await request(app).get(`/api/products/${id}`).expect(200);
    expect(product.body.name).toBe('Admin bread');
    await agent.get('/admin/api/resources/Product/actions/list').expect(200);
    const edited = await agent
      .post(`/admin/api/resources/Product/records/${id}/edit`)
      .set('Origin', 'http://127.0.0.1:3000')
      .field('name', 'Edited bread')
      .field('priceInCents', '500')
      .expect(200);
    expect(edited.body.record.errors).toEqual({});
    expect((await request(app).get(`/api/products/${id}`)).body.priceInCents).toBe(500);
    const invalid = await agent
      .post(`/admin/api/resources/Product/records/${id}/edit`)
      .set('Origin', 'http://127.0.0.1:3000')
      .field('priceInCents', '-1');
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: Number(id) } })).priceInCents,
    ).toBe(500);
    expect(
      invalid.status >= 400 ||
        Object.keys(invalid.body.record?.errors ?? {}).length > 0 ||
        invalid.body.notice?.type === 'error',
    ).toBe(true);
    await agent
      .post(`/admin/api/resources/Product/records/${id}/delete`)
      .set('Origin', 'http://127.0.0.1:3000')
      .expect(200);
    await request(app).get(`/api/products/${id}`).expect(404);
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT count(*) FROM admin_session',
    );
    expect(Number(rows[0].count)).toBeGreaterThan(0);
  });
});
